import { NextRequest, NextResponse } from "next/server";
import { verifyToken, extractToken } from "@/lib/auth";
import { getDb } from "@/lib/db";

const BOM = "﻿";

function buildWhere(genres: string[]): { clause: string; params: unknown[] } {
  const base = [
    `"名前"    IS NOT NULL AND "名前"    != ''`,
    `"電話番号" IS NOT NULL AND "電話番号" != ''`,
    `"住所2"   IS NOT NULL AND "住所2"   != ''`,
  ];
  const params: unknown[] = [];
  if (genres.length > 0) {
    params.push(genres);
    base.push(`"ジャンル" = ANY($${params.length}::text[])`);
  }
  return { clause: base.join(" AND "), params };
}

// 利用可能件数を返す（GET）
// ?genres=居酒屋・バー&genres=和食 のように複数指定可
export async function GET(request: NextRequest) {
  const token = extractToken(request.headers.get("authorization"));
  if (!token || !verifyToken(token))
    return NextResponse.json({ success: false, message: "認証が必要です" }, { status: 401 });

  try {
    const genres = request.nextUrl.searchParams.getAll("genres");
    const { clause, params } = buildWhere(genres);
    const sql = getDb();
    const [row] = await sql.query(
      `SELECT COUNT(DISTINCT "電話番号") AS cnt FROM csv_data WHERE ${clause}`,
      params
    );
    return NextResponse.json({ success: true, available: Number(row?.cnt ?? 0) });
  } catch (e) {
    return NextResponse.json({ success: false, message: String(e) }, { status: 500 });
  }
}

// 未精査母体 CSV をエクスポート（POST）
// body: { count: number, genres?: string[] }
export async function POST(request: NextRequest) {
  const token = extractToken(request.headers.get("authorization"));
  if (!token || !verifyToken(token))
    return NextResponse.json({ success: false, message: "認証が必要です" }, { status: 401 });

  try {
    const body = await request.json() as { count: number; genres?: string[] };
    const { count, genres = [] } = body;
    if (!count || count < 1)
      return NextResponse.json({ success: false, message: "件数を正しく指定してください" }, { status: 400 });

    const { clause, params } = buildWhere(genres);
    // LIMIT パラメータを追加
    params.push(count);
    const limitIdx = params.length;

    const sql = getDb();
    const rows = await sql.query(`
      WITH ranked AS (
        SELECT
          "名前"     AS store_name,
          "電話番号" AS tel,
          "住所1"    AS addr1,
          "住所2"    AS addr2,
          ROW_NUMBER() OVER (PARTITION BY "電話番号" ORDER BY updated_at DESC) AS rn
        FROM csv_data
        WHERE ${clause}
      )
      SELECT store_name, tel, addr1, addr2
      FROM ranked
      WHERE rn = 1
      LIMIT $${limitIdx}
    `, params);

    if (rows.length === 0)
      return NextResponse.json({ success: false, message: "該当データが0件です" }, { status: 400 });

    function csvField(v: string | null): string {
      const s = v ?? "";
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }

    const header = "店名,電話番号,住所１,住所２";
    const csvBody = rows
      .map(r => [
        csvField(String(r.store_name ?? "")),
        csvField(String(r.tel ?? "")),
        csvField(String(r.addr1 ?? "")),
        csvField(String(r.addr2 ?? "")),
      ].join(","))
      .join("\r\n");

    const csv = BOM + header + "\r\n" + csvBody;
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const fileName = `未精査母体_${rows.length}件_${today}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    });
  } catch (e) {
    console.error("Unseisa export error:", e);
    return NextResponse.json({ success: false, message: String(e) }, { status: 500 });
  }
}
