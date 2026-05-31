import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyToken, extractToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const token = extractToken(request.headers.get("authorization"));
    if (!token) return NextResponse.json({ success: false, message: "認証が必要です" }, { status: 401 });
    if (!verifyToken(token)) return NextResponse.json({ success: false, message: "無効なトークンです" }, { status: 401 });

    const sql = getDb();

    // CockroachDB は VACUUM 不要（自動管理）
    const [csvCount, evercallCount] = await Promise.all([
      sql`SELECT COUNT(*) AS cnt FROM csv_data`,
      sql`SELECT COUNT(*) AS cnt FROM evercall_invested`,
    ]);

    return NextResponse.json({
      success: true,
      before: {
        csv_data: `${csvCount[0]?.cnt} rows`,
        evercall: `${evercallCount[0]?.cnt} rows`,
        db_size: "N/A (CockroachDB)",
      },
      after: {
        csv_data: `${csvCount[0]?.cnt} rows`,
        evercall: `${evercallCount[0]?.cnt} rows`,
        db_size: "N/A (CockroachDB)",
      },
      freed_mb: "0",
      note: "CockroachDB は自動でストレージを管理するため VACUUM は不要です",
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Vacuum error:", error);
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
