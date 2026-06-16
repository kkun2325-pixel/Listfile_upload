import { NextRequest, NextResponse } from "next/server";
import { verifyToken, extractToken } from "@/lib/auth";
import { getDb, LIST_COLUMNS } from "@/lib/db";
import { generateCSV } from "@/lib/csv";

const BOM = "﻿";

function auth(req: NextRequest) {
  const token = extractToken(req.headers.get("authorization"));
  const payload = token ? verifyToken(token) : null;
  return payload?.role === "manager" ? payload : null;
}

// GET: csv_data の全件・全カラムをCSVでダウンロード（移行・バックアップ用）
export async function GET(req: NextRequest) {
  if (!auth(req))
    return NextResponse.json({ success: false, message: "権限がありません" }, { status: 403 });

  try {
    const sql = getDb();
    const cols = ["store_id", ...LIST_COLUMNS];
    const colList = cols.map(c => c === "store_id" ? "store_id" : `"${c}"`).join(", ");
    const rows = await sql.query(`SELECT ${colList} FROM csv_data ORDER BY store_id`);

    const data = rows.map((r: Record<string, unknown>) => {
      const out: Record<string, string> = {};
      for (const c of cols) out[c] = r[c] != null ? String(r[c]) : "";
      return out;
    });

    const csv = BOM + generateCSV(cols, data);
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`csv_data_全件_${today}.csv`)}`,
      },
    });
  } catch (e) {
    return NextResponse.json({ success: false, message: String(e) }, { status: 500 });
  }
}
