/**
 * Neon → CockroachDB データ移行スクリプト
 * 実行: node scripts/migrate-to-cockroachdb.mjs
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { neon } = require('@neondatabase/serverless');
const { Pool }  = require('pg');

const NEON_URL = 'postgresql://neondb_owner:npg_S8GxUarAjl9v@ep-billowing-paper-aq3bd8re-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
const CRDB_URL = 'postgresql://listfile_user:ysZbkL3aHmCgSIpQYQG5aw@skiing-burro-16418.jxf.gcp-asia-southeast1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full';

// プレースホルダ上限 65536 を超えないようカラム数で最大行数を計算
function batchSize(numCols) { return Math.floor(65000 / numCols); }

// ─── CockroachDB 接続 ────────────────────────────────────────
const crdb = new Pool({ connectionString: CRDB_URL, max: 3 });

async function crdbQuery(q, params = []) {
  const res = await crdb.query(q, params);
  return res.rows;
}

// ─── Neon 接続 ───────────────────────────────────────────────
const neonSql = neon(NEON_URL);
async function neonQuery(q, params = []) {
  return neonSql.query(q, params);
}

// ─── スキーマ作成 ────────────────────────────────────────────
async function createSchema() {
  console.log('スキーマを作成中...');

  await crdbQuery(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'common',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);

  await crdbQuery(`CREATE TABLE IF NOT EXISTS csv_uploads (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    row_count INTEGER NOT NULL,
    uploaded_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    error_message TEXT,
    inserted_count INTEGER NOT NULL DEFAULT 0,
    updated_count INTEGER NOT NULL DEFAULT 0,
    work_hours REAL
  )`);

  await crdbQuery(`CREATE TABLE IF NOT EXISTS csv_data (
    id TEXT PRIMARY KEY,
    upload_id TEXT NOT NULL REFERENCES csv_uploads(id),
    row_number INTEGER NOT NULL,
    is_duplicate INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    "ID" TEXT, "名前" TEXT, "電話番号" TEXT, "住所1" TEXT, "住所2" TEXT,
    "Uber等エリア内外" TEXT, "データ取得元" TEXT, "業種大分類" TEXT, "電話番号確認" TEXT,
    "営業時間" TEXT, "時間振り" TEXT, "定休日" TEXT, "席数" TEXT, "ジャンル" TEXT, "外人店舗" TEXT,
    "単価" TEXT, "HP有無" TEXT, "オープン日" TEXT, "備考" TEXT,
    "架電対象フラグ" TEXT, "NG" TEXT, "EC" TEXT, "EC投入済" TEXT,
    "対象外理由①" TEXT, "対象外理由②" TEXT, "担当者" TEXT, "店舗精査" TEXT, "本社精査" TEXT,
    "精査担当者" TEXT, "店舗数" TEXT, "現アナ" TEXT,
    "クレーム履歴" TEXT, "最終更新日" TEXT, "最終架電日" TEXT, "通電有無" TEXT, "架電対応" TEXT,
    "決裁者対応" TEXT, "有効会話" TEXT, "AP履歴" TEXT, "対応者属性" TEXT, "オーナー名" TEXT,
    "携帯番号" TEXT, "リストランク" TEXT, "デリバリー最大進捗" TEXT, "飲食SH最大進捗" TEXT,
    "ペイメント_コール履歴" TEXT, "サイネ" TEXT, "最大進捗" TEXT
  )`);

  await crdbQuery(`CREATE INDEX IF NOT EXISTS idx_csv_data_upload_id ON csv_data(upload_id)`);
  await crdbQuery(`CREATE INDEX IF NOT EXISTS idx_csv_data_tel ON csv_data("電話番号") WHERE "電話番号" IS NOT NULL`);
  await crdbQuery(`CREATE INDEX IF NOT EXISTS idx_csv_uploads_user_id ON csv_uploads(user_id)`);

  await crdbQuery(`CREATE TABLE IF NOT EXISTS evercall_invested (
    id BIGSERIAL PRIMARY KEY,
    phone_number TEXT NOT NULL,
    list_group TEXT NOT NULL,
    invested_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    CONSTRAINT evercall_invested_uniq UNIQUE (phone_number, list_group)
  )`);
  await crdbQuery(`CREATE INDEX IF NOT EXISTS idx_evercall_phone ON evercall_invested(phone_number)`);
  await crdbQuery(`CREATE INDEX IF NOT EXISTS idx_evercall_group_phone ON evercall_invested(list_group, phone_number)`);

  await crdbQuery(`CREATE TABLE IF NOT EXISTS export_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    filters TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);

  await crdbQuery(`CREATE TABLE IF NOT EXISTS export_history (
    id TEXT PRIMARY KEY,
    list_number INTEGER NOT NULL,
    list_group TEXT NOT NULL,
    time_category TEXT NOT NULL,
    seat_condition TEXT,
    export_date TEXT NOT NULL,
    file_name TEXT NOT NULL,
    row_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`);

  await crdbQuery(`CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL
  )`);

  await crdbQuery(`CREATE TABLE IF NOT EXISTS team_members (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);

  console.log('✓ スキーマ作成完了');
}

// ─── テーブル移行ヘルパー ─────────────────────────────────────
async function migrateTable(tableName, pkCol = 'id') {
  // Neon から全行取得（ページネーション）
  const countRes = await neonQuery(`SELECT COUNT(*) AS cnt FROM "${tableName}"`);
  const total = Number(countRes[0]?.cnt ?? 0);
  if (total === 0) { console.log(`  ${tableName}: 0件 スキップ`); return; }

  // CockroachDB の既存件数確認
  const existRes = await crdbQuery(`SELECT COUNT(*) AS cnt FROM "${tableName}"`);
  const existing = Number(existRes[0]?.cnt ?? 0);
  if (existing > 0) {
    console.log(`  ${tableName}: CockroachDB に既存 ${existing.toLocaleString()} 件あり → スキップ`);
    return;
  }

  console.log(`  ${tableName}: ${total.toLocaleString()} 件を移行中...`);

  // カラム名を取得
  const colRes = await neonQuery(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND table_schema = 'public' ORDER BY ordinal_position`,
    [tableName]
  );
  const cols = colRes.map(r => String(r.column_name));
  const colsSql = cols.map(c => `"${c}"`).join(', ');
  const BATCH = batchSize(cols.length);

  let offset = 0;
  while (offset < total) {
    const rows = await neonQuery(
      `SELECT ${colsSql} FROM "${tableName}" ORDER BY ${pkCol === 'id' ? 'id' : `"${pkCol}"`} OFFSET $1 LIMIT $2`,
      [offset, BATCH]
    );
    if (rows.length === 0) break;

    // multi-row INSERT
    const placeholders = rows.map((_, ri) =>
      `(${cols.map((_, ci) => `$${ri * cols.length + ci + 1}`).join(', ')})`
    ).join(', ');
    const values = rows.flatMap(row => cols.map(c => row[c] ?? null));

    await crdbQuery(
      `INSERT INTO "${tableName}" (${colsSql}) VALUES ${placeholders} ON CONFLICT DO NOTHING`,
      values
    );

    offset += rows.length;
    process.stdout.write(`    ${offset.toLocaleString()} / ${total.toLocaleString()}\r`);
  }
  console.log(`  ✓ ${tableName}: ${total.toLocaleString()} 件完了`);
}

// ─── evercall_invested は BIGSERIAL id を除いて移行 ───────────
async function migrateEvercallInvested() {
  const countRes = await neonQuery(`SELECT COUNT(*) AS cnt FROM evercall_invested`);
  const total = Number(countRes[0]?.cnt ?? 0);
  if (total === 0) { console.log('  evercall_invested: 0件 スキップ'); return; }

  const existRes = await crdbQuery(`SELECT COUNT(*) AS cnt FROM evercall_invested`);
  if (Number(existRes[0]?.cnt ?? 0) > 0) {
    console.log(`  evercall_invested: CockroachDB に既存あり → スキップ`);
    return;
  }

  const EV_BATCH = batchSize(4);
  console.log(`  evercall_invested: ${total.toLocaleString()} 件を移行中...`);
  let offset = 0;
  while (offset < total) {
    const rows = await neonQuery(
      `SELECT phone_number, list_group, invested_at, created_at FROM evercall_invested ORDER BY id OFFSET $1 LIMIT $2`,
      [offset, EV_BATCH]
    );
    if (rows.length === 0) break;

    const placeholders = rows.map((_, i) =>
      `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`
    ).join(', ');
    const values = rows.flatMap(r => [r.phone_number, r.list_group, r.invested_at, r.created_at]);

    await crdbQuery(
      `INSERT INTO evercall_invested (phone_number, list_group, invested_at, created_at) VALUES ${placeholders} ON CONFLICT DO NOTHING`,
      values
    );

    offset += rows.length;
    process.stdout.write(`    ${offset.toLocaleString()} / ${total.toLocaleString()}\r`);
  }
  console.log(`  ✓ evercall_invested: ${total.toLocaleString()} 件完了`);
}

// ─── メイン ──────────────────────────────────────────────────
async function main() {
  console.log('=== Neon → CockroachDB 移行開始 ===\n');

  try {
    // 接続テスト
    await crdbQuery('SELECT 1');
    console.log('✓ CockroachDB 接続OK\n');
  } catch (e) {
    console.error('CockroachDB 接続失敗:', e.message);
    process.exit(1);
  }

  await createSchema();
  console.log('\nデータを移行中...');

  // 依存関係の順に移行
  await migrateTable('users');
  await migrateTable('teams');
  await migrateTable('team_members');
  await migrateTable('csv_uploads');
  await migrateTable('export_templates');
  await migrateTable('export_history');
  await migrateTable('csv_data');
  await migrateEvercallInvested();

  // 最終確認
  console.log('\n=== 移行結果 ===');
  const tables = ['users','teams','team_members','csv_uploads','csv_data','evercall_invested','export_templates','export_history'];
  for (const t of tables) {
    const r = await crdbQuery(`SELECT COUNT(*) AS cnt FROM "${t}"`);
    console.log(`  ${t}: ${Number(r[0].cnt).toLocaleString()} 件`);
  }

  console.log('\n✅ 移行完了');
  await crdb.end();
}

main().catch(e => { console.error('エラー:', e); crdb.end(); process.exit(1); });
