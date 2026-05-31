import { NextRequest, NextResponse } from "next/server";
import { verifyToken, extractToken } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { TIME_CATEGORIES } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const token = extractToken(request.headers.get("authorization"));
  if (!token || !verifyToken(token))
    return NextResponse.json({ success: false, message: "認証が必要です" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const prefectures = searchParams.getAll("prefectures");
  const seatMin     = searchParams.get("seatMin")  ?? "";
  const seatMax     = searchParams.get("seatMax")  ?? "";
  const genres      = searchParams.getAll("genres");
  const bikou       = searchParams.getAll("bikou");

  try {
    const sql = getDb();

    // 都道府県一覧（フィルター無関係に全件）
    const prefRows = await sql.query(
      `SELECT DISTINCT "住所1" FROM csv_data
       WHERE "住所1" IS NOT NULL AND "住所1" != ''
       ORDER BY "住所1"`
    );
    const availablePrefectures = prefRows.map(r => String(r["住所1"]));

    // フィルター WHERE 構築
    const params: unknown[] = [];
    const clauses: string[] = [];

    if (prefectures.length > 0) {
      params.push(prefectures);
      clauses.push(`"住所1" = ANY($${params.length}::text[])`);
    }
    if (seatMin !== "") {
      params.push(Number(seatMin));
      clauses.push(`("席数" ~ '^[0-9]+$' AND CAST("席数" AS INTEGER) >= $${params.length})`);
    }
    if (seatMax !== "") {
      params.push(Number(seatMax));
      clauses.push(`("席数" ~ '^[0-9]+$' AND CAST("席数" AS INTEGER) <= $${params.length})`);
    }
    if (genres.length > 0) {
      params.push(genres);
      clauses.push(`"ジャンル" = ANY($${params.length}::text[])`);
    }
    if (bikou.length > 0) {
      params.push(bikou);
      clauses.push(`"備考" = ANY($${params.length}::text[])`);
    }

    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const catLiteral = TIME_CATEGORIES.map(c => `'${c.replace(/'/g, "''")}'`).join(",");

    // 時間振り別集計（定義外 → その他・未登録）
    const countRows = await sql.query(`
      SELECT
        CASE
          WHEN "時間振り" IN (${catLiteral}) THEN "時間振り"
          ELSE 'その他・未登録'
        END AS time_category,
        COUNT(*) AS count
      FROM csv_data
      ${whereClause}
      GROUP BY time_category
    `, params);

    const countMap: Record<string, number> = {};
    for (const r of countRows) countMap[String(r.time_category)] = Number(r.count);

    const rows = [
      ...TIME_CATEGORIES.map(cat => ({ time_category: cat, count: countMap[cat] ?? 0 })),
      { time_category: "その他・未登録", count: countMap["その他・未登録"] ?? 0 },
    ];

    const total = rows.reduce((s, r) => s + r.count, 0);

    return NextResponse.json({ success: true, prefectures: availablePrefectures, rows, total });
  } catch (e) {
    console.error("Analysis error:", e);
    return NextResponse.json({ success: false, message: String(e) }, { status: 500 });
  }
}
