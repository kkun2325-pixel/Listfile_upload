import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

// 対応: 誰かが電話に出た
const TAIO_VALUES = `('対応','フル','決裁','有効','アポ','AF')`
// 決裁接触: 決裁者に話せた
const KASSAI_VALUES = `('フル','決裁','有効','アポ','AF')`

export async function GET(req: NextRequest) {
  const sql = getDb()
  const { searchParams } = req.nextUrl
  const page   = Math.max(1, parseInt(searchParams.get('page')   ?? '1'))
  const limit  = Math.min(100, Math.max(10, parseInt(searchParams.get('limit') ?? '50')))
  const search = searchParams.get('search') ?? ''
  const pref   = searchParams.get('pref')   ?? ''
  const gyoshu = searchParams.get('gyoshu') ?? ''
  const hp     = searchParams.get('hp')     ?? ''
  const sort   = searchParams.get('sort')   ?? 'calls_desc'
  const offset = (page - 1) * limit

  const wheres: string[] = []
  const params: unknown[] = []
  let pi = 1

  if (search) {
    wheres.push(`(m."名前" ILIKE $${pi} OR m."店舗電話番号" LIKE $${pi+1})`)
    params.push(`%${search}%`, `%${search}%`)
    pi += 2
  }
  if (pref) {
    wheres.push(`m."住所1" = $${pi++}`)
    params.push(pref)
  }
  if (gyoshu) {
    wheres.push(`m."業種" = $${pi++}`)
    params.push(gyoshu)
  }
  if (hp) {
    wheres.push(`m."HP保有" = $${pi++}`)
    params.push(hp)
  }

  const whereClause = wheres.length ? `WHERE ${wheres.join(' AND ')}` : ''

  const orderMap: Record<string, string> = {
    calls_desc:  'calls DESC',
    calls_asc:   'calls ASC',
    taio_desc:   'taio_rate DESC',
    kassai_desc: 'kassai_rate DESC',
  }
  const orderBy = orderMap[sort] ?? 'calls DESC'

  const q = `
    SELECT
      m."レコード番号", m."名前", m."店舗電話番号",
      m."住所1", m."業種", m."HP保有", m."席数", m."従業員",
      COUNT(c.id)::int                                                                                   AS calls,
      COUNT(CASE WHEN c."歩留まり" IN ${TAIO_VALUES}   THEN 1 END)::int                                AS taio,
      COUNT(CASE WHEN c."歩留まり" IN ${KASSAI_VALUES} THEN 1 END)::int                                AS kassai,
      ROUND(COUNT(CASE WHEN c."歩留まり" IN ${TAIO_VALUES}   THEN 1 END)::numeric / NULLIF(COUNT(c.id),0) * 100, 1) AS taio_rate,
      ROUND(COUNT(CASE WHEN c."歩留まり" IN ${KASSAI_VALUES} THEN 1 END)::numeric / NULLIF(COUNT(c.id),0) * 100, 1) AS kassai_rate,
      MAX(c."コール日") AS last_call
    FROM sh_list_master m
    INNER JOIN beauty_calls c ON m."店舗電話番号" = c."電話番号"
    ${whereClause}
    GROUP BY m."レコード番号", m."名前", m."店舗電話番号",
             m."住所1", m."業種", m."HP保有", m."席数", m."従業員"
    ORDER BY ${orderBy}
    LIMIT $${pi} OFFSET $${pi+1}
  `
  params.push(limit, offset)

  try {
    const rows = await sql.query(q, params)
    return NextResponse.json({ success: true, data: rows, page, limit })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: String(e) }, { status: 500 })
  }
}
