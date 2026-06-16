import { NextRequest, NextResponse } from "next/server";
import { verifyToken, extractToken } from "@/lib/auth";
import { getDb } from "@/lib/db";

function auth(req: NextRequest) {
  const token = extractToken(req.headers.get("authorization"));
  const payload = token ? verifyToken(token) : null;
  return payload?.role === "manager" ? payload : null;
}

// GET: 削除対象件数プレビュー
export async function GET(req: NextRequest) {
  if (!auth(req))
    return NextResponse.json({ success: false, message: "権限がありません" }, { status: 403 });

  try {
    const sql = getDb();
    const r = await sql`SELECT COUNT(*) AS cnt FROM csv_data`;
    return NextResponse.json({ success: true, count: Number(r[0]?.cnt ?? 0) });
  } catch (e) {
    return NextResponse.json({ success: false, message: String(e) }, { status: 500 });
  }
}

// DELETE: csv_data 全削除（再アップロード前のリセット用）
export async function DELETE(req: NextRequest) {
  if (!auth(req))
    return NextResponse.json({ success: false, message: "権限がありません" }, { status: 403 });

  try {
    const sql = getDb();
    const deleted = await sql`DELETE FROM csv_data RETURNING id`;
    return NextResponse.json({
      success: true,
      deleted: deleted.length,
      message: `${deleted.length}件のデータを削除しました。マスターCSVを再アップロードしてください。`,
    });
  } catch (e) {
    return NextResponse.json({ success: false, message: String(e) }, { status: 500 });
  }
}
