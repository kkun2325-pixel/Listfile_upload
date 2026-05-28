import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { createCSVUpload, updateCSVUploadCounts, batchUpsertCSVRows } from "@/lib/db";
import { verifyToken, extractToken } from "@/lib/auth";
import { parseCSV, mapCsvColumnsToDb } from "@/lib/csv";

export async function POST(request: NextRequest) {
  try {
    const token = extractToken(request.headers.get("authorization"));
    if (!token) {
      return NextResponse.json({ success: false, message: "認証が必要です" }, { status: 401 });
    }
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, message: "無効なトークンです" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ success: false, message: "ファイルが見つかりません" }, { status: 400 });
    }
    if (!file.name.endsWith(".csv")) {
      return NextResponse.json({ success: false, message: "CSVファイルのみアップロード可能です" }, { status: 400 });
    }

    const content = await file.text();
    const parseResult = await parseCSV(content);
    if (parseResult.errors.length > 0) {
      return NextResponse.json({ success: false, message: "CSVファイルの解析に失敗しました" }, { status: 400 });
    }

    const uploadId = uuidv4();

    // アップロード記録を先に作成（csv_data の外部キー制約のため）
    await createCSVUpload(
      uploadId,
      decoded.userId,
      uploadId,
      file.name,
      file.size,
      parseResult.data.length,
      0,
      0,
    );

    // 全行をバッチ処理（電話番号一括検索 → 並列INSERT/UPDATE）
    const rowsPayload = parseResult.data.map((rawRow, i) => ({
      internalId: uuidv4(),
      rowNumber:  i + 1,
      row:        mapCsvColumnsToDb(rawRow),
    }));

    const { insertedCount, updatedCount } = await batchUpsertCSVRows(uploadId, rowsPayload);

    // 件数を確定値で更新
    await updateCSVUploadCounts(uploadId, insertedCount, updatedCount);

    return NextResponse.json(
      {
        success: true,
        message: "ファイルをアップロードしました",
        upload_id:      uploadId,
        row_count:      parseResult.data.length,
        inserted_count: insertedCount,
        updated_count:  updatedCount,
      },
      { status: 201 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Upload error:", error);
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
