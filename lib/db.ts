import { neon } from '@neondatabase/serverless'

function getSQL() {
  const raw = process.env.DATABASE_URL ?? ''
  const url = raw.replace(/^﻿/, '').trim()
  if (!url) throw new Error('DATABASE_URL が設定されていません')
  return neon(url)
}

// ── リストDBカラム定義 ──────────────────────────────────────

export const LIST_COLUMNS = [
  "ID", "名前", "電話番号", "予約電話番号", "住所1", "住所2",
  "Uber等エリア内外", "データ取得元", "業種大分類", "電話番号確認",
  "営業時間", "時間振り", "定休日", "席数", "ジャンル", "外人店舗",
  "単価", "HP有無", "オープン日", "備考",
  "架電対象フラグ", "NG", "EC", "EC投入済",
  "対象外理由①", "対象外理由②", "担当者", "店舗精査", "本社精査",
  "精査担当者", "店舗数", "現アナ",
  "クレーム履歴", "最終更新日", "最終架電日", "通電有無", "架電対応",
  "決裁者対応", "有効会話", "AP履歴", "対応者属性", "オーナー名",
  "携帯番号", "リストランク", "デリバリー最大進捗", "飲食SH最大進捗",
  "ペイメント_コール履歴", "サイネ", "最大進捗",
] as const

// 精査ファイルアップロード時に電話番号一致で更新するカラム
export const SEISA_UPDATE_COLUMNS = [
  "時間振り", "定休日", "席数", "ジャンル", "備考",
  "架電対象フラグ", "NG", "EC", "EC投入済",
  "対象外理由①", "対象外理由②", "担当者", "店舗精査", "本社精査",
] as const

export type ListColumn = (typeof LIST_COLUMNS)[number]

// ── DB初期化（新規環境用 — 全データ削除） ──────────────────

export async function initializeDatabase() {
  const sql = getSQL()

  await sql`DROP TABLE IF EXISTS csv_data`
  await sql`DROP TABLE IF EXISTS csv_uploads`
  await sql`DROP TABLE IF EXISTS users`

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS csv_uploads (
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
      updated_count  INTEGER NOT NULL DEFAULT 0
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS csv_data (
      id              TEXT PRIMARY KEY,
      upload_id       TEXT NOT NULL REFERENCES csv_uploads(id),
      row_number      INTEGER NOT NULL,
      is_duplicate    INTEGER NOT NULL DEFAULT 0,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL,
      "ID"                    TEXT,
      "名前"                  TEXT,
      "電話番号"              TEXT,
      "予約電話番号"          TEXT,
      "住所1"                 TEXT,
      "住所2"                 TEXT,
      "Uber等エリア内外"      TEXT,
      "データ取得元"          TEXT,
      "業種大分類"            TEXT,
      "電話番号確認"          TEXT,
      "営業時間"              TEXT,
      "時間振り"              TEXT,
      "定休日"                TEXT,
      "席数"                  TEXT,
      "ジャンル"              TEXT,
      "外人店舗"              TEXT,
      "単価"                  TEXT,
      "HP有無"                TEXT,
      "オープン日"            TEXT,
      "備考"                  TEXT,
      "架電対象フラグ"        TEXT,
      "NG"                    TEXT,
      "EC"                    TEXT,
      "EC投入済"              TEXT,
      "対象外理由①"          TEXT,
      "対象外理由②"          TEXT,
      "担当者"                TEXT,
      "店舗精査"              TEXT,
      "本社精査"              TEXT,
      "精査担当者"            TEXT,
      "店舗数"                TEXT,
      "現アナ"                TEXT,
      "クレーム履歴"          TEXT,
      "最終更新日"            TEXT,
      "最終架電日"            TEXT,
      "通電有無"              TEXT,
      "架電対応"              TEXT,
      "決裁者対応"            TEXT,
      "有効会話"              TEXT,
      "AP履歴"                TEXT,
      "対応者属性"            TEXT,
      "オーナー名"            TEXT,
      "携帯番号"              TEXT,
      "リストランク"          TEXT,
      "デリバリー最大進捗"    TEXT,
      "飲食SH最大進捗"        TEXT,
      "ペイメント_コール履歴" TEXT,
      "サイネ"                TEXT,
      "最大進捗"              TEXT
    )
  `

  await sql`CREATE INDEX IF NOT EXISTS idx_csv_data_upload_id ON csv_data(upload_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_csv_data_list_id   ON csv_data("ID") WHERE "ID" IS NOT NULL`
  await sql`CREATE INDEX IF NOT EXISTS idx_csv_uploads_user_id ON csv_uploads(user_id)`
}

// ── スキーマ移行（旧JSONカラム → 新固定カラム）─────────────

export async function migrateSchema(): Promise<{ status: string; message: string }> {
  const sql = getSQL()

  // テーブル存在確認
  const tableCheck = await sql`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'csv_data'
  `
  if (tableCheck.length === 0) {
    return { status: 'skip', message: 'csv_dataテーブルが存在しません。/api/init-db を先に実行してください。' }
  }

  // 旧 data カラム存在確認
  const dataColCheck = await sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'csv_data' AND column_name = 'data'
  `
  if (dataColCheck.length === 0) {
    // updated_at が無ければ追加（部分移行の補完）
    await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS updated_at TEXT`
    await sql`UPDATE csv_data SET updated_at = created_at WHERE updated_at IS NULL`
    return { status: 'already_migrated', message: '既に新スキーマです。' }
  }

  // Step 1: 新カラムを追加
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS updated_at TEXT`
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS "ID" TEXT`
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS "名前" TEXT`
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS "電話番号" TEXT`
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS "予約電話番号" TEXT`
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS "住所1" TEXT`
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS "住所2" TEXT`
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS "Uber等エリア内外" TEXT`
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS "データ取得元" TEXT`
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS "業種大分類" TEXT`
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS "電話番号確認" TEXT`
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS "営業時間" TEXT`
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS "時間振り" TEXT`
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS "定休日" TEXT`
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS "席数" TEXT`
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS "ジャンル" TEXT`
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS "外人店舗" TEXT`
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS "単価" TEXT`
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS "HP有無" TEXT`
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS "オープン日" TEXT`
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS "備考" TEXT`
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS "架電対象フラグ" TEXT`
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS "NG" TEXT`
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS "EC" TEXT`
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS "EC投入済" TEXT`
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS "対象外理由①" TEXT`
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS "対象外理由②" TEXT`
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS "担当者" TEXT`
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS "店舗精査" TEXT`
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS "本社精査" TEXT`
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS "精査担当者" TEXT`
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS "店舗数" TEXT`
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS "現アナ" TEXT`
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS "クレーム履歴" TEXT`
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS "最終更新日" TEXT`
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS "最終架電日" TEXT`
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS "通電有無" TEXT`
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS "架電対応" TEXT`
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS "決裁者対応" TEXT`
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS "有効会話" TEXT`
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS "AP履歴" TEXT`
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS "対応者属性" TEXT`
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS "オーナー名" TEXT`
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS "携帯番号" TEXT`
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS "リストランク" TEXT`
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS "デリバリー最大進捗" TEXT`
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS "飲食SH最大進捗" TEXT`
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS "ペイメント_コール履歴" TEXT`
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS "サイネ" TEXT`
  await sql`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS "最大進捗" TEXT`

  // Step 2: JSONから新カラムへデータ移行
  await sql`
    UPDATE csv_data SET
      updated_at              = COALESCE(updated_at, created_at),
      "ID"                    = NULLIF(TRIM(data::jsonb->>'ID'), ''),
      "名前"                  = NULLIF(TRIM(data::jsonb->>'名前'), ''),
      "電話番号"              = NULLIF(TRIM(COALESCE(data::jsonb->>'電話番号', phone_number)), ''),
      "予約電話番号"          = NULLIF(TRIM(data::jsonb->>'予約電話番号'), ''),
      "住所1"                 = NULLIF(TRIM(COALESCE(data::jsonb->>'住所1', data::jsonb->>'住所１')), ''),
      "住所2"                 = NULLIF(TRIM(COALESCE(data::jsonb->>'住所2', data::jsonb->>'住所２')), ''),
      "Uber等エリア内外"      = NULLIF(TRIM(data::jsonb->>'Uber等エリア内外'), ''),
      "データ取得元"          = NULLIF(TRIM(data::jsonb->>'データ取得元'), ''),
      "業種大分類"            = NULLIF(TRIM(data::jsonb->>'業種大分類'), ''),
      "電話番号確認"          = NULLIF(TRIM(COALESCE(data::jsonb->>'電話番号確認', data::jsonb->>'番号確認')), ''),
      "営業時間"              = NULLIF(TRIM(data::jsonb->>'営業時間'), ''),
      "時間振り"              = NULLIF(TRIM(data::jsonb->>'時間振り'), ''),
      "定休日"                = NULLIF(TRIM(data::jsonb->>'定休日'), ''),
      "席数"                  = NULLIF(TRIM(data::jsonb->>'席数'), ''),
      "ジャンル"              = NULLIF(TRIM(data::jsonb->>'ジャンル'), ''),
      "外人店舗"              = NULLIF(TRIM(data::jsonb->>'外人店舗'), ''),
      "単価"                  = NULLIF(TRIM(data::jsonb->>'単価'), ''),
      "HP有無"                = NULLIF(TRIM(data::jsonb->>'HP有無'), ''),
      "オープン日"            = NULLIF(TRIM(data::jsonb->>'オープン日'), ''),
      "備考"                  = NULLIF(TRIM(data::jsonb->>'備考'), ''),
      "架電対象フラグ"        = NULLIF(TRIM(data::jsonb->>'架電対象フラグ'), ''),
      "NG"                    = NULLIF(TRIM(data::jsonb->>'NG'), ''),
      "EC"                    = NULLIF(TRIM(data::jsonb->>'EC'), ''),
      "EC投入済"              = NULLIF(TRIM(data::jsonb->>'EC投入済'), ''),
      "対象外理由①"          = NULLIF(TRIM(COALESCE(data::jsonb->>'対象外理由①', data::jsonb->>'対象外理由1')), ''),
      "対象外理由②"          = NULLIF(TRIM(COALESCE(data::jsonb->>'対象外理由②', data::jsonb->>'対象外理由2')), ''),
      "担当者"                = NULLIF(TRIM(data::jsonb->>'担当者'), ''),
      "店舗精査"              = NULLIF(TRIM(data::jsonb->>'店舗精査'), ''),
      "本社精査"              = NULLIF(TRIM(data::jsonb->>'本社精査'), ''),
      "精査担当者"            = NULLIF(TRIM(data::jsonb->>'精査担当者'), ''),
      "店舗数"                = NULLIF(TRIM(data::jsonb->>'店舗数'), ''),
      "現アナ"                = NULLIF(TRIM(data::jsonb->>'現アナ'), ''),
      "クレーム履歴"          = NULLIF(TRIM(data::jsonb->>'クレーム履歴'), ''),
      "最終更新日"            = NULLIF(TRIM(data::jsonb->>'最終更新日'), ''),
      "最終架電日"            = NULLIF(TRIM(data::jsonb->>'最終架電日'), ''),
      "通電有無"              = NULLIF(TRIM(data::jsonb->>'通電有無'), ''),
      "架電対応"              = NULLIF(TRIM(data::jsonb->>'架電対応'), ''),
      "決裁者対応"            = NULLIF(TRIM(data::jsonb->>'決裁者対応'), ''),
      "有効会話"              = NULLIF(TRIM(data::jsonb->>'有効会話'), ''),
      "AP履歴"                = NULLIF(TRIM(data::jsonb->>'AP履歴'), ''),
      "対応者属性"            = NULLIF(TRIM(data::jsonb->>'対応者属性'), ''),
      "オーナー名"            = NULLIF(TRIM(data::jsonb->>'オーナー名'), ''),
      "携帯番号"              = NULLIF(TRIM(data::jsonb->>'携帯番号'), ''),
      "リストランク"          = NULLIF(TRIM(data::jsonb->>'リストランク'), ''),
      "デリバリー最大進捗"    = NULLIF(TRIM(data::jsonb->>'デリバリー最大進捗'), ''),
      "飲食SH最大進捗"        = NULLIF(TRIM(data::jsonb->>'飲食SH最大進捗'), ''),
      "ペイメント_コール履歴" = NULLIF(TRIM(COALESCE(data::jsonb->>'ペイメント_コール履歴', data::jsonb->>'ペイメントコール履歴')), ''),
      "サイネ"                = NULLIF(TRIM(data::jsonb->>'サイネ'), ''),
      "最大進捗"              = NULLIF(TRIM(data::jsonb->>'最大進捗'), '')
    WHERE data IS NOT NULL
  `

  // Step 3: 旧カラム削除
  await sql`ALTER TABLE csv_data DROP COLUMN IF EXISTS data`
  await sql`ALTER TABLE csv_data DROP COLUMN IF EXISTS phone_number`

  // csv_uploads に件数カラムを追加（マイグレーション時）
  await sql`ALTER TABLE csv_uploads ADD COLUMN IF NOT EXISTS inserted_count INTEGER NOT NULL DEFAULT 0`
  await sql`ALTER TABLE csv_uploads ADD COLUMN IF NOT EXISTS updated_count  INTEGER NOT NULL DEFAULT 0`

  // インデックス
  await sql`CREATE INDEX IF NOT EXISTS idx_csv_data_list_id ON csv_data("ID") WHERE "ID" IS NOT NULL`

  return { status: 'success', message: `移行完了。` }
}

// ── ユーザー操作 ─────────────────────────────────────────

export async function createUser(id: string, username: string, password_hash: string) {
  const sql = getSQL()
  const now = new Date().toISOString()
  await sql`
    INSERT INTO users (id, username, password_hash, created_at, updated_at)
    VALUES (${id}, ${username}, ${password_hash}, ${now}, ${now})
  `
}

export async function getUserByUsername(username: string) {
  const sql = getSQL()
  const result = await sql`SELECT * FROM users WHERE username = ${username} LIMIT 1`
  return result[0] ?? null
}

export async function getUserById(id: string) {
  const sql = getSQL()
  const result = await sql`SELECT * FROM users WHERE id = ${id} LIMIT 1`
  return result[0] ?? null
}

// ── CSVアップロード操作 ──────────────────────────────────

export async function createCSVUpload(
  id: string, userId: string, filename: string,
  originalFilename: string, fileSize: number, rowCount: number,
  insertedCount = 0, updatedCount = 0
) {
  const sql = getSQL()
  const now = new Date().toISOString()
  await sql`
    INSERT INTO csv_uploads
      (id, user_id, filename, original_filename, file_size, row_count, uploaded_at, status, inserted_count, updated_count)
    VALUES
      (${id}, ${userId}, ${filename}, ${originalFilename}, ${fileSize}, ${rowCount}, ${now}, 'processed', ${insertedCount}, ${updatedCount})
  `
}

export async function updateCSVUploadCounts(id: string, insertedCount: number, updatedCount: number) {
  const sql = getSQL()
  await sql`UPDATE csv_uploads SET inserted_count = ${insertedCount}, updated_count = ${updatedCount} WHERE id = ${id}`
}

export async function getCSVUploadsByUserId(userId: string) {
  const sql = getSQL()
  return sql`SELECT * FROM csv_uploads WHERE user_id = ${userId} ORDER BY uploaded_at DESC`
}

export async function getCSVUploadById(uploadId: string) {
  const sql = getSQL()
  const result = await sql`SELECT * FROM csv_uploads WHERE id = ${uploadId} LIMIT 1`
  return result[0] ?? null
}

// ── CSVデータ アップサート（電話番号突合）─────────────────
// 精査ファイルのIDは無視し、電話番号をキーとして突合する
// 一致 → 精査済み14カラムを上書き更新
// 不一致 → 全カラム新規挿入（IDはNULL）

export async function upsertCSVRow(
  internalId: string,
  uploadId: string,
  rowNumber: number,
  row: Record<string, string>,
): Promise<{ action: 'inserted' | 'updated' }> {
  const sql = getSQL()
  const now = new Date().toISOString()
  const tel = row["電話番号"] ? row["電話番号"].trim() || null : null

  // ── 電話番号で既存レコードを検索 ──
  if (tel) {
    const existing = await sql`
      SELECT id FROM csv_data WHERE "電話番号" = ${tel} LIMIT 1
    `
    if (existing.length > 0) {
      // 精査済み14カラムを上書き更新（IDは保持）
      await sql`
        UPDATE csv_data SET
          "時間振り"       = ${row["時間振り"]       ?? null},
          "定休日"         = ${row["定休日"]         ?? null},
          "席数"           = ${row["席数"]           ?? null},
          "ジャンル"       = ${row["ジャンル"]       ?? null},
          "備考"           = ${row["備考"]           ?? null},
          "架電対象フラグ" = ${row["架電対象フラグ"] ?? null},
          "NG"             = ${row["NG"]             ?? null},
          "EC"             = ${row["EC"]             ?? null},
          "EC投入済"       = ${row["EC投入済"]       ?? null},
          "対象外理由①"   = ${row["対象外理由①"]   ?? null},
          "対象外理由②"   = ${row["対象外理由②"]   ?? null},
          "担当者"         = ${row["担当者"]         ?? null},
          "店舗精査"       = ${row["店舗精査"]       ?? null},
          "本社精査"       = ${row["本社精査"]       ?? null},
          is_duplicate     = 1,
          updated_at       = ${now},
          upload_id        = ${uploadId}
        WHERE "電話番号" = ${tel}
      `
      return { action: 'updated' }
    }
  }

  // ── 電話番号不一致 → 新規挿入（精査ファイルのIDは無視し NULL）──
  await sql`
    INSERT INTO csv_data (
      id, upload_id, row_number, is_duplicate, created_at, updated_at,
      "ID", "名前", "電話番号", "予約電話番号", "住所1", "住所2",
      "Uber等エリア内外", "データ取得元", "業種大分類", "電話番号確認",
      "営業時間", "時間振り", "定休日", "席数", "ジャンル", "外人店舗",
      "単価", "HP有無", "オープン日", "備考",
      "架電対象フラグ", "NG", "EC", "EC投入済",
      "対象外理由①", "対象外理由②", "担当者", "店舗精査", "本社精査",
      "精査担当者", "店舗数", "現アナ",
      "クレーム履歴", "最終更新日", "最終架電日", "通電有無", "架電対応",
      "決裁者対応", "有効会話", "AP履歴", "対応者属性", "オーナー名",
      "携帯番号", "リストランク", "デリバリー最大進捗", "飲食SH最大進捗",
      "ペイメント_コール履歴", "サイネ", "最大進捗"
    ) VALUES (
      ${internalId}, ${uploadId}, ${rowNumber}, 0, ${now}, ${now},
      NULL,
      ${row["名前"]           ?? null}, ${row["電話番号"]       ?? null}, ${row["予約電話番号"]   ?? null},
      ${row["住所1"]          ?? null}, ${row["住所2"]          ?? null},
      ${row["Uber等エリア内外"] ?? null}, ${row["データ取得元"] ?? null}, ${row["業種大分類"]     ?? null},
      ${row["電話番号確認"]   ?? null},
      ${row["営業時間"]       ?? null}, ${row["時間振り"]       ?? null}, ${row["定休日"]         ?? null},
      ${row["席数"]           ?? null}, ${row["ジャンル"]       ?? null}, ${row["外人店舗"]       ?? null},
      ${row["単価"]           ?? null}, ${row["HP有無"]         ?? null}, ${row["オープン日"]     ?? null},
      ${row["備考"]           ?? null},
      ${row["架電対象フラグ"] ?? null}, ${row["NG"]             ?? null}, ${row["EC"]             ?? null},
      ${row["EC投入済"]       ?? null},
      ${row["対象外理由①"]   ?? null}, ${row["対象外理由②"]   ?? null}, ${row["担当者"]         ?? null},
      ${row["店舗精査"]       ?? null}, ${row["本社精査"]       ?? null},
      ${row["精査担当者"]     ?? null}, ${row["店舗数"]         ?? null}, ${row["現アナ"]         ?? null},
      ${row["クレーム履歴"]   ?? null}, ${row["最終更新日"]     ?? null}, ${row["最終架電日"]     ?? null},
      ${row["通電有無"]       ?? null}, ${row["架電対応"]       ?? null},
      ${row["決裁者対応"]     ?? null}, ${row["有効会話"]       ?? null}, ${row["AP履歴"]         ?? null},
      ${row["対応者属性"]     ?? null}, ${row["オーナー名"]     ?? null},
      ${row["携帯番号"]       ?? null}, ${row["リストランク"]   ?? null},
      ${row["デリバリー最大進捗"] ?? null}, ${row["飲食SH最大進捗"] ?? null},
      ${row["ペイメント_コール履歴"] ?? null}, ${row["サイネ"] ?? null}, ${row["最大進捗"]       ?? null}
    )
  `
  return { action: 'inserted' }
}

// 電話番号の既存チェック（後方互換用）
export async function checkDuplicate(phoneNumber: string): Promise<boolean> {
  const sql = getSQL()
  const result = await sql`SELECT 1 FROM csv_data WHERE "電話番号" = ${phoneNumber} LIMIT 1`
  return result.length > 0
}


export async function getCSVDataByUploadId(uploadId: string) {
  const sql = getSQL()
  return sql`SELECT * FROM csv_data WHERE upload_id = ${uploadId} ORDER BY row_number`
}

// ── ダッシュボード統計 ─────────────────────────────────────

export async function getDashboardStatsAll() {
  const sql = getSQL()
  const [totalRes, seisaRes, telRes] = await Promise.all([
    sql`SELECT COUNT(*)::integer as count FROM csv_data`,
    sql`SELECT COUNT(*)::integer as count FROM csv_data WHERE "時間振り" IS NOT NULL AND "時間振り" != ''`,
    sql`SELECT COUNT(*)::integer as count FROM csv_data WHERE "電話番号" IS NOT NULL AND "電話番号" != ''`,
  ])
  const total       = Number(totalRes[0]?.count   ?? 0)
  const seisa_count = Number(seisaRes[0]?.count   ?? 0)
  const tel_count   = Number(telRes[0]?.count     ?? 0)
  const unseisa_count = total - seisa_count
  return { total, seisa_count, unseisa_count, tel_count }
}

export async function getAllDataPreview(limit = 20) {
  const sql = getSQL()
  const rows = await sql`
    SELECT "ID", "名前", "電話番号", "住所1", "ジャンル", "時間振り"
    FROM csv_data ORDER BY created_at LIMIT ${limit}
  `
  return rows.map((r) => ({
    ID:      String(r["ID"]      ?? ''),
    名前:    String(r["名前"]    ?? ''),
    電話番号: String(r["電話番号"] ?? ''),
    住所1:   String(r["住所1"]   ?? ''),
    ジャンル: String(r["ジャンル"] ?? ''),
    時間振り: String(r["時間振り"] ?? ''),
  }))
}

// ── 全データ分析（分析ページ用）────────────────────────────

export async function getGlobalColumnStats() {
  const sql = getSQL()
  const [totalRes, statsRows] = await Promise.all([
    sql`SELECT COUNT(*)::integer as count FROM csv_data`,
    sql`
      SELECT key, COUNT(*)::integer AS fill_count, COUNT(DISTINCT val)::integer AS unique_count
      FROM csv_data,
      LATERAL (VALUES
        ('ID',                    "ID"),
        ('名前',                  "名前"),
        ('電話番号',              "電話番号"),
        ('予約電話番号',          "予約電話番号"),
        ('住所1',                 "住所1"),
        ('住所2',                 "住所2"),
        ('Uber等エリア内外',      "Uber等エリア内外"),
        ('データ取得元',          "データ取得元"),
        ('業種大分類',            "業種大分類"),
        ('電話番号確認',          "電話番号確認"),
        ('営業時間',              "営業時間"),
        ('時間振り',              "時間振り"),
        ('定休日',                "定休日"),
        ('席数',                  "席数"),
        ('ジャンル',              "ジャンル"),
        ('外人店舗',              "外人店舗"),
        ('単価',                  "単価"),
        ('HP有無',                "HP有無"),
        ('オープン日',            "オープン日"),
        ('備考',                  "備考"),
        ('架電対象フラグ',        "架電対象フラグ"),
        ('NG',                    "NG"),
        ('EC',                    "EC"),
        ('EC投入済',              "EC投入済"),
        ('対象外理由①',          "対象外理由①"),
        ('対象外理由②',          "対象外理由②"),
        ('担当者',                "担当者"),
        ('店舗精査',              "店舗精査"),
        ('本社精査',              "本社精査"),
        ('精査担当者',            "精査担当者"),
        ('店舗数',                "店舗数"),
        ('現アナ',                "現アナ"),
        ('クレーム履歴',          "クレーム履歴"),
        ('最終更新日',            "最終更新日"),
        ('最終架電日',            "最終架電日"),
        ('通電有無',              "通電有無"),
        ('架電対応',              "架電対応"),
        ('決裁者対応',            "決裁者対応"),
        ('有効会話',              "有効会話"),
        ('AP履歴',                "AP履歴"),
        ('対応者属性',            "対応者属性"),
        ('オーナー名',            "オーナー名"),
        ('携帯番号',              "携帯番号"),
        ('リストランク',          "リストランク"),
        ('デリバリー最大進捗',    "デリバリー最大進捗"),
        ('飲食SH最大進捗',        "飲食SH最大進捗"),
        ('ペイメント_コール履歴', "ペイメント_コール履歴"),
        ('サイネ',                "サイネ"),
        ('最大進捗',              "最大進捗")
      ) AS t(key, val)
      WHERE val IS NOT NULL AND val != ''
      GROUP BY key
    `,
  ])
  const total = Number(totalRes[0]?.count ?? 0)
  const columnStats: Record<string, {
    total: number; unique: number; null_count: number; null_percent: string;
    top_values: Array<{ value: string; count: number }>;
  }> = {}
  const statsMap: Record<string, { fill: number; unique: number }> = {}
  for (const row of statsRows) {
    statsMap[String(row.key)] = { fill: Number(row.fill_count), unique: Number(row.unique_count) }
  }
  for (const col of LIST_COLUMNS) {
    const fill      = statsMap[col]?.fill   ?? 0
    const unique    = statsMap[col]?.unique ?? 0
    const nullCount = total - fill
    columnStats[col] = {
      total: fill, unique,
      null_count: nullCount,
      null_percent: total > 0 ? ((nullCount / total) * 100).toFixed(2) : '0.00',
      top_values: [],
    }
  }
  return { totalRows: total, columns: [...LIST_COLUMNS], columnStats }
}

export async function getGlobalTopValues(topN = 5) {
  const sql = getSQL()
  try {
    const rows = await sql`
      SELECT key, val, cnt FROM (
        SELECT key, val, COUNT(*)::integer AS cnt,
          ROW_NUMBER() OVER (PARTITION BY key ORDER BY COUNT(*) DESC) AS rn
        FROM csv_data,
        LATERAL (VALUES
          ('ジャンル',        "ジャンル"),
          ('時間振り',        "時間振り"),
          ('業種大分類',      "業種大分類"),
          ('備考',            "備考"),
          ('Uber等エリア内外',"Uber等エリア内外"),
          ('リストランク',    "リストランク"),
          ('通電有無',        "通電有無"),
          ('架電対応',        "架電対応")
        ) AS t(key, val)
        WHERE val IS NOT NULL AND val != ''
        GROUP BY key, val
      ) sub
      WHERE rn <= ${topN}
      ORDER BY key, rn
    `
    const topValues: Record<string, Array<{ value: string; count: number }>> = {}
    for (const row of rows) {
      const k = String(row.key)
      if (!topValues[k]) topValues[k] = []
      topValues[k].push({ value: String(row.val), count: Number(row.cnt) })
    }
    return topValues
  } catch (e) {
    console.error('getGlobalTopValues error:', e)
    return {}
  }
}

export async function getGenreDistribution() {
  const sql = getSQL()
  const rows = await sql`
    SELECT "ジャンル" AS genre, COUNT(*)::integer AS count
    FROM csv_data
    WHERE "ジャンル" IS NOT NULL AND "ジャンル" != ''
    GROUP BY "ジャンル"
    ORDER BY count DESC
    LIMIT 20
  `
  return rows.map((r) => ({ name: String(r.genre), value: Number(r.count) }))
}

export async function getAddressesForRegion() {
  const sql = getSQL()
  const rows = await sql`
    SELECT "住所1" AS address, COUNT(*)::integer AS count
    FROM csv_data
    WHERE "住所1" IS NOT NULL AND "住所1" != ''
    GROUP BY "住所1"
    ORDER BY count DESC
    LIMIT 1000
  `
  return rows.map((r) => ({ address: String(r.address ?? ''), count: Number(r.count) }))
}

export async function getGlobalStatusDistribution() {
  const sql = getSQL()
  const [seisaRes, telRes, dupRes, rankRes] = await Promise.all([
    sql`SELECT COUNT(*)::integer as count FROM csv_data WHERE "時間振り" IS NOT NULL AND "時間振り" != ''`,
    sql`SELECT COUNT(*)::integer as count FROM csv_data WHERE "電話番号" IS NOT NULL AND "電話番号" != ''`,
    sql`SELECT COUNT(*)::integer as count FROM csv_data WHERE is_duplicate = 1`,
    sql`SELECT COUNT(*)::integer as count FROM csv_data WHERE "リストランク" IS NOT NULL AND "リストランク" != ''`,
  ])
  return {
    seisa_count: Number(seisaRes[0]?.count ?? 0),
    tel_count:   Number(telRes[0]?.count   ?? 0),
    duplicates:  Number(dupRes[0]?.count   ?? 0),
    rank_count:  Number(rankRes[0]?.count  ?? 0),
  }
}

// ── 全アップロード＋ユーザー名 ────────────────────────────

export async function getAllCSVUploadsWithUsers() {
  const sql = getSQL()
  return sql`
    SELECT
      cu.id, cu.original_filename, cu.row_count, cu.uploaded_at, cu.status,
      cu.inserted_count, cu.updated_count,
      u.username
    FROM csv_uploads cu
    JOIN users u ON cu.user_id = u.id
    ORDER BY cu.uploaded_at DESC
  `
}

// ── エクスポート用フィルター ───────────────────────────────

export interface ExportFilters {
  genres?: string[]
  timeCategories?: string[]
  seatMin?: number
  seatMax?: number
  bikou?: string[]
}

function toArrayOrNull<T>(arr: T[] | undefined): T[] | null {
  return arr && arr.length > 0 ? arr : null
}

export async function getFilteredCount(filters: ExportFilters): Promise<number> {
  const sql = getSQL()
  const genres         = toArrayOrNull(filters.genres)
  const timeCategories = toArrayOrNull(filters.timeCategories)
  const bikou          = toArrayOrNull(filters.bikou)
  const seatMin = (filters.seatMin !== undefined && !isNaN(filters.seatMin)) ? filters.seatMin : null
  const seatMax = (filters.seatMax !== undefined && !isNaN(filters.seatMax)) ? filters.seatMax : null

  const rows = await sql`
    SELECT COUNT(*)::integer as count FROM csv_data
    WHERE
      (${genres}::text[]         IS NULL OR "ジャンル"  = ANY(${genres}::text[]))
      AND (${timeCategories}::text[] IS NULL OR "時間振り" = ANY(${timeCategories}::text[]))
      AND (${bikou}::text[]          IS NULL OR "備考"     = ANY(${bikou}::text[]))
      AND (${seatMin}::integer IS NULL OR ("席数" ~ '^[0-9]+$' AND "席数"::integer >= ${seatMin}::integer))
      AND (${seatMax}::integer IS NULL OR ("席数" ~ '^[0-9]+$' AND "席数"::integer <= ${seatMax}::integer))
  `
  return Number(rows[0]?.count ?? 0)
}

export async function getFilteredCountByTimeCategory(
  filters: ExportFilters
): Promise<Record<string, number>> {
  const sql = getSQL()
  const genres         = toArrayOrNull(filters.genres)
  const timeCategories = toArrayOrNull(filters.timeCategories)
  const bikou          = toArrayOrNull(filters.bikou)
  const seatMin = (filters.seatMin !== undefined && !isNaN(filters.seatMin)) ? filters.seatMin : null
  const seatMax = (filters.seatMax !== undefined && !isNaN(filters.seatMax)) ? filters.seatMax : null

  const rows = await sql`
    SELECT "時間振り" as time_val, COUNT(*)::integer as count
    FROM csv_data
    WHERE
      (${genres}::text[]         IS NULL OR "ジャンル"  = ANY(${genres}::text[]))
      AND (${timeCategories}::text[] IS NULL OR "時間振り" = ANY(${timeCategories}::text[]))
      AND (${bikou}::text[]          IS NULL OR "備考"     = ANY(${bikou}::text[]))
      AND (${seatMin}::integer IS NULL OR ("席数" ~ '^[0-9]+$' AND "席数"::integer >= ${seatMin}::integer))
      AND (${seatMax}::integer IS NULL OR ("席数" ~ '^[0-9]+$' AND "席数"::integer <= ${seatMax}::integer))
    GROUP BY "時間振り"
  `
  const result: Record<string, number> = {}
  for (const row of rows) {
    if (row.time_val) result[String(row.time_val)] = Number(row.count)
  }
  return result
}

export async function getFilteredRows(filters: ExportFilters): Promise<Record<string, string>[]> {
  const sql = getSQL()
  const genres         = toArrayOrNull(filters.genres)
  const timeCategories = toArrayOrNull(filters.timeCategories)
  const bikou          = toArrayOrNull(filters.bikou)
  const seatMin = (filters.seatMin !== undefined && !isNaN(filters.seatMin)) ? filters.seatMin : null
  const seatMax = (filters.seatMax !== undefined && !isNaN(filters.seatMax)) ? filters.seatMax : null

  const rows = await sql`
    SELECT
      "ID", "名前", "電話番号", "予約電話番号", "住所1", "住所2",
      "Uber等エリア内外", "データ取得元", "業種大分類", "電話番号確認",
      "営業時間", "時間振り", "定休日", "席数", "ジャンル", "外人店舗",
      "単価", "HP有無", "オープン日", "備考",
      "架電対象フラグ", "NG", "EC", "EC投入済",
      "対象外理由①", "対象外理由②", "担当者", "店舗精査", "本社精査",
      "精査担当者", "店舗数", "現アナ",
      "クレーム履歴", "最終更新日", "最終架電日", "通電有無", "架電対応",
      "決裁者対応", "有効会話", "AP履歴", "対応者属性", "オーナー名",
      "携帯番号", "リストランク", "デリバリー最大進捗", "飲食SH最大進捗",
      "ペイメント_コール履歴", "サイネ", "最大進捗"
    FROM csv_data
    WHERE
      (${genres}::text[]         IS NULL OR "ジャンル"  = ANY(${genres}::text[]))
      AND (${timeCategories}::text[] IS NULL OR "時間振り" = ANY(${timeCategories}::text[]))
      AND (${bikou}::text[]          IS NULL OR "備考"     = ANY(${bikou}::text[]))
      AND (${seatMin}::integer IS NULL OR ("席数" ~ '^[0-9]+$' AND "席数"::integer >= ${seatMin}::integer))
      AND (${seatMax}::integer IS NULL OR ("席数" ~ '^[0-9]+$' AND "席数"::integer <= ${seatMax}::integer))
    ORDER BY created_at
  `
  return rows.map((r) => {
    const out: Record<string, string> = {}
    for (const col of LIST_COLUMNS) {
      out[col] = r[col] != null ? String(r[col]) : ''
    }
    return out
  })
}

export async function getUniqueGenres(): Promise<string[]> {
  const sql = getSQL()
  const rows = await sql`
    SELECT DISTINCT "ジャンル" as genre
    FROM csv_data
    WHERE "ジャンル" IS NOT NULL AND "ジャンル" != ''
    ORDER BY genre
  `
  return rows.map((r) => String(r.genre))
}

// ── エクスポートテンプレート・履歴テーブル ────────────────

export async function ensureExportTables(): Promise<void> {
  const sql = getSQL()
  await sql`
    CREATE TABLE IF NOT EXISTS export_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      filters TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS export_history (
      id TEXT PRIMARY KEY,
      list_number INTEGER NOT NULL,
      list_group TEXT NOT NULL,
      time_category TEXT NOT NULL,
      seat_condition TEXT,
      export_date TEXT NOT NULL,
      file_name TEXT NOT NULL,
      row_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `
}

export async function getExportTemplates() {
  await ensureExportTables()
  const sql = getSQL()
  return sql`SELECT * FROM export_templates ORDER BY created_at DESC`
}

export async function saveExportTemplate(id: string, name: string, filtersJson: string) {
  await ensureExportTables()
  const sql = getSQL()
  const now = new Date().toISOString()
  await sql`
    INSERT INTO export_templates (id, name, filters, created_at)
    VALUES (${id}, ${name}, ${filtersJson}, ${now})
  `
}

export async function deleteExportTemplate(id: string) {
  const sql = getSQL()
  await sql`DELETE FROM export_templates WHERE id = ${id}`
}

export async function getNextListNumber(): Promise<number> {
  await ensureExportTables()
  const sql = getSQL()
  const result = await sql`SELECT MAX(list_number) as max_num FROM export_history`
  return (Number(result[0]?.max_num ?? 0)) + 1
}

export async function saveExportHistory(
  id: string, listNumber: number, listGroup: string,
  timeCategory: string, seatCondition: string, exportDate: string,
  fileName: string, rowCount: number
) {
  await ensureExportTables()
  const sql = getSQL()
  const now = new Date().toISOString()
  await sql`
    INSERT INTO export_history
      (id, list_number, list_group, time_category, seat_condition, export_date, file_name, row_count, created_at)
    VALUES
      (${id}, ${listNumber}, ${listGroup}, ${timeCategory}, ${seatCondition}, ${exportDate}, ${fileName}, ${rowCount}, ${now})
  `
}

export async function getExportHistory() {
  await ensureExportTables()
  const sql = getSQL()
  return sql`SELECT * FROM export_history ORDER BY created_at DESC LIMIT 100`
}

// ── アップロード別充填数 ──────────────────────────────────

export async function getFillCountPerUpload(
  uploadIds: string[]
): Promise<Record<string, number>> {
  if (uploadIds.length === 0) return {}
  const sql = getSQL()
  try {
    const results = await sql`
      SELECT upload_id, SUM(filled)::integer AS fill_count
      FROM (
        SELECT cd.upload_id,
          (CASE WHEN "名前"     IS NOT NULL AND "名前"     != '' THEN 1 ELSE 0 END +
           CASE WHEN "電話番号" IS NOT NULL AND "電話番号" != '' THEN 1 ELSE 0 END +
           CASE WHEN "住所1"    IS NOT NULL AND "住所1"    != '' THEN 1 ELSE 0 END +
           CASE WHEN "ジャンル" IS NOT NULL AND "ジャンル" != '' THEN 1 ELSE 0 END +
           CASE WHEN "時間振り" IS NOT NULL AND "時間振り" != '' THEN 1 ELSE 0 END +
           CASE WHEN "席数"     IS NOT NULL AND "席数"     != '' THEN 1 ELSE 0 END +
           CASE WHEN "備考"     IS NOT NULL AND "備考"     != '' THEN 1 ELSE 0 END) AS filled
        FROM csv_data cd
        WHERE cd.upload_id = ANY(${uploadIds})
      ) t
      GROUP BY upload_id
    `
    const counts: Record<string, number> = {}
    for (const row of results) {
      counts[String(row.upload_id)] = Number(row.fill_count)
    }
    return counts
  } catch (e) {
    console.error('getFillCountPerUpload error:', e)
    return {}
  }
}
