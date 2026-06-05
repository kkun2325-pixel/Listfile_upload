import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { getDb, bulkInsertCallRecords, type CallRecord } from "@/lib/db";
import { verifyToken, extractToken } from "@/lib/auth";

// ── コール結果/ステータス → 結果ランク ──────────────────────

function coreSuffix(s: string): string {
  const t = s.trim()
  const i = t.lastIndexOf('：')
  return i >= 0 ? t.slice(i + 1).trim() : t
}

function getResultRank(callResult: string, status: string): number {
  const result   = callResult.trim()
  const statCore = coreSuffix(status)
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

function isSkip(callResult: string): boolean {
  const r = callResult.trim()
  return r === '自動SKIP' || r === 'SKIP'
}

// コール日時をパース（YY/MM/DD HH:MM:SS → 曜日・時刻）
// 0=月, 1=火, 2=水, 3=木, 4=金, 5=土, 6=日
function parseCallDatetime(dtStr: string): { dayOfWeek: number; hour: number } | null {
  const m = dtStr.trim().match(/^(\d{2})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})/)
  if (!m) return null
  const [, yy, mm, dd, hh] = m
  const date = new Date(`20${yy}-${mm}-${dd}T${hh}:00:00`)
  if (isNaN(date.getTime())) return null
  const jsDow = date.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
  const jpDow = jsDow === 0 ? 6 : jsDow - 1 // 0=月 ... 6=日
  return { dayOfWeek: jpDow, hour: parseInt(hh, 10) }
}

// ── グループ → カラム ────────────────────────────────────────

const GROUP_COLUMN: Record<string, string> = {
  '飲食SH':    '飲食SH最大進捗',
  'サイネージ': 'サイネ',
  'デリバリー': 'デリバリー最大進捗',
  'ペイメント': 'ペイメント_コール履歴',
}

// ── POST ──────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const token   = extractToken(request.headers.get("authorization"))
    const payload = token ? verifyToken(token) : null
    if (!payload)              return NextResponse.json({ success: false, message: "認証が必要です" },        { status: 401 })
    if (payload.role !== "manager") return NextResponse.json({ success: false, message: "アクセス権限がありません" }, { status: 403 })

    const formData  = await request.formData()
    const file      = formData.get("file")      as File   | null
    const listGroup = (formData.get("listGroup") as string | null)?.trim() ?? ""

    if (!file)                    return NextResponse.json({ success: false, message: "ファイルが必要です" },        { status: 400 })
    if (!GROUP_COLUMN[listGroup]) return NextResponse.json({ success: false, message: "リストグループが無効です" }, { status: 400 })

    const text   = await file.text()
    const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ''), {
      header: true, skipEmptyLines: true, dynamicTyping: false,
    })

    // ── 1. 電話番号 → 最大ランク（既存機能）──────────────────
    const phoneRankMap = new Map<string, number>()
    // ── 2. call_records 用個別レコード ──────────────────────
    const callRecords: CallRecord[] = []

    for (const row of parsed.data) {
      const phone      = (row['電話番号'] ?? '').trim()
      const callResult = (row['コール結果'] ?? '').trim()
      const status     = (row['ステータス'] ?? '').trim()
      const dtStr      = (row['コール日時'] ?? '').trim()
      const agent      = (row['ユーザー']   ?? '').trim()

      if (!phone || !/^\d/.test(phone)) continue

      const rank = getResultRank(callResult, status)

      // 最大進捗更新
      const cur = phoneRankMap.get(phone) ?? 0
      if (rank > cur) phoneRankMap.set(phone, rank)

      // 自動SKIP / SKIP は call_records に保存しない
      if (isSkip(callResult)) continue

      const dt = parseCallDatetime(dtStr)
      callRecords.push({
        phone_number: phone,
        list_group:   listGroup,
        call_datetime: dtStr || undefined,
        day_of_week:  dt?.dayOfWeek,
        hour:         dt?.hour,
        call_result:  callResult || undefined,
        status:       status,
        agent:        agent || undefined,
        result_rank:  rank,
      })
    }

    if (phoneRankMap.size === 0) {
      return NextResponse.json({ success: false, message: "有効な電話番号が見つかりませんでした" }, { status: 400 })
    }

    const column = GROUP_COLUMN[listGroup]
    const db     = getDb()
    const phones = Array.from(phoneRankMap.keys())
    const ranks  = Array.from(phoneRankMap.values())

    // ── 3. csv_data の最大進捗を更新 ────────────────────────
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

    // ── 4. call_records に個別レコードを保存 ────────────────
    const recordsInserted = await bulkInsertCallRecords(callRecords)

    return NextResponse.json({
      success: true,
      listGroup,
      phoneCount:      phoneRankMap.size,
      rowCount:        parsed.data.length,
      recordsInserted,
      message: `${phoneRankMap.size.toLocaleString()} 件の電話番号を処理（架電記録 ${recordsInserted.toLocaleString()} 件保存）`,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("import-call-history error:", error)
    return NextResponse.json({ success: false, message: msg }, { status: 500 })
  }
}
