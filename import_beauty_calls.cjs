/**
 * 【美容】時間別 → beauty_calls テーブル インポートスクリプト
 * 実行: cd csv-upload-app && node import_beauty_calls.cjs
 */
const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

const DB_URL = 'postgresql://listfile_user:ysZbkL3aHmCgSIpQYQG5aw@skiing-burro-16418.jxf.gcp-asia-southeast1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full'
const pool = new Pool({ connectionString: DB_URL, max: 3, idleTimeoutMillis: 60000 })

async function createTable() {
  const client = await pool.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS beauty_calls (
        id            BIGSERIAL PRIMARY KEY,
        "電話番号"    TEXT,
        "コール日"    TEXT,
        "曜日"        TEXT,
        "コール時間"  TEXT,
        "コール日時"  TEXT,
        "歩留まり"    TEXT,
        "業種"        TEXT,
        "コール結果"  TEXT,
        "ステータス"  TEXT,
        "名前"        TEXT,
        "リスト名"    TEXT,
        "メモ"        TEXT,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_beauty_calls_tel    ON beauty_calls("電話番号")`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_beauty_calls_result ON beauty_calls("歩留まり")`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_beauty_calls_date   ON beauty_calls("コール日")`)
    console.log('✅ テーブル beauty_calls 準備完了')
  } finally {
    client.release()
  }
}

async function insertBatch(client, batch) {
  if (!batch.length) return 0
  const COLS = ['"電話番号"','"コール日"','"曜日"','"コール時間"','"コール日時"','"歩留まり"','"業種"','"コール結果"','"ステータス"','"名前"','"リスト名"','"メモ"']
  const CHUNK = 300
  let total = 0
  for (let i = 0; i < batch.length; i += CHUNK) {
    const slice = batch.slice(i, i + CHUNK)
    const values = [], params = []
    let pi = 1
    for (const r of slice) {
      values.push(`($${pi++},$${pi++},$${pi++},$${pi++},$${pi++},$${pi++},$${pi++},$${pi++},$${pi++},$${pi++},$${pi++},$${pi++})`)
      params.push(
        r['電話番号'] || null, r['コール日'] || null, r['曜日'] || null,
        r['コール時間'] || null, r['コール日時'] || null, r['歩留まり'] || null,
        r['業種'] || null, r['コール結果'] || null, r['ステータス'] || null,
        r['名前'] || null, r['リスト名'] || null, r['メモ'] || null,
      )
    }
    await client.query(`INSERT INTO beauty_calls (${COLS.join(',')}) VALUES ${values.join(',')}`, params)
    total += slice.length
  }
  return total
}

async function main() {
  const dir = path.resolve(__dirname, '..')
  const chunkFiles = fs.readdirSync(dir)
    .filter(f => /^beauty_chunk_\d+\.json$/.test(f))
    .sort()

  if (!chunkFiles.length) {
    console.error('❌ beauty_chunk_XX.json が見つかりません')
    process.exit(1)
  }
  console.log(`📦 チャンクファイル: ${chunkFiles.length} 個`)

  await createTable()

  const { rows: [{ c }] } = await pool.query('SELECT COUNT(*) as c FROM beauty_calls')
  if (Number(c) > 0) {
    console.log(`⚠️  既に ${c} 件あります。重複インポートになります。続行しますか？ (Ctrl+C で中止)`)
    await new Promise(r => setTimeout(r, 5000))
  }

  let total = 0
  for (let i = 0; i < chunkFiles.length; i++) {
    const rows = JSON.parse(fs.readFileSync(path.join(dir, chunkFiles[i]), 'utf-8'))
    const client = await pool.connect()
    try {
      const n = await insertBatch(client, rows)
      total += n
      console.log(`[${i+1}/${chunkFiles.length}] ${chunkFiles[i]}: ${n}件 (累計: ${total})`)
    } finally {
      client.release()
    }
  }

  const { rows: [{ c: final }] } = await pool.query('SELECT COUNT(*) as c FROM beauty_calls')
  console.log(`\n✅ 完了。DB合計: ${final} レコード`)
  await pool.end()
}

main().catch(e => { console.error(e); process.exit(1) })
