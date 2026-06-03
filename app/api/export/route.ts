import { NextRequest, NextResponse } from "next/server";
import { getFilteredRows, type ExportFilters } from "@/lib/db";
import { verifyToken, extractToken } from "@/lib/auth";
import { generateEvercallCSV } from "@/lib/csv";

const BOM = "﻿";

export async function POST(request: NextRequest) {
  try {
    const token = extractToken(request.headers.get("authorization"));
    const payload = token ? verifyToken(token) : null;
    if (!payload) return NextResponse.json({ success: false, message: "認証が必要です" }, { status: 401 });
    if (payload.role !== "manager") return NextResponse.json({ success: false, message: "アクセス権限がありません" }, { status: 403 });

    const body = await request.json();
    const filters: ExportFilters = body.filters ?? {};
    const customFileName: string | undefined = body.fileName;

    const rows = await getFilteredRows(filters);

    if (rows.length === 0) {
      return NextResponse.json({ success: false, message: "該当データが0件です" }, { status: 400 });
    }

    const csv = BOM + generateEvercallCSV(rows);
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const fileName = customFileName ?? `飲食_架電リスト_${today}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json({
      success: false,
      message: "エクスポート処理中にエラーが発生しました",
      detail,
    }, { status: 500 });
  }
}
