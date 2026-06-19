import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

const TAIO_LIST   = `('対応','フル','決裁','有効','アポ','AF')`
const KASSAI_LIST = `('フル','決裁','有効','アポ','AF')`

const PROGRESS_SCORE = `
  MAX(CASE c."歩留まり"
    WHEN 'アポ'   THEN 9
    WHEN 'AF'    THEN 8
    WHEN 'フル'   THEN 7
    WHEN '有効'   THEN 6
    WHEN '決裁'   THEN 5
    WHEN '対応'   THEN 4
    WHEN '打電'   THEN 1
    ELSE 0
  END)::int
`

const SORT_ALIAS: Record<string, string> = {
  calls:       'calls',
  taio:        'taio',
  kassai:      'kassai',
  taio_rate:   'taio_rate',
  kassai_rate: 'kassai_rate',
  progress:    'max_progress_score',
  last_call:   'last_call',
}

const SORT_EXPR: Record<string, string> = {
  name:    'm."名前"',
  seats:   'm."席数"',
  staff:   'm."従業員"',
  teikyu:  'm."定休日"',
}

export async function GET(req: NextRequest) {
  const db = getDb()
  const sp = req.nextUrl.searchParams

  const page      = Math.max(1,   parseInt(sp.get('page')   ?? '1'))
  const limit     = Math.min(100, parseInt(sp.get('limit')  ?? '50'))
  const search    = sp.get('search')    ?? ''
  const pref      = sp.get('pref')      ?? ''
  const gyoshu    = sp.get('gyoshu')    ?? ''
  const hp        = sp.get('hp')        ?? ''
  const sortField = sp.get('sort')      ?? 'calls'
  const sortDir   = sp.get('sort_dir')  === 'asc' ? 'ASC' : 'DESC'
  const taioMin   = sp.get('taio_min')      ? parseFloat(sp.get('taio_min')!)      : null
  const taioMax   = sp.get('taio_max')      ? parseFloat(sp.get('taio_max')!)      : null
  const kassaiMin = sp.get('kassai_min')    ? parseFloat(sp.get('kassai_min')!)    : null
  const kassaiMax = sp.get('kassai_max')    ? parseFloat(sp.get('kassai_max')!)    : null
  const progressMin   = sp.get('progress_min') ? parseInt(sp.get('progress_min')!) : null
  const progressMax   = sp.get('progress_max') ? parseInt(sp.get('progress_max')!) : null
  const staffFilter   = sp.get('staff')          ?? ''
  const teikyuSearch  = sp.get('teikyu')         ?? ''
  const multiStore    = sp.get('multi_store')    ?? ''
  const lastCallFrom  = sp.get('last_call_from') ?? ''
  const lastCallTo    = sp.get('last_call_to')   ?? ''
  const offset = (page - 1) * limit

  const wheres:  string[] = []
  const havings: string[] = []
  const params:  unknown[] = []
  let pi = 1

  if (search) {
    wheres.push(`(m."名前" ILIKE $${pi} OR m."店舗電話番号" LIKE $${pi+1})`)
    params.push(`%${search}%`, `%${search}%`)
    pi += 2
  }
  if (pref)   { wheres.push(`m."住所1" = $${pi++}`);  params.push(pref)   }
  if (gyoshu) { wheres.push(`m."業種" = $${pi++}`);   params.push(gyoshu) }
  if (hp)     { wheres.push(`m."HP保有" = $${pi++}`); params.push(hp)     }
  if (staffFilter === '3+') {
    wheres.push(`(m."従業員" ~ '^[0-9]+$' AND m."従業員"::int >= 3)`)
  } else if (staffFilter === 'unknown') {
    wheres.push(`(m."従業員" IS NULL OR m."従業員" = '')`)
  } else if (staffFilter) {
    wheres.push(`m."従業員" = $${pi++}`)
    params.push(staffFilter)
  }
  if (teikyuSearch === 'unknown') {
    wheres.push(`(m."定休日" IS NULL OR m."定休日" = '')`)
  } else if (teikyuSearch) {
    wheres.push(`m."定休日" ILIKE $${pi++}`)
    params.push(`%${teikyuSearch}%`)
  }
  if (multiStore === 'yes') {
    wheres.push(`(m."複数店精査" IS NOT NULL AND m."複数店精査" != '')`)
  } else if (multiStore === 'no') {
    wheres.push(`(m."複数店精査" IS NULL OR m."複数店精査" = '')`)
  }

  const taioExpr   = `ROUND(COUNT(CASE WHEN c."歩留まり" IN ${TAIO_LIST}   THEN 1 END)::numeric / NULLIF(COUNT(c.id),0)*100,1)`
  const kassaiExpr = `ROUND(COUNT(CASE WHEN c."歩留まり" IN ${KASSAI_LIST} THEN 1 END)::numeric / NULLIF(COUNT(c.id),0)*100,1)`

  if (taioMin   !== null) { havings.push(`${taioExpr} >= $${pi++}`);   params.push(taioMin)   }
  if (taioMax   !== null) { havings.push(`${taioExpr} <= $${pi++}`);   params.push(taioMax)   }
  if (kassaiMin !== null) { havings.push(`${kassaiExpr} >= $${pi++}`); params.push(kassaiMin) }
  if (kassaiMax !== null) { havings.push(`${kassaiExpr} <= $${pi++}`); params.push(kassaiMax) }
  if (progressMin !== null) { havings.push(`${PROGRESS_SCORE} >= $${pi++}`); params.push(progressMin) }
  if (progressMax !== null) { havings.push(`${PROGRESS_SCORE} <= $${pi++}`); params.push(progressMax) }
  if (lastCallFrom) {
    havings.push(`TO_DATE(MAX(c."コール日"), 'FMYYYY/FMMM/FMDD') >= $${pi++}::date`)
    params.push(lastCallFrom)
  }
  if (lastCallTo) {
    havings.push(`TO_DATE(MAX(c."コール日"), 'FMYYYY/FMMM/FMDD') <= $${pi++}::date`)
    params.push(lastCallTo)
  }

  const whereClause  = wheres.length  ? `WHERE ${wheres.join(' AND ')}`   : ''
  const havingClause = havings.length ? `HAVING ${havings.join(' AND ')}` : ''

  const orderExpr = SORT_ALIAS[sortField]
    ? `${SORT_ALIAS[sortField]} ${sortDir}`
    : `${SORT_EXPR[sortField] ?? 'calls'} ${sortDir}`

  const dataQuery = `
    SELECT
      m."レコード番号", m."名前", m."店舗電話番号",
      m."住所1", m."業種", m."HP保有", m."席数", m."従業員", m."定休日", m."複数店精査",
      COUNT(c.id)::int AS calls,
      COUNT(CASE WHEN c."歩留まり" IN ${TAIO_LIST}   THEN 1 END)::int AS taio,
      COUNT(CASE WHEN c."歩留まり" IN ${KASSAI_LIST} THEN 1 END)::int AS kassai,
      ROUND(COUNT(CASE WHEN c."歩留まり" IN ${TAIO_LIST}   THEN 1 END)::numeric / NULLIF(COUNT(c.id),0)*100,1) AS taio_rate,
      ROUND(COUNT(CASE WHEN c."歩留まり" IN ${KASSAI_LIST} THEN 1 END)::numeric / NULLIF(COUNT(c.id),0)*100,1) AS kassai_rate,
      ${PROGRESS_SCORE} AS max_progress_score,
      MAX(c."コール日") AS last_call
    FROM sh_list_master m
    INNER JOIN beauty_calls c ON m."店舗電話番号" = c."電話番号"
    ${whereClause}
    GROUP BY
      m."レコード番号", m."名前", m."店舗電話番号",
      m."住所1", m."業種", m."HP保有", m."席数", m."従業員", m."定休日", m."複数店精査"
    ${havingClause}
    ORDER BY ${orderExpr} NULLS LAST
    LIMIT $${pi} OFFSET $${pi+1}
  `
  const dataParams = [...params, limit, offset]

  const countQuery = `
    SELECT COUNT(*)::int AS total FROM (
      SELECT m."レコード番号"
      FROM sh_list_master m
      INNER JOIN beauty_calls c ON m."店舗電話番号" = c."電話番号"
      ${whereClause}
      GROUP BY m."レコード番号", m."名前", m."店舗電話番号",
               m."住所1", m."業種", m."HP保有", m."席数", m."従業員", m."定休日", m."複数店精査"
      ${havingClause}
    ) t
  `

  try {
    const [rows, countRows] = await Promise.all([
      db.query(dataQuery, dataParams),
      db.query(countQuery, params),
    ])
    const total = (countRows[0] as { total: number })?.total ?? 0
    return NextResponse.json({ success: true, data: rows, total, page, limit })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: String(e) }, { status: 500 })
  }
}