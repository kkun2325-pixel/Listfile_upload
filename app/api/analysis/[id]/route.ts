import { NextRequest, NextResponse } from "next/server";
import { getCSVDataByUploadId, getCSVUploadById, LIST_COLUMNS } from "@/lib/db";
import { verifyToken, extractToken } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const uploadId = params.id;

    const token = extractToken(request.headers.get("authorization"));
    if (!token) return NextResponse.json({ success: false, message: "認証が必要です" }, { status: 401 });
    if (!verifyToken(token)) return NextResponse.json({ success: false, message: "無効なトークンです" }, { status: 401 });

    const upload = await getCSVUploadById(uploadId);
    if (!upload) return NextResponse.json({ success: false, message: "アップロード情報が見つかりません" }, { status: 404 });

    const csvData = await getCSVDataByUploadId(uploadId);

    if (csvData.length === 0) {
      return NextResponse.json({
        success: true,
        stats: { total_rows: 0, columns: [], field_stats: {}, category_stats: {}, region_stats: {}, status_stats: {} },
      });
    }

    // フィールド統計
    const field_stats: Record<string, unknown> = {};
    for (const col of LIST_COLUMNS) {
      const values = csvData.map(row => row[col]).filter(v => v !== null && v !== undefined && v !== '');
      const valueCounts: Record<string, number> = {};
      values.forEach(v => { const k = String(v); valueCounts[k] = (valueCounts[k] ?? 0) + 1; });
      const top_values = Object.entries(valueCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([value, count]) => ({ value, count }));
      field_stats[col] = {
        total: values.length,
        unique: new Set(values).size,
        null_count: csvData.length - values.length,
        null_percent: ((csvData.length - values.length) / csvData.length * 100).toFixed(2),
        top_values,
      };
    }

    // ジャンル別
    const category_stats: Record<string, number> = {};
    csvData.forEach(row => {
      const genre = String(row["ジャンル"] ?? '不明') || '不明';
      category_stats[genre] = (category_stats[genre] ?? 0) + 1;
    });

    // ステータス統計
    const status_stats = {
      ng_count:      csvData.filter(row => row["NG"]         === "◎").length,
      ec_invested:   csvData.filter(row => row["EC投入済"]   === "◎").length,
      call_target:   csvData.filter(row => row["架電対象フラグ"] === "◎").length,
      exclude_count: csvData.filter(row => row["対象外理由①"]).length,
      duplicates:    csvData.filter(row => Number(row.is_duplicate) === 1).length,
    };

    return NextResponse.json({
      success: true,
      stats: {
        total_rows: csvData.length,
        columns: [...LIST_COLUMNS],
        field_stats,
        category_stats,
        region_stats: {},
        status_stats,
        raw_data: csvData.slice(0, 100),
      },
    });
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json({ success: false, message: "分析処理中にエラーが発生しました" }, { status: 500 });
  }
}
