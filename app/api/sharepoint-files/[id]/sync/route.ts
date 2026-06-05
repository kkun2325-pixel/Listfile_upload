import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { verifyToken, extractToken } from "@/lib/auth";
import {
  getSharepointFileById,
  updateSharepointFileSyncResult,
  createCSVUpload,
  batchUpsertCSVRows,
  updateCSVUploadCounts,
} from "@/lib/db";
import { getGraphToken, downloadSharePointFile, parseExcelToRows } from "@/lib/sharepoint";
import { mapCsvColumnsToDb } from "@/lib/csv";

// POST: 手動同期（またはcronから呼ばれる）
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 認証チェック（cron呼び出しの場合はCRON_SECRETヘッダーも許可）
    const cronSecret = request.headers.get("x-cron-secret");
    const isCron = cronSecret && cronSecret === process.env.CRON_SECRET;

    if (!isCron) {
      const token = extractToken(request.headers.get("authorization"));
      if (!token) return NextResponse.json({ success: false, message: "認証が必要です" }, { status: 401 });
      const decoded = verifyToken(token);
      if (!decoded) return NextResponse.json({ success: false, message: "無効なトークンです" }, { status: 401 });
    }

    // 対象ファイル取得
    const file = await getSharepointFileById(params.id);
    if (!file) {
      return NextResponse.json({ success: false, message: "ファイルが見つかりません" }, { status: 404 });
    }

    // Azure AD チェック
    if (!(process.env.AZURE_TENANT_ID && process.env.AZURE_CLIENT_ID && process.env.AZURE_CLIENT_SECRET)) {
      await updateSharepointFileSyncResult(
        params.id, "error",
        "Azure AD 認証情報が未設定です。AZURE_TENANT_ID / CLIENT_ID / CLIENT_SECRET を環境変数に追加してください。"
      );
      return NextResponse.json({
        success: false,
        message: "Azure AD 認証情報が未設定です",
      }, { status: 503 });
    }

    // 同期処理開始
    try {
      // 1. Graph トークン
      const graphToken = await getGraphToken();

      // 2. Excelダウンロード
      const buffer = await downloadSharePointFile(
        graphToken,
        file.sharepoint_site_id,
        file.sharepoint_file_id ?? undefined,
        file.sharepoint_file_path ?? undefined,
      );

      // 3. Excel → 行データ変換
      const sheetName  = process.env.EXCEL_SHEET_NAME || undefined;
      const headerRow  = parseInt(process.env.EXCEL_HEADER_ROW ?? "1", 10);
      const { rows, rowCount } = parseExcelToRows(buffer, sheetName, headerRow);

      if (rowCount === 0) {
        await updateSharepointFileSyncResult(params.id, "error", "Excelにデータ行がありませんでした");
        return NextResponse.json({ success: false, message: "データ行が0件です" }, { status: 400 });
      }

      // 4. システムユーザーとしてアップロード記録を作成
      const uploadId   = uuidv4();
      const today      = new Date().toISOString().slice(0, 10);
      const filename   = `sp_auto_${file.name}_${today}.xlsx`;
      const systemUser = file.created_by;   // 登録者のuser_idを使用

      await createCSVUpload(
        uploadId, systemUser, uploadId, filename, 0, rowCount, 0, 0,
        null, file.name, today, null
      );

      // 5. 行データをDBにアップサート（CSVマッピングを通す）
      const rowsPayload = rows.map((rawRow, i) => ({
        internalId: uuidv4(),
        rowNumber: i + 1,
        row: mapCsvColumnsToDb(rawRow),
      }));

      const { insertedCount, updatedCount } = await batchUpsertCSVRows(uploadId, rowsPayload);
      await updateCSVUploadCounts(uploadId, insertedCount, updatedCount);

      // 6. 同期結果を記録
      const msg = `${rowCount}行処理（新規:${insertedCount}, 更新:${updatedCount}）`;
      await updateSharepointFileSyncResult(params.id, "success", msg);

      return NextResponse.json({
        success: true,
        message: msg,
        upload_id:      uploadId,
        row_count:      rowCount,
        inserted_count: insertedCount,
        updated_count:  updatedCount,
      });

    } catch (syncError) {
      const errMsg = syncError instanceof Error ? syncError.message : String(syncError);
      await updateSharepointFileSyncResult(params.id, "error", errMsg);
      return NextResponse.json({ success: false, message: errMsg }, { status: 500 });
    }

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
