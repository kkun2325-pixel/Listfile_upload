import { NextRequest, NextResponse } from "next/server";
import { getAllCSVUploadsWithUsers, getFillCountPerUpload } from "@/lib/db";
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

    const uploads = await getAllCSVUploadsWithUsers();
    const uploadIds = uploads.map((u: Record<string, unknown>) => u.id as string);
    const fillCounts = await getFillCountPerUpload(uploadIds);

    const result = uploads.map((u: Record<string, unknown>) => ({
      id:               u.id,
      username:         u.username,
      original_filename: u.original_filename,
      row_count:        Number(u.row_count),
      inserted_count:   Number(u.inserted_count ?? 0),
      updated_count:    Number(u.updated_count  ?? 0),
      fill_count:       fillCounts[u.id as string] ?? 0,
      uploaded_at:      u.uploaded_at,
      status:           u.status,
      work_hours:       u.work_hours != null ? Number(u.work_hours) : null,
      worker_name:      u.worker_name  ?? null,
      report_date:      u.report_date  ?? null,
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
