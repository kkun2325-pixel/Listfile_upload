import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  createCSVUpload,
  updateCSVUploadCounts,
  batchUpsertCSVRows,
  saveSeisaSnapshot,
  getDb,
} from "@/lib/db";
import { verifyToken, extractToken } from "@/lib/auth";
import { parseCSV, mapCsvColumnsToDb } from "@/lib/csv";

// ── FormData（旧フロー） ─────────────────────────────────────
async function handleFormData(request: NextRequest, userId: string) {
  const formData = await request.formData();
  const file = formData.get("file") as File;
  if (!file) return NextResponse.json({ success: false, message: "ファイルが見つかりません" }, { status: 400 });
  if (!file.name.endsWith(".csv")) return NextResponse.json({ success: false, message: "CSVファイルのみアップロード可能です" }, { status: 400 });

  const content = await file.text();
  const parseResult = await parseCSV(content);
  if (parseResult.errors.length > 0) return NextResponse.json({ success: false, message: "CSVファイルの解析に失敗しました" }, { status: 400 });

  const workHoursStr = formData.get("work_hours") as string | null;
  const workHours = workHoursStr ? parseFloat(workHoursStr) : null;
  const workerName  = (formData.get("worker_name")  as string | null) || null;
  const reportDate  = (formData.get("report_date")  as string | null) || null;
  const teamName    = (formData.get("team_name")    as string | null) || null;
  const uploadId = uuidv4();

  await createCSVUpload(uploadId, userId, uploadId, file.name, file.size, parseResult.data.length, 0, 0, workHours, workerName, reportDate, teamName);

  const rowsPayload = parseResult.data.map((rawRow, i) => ({
    internalId: uuidv4(),
    rowNumber:  i + 1,
    row:        mapCsvColumnsToDb(rawRow),
  }));

  const { insertedCount, updatedCount } = await batchUpsertCSVRows(uploadId, rowsPayload);
  await updateCSVUploadCounts(uploadId, insertedCount, updatedCount);
  if (reportDate) await saveSeisaSnapshot(uploadId, reportDate);

  return NextResponse.json({
    success: true,
    message: "ファイルをアップロードしました",
    upload_id:      uploadId,
    row_count:      parseResult.data.length,
    inserted_count: insertedCount,
    updated_count:  updatedCount,
  }, { status: 201 });
}

// ── JSON バッチ（新フロー：クライアント側パース済み） ─────────
// 初回: { filename, work_hours, total_rows, rows, row_offset }
//       → upload_id を採番して返す
// 後続: { upload_id, rows, row_offset, is_final, total_rows }
//       → is_final=true のとき件数を確定
async function handleJsonBatch(request: NextRequest, userId: string) {
  const body = await request.json() as {
    upload_id?:   string;
    filename?:    string;
    work_hours?:  number;
    worker_name?: string;
    report_date?: string;
    team_name?:   string;
    total_rows?:  number;
    row_offset?:  number;
    rows:         Record<string, string>[];
    is_final?:    boolean;
  };

  const { rows, is_final } = body;
  if (!Array.isArray(rows)) return NextResponse.json({ success: false, message: "rows が不正です" }, { status: 400 });

  const sql = getDb();

  // 初回バッチ → upload_id 採番
  let uploadId = body.upload_id ?? "";
  if (!uploadId) {
    if (!body.filename || body.work_hours == null || !body.report_date) {
      return NextResponse.json({ success: false, message: "初回バッチには filename, work_hours, report_date が必要です" }, { status: 400 });
    }
    uploadId = uuidv4();
    await sql`
      INSERT INTO csv_uploads (id, user_id, filename, original_filename, file_size, row_count, uploaded_at, status, inserted_count, updated_count, work_hours, worker_name, report_date, team_name)
      VALUES (${uploadId}, ${userId}, ${uploadId}, ${body.filename}, 0, ${body.total_rows ?? 0}, ${new Date().toISOString()}, 'processing', 0, 0, ${body.work_hours}, ${body.worker_name ?? null}, ${body.report_date}, ${body.team_name ?? null})
    `;
  }

  // バッチ処理
  const offset = body.row_offset ?? 0;
  const rowsPayload = rows.map((row, i) => ({
    internalId: uuidv4(),
    rowNumber:  offset + i + 1,
    row,  // クライアント側で mapCsvColumnsToDb 適用済み
  }));

  const { insertedCount, updatedCount } = await batchUpsertCSVRows(uploadId, rowsPayload);

  // 最終バッチ → 件数確定
  if (is_final) {
    await sql`
      UPDATE csv_uploads
      SET status = 'processed',
          inserted_count = inserted_count + ${insertedCount},
          updated_count  = updated_count  + ${updatedCount}
      WHERE id = ${uploadId}
    `;
    const finalRes = await sql`SELECT inserted_count, updated_count, row_count, report_date FROM csv_uploads WHERE id = ${uploadId}`;
    const r = finalRes[0];
    const reportDate = r?.report_date ? String(r.report_date) : null;
    if (reportDate) await saveSeisaSnapshot(uploadId, reportDate);
    return NextResponse.json({
      success: true,
      message: "ファイルをアップロードしました",
      upload_id:      uploadId,
      row_count:      Number(r?.row_count ?? 0),
      inserted_count: Number(r?.inserted_count ?? 0),
      updated_count:  Number(r?.updated_count  ?? 0),
    }, { status: 201 });
  }

  // 中間バッチ → 件数を加算して次バッチへ
  await sql`
    UPDATE csv_uploads
    SET inserted_count = inserted_count + ${insertedCount},
        updated_count  = updated_count  + ${updatedCount}
    WHERE id = ${uploadId}
  `;

  return NextResponse.json({ success: true, upload_id: uploadId, inserted_count: insertedCount, updated_count: updatedCount });
}

// ── メインハンドラ ────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const token = extractToken(request.headers.get("authorization"));
    if (!token) return NextResponse.json({ success: false, message: "認証が必要です" }, { status: 401 });
    const decoded = verifyToken(token);
    if (!decoded) return NextResponse.json({ success: false, message: "無効なトークンです" }, { status: 401 });

    const ct = request.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      return await handleJsonBatch(request, decoded.userId);
    }
    return await handleFormData(request, decoded.userId);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Upload error:", error);
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
