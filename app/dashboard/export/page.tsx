"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// ─── 定数 ────────────────────────────────────────────────
// DB実在値（count降順）
const TIME_CATEGORIES = [
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

// DB実在値（count降順、空文字・null除外）
const GENRE_OPTIONS = [
  "居酒屋・バー",
  "カフェ・軽飲食",
  "和食",
  "肉料理",
  "レストラン・多国籍",
  "アジア料理",
  "洋食",
  "うどん/そば",
  "その他飲食店",
  "ラーメン",
  "粉もの・鉄板",
  "なし",
  "情報不足",
  "バー",
];

// DB実在値（count降順、空文字除外）
const BIKOU_OPTIONS = [
  "なし",
  "ディナー営業なし",
  "時間30未満",
  "スナック/クラブ",
  "テイクアウト専門店",
  "商業施設内店舗",
  "単価8000円以上",
  "完全予約制/コースのみ",
  "リニューアル/移転",
  "全個室",
];

const LIST_GROUPS = ["飲食SH", "サイネージ"];

// ─── 型定義 ───────────────────────────────────────────────
interface ExportFilters {
  genres: string[];
  timeCategories: string[];
  seatMin: string;
  seatMax: string;
  bikou: string[];
  excludeInvested: boolean;
}

interface TimeCategoryItem { name: string; count: number }
interface PreviewData { total: number; time_categories: TimeCategoryItem[] }
interface Template { id: string; name: string; filters: ExportFilters; created_at: string }
interface HistoryItem {
  id: string; list_number: number; list_group: string; time_category: string;
  seat_condition: string; export_date: string; file_name: string; row_count: number; created_at: string
}

const EMPTY_FILTERS: ExportFilters = { genres: [], timeCategories: [], seatMin: "", seatMax: "", bikou: [], excludeInvested: false };

function todayYMD() { return new Date().toISOString().slice(0, 10).replace(/-/g, ""); }

function buildSeatConditionText(min: string, max: string): string {
  const mn = min ? Number(min) : undefined;
  const mx = max ? Number(max) : undefined;
  if (mn !== undefined && mx !== undefined) return mn === mx ? `${mn}席` : `${mn}-${mx}席`;
  if (mn !== undefined) return `${mn}席以上`;
  if (mx !== undefined) return `${mx}席以下`;
  return "条件なし";
}

function padNum(n: number) { return String(n).padStart(4, "0"); }

// ─── MultiSelect ドロップダウン ──────────────────────────
function MultiSelect({
  options,
  value,
  onChange,
  placeholder,
}: { options: string[]; value: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOut(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOut);
    return () => document.removeEventListener("mousedown", onClickOut);
  }, []);

  function toggle(opt: string) {
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);
  }

  const label =
    value.length === 0
      ? placeholder
      : value.length === 1
      ? value[0]
      : `${value.length}件選択`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-300 ${
          value.length > 0 ? "border-blue-300 text-gray-800" : "border-gray-200 text-gray-400"
        }`}
      >
        <span className="truncate">{label}</span>
        <svg
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
          className={`w-3.5 h-3.5 ml-1 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {/* クリアボタン */}
          {value.length > 0 && (
            <button
              type="button"
              onClick={() => { onChange([]); setOpen(false); }}
              className="w-full px-3 py-2 text-xs text-left text-gray-400 hover:bg-gray-50 border-b border-gray-100"
            >
              ✕ 選択をクリア
            </button>
          )}
          {options.map((opt) => (
            <label
              key={opt}
              className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={value.includes(opt)}
                onChange={() => toggle(opt)}
                className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-sm text-gray-700 select-none">{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── メインページ ─────────────────────────────────────────
export default function ExportPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<ExportFilters>(EMPTY_FILTERS);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);

  const [listGroup, setListGroup] = useState("飲食SH");
  const [startListNumber, setStartListNumber] = useState("1");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) { router.push("/login"); return; }
    Promise.all([
      fetchPreviewNow(token, EMPTY_FILTERS),
      fetchTemplates(token),
    ]).finally(() => setInitialLoading(false));
  }, [router]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const token = localStorage.getItem("auth_token");
      if (token) fetchPreviewNow(token, filters);
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [filters]);

  async function fetchPreviewNow(token: string, f: ExportFilters) {
    setPreviewLoading(true);
    try {
      const sp = new URLSearchParams();
      f.genres.forEach((g) => sp.append("genres", g));
      f.timeCategories.forEach((t) => sp.append("timeCategories", t));
      f.bikou.forEach((b) => sp.append("bikou", b));
      if (f.seatMin) sp.set("seatMin", f.seatMin);
      if (f.seatMax) sp.set("seatMax", f.seatMax);
      if (f.excludeInvested) sp.set("excludeInvested", "true");

      const res = await fetch(`/api/export/preview?${sp}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setPreview(data);
    } catch (e) { console.error(e); }
    finally { setPreviewLoading(false); }
  }

  async function fetchTemplates(token: string) {
    const res = await fetch("/api/export/templates", { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.success) setTemplates(data.templates);
  }

  async function fetchHistory(token: string) {
    const res = await fetch("/api/export/history", { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.success) setHistory(data.history);
  }

  function setFilter<K extends keyof ExportFilters>(key: K, val: ExportFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: val }));
  }

  async function saveTemplate() {
    if (!templateName.trim()) return;
    const token = localStorage.getItem("auth_token");
    if (!token) return;
    setSavingTemplate(true);
    try {
      await fetch("/api/export/templates", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: templateName.trim(), filters }),
      });
      setTemplateName("");
      await fetchTemplates(token);
    } finally { setSavingTemplate(false); }
  }

  async function deleteTemplate(id: string) {
    const token = localStorage.getItem("auth_token");
    if (!token) return;
    await fetch(`/api/export/templates/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    await fetchTemplates(token);
  }

  function applyTemplate(tmpl: Template) {
    setFilters({ ...EMPTY_FILTERS, ...tmpl.filters });
  }

  async function handleZipExport() {
    const token = localStorage.getItem("auth_token");
    if (!token) return;
    const startNum = parseInt(startListNumber);
    if (isNaN(startNum) || startNum < 1 || startNum > 9999) {
      setExportError("リスト番号は1〜9999の整数を入力してください");
      return;
    }
    setExporting(true);
    setExportError("");
    try {
      const exportDate = todayYMD();
      const res = await fetch("/api/export/zip", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          filters: {
            genres: filters.genres.length > 0 ? filters.genres : undefined,
            timeCategories: filters.timeCategories.length > 0 ? filters.timeCategories : undefined,
            seatMin: filters.seatMin ? Number(filters.seatMin) : undefined,
            seatMax: filters.seatMax ? Number(filters.seatMax) : undefined,
            bikou: filters.bikou.length > 0 ? filters.bikou : undefined,
            excludeInvested: filters.excludeInvested || undefined,
          },
          listGroup,
          startListNumber: startNum,
          exportDate,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setExportError(err.message ?? "エクスポートに失敗しました");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `飲食_エクスポート_${exportDate}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      if (showHistory) fetchHistory(token);
    } catch (e) {
      console.error(e);
      setExportError("通信エラーが発生しました");
    } finally { setExporting(false); }
  }

  async function handleSingleExport() {
    const token = localStorage.getItem("auth_token");
    if (!token) return;
    setExporting(true);
    setExportError("");
    try {
      const today = todayYMD();
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          filters: {
            genres: filters.genres.length > 0 ? filters.genres : undefined,
            timeCategories: filters.timeCategories.length > 0 ? filters.timeCategories : undefined,
            seatMin: filters.seatMin ? Number(filters.seatMin) : undefined,
            seatMax: filters.seatMax ? Number(filters.seatMax) : undefined,
            bikou: filters.bikou.length > 0 ? filters.bikou : undefined,
            excludeInvested: filters.excludeInvested || undefined,
          },
          fileName: `飲食_架電リスト_${today}.csv`,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setExportError(err.message ?? "エクスポートに失敗しました");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `飲食_架電リスト_${today}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      setExportError("通信エラーが発生しました");
    } finally { setExporting(false); }
  }

  // ─── 計算値 ─────────────────────────────────────────────
  const seatConditionText = buildSeatConditionText(filters.seatMin, filters.seatMax);
  const hasAnyFilter = filters.genres.length > 0 || filters.timeCategories.length > 0 ||
    filters.seatMin !== "" || filters.seatMax !== "" || filters.bikou.length > 0 || filters.excludeInvested;
  const startNum = parseInt(startListNumber) || 1;
  const isStartNumValid = !isNaN(parseInt(startListNumber)) && parseInt(startListNumber) >= 1 && parseInt(startListNumber) <= 9999;

  // 選択された時間振りカテゴリ（なければ全9区分）を対象に、件数のある順でファイル一覧を生成
  const categoriesToShow = filters.timeCategories.length > 0
    ? TIME_CATEGORIES.filter((c) => filters.timeCategories.includes(c))
    : TIME_CATEGORIES;

  const expectedFiles: { fileName: string; count: number; cat: string }[] = [];
  let fileIdx = 0;
  for (const cat of categoriesToShow) {
    const count = preview?.time_categories.find((c) => c.name === cat)?.count ?? 0;
    if (count === 0) continue;
    const listNum = startNum + fileIdx;
    fileIdx++;
    expectedFiles.push({
      cat,
      count,
      fileName: `${padNum(listNum)}【${listGroup}】${cat}_${seatConditionText}_${todayYMD()}.csv`,
    });
  }

  const totalFilteredCount = expectedFiles.reduce((s, f) => s + f.count, 0);
  const maxCategoryCount = Math.max(1, ...(preview?.time_categories.map((c) => c.count) ?? []));

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl">
      {/* ヘッダー */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">エクスポート</h1>
        <p className="text-sm text-gray-500 mt-1">全データからフィルタリングしてCSVをエクスポート</p>
      </div>

      {exportError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
          {exportError}
        </div>
      )}

      {/* ─── フィルタ条件 ─── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">フィルタ条件</h2>
          {hasAnyFilter && (
            <button onClick={() => setFilters(EMPTY_FILTERS)} className="text-xs text-gray-400 hover:text-gray-700 underline">
              条件をクリア
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 時間振り */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              時間振り
              {filters.timeCategories.length > 0 && (
                <span className="ml-2 text-blue-600 font-normal">{filters.timeCategories.length}件選択</span>
              )}
            </label>
            <MultiSelect
              options={TIME_CATEGORIES}
              value={filters.timeCategories}
              onChange={(v) => setFilter("timeCategories", v)}
              placeholder="すべて（選択なし）"
            />
          </div>

          {/* ジャンル */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              ジャンル
              {filters.genres.length > 0 && (
                <span className="ml-2 text-blue-600 font-normal">{filters.genres.length}件選択</span>
              )}
            </label>
            <MultiSelect
              options={GENRE_OPTIONS}
              value={filters.genres}
              onChange={(v) => setFilter("genres", v)}
              placeholder="すべて（選択なし）"
            />
          </div>

          {/* 席数 */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              席数
              {seatConditionText !== "条件なし" && (
                <span className="ml-2 text-blue-600 font-normal">→ {seatConditionText}</span>
              )}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={filters.seatMin}
                onChange={(e) => setFilter("seatMin", e.target.value)}
                placeholder="以上"
                min={0}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
              />
              <span className="text-gray-400 text-sm shrink-0">〜</span>
              <input
                type="number"
                value={filters.seatMax}
                onChange={(e) => setFilter("seatMax", e.target.value)}
                placeholder="以下"
                min={0}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
              />
            </div>
          </div>

          {/* 備考 */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              備考
              {filters.bikou.length > 0 && (
                <span className="ml-2 text-blue-600 font-normal">{filters.bikou.length}件選択</span>
              )}
            </label>
            <MultiSelect
              options={BIKOU_OPTIONS}
              value={filters.bikou}
              onChange={(v) => setFilter("bikou", v)}
              placeholder="すべて（選択なし）"
            />
          </div>
        </div>

        {/* 投入済み除外チェック */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filters.excludeInvested}
              onChange={(e) => setFilter("excludeInvested", e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <span className="text-sm text-gray-700">
              Everycall投入済みを除外
              <span className="ml-1.5 text-xs text-gray-400">（everycall_invested に登録された番号を対象外にする）</span>
            </span>
          </label>
        </div>
      </div>

      {/* ─── テンプレート ─── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-5">
        <h2 className="text-base font-semibold text-gray-900 mb-4">抽出テンプレート</h2>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveTemplate()}
            placeholder="テンプレート名を入力して保存"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
          />
          <button
            onClick={saveTemplate}
            disabled={!templateName.trim() || savingTemplate}
            className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-40 shrink-0"
          >
            {savingTemplate ? "保存中..." : "保存"}
          </button>
        </div>
        {templates.length === 0 ? (
          <p className="text-xs text-gray-400">保存済みテンプレートはありません</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {templates.map((tmpl) => (
              <div key={tmpl.id} className="flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 bg-gray-100 rounded-full text-sm">
                <button onClick={() => applyTemplate(tmpl)} className="text-gray-700 hover:text-gray-900">
                  {tmpl.name}
                </button>
                <button onClick={() => deleteTemplate(tmpl.id)} className="text-gray-300 hover:text-red-500 text-xs leading-none">
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── 時間振り別件数プレビュー ─── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">時間振り別件数プレビュー</h2>
          <span className={`text-sm font-semibold ${previewLoading ? "text-gray-400" : "text-gray-900"}`}>
            {previewLoading ? "更新中..." : `合計 ${(preview?.total ?? 0).toLocaleString()} 件`}
          </span>
        </div>

        <div className="space-y-2">
          {TIME_CATEGORIES.map((cat) => {
            const item = preview?.time_categories.find((c) => c.name === cat);
            const count = item?.count ?? 0;
            const isSelected = filters.timeCategories.length === 0 || filters.timeCategories.includes(cat);
            const pct = count === 0 ? 0 : (count / maxCategoryCount) * 100;
            return (
              <div key={cat} className={`flex items-center gap-3 ${!isSelected ? "opacity-30" : ""}`}>
                <span className="text-xs text-gray-600 w-32 shrink-0">{cat}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${count > 0 ? "bg-blue-500" : "bg-gray-200"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className={`text-xs font-medium w-16 text-right shrink-0 ${count > 0 ? "text-blue-700" : "text-gray-300"}`}>
                  {count.toLocaleString()} 件
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── ZIPエクスポート ─── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-5">
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          ZIP エクスポート
          <span className="text-xs font-normal text-gray-400 ml-2">時間振り別に分割してまとめてダウンロード</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          {/* リストグループ */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">リストグループ</label>
            <select
              value={listGroup}
              onChange={(e) => setListGroup(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
            >
              {LIST_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          {/* リスト開始番号（手入力） */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              リスト開始番号
              <span className="text-gray-300 ml-1">（1〜9999）</span>
            </label>
            <input
              type="number"
              value={startListNumber}
              onChange={(e) => setStartListNumber(e.target.value)}
              min={1}
              max={9999}
              placeholder="例: 1234"
              className={`w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-300 ${
                isStartNumValid ? "border-gray-200" : "border-red-300 bg-red-50"
              }`}
            />
            {!isStartNumValid && startListNumber !== "" && (
              <p className="text-xs text-red-500 mt-1">1〜9999の整数を入力してください</p>
            )}
          </div>

          {/* 席数条件（自動生成） */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">席数条件（自動生成）</label>
            <div className="flex items-center border border-gray-200 rounded-lg px-3 py-2 bg-gray-50">
              <span className="text-sm text-gray-700">{seatConditionText}</span>
            </div>
          </div>
        </div>

        {/* エクスポートされる全ファイルプレビュー */}
        <div className="bg-gray-50 rounded-lg p-4 mb-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-gray-500">
              エクスポートされるファイル
              {expectedFiles.length > 0 && (
                <span className="ml-2 text-gray-400">（{expectedFiles.length}ファイル・計{totalFilteredCount.toLocaleString()}件）</span>
              )}
            </p>
            <span className="text-xs text-gray-400">飲食_エクスポート_{todayYMD()}.zip</span>
          </div>

          {expectedFiles.length === 0 ? (
            <p className="text-sm text-gray-400 py-2">
              {previewLoading ? "更新中..." : "条件に合致するデータがありません"}
            </p>
          ) : (
            <div className="space-y-1">
              {expectedFiles.map((f) => (
                <div key={f.cat} className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono text-gray-600 truncate">{f.fileName}</span>
                  <span className="text-xs text-blue-600 font-medium shrink-0">{f.count.toLocaleString()}件</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={handleZipExport}
          disabled={exporting || expectedFiles.length === 0 || !isStartNumValid}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {exporting ? (
            <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />処理中...</>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              ZIPダウンロード
            </>
          )}
          {expectedFiles.length > 0 && (
            <span className="ml-1 text-blue-200 text-xs">{expectedFiles.length}ファイル・{totalFilteredCount.toLocaleString()}件</span>
          )}
        </button>
      </div>

      {/* ─── 単体 CSV エクスポート ─── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-5">
        <h2 className="text-base font-semibold text-gray-900 mb-1">
          単体 CSV エクスポート
          <span className="text-xs font-normal text-gray-400 ml-2">フィルター適用済み全データを1ファイルで出力</span>
        </h2>
        <p className="text-xs text-gray-400 mb-4">ファイル名：飲食_架電リスト_{todayYMD()}.csv</p>
        <button
          onClick={handleSingleExport}
          disabled={exporting || (preview?.total ?? 0) === 0}
          className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {exporting ? (
            <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />処理中...</>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              CSVダウンロード
            </>
          )}
          <span className="ml-1 text-gray-400 text-xs">{(preview?.total ?? 0).toLocaleString()}件</span>
        </button>
      </div>

      {/* ─── エクスポート履歴 ─── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-6 py-4"
          onClick={() => {
            const next = !showHistory;
            setShowHistory(next);
            if (next && history.length === 0) {
              const token = localStorage.getItem("auth_token");
              if (token) fetchHistory(token);
            }
          }}
        >
          <h2 className="text-base font-semibold text-gray-900">エクスポート履歴</h2>
          <svg
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
            className={`w-4 h-4 text-gray-400 transition-transform ${showHistory ? "rotate-180" : ""}`}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        {showHistory && (
          history.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-gray-400">履歴がありません</p>
          ) : (
            <div className="overflow-x-auto border-t border-gray-100">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {["番号", "グループ", "時間振り", "席数条件", "件数", "ファイル名", "日付"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {history.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-gray-700 text-xs">{padNum(item.list_number)}</td>
                      <td className="px-4 py-3 text-gray-700 text-xs">{item.list_group}</td>
                      <td className="px-4 py-3 text-gray-700 text-xs whitespace-nowrap">{item.time_category}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{item.seat_condition}</td>
                      <td className="px-4 py-3 text-gray-700 text-xs">{Number(item.row_count).toLocaleString()}件</td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate font-mono">{item.file_name}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{item.export_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}
