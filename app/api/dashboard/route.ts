import { NextRequest, NextResponse } from "next/server";
import { getCSVUploadsByUserId, getCSVDataByUploadId } from "@/lib/db";
import { verifyToken, extractToken } from "@/lib/auth";

// データプレビューで表示するカラム
const PREVIEW_COLUMNS = ["名前", "電話番号", "住所１", "ジャンル", "架電対象フラグ"];

// 架電対象フラグのカラム名候補
const FLAG_COLUMNS = ["架電対象フラグ", "架電対象", "denwa_flag", "call_flag"];

// ECカラム名候補
const EC_COLUMNS = ["EC", "EC投入済", "エバーコール", "evercore", "ec"];

function resolveColumn(data: Record<string, string>, candidates: string[]): string | null {
  for (const col of candidates) {
    if (col in data) return col;
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const token = extractToken(request.headers.get("authorization"));
    if (!token) {
      return NextResponse.json({ success: false, message: "認証が必要です" }, { status: 401 });
    }
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, message: "無効なトークンです" }, { status: 401 });
    }

    // 最新アップロードを取得
    const uploads = await getCSVUploadsByUserId(decoded.userId);
    if (uploads.length === 0) {
      return NextResponse.json({
        success: true,
        stats: { callable: 0, non_callable: 0, callable_rate: 0, ec_ready: 0, total: 0 },
        pie_data: [],
        preview: [],
        filename: null,
        uploaded_at: null,
        columns_found: { flag: null, ec: null },
      });
    }

    const latestUpload = uploads[0];
    const csvData = await getCSVDataByUploadId(latestUpload.id);

    if (csvData.length === 0) {
      return NextResponse.json({
        success: true,
        stats: { callable: 0, non_callable: 0, callable_rate: 0, ec_ready: 0, total: 0 },
        pie_data: [],
        preview: [],
        filename: latestUpload.original_filename,
        uploaded_at: latestUpload.uploaded_at,
        columns_found: { flag: null, ec: null },
      });
    }

    // 実際のカラム名を特定
    const firstRow = csvData[0].data as Record<string, string>;
    const flagCol = resolveColumn(firstRow, FLAG_COLUMNS);
    const ecCol   = resolveColumn(firstRow, EC_COLUMNS);

    // 集計
    let callable     = 0;
    let non_callable = 0;
    let ec_ready     = 0;

    for (const row of csvData) {
      const data = row.data as Record<string, string>;
      const flagVal = flagCol ? String(data[flagCol] ?? "").trim() : "";
      const ecVal   = ecCol   ? String(data[ecCol]   ?? "").trim() : "";

      if (flagVal === "1") {
        callable++;
        if (ecVal === "") ec_ready++;
      } else if (flagVal === "0") {
        non_callable++;
      }
    }

    const total          = csvData.length;
    const other          = total - callable - non_callable;
    const callable_rate  = total > 0 ? parseFloat(((callable / total) * 100).toFixed(1)) : 0;

    // 円グラフ用データ
    const pie_data = [
      { name: "架電可能", value: callable,     color: "#2563eb" },
      { name: "対象外",   value: non_callable, color: "#ef4444" },
      ...(other > 0 ? [{ name: "その他", value: other, color: "#d1d5db" }] : []),
    ].filter((d) => d.value > 0);

    // プレビュー（先頭20件・指定カラムのみ）
    const preview = csvData.slice(0, 20).map((row) => {
      const data = row.data as Record<string, string>;
      const out: Record<string, string> = {};
      // 指定カラムを優先表示
      for (const col of PREVIEW_COLUMNS) {
        out[col] = data[col] !== undefined ? String(data[col]) : "—";
      }
      return out;
    });

    return NextResponse.json({
      success: true,
      stats: { callable, non_callable, callable_rate, ec_ready, total },
      pie_data,
      preview,
      filename: latestUpload.original_filename,
      uploaded_at: latestUpload.uploaded_at,
      columns_found: { flag: flagCol, ec: ecCol },
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json(
      { success: false, message: "ダッシュボードデータ取得中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
