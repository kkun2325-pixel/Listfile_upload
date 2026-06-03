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
}

type SortCol = "名前" | "電話番号" | "住所1" | "住所2" | "時間振り" | "定休日" | "席数" | "ジャンル" | "備考" | "担当者";

// ─── 列定義 ──────────────────────────────────────────────
const COLS: { key: SortCol; label: string; w: string; editable: "text" | "number" | "select" | "free"; opts?: string[] }[] = [
  { key: "名前",    label: "名前（店名）", w: "min-w-[140px]", editable: "text" },
  { key: "電話番号", label: "電話番号",    w: "min-w-[120px]", editable: "text" },
  { key: "住所1",   label: "住所1",       w: "min-w-[160px]", editable: "text" },
  { key: "住所2",   label: "住所2",       w: "min-w-[140px]", editable: "text" },
  { key: "時間振り", label: "時間振り",   w: "min-w-[130px]", editable: "select", opts: TIME_CATEGORIES },
  { key: "定休日",  label: "定休日",      w: "min-w-[90px]",  editable: "free" },
  { key: "席数",    label: "席数",        w: "min-w-[70px]",  editable: "number" },
  { key: "ジャンル", label: "ジャンル",   w: "min-w-[120px]", editable: "select", opts: GENRE_OPTIONS },
  { key: "備考",    label: "備考",        w: "min-w-[120px]", editable: "free" },
  { key: "担当者",  label: "担当者",      w: "min-w-[90px]",  editable: "text" },
];

const val = (s: Store, k: SortCol) => s[k] ?? "";

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

  // 編集状態
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

  // 初回ロード
  useEffect(() => { fetchStores(query, sortBy, sortOrder, page); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 検索デバウンス
  function handleQueryChange(v: string) {
    setQuery(v);
    setPage(1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchStores(v, sortBy, sortOrder, 1), 400);
  }

  // ソート
  function handleSort(col: SortCol) {
    const newOrder = sortBy === col && sortOrder === "asc" ? "desc" : "asc";
    setSortBy(col); setSortOrder(newOrder); setPage(1);
    fetchStores(query, col, newOrder, 1);
  }

  // ページ移動
  function goPage(p: number) {
    setPage(p);
    fetchStores(query, sortBy, sortOrder, p);
    setEditingId(null);
  }

  // ─── 編集 ─────────────────────────────────────────────
  function startEdit(store: Store) {
    setEditingId(store.id);
    setSaveError("");
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
      // ローカルのstoresを更新
      setStores(prev => prev.map(s => s.id === id ? { ...s, ...d.store } : s));
      setEditingId(null);
    } catch { setSaveError("通信エラーが発生しました"); }
    finally { setSaving(false); }
  }

  // ─── 列ヘッダー ──────────────────────────────────────
  function SortHeader({ col, label, cls }: { col: SortCol; label: string; cls: string }) {
    const active = sortBy === col;
    return (
      <th
        onClick={() => handleSort(col)}
        className={`px-3 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap cursor-pointer select-none hover:bg-gray-100 transition-colors ${cls}`}
      >
        <span className="flex items-center gap-1">
          {label}
          <span className={`text-gray-300 ${active ? "text-gray-600" : ""}`}>
            {active ? (sortOrder === "asc" ? "↑" : "↓") : "↕"}
          </span>
        </span>
      </th>
    );
  }

  // ─── セル編集UI ──────────────────────────────────────
  function EditCell({ col }: { col: typeof COLS[number] }) {
    const v = editValues[col.key] ?? "";
    const cls = "w-full border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white";

    if (col.editable === "select" && col.opts) {
      return (
        <select value={v} onChange={e => setEditValues(p => ({ ...p, [col.key]: e.target.value }))} className={cls}>
          <option value="">―</option>
          {col.opts.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    return (
      <input
        type={col.editable === "number" ? "number" : "text"}
        value={v}
        onChange={e => setEditValues(p => ({ ...p, [col.key]: e.target.value }))}
        className={cls}
      />
    );
  }

  // ─── レンダリング ────────────────────────────────────
  return (
    <div className="p-8 max-w-full">
      {/* ヘッダー */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">店舗検索</h1>
        <p className="text-sm text-gray-500 mt-1">名前・電話番号・住所・担当者で検索できます</p>
      </div>

      {/* 検索バー */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-lg">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            placeholder="名前、電話番号、住所、担当者で検索..."
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
          {query && (
            <button onClick={() => handleQueryChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none">
              ×
            </button>
          )}
        </div>
        <span className={`text-sm font-medium shrink-0 ${loading ? "text-gray-400" : "text-gray-700"}`}>
          {loading ? "検索中..." : `${total.toLocaleString()} 件`}
        </span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
      )}

      {/* テーブル */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {COLS.map(c => (
                  <SortHeader key={c.key} col={c.key} label={c.label} cls={c.w} />
                ))}
                <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 whitespace-nowrap w-16">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stores.length === 0 && !loading ? (
                <tr>
                  <td colSpan={COLS.length + 1} className="px-4 py-12 text-center text-sm text-gray-400">
                    {query ? `「${query}」に一致する店舗が見つかりません` : "データがありません"}
                  </td>
                </tr>
              ) : (
                stores.map(store => {
                  const isEditing = editingId === store.id;
                  return (
                    <tr key={store.id} className={`transition-colors ${isEditing ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                      {isEditing ? (
                        // ─── 編集行 ───
                        <>
                          {COLS.map(c => (
                            <td key={c.key} className="px-2 py-1.5">
                              <EditCell col={c} />
                            </td>
                          ))}
                          <td className="px-2 py-1.5">
                            <div className="flex flex-col gap-1">
                              <button onClick={() => saveEdit(store.id)} disabled={saving}
                                className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-40 whitespace-nowrap">
                                {saving ? "…" : "保存"}
                              </button>
                              <button onClick={cancelEdit} disabled={saving}
                                className="px-2 py-1 border border-gray-300 text-gray-600 text-xs rounded hover:bg-gray-100 disabled:opacity-40 whitespace-nowrap">
                                取消
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        // ─── 表示行 ───
                        <>
                          {COLS.map(c => (
                            <td key={c.key} className={`px-3 py-2.5 text-gray-700 ${c.w}`}>
                              <span className="block truncate max-w-[180px]" title={val(store, c.key)}>
                                {val(store, c.key) || <span className="text-gray-300">—</span>}
                              </span>
                            </td>
                          ))}
                          <td className="px-3 py-2.5">
                            <button onClick={() => startEdit(store)}
                              className="p-1.5 rounded hover:bg-gray-200 transition-colors text-gray-400 hover:text-gray-700"
                              title="編集">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
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

        {/* 保存エラー */}
        {saveError && (
          <div className="px-4 py-2 bg-red-50 border-t border-red-200 text-red-600 text-xs">{saveError}</div>
        )}

        {/* ページネーション */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {(page - 1) * 50 + 1}–{Math.min(page * 50, total)} 件 / 全{total.toLocaleString()}件
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => goPage(1)} disabled={page === 1}
                className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-30">«</button>
              <button onClick={() => goPage(page - 1)} disabled={page === 1}
                className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-30">‹</button>

              {/* ページ番号（前後2ページ） */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                  if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push("…");
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === "…" ? (
                    <span key={`ellipsis-${i}`} className="px-1 text-xs text-gray-400">…</span>
                  ) : (
                    <button key={p} onClick={() => goPage(p as number)}
                      className={`px-2.5 py-1 text-xs border rounded transition-colors ${
                        p === page ? "bg-gray-900 text-white border-gray-900" : "border-gray-300 hover:bg-gray-50"
                      }`}>
                      {p}
                    </button>
                  )
                )
              }

              <button onClick={() => goPage(page + 1)} disabled={page === totalPages}
                className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-30">›</button>
              <button onClick={() => goPage(totalPages)} disabled={page === totalPages}
                className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-30">»</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
