import { neon } from '@neondatabase/serverless'

function getSQL() {
  const raw = process.env.DATABASE_URL ?? ''
  // BOM・前後の空白・改行を除去
  const url = raw.replace(/^﻿/, '').trim()
  if (!url) throw new Error('DATABASE_URL が設定されていません')
  return neon(url)
}

export async function initializeDatabase() {
  const sql = getSQL()

  // usersテーブルをusername対応で再作成
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
      error_message TEXT
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS csv_data (
      id TEXT PRIMARY KEY,
      upload_id TEXT NOT NULL REFERENCES csv_uploads(id),
      row_number INTEGER NOT NULL,
      data TEXT NOT NULL,
      phone_number TEXT,
      is_duplicate INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `

  await sql`CREATE INDEX IF NOT EXISTS idx_csv_data_upload_id ON csv_data(upload_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_csv_data_phone_number ON csv_data(phone_number)`
  await sql`CREATE INDEX IF NOT EXISTS idx_csv_uploads_user_id ON csv_uploads(user_id)`
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
  id: string,
  userId: string,
  filename: string,
  originalFilename: string,
  fileSize: number,
  rowCount: number
) {
  const sql = getSQL()
  const now = new Date().toISOString()
  await sql`
    INSERT INTO csv_uploads (id, user_id, filename, original_filename, file_size, row_count, uploaded_at, status)
    VALUES (${id}, ${userId}, ${filename}, ${originalFilename}, ${fileSize}, ${rowCount}, ${now}, 'processed')
  `
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

// ── CSVデータ操作 ────────────────────────────────────────

export async function insertCSVData(
  id: string,
  uploadId: string,
  rowNumber: number,
  data: Record<string, string>,
  phoneNumber?: string
) {
  const sql = getSQL()
  const now = new Date().toISOString()
  const dataJson = JSON.stringify(data)
  const phone = phoneNumber ?? null
  await sql`
    INSERT INTO csv_data (id, upload_id, row_number, data, phone_number, created_at)
    VALUES (${id}, ${uploadId}, ${rowNumber}, ${dataJson}, ${phone}, ${now})
  `
}

export async function checkDuplicate(phoneNumber: string) {
  const sql = getSQL()
  const result = await sql`SELECT id FROM csv_data WHERE phone_number = ${phoneNumber} LIMIT 1`
  return result.length > 0
}

export async function getCSVDataByUploadId(uploadId: string) {
  const sql = getSQL()
  const rows = await sql`SELECT * FROM csv_data WHERE upload_id = ${uploadId} ORDER BY row_number`
  return rows.map((row) => ({
    ...row,
    data: JSON.parse(row.data as string),
  }))
}

export async function getCSVDataByFilter(
  uploadId: string,
  filters: Array<{ field: string; value: string }>
) {
  const rows = await getCSVDataByUploadId(uploadId)
  return rows.filter((row) =>
    filters.every((filter) => {
      const value = String((row.data as Record<string, string>)[filter.field] ?? '')
      return value === filter.value || value.includes(filter.value)
    })
  )
}

export async function getDuplicateCount(uploadId: string) {
  const sql = getSQL()
  const result = await sql`
    SELECT COUNT(*) as count FROM csv_data
    WHERE upload_id = ${uploadId} AND is_duplicate = 1
  `
  return Number(result[0]?.count ?? 0)
}
