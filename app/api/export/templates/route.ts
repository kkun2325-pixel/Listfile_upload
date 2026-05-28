import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getExportTemplates, saveExportTemplate } from "@/lib/db";
import { verifyToken, extractToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const token = extractToken(request.headers.get("authorization"));
    if (!token) return NextResponse.json({ success: false, message: "認証が必要です" }, { status: 401 });
    if (!verifyToken(token)) return NextResponse.json({ success: false, message: "無効なトークンです" }, { status: 401 });

    const templates = await getExportTemplates();
    return NextResponse.json({
      success: true,
      templates: templates.map((t) => ({
        id: t.id,
        name: t.name,
        filters: JSON.parse(t.filters as string),
        created_at: t.created_at,
      })),
    });
  } catch (error) {
    console.error("Templates GET error:", error);
    return NextResponse.json({ success: false, message: "テンプレート取得中にエラーが発生しました" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = extractToken(request.headers.get("authorization"));
    if (!token) return NextResponse.json({ success: false, message: "認証が必要です" }, { status: 401 });
    if (!verifyToken(token)) return NextResponse.json({ success: false, message: "無効なトークンです" }, { status: 401 });

    const { name, filters } = await request.json();
    if (!name?.trim()) {
      return NextResponse.json({ success: false, message: "テンプレート名を入力してください" }, { status: 400 });
    }

    await saveExportTemplate(uuidv4(), name.trim(), JSON.stringify(filters ?? {}));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Templates POST error:", error);
    return NextResponse.json({ success: false, message: "テンプレート保存中にエラーが発生しました" }, { status: 500 });
  }
}
