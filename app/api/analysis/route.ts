import { NextRequest, NextResponse } from "next/server";
import {
  getGlobalColumnStats,
  getGlobalTopValues,
  getGenreDistribution,
  getAddressesForRegion,
  getGlobalStatusDistribution,
} from "@/lib/db";
import { verifyToken, extractToken } from "@/lib/auth";

const PREFECTURES = [
  "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",
  "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
  "新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県",
  "静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県",
  "奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県",
  "徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県",
  "熊本県","大分県","宮崎県","鹿児島県","沖縄県",
];

function extractPrefecture(address: string): string {
  for (const p of PREFECTURES) {
    if (address.includes(p)) return p;
  }
  return "その他";
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

    // 全集計を並列取得
    const [colStats, topValues, genreData, addressData, statusData] = await Promise.all([
      getGlobalColumnStats(),
      getGlobalTopValues(5),
      getGenreDistribution(),
      getAddressesForRegion(),
      getGlobalStatusDistribution(),
    ]);

    // top_values をカラム統計にマージ
    for (const col of colStats.columns) {
      if (topValues[col]) {
        colStats.columnStats[col].top_values = topValues[col];
      }
    }

    // 都道府県別集計（住所から抽出）
    const prefMap: Record<string, number> = {};
    for (const { address, count } of addressData) {
      const pref = extractPrefecture(address);
      prefMap[pref] = (prefMap[pref] || 0) + count;
    }
    const region_stats = Object.entries(prefMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 15);

    return NextResponse.json({
      success: true,
      stats: {
        total_rows:   colStats.totalRows,
        columns:      colStats.columns,
        field_stats:  colStats.columnStats,
        category_stats: genreData,
        region_stats,
        status_stats: statusData,
      },
    });
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { success: false, message: "分析処理中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
