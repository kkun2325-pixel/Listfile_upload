"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

interface FieldStat {
  total: number;
  unique: number;
  null_count: number;
  null_percent: string;
  top_values: Array<{ value: string; count: number }>;
}

interface StatusStats {
  seisa_count: number;
  tel_count: number;
  duplicates: number;
  rank_count: number;
}

interface AnalysisData {
  total_rows: number;
  columns: string[];
  field_stats: Record<string, FieldStat>;
  category_stats: Array<{ name: string; value: number }>;
  region_stats: Array<{ name: string; value: number }>;
  status_stats: StatusStats;
}

type SortKey = "name" | "null_count" | "null_percent" | "unique";
type SortDir = "asc" | "desc";

const GENRE_COLORS = [
  "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#16a34a",
  "#0891b2", "#9333ea", "#e11d48", "#d97706", "#059669",
];

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs text-gray-400 mb-2">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function AnalysisPage() {
  const router = useRouter();
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("null_count");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [openCol, setOpenCol] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) { router.push("/login"); return; }

    fetch("/api/analysis", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (r.status === 401) { router.push("/login"); return null; }
        return r.json();
      })
      .then((res) => {
        if (!res) return;
        if (!res.success) { setError(res.message || "エラーが発生しました"); return; }
        setData(res.stats);
      })
      .catch(() => setError("データ取得に失敗しました"))
      .finally(() => setLoading(false));
  }, [router]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      </div>
    );
  }

  if (!data || data.total_rows === 0) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">分析</h1>
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">データがありません。CSVをアップロードしてください</p>
        </div>
      </div>
    );
  }

  // カラム統計ソート
  const sortedCols = [...data.columns].sort((a, b) => {
    const sa = data.field_stats[a];
    const sb = data.field_stats[b];
    let va: number | string, vb: number | string;
    if (sortKey === "name") { va = a; vb = b; }
    else if (sortKey === "null_percent") { va = parseFloat(sa.null_percent); vb = parseFloat(sb.null_percent); }
    else if (sortKey === "unique") { va = sa.unique; vb = sb.unique; }
    else { va = sa.null_count; vb = sb.null_count; }
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const totalCells = data.columns.reduce((s, c) => s + data.field_stats[c].null_count + data.field_stats[c].total, 0);
  const totalNulls = data.columns.reduce((s, c) => s + data.field_stats[c].null_count, 0);
  const overallNullRate = totalCells > 0 ? ((totalNulls / totalCells) * 100).toFixed(1) : "0.0";

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? (
      <span className="ml-1 text-gray-900">{sortDir === "asc" ? "↑" : "↓"}</span>
    ) : (
      <span className="ml-1 text-gray-300">↕</span>
    );

  return (
    <div className="p-8">
      {/* ヘッダー */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">分析</h1>
        <p className="text-sm text-gray-500 mt-1">全アップロードデータの統合分析</p>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <StatCard label="総データ数" value={data.total_rows.toLocaleString()} sub="全アップロード合計" color="text-gray-800" />
        <StatCard label="カラム数" value={data.columns.length} sub="検出されたフィールド" color="text-blue-600" />
        <StatCard label="総欠損セル数" value={totalNulls.toLocaleString()} sub="空白・未入力セルの合計" color="text-red-500" />
        <StatCard label="全体欠損率" value={`${overallNullRate}%`} sub="欠損セル / 総セル" color="text-orange-500" />
      </div>

      {/* ステータス別集計 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <h2 className="text-base font-semibold text-gray-900 mb-5">ステータス別集計</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "時間振り済み", value: data.status_stats.seisa_count, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "電話番号有り", value: data.status_stats.tel_count, color: "text-green-600", bg: "bg-green-50" },
            { label: "重複件数", value: data.status_stats.duplicates, color: "text-red-600", bg: "bg-red-50" },
            { label: "ランク設定済み", value: data.status_stats.rank_count, color: "text-purple-600", bg: "bg-purple-50" },
          ].map((item) => (
            <div key={item.label} className={`${item.bg} rounded-lg p-4`}>
              <p className="text-xs text-gray-500 mb-1">{item.label}</p>
              <p className={`text-xl font-bold ${item.color}`}>{item.value.toLocaleString()}</p>
              {data.total_rows > 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  {((item.value / data.total_rows) * 100).toFixed(1)}%
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ジャンル別集計 + 都道府県別集計 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* ジャンル別 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-5">ジャンル別集計</h2>
          {data.category_stats.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">データなし</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={data.category_stats.slice(0, 10)}
                  cx="50%" cy="50%"
                  innerRadius={50} outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {data.category_stats.slice(0, 10).map((_, i) => (
                    <Cell key={i} fill={GENRE_COLORS[i % GENRE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(val) => [`${Number(val).toLocaleString()} 件`, ""]} />
                <Legend
                  formatter={(value) => <span className="text-xs text-gray-700">{value}</span>}
                  wrapperStyle={{ fontSize: "11px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 都道府県別 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-5">都道府県別集計 <span className="text-xs font-normal text-gray-400">（上位15件）</span></h2>
          {data.region_stats.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">データなし</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.region_stats} layout="vertical" margin={{ left: 8, right: 20 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => v.toLocaleString()} />
                <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(val) => [`${Number(val).toLocaleString()} 件`, ""]} />
                <Bar dataKey="value" fill="#2563eb" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* カラム別欠損率テーブル */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            カラム別欠損分析
            <span className="text-sm font-normal text-gray-400 ml-2">（{data.columns.length} カラム）</span>
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {[
                  { key: "name" as SortKey, label: "カラム名" },
                  { key: "null_count" as SortKey, label: "欠損数" },
                  { key: "null_percent" as SortKey, label: "欠損率" },
                  { key: "unique" as SortKey, label: "ユニーク数" },
                ].map(({ key, label }) => (
                  <th
                    key={key}
                    onClick={() => toggleSort(key)}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-500 cursor-pointer hover:text-gray-800 select-none whitespace-nowrap"
                  >
                    {label}<SortIcon k={key} />
                  </th>
                ))}
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">欠損率バー</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">TOP値</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedCols.map((col) => {
                const st = data.field_stats[col];
                const pct = parseFloat(st.null_percent);
                const isOpen = openCol === col;
                return (
                  <>
                    <tr key={col} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">{col}</td>
                      <td className="px-4 py-3 text-gray-700">{st.null_count.toLocaleString()}</td>
                      <td className={`px-4 py-3 font-semibold ${pct >= 50 ? "text-red-500" : pct >= 20 ? "text-orange-500" : "text-green-600"}`}>
                        {st.null_percent}%
                      </td>
                      <td className="px-4 py-3 text-gray-600">{st.unique.toLocaleString()}</td>
                      <td className="px-4 py-3 w-40">
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${pct >= 50 ? "bg-red-400" : pct >= 20 ? "bg-orange-400" : "bg-green-400"}`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {st.top_values && st.top_values.length > 0 ? (
                          <button
                            onClick={() => setOpenCol(isOpen ? null : col)}
                            className="text-xs text-blue-600 hover:text-blue-800 underline"
                          >
                            {isOpen ? "閉じる" : `TOP${st.top_values.length}件表示`}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                    {isOpen && st.top_values && (
                      <tr key={`${col}-top`} className="bg-blue-50">
                        <td colSpan={6} className="px-6 py-3">
                          <div className="flex flex-wrap gap-2">
                            {st.top_values.map((tv, i) => (
                              <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-blue-200 rounded-full text-xs text-gray-700">
                                <span className="font-medium">{tv.value}</span>
                                <span className="text-gray-400">× {tv.count.toLocaleString()}</span>
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
