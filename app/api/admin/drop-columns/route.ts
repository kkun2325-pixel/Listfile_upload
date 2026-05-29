import { NextRequest, NextResponse } from "next/server";
import { verifyToken, extractToken } from "@/lib/auth";

// SQLite/Tursoではカラム削除は不要（新規スキーマで作成済み）
export async function POST(request: NextRequest) {
  const token = extractToken(request.headers.get("authorization"));
  if (!token) return NextResponse.json({ success: false, message: "認証が必要です" }, { status: 401 });
  if (!verifyToken(token)) return NextResponse.json({ success: false, message: "無効なトークンです" }, { status: 401 });

  return NextResponse.json({
    success: true,
    message: "Turso/SQLiteでは不要な操作です。新規スキーマでは削除済みカラムは存在しません。",
  });
}
