import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { v4 as uuidv4 } from "uuid";
import {
  getFilteredRows,
  saveExportHistory,
  bulkInsertEvercallInvested,
  type ExportFilters,
} from "@/lib/db";
import { verifyToken, extractToken } from "@/lib/auth";
import { generateEvercallCSV } from "@/lib/csv";
import { TIME_CATEGORIES } from "@/lib/constants";

const BOM = "﻿";

function buildSeatConditionText(seatMin?: number, seatMax?: number): string {
  if (seatMin !== undefined && seatMax !== undefined) {
    if (seatMin === seatMax) return `${seatMin}席`;
    return `${seatMin}-${seatMax}席`;
  }
  if (seatMin !== undefined) return `${seatMin}席以上`;
  if (seatMax !== undefined) return `${seatMax}席以下`;
  return "条件なし";
}

function padListNumber(n: number): string {
  return String(n).padStart(4, "0");
}

export async function POST(request: NextRequest) {
  try {
    const token = extractToken(request.headers.get("authorization"));
    const payload = token ? verifyToken(token) : null;
    if (!payload) return NextResponse.json({ success: false, message: "認証が必要です" }, { status: 401 });
    if (payload.role !== "manager") return NextResponse.json({ success: false, message: "アクセス権限がありません" }, { status: 403 });

    const body = await request.json();
    const filters: ExportFilters = body.filters ?? {};
    const listGroup: string = body.listGroup ?? "飲食SH";
    const startListNumber: number = Number(body.startListNumber ?? 1);
    const exportDate: string = body.exportDate ?? new Date().toISOString().slice(0, 10).replace(/-/g, "");

    // Evercall除外はZIPエクスポートで選択したリストグループに限定
    if (filters.excludeInvested) {
      filters.investedListGroup = listGroup;
    }

    // 時間振りフィルターを適用した全データを取得
    const allRows = await getFilteredRows(filters);

    if (allRows.length === 0) {
      return NextResponse.json({ success: false, message: "該当データが0件です" }, { status: 400 });
    }

    // 席数条件テキスト
    const seatCondition = buildSeatConditionText(filters.seatMin, filters.seatMax);

    // 処理する時間振りカテゴリを決定
    // timeCategories フィルターが設定されている場合はそれに従い、なければ全DB値を対象
    const selectedOrAll = (filters.timeCategories && filters.timeCategories.length > 0)
      ? TIME_CATEGORIES.filter((c) => filters.timeCategories!.includes(c))
      : TIME_CATEGORIES;
    // データに実際に存在する値も漏れなく含める（定義リスト外の新規値への対応）
    const uniqueInData = [...new Set(allRows.map((r) => r["時間振り"]).filter(Boolean))];
    const extraCats = uniqueInData.filter((c) => !selectedOrAll.includes(c));
    const categoriesToProcess = [...selectedOrAll, ...extraCats];

    const zip = new JSZip();
    const savedHistory: Promise<void>[] = [];
    let fileIndex = 0;

    for (const timeCategory of categoriesToProcess) {
      const categoryRows = allRows.filter((r) => r["時間振り"] === timeCategory);
      if (categoryRows.length === 0) continue;

      const listNum = startListNumber + fileIndex;
      fileIndex++;

      const csv = BOM + generateEvercallCSV(categoryRows);
      const fileName = `${padListNumber(listNum)}${listGroup ? `【${listGroup}】` : "_"}${timeCategory}_${seatCondition}_${exportDate}.csv`;
      zip.file(fileName, csv);

      savedHistory.push(
        saveExportHistory(
          uuidv4(),
          listNum,
          listGroup,
          timeCategory,
          seatCondition,
          exportDate,
          fileName,
          categoryRows.length
        )
      );
    }

    if (fileIndex === 0) {
      return NextResponse.json({ success: false, message: "該当する時間振りデータが0件です" }, { status: 400 });
    }

    await Promise.all(savedHistory);

    // ── エクスポート対象の電話番号を evercall_invested に自動登録 ──
    // ZIPダウンロード完了と同時に、選択したリストグループで投入済みとして記録する
    const phones = allRows
      .map(r => r["電話番号"])
      .filter((p): p is string => typeof p === "string" && p.trim() !== "");
    if (phones.length > 0) {
      try {
        await bulkInsertEvercallInvested(phones, listGroup, exportDate);
      } catch (e) {
        // 投入フラグ登録の失敗はZIPダウンロードをブロックしない（ログのみ）
        console.error("evercall_invested 登録エラー:", e);
      }
    }

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    const zipFileName = `${listGroup}_エクスポート_${exportDate}.zip`;

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(zipFileName)}`,
      },
    });
  } catch (error) {
    console.error("ZIP export error:", error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json({
      success: false,
      message: "ZIPエクスポート処理中にエラーが発生しました",
      detail,
    }, { status: 500 });
  }
}
