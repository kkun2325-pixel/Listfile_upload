import { NextRequest, NextResponse } from "next/server";
import { verifyToken, extractToken } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const token = extractToken(req.headers.get("authorization"));
  if (!token || !verifyToken(token))
    return NextResponse.json({ success: false, message: "認証が必要です" }, { status: 401 });

  try {
    const sql = getDb();

    await sql.query(`CREATE TABLE IF NOT EXISTS export_batches (
      id TEXT PRIMARY KEY, created_at TEXT NOT NULL, created_by TEXT NOT NULL,
      members_json TEXT NOT NULL, total_count INTEGER NOT NULL DEFAULT 0
    )`);

    const batches = await sql.query(
      `SELECT * FROM export_batches ORDER BY created_at DESC LIMIT 100`
    );
    if (batches.length === 0)
      return NextResponse.json({ success: true, batches: [] });

    // バッチごとの現在のアサイン件数を取得
    const batchIds = batches.map(b => String(b.id));
    const counts = await sql.query(
      `SELECT assigned_batch, COUNT(*) AS cnt
       FROM csv_data
       WHERE assigned_batch = ANY($1::text[])
       GROUP BY assigned_batch`,
      [batchIds]
    );
    const countMap: Record<string, number> = {};
    for (const c of counts) countMap[String(c.assigned_batch)] = Number(c.cnt);

    const result = batches.map(b => ({
      id:            String(b.id),
      created_at:    String(b.created_at),
      created_by:    String(b.created_by),
      members:       JSON.parse(String(b.members_json)) as { name: string; count: number }[],
      total_count:   Number(b.total_count),
      current_count: countMap[String(b.id)] ?? 0,
    }));

    return NextResponse.json({ success: true, batches: result });
  } catch (e) {
    return NextResponse.json({ success: false, message: String(e) }, { status: 500 });
  }
}
