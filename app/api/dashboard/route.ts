import { NextRequest, NextResponse } from "next/server";
import { getDashboardStatsAll, getAllDataPreview } from "@/lib/db";
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

    const [stats, preview] = await Promise.all([
      getDashboardStatsAll(),
      getAllDataPreview(20),
    ]);

    const seisa_rate =
      stats.total > 0
        ? parseFloat(((stats.seisa_count / stats.total) * 100).toFixed(1))
        : 0;

    const pie_data = [
      { name: "時間振り済み", value: stats.seisa_count,   color: "#2563eb" },
      { name: "未時間振り",   value: stats.unseisa_count, color: "#d1d5db" },
    ].filter((d) => d.value > 0);

    return NextResponse.json({
      success: true,
      stats: { ...stats, seisa_rate },
      pie_data,
      preview,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json(
      { success: false, message: "ダッシュボードデータ取得中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
