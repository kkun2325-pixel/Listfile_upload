import { NextRequest, NextResponse } from "next/server";
import { verifyToken, extractToken } from "@/lib/auth";
import { getDb } from "@/lib/db";

// 名前・電話番号・住所1・住所2 がすべて空のレコードが対象
const WHERE = `
  ("名前"    IS NULL OR "名前"    = '') AND
  ("電話番号" IS NULL OR "電話番号" = '') AND
  ("住所1"   IS NULL OR "住所1"   = '') AND
  ("住所2"   IS NULL OR "住所2"   = '')
`;

function auth(req: NextRequest) {
  const token = extractToken(req.headers.get("authorization"));
  const payload = token ? verifyToken(token) : null;
  return payload?.role === "manager" ? payload : null;
}

// GET: 対象件数プレビュー
export async function GET(req: NextRequest) {
  if (!auth(req))
    return NextResponse.json({ success: false, message: "権限がありません" }, { status: 403 });

  try {
    const sql = getDb();
    const r = await sql.query(`SELECT COUNT(*) AS cnt FROM csv_data WHERE ${WHERE}`);
    return NextResponse.json({ success: true, count: Number(r[0]?.cnt ?? 0) });
  } catch (e) {
    return NextResponse.json({ success: false, message: String(e) }, { status: 500 });
  }
}

// DELETE: 実際に削除
export async function DELETE(req: NextRequest) {
  if (!auth(req))
    return NextResponse.json({ success: false, message: "権限がありません" }, { status: 403 });

  try {
    const sql = getDb();
    const deleted = await sql.query(
      `DELETE FROM csv_data WHERE ${WHERE} RETURNING id`
    );
    return NextResponse.json({ success: true, deleted: deleted.length });
  } catch (e) {
    return NextResponse.json({ success: false, message: String(e) }, { status: 500 });
  }
}
