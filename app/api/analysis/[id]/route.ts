import { NextRequest, NextResponse } from "next/server";
import { getCSVDataByUploadId, getCSVUploadById } from "@/lib/db";
import { verifyToken, extractToken } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const uploadId = params.id;

    // Verify authentication
    const token = extractToken(request.headers.get("authorization"));
    if (!token) {
      return NextResponse.json(
        { success: false, message: "認証が必要です" },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { success: false, message: "無効なトークンです" },
        { status: 401 }
      );
    }

    // Get upload info
    const upload = await getCSVUploadById(uploadId);
    if (!upload) {
      return NextResponse.json(
        { success: false, message: "アップロード情報が見つかりません" },
        { status: 404 }
      );
    }

    // Get CSV data
    const csvData = await getCSVDataByUploadId(uploadId);

    if (csvData.length === 0) {
      return NextResponse.json(
        {
          success: true,
          stats: {
            total_rows: 0,
            columns: [],
            field_stats: {},
            category_stats: {},
            region_stats: {},
            status_stats: {},
          },
        },
        { status: 200 }
      );
    }

    // Get column names
    const columns = Object.keys(csvData[0].data);

    // Calculate field statistics
    const field_stats: Record<string, any> = {};
    columns.forEach((col) => {
      const allValues = csvData.map((row) => row.data[col]);
      const values = allValues.filter((v) => v !== null && v !== undefined && v !== "");
      const uniqueValues = new Set(values);

      // 上位5件の値カウント
      const valueCounts: Record<string, number> = {};
      values.forEach((v) => {
        const key = String(v);
        valueCounts[key] = (valueCounts[key] || 0) + 1;
      });
      const top_values = Object.entries(valueCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([value, count]) => ({ value, count }));

      field_stats[col] = {
        total: values.length,
        unique: uniqueValues.size,
        null_count: csvData.length - values.length,
        null_percent: (
          ((csvData.length - values.length) / csvData.length) *
          100
        ).toFixed(2),
        top_values,
      };
    });

    // Calculate category stats (ジャンル別)
    const category_stats: Record<string, number> = {};
    csvData.forEach((row) => {
      const genre = row.data["ジャンル"] || "不明";
      category_stats[genre] = (category_stats[genre] || 0) + 1;
    });

    // Calculate region stats (都道府県別)
    const region_stats: Record<string, number> = {};
    csvData.forEach((row) => {
      const address = row.data["住所1"] || "不明";
      // Extract prefecture (first 2-3 characters typically)
      const prefecture = extractPrefecture(address);
      region_stats[prefecture] = (region_stats[prefecture] || 0) + 1;
    });

    // Calculate status stats
    const status_stats = {
      ng_count: csvData.filter((row) => row.data["NG"] === "◎").length,
      ec_invested: csvData.filter((row) => row.data["EC投入済"] === "◎").length,
      call_target: csvData.filter(
        (row) => row.data["架電対象フラグ"] === "◎"
      ).length,
      exclude_count: csvData.filter((row) =>
        row.data["対象外理由①"]
      ).length,
      duplicates: csvData.filter((row) => Number((row as Record<string, unknown>).is_duplicate) === 1).length,
    };

    return NextResponse.json(
      {
        success: true,
        stats: {
          total_rows: csvData.length,
          columns,
          field_stats,
          category_stats,
          region_stats,
          status_stats,
          raw_data: csvData.slice(0, 100), // First 100 rows for preview
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { success: false, message: "分析処理中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

function extractPrefecture(address: string): string {
  const prefectures = [
    "北海道",
    "青森県",
    "岩手県",
    "宮城県",
    "秋田県",
    "山形県",
    "福島県",
    "茨城県",
    "栃木県",
    "群馬県",
    "埼玉県",
    "千葉県",
    "東京都",
    "神奈川県",
    "新潟県",
    "富山県",
    "石川県",
    "福井県",
    "山梨県",
    "長野県",
    "岐阜県",
    "静岡県",
    "愛知県",
    "三重県",
    "滋賀県",
    "京都府",
    "大阪府",
    "兵庫県",
    "奈良県",
    "和歌山県",
    "鳥取県",
    "島根県",
    "岡山県",
    "広島県",
    "山口県",
    "徳島県",
    "香川県",
    "愛媛県",
    "高知県",
    "福岡県",
    "佐賀県",
    "長崎県",
    "熊本県",
    "大分県",
    "宮崎県",
    "鹿児島県",
    "沖縄県",
  ];

  for (const pref of prefectures) {
    if (address.includes(pref)) {
      return pref;
    }
  }

  return "その他";
}
