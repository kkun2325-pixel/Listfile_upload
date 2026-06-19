import { NextRequest, NextResponse } from "next/server";
import { getDb, bulkInsertCallRecords, type CallRecord } from "@/lib/db";
import { verifyToken, extractToken } from "@/lib/auth";

// ── コール結果/ステータス → 結果ランク ──────────────────────

function coreSuffix(s: string): string {
  const t = s.trim()
  const i = t.lastIndexOf('：')
  return i >= 0 ? t.slice(i + 1).trim() : t
}

function getResultRank(callResult: string, status: string): number {
  const result    = callResult.trim()
  const statCore  = coreSuffix(status)
  const resultCore = coreSuffix(result)

  if (statCore === '受注')       return 9
  if (statCore === '有効拒否')   return 6
  if (statCore === 'フル拒否')   return 7
  if (statCore === '決裁者拒否') return 5
  if (statCore === 'AF切')       return 8

  if (result === '自動SKIP' || result === 'SKIP') return 1
  if (resultCore.includes('留守') || result === '不在') return 1
  if (['現アナ', '他社', '対象外', '閉業', '本社管理', '決裁者不在'].includes(resultCore)) return 10
  if (resultCore.includes('非決')) return 3
  if (resultCore === '入口ガチャ') return 4
  if (result.includes('見込み後') || result.includes('見込後')) return 1
  if (result.includes('見込')) return 2
  if (result === '即時') return 1
  return 1
}

// コール日時パース（YY/MM/DD HH:MM:SS → 曜日・時刻）
// 0=月,1=火,2=水,3=木,4=金,5=土,6=日
function parseCallDatetime(dtStr: string): { dayOfWeek: number; hour: number } | null {
  const m = dtStr.trim().match(/^(\d{2})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})/)
  if (!m) return null
  const [, yy, mm, dd, hh] = m
  const date = new Date(`20${yy}-${mm}-${dd}T${hh}:00:00`)
  if (isNaN(date.getTime())) return null
  const jsDow = date.getDay()
  const jpDow = jsDow === 0 ? 6 : jsDow - 1
  return { dayOfWeek: jpDow, hour: parseInt(hh, 10) }
}

const GROUP_COLUMN: Record<string, string> = {
  '飲食SH':    '飲食SH最大進捗',
  'サイネージ': 'サイネ',
  'デリバリー': 'デリバリー最大進捗',
  'ペイメント': 'ペイメント_コール履歴',
}

// ── POST: バッチJSON受信 ──────────────────────────────────────
// Body: { listGroup, rows: [{phone, callResult, status, callDatetime, agent}] }

export async function POST(request: NextRequest) {
  try {
    const token   = extractToken(request.headers.get("authorization"))
    const payload = token ? verifyToken(token) : null
    if (!payload)                  return NextResponse.json({ success: false, message: "認証が必要です" },        { status: 401 })
    if (payload.role !== "manager") return NextResponse.json({ success: false, message: "アクセス権限がありません" }, { status: 403 })

    const body = await request.json() as {
      listGroup: string
      rows: Array<{ phone: string; callResult: string; status: string; callDatetime: string; agent: string }>
    }

    const { listGroup, rows } = body
    if (!listGroup || !GROUP_COLUMN[listGroup]) {
      return NextResponse.json({ success: false, message: "リストグループが無効です" }, { status: 400 })
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ success: false, message: "データが空です" }, { status: 400 })
    }

    // ── 1. ランク計算・日時パース ────────────────────────────
    const phoneRankMap  = new Map<string, number>()
    const callRecords:  CallRecord[] = []

    for (const row of rows) {
      const phone      = (row.phone       ?? '').trim()
      const callResult = (row.callResult  ?? '').trim()
      const status     = (row.status      ?? '').trim()
      const dtStr      = (row.callDatetime ?? '').trim()
      const agent      = (row.agent       ?? '').trim()

      if (!phone || !/^\d/.test(phone)) continue

      const rank = getResultRank(callResult, status)

      const cur = phoneRankMap.get(phone) ?? 0
      if (rank > cur) phoneRankMap.set(phone, rank)

      const dt = parseCallDatetime(dtStr)
      callRecords.push({
        phone_number:  phone,
        list_group:    listGroup,
        call_datetime: dtStr || undefined,
        day_of_week:   dt?.dayOfWeek,
        hour:          dt?.hour,
        call_result:   callResult || undefined,
        status,
        agent:         agent || undefined,
        result_rank:   rank,
      })
    }

    if (phoneRankMap.size === 0) {
      return NextResponse.json({ success: false, message: "有効な電話番号が見つかりませんでした" }, { status: 400 })
    }

    const column = GROUP_COLUMN[listGroup]
    const db     = getDb()
    const phones = Array.from(phoneRankMap.keys())
    const ranks  = Array.from(phoneRankMap.values())

    // ── 2. csv_data の最大進捗を更新 ──────────────────────────
    await db.query(`
      UPDATE csv_data SET "${column}" = t.rank::text
      FROM unnest($1::text[], $2::integer[]) AS t(phone, rank)
      WHERE csv_data."電話番号" = t.phone
        AND COALESCE(NULLIF(csv_data."${column}", ''), '0')::INTEGER < t.rank
    `, [phones, ranks])

    await db.query(`
      UPDATE csv_data
      SET "最大進捗" = GREATEST(
        COALESCE(NULLIF("飲食SH最大進捗",     ''), '0')::INTEGER,
        COALESCE(NULLIF("サイネ",             ''), '0')::INTEGER,
        COALESCE(NULLIF("デリバリー最大進捗", ''), '0')::INTEGER,
        COALESCE(NULLIF("ペイメント_コール履歴",''), '0')::INTEGER
      )::text
      WHERE "電話番号" = ANY($1::text[])
    `, [phones])

    // ── 3. call_records に個別レコードを保存 ──────────────────
    const recordsInserted = await bulkInsertCallRecords(callRecords)

    return NextResponse.json({
      success: true,
      phoneCount:      phoneRankMap.size,
      recordsInserted,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("import-call-history error:", error)
    return NextResponse.json({ success: false, message: msg }, { status: 500 })
  }
}
