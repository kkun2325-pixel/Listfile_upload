"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

interface FieldStat {
  total: number;
  unique: number;
  null_count: number;
  null_percent: string;
  top_values: { value: string; count: number }[];
}

interface Stats {
  total_rows: number;
  columns: string[];
  field_stats: Record<string, FieldStat>;
  category_stats: Record<string, number>;
  region_stats: Record<string, number>;
}

const COLORS = ["#1d4ed8","#059669","#d97706","#dc2626","#7c3aed","#0891b2","#be185d","#65a30d"];

export default function AnalysisDetailPage() {
  const router = useRouter();
  const params = useParams();
  const uploadId = params.id as string;

  const [stats, setStats] = useState<Stats | null>(null);
  const [uploadInfo, setUploadInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedCol, setExpandedCol] = useState<string | null>(null);
  const [sortByNull, setSortByNull] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) { router.push("/login"); return; }
    Promise.all([fetchAnalysis(token), fetchUploadInfo(token)]);
  }, [router, uploadId]);

  async function fetchAnalysis(token: string) {
    try {
      const res = await fetch(`/api/analysis/${uploadId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setError("分析データの取得に失敗しました"); return; }
      const data = await res.json();
      setStats(data.stats);
    } catch {
      setError("分析処理中にエラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  async function fetchUploadInfo(token: string) {
    try {
      const res = await fetch("/api/uploads", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const result = await res.json();
      setUploadInfo(result.uploads?.find((u: any) => u.id === uploadId));
    } catch {}
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error || "データが見つかりません"}
        </div>
      </div>
    );
  }

  // ソート済みカラム
  const sortedColumns = [...stats.columns].sort((a, b) => {
    if (!sortByNull) return 0;
    return parseFloat(stats.field_stats[b]?.null_percent || "0") -
           parseFloat(stats.field_stats[a]?.null_percent || "0");
  });

  // 欠損率グラフ（上位10件）
  const nullChartData = sortedColumns
    .slice(0, 10)
    .map((col) => ({
      name: col.length > 12 ? col.slice(0, 12) + "…" : col,
      fullName: col,
      欠損率: parseFloat(stats.field_stats[col]?.null_percent || "0"),
      欠損数: stats.field_stats[col]?.null_count || 0,
    }));

  // ジャンル分布
  const categoryData = Object.entries(stats.category_stats)
    .map(([name, value]) => ({ name, value }))
    .filter((d) => d.name !== "不明")
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // 総欠損セル数
  const totalNullCells = stats.columns.reduce(
    (sum, col) => sum + (stats.field_stats[col]?.null_count || 0), 0
  );
  const totalCells = stats.total_rows * stats.columns.length;
  const overallNullRate = totalCells > 0 ? ((totalNullCells / totalCells) * 100).toFixed(1) : "0.0";

  return (
    <div className="p-8">
      {/* ヘッダー */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">分析</h1>
          <p className="text-sm text-gray-500 mt-1">{uploadInfo?.original_filename}</p>
        </div>
        <Link
          href={`/dashboard/export/${uploadId}`}
          className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          エクスポート
        </Link>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: "総行数",   value: stats.total_rows.toLocaleString(), color: "text-blue-700" },
          { label: "カラム数", value: stats.columns.length,              color: "text-green-700" },
          { label: "総欠損セル数", value: totalNullCells.toLocaleString(), color: "text-red-600" },
          { label: "全体欠損率", value: `${overallNullRate}%`,           color: "text-orange-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs text-gray-400 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* カラム別欠損率グラフ */}
      {nullChartData.some(d => d.欠損率 > 0) && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            欠損率ランキング（上位10カラム）
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={nullChartData} layout="vertical" margin={{ left: 20, right: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" unit="%" domain={[0, 100]} tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(val, _name, props) =>
                  [`${val}% (${props.payload.欠損数}件)`, "欠損率"]}
              />
              <Bar dataKey="欠損率" fill="#ef4444" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ジャンル分布 */}
      {categoryData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">ジャンル分布</h2>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                outerRadius={90}
                dataKey="value"
                label={({ name, value }) => `${name}(${value})`}
                labelLine={false}
              >
                {categoryData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* カラム別集計テーブル */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">カラム別集計</h2>
          <button
            onClick={() => setSortByNull(!sortByNull)}
            className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50"
          >
            {sortByNull ? "▼ 欠損率順" : "— 元の順番"}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">カラム名</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">入力済み</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">一意値</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">欠損数</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider" style={{minWidth: 160}}>欠損率</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">代表値（上位3件）</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedColumns.map((col) => {
                const s = stats.field_stats[col];
                if (!s) return null;
                const nullPct = parseFloat(s.null_percent);
                const isHighNull = nullPct >= 50;
                const isMedNull = nullPct >= 20 && nullPct < 50;
                return (
                  <tr key={col} className="hover:bg-gray-50 transition-colors">
                    {/* カラム名：クリックで上位値展開 */}
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => setExpandedCol(expandedCol === col ? null : col)}
                        className="text-left font-medium text-gray-900 hover:text-blue-700 flex items-center gap-1"
                      >
                        {col}
                        <span className="text-gray-300 text-xs">{expandedCol === col ? "▲" : "▼"}</span>
                      </button>
                      {/* 展開：上位値詳細 */}
                      {expandedCol === col && s.top_values?.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {s.top_values.map((tv, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs text-gray-500">
                              <span className="w-4 text-gray-300">{i + 1}.</span>
                              <span className="font-medium text-gray-700 truncate max-w-40">{tv.value || "（空）"}</span>
                              <span className="text-gray-400">{tv.count}件</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right text-gray-600">{s.total.toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-right text-gray-600">{s.unique.toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-right">
                      <span className={isHighNull ? "text-red-600 font-semibold" : isMedNull ? "text-orange-500" : "text-gray-600"}>
                        {s.null_count.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5 max-w-24">
                          <div
                            className={`h-1.5 rounded-full ${isHighNull ? "bg-red-500" : isMedNull ? "bg-orange-400" : "bg-green-400"}`}
                            style={{ width: `${Math.min(100, nullPct)}%` }}
                          />
                        </div>
                        <span className={`text-xs font-medium ${isHighNull ? "text-red-600" : isMedNull ? "text-orange-500" : "text-gray-500"}`}>
                          {s.null_percent}%
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {(s.top_values || []).slice(0, 3).map((tv, i) => (
                          <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                            {tv.value ? (tv.value.length > 10 ? tv.value.slice(0, 10) + "…" : tv.value) : "（空）"}
                            <span className="text-gray-400 ml-1">{tv.count}</span>
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
