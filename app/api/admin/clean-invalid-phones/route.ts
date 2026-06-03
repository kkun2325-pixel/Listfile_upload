import { NextRequest, NextResponse } from "next/server";
import { verifyToken, extractToken } from "@/lib/auth";
import { getDb } from "@/lib/db";

// "20000" で始まる 10桁の電話番号
const PATTERN = `^20000[0-9]{5}$`;

function auth(req: NextRequest) {
  const token = extractToken(req.headers.get("authorization"));
  const payload = token ? verifyToken(token) : null;
  return payload?.role === "manager" ? payload : null;
}

// GET: 対象件数のプレビュー
export async function GET(req: NextRequest) {
  if (!auth(req))
    return NextResponse.json({ success: false, message: "権限がありません" }, { status: 403 });

  try {
    const sql = getDb();
    const [countRes, sampleRes] = await Promise.all([
      sql.query(`SELECT COUNT(*) AS cnt FROM csv_data WHERE "電話番号" ~ $1`, [PATTERN]),
      sql.query(`SELECT "電話番号" FROM csv_data WHERE "電話番号" ~ $1 ORDER BY "電話番号" LIMIT 10`, [PATTERN]),
    ]);
    return NextResponse.json({
      success: true,
      count:   Number(countRes[0]?.cnt ?? 0),
      samples: sampleRes.map(r => String(r["電話番号"])),
    });
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
      `DELETE FROM csv_data WHERE "電話番号" ~ $1 RETURNING id`,
      [PATTERN]
    );
    return NextResponse.json({ success: true, deleted: deleted.length });
  } catch (e) {
    return NextResponse.json({ success: false, message: String(e) }, { status: 500 });
  }
}
