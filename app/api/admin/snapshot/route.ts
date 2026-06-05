import { NextRequest, NextResponse } from "next/server";
import { takeRankSnapshot, getRankHistory } from "@/lib/db";
import { verifyToken, extractToken } from "@/lib/auth";

// GET: スナップショット履歴を返す
export async function GET(request: NextRequest) {
  try {
    const token = extractToken(request.headers.get("authorization"));
    if (!token || !verifyToken(token)) {
      return NextResponse.json({ success: false, message: "認証が必要です" }, { status: 401 });
    }
    const history = await getRankHistory();
    return NextResponse.json({ success: true, history });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}

// POST: 今日のスナップショットを取得
export async function POST(request: NextRequest) {
  try {
    const token = extractToken(request.headers.get("authorization"));
    const payload = token ? verifyToken(token) : null;
    if (!payload) return NextResponse.json({ success: false, message: "認証が必要です" }, { status: 401 });
    if (payload.role !== "manager") return NextResponse.json({ success: false, message: "アクセス権限がありません" }, { status: 403 });

    const result = await takeRankSnapshot();
    return NextResponse.json({ success: true, ...result, message: `${result.date} のスナップショットを保存しました（ランク${result.ranks}種）` });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
