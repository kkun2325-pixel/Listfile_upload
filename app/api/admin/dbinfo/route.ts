import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@libsql/client";
import { verifyToken, extractToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const token = extractToken(request.headers.get("authorization"));
    if (!token) return NextResponse.json({ success: false, message: "認証が必要です" }, { status: 401 });
    if (!verifyToken(token)) return NextResponse.json({ success: false, message: "無効なトークンです" }, { status: 401 });

    const url       = (process.env.TURSO_DATABASE_URL ?? "").trim();
    const authToken = (process.env.TURSO_AUTH_TOKEN   ?? "").trim();
    if (!url) throw new Error("TURSO_DATABASE_URL が設定されていません");
    const c = createClient({ url, authToken: authToken || undefined });

    // DB全体サイズ（pages × page_size）
    const sizeRes = await c.execute(`
      SELECT page_count * page_size AS db_bytes
      FROM pragma_page_count(), pragma_page_size()
    `);
    const dbBytes = Number(sizeRes.rows[0]?.db_bytes ?? 0);
    const dbSize  = (dbBytes / 1024 / 1024).toFixed(1) + " MB";

    // csv_data 件数
    const countRes = await c.execute("SELECT COUNT(*) AS cnt FROM csv_data");
    const totalRows = Number(countRes.rows[0]?.cnt ?? 0);

    // テーブル一覧（sqlite_masterから）
    const tablesRes = await c.execute(`
      SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name
    `);
    const tables = await Promise.all(tablesRes.rows.map(async (t) => {
      const name = String(t.name);
      const cnt  = await c.execute(`SELECT COUNT(*) AS cnt FROM "${name}"`);
      const cols = await c.execute(`SELECT COUNT(*) AS cnt FROM pragma_table_info('${name}')`);
      return {
        name,
        row_count: Number(cnt.rows[0]?.cnt ?? 0),
        col_count: Number(cols.rows[0]?.cnt ?? 0),
        total_size: "N/A (SQLite)",
        data_size:  "N/A (SQLite)",
      };
    }));

    return NextResponse.json({
      success: true,
      query_result: {
        db_size:    dbSize,
        db_bytes:   dbBytes,
        total_rows: totalRows,
        table_size: "N/A (全体サイズ参照)",
      },
      tables,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
