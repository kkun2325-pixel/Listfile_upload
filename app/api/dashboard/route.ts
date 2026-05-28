import { NextRequest, NextResponse } from "next/server";
import { getDashboardStatsV2, RESULT_RANK_LABELS, LIST_RANK_LABELS } from "@/lib/db";
import { verifyToken, extractToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const token = extractToken(request.headers.get("authorization"));
    if (!token) {
      return NextResponse.json({ success: false, message: "認証が必要です" }, { status: 401 });
    }
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, message: "無効なトークンです" }, { status: 401 });
    }

    const stats = await getDashboardStatsV2();

    return NextResponse.json({
      success: true,
      stats,
      result_rank_labels: RESULT_RANK_LABELS,
      list_rank_labels:   LIST_RANK_LABELS,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json(
      { success: false, message: "ダッシュボードデータ取得中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
