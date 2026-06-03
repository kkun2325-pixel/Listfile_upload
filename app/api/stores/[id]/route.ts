import { NextRequest, NextResponse } from "next/server";
import { verifyToken, extractToken } from "@/lib/auth";
import { getDb } from "@/lib/db";

// 編集可能フィールドのホワイトリスト
const EDITABLE = new Set(["名前", "電話番号", "住所1", "住所2", "時間振り", "定休日", "席数", "ジャンル", "備考", "担当者"]);
// 精査データ変更フラグを立てるフィールド
const DATA_CHANGE = new Set(["時間振り", "定休日", "席数", "ジャンル", "備考"]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = extractToken(req.headers.get("authorization"));
  if (!token || !verifyToken(token))
    return NextResponse.json({ success: false, message: "認証が必要です" }, { status: 401 });

  try {
    const body    = await req.json();
    const updates: [string, string | null][] = Object.entries(body as Record<string, unknown>)
      .filter(([key]) => EDITABLE.has(key))
      .map(([key, val]) => [key, val === "" ? null : String(val ?? "")]);

    if (updates.length === 0)
      return NextResponse.json({ success: false, message: "更新フィールドがありません" }, { status: 400 });

    const sql = getDb();
    const setClauses: string[] = [];
    const args: unknown[] = [];
    let i = 1;

    for (const [key, val] of updates) {
      setClauses.push(`"${key}" = $${i}`);
      args.push(val);
      i++;
    }

    // 精査関連フィールドを更新した場合は is_data_changed = 1 に設定
    if (updates.some(([key]) => DATA_CHANGE.has(key))) {
      setClauses.push(`is_data_changed = 1`);
    }

    setClauses.push(`updated_at = $${i}`);
    args.push(new Date().toISOString());
    i++;

    args.push(params.id);

    await sql.query(
      `UPDATE csv_data SET ${setClauses.join(", ")} WHERE id = $${i}`,
      args
    );

    // 更新後の行を返す
    const updated = await sql.query(
      `SELECT id, "名前", "電話番号", "住所1", "住所2",
              "時間振り", "定休日", "席数", "ジャンル", "備考", "担当者"
       FROM csv_data WHERE id = $1`,
      [params.id]
    );

    return NextResponse.json({ success: true, store: updated[0] ?? null });
  } catch (e) {
    return NextResponse.json({ success: false, message: String(e) }, { status: 500 });
  }
}
