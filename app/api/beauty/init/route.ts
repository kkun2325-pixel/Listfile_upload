import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function POST() {
  const sql = getDb()
  try {
    await sql.query(`
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
    await sql.query(`CREATE INDEX IF NOT EXISTS idx_beauty_calls_tel    ON beauty_calls("電話番号")`)
    await sql.query(`CREATE INDEX IF NOT EXISTS idx_beauty_calls_result ON beauty_calls("歩留まり")`)
    await sql.query(`CREATE INDEX IF NOT EXISTS idx_beauty_calls_date   ON beauty_calls("コール日")`)
    return NextResponse.json({ success: true, message: 'beauty_calls テーブル準備完了' })
  } catch (e) {
    return NextResponse.json({ success: false, message: String(e) }, { status: 500 })
  }
}
