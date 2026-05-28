import { NextRequest, NextResponse } from "next/server";
import { deleteExportTemplate } from "@/lib/db";
import { verifyToken, extractToken } from "@/lib/auth";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = extractToken(request.headers.get("authorization"));
    if (!token) return NextResponse.json({ success: false, message: "認証が必要です" }, { status: 401 });
    if (!verifyToken(token)) return NextResponse.json({ success: false, message: "無効なトークンです" }, { status: 401 });

    await deleteExportTemplate(params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Template DELETE error:", error);
    return NextResponse.json({ success: false, message: "テンプレート削除中にエラーが発生しました" }, { status: 500 });
  }
}
