import { NextRequest, NextResponse } from "next/server";
import { getPool, buildFilterWhere, type ExportFilters } from "@/lib/db";
import { verifyToken, extractToken } from "@/lib/auth";
import { EVERCALL_EXPORT_COLUMNS } from "@/lib/csv";

const BOM = "﻿";
const CHUNK = 5000;

function csvField(v: string): string {
  if (/[",\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function rowToCsvLine(row: Record<string, unknown>): string {
  return EVERCALL_EXPORT_COLUMNS.map(c =>
    csvField(c.dbCol ? String(row[c.dbCol] ?? "") : "")
  ).join(",") + "\r\n";
}

export async function POST(request: NextRequest) {
  try {
    const token = extractToken(request.headers.get("authorization"));
    const payload = token ? verifyToken(token) : null;
    if (!payload) return NextResponse.json({ success: false, message: "認証が必要です" }, { status: 401 });
    if (payload.role !== "manager") return NextResponse.json({ success: false, message: "アクセス権限がありません" }, { status: 403 });

    const body = await request.json();
    const filters: ExportFilters = body.filters ?? {};
    const customFileName: string | undefined = body.fileName;

    const { where, args } = buildFilterWhere(filters);
    const pool = getPool();
    const encoder = new TextEncoder();

    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const fileName = customFileName ?? `飲食_架電リスト_${today}.csv`;

    // SELECT対象列（store_idとidを追加でcursorに使う）
    const selectCols = [
      "id",
      ...EVERCALL_EXPORT_COLUMNS.filter(c => c.dbCol).map(c => `"${c.dbCol}"`),
    ].join(", ");

    const headerRow = EVERCALL_EXPORT_COLUMNS.map(c => csvField(c.header)).join(",") + "\r\n";
    const labelRow  = EVERCALL_EXPORT_COLUMNS.map(c => csvField(c.label)).join(",") + "\r\n";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(encoder.encode(BOM + headerRow + labelRow));

          // id（UUID PK）でキーセットページング
          let lastId = "";
          const cursorIdx = args.length + 1;

          while (true) {
            const pageArgs = [...args, lastId];
            const sql = `
              SELECT ${selectCols}
              FROM csv_data
              ${where} AND id > $${cursorIdx}
              ORDER BY id
              LIMIT ${CHUNK}
            `;
            const result = await pool.query(sql, pageArgs);
            if (result.rows.length === 0) break;

            for (const row of result.rows) {
              controller.enqueue(encoder.encode(rowToCsvLine(row)));
            }

            lastId = result.rows[result.rows.length - 1].id as string;
            if (result.rows.length < CHUNK) break;
          }

          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new NextResponse(stream, {
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
