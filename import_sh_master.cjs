/**
 * SHリストマスタ → CockroachDB インポートスクリプト
 * 実行方法: csv-upload-app フォルダ内で
 *   node import_sh_master.cjs
 */
const { Pool } = require('pg')
const fs = require('fs')
const readline = require('readline')
const path = require('path')

const DB_URL = 'postgresql://listfile_user:ysZbkL3aHmCgSIpQYQG5aw@skiing-burro-16418.jxf.gcp-asia-southeast1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full'
const CSV_PATH = path.join(__dirname, 'SHリストマスタ.csv')

const pool = new Pool({ connectionString: DB_URL, max: 3, idleTimeoutMillis: 60000 })

async function createTable() {
  const client = await pool.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS sh_list_master (
        "レコード番号"  TEXT PRIMARY KEY,
        "名前"          TEXT,
        "店舗電話番号"  TEXT,
        "住所1"         TEXT,
        "住所2"         TEXT,
        "定休日"        TEXT,
        "HP保有"        TEXT,
        "複数店精査"    TEXT,
        "単独店"        TEXT,
        "席数"          TEXT,
        "従業員"        TEXT,
        "業種"          TEXT,
        created_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sh_tel    ON sh_list_master ("店舗電話番号") WHERE "店舗電話番号" IS NOT NULL`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sh_gyoshu ON sh_list_master ("業種")`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sh_addr1  ON sh_list_master ("住所1")`)
    console.log('✅ テーブル sh_list_master 準備完了')
  } finally {
    client.release()
  }
}

function parseShiftJisLine(buf) {
  // Node.js 標準の Buffer デコード（Shift-JIS → UTF-8）
  return buf.toString('latin1') // fallback; iconv 不使用
}

// Shift-JIS CSVをUTF-8として読む（iconv-lite 不要: Python で変換済みJSONを利用）
// → このスクリプトはJSONチャンクを直接読む方式
async function insertBatch(client, batch) {
  if (batch.length === 0) return 0
  const cols = ['"レコード番号"', '"名前"', '"店舗電話番号"', '"住所1"', '"住所2"',
                '"定休日"', '"HP保有"', '"複数店精査"', '"単独店"', '"席数"', '"従業員"', '"業種"']
  const CHUNK = 300
  let inserted = 0
  for (let i = 0; i < batch.length; i += CHUNK) {
    const slice = batch.slice(i, i + CHUNK)
    const values = []
    const params = []
    let pi = 1
    for (const row of slice) {
      values.push(`($${pi++},$${pi++},$${pi++},$${pi++},$${pi++},$${pi++},$${pi++},$${pi++},$${pi++},$${pi++},$${pi++},$${pi++})`)
      params.push(
        row['レコード番号'] || null,
        row['名前'] || null,
        row['店舗電話番号'] || null,
        row['住所１'] || row['住所1'] || null,
        row['住所２'] || row['住所2'] || null,
        row['定休日'] || null,
        row['HP保有'] || null,
        row['複数店精査'] || null,
        row['単独店'] || null,
        row['席数'] || null,
        row['従業員'] || null,
        row['業種'] || null,
      )
    }
    await client.query(
      `INSERT INTO sh_list_master (${cols.join(',')}) VALUES ${values.join(',')} ON CONFLICT ("レコード番号") DO NOTHING`,
      params
    )
    inserted += slice.length
  }
  return inserted
}

async function main() {
  // JSONチャンクファイルを探す（同フォルダ内）
  // チャンクは csv-upload-app の親フォルダ（claude code）にある
  const dir = path.join(__dirname, '..')
  const chunkFiles = fs.readdirSync(dir)
    .filter(f => /^sh_chunk_\d+\.json$/.test(f))
    .sort()

  if (chunkFiles.length === 0) {
    console.error('❌ sh_chunk_XX.json が見つかりません。スクリプトと同じフォルダに置いてください。')
    process.exit(1)
  }
  console.log(`📦 チャンクファイル: ${chunkFiles.length} 個`)

  await createTable()

  const { rows: [{ c }] } = await pool.query('SELECT COUNT(*) as c FROM sh_list_master')
  console.log(`既存レコード数: ${c}`)

  let total = 0
  for (let i = 0; i < chunkFiles.length; i++) {
    const file = chunkFiles[i]
    const rows = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'))
    const client = await pool.connect()
    try {
      const n = await insertBatch(client, rows)
      total += n
      console.log(`[${i+1}/${chunkFiles.length}] ${file}: ${n}件 (累計: ${total})`)
    } finally {
      client.release()
    }
  }

  const { rows: [{ c: final }] } = await pool.query('SELECT COUNT(*) as c FROM sh_list_master')
  console.log(`\n✅ 完了。DB合計: ${final} レコード`)
  await pool.end()
}

main().catch(e => { console.error(e); process.exit(1) })
