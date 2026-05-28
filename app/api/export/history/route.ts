import { NextRequest, NextResponse } from "next/server";
import { getExportHistory } from "@/lib/db";
import { verifyToken, extractToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const token = extractToken(request.headers.get("authorization"));
    if (!token) return NextResponse.json({ success: false, message: "認証が必要です" }, { status: 401 });
    if (!verifyToken(token)) return NextResponse.json({ success: false, message: "無効なトークンです" }, { status: 401 });

    const history = await getExportHistory();
    return NextResponse.json({ success: true, history });
  } catch (error) {
    console.error("History GET error:", error);
    return NextResponse.json({ success: false, message: "履歴取得中にエラーが発生しました" }, { status: 500 });
  }
}
