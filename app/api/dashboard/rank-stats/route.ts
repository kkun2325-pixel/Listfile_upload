import { NextRequest, NextResponse } from "next/server";
import { verifyToken, extractToken } from "@/lib/auth";
import { getCalculatedRankStats } from "@/lib/db";

export async function GET(request: NextRequest) {
  const token = extractToken(request.headers.get("authorization"));
  if (!token || !verifyToken(token))
    return NextResponse.json({ success: false, message: "認証が必要です" }, { status: 401 });

  try {
    const stats = await getCalculatedRankStats();
    return NextResponse.json({ success: true, ...stats });
  } catch (e) {
    console.error("rank-stats error:", e);
    return NextResponse.json({ success: false, message: String(e) }, { status: 500 });
  }
}
