import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { verifyToken, extractToken } from "@/lib/auth";
import { getSharepointFiles, createSharepointFile } from "@/lib/db";

// GET: 登録済みファイル一覧
export async function GET(request: NextRequest) {
  try {
    const token = extractToken(request.headers.get("authorization"));
    if (!token) return NextResponse.json({ success: false, message: "認証が必要です" }, { status: 401 });
    const decoded = verifyToken(token);
    if (!decoded) return NextResponse.json({ success: false, message: "無効なトークンです" }, { status: 401 });

    const files = await getSharepointFiles();
    return NextResponse.json({ success: true, files });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}

// POST: 新規ファイル登録
export async function POST(request: NextRequest) {
  try {
    const token = extractToken(request.headers.get("authorization"));
    if (!token) return NextResponse.json({ success: false, message: "認証が必要です" }, { status: 401 });
    const decoded = verifyToken(token);
    if (!decoded) return NextResponse.json({ success: false, message: "無効なトークンです" }, { status: 401 });

    const body = await request.json() as {
      name?: string;
      sharepoint_site_id?: string;
      sharepoint_file_id?: string;
      sharepoint_file_path?: string;
      sharepoint_url?: string;
      auto_sync_enabled?: number;
    };

    if (!body.name?.trim()) {
      return NextResponse.json({ success: false, message: "表示名を入力してください" }, { status: 400 });
    }
    if (!body.sharepoint_site_id?.trim()) {
      return NextResponse.json({ success: false, message: "サイトIDを入力してください" }, { status: 400 });
    }
    if (!body.sharepoint_file_id?.trim() && !body.sharepoint_file_path?.trim()) {
      return NextResponse.json({ success: false, message: "ファイルIDまたはファイルパスを入力してください" }, { status: 400 });
    }

    const id = uuidv4();
    await createSharepointFile({
      id,
      name:                 body.name.trim(),
      sharepoint_site_id:   body.sharepoint_site_id.trim(),
      sharepoint_file_id:   body.sharepoint_file_id?.trim(),
      sharepoint_file_path: body.sharepoint_file_path?.trim(),
      sharepoint_url:       body.sharepoint_url?.trim(),
      auto_sync_enabled:    body.auto_sync_enabled ?? 1,
      created_by:           decoded.userId,
    });

    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
