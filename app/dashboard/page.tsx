"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

interface Stats {
  total: number;
  seisa_count: number;
  unseisa_count: number;
  seisa_rate: number;
  tel_count: number;
}
interface PieItem { name: string; value: number; color: string }

const PREVIEW_COLS = ["ID", "名前", "電話番号", "住所1", "ジャンル", "時間振り"];

function StatCard({
  label, value, sub, color,
}: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs text-gray-400 mb-2">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats]     = useState<Stats | null>(null);
  const [pieData, setPieData] = useState<PieItem[]>([]);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) { router.push("/login"); return; }

    fetch("/api/dashboard", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (r.status === 401) { router.push("/login"); return null; }
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        if (!data.success) { setError(data.message || "エラーが発生しました"); return; }
        setStats(data.stats);
        setPieData(data.pie_data);
        setPreview(data.preview);
      })
      .catch(() => setError("データ取得に失敗しました"))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  const noData = !stats || stats.total === 0;

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>
          <p className="text-sm text-gray-500 mt-1">全データの統合統計</p>
        </div>
        <Link
          href="/dashboard/upload"
          className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          アップロード
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
          {error}
        </div>
      )}

      {noData ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
            className="w-12 h-12 text-gray-300 mx-auto mb-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <p className="text-gray-400 text-sm mb-4">データがまだありません。CSVをアップロードしてください</p>
          <Link href="/dashboard/upload"
            className="inline-block px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700">
            ファイルをアップロード
          </Link>
        </div>
      ) : (
        <>
          {/* ─── サマリーカード ─── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            <StatCard
              label="総データ数"
              value={stats!.total.toLocaleString()}
              sub="全アップロード合計"
              color="text-gray-800"
            />
            <StatCard
              label="時間振り済み"
              value={stats!.seisa_count.toLocaleString()}
              sub="時間振りカラム有り"
              color="text-blue-600"
            />
            <StatCard
              label="精査率"
              value={`${stats!.seisa_rate}%`}
              sub="時間振り済み / 総数"
              color="text-green-600"
            />
            <StatCard
              label="電話番号有り"
              value={stats!.tel_count.toLocaleString()}
              sub="電話番号カラム有り"
              color="text-purple-600"
            />
          </div>

          {/* ─── 精査状況 円グラフ ─── */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
            <h2 className="text-base font-semibold text-gray-900 mb-5">精査状況（時間振り）</h2>
            {pieData.length > 0 ? (
              <div className="flex flex-col md:flex-row items-center gap-8">
                <ResponsiveContainer width="100%" height={240} className="max-w-xs">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%" cy="50%"
                      innerRadius={55} outerRadius={95}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val) => [`${Number(val).toLocaleString()} 件`, ""]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>

                <div className="flex-1 space-y-3 min-w-0">
                  {pieData.map((item) => (
                    <div key={item.name} className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-sm text-gray-700">{item.name}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-sm font-semibold text-gray-900">
                          {item.value.toLocaleString()} 件
                        </span>
                        {stats && stats.total > 0 && (
                          <span className="text-xs text-gray-400 ml-2">
                            ({((item.value / stats.total) * 100).toFixed(1)}%)
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-gray-400 text-sm text-center py-8">データがありません</p>
            )}
          </div>

          {/* ─── データプレビュー ─── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">
                データプレビュー
                <span className="text-sm font-normal text-gray-400 ml-2">（先頭20件）</span>
              </h2>
              <span className="text-xs text-gray-400">全 {stats!.total.toLocaleString()} 件より</span>
            </div>

            {preview.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">データがありません</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 w-8">#</th>
                      {PREVIEW_COLS.map((col) => (
                        <th key={col} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {preview.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-300 text-xs">{i + 1}</td>
                        {PREVIEW_COLS.map((col) => {
                          const val = row[col];
                          const isTime = col === "時間振り";
                          return (
                            <td key={col} className="px-4 py-3 text-gray-700 max-w-xs truncate">
                              {isTime && val ? (
                                <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                                  {val}
                                </span>
                              ) : (
                                val || <span className="text-gray-300">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
