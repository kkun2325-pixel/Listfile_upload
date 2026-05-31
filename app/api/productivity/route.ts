import { NextRequest, NextResponse } from "next/server";
import { verifyToken, extractToken } from "@/lib/auth";
import { getDb } from "@/lib/db";

const VALID_JIKANFURI = ['14時ランチ終了','15時ランチ終了','16時ディナー開始','17時ディナー開始','18時ディナー開始','19時ディナー開始','通し午前開始','通し午後開始','通し18時終了']
const VALID_GENRE     = ['居酒屋','バー','肉料理','和食','うどん/そば','粉もの','鉄板','アジア料理','洋食','カフェ','軽飲食','レストラン','多国籍','その他飲食店','ラーメン']
const VALID_BIKOU     = ['なし','単価8000円以上','全個室','完全予約制/コースのみ','テイクアウト専門店','ディナー営業なし','商業施設内店舗','リニューアル/移転','時間30未満','スナック/クラブ']

export async function GET(req: NextRequest) {
  const token = extractToken(req.headers.get("authorization"));
  if (!token || !verifyToken(token)) return NextResponse.json({ success: false, message: "認証が必要です" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const startDate  = searchParams.get("start") ?? "";
  const endDate    = searchParams.get("end") ?? "";
  const teamId     = searchParams.get("team") ?? "all";
  const memberName = searchParams.get("member") ?? "";

  try {
    const sql = getDb()

    // 有効値リストを SQL 配列に変換
    const jfList = VALID_JIKANFURI.map(v => `'${v.replace(/'/g, "''")}'`).join(',')
    const gnList  = VALID_GENRE.map(v => `'${v.replace(/'/g, "''")}'`).join(',')
    const bkList  = VALID_BIKOU.map(v => `'${v.replace(/'/g, "''")}'`).join(',')

    const params: unknown[] = []
    const whereExtra: string[] = []

    if (startDate) { params.push(startDate); whereExtra.push(`work_date >= $${params.length}`) }
    if (endDate)   { params.push(endDate);   whereExtra.push(`work_date <= $${params.length}`) }
    if (memberName){ params.push(memberName);whereExtra.push(`worker_name = $${params.length}`) }

    const extraClause = whereExtra.length > 0 ? `AND ${whereExtra.join(' AND ')}` : ''

    const statsRows = await sql.query(`
      WITH raw AS (
        SELECT
          regexp_replace(cd."担当者", '[0-9].*$', '') AS worker_name,
          CASE
            WHEN regexp_replace(cd."担当者", '^[^0-9]+', '') ~ '^\\d{4}'
            THEN substring(cu.uploaded_at, 1, 4) || '-' ||
                 substring(regexp_replace(cd."担当者", '^[^0-9]+', ''), 1, 2) || '-' ||
                 substring(regexp_replace(cd."担当者", '^[^0-9]+', ''), 3, 2)
            ELSE NULL
          END AS work_date,
          cu.work_hours,
          cd."架電対象フラグ",
          cd."時間振り",
          cd."席数",
          cd."ジャンル",
          cd."備考"
        FROM csv_data cd
        JOIN csv_uploads cu ON cd.upload_id = cu.id
        WHERE cd."担当者" IS NOT NULL AND cd."担当者" != ''
          AND regexp_replace(cd."担当者", '[0-9].*$', '') != ''
      )
      SELECT
        worker_name,
        work_date,
        work_hours,
        COUNT(*)                                                                 AS seisa_count,
        COUNT(CASE WHEN "架電対象フラグ" = '◎' THEN 1 END)                    AS target_count,
        COUNT(CASE WHEN
          ("時間振り" IS NULL OR "時間振り" = '') OR
          ("席数"     IS NULL OR "席数"     = '') OR
          ("ジャンル" IS NULL OR "ジャンル" = '') OR
          ("備考"     IS NULL OR "備考"     = '')
        THEN 1 END)                                                              AS missing_count,
        COUNT(CASE WHEN
          ("時間振り" IS NOT NULL AND "時間振り" != '' AND "時間振り" NOT IN (${jfList}))
          OR ("ジャンル" IS NOT NULL AND "ジャンル" != '' AND "ジャンル" NOT IN (${gnList}))
          OR ("備考"    IS NOT NULL AND "備考"    != '' AND "備考"    NOT IN (${bkList}))
        THEN 1 END)                                                              AS invalid_input_count
      FROM raw
      WHERE 1=1 ${extraClause}
      GROUP BY worker_name, work_date, work_hours
      ORDER BY work_date DESC NULLS LAST, worker_name
    `, params)

    // チーム情報を JOIN
    const workerNames = [...new Set(statsRows.map(r => String(r.worker_name)))]
    const memberRows = workerNames.length > 0
      ? await sql.query(
          `SELECT tm.name, tm.team_id, t.name AS team_name
           FROM team_members tm JOIN teams t ON t.id = tm.team_id
           WHERE tm.name = ANY($1::text[])`,
          [workerNames]
        )
      : []
    const memberMap: Record<string, { team_id: string; team_name: string }> = {}
    for (const m of memberRows) {
      memberMap[String(m.name)] = { team_id: String(m.team_id), team_name: String(m.team_name) }
    }

    // チームフィルター適用
    let rows = statsRows.map(r => ({
      worker_name:        String(r.worker_name),
      work_date:          r.work_date ? String(r.work_date) : null,
      work_hours:         r.work_hours !== null ? Number(r.work_hours) : null,
      seisa_count:        Number(r.seisa_count),
      target_count:       Number(r.target_count),
      missing_count:      Number(r.missing_count),
      invalid_input_count:Number(r.invalid_input_count),
      team_name:          memberMap[String(r.worker_name)]?.team_name ?? '未登録',
      team_id:            memberMap[String(r.worker_name)]?.team_id   ?? '',
    }))

    if (teamId !== 'all') {
      rows = rows.filter(r => r.team_id === teamId)
    }

    // 集計値を計算
    const result = rows.map(r => ({
      ...r,
      target_rate:    r.seisa_count > 0 ? ((r.target_count  / r.seisa_count) * 100).toFixed(1) : '0.0',
      missing_rate:   r.seisa_count > 0 ? ((r.missing_count / r.seisa_count) * 100).toFixed(1) : '0.0',
      per_hour:       r.work_hours && r.work_hours > 0 ? (r.seisa_count / r.work_hours).toFixed(1) : null,
    }))

    // チーム一覧
    const allTeams = workerNames.length > 0
      ? await sql.query(`SELECT id, name FROM teams ORDER BY name`)
      : []

    return NextResponse.json({ success: true, rows: result, teams: allTeams })
  } catch (e) {
    console.error("Productivity error:", e)
    return NextResponse.json({ success: false, message: String(e) }, { status: 500 })
  }
}
