import { NextRequest, NextResponse } from "next/server";
import { getAllCSVUploadsWithUsers, getFillCountPerUpload } from "@/lib/db";
import { verifyToken, extractToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const token = extractToken(request.headers.get("authorization"));
    if (!token) {
      return NextResponse.json(
        { success: false, message: "認証が必要です" },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { success: false, message: "無効なトークンです" },
        { status: 401 }
      );
    }

    // 全アップロード取得（ユーザー名JOIN）
    const uploads = await getAllCSVUploadsWithUsers();

    // 充填数（非空セル数）を一括取得
    const uploadIds = uploads.map((u: any) => u.id);
    const fillCounts = await getFillCountPerUpload(uploadIds);

    const result = uploads.map((u: any) => ({
      id: u.id,
      username: u.username,
      original_filename: u.original_filename,
      row_count: Number(u.row_count),
      fill_count: fillCounts[u.id] ?? 0,
      uploaded_at: u.uploaded_at,
      status: u.status,
    }));

    return NextResponse.json({ success: true, uploads: result }, { status: 200 });
  } catch (error) {
    console.error("History fetch error:", error);
    return NextResponse.json(
      { success: false, message: "履歴取得中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
