import { NextRequest, NextResponse } from "next/server";
import { getCallAnalysisList, getCallAnalysisDetail } from "@/lib/db";
import { verifyToken, extractToken } from "@/lib/auth";

// GET /api/call-analysis?q=...&page=1&sortBy=total_calls&sortDir=desc
// GET /api/call-analysis?phone=0312345678  → 詳細
export async function GET(request: NextRequest) {
  try {
    const token = extractToken(request.headers.get("authorization"));
    if (!token || !verifyToken(token))
      return NextResponse.json({ success: false, message: "認証が必要です" }, { status: 401 });

    const sp    = request.nextUrl.searchParams;
    const phone = sp.get("phone");

    // 詳細モード
    if (phone) {
      const detail = await getCallAnalysisDetail(phone);
      return NextResponse.json({ success: true, ...detail });
    }

    // 一覧モード
    const result = await getCallAnalysisList({
      q:        sp.get("q")        ?? "",
      page:     parseInt(sp.get("page")    ?? "1") || 1,
      pageSize: parseInt(sp.get("pageSize") ?? "50") || 50,
      sortBy:   sp.get("sortBy")   ?? "total_calls",
      sortDir:  sp.get("sortDir")  === "asc" ? "asc" : "desc",
    });

    return NextResponse.json({
      success: true,
      rows:       result.rows,
      total:      result.total,
      totalPages: Math.ceil(result.total / 50),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("call-analysis error:", error);
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
