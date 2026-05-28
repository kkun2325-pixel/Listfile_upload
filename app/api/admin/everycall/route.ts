import { NextRequest, NextResponse } from "next/server";
import { bulkInsertEverycallInvested, getEverycallInvestedStats } from "@/lib/db";
import { verifyToken, extractToken } from "@/lib/auth";

// GET: グループ別投入済み件数を返す
export async function GET(request: NextRequest) {
  try {
    const token = extractToken(request.headers.get("authorization"));
    if (!token) return NextResponse.json({ success: false, message: "認証が必要です" }, { status: 401 });
    if (!verifyToken(token)) return NextResponse.json({ success: false, message: "無効なトークンです" }, { status: 401 });

    const stats = await getEverycallInvestedStats();
    return NextResponse.json({ success: true, stats });
  } catch (error) {
    console.error("Everycall GET error:", error);
    return NextResponse.json({ success: false, message: "統計取得中にエラーが発生しました" }, { status: 500 });
  }
}

// POST: 電話番号リストをバルクインサート
// Body: { phone_numbers: string[], list_group: string, invested_at: string }
export async function POST(request: NextRequest) {
  try {
    const token = extractToken(request.headers.get("authorization"));
    if (!token) return NextResponse.json({ success: false, message: "認証が必要です" }, { status: 401 });
    if (!verifyToken(token)) return NextResponse.json({ success: false, message: "無効なトークンです" }, { status: 401 });

    const body = await request.json();
    const { phone_numbers, list_group, invested_at } = body as {
      phone_numbers: string[];
      list_group: string;
      invested_at: string;
    };

    if (!phone_numbers || !Array.isArray(phone_numbers) || phone_numbers.length === 0) {
      return NextResponse.json({ success: false, message: "電話番号リストが空です" }, { status: 400 });
    }
    if (!list_group) {
      return NextResponse.json({ success: false, message: "list_group が未指定です" }, { status: 400 });
    }
    if (!invested_at) {
      return NextResponse.json({ success: false, message: "invested_at が未指定です" }, { status: 400 });
    }

    const result = await bulkInsertEverycallInvested(phone_numbers, list_group, invested_at);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Everycall POST error:", error);
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
