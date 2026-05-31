import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { verifyToken, extractToken } from "@/lib/auth";
import { cleanseSeats } from "@/lib/csv";

type SqlFn = { query: (q: string, p?: unknown[]) => Promise<Record<string, unknown>[]> }

// GET: 対象件数のプレビュー（更新なし）
export async function GET(request: NextRequest) {
  const token = extractToken(request.headers.get("authorization"));
  if (!token || !verifyToken(token))
    return NextResponse.json({ success: false, message: "認証が必要です" }, { status: 401 });

  try {
    const sql = neon(process.env.DATABASE_URL!) as unknown as SqlFn;
    const rows = await sql.query(`
      SELECT DISTINCT "席数", COUNT(*) AS cnt
      FROM csv_data
      WHERE "席数" IS NOT NULL AND "席数" != '' AND "席数" !~ '^[0-9]+$'
      GROUP BY "席数"
      ORDER BY cnt DESC
      LIMIT 50
    `);

    const totalRes = await sql.query(`
      SELECT COUNT(*) AS cnt FROM csv_data
      WHERE "席数" IS NOT NULL AND "席数" != '' AND "席数" !~ '^[0-9]+$'
    `);

    const preview = rows.map(r => ({
      raw:      String(r["席数"]),
      cleansed: cleanseSeats(String(r["席数"])),
      count:    Number(r.cnt),
    }));

    return NextResponse.json({
      success: true,
      total_rows:    Number(totalRes[0]?.cnt ?? 0),
      unique_values: rows.length,
      preview,
    });
  } catch (e) {
    return NextResponse.json({ success: false, message: String(e) }, { status: 500 });
  }
}

// POST: 実際にクレンジングを実行
export async function POST(request: NextRequest) {
  const token = extractToken(request.headers.get("authorization"));
  if (!token || !verifyToken(token))
    return NextResponse.json({ success: false, message: "認証が必要です" }, { status: 401 });

  try {
    const sql = neon(process.env.DATABASE_URL!) as unknown as SqlFn;

    // 対象の distinct 値を取得
    const dirtyRows = await sql.query(`
      SELECT DISTINCT "席数", COUNT(*) AS cnt
      FROM csv_data
      WHERE "席数" IS NOT NULL AND "席数" != '' AND "席数" !~ '^[0-9]+$'
      GROUP BY "席数"
    `);

    if (dirtyRows.length === 0) {
      return NextResponse.json({ success: true, message: "クレンジング対象なし", updated_rows: 0, patterns: 0 });
    }

    let totalUpdatedRows = 0;
    const log: { raw: string; cleansed: string | null; rows: number }[] = [];

    for (const row of dirtyRows) {
      const raw      = String(row["席数"]);
      const cleansed = cleanseSeats(raw);
      const cnt      = Number(row.cnt);

      await sql.query(
        `UPDATE csv_data SET "席数" = $1 WHERE "席数" = $2`,
        [cleansed, raw]
      );

      totalUpdatedRows += cnt;
      log.push({ raw, cleansed, rows: cnt });
    }

    return NextResponse.json({
      success:      true,
      updated_rows: totalUpdatedRows,
      patterns:     dirtyRows.length,
      log:          log.slice(0, 30),
    });
  } catch (e) {
    console.error("Cleanse seats error:", e);
    return NextResponse.json({ success: false, message: String(e) }, { status: 500 });
  }
}
