import { Pool } from 'pg'

// ── 接続プール（シングルトン） ─────────────────────────────

let _pool: Pool | null = null

function getPool(): Pool {
  if (!_pool) {
    const url = (process.env.DATABASE_URL ?? '').replace(/^﻿/, '').trim()
    if (!url) throw new Error('DATABASE_URL が設定されていません')
    _pool = new Pool({ connectionString: url, max: 5, idleTimeoutMillis: 30000 })
  }
  return _pool
}

type Row = Record<string, unknown>

interface DbSql {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<Row[]>
  query: (q: string, params?: unknown[]) => Promise<Row[]>
}

// タグ付きテンプレートリテラルと .query() の両方をサポートするラッパー
export function getDb(): DbSql {
  const pool = getPool()

  async function sql(strings: TemplateStringsArray, ...values: unknown[]): Promise<Row[]> {
    let text = ''
    strings.forEach((str, i) => {
      text += str
      if (i < values.length) text += `$${i + 1}`
    })
    const res = await pool.query(text, values)
    return res.rows
  }

  sql.query = async (q: string, params?: unknown[]): Promise<Row[]> => {
    const res = await pool.query(q, params)
    return res.rows
  }

  return sql as DbSql
}

function dyn(sql: DbSql, query: string, params?: unknown[]): Promise<Row[]> {
  return sql.query(query, params)
}

// ── トランザクションヘルパー ──────────────────────────────────
// fn 内で使う query は同一コネクション上で実行される。
// BEGIN/COMMIT/ROLLBACK は自動管理。
export type TxQuery = (q: string, params?: unknown[]) => Promise<Row[]>

export async function withTransaction<T>(fn: (query: TxQuery) => Promise<T>): Promise<T> {
  const pool   = getPool()
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const queryFn: TxQuery = async (q, params) => {
      const res = await client.query(q, params as unknown[])
      return res.rows as Row[]
    }
    const result = await fn(queryFn)
    await client.query("COMMIT")
    return result
  } catch (e) {
    await client.query("ROLLBACK")
    throw e
  } finally {
    client.release()
  }
}

// ── リストDBカラム定義 ──────────────────────────────────────

export const LIST_COLUMNS = [
  "ID", "名前", "電話番号", "住所1", "住所2",
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

export const SEISA_UPDATE_COLUMNS = [
  "時間振り", "定休日", "席数", "ジャンル", "備考",
  "架電対象フラグ", "NG", "EC", "EC投入済",
  "対象外理由①", "対象外理由②", "担当者", "店舗精査", "本社精査",
] as const

export type ListColumn = (typeof LIST_COLUMNS)[number]

// ── INSERT ヘルパー ───────────────────────────────────────

const COL_COUNT = 54

const INSERT_COLS = `id, upload_id, row_number, is_duplicate, created_at, updated_at,
  "ID", "名前",
  "電話番号", "住所1", "住所2",
  "Uber等エリア内外", "データ取得元", "業種大分類", "電話番号確認",
  "営業時間", "時間振り", "定休日", "席数", "ジャンル", "外人店舗",
  "単価", "HP有無", "オープン日", "備考",
  "架電対象フラグ", "NG", "EC", "EC投入済",
  "対象外理由①", "対象外理由②", "担当者", "店舗精査", "本社精査",
  "精査担当者", "店舗数", "現アナ",
  "クレーム履歴", "最終更新日", "最終架電日", "通電有無", "架電対応",
  "決裁者対応", "有効会話", "AP履歴", "対応者属性", "オーナー名",
  "携帯番号", "リストランク", "デリバリー最大進捗", "飲食SH最大進捗",
  "ペイメント_コール履歴", "サイネ", "最大進捗"`

function makeRowPlaceholders(count: number): string {
  return Array.from({ length: count }, (_, ri) =>
    `(${Array.from({ length: COL_COUNT }, (_, ci) => `$${ri * COL_COUNT + ci + 1}`).join(',')})`
  ).join(',')
}

function rowToArgs(
  internalId: string, uploadId: string, rowNumber: number,
  row: Record<string, string>, now: string
): unknown[] {
  return [
    internalId, uploadId, rowNumber, 0, now, now,
    null, row["名前"] ?? null,
    row["電話番号"] ?? null, row["住所1"] ?? null, row["住所2"] ?? null,
    row["Uber等エリア内外"] ?? null, row["データ取得元"] ?? null, row["業種大分類"] ?? null, row["電話番号確認"] ?? null,
    row["営業時間"] ?? null, row["時間振り"] ?? null, row["定休日"] ?? null, row["席数"] ?? null, row["ジャンル"] ?? null, row["外人店舗"] ?? null,
    row["単価"] ?? null, row["HP有無"] ?? null, row["オープン日"] ?? null, row["備考"] ?? null,
    row["架電対象フラグ"] ?? null, row["NG"] ?? null, row["EC"] ?? null, row["EC投入済"] ?? null,
    row["対象外理由①"] ?? null, row["対象外理由②"] ?? null, row["担当者"] ?? null, row["店舗精査"] ?? null, row["本社精査"] ?? null,
    row["精査担当者"] ?? null, row["店舗数"] ?? null, row["現アナ"] ?? null,
    row["クレーム履歴"] ?? null, row["最終更新日"] ?? null, row["最終架電日"] ?? null, row["通電有無"] ?? null, row["架電対応"] ?? null,
    row["決裁者対応"] ?? null, row["有効会話"] ?? null, row["AP履歴"] ?? null, row["対応者属性"] ?? null, row["オーナー名"] ?? null,
    row["携帯番号"] ?? null, row["リストランク"] ?? null, row["デリバリー最大進捗"] ?? null, row["飲食SH最大進捗"] ?? null,
    row["ペイメント_コール履歴"] ?? null, row["サイネ"] ?? null, row["最大進捗"] ?? null,
  ]
}

// ── DB初期化 ──────────────────────────────────────────────

export async function initializeDatabase() {
  const sql = getDb()

  await dyn(sql, 'DROP TABLE IF EXISTS evercall_invested')
  await dyn(sql, 'DROP TABLE IF EXISTS csv_data')
  await dyn(sql, 'DROP TABLE IF EXISTS csv_uploads')
  await dyn(sql, 'DROP TABLE IF EXISTS export_history')
  await dyn(sql, 'DROP TABLE IF EXISTS export_templates')
  await dyn(sql, 'DROP TABLE IF EXISTS users')

  await dyn(sql, `
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  await dyn(sql, `
    CREATE TABLE csv_uploads (
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
  `)

  await dyn(sql, `
    CREATE TABLE csv_data (
      id              TEXT PRIMARY KEY,
      upload_id       TEXT NOT NULL REFERENCES csv_uploads(id),
      row_number      INTEGER NOT NULL,
      is_duplicate    INTEGER NOT NULL DEFAULT 0,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL,
      "ID"                    TEXT,
      "名前"                  TEXT,
      "電話番号"              TEXT,
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
  `)

  await dyn(sql, `CREATE INDEX idx_csv_data_upload_id ON csv_data(upload_id)`)
  await dyn(sql, `CREATE INDEX idx_csv_data_tel ON csv_data("電話番号") WHERE "電話番号" IS NOT NULL`)
  await dyn(sql, `CREATE INDEX idx_csv_uploads_user_id ON csv_uploads(user_id)`)

  await dyn(sql, `
    CREATE TABLE evercall_invested (
      id           BIGSERIAL PRIMARY KEY,
      phone_number TEXT NOT NULL,
      list_group   TEXT NOT NULL,
      invested_at  TEXT NOT NULL,
      created_at   TEXT NOT NULL,
      CONSTRAINT evercall_invested_uniq UNIQUE (phone_number, list_group)
    )
  `)
  await dyn(sql, `CREATE INDEX idx_evercall_phone       ON evercall_invested(phone_number)`)
  await dyn(sql, `CREATE INDEX idx_evercall_group_phone ON evercall_invested(list_group, phone_number)`)

  await dyn(sql, `
    CREATE TABLE export_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      filters TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `)

  await dyn(sql, `
    CREATE TABLE export_history (
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
  `)
}

// ── スキーマ移行（Neon管理のためスキップ） ────────────────

export async function migrateSchema(): Promise<{ status: string; message: string }> {
  const sql = getDb()
  const newCols = ['"名前" TEXT', '"住所1" TEXT', '"住所2" TEXT']
  const added: string[] = []
  for (const colDef of newCols) {
    try {
      await dyn(sql, `ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS ${colDef}`)
      added.push(colDef.split(' ')[0])
    } catch (e) {
      // already exists or unsupported — skip
    }
  }
  return {
    status: 'done',
    message: added.length > 0 ? `追加カラム: ${added.join(', ')}` : '全カラム追加済み',
  }
}

// ── ユーザー操作 ─────────────────────────────────────────

export async function createUser(id: string, username: string, password_hash: string) {
  const sql = getDb()
  const now = new Date().toISOString()
  await sql`INSERT INTO users (id, username, password_hash, created_at, updated_at) VALUES (${id}, ${username}, ${password_hash}, ${now}, ${now})`
}

export async function getUserByUsername(username: string) {
  const sql = getDb()
  const r = await sql`SELECT * FROM users WHERE username = ${username} LIMIT 1`
  return r[0] ?? null
}

export async function getUserById(id: string) {
  const sql = getDb()
  const r = await sql`SELECT * FROM users WHERE id = ${id} LIMIT 1`
  return r[0] ?? null
}

// ── CSVアップロード操作 ──────────────────────────────────

export async function createCSVUpload(
  id: string, userId: string, filename: string,
  originalFilename: string, fileSize: number, rowCount: number,
  insertedCount = 0, updatedCount = 0, workHours: number | null = null,
  workerName: string | null = null, reportDate: string | null = null, teamName: string | null = null
) {
  const sql = getDb()
  const now = new Date().toISOString()
  await dyn(sql, `
    INSERT INTO csv_uploads
      (id, user_id, filename, original_filename, file_size, row_count, uploaded_at, status, inserted_count, updated_count, work_hours, worker_name, report_date, team_name)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7, 'processed', $8, $9, $10, $11, $12, $13)
  `, [id, userId, filename, originalFilename, fileSize, rowCount, now, insertedCount, updatedCount, workHours, workerName, reportDate, teamName])
}

export async function updateCSVUploadCounts(id: string, insertedCount: number, updatedCount: number) {
  const sql = getDb()
  await sql`UPDATE csv_uploads SET inserted_count = ${insertedCount}, updated_count = ${updatedCount} WHERE id = ${id}`
}

export async function getCSVUploadsByUserId(userId: string) {
  const sql = getDb()
  return sql`SELECT * FROM csv_uploads WHERE user_id = ${userId} ORDER BY uploaded_at DESC`
}

export async function getCSVUploadById(uploadId: string) {
  const sql = getDb()
  const r = await sql`SELECT * FROM csv_uploads WHERE id = ${uploadId} LIMIT 1`
  return r[0] ?? null
}

// ── CSVデータ バッチアップサート ──────────────────────────

export async function batchUpsertCSVRows(
  uploadId: string,
  rows: Array<{ internalId: string; rowNumber: number; row: Record<string, string> }>,
): Promise<{ insertedCount: number; updatedCount: number }> {
  if (rows.length === 0) return { insertedCount: 0, updatedCount: 0 }
  const sql = getDb()
  const now = new Date().toISOString()

  // ① 全電話番号を一括検索
  const tels = rows.map(r => r.row["電話番号"]?.trim() || null).filter((t): t is string => !!t)
  const existingSet = new Set<string>()
  if (tels.length > 0) {
    const existing = await dyn(sql, 
      `SELECT "電話番号" FROM csv_data WHERE "電話番号" = ANY($1::text[])`,
      [tels]
    )
    for (const e of existing) existingSet.add(String(e["電話番号"]))
  }

  const toUpdate: typeof rows = []
  const toInsert: typeof rows = []
  for (const r of rows) {
    const tel = r.row["電話番号"]?.trim() || null
    // 電話番号も名前も空の行はスキップ（空行・合計行・ヘッダー行対策）
    if (!tel && !r.row["名前"]?.trim()) continue
    if (tel && existingSet.has(tel)) toUpdate.push(r)
    else if (tel) toInsert.push(r)  // 電話番号がない行は挿入しない
  }

  // ② 更新（50件ずつ並列）
  const UPDATE_CHUNK = 50
  for (let i = 0; i < toUpdate.length; i += UPDATE_CHUNK) {
    const chunk = toUpdate.slice(i, i + UPDATE_CHUNK)
    await Promise.all(chunk.map(({ row }) =>
      dyn(sql, 
        `UPDATE csv_data SET
          "時間振り"       = COALESCE(NULLIF($1,  ''), "時間振り"),
          "定休日"         = COALESCE(NULLIF($2,  ''), "定休日"),
          "席数"           = COALESCE(NULLIF($3,  ''), "席数"),
          "ジャンル"       = COALESCE(NULLIF($4,  ''), "ジャンル"),
          "備考"           = COALESCE(NULLIF($5,  ''), "備考"),
          "架電対象フラグ" = COALESCE(NULLIF($6,  ''), "架電対象フラグ"),
          "NG"             = COALESCE(NULLIF($7,  ''), "NG"),
          "EC"             = COALESCE(NULLIF($8,  ''), "EC"),
          "EC投入済"       = COALESCE(NULLIF($9,  ''), "EC投入済"),
          "対象外理由①"   = COALESCE(NULLIF($10, ''), "対象外理由①"),
          "対象外理由②"   = COALESCE(NULLIF($11, ''), "対象外理由②"),
          "担当者"         = COALESCE(NULLIF($12, ''), "担当者"),
          "店舗精査"       = COALESCE(NULLIF($13, ''), "店舗精査"),
          "本社精査"       = COALESCE(NULLIF($14, ''), "本社精査"),
          is_duplicate = 1, updated_at = $15, upload_id = $16,
          is_data_changed = CASE WHEN
            "時間振り" IS DISTINCT FROM COALESCE(NULLIF($1, ''), "時間振り") OR
            "定休日"   IS DISTINCT FROM COALESCE(NULLIF($2, ''), "定休日")   OR
            "席数"     IS DISTINCT FROM COALESCE(NULLIF($3, ''), "席数")     OR
            "ジャンル" IS DISTINCT FROM COALESCE(NULLIF($4, ''), "ジャンル") OR
            "備考"     IS DISTINCT FROM COALESCE(NULLIF($5, ''), "備考")
          THEN 1 ELSE 0 END
        WHERE "電話番号" = $17`,
        [
          row["時間振り"]       ?? null,
          row["定休日"]         ?? null,
          row["席数"]           ?? null,
          row["ジャンル"]       ?? null,
          row["備考"]           ?? null,
          row["架電対象フラグ"] ?? null,
          row["NG"]             ?? null,
          row["EC"]             ?? null,
          row["EC投入済"]       ?? null,
          row["対象外理由①"]   ?? null,
          row["対象外理由②"]   ?? null,
          row["担当者"]         ?? null,
          row["店舗精査"]       ?? null,
          row["本社精査"]       ?? null,
          now, uploadId,
          row["電話番号"]!.trim(),
        ]
      )
    ))
  }

  // ③ 挿入（50件ずつ multi-row INSERT）
  const INSERT_CHUNK = 50
  for (let i = 0; i < toInsert.length; i += INSERT_CHUNK) {
    const chunk = toInsert.slice(i, i + INSERT_CHUNK)
    const placeholders = makeRowPlaceholders(chunk.length)
    const args = chunk.flatMap(({ internalId, rowNumber, row }) => rowToArgs(internalId, uploadId, rowNumber, row, now))
    await dyn(sql, `INSERT INTO csv_data (${INSERT_COLS}) VALUES ${placeholders}`, args)
  }

  return { insertedCount: toInsert.length, updatedCount: toUpdate.length }
}

export async function upsertCSVRow(
  internalId: string, uploadId: string, rowNumber: number, row: Record<string, string>,
): Promise<{ action: 'inserted' | 'updated' }> {
  const result = await batchUpsertCSVRows(uploadId, [{ internalId, rowNumber, row }])
  return { action: result.insertedCount > 0 ? 'inserted' : 'updated' }
}

export async function checkDuplicate(phoneNumber: string): Promise<boolean> {
  const sql = getDb()
  const r = await sql`SELECT 1 FROM csv_data WHERE "電話番号" = ${phoneNumber} LIMIT 1`
  return r.length > 0
}

export async function getCSVDataByUploadId(uploadId: string) {
  const sql = getDb()
  return sql`SELECT * FROM csv_data WHERE upload_id = ${uploadId} ORDER BY row_number`
}

// ── 結果ランク・リストランク定義 ────────────────────────────

export const RESULT_RANK_LABELS: Record<string, string> = {
  '0':  '未架電',
  '1':  '留守・不在',
  '2':  '見込み（再架電予定）',
  '3':  '非決裁者',
  '4':  '入口で断られた（決裁確認・用件伝える前に切られた）',
  '5':  '決裁者',
  '6':  '用件伝えた',
  '7':  '日程提案',
  '8':  '日程切れ・情報確認や売上意思確認中に切られた',
  '9':  'アポ受注',
  '10': '対象外（閉店・個人規模でない本社管理など）',
}

export const LIST_RANK_LABELS: Record<string, string> = {
  '1': '店名+電話番号+住所あり',
  '2': '1+席数+時間振りあり',
  '3': '2+現アナ以外（架電可能）',
  '4': '3+対応履歴あり',
  '5': '4+決裁履歴あり',
  '6': '5+有効履歴あり',
  '7': '6+アポ受注済',
}

// ── ダッシュボード v2 統計 ─────────────────────────────────

export interface GroupStat {
  tokunyu:  number
  mitorunyu: number
  rank_distribution: { rank: string; count: number }[]
}

export interface DashboardStatsV2 {
  total:               number
  seisa_count:         number
  unseisa_count:       number
  tokunyu_count:       number
  honsha_seisa_count:  number
  missing: { name: number; address: number; jikanfuri: number; teikyu: number; sekisuu: number; genre: number; bikou: number }
  groups: Record<string, GroupStat>
  list_rank_distribution: { rank: string; count: number }[]
}

function processRankRows(rows: Record<string, unknown>[]): { rank: string; count: number }[] {
  const counts: Record<string, number> = {}
  for (const row of rows) {
    const val = row.rank_val
    const cnt = Number(row.cnt)
    const key = (val === null || val === undefined || String(val).trim() === '') ? '0' : String(val).trim()
    counts[key] = (counts[key] ?? 0) + cnt
  }
  return Object.entries(counts)
    .map(([rank, count]) => ({ rank, count }))
    .sort((a, b) => {
      const na = parseInt(a.rank, 10), nb = parseInt(b.rank, 10)
      return (isNaN(na) ? 0 : na) - (isNaN(nb) ? 0 : nb)
    })
}

export async function getDashboardStatsV2(): Promise<DashboardStatsV2> {
  const sql = getDb()
  try { await ensureEvercallInvestedTable() } catch { /* ignore */ }

  const [
    summaryRes,
    g0Rank, g1Rank, g2Rank, g3Rank, g4Rank,
    listRankRes,
    g0Inv, g1Inv, g2Inv, g3Inv, g4Inv,
  ] = await Promise.all([
    sql`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN "時間振り" IS NOT NULL AND "時間振り" != ''
                      AND "定休日" IS NOT NULL AND "定休日" != ''
                      AND "席数"   IS NOT NULL AND "席数"   != ''
                      AND "ジャンル" IS NOT NULL AND "ジャンル" != ''
                      AND "備考"   IS NOT NULL AND "備考"   != ''
                 THEN 1 ELSE 0 END) AS seisa_count,
        SUM(CASE WHEN ("時間振り" IS NULL OR "時間振り" = '')
                   OR ("定休日"  IS NULL OR "定休日"  = '')
                   OR ("席数"    IS NULL OR "席数"    = '')
                   OR ("ジャンル" IS NULL OR "ジャンル" = '')
                   OR ("備考"    IS NULL OR "備考"    = '')
                 THEN 1 ELSE 0 END) AS unseisa_count,
        SUM(CASE WHEN ("最大進捗" IS NULL OR "最大進捗" = '' OR "最大進捗" = '0')
                      AND "時間振り" IS NOT NULL AND "時間振り" != ''
                      AND "定休日"  IS NOT NULL AND "定休日"  != ''
                      AND "席数"    IS NOT NULL AND "席数"    != ''
                      AND "ジャンル" IS NOT NULL AND "ジャンル" != ''
                      AND "備考"    IS NOT NULL AND "備考"    != ''
                 THEN 1 ELSE 0 END) AS tokunyu_count,
        SUM(CASE WHEN "本社精査" = '1' THEN 1 ELSE 0 END) AS honsha_seisa_count,
        SUM(CASE WHEN "名前"    IS NULL OR "名前"    = '' THEN 1 ELSE 0 END) AS missing_name,
        SUM(CASE WHEN "住所2"   IS NULL OR "住所2"   = '' THEN 1 ELSE 0 END) AS missing_address,
        SUM(CASE WHEN "時間振り" IS NULL OR "時間振り" = '' THEN 1 ELSE 0 END) AS missing_jikanfuri,
        SUM(CASE WHEN "定休日"  IS NULL OR "定休日"  = '' THEN 1 ELSE 0 END) AS missing_teikyu,
        SUM(CASE WHEN "席数"    IS NULL OR "席数"    = '' THEN 1 ELSE 0 END) AS missing_sekisuu,
        SUM(CASE WHEN "ジャンル" IS NULL OR "ジャンル" = '' THEN 1 ELSE 0 END) AS missing_genre,
        SUM(CASE WHEN "備考"    IS NULL OR "備考"    = '' THEN 1 ELSE 0 END) AS missing_bikou
      FROM csv_data
    `,
    sql`SELECT "最大進捗" AS rank_val, COUNT(*) AS cnt FROM csv_data GROUP BY "最大進捗"`,
    sql`SELECT "飲食SH最大進捗"      AS rank_val, COUNT(*) AS cnt FROM csv_data GROUP BY "飲食SH最大進捗"`,
    sql`SELECT "サイネ"               AS rank_val, COUNT(*) AS cnt FROM csv_data GROUP BY "サイネ"`,
    sql`SELECT "デリバリー最大進捗"   AS rank_val, COUNT(*) AS cnt FROM csv_data GROUP BY "デリバリー最大進捗"`,
    sql`SELECT "ペイメント_コール履歴" AS rank_val, COUNT(*) AS cnt FROM csv_data GROUP BY "ペイメント_コール履歴"`,
    sql`
      SELECT "リストランク" AS rank_val, COUNT(*) AS cnt
      FROM csv_data
      WHERE "リストランク" IS NOT NULL AND "リストランク" != ''
      GROUP BY "リストランク"
    `,
    sql`
      SELECT
        COUNT(CASE WHEN "最大進捗" IS NOT NULL AND "最大進捗" != '' AND "最大進捗" != '0' THEN 1 END) AS tokunyu,
        COUNT(CASE WHEN "最大進捗" IS NULL     OR  "最大進捗" = ''  OR  "最大進捗" = '0' THEN 1 END) AS mitorunyu
      FROM csv_data
    `,
    sql`
      SELECT
        COUNT(CASE WHEN ei.phone_number IS NOT NULL THEN 1 END) AS tokunyu,
        COUNT(CASE WHEN ei.phone_number IS NULL     THEN 1 END) AS mitorunyu
      FROM csv_data cd
      LEFT JOIN evercall_invested ei ON ei.phone_number = cd."電話番号" AND ei.list_group = '飲食SH'
    `,
    sql`
      SELECT
        COUNT(CASE WHEN ei.phone_number IS NOT NULL THEN 1 END) AS tokunyu,
        COUNT(CASE WHEN ei.phone_number IS NULL     THEN 1 END) AS mitorunyu
      FROM csv_data cd
      LEFT JOIN evercall_invested ei ON ei.phone_number = cd."電話番号" AND ei.list_group = 'サイネージ'
    `,
    sql`
      SELECT
        COUNT(CASE WHEN ei.phone_number IS NOT NULL THEN 1 END) AS tokunyu,
        COUNT(CASE WHEN ei.phone_number IS NULL     THEN 1 END) AS mitorunyu
      FROM csv_data cd
      LEFT JOIN evercall_invested ei ON ei.phone_number = cd."電話番号" AND ei.list_group = 'デリバリー'
    `,
    sql`
      SELECT
        COUNT(CASE WHEN ei.phone_number IS NOT NULL THEN 1 END) AS tokunyu,
        COUNT(CASE WHEN ei.phone_number IS NULL     THEN 1 END) AS mitorunyu
      FROM csv_data cd
      LEFT JOIN evercall_invested ei ON ei.phone_number = cd."電話番号" AND ei.list_group = 'ペイメント'
    `,
  ])

  const s  = summaryRes[0]  ?? {}
  const i0 = g0Inv[0]       ?? {}
  const i1 = g1Inv[0]       ?? {}
  const i2 = g2Inv[0]       ?? {}
  const i3 = g3Inv[0]       ?? {}
  const i4 = g4Inv[0]       ?? {}

  return {
    total:         Number(s.total         ?? 0),
    seisa_count:   Number(s.seisa_count   ?? 0),
    unseisa_count: Number(s.unseisa_count ?? 0),
    tokunyu_count:       Number(s.tokunyu_count       ?? 0),
    honsha_seisa_count:  Number(s.honsha_seisa_count  ?? 0),
    missing: {
      name:      Number(s.missing_name      ?? 0),
      address:   Number(s.missing_address   ?? 0),
      jikanfuri: Number(s.missing_jikanfuri ?? 0),
      teikyu:    Number(s.missing_teikyu    ?? 0),
      sekisuu:   Number(s.missing_sekisuu   ?? 0),
      genre:     Number(s.missing_genre     ?? 0),
      bikou:     Number(s.missing_bikou     ?? 0),
    },
    groups: {
      '全体':      { tokunyu: Number(i0.tokunyu ?? 0), mitorunyu: Number(i0.mitorunyu ?? 0), rank_distribution: processRankRows(g0Rank as Record<string, unknown>[]) },
      '飲食SH':    { tokunyu: Number(i1.tokunyu ?? 0), mitorunyu: Number(i1.mitorunyu ?? 0), rank_distribution: processRankRows(g1Rank as Record<string, unknown>[]) },
      'サイネージ': { tokunyu: Number(i2.tokunyu ?? 0), mitorunyu: Number(i2.mitorunyu ?? 0), rank_distribution: processRankRows(g2Rank as Record<string, unknown>[]) },
      'デリバリー': { tokunyu: Number(i3.tokunyu ?? 0), mitorunyu: Number(i3.mitorunyu ?? 0), rank_distribution: processRankRows(g3Rank as Record<string, unknown>[]) },
      'ペイメント': { tokunyu: Number(i4.tokunyu ?? 0), mitorunyu: Number(i4.mitorunyu ?? 0), rank_distribution: processRankRows(g4Rank as Record<string, unknown>[]) },
    },
    list_rank_distribution: (listRankRes as Record<string, unknown>[])
      .map(r => ({ rank: String(r.rank_val), count: Number(r.cnt) }))
      .sort((a, b) => parseInt(a.rank, 10) - parseInt(b.rank, 10)),
  }
}

// ── リストランク スナップショット ─────────────────────────────

export async function ensureRankSnapshotTable() {
  const sql = getDb()
  await dyn(sql, `
    CREATE TABLE IF NOT EXISTS rank_snapshots (
      id TEXT PRIMARY KEY,
      snapshot_date TEXT NOT NULL,
      rank TEXT NOT NULL,
      count INTEGER NOT NULL,
      created_at TEXT NOT NULL
    )
  `)
  await dyn(sql, `CREATE INDEX IF NOT EXISTS idx_rank_snapshots_date ON rank_snapshots(snapshot_date)`)
}

export async function takeRankSnapshot(): Promise<{ date: string; ranks: number }> {
  await ensureRankSnapshotTable()
  const sql = getDb()
  const today = new Date().toISOString().slice(0, 10)

  // 当日分を上書き（再実行可能）
  await dyn(sql, `DELETE FROM rank_snapshots WHERE snapshot_date = $1`, [today])

  const rows = await sql`
    SELECT "リストランク" AS rank, COUNT(*) AS cnt
    FROM csv_data
    WHERE "リストランク" IS NOT NULL AND "リストランク" != ''
    GROUP BY "リストランク"
  `
  const now = new Date().toISOString()
  for (const row of rows) {
    await dyn(sql, `
      INSERT INTO rank_snapshots (id, snapshot_date, rank, count, created_at)
      VALUES ($1, $2, $3, $4, $5)
    `, [crypto.randomUUID(), today, String(row.rank), Number(row.cnt), now])
  }
  return { date: today, ranks: rows.length }
}

export async function getRankHistory(): Promise<{ date: string; [rank: string]: number | string }[]> {
  try {
    await ensureRankSnapshotTable()
    const sql = getDb()
    const rows = await sql`
      SELECT snapshot_date, rank, count
      FROM rank_snapshots
      ORDER BY snapshot_date ASC, rank ASC
    `
    const byDate: Record<string, Record<string, number>> = {}
    for (const row of rows) {
      const d = String(row.snapshot_date)
      const r = String(row.rank)
      if (!byDate[d]) byDate[d] = {}
      byDate[d][r] = Number(row.count)
    }
    return Object.entries(byDate)
      .map(([date, ranks]) => ({ date, ...ranks }))
      .sort((a, b) => a.date.localeCompare(b.date))
  } catch { return [] }
}

// ── ダッシュボード統計（旧版・後方互換） ─────────────────────

export async function getDashboardStatsAll() {
  const sql = getDb()
  const [totalRes, seisaRes, telRes] = await Promise.all([
    sql`SELECT COUNT(*) AS count FROM csv_data`,
    sql`SELECT COUNT(*) AS count FROM csv_data WHERE "時間振り" IS NOT NULL AND "時間振り" != ''`,
    sql`SELECT COUNT(*) AS count FROM csv_data WHERE "電話番号" IS NOT NULL AND "電話番号" != ''`,
  ])
  const total         = Number(totalRes[0]?.count   ?? 0)
  const seisa_count   = Number(seisaRes[0]?.count   ?? 0)
  const tel_count     = Number(telRes[0]?.count     ?? 0)
  const unseisa_count = total - seisa_count
  return { total, seisa_count, unseisa_count, tel_count }
}

export async function getAllDataPreview(limit = 20) {
  const sql = getDb()
  const r = await dyn(sql, 
    `SELECT "ID", "電話番号", "ジャンル", "時間振り" FROM csv_data ORDER BY created_at LIMIT $1`,
    [limit]
  )
  return r.map(row => ({
    ID:       String(row["ID"]       ?? ''),
    電話番号: String(row["電話番号"] ?? ''),
    ジャンル: String(row["ジャンル"] ?? ''),
    時間振り: String(row["時間振り"] ?? ''),
  }))
}

// ── 全データ分析（分析ページ用）────────────────────────────

export async function getGlobalColumnStats() {
  const sql = getDb()

  const statsQuery = LIST_COLUMNS.map(col =>
    `SELECT '${col.replace(/'/g, "''")}' AS col_name, COUNT(*) AS fill_count, COUNT(DISTINCT "${col}") AS unique_count
     FROM csv_data WHERE "${col}" IS NOT NULL AND "${col}" != ''`
  ).join(' UNION ALL ')

  const [totalRes, statsRes] = await Promise.all([
    sql`SELECT COUNT(*) AS count FROM csv_data`,
    dyn(sql, statsQuery),
  ])

  const total = Number(totalRes[0]?.count ?? 0)
  const statsMap: Record<string, { fill: number; unique: number }> = {}
  for (const row of statsRes) {
    statsMap[String(row.col_name)] = { fill: Number(row.fill_count), unique: Number(row.unique_count) }
  }

  const columnStats: Record<string, {
    total: number; unique: number; null_count: number; null_percent: string;
    top_values: Array<{ value: string; count: number }>;
  }> = {}
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
  const sql = getDb()
  const TARGET_COLS = ['ジャンル', '時間振り', '業種大分類', '備考', 'Uber等エリア内外', 'リストランク', '通電有無', '架電対応']
  try {
    const topValues: Record<string, Array<{ value: string; count: number }>> = {}
    await Promise.all(TARGET_COLS.map(async col => {
      const r = await dyn(sql, 
        `SELECT "${col}" AS val, COUNT(*) AS cnt FROM csv_data WHERE "${col}" IS NOT NULL AND "${col}" != '' GROUP BY "${col}" ORDER BY cnt DESC LIMIT $1`,
        [topN]
      )
      topValues[col] = r.map(row => ({ value: String(row.val), count: Number(row.cnt) }))
    }))
    return topValues
  } catch (e) {
    console.error('getGlobalTopValues error:', e)
    return {}
  }
}

export async function getGenreDistribution() {
  const sql = getDb()
  const r = await sql`
    SELECT "ジャンル" AS genre, COUNT(*) AS count
    FROM csv_data
    WHERE "ジャンル" IS NOT NULL AND "ジャンル" != ''
    GROUP BY "ジャンル" ORDER BY count DESC LIMIT 20
  `
  return r.map(row => ({ name: String(row.genre), value: Number(row.count) }))
}

export async function getAddressesForRegion() {
  return [] as { address: string; count: number }[]
}

export async function getGlobalStatusDistribution() {
  const sql = getDb()
  const [seisaRes, telRes, dupRes, rankRes] = await Promise.all([
    sql`SELECT COUNT(*) AS count FROM csv_data WHERE "時間振り" IS NOT NULL AND "時間振り" != ''`,
    sql`SELECT COUNT(*) AS count FROM csv_data WHERE "電話番号" IS NOT NULL AND "電話番号" != ''`,
    sql`SELECT COUNT(*) AS count FROM csv_data WHERE is_duplicate = 1`,
    sql`SELECT COUNT(*) AS count FROM csv_data WHERE "リストランク" IS NOT NULL AND "リストランク" != ''`,
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
  const sql = getDb()
  return sql`
    SELECT
      cu.id, cu.original_filename, cu.row_count, cu.uploaded_at, cu.status,
      cu.inserted_count, cu.updated_count, cu.work_hours, cu.worker_name, cu.report_date, cu.team_name,
      u.username
    FROM csv_uploads cu
    JOIN users u ON cu.user_id = u.id
    ORDER BY cu.uploaded_at DESC
  `
}

// ── エバコール投入済テーブル ──────────────────────────────

async function ensureEvercallInvestedTable() {
  const sql = getDb()
  await dyn(sql, `
    CREATE TABLE IF NOT EXISTS evercall_invested (
      id           BIGSERIAL PRIMARY KEY,
      phone_number TEXT NOT NULL,
      list_group   TEXT NOT NULL,
      invested_at  TEXT NOT NULL,
      created_at   TEXT NOT NULL,
      CONSTRAINT evercall_invested_uniq UNIQUE (phone_number, list_group)
    )
  `)
  await dyn(sql, `CREATE INDEX IF NOT EXISTS idx_evercall_phone       ON evercall_invested(phone_number)`)
  await dyn(sql, `CREATE INDEX IF NOT EXISTS idx_evercall_group_phone ON evercall_invested(list_group, phone_number)`)
}

function normalizePhone(p: string): string {
  return p.trim()
}

export async function bulkInsertEvercallInvested(
  phoneNumbers: string[],
  listGroup: string,
  investedAt: string,
): Promise<{ inserted: number; skipped: number }> {
  const phones = phoneNumbers.map(normalizePhone).filter(Boolean)
  if (phones.length === 0) return { inserted: 0, skipped: 0 }
  await ensureEvercallInvestedTable()
  const sql = getDb()
  const now = new Date().toISOString()

  const result = await dyn(sql, 
    `INSERT INTO evercall_invested (phone_number, list_group, invested_at, created_at)
     SELECT phone, $1, $2, $3
     FROM UNNEST($4::text[]) AS t(phone)
     WHERE EXISTS (SELECT 1 FROM csv_data WHERE "電話番号" = phone)
     ON CONFLICT DO NOTHING`,
    [listGroup, investedAt, now, phones]
  )
  const inserted = result.length
  return { inserted, skipped: phones.length - inserted }
}

export async function purgeEvercallInvested(): Promise<{ deleted: number }> {
  await ensureEvercallInvestedTable()
  const sql = getDb()
  const r = await sql`DELETE FROM evercall_invested RETURNING id`
  return { deleted: r.length }
}

export async function cleanupEvercallInvested(): Promise<{ deleted: number }> {
  await ensureEvercallInvestedTable()
  const sql = getDb()
  const r = await sql`
    DELETE FROM evercall_invested
    WHERE NOT EXISTS (
      SELECT 1 FROM csv_data WHERE csv_data."電話番号" = evercall_invested.phone_number
    )
    RETURNING id
  `
  return { deleted: r.length }
}

export async function getEvercallInvestedStats(): Promise<
  { list_group: string; count: number; latest_invested_at: string }[]
> {
  try {
    await ensureEvercallInvestedTable()
    const sql = getDb()
    const r = await sql`
      SELECT list_group, COUNT(*) AS count, MAX(invested_at) AS latest_invested_at
      FROM evercall_invested
      GROUP BY list_group ORDER BY list_group
    `
    return r.map(row => ({
      list_group:         String(row.list_group),
      count:              Number(row.count),
      latest_invested_at: String(row.latest_invested_at),
    }))
  } catch { return [] }
}

// ── エクスポート用フィルター ───────────────────────────────

export interface ExportFilters {
  genres?: string[]
  timeCategories?: string[]
  seatMin?: number
  seatMax?: number
  bikou?: string[]
  excludeInvested?: boolean
  investedListGroup?: string  // ZIPエクスポートで選択したリストグループ
  progressGroup?: string      // 最大進捗フィルター対象グループ
  progressMin?: number        // 最大進捗 下限（以上）
  progressMax?: number        // 最大進捗 上限（以下）
  addressFilter?: 'filled' | 'blank' | 'all'  // 住所フィルター（default: filled）
}

const PROGRESS_COLUMN: Record<string, string> = {
  '全部':      '最大進捗',
  '飲食SH':    '飲食SH最大進捗',
  'サイネージ': 'サイネ',
  'デリバリー': 'デリバリー最大進捗',
  'ペイメント': 'ペイメント_コール履歴',
}

function buildFilterWhere(filters: ExportFilters): { where: string; args: unknown[] } {
  const parts: string[] = []
  const args: unknown[] = []
  let i = 1

  // 電話番号・名前は必須
  parts.push(`"電話番号" IS NOT NULL AND "電話番号" != '' AND "電話番号" NOT LIKE '#%'`)
  parts.push(`"名前"  IS NOT NULL AND "名前"  != ''`)
  // 住所フィルター
  const addrFilter = filters.addressFilter ?? 'filled'
  if (addrFilter === 'filled') {
    parts.push(`"住所2" IS NOT NULL AND "住所2" != ''`)
  } else if (addrFilter === 'blank') {
    parts.push(`("住所2" IS NULL OR "住所2" = '')`)
  }

  if (filters.genres && filters.genres.length > 0) {
    parts.push(`"ジャンル" = ANY($${i}::text[])`)
    args.push(filters.genres)
    i++
  }
  if (filters.timeCategories && filters.timeCategories.length > 0) {
    parts.push(`"時間振り" = ANY($${i}::text[])`)
    args.push(filters.timeCategories)
    i++
  }
  if (filters.bikou && filters.bikou.length > 0) {
    parts.push(`"備考" = ANY($${i}::text[])`)
    args.push(filters.bikou)
    i++
  }
  if (filters.seatMin !== undefined && !isNaN(filters.seatMin)) {
    parts.push(`("席数" ~ '^[0-9]+$' AND CAST("席数" AS INTEGER) >= $${i})`)
    args.push(filters.seatMin)
    i++
  }
  if (filters.seatMax !== undefined && !isNaN(filters.seatMax)) {
    parts.push(`("席数" ~ '^[0-9]+$' AND CAST("席数" AS INTEGER) <= $${i})`)
    args.push(filters.seatMax)
    i++
  }
  if (filters.progressGroup && PROGRESS_COLUMN[filters.progressGroup]) {
    const col = PROGRESS_COLUMN[filters.progressGroup]
    const expr = `COALESCE(NULLIF("${col}", ''), '0')::INTEGER`
    if (filters.progressMin !== undefined && !isNaN(filters.progressMin)) {
      parts.push(`${expr} >= $${i}`)
      args.push(filters.progressMin)
      i++
    }
    if (filters.progressMax !== undefined && !isNaN(filters.progressMax)) {
      parts.push(`${expr} <= $${i}`)
      args.push(filters.progressMax)
      i++
    }
  }
  if (filters.excludeInvested === true) {
    if (filters.investedListGroup) {
      parts.push(`NOT EXISTS (SELECT 1 FROM evercall_invested ei WHERE ei.phone_number = csv_data."電話番号" AND ei.list_group = $${i})`)
      args.push(filters.investedListGroup)
      i++
    } else {
      parts.push(`NOT EXISTS (SELECT 1 FROM evercall_invested ei WHERE ei.phone_number = csv_data."電話番号")`)
    }
  }

  return {
    where: parts.length > 0 ? 'WHERE ' + parts.join(' AND ') : '',
    args,
  }
}

export async function getFilteredCount(filters: ExportFilters): Promise<number> {
  const sql = getDb()
  const { where, args } = buildFilterWhere(filters)
  const r = await dyn(sql, `SELECT COUNT(*) AS count FROM csv_data ${where}`, args)
  return Number(r[0]?.count ?? 0)
}

export async function getFilteredCountByTimeCategory(
  filters: ExportFilters
): Promise<Record<string, number>> {
  const sql = getDb()
  const { where, args } = buildFilterWhere(filters)
  const r = await dyn(sql, 
    `SELECT "時間振り" AS time_val, COUNT(*) AS count FROM csv_data ${where} GROUP BY "時間振り"`,
    args
  )
  const result: Record<string, number> = {}
  for (const row of r) {
    if (row.time_val) result[String(row.time_val)] = Number(row.count)
  }
  return result
}

export async function getFilteredRows(filters: ExportFilters): Promise<Record<string, string>[]> {
  const sql = getDb()
  const { where, args } = buildFilterWhere(filters)
  const r = await dyn(sql, 
    `SELECT
      "ID", "名前", "電話番号", "住所1", "住所2",
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
    FROM csv_data ${where} ORDER BY created_at`,
    args
  )
  return r.map(row => {
    const out: Record<string, string> = {}
    for (const col of LIST_COLUMNS) {
      out[col] = row[col] != null ? String(row[col]) : ''
    }
    return out
  })
}

export async function getUniqueGenres(): Promise<string[]> {
  const sql = getDb()
  const r = await sql`
    SELECT DISTINCT "ジャンル" AS genre
    FROM csv_data
    WHERE "ジャンル" IS NOT NULL AND "ジャンル" != ''
    ORDER BY genre
  `
  return r.map(row => String(row.genre))
}

// ── エクスポートテンプレート・履歴テーブル ────────────────

export async function ensureExportTables(): Promise<void> {
  const sql = getDb()
  await dyn(sql, `
    CREATE TABLE IF NOT EXISTS export_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      filters TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `)
  await dyn(sql, `
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
  `)
}

export async function getExportTemplates() {
  await ensureExportTables()
  const sql = getDb()
  return sql`SELECT * FROM export_templates ORDER BY created_at DESC`
}

export async function saveExportTemplate(id: string, name: string, filtersJson: string) {
  await ensureExportTables()
  const sql = getDb()
  const now = new Date().toISOString()
  await sql`INSERT INTO export_templates (id, name, filters, created_at) VALUES (${id}, ${name}, ${filtersJson}, ${now})`
}

export async function deleteExportTemplate(id: string) {
  const sql = getDb()
  await sql`DELETE FROM export_templates WHERE id = ${id}`
}

export async function getNextListNumber(): Promise<number> {
  await ensureExportTables()
  const sql = getDb()
  const r = await sql`SELECT MAX(list_number) AS max_num FROM export_history`
  return (Number(r[0]?.max_num ?? 0)) + 1
}

export async function saveExportHistory(
  id: string, listNumber: number, listGroup: string,
  timeCategory: string, seatCondition: string, exportDate: string,
  fileName: string, rowCount: number
) {
  await ensureExportTables()
  const sql = getDb()
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
  const sql = getDb()
  return sql`SELECT * FROM export_history ORDER BY created_at DESC LIMIT 100`
}

// ── アップロード別充填数 ──────────────────────────────────

export async function getFillCountPerUpload(uploadIds: string[]): Promise<Record<string, number>> {
  if (uploadIds.length === 0) return {}
  const sql = getDb()
  try {
    const r = await dyn(sql, 
      `SELECT upload_id, SUM(filled) AS fill_count
       FROM (
         SELECT cd.upload_id,
           (CASE WHEN "電話番号" IS NOT NULL AND "電話番号" != '' THEN 1 ELSE 0 END +
            CASE WHEN "ジャンル" IS NOT NULL AND "ジャンル" != '' THEN 1 ELSE 0 END +
            CASE WHEN "時間振り" IS NOT NULL AND "時間振り" != '' THEN 1 ELSE 0 END +
            CASE WHEN "席数"     IS NOT NULL AND "席数"     != '' THEN 1 ELSE 0 END +
            CASE WHEN "備考"     IS NOT NULL AND "備考"     != '' THEN 1 ELSE 0 END) AS filled
         FROM csv_data cd
         WHERE cd.upload_id = ANY($1::text[])
       ) t
       GROUP BY upload_id`,
      [uploadIds]
    )
    const counts: Record<string, number> = {}
    for (const row of r) counts[String(row.upload_id)] = Number(row.fill_count)
    return counts
  } catch (e) {
    console.error('getFillCountPerUpload error:', e)
    return {}
  }
}

// ── チーム・メンバー管理 ──────────────────────────────────

export async function ensureTeamTables() {
  const sql = getDb()
  await dyn(sql, `
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL
    )
  `)
  await dyn(sql, `
    CREATE TABLE IF NOT EXISTS team_members (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `)
  await dyn(sql, `ALTER TABLE csv_uploads ADD COLUMN IF NOT EXISTS work_hours REAL`)
  await dyn(sql, `ALTER TABLE csv_uploads ADD COLUMN IF NOT EXISTS worker_name TEXT`)
  await dyn(sql, `ALTER TABLE csv_uploads ADD COLUMN IF NOT EXISTS report_date TEXT`)
  await dyn(sql, `ALTER TABLE csv_uploads ADD COLUMN IF NOT EXISTS team_name TEXT`)
  await dyn(sql, `ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS is_data_changed INTEGER NOT NULL DEFAULT 1`)
}

export async function getTeams() {
  await ensureTeamTables()
  const sql = getDb()
  const teams = await sql`SELECT * FROM teams ORDER BY name`
  const members = await sql`SELECT * FROM team_members ORDER BY name`
  return teams.map(t => ({
    id: String(t.id), name: String(t.name), created_at: String(t.created_at),
    members: members
      .filter(m => m.team_id === t.id)
      .map(m => ({ id: String(m.id), team_id: String(m.team_id), name: String(m.name), created_at: String(m.created_at) })),
  }))
}

export async function createTeam(id: string, name: string) {
  await ensureTeamTables()
  const sql = getDb()
  const now = new Date().toISOString()
  await sql`INSERT INTO teams (id, name, created_at) VALUES (${id}, ${name}, ${now})`
}

export async function createTeamMember(id: string, teamId: string, name: string) {
  await ensureTeamTables()
  const sql = getDb()
  const now = new Date().toISOString()
  await sql`INSERT INTO team_members (id, team_id, name, created_at) VALUES (${id}, ${teamId}, ${name}, ${now})`
}

export async function deleteTeamMember(id: string) {
  const sql = getDb()
  await sql`DELETE FROM team_members WHERE id = ${id}`
}

export async function deleteTeam(id: string) {
  const sql = getDb()
  await sql`DELETE FROM teams WHERE id = ${id}`
}

export async function getTeamMembersByNames(names: string[]) {
  if (names.length === 0) return []
  await ensureTeamTables()
  const sql = getDb()
  return dyn(sql, `SELECT tm.name, t.name AS team_name FROM team_members tm JOIN teams t ON t.id = tm.team_id WHERE tm.name = ANY($1::text[])`, [names])
}

// ── SharePoint連携ファイル管理 ────────────────────────────────

export async function ensureSharepointFilesTable() {
  const sql = getDb()
  await dyn(sql, `
    CREATE TABLE IF NOT EXISTS sharepoint_files (
      id                  TEXT PRIMARY KEY,
      name                TEXT NOT NULL,
      sharepoint_site_id  TEXT NOT NULL,
      sharepoint_file_id  TEXT,
      sharepoint_file_path TEXT,
      sharepoint_url      TEXT,
      last_synced_at      TEXT,
      last_sync_status    TEXT NOT NULL DEFAULT 'never',
      last_sync_message   TEXT,
      auto_sync_enabled   INTEGER NOT NULL DEFAULT 1,
      created_by          TEXT NOT NULL,
      created_at          TEXT NOT NULL,
      updated_at          TEXT NOT NULL
    )
  `)
}

export interface SharepointFile {
  id: string
  name: string
  sharepoint_site_id: string
  sharepoint_file_id: string | null
  sharepoint_file_path: string | null
  sharepoint_url: string | null
  last_synced_at: string | null
  last_sync_status: 'never' | 'success' | 'error'
  last_sync_message: string | null
  auto_sync_enabled: number
  created_by: string
  created_at: string
  updated_at: string
}

export async function getSharepointFiles(): Promise<SharepointFile[]> {
  await ensureSharepointFilesTable()
  const sql = getDb()
  const rows = await sql`SELECT * FROM sharepoint_files ORDER BY created_at DESC`
  return rows.map(r => ({
    id:                   String(r.id),
    name:                 String(r.name),
    sharepoint_site_id:   String(r.sharepoint_site_id),
    sharepoint_file_id:   r.sharepoint_file_id   ? String(r.sharepoint_file_id)   : null,
    sharepoint_file_path: r.sharepoint_file_path ? String(r.sharepoint_file_path) : null,
    sharepoint_url:       r.sharepoint_url        ? String(r.sharepoint_url)        : null,
    last_synced_at:       r.last_synced_at        ? String(r.last_synced_at)        : null,
    last_sync_status:     (r.last_sync_status ?? 'never') as 'never' | 'success' | 'error',
    last_sync_message:    r.last_sync_message     ? String(r.last_sync_message)     : null,
    auto_sync_enabled:    Number(r.auto_sync_enabled ?? 1),
    created_by:           String(r.created_by),
    created_at:           String(r.created_at),
    updated_at:           String(r.updated_at),
  }))
}

export async function getSharepointFileById(id: string): Promise<SharepointFile | null> {
  await ensureSharepointFilesTable()
  const sql = getDb()
  const rows = await sql`SELECT * FROM sharepoint_files WHERE id = ${id} LIMIT 1`
  if (!rows[0]) return null
  const r = rows[0]
  return {
    id:                   String(r.id),
    name:                 String(r.name),
    sharepoint_site_id:   String(r.sharepoint_site_id),
    sharepoint_file_id:   r.sharepoint_file_id   ? String(r.sharepoint_file_id)   : null,
    sharepoint_file_path: r.sharepoint_file_path ? String(r.sharepoint_file_path) : null,
    sharepoint_url:       r.sharepoint_url        ? String(r.sharepoint_url)        : null,
    last_synced_at:       r.last_synced_at        ? String(r.last_synced_at)        : null,
    last_sync_status:     (r.last_sync_status ?? 'never') as 'never' | 'success' | 'error',
    last_sync_message:    r.last_sync_message     ? String(r.last_sync_message)     : null,
    auto_sync_enabled:    Number(r.auto_sync_enabled ?? 1),
    created_by:           String(r.created_by),
    created_at:           String(r.created_at),
    updated_at:           String(r.updated_at),
  }
}

export async function createSharepointFile(params: {
  id: string
  name: string
  sharepoint_site_id: string
  sharepoint_file_id?: string
  sharepoint_file_path?: string
  sharepoint_url?: string
  auto_sync_enabled?: number
  created_by: string
}): Promise<void> {
  await ensureSharepointFilesTable()
  const sql = getDb()
  const now = new Date().toISOString()
  await dyn(sql, `
    INSERT INTO sharepoint_files
      (id, name, sharepoint_site_id, sharepoint_file_id, sharepoint_file_path, sharepoint_url, auto_sync_enabled, created_by, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
  `, [
    params.id,
    params.name,
    params.sharepoint_site_id,
    params.sharepoint_file_id ?? null,
    params.sharepoint_file_path ?? null,
    params.sharepoint_url ?? null,
    params.auto_sync_enabled ?? 1,
    params.created_by,
    now,
  ])
}

export async function updateSharepointFile(id: string, params: {
  name?: string
  sharepoint_site_id?: string
  sharepoint_file_id?: string
  sharepoint_file_path?: string
  sharepoint_url?: string
  auto_sync_enabled?: number
}): Promise<void> {
  const sql = getDb()
  const now = new Date().toISOString()
  const sets: string[] = ['updated_at = $1']
  const args: unknown[] = [now]
  let i = 2

  if (params.name !== undefined)                { sets.push(`name = $${i++}`);                 args.push(params.name) }
  if (params.sharepoint_site_id !== undefined)  { sets.push(`sharepoint_site_id = $${i++}`);  args.push(params.sharepoint_site_id) }
  if (params.sharepoint_file_id !== undefined)  { sets.push(`sharepoint_file_id = $${i++}`);  args.push(params.sharepoint_file_id || null) }
  if (params.sharepoint_file_path !== undefined){ sets.push(`sharepoint_file_path = $${i++}`);args.push(params.sharepoint_file_path || null) }
  if (params.sharepoint_url !== undefined)      { sets.push(`sharepoint_url = $${i++}`);       args.push(params.sharepoint_url || null) }
  if (params.auto_sync_enabled !== undefined)   { sets.push(`auto_sync_enabled = $${i++}`);   args.push(params.auto_sync_enabled) }

  args.push(id)
  await dyn(sql, `UPDATE sharepoint_files SET ${sets.join(', ')} WHERE id = $${i}`, args)
}

export async function updateSharepointFileSyncResult(id: string, status: 'success' | 'error', message?: string): Promise<void> {
  const sql = getDb()
  const now = new Date().toISOString()
  await dyn(sql, `
    UPDATE sharepoint_files
    SET last_synced_at = $1, last_sync_status = $2, last_sync_message = $3, updated_at = $1
    WHERE id = $4
  `, [now, status, message ?? null, id])
}

export async function deleteSharepointFile(id: string): Promise<void> {
  const sql = getDb()
  await sql`DELETE FROM sharepoint_files WHERE id = ${id}`
}

export async function seedInitialTeams() {
  await ensureTeamTables()
  const sql = getDb()
  const existing = await sql`SELECT COUNT(*) AS cnt FROM teams`
  if (Number(existing[0]?.cnt) > 0) return { message: '初期データ登録済みです' }

  const initialData = [
    { name: 'アルバイト（主力）', members: ['明星', '足立', '納富', '額賀', '村橋', '柴崎', '妹尾', '池田'] },
    { name: '第五本部',          members: ['石川', '竹股', '奥田', '生井'] },
    { name: '第七本部',          members: ['加藤', '佐久間', '市川', '齋藤', '大塚', '三原'] },
    { name: '第八本部',          members: ['中村', '中尾', '坂根', '木村', '椿谷', '渡邊', '平山', '髙橋', '山ノ内'] },
  ]

  for (const team of initialData) {
    const teamId = crypto.randomUUID()
    const now = new Date().toISOString()
    await sql`INSERT INTO teams (id, name, created_at) VALUES (${teamId}, ${team.name}, ${now})`
    for (const memberName of team.members) {
      const memberId = crypto.randomUUID()
      await sql`INSERT INTO team_members (id, team_id, name, created_at) VALUES (${memberId}, ${teamId}, ${memberName}, ${now})`
    }
  }
  return { message: '初期データ登録完了' }
}
