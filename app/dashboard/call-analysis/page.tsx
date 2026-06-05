"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

// ─── 型定義 ───────────────────────────────────────────────
interface AnalysisRow {
  phone_number:   string;
  store_name:     string | null;
  total_calls:    number;
  answered_calls: number;
  answered_rate:  number | null;
  decision_calls: number;
  decision_rate:  number | null;
  last_call:      string | null;
}

interface DayCount  { day: number;  count: number }
interface HourCount { hour: number; count: number }
interface HistoryRow {
  call_datetime: string | null;
  call_result:   string | null;
  status:        string | null;
  agent:         string | null;
  list_group:    string;
  result_rank:   number;
}
interface Detail {
  stats:        { total_calls: number; answered_calls: number; answered_rate: number | null; decision_calls: number; decision_rate: number | null };
  day_answer:   DayCount[];
  hour_answer:  HourCount[];
  day_decision: DayCount[];
  history:      HistoryRow[];
}

const DAY_LABELS = ['月', '火', '水', '木', '金', '土', '日'];

const RANK_COLOR: Record<number, string> = {
  1: 'text-gray-400', 2: 'text-blue-500', 3: 'text-blue-600',
  4: 'text-yellow-600', 5: 'text-green-600', 6: 'text-green-700',
  7: 'text-green-800', 8: 'text-orange-600', 9: 'text-emerald-700', 10: 'text-red-400',
};

function RateBar({ rate, color }: { rate: number | null; color: string }) {
  const pct = rate ?? 0;
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 bg-gray-100 rounded-full h-1.5 shrink-0">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="text-xs tabular-nums">{pct.toFixed(1)}%</span>
    </div>
  );
}

// ─── 詳細モーダル ─────────────────────────────────────────
function DetailModal({
  phone, storeName, onClose, token,
}: { phone: string; storeName: string | null; onClose: () => void; token: string }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/call-analysis?phone=${encodeURIComponent(phone)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { if (d.success) setDetail(d); })
      .finally(() => setLoading(false));
  }, [phone, token]);

  const maxAns  = Math.max(1, ...(detail?.day_answer.map(d => d.count)  ?? [1]));
  const maxHour = Math.max(1, ...(detail?.hour_answer.map(d => d.count) ?? [1]));

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        {/* ヘッダー */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">電話番号</p>
            <p className="text-xl font-bold font-mono text-gray-900">{phone}</p>
            {storeName && <p className="text-sm text-gray-500 mt-0.5">{storeName}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none mt-1">×</button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
          </div>
        ) : detail ? (
          <div className="p-5 space-y-6">
            {/* サマリーカード */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">架電回数</p>
                <p className="text-3xl font-bold text-gray-800">{detail.stats.total_calls}</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">対応</p>
                <p className="text-3xl font-bold text-blue-600">{detail.stats.answered_calls}</p>
                <p className="text-xs text-blue-400 mt-0.5">{(detail.stats.answered_rate ?? 0).toFixed(1)}%</p>
              </div>
              <div className="bg-green-50 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">決裁接触</p>
                <p className="text-3xl font-bold text-green-600">{detail.stats.decision_calls}</p>
                <p className="text-xs text-green-400 mt-0.5">{(detail.stats.decision_rate ?? 0).toFixed(1)}%</p>
              </div>
            </div>

            {/* 対応時間帯 */}
            {(detail.day_answer.length > 0 || detail.hour_answer.length > 0) && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-3">対応しやすい時間帯</p>
                <div className="grid grid-cols-2 gap-4">
                  {/* 曜日別 */}
                  <div>
                    <p className="text-xs text-gray-400 mb-2">曜日別</p>
                    {DAY_LABELS.map((label, idx) => {
                      const c = detail.day_answer.find(d => d.day === idx)?.count ?? 0;
                      return (
                        <div key={idx} className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-gray-500 w-4 shrink-0">{label}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-2">
                            <div className="h-2 rounded-full bg-blue-400" style={{ width: `${(c / maxAns) * 100}%` }} />
                          </div>
                          <span className="text-xs text-gray-500 w-6 text-right tabular-nums">{c}</span>
                        </div>
                      );
                    })}
                  </div>
                  {/* 時間帯別 */}
                  <div>
                    <p className="text-xs text-gray-400 mb-2">時間帯別（上位5件）</p>
                    {[...detail.hour_answer].sort((a, b) => b.count - a.count).slice(0, 5).map(h => (
                      <div key={h.hour} className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-gray-500 w-12 shrink-0">{h.hour}:00</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-2">
                          <div className="h-2 rounded-full bg-blue-400" style={{ width: `${(h.count / maxHour) * 100}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 w-6 text-right tabular-nums">{h.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 決裁接触時間帯 */}
            {detail.day_decision.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-3">決裁接触した曜日</p>
                <div className="flex gap-3 flex-wrap">
                  {detail.day_decision.map(d => (
                    <div key={d.day} className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
                      <span className="text-sm font-bold text-green-700">{DAY_LABELS[d.day]}</span>
                      <span className="text-xs text-green-500">{d.count}回</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* コール履歴 */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-3">
                コール履歴 <span className="text-gray-400 font-normal text-xs">（新しい順・最大100件）</span>
              </p>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['日時', 'グループ', 'コール結果', 'ステータス', '担当'].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {detail.history.map((h, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-mono text-gray-600 whitespace-nowrap">{h.call_datetime ?? '—'}</td>
                        <td className="px-3 py-2 text-gray-500">{h.list_group}</td>
                        <td className={`px-3 py-2 font-medium whitespace-nowrap ${RANK_COLOR[h.result_rank] ?? 'text-gray-600'}`}>
                          {h.call_result ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-gray-500">{h.status || '—'}</td>
                        <td className="px-3 py-2 text-gray-500">{h.agent ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <p className="p-8 text-center text-gray-400">データが見つかりませんでした</p>
        )}
      </div>
    </div>
  );
}

// ─── メインページ ─────────────────────────────────────────
export default function CallAnalysisPage() {
  const router = useRouter();
  const [rows, setRows]         = useState<AnalysisRow[]>([]);
  const [total, setTotal]       = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [query, setQuery]       = useState("");
  const [sortBy, setSortBy]     = useState("total_calls");
  const [sortDir, setSortDir]   = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<AnalysisRow | null>(null);
  const [token, setToken]       = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchRows = useCallback(async (q: string, sb: string, sd: "asc" | "desc", p: number, tk: string) => {
    setLoading(true); setError("");
    try {
      const sp = new URLSearchParams({ q, sortBy: sb, sortDir: sd, page: String(p) });
      const res = await fetch(`/api/call-analysis?${sp}`, { headers: { Authorization: `Bearer ${tk}` } });
      if (res.status === 401) { router.push("/login"); return; }
      const d = await res.json();
      if (!d.success) { setError(d.message); return; }
      setRows(d.rows ?? []);
      setTotal(d.total ?? 0);
      setTotalPages(d.totalPages ?? 0);
    } catch { setError("データ取得に失敗しました"); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => {
    const tk = localStorage.getItem("auth_token") ?? "";
    if (!tk) { router.push("/login"); return; }
    setToken(tk);
    fetchRows("", "total_calls", "desc", 1, tk);
  }, [router, fetchRows]);

  function handleQuery(v: string) {
    setQuery(v); setPage(1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchRows(v, sortBy, sortDir, 1, token), 400);
  }

  function handleSort(col: string) {
    const nd = sortBy === col && sortDir === "desc" ? "asc" : "desc";
    setSortBy(col); setSortDir(nd); setPage(1);
    fetchRows(query, col, nd, 1, token);
  }

  function goPage(p: number) {
    setPage(p);
    fetchRows(query, sortBy, sortDir, p, token);
  }

  const pageStart = (page - 1) * 50;

  const SortTh = ({ col, label, cls = "" }: { col: string; label: string; cls?: string }) => (
    <th onClick={() => handleSort(col)}
      className={`px-3 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap cursor-pointer hover:bg-gray-100 select-none ${cls}`}>
      <span className="flex items-center gap-1">
        {label}
        {sortBy === col ? (sortDir === "desc" ? " ↓" : " ↑") : " ↕"}
      </span>
    </th>
  );

  return (
    <div className="p-6 max-w-full">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">架電分析</h1>
        <p className="text-sm text-gray-500 mt-1">
          電話番号ごとの架電回数・対応率・決裁率を分析します。
          詳細をクリックすると通電曜日・時間帯・全履歴が確認できます。
        </p>
      </div>

      {/* 検索 */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input type="text" value={query} onChange={e => handleQuery(e.target.value)}
            placeholder="電話番号・店名で検索..."
            className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          {query && (
            <button onClick={() => handleQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg">×</button>
          )}
        </div>
        <span className={`text-sm font-medium shrink-0 tabular-nums ${loading ? "text-gray-400" : "text-gray-700"}`}>
          {loading ? "集計中..." : `${total.toLocaleString()} 件`}
        </span>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-3 text-sm">{error}</div>}

      {!loading && total === 0 && !error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <p className="text-sm font-semibold text-yellow-800 mb-1">架電記録がまだありません</p>
          <p className="text-xs text-yellow-600">管理画面「コール履歴インポート」から4グループ分のCSVを取り込んでください。</p>
        </div>
      )}

      {total > 0 && (
        <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 w-8">#</th>
                  <SortTh col="phone_number" label="電話番号" />
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 min-w-[120px]">店名</th>
                  <SortTh col="total_calls"    label="架電回数" />
                  <SortTh col="answered_calls" label="対応回数" />
                  <SortTh col="answered_rate"  label="対応率" />
                  <SortTh col="decision_calls" label="決裁接触" />
                  <SortTh col="decision_rate"  label="決裁率" />
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">最終架電</th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 w-16 text-center">詳細</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row, idx) => (
                  <tr key={row.phone_number} className={`hover:bg-blue-50 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                    <td className="px-3 py-2.5 text-xs text-gray-400 tabular-nums">{pageStart + idx + 1}</td>
                    <td className="px-3 py-2.5 font-mono text-gray-700 text-xs">{row.phone_number}</td>
                    <td className="px-3 py-2.5 text-gray-600 max-w-[160px]">
                      <span className="block truncate" title={row.store_name ?? ''}>{row.store_name || '—'}</span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-800 font-semibold tabular-nums text-center">{row.total_calls}</td>
                    <td className="px-3 py-2.5 text-blue-600 tabular-nums text-center">{row.answered_calls}</td>
                    <td className="px-3 py-2.5 min-w-[110px]">
                      <RateBar rate={row.answered_rate} color="bg-blue-400" />
                    </td>
                    <td className="px-3 py-2.5 text-green-600 tabular-nums text-center">{row.decision_calls}</td>
                    <td className="px-3 py-2.5 min-w-[110px]">
                      <RateBar rate={row.decision_rate} color="bg-green-400" />
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-400 font-mono whitespace-nowrap">
                      {row.last_call ? row.last_call.slice(0, 14) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <button onClick={() => setSelected(row)}
                        className="px-2 py-1 text-xs bg-gray-900 text-white rounded hover:bg-gray-700 transition-colors">
                        詳細
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ページネーション */}
          <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
            <span className="text-xs text-gray-500 tabular-nums">
              {total > 0 ? `${pageStart + 1}–${Math.min(page * 50, total)} / 全 ${total.toLocaleString()} 件` : ""}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button onClick={() => goPage(1)} disabled={page === 1}
                  className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-30">«</button>
                <button onClick={() => goPage(page - 1)} disabled={page === 1}
                  className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-30">‹</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                  .reduce<(number | "…")[]>((acc, p, i, arr) => {
                    if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push("…");
                    acc.push(p); return acc;
                  }, [])
                  .map((p, i) => p === "…"
                    ? <span key={`e${i}`} className="px-1 text-xs text-gray-400">…</span>
                    : <button key={p} onClick={() => goPage(p as number)}
                        className={`px-2.5 py-1 text-xs border rounded ${p === page ? "bg-gray-900 text-white border-gray-900" : "border-gray-300 hover:bg-gray-100"}`}>
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
      )}

      {selected && (
        <DetailModal
          phone={selected.phone_number}
          storeName={selected.store_name}
          onClose={() => setSelected(null)}
          token={token}
        />
      )}
    </div>
  );
}
