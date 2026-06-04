"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TIME_CATEGORIES, GENRE_OPTIONS, BIKOU_OPTIONS } from "@/lib/constants";

const LIST_GROUPS = ["飲食SH", "サイネージ", "デリバリー", "ペイメント"];

// ─── 型定義 ───────────────────────────────────────────────
interface ExportFilters {
  genres: string[];
  timeCategories: string[];
  seatMin: string;
  seatMax: string;
  bikou: string[];
  excludeInvested: boolean;
  progressGroup: string;  // 最大進捗フィルター対象グループ（空文字=OFF）
  progressMin: string;
  progressMax: string;
}

interface SeisaListFilters {
  timeCategories: string[];
  genres: string[];
  bikou: string[];
  seatMin: string;
  seatMax: string;
  seatBlank: boolean;
  unassignedOnly: boolean;
  excludeName: string;    // 店名除外キーワード（カンマ区切り複数可）
  excludeAddress: string; // 住所除外キーワード（カンマ区切り複数可）
}

interface BatchMember { name: string; count: number; type?: "member" | "team" }
interface BatchItem {
  id: string; created_at: string; created_by: string;
  members: BatchMember[]; total_count: number; current_count: number;
}

interface TimeCategoryItem { name: string; count: number }
interface PreviewData { total: number; time_categories: TimeCategoryItem[] }
interface Template { id: string; name: string; filters: ExportFilters; created_at: string }
interface HistoryItem {
  id: string; list_number: number; list_group: string; time_category: string;
  seat_condition: string; export_date: string; file_name: string; row_count: number; created_at: string
}
interface TeamMember { id: string; name: string }
interface Team { id: string; name: string; members: TeamMember[] }

const EMPTY_FILTERS: ExportFilters = { genres: [], timeCategories: [], seatMin: "", seatMax: "", bikou: [], excludeInvested: false, progressGroup: "", progressMin: "", progressMax: "" };
const PROGRESS_GROUPS = ["全部", "飲食SH", "サイネージ", "デリバリー", "ペイメント"] as const;
const EMPTY_SEISA_FILTERS: SeisaListFilters = { timeCategories: [], genres: [], bikou: [], seatMin: "", seatMax: "", seatBlank: false, unassignedOnly: true, excludeName: "", excludeAddress: "" };

// 精査リスト用：(空白) オプション付き選択肢
const SEISA_TIME_OPTIONS  = ["(空白)", ...TIME_CATEGORIES];
const SEISA_GENRE_OPTIONS = ["(空白)", ...GENRE_OPTIONS];
const SEISA_BIKOU_OPTIONS = ["(空白)", ...BIKOU_OPTIONS];

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
  options, value, onChange, placeholder,
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

  const label = value.length === 0 ? placeholder : value.length === 1 ? value[0] : `${value.length}件選択`;

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-300 ${
          value.length > 0 ? "border-blue-300 text-gray-800" : "border-gray-200 text-gray-400"
        }`}
      >
        <span className="truncate">{label}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
          className={`w-3.5 h-3.5 ml-1 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {value.length > 0 && (
            <button type="button" onClick={() => { onChange([]); setOpen(false); }}
              className="w-full px-3 py-2 text-xs text-left text-gray-400 hover:bg-gray-50 border-b border-gray-100">
              ✕ 選択をクリア
            </button>
          )}
          {options.map((opt) => (
            <label key={opt} className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer">
              <input type="checkbox" checked={value.includes(opt)} onChange={() => toggle(opt)}
                className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
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

  // manager ガード
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) { router.push("/login"); return; }
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (payload.role !== "manager") router.push("/dashboard");
    } catch { router.push("/dashboard"); }
  }, [router]);

  // 精査済みエクスポートタブ
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
  const [exportErrorDetail, setExportErrorDetail] = useState("");
  const [showErrorDetail, setShowErrorDetail] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // 精査リストタブ
  const [seisaFilters, setSeisaFilters] = useState<SeisaListFilters>(EMPTY_SEISA_FILTERS);
  const [seisaTotal, setSeisaTotal] = useState<number | null>(null);
  const [seisaPreviewLoading, setSeisaPreviewLoading] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  // 個人アサイン用
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [countPerMember, setCountPerMember] = useState<string>("");
  // チームアサイン用
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [countPerTeam, setCountPerTeam] = useState<string>("");
  // 共通
  const [exportLimit, setExportLimit] = useState<string>("");
  const [useAutoFill, setUseAutoFill] = useState(false);
  const [assignMode, setAssignMode] = useState<"member" | "team">("member");
  const [seisaExporting, setSeisaExporting] = useState(false);
  const [seisaError, setSeisaError] = useState("");
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [showBatches, setShowBatches] = useState(false);
  const [cancellingBatch, setCancellingBatch] = useState<string | null>(null);

  // タブ
  const [activeTab, setActiveTab] = useState<"main" | "seisalist">("main");

  const [initialLoading, setInitialLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seisaDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── 初期ロード ─────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) { router.push("/login"); return; }
    Promise.all([
      fetchPreviewNow(token, EMPTY_FILTERS),
      fetchTemplates(token),
      fetchTeams(token),
      fetchSeisaTotal(token, EMPTY_SEISA_FILTERS),
    ]).finally(() => setInitialLoading(false));
  }, [router]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── 精査済み: フィルター変更時プレビュー自動更新 ────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const token = localStorage.getItem("auth_token");
      if (token) fetchPreviewNow(token, filters, listGroup);
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [filters, listGroup]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── 精査リスト: フィルター変更時件数自動更新 ──────────
  useEffect(() => {
    if (seisaDebounceRef.current) clearTimeout(seisaDebounceRef.current);
    seisaDebounceRef.current = setTimeout(() => {
      const token = localStorage.getItem("auth_token");
      if (token) fetchSeisaTotal(token, seisaFilters);
    }, 400);
    return () => { if (seisaDebounceRef.current) clearTimeout(seisaDebounceRef.current); };
  }, [seisaFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── チーム切替時にメンバー選択リセット ─────────────────
  useEffect(() => { setSelectedMembers([]); }, [selectedTeamId]);

  // ─── API 関数 ────────────────────────────────────────────
  async function fetchPreviewNow(token: string, f: ExportFilters, lg?: string) {
    setPreviewLoading(true);
    try {
      const sp = new URLSearchParams();
      f.genres.forEach((g) => sp.append("genres", g));
      f.timeCategories.forEach((t) => sp.append("timeCategories", t));
      f.bikou.forEach((b) => sp.append("bikou", b));
      if (f.seatMin) sp.set("seatMin", f.seatMin);
      if (f.seatMax) sp.set("seatMax", f.seatMax);
      if (f.excludeInvested) {
        sp.set("excludeInvested", "true");
        if (lg) sp.set("listGroup", lg);
      }
      if (f.progressGroup) {
        sp.set("progressGroup", f.progressGroup);
        if (f.progressMin) sp.set("progressMin", f.progressMin);
        if (f.progressMax) sp.set("progressMax", f.progressMax);
      }
      const res = await fetch(`/api/export/preview?${sp}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setPreview(data);
    } catch (e) { console.error(e); }
    finally { setPreviewLoading(false); }
  }

  async function fetchSeisaTotal(token: string, f: SeisaListFilters) {
    setSeisaPreviewLoading(true);
    try {
      const sp = new URLSearchParams();
      f.timeCategories.forEach((v) => sp.append("timeCategories", v));
      f.genres.forEach((v) => sp.append("genres", v));
      f.bikou.forEach((v) => sp.append("bikou", v));
      if (f.seatMin)       sp.set("seatMin", f.seatMin);
      if (f.seatMax)       sp.set("seatMax", f.seatMax);
      if (f.seatBlank)       sp.set("seatBlank", "true");
      if (!f.unassignedOnly) sp.set("unassignedOnly", "false");
      if (f.excludeName.trim())    sp.set("excludeName",    f.excludeName.trim());
      if (f.excludeAddress.trim()) sp.set("excludeAddress", f.excludeAddress.trim());
      const res = await fetch(`/api/export/seisa-list?${sp}`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      if (d.success) setSeisaTotal(d.total);
    } catch (e) { console.error(e); }
    finally { setSeisaPreviewLoading(false); }
  }

  async function fetchTemplates(token: string) {
    const res = await fetch("/api/export/templates", { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.success) setTemplates(data.templates);
  }

  async function fetchTeams(token: string) {
    const res = await fetch("/api/teams", { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.success) {
      setTeams(data.teams);
      if (data.teams.length > 0) setSelectedTeamId(data.teams[0].id);
    }
  }

  async function fetchBatches(token: string) {
    const res = await fetch("/api/export/seisa-list/batches", { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.success) setBatches(data.batches);
  }

  async function cancelBatch(id: string) {
    const token = localStorage.getItem("auth_token");
    if (!token) return;
    setCancellingBatch(id);
    try {
      await fetch(`/api/export/seisa-list/batches/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchBatches(token);
      // アサイン件数が変わるのでプレビューも更新
      await fetchSeisaTotal(token, seisaFilters);
    } finally { setCancellingBatch(null); }
  }

  async function fetchHistory(token: string) {
    const res = await fetch("/api/export/history", { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.success) setHistory(data.history);
  }

  // ─── 精査済みエクスポート ────────────────────────────────
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
    await fetch(`/api/export/templates/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    await fetchTemplates(token);
  }

  function applyTemplate(tmpl: Template) { setFilters({ ...EMPTY_FILTERS, ...tmpl.filters }); }

  async function handleZipExport() {
    const token = localStorage.getItem("auth_token");
    if (!token) return;
    const startNum = parseInt(startListNumber);
    if (isNaN(startNum) || startNum < 1 || startNum > 9999) {
      setExportError("リスト番号は1〜9999の整数を入力してください"); return;
    }
    setExporting(true); setExportError(""); setExportErrorDetail(""); setShowErrorDetail(false);
    try {
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
            progressGroup: filters.progressGroup || undefined,
            progressMin: filters.progressMin ? Number(filters.progressMin) : undefined,
            progressMax: filters.progressMax ? Number(filters.progressMax) : undefined,
          },
          listGroup, startListNumber: startNum, exportDate: todayYMD(),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setExportError(err.message ?? "エクスポートに失敗しました");
        setExportErrorDetail(err.detail ?? ""); return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${listGroup}_エクスポート_${todayYMD()}.zip`; a.click();
      URL.revokeObjectURL(url);
      if (showHistory) fetchHistory(token);
    } catch (e) {
      setExportError("通信エラーが発生しました");
      setExportErrorDetail(e instanceof Error ? e.message : String(e));
    } finally { setExporting(false); }
  }

  async function handleSingleExport() {
    const token = localStorage.getItem("auth_token");
    if (!token) return;
    setExporting(true); setExportError(""); setExportErrorDetail(""); setShowErrorDetail(false);
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
            progressGroup: filters.progressGroup || undefined,
            progressMin: filters.progressMin ? Number(filters.progressMin) : undefined,
            progressMax: filters.progressMax ? Number(filters.progressMax) : undefined,
          },
          fileName: `飲食_架電リスト_${today}.csv`,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setExportError(err.message ?? "エクスポートに失敗しました");
        setExportErrorDetail(err.detail ?? ""); return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `飲食_架電リスト_${today}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError("通信エラーが発生しました");
      setExportErrorDetail(e instanceof Error ? e.message : String(e));
    } finally { setExporting(false); }
  }

  // ─── 精査リストエクスポート ──────────────────────────────
  async function handleSeisaListExport() {
    const token = localStorage.getItem("auth_token");
    if (!token) return;
    setSeisaExporting(true); setSeisaError("");
    try {
      // チームアサインの場合: チームIDからチーム名に変換
      const teamNamesForExport = selectedTeamIds.map(id => teams.find(t => t.id === id)?.name ?? id);

      const res = await fetch("/api/export/seisa-list", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          filters: {
            timeCategories: seisaFilters.timeCategories.length > 0 ? seisaFilters.timeCategories : undefined,
            genres:         seisaFilters.genres.length > 0         ? seisaFilters.genres         : undefined,
            bikou:          seisaFilters.bikou.length > 0           ? seisaFilters.bikou          : undefined,
            seatMin:        seisaFilters.seatMin    ? Number(seisaFilters.seatMin) : undefined,
            seatMax:        seisaFilters.seatMax    ? Number(seisaFilters.seatMax) : undefined,
            seatBlank:      seisaFilters.seatBlank  || undefined,
            unassignedOnly: seisaFilters.unassignedOnly || undefined,
            excludeNameKeywords:    seisaFilters.excludeName.trim()
              ? seisaFilters.excludeName.split(",").map(s => s.trim()).filter(Boolean)
              : undefined,
            excludeAddressKeywords: seisaFilters.excludeAddress.trim()
              ? seisaFilters.excludeAddress.split(",").map(s => s.trim()).filter(Boolean)
              : undefined,
          },
          assignMode: useAutoFill ? assignMode : "none",
          // 個人アサイン
          members:        useAutoFill && assignMode === "member" ? selectedMembers : [],
          countPerMember: useAutoFill && assignMode === "member" ? Number(countPerMember) : 0,
          // チームアサイン
          teamNames:    useAutoFill && assignMode === "team" ? teamNamesForExport : [],
          countPerTeam: useAutoFill && assignMode === "team" ? Number(countPerTeam) : 0,
          // 件数上限（アサインなし時のみ）
          exportLimit: !useAutoFill && exportLimit ? Number(exportLimit) : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setSeisaError(err.message ?? "エクスポートに失敗しました"); return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `精査リスト_${todayYMD()}.csv`; a.click();
      URL.revokeObjectURL(url);
      // エクスポート後: バッチ一覧とプレビュー件数を更新
      if (useAutoFill) {
        await fetchBatches(token);
        await fetchSeisaTotal(token, seisaFilters);
      }
    } catch (e) {
      setSeisaError(e instanceof Error ? e.message : "通信エラーが発生しました");
    } finally { setSeisaExporting(false); }
  }

  // ─── 計算値（精査済みタブ）────────────────────────────────
  const seatConditionText = buildSeatConditionText(filters.seatMin, filters.seatMax);
  const hasAnyFilter = filters.genres.length > 0 || filters.timeCategories.length > 0 ||
    filters.seatMin !== "" || filters.seatMax !== "" || filters.bikou.length > 0 || filters.excludeInvested;
  const startNum = parseInt(startListNumber) || 1;
  const isStartNumValid = !isNaN(parseInt(startListNumber)) && parseInt(startListNumber) >= 1 && parseInt(startListNumber) <= 9999;
  const categoriesToShow = filters.timeCategories.length > 0
    ? TIME_CATEGORIES.filter((c) => filters.timeCategories.includes(c))
    : TIME_CATEGORIES;
  const expectedFiles: { fileName: string; count: number; cat: string }[] = [];
  let fileIdx = 0;
  for (const cat of categoriesToShow) {
    const count = preview?.time_categories.find((c) => c.name === cat)?.count ?? 0;
    if (count === 0) continue;
    const listNum = startNum + fileIdx++;
    expectedFiles.push({
      cat, count,
      fileName: `${padNum(listNum)}${listGroup ? `【${listGroup}】` : "_"}${cat}_${seatConditionText}_${todayYMD()}.csv`,
    });
  }
  const totalFilteredCount = expectedFiles.reduce((s, f) => s + f.count, 0);
  const maxCategoryCount   = Math.max(1, ...(preview?.time_categories.map((c) => c.count) ?? []));

  // 精査リスト: 担当者自動入力プレビュー
  const selectedTeam   = teams.find(t => t.id === selectedTeamId);
  const autoFillTotal  =
    useAutoFill && assignMode === "member" && selectedMembers.length > 0 && Number(countPerMember) > 0
      ? selectedMembers.length * Number(countPerMember)
    : useAutoFill && assignMode === "team" && selectedTeamIds.length > 0 && Number(countPerTeam) > 0
      ? selectedTeamIds.length * Number(countPerTeam)
    : null;

  // メンバー全選択/全解除
  const allMembersSelected = selectedTeam?.members.every(m => selectedMembers.includes(m.name)) ?? false;
  function toggleAllMembers() {
    if (!selectedTeam) return;
    setSelectedMembers(allMembersSelected ? [] : selectedTeam.members.map(m => m.name));
  }
  function toggleMember(name: string) {
    setSelectedMembers(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  }

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">エクスポート</h1>
        <p className="text-sm text-gray-500 mt-1">全データからフィルタリングしてCSVをエクスポート</p>
      </div>

      {/* タブ */}
      <div className="flex gap-0 mb-6 border-b border-gray-200">
        {(["main", "seisalist"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-700"
            }`}
          >
            {tab === "main" ? "精査済みエクスポート" : "精査リスト"}
          </button>
        ))}
      </div>

      {/* ════════════ 精査済みエクスポート タブ ════════════ */}
      {activeTab === "main" && <>
        {exportError && (
          <div className="bg-red-50 border border-red-200 rounded-lg mb-6 overflow-hidden">
            <div className="flex items-start justify-between px-4 py-3">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-red-500 shrink-0 mt-0.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-red-700">{exportError}</p>
                  {exportErrorDetail && (
                    <button onClick={() => setShowErrorDetail(v => !v)} className="text-xs text-red-400 hover:text-red-600 mt-1 underline">
                      {showErrorDetail ? "詳細を隠す" : "エラー詳細を表示"}
                    </button>
                  )}
                </div>
              </div>
              <button onClick={() => { setExportError(""); setExportErrorDetail(""); setShowErrorDetail(false); }}
                className="text-red-300 hover:text-red-500 ml-3 shrink-0 text-lg leading-none">×</button>
            </div>
            {showErrorDetail && exportErrorDetail && (
              <div className="px-4 pb-4 border-t border-red-100">
                <div className="mt-3 bg-red-100 rounded p-3 font-mono text-xs text-red-900 break-all whitespace-pre-wrap max-h-48 overflow-y-auto">{exportErrorDetail}</div>
                <button onClick={() => navigator.clipboard.writeText(exportErrorDetail)} className="mt-2 text-xs text-red-400 hover:text-red-600 flex items-center gap-1">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                  </svg>
                  クリップボードにコピー
                </button>
              </div>
            )}
          </div>
        )}

        {/* フィルタ */}
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
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                時間振り {filters.timeCategories.length > 0 && <span className="ml-2 text-blue-600 font-normal">{filters.timeCategories.length}件選択</span>}
              </label>
              <MultiSelect options={TIME_CATEGORIES} value={filters.timeCategories} onChange={(v) => setFilter("timeCategories", v)} placeholder="すべて（選択なし）" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                ジャンル {filters.genres.length > 0 && <span className="ml-2 text-blue-600 font-normal">{filters.genres.length}件選択</span>}
              </label>
              <MultiSelect options={GENRE_OPTIONS} value={filters.genres} onChange={(v) => setFilter("genres", v)} placeholder="すべて（選択なし）" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                席数 {seatConditionText !== "条件なし" && <span className="ml-2 text-blue-600 font-normal">→ {seatConditionText}</span>}
              </label>
              <div className="flex items-center gap-2">
                <input type="number" value={filters.seatMin} onChange={(e) => setFilter("seatMin", e.target.value)} placeholder="以上" min={0}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
                <span className="text-gray-400 text-sm shrink-0">〜</span>
                <input type="number" value={filters.seatMax} onChange={(e) => setFilter("seatMax", e.target.value)} placeholder="以下" min={0}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                備考 {filters.bikou.length > 0 && <span className="ml-2 text-blue-600 font-normal">{filters.bikou.length}件選択</span>}
              </label>
              <MultiSelect options={BIKOU_OPTIONS} value={filters.bikou} onChange={(v) => setFilter("bikou", v)} placeholder="すべて（選択なし）" />
            </div>
          </div>
          {/* 最大進捗フィルター */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <label className="block text-xs font-medium text-gray-500 mb-2">
              結果ランク（最大進捗）で絞り込む
              {filters.progressGroup && (
                <span className="ml-2 text-blue-600 font-normal">
                  {filters.progressGroup}
                  {filters.progressMin && ` ${filters.progressMin}以上`}
                  {filters.progressMax && ` ${filters.progressMax}以下`}
                </span>
              )}
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={filters.progressGroup}
                onChange={(e) => setFilter("progressGroup", e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
              >
                <option value="">絞り込まない</option>
                {PROGRESS_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              {filters.progressGroup && (
                <>
                  <input
                    type="number" min={0} max={10}
                    value={filters.progressMin}
                    onChange={(e) => setFilter("progressMin", e.target.value)}
                    placeholder="0以上"
                    className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                  />
                  <span className="text-gray-400 text-sm">〜</span>
                  <input
                    type="number" min={0} max={10}
                    value={filters.progressMax}
                    onChange={(e) => setFilter("progressMax", e.target.value)}
                    placeholder="10以下"
                    className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                  />
                  <span className="text-xs text-gray-400">（ランク 0〜10）</span>
                </>
              )}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input type="checkbox" checked={filters.excludeInvested} onChange={(e) => setFilter("excludeInvested", e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
              <span className="text-sm text-gray-700">
                Evercall投入済みを除外
                <span className="ml-1.5 text-xs text-gray-400">（evercall_invested に登録された番号を対象外にする）</span>
              </span>
            </label>
          </div>
        </div>

        {/* テンプレート */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">抽出テンプレート</h2>
          <div className="flex gap-2 mb-4">
            <input type="text" value={templateName} onChange={(e) => setTemplateName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveTemplate()} placeholder="テンプレート名を入力して保存"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
            <button onClick={saveTemplate} disabled={!templateName.trim() || savingTemplate}
              className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-40 shrink-0">
              {savingTemplate ? "保存中..." : "保存"}
            </button>
          </div>
          {templates.length === 0 ? (
            <p className="text-xs text-gray-400">保存済みテンプレートはありません</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {templates.map((tmpl) => (
                <div key={tmpl.id} className="flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 bg-gray-100 rounded-full text-sm">
                  <button onClick={() => applyTemplate(tmpl)} className="text-gray-700 hover:text-gray-900">{tmpl.name}</button>
                  <button onClick={() => deleteTemplate(tmpl.id)} className="text-gray-300 hover:text-red-500 text-xs leading-none">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 時間振り別プレビュー */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">時間振り別件数プレビュー</h2>
            <span className={`text-sm font-semibold ${previewLoading ? "text-gray-400" : "text-gray-900"}`}>
              {previewLoading ? "更新中..." : `合計 ${(preview?.total ?? 0).toLocaleString()} 件`}
            </span>
          </div>
          <div className="space-y-2">
            {TIME_CATEGORIES.map((cat) => {
              const count = preview?.time_categories.find((c) => c.name === cat)?.count ?? 0;
              const isSelected = filters.timeCategories.length === 0 || filters.timeCategories.includes(cat);
              const pct = count === 0 ? 0 : (count / maxCategoryCount) * 100;
              return (
                <div key={cat} className={`flex items-center gap-3 ${!isSelected ? "opacity-30" : ""}`}>
                  <span className="text-xs text-gray-600 w-32 shrink-0">{cat}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div className={`h-2 rounded-full transition-all duration-300 ${count > 0 ? "bg-blue-500" : "bg-gray-200"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className={`text-xs font-medium w-16 text-right shrink-0 ${count > 0 ? "text-blue-700" : "text-gray-300"}`}>
                    {count.toLocaleString()} 件
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ZIP エクスポート */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                ZIP エクスポート
                <span className="text-xs font-normal text-gray-400 ml-2">時間振り別に分割してまとめてダウンロード</span>
              </h2>
              <p className="text-xs text-blue-600 mt-0.5">
                ダウンロード時に対象の電話番号を選択リストグループのEvercall投入済みとして自動登録します
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">リストグループ</label>
              <select value={listGroup} onChange={(e) => setListGroup(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300">
                <option value="">　</option>
                {LIST_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                リスト開始番号 <span className="text-gray-300 ml-1">（1〜9999）</span>
              </label>
              <input type="number" value={startListNumber} onChange={(e) => setStartListNumber(e.target.value)}
                min={1} max={9999} placeholder="例: 1234"
                className={`w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-300 ${isStartNumValid ? "border-gray-200" : "border-red-300 bg-red-50"}`} />
              {!isStartNumValid && startListNumber !== "" && (
                <p className="text-xs text-red-500 mt-1">1〜9999の整数を入力してください</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">席数条件（自動生成）</label>
              <div className="flex items-center border border-gray-200 rounded-lg px-3 py-2 bg-gray-50">
                <span className="text-sm text-gray-700">{seatConditionText}</span>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 mb-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-gray-500">
                エクスポートされるファイル
                {expectedFiles.length > 0 && <span className="ml-2 text-gray-400">（{expectedFiles.length}ファイル・計{totalFilteredCount.toLocaleString()}件）</span>}
              </p>
              <span className="text-xs text-gray-400">飲食_エクスポート_{todayYMD()}.zip</span>
            </div>
            {expectedFiles.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">{previewLoading ? "更新中..." : "条件に合致するデータがありません"}</p>
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
          <button onClick={handleZipExport} disabled={exporting || expectedFiles.length === 0 || !isStartNumValid}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            {exporting ? (
              <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />処理中...</>
            ) : (
              <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>ZIPダウンロード</>
            )}
            {expectedFiles.length > 0 && <span className="ml-1 text-blue-200 text-xs">{expectedFiles.length}ファイル・{totalFilteredCount.toLocaleString()}件</span>}
          </button>
        </div>

        {/* 単体 CSV */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-5">
          <h2 className="text-base font-semibold text-gray-900 mb-1">
            単体 CSV エクスポート
            <span className="text-xs font-normal text-gray-400 ml-2">フィルター適用済み全データを1ファイルで出力</span>
          </h2>
          <p className="text-xs text-gray-400 mb-4">ファイル名：飲食_架電リスト_{todayYMD()}.csv</p>
          <button onClick={handleSingleExport} disabled={exporting || (preview?.total ?? 0) === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            {exporting ? (
              <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />処理中...</>
            ) : (
              <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>CSVダウンロード</>
            )}
            <span className="ml-1 text-gray-400 text-xs">{(preview?.total ?? 0).toLocaleString()}件</span>
          </button>
        </div>

        {/* エクスポート履歴 */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <button className="w-full flex items-center justify-between px-6 py-4"
            onClick={() => {
              const next = !showHistory; setShowHistory(next);
              if (next && history.length === 0) {
                const token = localStorage.getItem("auth_token");
                if (token) fetchHistory(token);
              }
            }}>
            <h2 className="text-base font-semibold text-gray-900">エクスポート履歴</h2>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
              className={`w-4 h-4 text-gray-400 transition-transform ${showHistory ? "rotate-180" : ""}`}>
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
      </>}

      {/* ════════════ 精査リスト タブ ════════════ */}
      {activeTab === "seisalist" && (
        <div className="space-y-5">
          {seisaError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex justify-between">
              <span>{seisaError}</span>
              <button onClick={() => setSeisaError("")} className="text-red-300 hover:text-red-500 ml-2">×</button>
            </div>
          )}

          {/* フィルタ条件 */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">フィルタ条件</h2>
              <div className="flex items-center gap-4">
                <span className={`text-sm font-semibold ${seisaPreviewLoading ? "text-gray-400" : "text-gray-900"}`}>
                  {seisaPreviewLoading ? "集計中..." : seisaTotal !== null ? `対象: ${seisaTotal.toLocaleString()} 件` : ""}
                </span>
                {(seisaFilters.timeCategories.length > 0 || seisaFilters.genres.length > 0 ||
                  seisaFilters.bikou.length > 0 || seisaFilters.seatMin || seisaFilters.seatMax ||
                  seisaFilters.seatBlank || !seisaFilters.unassignedOnly ||
                  seisaFilters.excludeName || seisaFilters.excludeAddress) && (
                  <button onClick={() => setSeisaFilters(EMPTY_SEISA_FILTERS)} className="text-xs text-gray-400 hover:text-gray-700 underline">
                    条件をクリア
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  時間振り {seisaFilters.timeCategories.length > 0 && <span className="ml-2 text-blue-600 font-normal">{seisaFilters.timeCategories.length}件選択</span>}
                </label>
                <MultiSelect options={SEISA_TIME_OPTIONS} value={seisaFilters.timeCategories}
                  onChange={(v) => setSeisaFilters(p => ({ ...p, timeCategories: v }))} placeholder="すべて（選択なし）" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  ジャンル {seisaFilters.genres.length > 0 && <span className="ml-2 text-blue-600 font-normal">{seisaFilters.genres.length}件選択</span>}
                </label>
                <MultiSelect options={SEISA_GENRE_OPTIONS} value={seisaFilters.genres}
                  onChange={(v) => setSeisaFilters(p => ({ ...p, genres: v }))} placeholder="すべて（選択なし）" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  席数
                  {(seisaFilters.seatMin || seisaFilters.seatMax) && (
                    <span className="ml-2 text-blue-600 font-normal">→ {buildSeatConditionText(seisaFilters.seatMin, seisaFilters.seatMax)}</span>
                  )}
                  {seisaFilters.seatBlank && <span className="ml-2 text-blue-600 font-normal">+ 空白</span>}
                </label>
                <div className="flex items-center gap-2">
                  <input type="number" value={seisaFilters.seatMin} onChange={(e) => setSeisaFilters(p => ({ ...p, seatMin: e.target.value }))}
                    placeholder="以上" min={0} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
                  <span className="text-gray-400 text-sm shrink-0">〜</span>
                  <input type="number" value={seisaFilters.seatMax} onChange={(e) => setSeisaFilters(p => ({ ...p, seatMax: e.target.value }))}
                    placeholder="以下" min={0} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
                </div>
                <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
                  <input type="checkbox" checked={seisaFilters.seatBlank}
                    onChange={(e) => setSeisaFilters(p => ({ ...p, seatBlank: e.target.checked }))}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  <span className="text-xs text-gray-600">空白を含む</span>
                </label>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  備考 {seisaFilters.bikou.length > 0 && <span className="ml-2 text-blue-600 font-normal">{seisaFilters.bikou.length}件選択</span>}
                </label>
                <MultiSelect options={SEISA_BIKOU_OPTIONS} value={seisaFilters.bikou}
                  onChange={(v) => setSeisaFilters(p => ({ ...p, bikou: v }))} placeholder="すべて（選択なし）" />
              </div>
            </div>
            {/* 除外キーワード */}
            <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  店名除外キーワード
                  <span className="ml-1.5 text-gray-400 font-normal">カンマ区切りで複数指定可</span>
                  {seisaFilters.excludeName && (
                    <span className="ml-2 text-red-500 font-normal">
                      除外中: {seisaFilters.excludeName.split(",").filter(s => s.trim()).length}件
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={seisaFilters.excludeName}
                  onChange={(e) => setSeisaFilters(p => ({ ...p, excludeName: e.target.value }))}
                  placeholder="例: ローソン,セブンイレブン,ファミリーマート"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                <p className="text-xs text-gray-400 mt-1">入力したキーワードを含む店名を除外します</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  住所除外キーワード
                  <span className="ml-1.5 text-gray-400 font-normal">カンマ区切りで複数指定可</span>
                  {seisaFilters.excludeAddress && (
                    <span className="ml-2 text-red-500 font-normal">
                      除外中: {seisaFilters.excludeAddress.split(",").filter(s => s.trim()).length}件
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={seisaFilters.excludeAddress}
                  onChange={(e) => setSeisaFilters(p => ({ ...p, excludeAddress: e.target.value }))}
                  placeholder="例: 東京都,大阪府"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                <p className="text-xs text-gray-400 mt-1">住所1・住所2 いずれかにキーワードを含む場合に除外します</p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input type="checkbox" checked={seisaFilters.unassignedOnly}
                  onChange={(e) => setSeisaFilters(p => ({ ...p, unassignedOnly: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                <span className="text-sm text-gray-700">
                  未アサインのみ
                  <span className="ml-1.5 text-xs text-gray-400">（担当者自動入力でエクスポート済みのレコードを除外）</span>
                </span>
              </label>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 mb-2">出力カラム</p>
              <div className="flex flex-wrap gap-1.5">
                {["名前（店名）", "電話番号", "住所1", "住所2", "時間振り", "定休日", "席数", "ジャンル", "備考", "担当者"].map(c => (
                  <span key={c} className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-full text-xs">{c}</span>
                ))}
              </div>
            </div>
          </div>

          {/* アサイン設定 */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">アサイン設定</h2>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={useAutoFill} onChange={(e) => setUseAutoFill(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <span className="text-sm text-gray-700">有効にする</span>
              </label>
            </div>

            {!useAutoFill ? (
              <p className="text-sm text-gray-400">有効にすると、エクスポート時にレコードをアサインして重複を防ぎます。</p>
            ) : (
              <div className="space-y-5">
                {/* アサイン方式 */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">アサイン方式</label>
                  <div className="flex rounded-lg border border-gray-300 overflow-hidden w-fit">
                    <button onClick={() => setAssignMode("team")}
                      className={`px-4 py-2 text-sm font-medium transition-colors ${
                        assignMode === "team" ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      チームアサイン
                    </button>
                    <button onClick={() => setAssignMode("member")}
                      className={`px-4 py-2 text-sm font-medium border-l border-gray-300 transition-colors ${
                        assignMode === "member" ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      個人アサイン
                    </button>
                  </div>
                  {assignMode === "team" && (
                    <p className="text-xs text-gray-400 mt-1.5">担当者列は空白のままアサインします。アサイン履歴にチーム名で記録されます。</p>
                  )}
                </div>

                {/* ─── チームアサイン ─── */}
                {assignMode === "team" && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-2">
                        チーム選択
                        {selectedTeamIds.length > 0 && <span className="ml-2 text-blue-600 font-normal">{selectedTeamIds.length}チーム選択</span>}
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {teams.map(team => (
                          <label key={team.id}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer select-none transition-colors ${
                              selectedTeamIds.includes(team.id)
                                ? "bg-blue-50 border-blue-300 text-blue-800"
                                : "bg-white border-gray-200 text-gray-700 hover:border-gray-400"
                            }`}
                          >
                            <input type="checkbox"
                              checked={selectedTeamIds.includes(team.id)}
                              onChange={() => setSelectedTeamIds(prev =>
                                prev.includes(team.id) ? prev.filter(id => id !== team.id) : [...prev, team.id]
                              )}
                              className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                            <span className="text-sm">{team.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-end gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">1チームあたり件数</label>
                        <div className="flex items-center gap-2">
                          <input type="number" value={countPerTeam} onChange={(e) => setCountPerTeam(e.target.value)}
                            min={1} placeholder="例: 200"
                            className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                          <span className="text-sm text-gray-500">件</span>
                        </div>
                      </div>
                      {autoFillTotal !== null && (
                        <div className="pb-2">
                          <p className="text-sm text-gray-700">
                            <span className="font-semibold text-blue-600">{selectedTeamIds.length}チーム</span>
                            <span className="text-gray-400 mx-1">×</span>
                            <span className="font-semibold text-blue-600">{Number(countPerTeam).toLocaleString()}件</span>
                            <span className="text-gray-400 mx-1">=</span>
                            <span className="font-bold text-gray-900">{autoFillTotal.toLocaleString()}件</span>
                            {seisaTotal !== null && autoFillTotal > seisaTotal && (
                              <span className="ml-2 text-xs text-amber-600">（対象{seisaTotal.toLocaleString()}件未満）</span>
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                    {selectedTeamIds.length > 0 && Number(countPerTeam) > 0 && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs font-medium text-gray-500 mb-2">割当プレビュー（担当者列は空白）</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedTeamIds.map((id, i) => {
                            const t = teams.find(t => t.id === id);
                            return t ? (
                              <div key={id} className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-xs">
                                <span className="text-gray-500">{i + 1}.</span>
                                <span className="font-medium text-gray-800">{t.name}</span>
                                <span className="text-blue-600">{Number(countPerTeam).toLocaleString()}件</span>
                              </div>
                            ) : null;
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* ─── 個人アサイン ─── */}
                {assignMode === "member" && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-2">チーム選択（メンバー絞り込み）</label>
                      <div className="flex flex-wrap gap-2">
                        {teams.map(team => (
                          <button key={team.id} onClick={() => setSelectedTeamId(team.id)}
                            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                              selectedTeamId === team.id
                                ? "bg-gray-900 text-white border-gray-900"
                                : "bg-white text-gray-700 border-gray-300 hover:border-gray-500"
                            }`}
                          >
                            {team.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {selectedTeam && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-medium text-gray-500">
                            メンバー選択
                            {selectedMembers.length > 0 && <span className="ml-2 text-blue-600 font-normal">{selectedMembers.length}人選択</span>}
                          </label>
                          <button onClick={toggleAllMembers} className="text-xs text-gray-400 hover:text-gray-700 underline">
                            {allMembersSelected ? "全解除" : "全選択"}
                          </button>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                          {selectedTeam.members.map(m => (
                            <label key={m.id}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer select-none transition-colors ${
                                selectedMembers.includes(m.name)
                                  ? "bg-blue-50 border-blue-300 text-blue-800"
                                  : "bg-white border-gray-200 text-gray-700 hover:border-gray-400"
                              }`}
                            >
                              <input type="checkbox" checked={selectedMembers.includes(m.name)} onChange={() => toggleMember(m.name)}
                                className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                              <span className="text-sm">{m.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-end gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">1人あたり件数</label>
                        <div className="flex items-center gap-2">
                          <input type="number" value={countPerMember} onChange={(e) => setCountPerMember(e.target.value)}
                            min={1} placeholder="例: 50"
                            className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                          <span className="text-sm text-gray-500">件</span>
                        </div>
                      </div>
                      {autoFillTotal !== null && (
                        <div className="pb-2">
                          <p className="text-sm text-gray-700">
                            <span className="font-semibold text-blue-600">{selectedMembers.length}人</span>
                            <span className="text-gray-400 mx-1">×</span>
                            <span className="font-semibold text-blue-600">{Number(countPerMember).toLocaleString()}件</span>
                            <span className="text-gray-400 mx-1">=</span>
                            <span className="font-bold text-gray-900">{autoFillTotal.toLocaleString()}件</span>
                            {seisaTotal !== null && autoFillTotal > seisaTotal && (
                              <span className="ml-2 text-xs text-amber-600">（対象{seisaTotal.toLocaleString()}件未満）</span>
                            )}
                          </p>
                        </div>
                      )}
                    </div>

                    {selectedMembers.length > 0 && Number(countPerMember) > 0 && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs font-medium text-gray-500 mb-2">割当プレビュー（担当者列に名前入力）</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedMembers.map((name, i) => (
                            <div key={name} className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-xs">
                              <span className="text-gray-500">{i + 1}.</span>
                              <span className="font-medium text-gray-800">{name}</span>
                              <span className="text-blue-600">{Number(countPerMember).toLocaleString()}件</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* エクスポートボタン */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            {/* 任意件数指定（自動入力OFFのときのみ表示） */}
            {!useAutoFill && (
              <div className="mb-4 pb-4 border-b border-gray-100">
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  最大エクスポート件数
                  <span className="ml-1.5 text-gray-400 font-normal">（空白 = 全件）</span>
                </label>
                <div className="flex items-center gap-2">
                  <input type="number" value={exportLimit} onChange={(e) => setExportLimit(e.target.value)}
                    min={1} placeholder={`最大 ${(seisaTotal ?? 0).toLocaleString()} 件`}
                    className="w-44 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  <span className="text-sm text-gray-500">件</span>
                  {exportLimit && Number(exportLimit) > 0 && seisaTotal !== null && Number(exportLimit) > seisaTotal && (
                    <span className="text-xs text-amber-600">（対象 {seisaTotal.toLocaleString()} 件未満）</span>
                  )}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-700 font-medium">精査リスト_{ todayYMD() }.csv</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {useAutoFill && autoFillTotal !== null
                    ? `${autoFillTotal.toLocaleString()}件（担当者自動入力）`
                    : exportLimit && Number(exportLimit) > 0
                      ? `${Math.min(Number(exportLimit), seisaTotal ?? 0).toLocaleString()}件`
                      : `${(seisaTotal ?? 0).toLocaleString()}件（全件）`
                  }
                </p>
              </div>
              <button
                onClick={handleSeisaListExport}
                disabled={
                  seisaExporting ||
                  (seisaTotal ?? 0) === 0 ||
                  (useAutoFill && assignMode === "member" && (selectedMembers.length === 0 || !countPerMember || Number(countPerMember) < 1)) ||
                  (useAutoFill && assignMode === "team"   && (selectedTeamIds.length === 0  || !countPerTeam   || Number(countPerTeam)   < 1))
                }
                className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {seisaExporting ? (
                  <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />処理中...</>
                ) : (
                  <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>CSVダウンロード</>
                )}
              </button>
            </div>
          </div>

          {/* ── アサイン履歴 ── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-6 py-4"
              onClick={() => {
                const next = !showBatches;
                setShowBatches(next);
                if (next) {
                  const token = localStorage.getItem("auth_token");
                  if (token) fetchBatches(token);
                }
              }}
            >
              <h2 className="text-base font-semibold text-gray-900">アサイン履歴</h2>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                className={`w-4 h-4 text-gray-400 transition-transform ${showBatches ? "rotate-180" : ""}`}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            {showBatches && (
              batches.length === 0 ? (
                <p className="px-6 pb-6 text-sm text-gray-400">履歴がありません</p>
              ) : (
                <div className="border-t border-gray-100 divide-y divide-gray-100">
                  {batches.map(b => {
                    const isCancelled = b.current_count === 0 && b.total_count > 0;
                    return (
                      <div key={b.id} className="px-5 py-3 flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-gray-400 shrink-0">
                              {new Date(b.created_at).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </span>
                            <span className="text-xs text-gray-500 shrink-0">{b.created_by}</span>
                            {isCancelled && (
                              <span className="text-xs text-red-400 bg-red-50 px-1.5 py-0.5 rounded">取り消し済み</span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {b.members.map(m => {
                              const isTeam = (m as BatchMember & { type?: string }).type === "team";
                              return (
                                <span key={m.name} className={`inline-flex items-center gap-1 px-2 py-0.5 border rounded-full text-xs ${
                                  isTeam
                                    ? "bg-purple-50 text-purple-700 border-purple-100"
                                    : "bg-blue-50 text-blue-700 border-blue-100"
                                }`}>
                                  {isTeam && <span className="text-purple-400 text-xs">チーム</span>}
                                  {m.name}
                                  <span className={isTeam ? "text-purple-400" : "text-blue-400"}>×{m.count.toLocaleString()}</span>
                                </span>
                              );
                            })}
                            <span className="text-xs text-gray-500 self-center">
                              = <span className="font-medium text-gray-700">{b.total_count.toLocaleString()}件</span>
                              {b.current_count !== b.total_count && (
                                <span className="ml-1 text-gray-400">（残{b.current_count.toLocaleString()}件）</span>
                              )}
                            </span>
                          </div>
                        </div>
                        {!isCancelled && (
                          <button
                            onClick={() => cancelBatch(b.id)}
                            disabled={cancellingBatch === b.id}
                            className="shrink-0 px-3 py-1.5 text-xs border border-red-200 text-red-500 rounded-lg hover:bg-red-50 disabled:opacity-40 transition-colors"
                          >
                            {cancellingBatch === b.id ? "取り消し中..." : "取り消し"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
