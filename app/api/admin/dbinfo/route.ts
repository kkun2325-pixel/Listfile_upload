import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyToken, extractToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const token = extractToken(request.headers.get("authorization"));
    if (!token) return NextResponse.json({ success: false, message: "認証が必要です" }, { status: 401 });
    if (!verifyToken(token)) return NextResponse.json({ success: false, message: "無効なトークンです" }, { status: 401 });

    const sql = getDb();

    // テーブル一覧を取得
    const tableList = await sql.query(
      `SELECT table_name AS name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name`
    );

    const [csvCount] = await sql`SELECT COUNT(*) AS cnt FROM csv_data`;

    const tables = await Promise.all(
      tableList.map(async (t) => {
        const name = String(t.name);
        const [cnt] = await sql.query(`SELECT COUNT(*) AS cnt FROM "${name}"`);
        const [cols] = await sql.query(
          `SELECT COUNT(*) AS cnt FROM information_schema.columns WHERE table_name = $1 AND table_schema = 'public'`,
          [name]
        );
        return {
          name,
          row_count: Number(cnt?.cnt ?? 0),
          col_count: Number(cols?.cnt ?? 0),
          total_size: "N/A",
          data_size: "N/A",
        };
      })
    );

    return NextResponse.json({
      success: true,
      query_result: {
        db_size: "CockroachDB（サイズ表示非対応）",
        db_bytes: 0,
        total_rows: Number(csvCount?.cnt ?? 0),
        table_size: "N/A",
      },
      tables,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
