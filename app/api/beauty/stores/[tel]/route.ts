import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: { tel: string } }
) {
  const sql = getDb()
  const tel = decodeURIComponent(params.tel)

  try {
    // マスタ情報
    const masterRows = await sql.query(
      `SELECT * FROM sh_list_master WHERE "店舗電話番号" = $1 LIMIT 1`,
      [tel]
    )
    const master = masterRows[0] ?? null

    // 全コール履歴
    const callRows = await sql.query(
      `SELECT "コール日", "曜日", "コール時間", "コール日時",
              "歩留まり", "コール結果", "ステータス", "メモ"
       FROM beauty_calls
       WHERE "電話番号" = $1
       ORDER BY "コール日時" DESC NULLS LAST`,
      [tel]
    )

    // サマリー集計
    const total   = callRows.length
    const taio    = callRows.filter(r => [r['歩留まり']].some(v => ['対応','フル','決裁','有効','アポ','AF'].includes(v as string))).length
    const kassai  = callRows.filter(r => ['フル','決裁','有効','アポ','AF'].includes(r['歩留まり'] as string)).length

    // 対応の曜日×時刻ヒートマップ
    const taioRows   = callRows.filter(r => ['対応','フル','決裁','有効','アポ','AF'].includes(r['歩留まり'] as string))
    const kassaiRows = callRows.filter(r => ['フル','決裁','有効','アポ','AF'].includes(r['歩留まり'] as string))

    const DAYS  = ['月','火','水','木','金','土','日']
    const HOURS = ['09時','10時','11時','12時','13時','14時','15時','16時','17時','18時','19時','20時','21時','22時']

    function buildHeatmap(rows: Record<string, unknown>[]) {
      const map: Record<string, Record<string, number>> = {}
      for (const h of HOURS) {
        map[h] = {}
        for (const d of DAYS) map[h][d] = 0
      }
      for (const r of rows) {
        const h = r['コール時間'] as string
        const d = r['曜日'] as string
        if (map[h] && d in map[h]) map[h][d]++
      }
      return map
    }

    return NextResponse.json({
      success: true,
      master,
      summary: {
        calls: total,
        taio,
        kassai,
        taio_rate:   total ? +((taio   / total) * 100).toFixed(1) : 0,
        kassai_rate: total ? +((kassai / total) * 100).toFixed(1) : 0,
      },
      heatmap: {
        taio:   buildHeatmap(taioRows),
        kassai: buildHeatmap(kassaiRows),
        days:   DAYS,
        hours:  HOURS,
      },
      calls: callRows,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: String(e) }, { status: 500 })
  }
}
