import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@libsql/client";
import { verifyToken, extractToken } from "@/lib/auth";

// POST: VACUUM でデッドタプルを回収（SQLiteのVACUUM）
export async function POST(request: NextRequest) {
  try {
    const token = extractToken(request.headers.get("authorization"));
    if (!token) return NextResponse.json({ success: false, message: "認証が必要です" }, { status: 401 });
    if (!verifyToken(token)) return NextResponse.json({ success: false, message: "無効なトークンです" }, { status: 401 });

    const url       = (process.env.TURSO_DATABASE_URL ?? "").trim();
    const authToken = (process.env.TURSO_AUTH_TOKEN   ?? "").trim();
    if (!url) throw new Error("TURSO_DATABASE_URL が設定されていません");
    const c = createClient({ url, authToken: authToken || undefined });

    // サイズ確認（before）- SQLiteはpage_count * page_sizeで計算
    const beforeRes = await c.execute(`
      SELECT
        page_count * page_size AS db_bytes
      FROM pragma_page_count(), pragma_page_size()
    `);
    const beforeBytes = Number(beforeRes.rows[0]?.db_bytes ?? 0);

    // SQLite VACUUM
    await c.execute("VACUUM");

    // サイズ確認（after）
    const afterRes = await c.execute(`
      SELECT
        page_count * page_size AS db_bytes
      FROM pragma_page_count(), pragma_page_size()
    `);
    const afterBytes = Number(afterRes.rows[0]?.db_bytes ?? 0);

    // テーブル別件数
    const csvDataCount = await c.execute("SELECT COUNT(*) AS cnt FROM csv_data");
    const evercallCount = await c.execute("SELECT COUNT(*) AS cnt FROM evercall_invested");

    const fmtMB = (b: number) => (b / 1024 / 1024).toFixed(1) + " MB";

    return NextResponse.json({
      success: true,
      before: {
        csv_data: `${(await c.execute("SELECT COUNT(*) AS cnt FROM csv_data")).rows[0]?.cnt} rows`,
        evercall: `${evercallCount.rows[0]?.cnt} rows`,
        db_bytes: beforeBytes,
        db_size: fmtMB(beforeBytes),
      },
      after: {
        csv_data: `${csvDataCount.rows[0]?.cnt} rows`,
        evercall: `${evercallCount.rows[0]?.cnt} rows`,
        db_size: fmtMB(afterBytes),
        db_bytes: afterBytes,
      },
      freed_mb: ((beforeBytes - afterBytes) / 1024 / 1024).toFixed(1),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Vacuum error:", error);
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
