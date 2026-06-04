import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { getDb } from "@/lib/db";
import { verifyToken, extractToken } from "@/lib/auth";

// ── コール結果/ステータス → 結果ランク マッピング ──────────

function coreSuffix(s: string): string {
  const t = s.trim()
  const i = t.lastIndexOf('：')
  return i >= 0 ? t.slice(i + 1).trim() : t
}

export function getResultRank(callResult: string, status: string): number {
  const result = callResult.trim()
  const statCore = coreSuffix(status)
  const resultCore = coreSuffix(result)

  // ステータス優先（プレフィックス除去後のコアで判定）
  if (statCore === '受注')     return 9
  if (statCore === '有効拒否') return 6
  if (statCore === 'フル拒否') return 7
  if (statCore === '決裁者拒否') return 5
  if (statCore === 'AF切')    return 8

  // SKIP系 → 1
  if (result === '自動SKIP' || result === 'SKIP') return 1

  // コール結果 suffix による判定
  if (resultCore.includes('留守') || result === '不在') return 1
  if (['現アナ', '他社', '対象外', '閉業', '本社管理', '決裁者不在'].includes(resultCore)) return 10
  if (resultCore.includes('非決')) return 3
  if (resultCore === '入口ガチャ') return 4

  // 見込み後（フォローアップで未進展）→ 1
  if (result.includes('見込み後') || result.includes('見込後')) return 1

  // 見込 → 2
  if (result.includes('見込')) return 2

  // 即時（単体）→ 1
  if (result === '即時') return 1

  return 1
}

// ── グループ → 更新カラム ────────────────────────────────

const GROUP_COLUMN: Record<string, string> = {
  '飲食SH':    '飲食SH最大進捗',
  'サイネージ': 'サイネ',
  'デリバリー': 'デリバリー最大進捗',
  'ペイメント': 'ペイメント_コール履歴',
}

// ── POST: コール履歴CSV取り込み ──────────────────────────

export async function POST(request: NextRequest) {
  try {
    const token = extractToken(request.headers.get("authorization"))
    const payload = token ? verifyToken(token) : null
    if (!payload) return NextResponse.json({ success: false, message: "認証が必要です" }, { status: 401 })
    if (payload.role !== "manager") return NextResponse.json({ success: false, message: "アクセス権限がありません" }, { status: 403 })

    const formData = await request.formData()
    const file      = formData.get("file")      as File   | null
    const listGroup = (formData.get("listGroup") as string | null)?.trim() ?? ""

    if (!file)                  return NextResponse.json({ success: false, message: "ファイルが必要です" },        { status: 400 })
    if (!GROUP_COLUMN[listGroup]) return NextResponse.json({ success: false, message: "リストグループが無効です" }, { status: 400 })

    // BOM除去してPapaParseで解析
    const text   = await file.text()
    const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ''), {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
    })

    // 電話番号 → 最大ランク を集計
    const phoneRankMap = new Map<string, number>()
    for (const row of parsed.data) {
      const phone = (row['電話番号'] ?? '').trim()
      if (!phone || !/^\d/.test(phone)) continue
      const rank = getResultRank(row['コール結果'] ?? '', row['ステータス'] ?? '')
      const cur  = phoneRankMap.get(phone) ?? 0
      if (rank > cur) phoneRankMap.set(phone, rank)
    }

    if (phoneRankMap.size === 0) {
      return NextResponse.json({ success: false, message: "有効な電話番号が見つかりませんでした" }, { status: 400 })
    }

    const column = GROUP_COLUMN[listGroup]
    const db     = getDb()
    const phones = Array.from(phoneRankMap.keys())
    const ranks  = Array.from(phoneRankMap.values())

    // グループ別カラムを更新（既存値より大きい場合のみ）
    await db.query(`
      UPDATE csv_data
      SET "${column}" = t.rank::text
      FROM unnest($1::text[], $2::integer[]) AS t(phone, rank)
      WHERE csv_data."電話番号" = t.phone
        AND COALESCE(NULLIF(csv_data."${column}", ''), '0')::INTEGER < t.rank
    `, [phones, ranks])

    // 全体最大進捗を再計算
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

    return NextResponse.json({
      success: true,
      listGroup,
      phoneCount: phoneRankMap.size,
      rowCount:   parsed.data.length,
      message:    `${phoneRankMap.size.toLocaleString()} 件の電話番号を処理しました（CSVレコード: ${parsed.data.length.toLocaleString()} 件）`,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("import-call-history error:", error)
    return NextResponse.json({ success: false, message: msg }, { status: 500 })
  }
}
