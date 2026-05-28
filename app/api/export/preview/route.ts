import { NextRequest, NextResponse } from "next/server";
import {
  getFilteredCount,
  getFilteredCountByTimeCategory,
  type ExportFilters,
} from "@/lib/db";
import { verifyToken, extractToken } from "@/lib/auth";

// DB実在値（count降順）
const ALL_TIME_CATEGORIES = [
  "閉店",
  "通し午前開始",
  "業種対象外",
  "通し午後開始",
  "情報不足",
  "14時ランチ終了",
  "15時ランチ終了",
  "17時ディナー開始",
  "掲載保留",
  "本社×",
  "通し18時終了",
  "18時ディナー開始",
  "19時ディナー開始",
  "外人×",
  "16時ディナー開始",
  "業務対象外",
];

export async function GET(request: NextRequest) {
  try {
    const token = extractToken(request.headers.get("authorization"));
    if (!token) return NextResponse.json({ success: false, message: "認証が必要です" }, { status: 401 });
    if (!verifyToken(token)) return NextResponse.json({ success: false, message: "無効なトークンです" }, { status: 401 });

    const sp = request.nextUrl.searchParams;
    const filters: ExportFilters = {};

    const genresRaw = sp.getAll("genres");
    const genres = genresRaw.flatMap((v) => v.split(",").map((s) => s.trim())).filter(Boolean);
    if (genres.length > 0) filters.genres = genres;

    const timeCatsRaw = sp.getAll("timeCategories");
    const timeCategories = timeCatsRaw.flatMap((v) => v.split(",").map((s) => s.trim())).filter(Boolean);
    if (timeCategories.length > 0) filters.timeCategories = timeCategories;

    const bikouRaw = sp.getAll("bikou");
    const bikou = bikouRaw.flatMap((v) => v.split(",").map((s) => s.trim())).filter(Boolean);
    if (bikou.length > 0) filters.bikou = bikou;

    if (sp.get("seatMin")) filters.seatMin = Number(sp.get("seatMin"));
    if (sp.get("seatMax")) filters.seatMax = Number(sp.get("seatMax"));

    const [total, timeCategoryCounts] = await Promise.all([
      getFilteredCount(filters),
      getFilteredCountByTimeCategory(filters),
    ]);

    // 選択済みカテゴリがあればそれのみ、なければ全カテゴリを返す
    const categoriesToShow = (timeCategories.length > 0)
      ? ALL_TIME_CATEGORIES.filter((c) => timeCategories.includes(c))
      : ALL_TIME_CATEGORIES;

    const time_categories = categoriesToShow.map((name) => ({
      name,
      count: timeCategoryCounts[name] ?? 0,
    }));

    // DBに存在するが定義リストにない値も追加（将来的な新規値への対応）
    for (const [name, count] of Object.entries(timeCategoryCounts)) {
      if (!ALL_TIME_CATEGORIES.includes(name)) {
        time_categories.push({ name, count });
      }
    }

    return NextResponse.json({ success: true, total, time_categories });
  } catch (error) {
    console.error("Preview error:", error);
    return NextResponse.json({ success: false, message: "プレビュー取得中にエラーが発生しました" }, { status: 500 });
  }
}
