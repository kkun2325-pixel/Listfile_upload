import { NextRequest, NextResponse } from "next/server";
import { verifyToken, extractToken } from "@/lib/auth";
import { getDb } from "@/lib/db";

const PAGE_SIZE = 50;

// ソート可能カラムのホワイトリスト（SQLインジェクション防止）
const SORT_COLS = new Set(["名前", "電話番号", "住所1", "住所2", "時間振り", "定休日", "席数", "ジャンル", "備考", "担当者"]);

export async function GET(req: NextRequest) {
  const token = extractToken(req.headers.get("authorization"));
  if (!token || !verifyToken(token))
    return NextResponse.json({ success: false, message: "認証が必要です" }, { status: 401 });

  const sp       = req.nextUrl.searchParams;
  const q        = sp.get("q")?.trim() ?? "";
  const rawSort  = sp.get("sortBy") ?? "名前";
  const sortBy   = SORT_COLS.has(rawSort) ? rawSort : "名前";
  const sortDir  = sp.get("sortOrder") === "desc" ? "DESC" : "ASC";
  const page     = Math.max(1, parseInt(sp.get("page") ?? "1") || 1);
  const offset   = (page - 1) * PAGE_SIZE;

  try {
    const sql = getDb();
    const args: unknown[] = [];
    let paramIdx = 1;
    const conditions: string[] = [];

    if (q) {
      conditions.push(`(
        "名前"    ILIKE $${paramIdx} OR
        "電話番号" ILIKE $${paramIdx} OR
        "住所1"   ILIKE $${paramIdx} OR
        "住所2"   ILIKE $${paramIdx} OR
        "担当者"  ILIKE $${paramIdx}
      )`);
      args.push(`%${q}%`);
      paramIdx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const [countRes, stores] = await Promise.all([
      sql.query(`SELECT COUNT(*) AS total FROM csv_data ${where}`, args),
      sql.query(
        `SELECT id, "名前", "電話番号", "住所1", "住所2",
                "時間振り", "定休日", "席数", "ジャンル", "備考", "担当者"
         FROM csv_data
         ${where}
         ORDER BY "${sortBy}" ${sortDir} NULLS LAST
         LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        [...args, PAGE_SIZE, offset]
      ),
    ]);

    const total = Number(countRes[0]?.total ?? 0);

    return NextResponse.json({
      success: true,
      stores,
      total,
      page,
      totalPages: Math.ceil(total / PAGE_SIZE),
      pageSize: PAGE_SIZE,
    });
  } catch (e) {
    return NextResponse.json({ success: false, message: String(e) }, { status: 500 });
  }
}
