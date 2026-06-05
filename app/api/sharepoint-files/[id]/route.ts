import { NextRequest, NextResponse } from "next/server";
import { verifyToken, extractToken } from "@/lib/auth";
import { updateSharepointFile, deleteSharepointFile, getSharepointFileById } from "@/lib/db";

// PUT: ファイル情報更新
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = extractToken(request.headers.get("authorization"));
    if (!token) return NextResponse.json({ success: false, message: "認証が必要です" }, { status: 401 });
    const decoded = verifyToken(token);
    if (!decoded) return NextResponse.json({ success: false, message: "無効なトークンです" }, { status: 401 });

    const existing = await getSharepointFileById(params.id);
    if (!existing) return NextResponse.json({ success: false, message: "ファイルが見つかりません" }, { status: 404 });

    const body = await request.json() as {
      name?: string;
      sharepoint_site_id?: string;
      sharepoint_file_id?: string;
      sharepoint_file_path?: string;
      sharepoint_url?: string;
      auto_sync_enabled?: number;
    };

    await updateSharepointFile(params.id, body);
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}

// DELETE: ファイル削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = extractToken(request.headers.get("authorization"));
    if (!token) return NextResponse.json({ success: false, message: "認証が必要です" }, { status: 401 });
    const decoded = verifyToken(token);
    if (!decoded) return NextResponse.json({ success: false, message: "無効なトークンです" }, { status: 401 });

    await deleteSharepointFile(params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
