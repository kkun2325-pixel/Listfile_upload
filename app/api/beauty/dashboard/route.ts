import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

const TAIO_LIST   = `('対応','フル','決裁','有効','アポ','AF')`
const KASSAI_LIST = `('フル','決裁','有効','アポ','AF')`

export async function GET() {
  const db = getDb()
  try {
    const [
      masterCount,
      callsCount,
      overall,
      byTime,
      byGyoshu,
      byPref,
    ] = await Promise.all([
      db.query(`SELECT COUNT(*)::int AS c FROM sh_list_master`),
      db.query(`SELECT COUNT(*)::int AS c FROM beauty_calls`),
      db.query(`
        SELECT
          COUNT(*)::int AS calls,
          COUNT(CASE WHEN "歩留まり" IN ${TAIO_LIST}   THEN 1 END)::int AS taio,
          COUNT(CASE WHEN "歩留まり" IN ${KASSAI_LIST} THEN 1 END)::int AS kassai
        FROM beauty_calls
        WHERE "電話番号" IS NOT NULL AND "電話番号" != ''
      `),
      db.query(`
        SELECT
          "コール時間" AS hour,
          COUNT(*)::int AS calls,
          COUNT(CASE WHEN "歩留まり" IN ${TAIO_LIST}   THEN 1 END)::int AS taio,
          COUNT(CASE WHEN "歩留まり" IN ${KASSAI_LIST} THEN 1 END)::int AS kassai
        FROM beauty_calls
        WHERE "コール時間" ~ '^[0-9]'
        GROUP BY "コール時間"
        ORDER BY "コール時間"
      `),
      db.query(`
        SELECT
          c."業種" AS gyoshu,
          COUNT(*)::int AS calls,
          COUNT(CASE WHEN c."歩留まり" IN ${TAIO_LIST}   THEN 1 END)::int AS taio,
          COUNT(CASE WHEN c."歩留まり" IN ${KASSAI_LIST} THEN 1 END)::int AS kassai
        FROM beauty_calls c
        WHERE c."業種" IS NOT NULL AND c."業種" != ''
        GROUP BY c."業種"
        ORDER BY calls DESC
        LIMIT 10
      `),
      db.query(`
        SELECT
          m."住所1" AS pref,
          COUNT(c.id)::int AS calls,
          COUNT(CASE WHEN c."歩留まり" IN ${TAIO_LIST} THEN 1 END)::int AS taio
        FROM beauty_calls c
        INNER JOIN sh_list_master m ON c."電話番号" = m."店舗電話番号"
        WHERE m."住所1" IS NOT NULL AND m."住所1" != ''
        GROUP BY m."住所1"
        ORDER BY calls DESC
        LIMIT 10
      `),
    ])

    const ov = overall[0] as { calls: number; taio: number; kassai: number }
    return NextResponse.json({
      success: true,
      stats: {
        master_count: (masterCount[0] as { c: number }).c,
        calls_count:  (callsCount[0]  as { c: number }).c,
        taio_rate:    ov.calls ? +((ov.taio   / ov.calls) * 100).toFixed(1) : 0,
        kassai_rate:  ov.calls ? +((ov.kassai / ov.calls) * 100).toFixed(1) : 0,
        ...ov,
      },
      byTime: byTime.map(r => {
        const rc = r as { hour: string; calls: number; taio: number; kassai: number }
        return {
          ...rc,
          taio_rate:   rc.calls ? +((rc.taio   / rc.calls) * 100).toFixed(1) : 0,
          kassai_rate: rc.calls ? +((rc.kassai / rc.calls) * 100).toFixed(1) : 0,
        }
      }),
      byGyoshu: byGyoshu.map(r => {
        const rc = r as { gyoshu: string; calls: number; taio: number; kassai: number }
        return {
          ...rc,
          taio_rate:   rc.calls ? +((rc.taio   / rc.calls) * 100).toFixed(1) : 0,
          kassai_rate: rc.calls ? +((rc.kassai / rc.calls) * 100).toFixed(1) : 0,
        }
      }),
      byPref: byPref.map(r => {
        const rc = r as { pref: string; calls: number; taio: number }
        return {
          ...rc,
          taio_rate: rc.calls ? +((rc.taio / rc.calls) * 100).toFixed(1) : 0,
        }
      }),
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: String(e) }, { status: 500 })
  }
}