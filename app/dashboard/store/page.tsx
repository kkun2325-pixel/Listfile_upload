"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { TIME_CATEGORIES, GENRE_OPTIONS } from "@/lib/constants";

// ─── 型定義 ───────────────────────────────────────────────
interface Store {
  id: string;
  名前: string | null;
  電話番号: string | null;
  住所1: string | null;
  住所2: string | null;
  時間振り: string | null;
  定休日: string | null;
  席数: string | null;
  ジャンル: string | null;
  備考: string | null;
  担当者: string | null;
  リストランク: string | null;
  店舗精査: string | null;
  本社精査: string | null;
  最大進捗: string | null;
}

type SortCol = keyof Omit<Store, "id">;

// ─── 列定義 ──────────────────────────────────────────────
const COLS: {
  key: SortCol; label: string; w: string;
  editable: "text" | "number" | "select" | "free" | "readonly";
  opts?: string[];
  critical?: boolean;  // 空欄ハイライト対象
}[] = [
  { key: "名前",    label: "名前（店名）", w: "min-w-[140px]", editable: "text" },
  { key: "電話番号", label: "電話番号",    w: "min-w-[110px]", editable: "text" },
  { key: "住所1",   label: "住所1",       w: "min-w-[150px]", editable: "text" },
  { key: "住所2",   label: "住所2",       w: "min-w-[130px]", editable: "text" },
  { key: "時間振り", label: "時間振り",   w: "min-w-[120px]", editable: "select", opts: TIME_CATEGORIES, critical: true },
  { key: "定休日",  label: "定休日",      w: "min-w-[80px]",  editable: "free",  critical: true },
  { key: "席数",    label: "席数",        w: "min-w-[60px]",  editable: "number", critical: true },
  { key: "ジャンル", label: "ジャンル",   w: "min-w-[110px]", editable: "select", opts: GENRE_OPTIONS, critical: true },
  { key: "備考",    label: "備考",        w: "min-w-[110px]", editable: "free",  critical: true },
  { key: "リストランク", label: "Lランク", w: "min-w-[60px]",  editable: "readonly" },
  { key: "店舗精査", label: "店舗精査",   w: "min-w-[70px]",  editable: "text" },
  { key: "本社精査", label: "本社精査",   w: "min-w-[70px]",  editable: "text" },
  { key: "最大進捗", label: "最大進捗",   w: "min-w-[70px]",  editable: "readonly" },
  { key: "担当者",  label: "担当者",      w: "min-w-[80px]",  editable: "text" },
];

const val = (s: Store, k: SortCol) => s[k] ?? "";

// リストランク色
const RANK_COLOR: Record<string, string> = {
  "1": "bg-gray-100 text-gray-500",
  "2": "bg-blue-50 text-blue-600",
  "3": "bg-blue-100 text-blue-700",
  "4": "bg-green-50 text-green-600",
  "5": "bg-green-100 text-green-700",
  "6": "bg-green-200 text-green-800",
  "7": "bg-emerald-200 text-emerald-900",
};

// ─── ページ ────────────────────────────────────────────────
export default function StorePage() {
  const router = useRouter();

  const [stores, setStores]     = useState<Store[]>([]);
  const [total, setTotal]       = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");

  const [query, setQuery]         = useState("");
  const [sortBy, setSortBy]       = useState<SortCol>("名前");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [saving, setSaving]         = useState(false);
  const [saveError, setSaveError]   = useState("");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchStores = useCallback(async (q: string, sb: SortCol, so: "asc" | "desc", p: number) => {
    const token = localStorage.getItem("auth_token");
    if (!token) { router.push("/login"); return; }
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ q, sortBy: sb, sortOrder: so, page: String(p) });
      const res = await fetch(`/api/stores?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      if (!d.success) { setError(d.message); return; }
      setStores(d.stores);
      setTotal(d.total);
      setTotalPages(d.totalPages);
    } catch { setError("データ取得に失敗しました"); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { fetchStores(query, sortBy, sortOrder, page); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleQueryChange(v: string) {
    setQuery(v); setPage(1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchStores(v, sortBy, sortOrder, 1), 400);
  }

  function handleSort(col: SortCol) {
    const newOrder = sortBy === col && sortOrder === "asc" ? "desc" : "asc";
    setSortBy(col); setSortOrder(newOrder); setPage(1);
    fetchStores(query, col, newOrder, 1);
  }

  function goPage(p: number) {
    setPage(p);
    fetchStores(query, sortBy, sortOrder, p);
    setEditingId(null);
  }

  function startEdit(store: Store) {
    setEditingId(store.id); setSaveError("");
    const init: Record<string, string> = {};
    COLS.forEach(c => { init[c.key] = val(store, c.key); });
    setEditValues(init);
  }

  function cancelEdit() { setEditingId(null); setSaveError(""); }

  async function saveEdit(id: string) {
    const token = localStorage.getItem("auth_token");
    if (!token) return;
    setSaving(true); setSaveError("");
    try {
      const res = await fetch(`/api/stores/${id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(editValues),
      });
      const d = await res.json();
      if (!d.success) { setSaveError(d.message ?? "保存に失敗しました"); return; }
      setStores(prev => prev.map(s => s.id === id ? { ...s, ...d.store } : s));
      setEditingId(null);
    } catch { setSaveError("通信エラーが発生しました"); }
    finally { setSaving(false); }
  }

  // ─── セル編集UI ──────────────────────────────────────
  function EditCell({ col }: { col: typeof COLS[number] }) {
    const v = editValues[col.key] ?? "";
    const cls = "w-full border border-blue-400 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white";
    if (col.editable === "readonly") return <span className="text-xs text-gray-400 px-1">{v || "—"}</span>;
    if (col.editable === "select" && col.opts) {
      return (
        <select value={v} onChange={e => setEditValues(p => ({ ...p, [col.key]: e.target.value }))} className={cls}>
          <option value="">―</option>
          {col.opts.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    return (
      <input type={col.editable === "number" ? "number" : "text"} value={v}
        onChange={e => setEditValues(p => ({ ...p, [col.key]: e.target.value }))} className={cls} />
    );
  }

  const pageStart = (page - 1) * 50;

  return (
    <div className="p-6 max-w-full">
      {/* ヘッダー */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">店舗検索・データ確認</h1>
        <p className="text-sm text-gray-500 mt-1">
          DBに入っているデータをExcel感覚で閲覧・確認できます。
          <span className="ml-2 inline-flex items-center gap-1 text-orange-500">
            <span className="w-3 h-3 rounded-sm bg-orange-100 border border-orange-300 inline-block" />
            オレンジ＝未入力の精査項目
          </span>
        </p>
      </div>

      {/* 検索バー */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-lg">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input type="text" value={query} onChange={e => handleQueryChange(e.target.value)}
            placeholder="名前・電話番号・住所・担当者で検索..."
            className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          {query && (
            <button onClick={() => handleQueryChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
          )}
        </div>
        <span className={`text-sm font-medium shrink-0 tabular-nums ${loading ? "text-gray-400" : "text-gray-700"}`}>
          {loading ? "検索中..." : `${total.toLocaleString()} 件`}
        </span>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-3 text-sm">{error}</div>}

      {/* Excel風テーブル */}
      <div className="rounded-lg border border-gray-300 overflow-hidden shadow-sm">
        <div className="overflow-x-auto max-h-[calc(100vh-260px)] overflow-y-auto">
          <table className="w-full text-xs border-collapse">
            {/* ヘッダー固定 */}
            <thead className="sticky top-0 z-10">
              <tr>
                {/* 行番号列 */}
                <th className="border border-gray-300 bg-gray-200 px-2 py-2 text-center text-gray-500 font-semibold w-10 select-none">#</th>
                {COLS.map(c => {
                  const active = sortBy === c.key;
                  return (
                    <th key={c.key} onClick={() => c.editable !== "readonly" && handleSort(c.key)}
                      className={`border border-gray-300 bg-gray-200 px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap select-none ${c.w} ${c.editable !== "readonly" ? "cursor-pointer hover:bg-gray-300" : ""} transition-colors`}>
                      <span className="flex items-center gap-1">
                        {c.label}
                        {c.critical && <span className="text-orange-400 text-[10px]">●</span>}
                        {active && <span className="text-blue-600 ml-0.5">{sortOrder === "asc" ? "↑" : "↓"}</span>}
                      </span>
                    </th>
                  );
                })}
                <th className="border border-gray-300 bg-gray-200 px-2 py-2 text-center text-gray-500 font-semibold w-12">編集</th>
              </tr>
            </thead>
            <tbody>
              {stores.length === 0 && !loading ? (
                <tr>
                  <td colSpan={COLS.length + 2} className="border border-gray-200 px-4 py-12 text-center text-gray-400">
                    {query ? `「${query}」に一致する店舗が見つかりません` : "データがありません"}
                  </td>
                </tr>
              ) : (
                stores.map((store, idx) => {
                  const isEditing = editingId === store.id;
                  const rowNum = pageStart + idx + 1;
                  const rowBg = isEditing ? "bg-blue-50" : idx % 2 === 0 ? "bg-white" : "bg-gray-50";
                  return (
                    <tr key={store.id} className={`${rowBg} hover:bg-yellow-50 transition-colors`}>
                      {/* 行番号 */}
                      <td className="border border-gray-200 px-2 py-1.5 text-center text-gray-400 font-mono bg-gray-50 select-none">{rowNum}</td>

                      {isEditing ? (
                        <>
                          {COLS.map(c => (
                            <td key={c.key} className="border border-blue-300 px-1.5 py-1">
                              <EditCell col={c} />
                            </td>
                          ))}
                          <td className="border border-gray-200 px-1.5 py-1">
                            <div className="flex flex-col gap-1">
                              <button onClick={() => saveEdit(store.id)} disabled={saving}
                                className="px-2 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40 whitespace-nowrap">
                                {saving ? "…" : "保存"}
                              </button>
                              <button onClick={cancelEdit} disabled={saving}
                                className="px-2 py-0.5 border border-gray-300 text-gray-600 rounded hover:bg-gray-100 disabled:opacity-40">
                                取消
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          {COLS.map(c => {
                            const v = val(store, c.key);
                            const isEmpty = v === "";
                            const highlight = c.critical && isEmpty ? "bg-orange-50" : "";

                            // リストランク専用表示
                            if (c.key === "リストランク") {
                              return (
                                <td key={c.key} className={`border border-gray-200 px-2 py-1.5 text-center ${c.w}`}>
                                  {v ? (
                                    <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold ${RANK_COLOR[v] ?? "bg-gray-100 text-gray-500"}`}>
                                      {v}
                                    </span>
                                  ) : <span className="text-gray-200">—</span>}
                                </td>
                              );
                            }

                            // 精査フラグ専用表示
                            if (c.key === "店舗精査" || c.key === "本社精査") {
                              return (
                                <td key={c.key} className={`border border-gray-200 px-2 py-1.5 text-center ${c.w}`}>
                                  {v === "1"
                                    ? <span className="text-green-600 font-bold">✓</span>
                                    : <span className="text-gray-200">—</span>}
                                </td>
                              );
                            }

                            return (
                              <td key={c.key} className={`border border-gray-200 px-2 py-1.5 ${c.w} ${highlight}`}>
                                {isEmpty
                                  ? <span className="text-orange-300 text-[10px]">{c.critical ? "未入力" : "—"}</span>
                                  : <span className="block truncate max-w-[180px]" title={v}>{v}</span>}
                              </td>
                            );
                          })}
                          <td className="border border-gray-200 px-1.5 py-1.5 text-center">
                            <button onClick={() => startEdit(store)}
                              className="p-1 rounded hover:bg-gray-200 transition-colors text-gray-400 hover:text-gray-700" title="編集">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-3.5 h-3.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                              </svg>
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {saveError && (
          <div className="px-4 py-2 bg-red-50 border-t border-red-200 text-red-600 text-xs">{saveError}</div>
        )}

        {/* ページネーション */}
        <div className="px-4 py-2.5 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <span className="text-xs text-gray-500 tabular-nums">
            {total > 0 ? `${pageStart + 1}–${Math.min(page * 50, total)} 件 / 全 ${total.toLocaleString()} 件` : ""}
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button onClick={() => goPage(1)} disabled={page === 1}
                className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-30">«</button>
              <button onClick={() => goPage(page - 1)} disabled={page === 1}
                className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-30">‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                  if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push("…");
                  acc.push(p); return acc;
                }, [])
                .map((p, i) => p === "…"
                  ? <span key={`e${i}`} className="px-1 text-xs text-gray-400">…</span>
                  : <button key={p} onClick={() => goPage(p as number)}
                      className={`px-2.5 py-1 text-xs border rounded transition-colors ${p === page ? "bg-gray-900 text-white border-gray-900" : "border-gray-300 hover:bg-gray-100"}`}>
                      {p}
                    </button>
                )}
              <button onClick={() => goPage(page + 1)} disabled={page === totalPages}
                className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-30">›</button>
              <button onClick={() => goPage(totalPages)} disabled={page === totalPages}
                className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-30">»</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
