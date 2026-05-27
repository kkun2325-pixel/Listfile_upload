"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  PieChart,
  Pie,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface Stats {
  total_rows: number;
  columns: string[];
  field_stats: Record<string, any>;
  category_stats: Record<string, number>;
  region_stats: Record<string, number>;
  status_stats: Record<string, number>;
  raw_data: any[];
}

const COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#8884D8",
  "#82CA9D",
  "#FFC658",
  "#FF7C7C",
];

export default function AnalysisPage() {
  const router = useRouter();
  const params = useParams();
  const uploadId = params.id as string;
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploadInfo, setUploadInfo] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      router.push("/login");
      return;
    }

    fetchAnalysis(token);
    fetchUploadInfo(token);
  }, [router, uploadId]);

  async function fetchAnalysis(token: string) {
    try {
      const response = await fetch(`/api/analysis/${uploadId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/login");
        }
        setError("分析データの取得に失敗しました");
        return;
      }

      const data = await response.json();
      setStats(data.stats);
    } catch (err) {
      setError("分析処理中にエラーが発生しました");
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchUploadInfo(token: string) {
    try {
      const response = await fetch("/api/uploads", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) return;

      const result = await response.json();
      const upload = result.uploads?.find((u: any) => u.id === uploadId);
      setUploadInfo(upload);
    } catch (err) {
      console.error("Error fetching upload info:", err);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow">
          <div className="container flex justify-between items-center">
            <h1 className="text-2xl font-bold text-blue-600 py-4">
              CSV Upload Manager
            </h1>
            <Link href="/dashboard" className="btn btn-secondary">
              ← ダッシュボードに戻る
            </Link>
          </div>
        </nav>
        <div className="container">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mt-8">
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const categoryData = Object.entries(stats.category_stats).map(([key, value]) => ({
    name: key,
    value,
  }));

  const regionData = Object.entries(stats.region_stats)
    .map(([key, value]) => ({
      name: key,
      count: value,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // Top 10 regions

  const statusData = [
    { name: "NG", value: stats.status_stats.ng_count || 0 },
    { name: "EC投入済", value: stats.status_stats.ec_invested || 0 },
    { name: "架電対象", value: stats.status_stats.call_target || 0 },
    { name: "対象外", value: stats.status_stats.exclude_count || 0 },
    { name: "重複", value: stats.status_stats.duplicates || 0 },
  ].filter((item) => item.value > 0);

  const nullPercentData = Object.entries(stats.field_stats)
    .map(([key, value]) => ({
      name: key,
      null_percent: parseFloat(value.null_percent),
    }))
    .filter((item) => item.null_percent > 0)
    .sort((a, b) => b.null_percent - a.null_percent)
    .slice(0, 10); // Top 10 fields with missing data

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="container flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600 py-4">
            CSV Upload Manager
          </h1>
          <Link href="/dashboard" className="btn btn-secondary">
            ← ダッシュボードに戻る
          </Link>
        </div>
      </nav>

      <div className="container">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">
          📊 データ分析
        </h2>
        <p className="text-gray-600 mb-6">
          {uploadInfo?.original_filename}
        </p>

        {/* Summary Stats */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <div className="card">
            <p className="text-gray-600 text-sm">総行数</p>
            <p className="text-3xl font-bold text-blue-600">
              {stats.total_rows.toLocaleString()}
            </p>
          </div>
          <div className="card">
            <p className="text-gray-600 text-sm">カラム数</p>
            <p className="text-3xl font-bold text-green-600">
              {stats.columns.length}
            </p>
          </div>
          <div className="card">
            <p className="text-gray-600 text-sm">架電対象</p>
            <p className="text-3xl font-bold text-purple-600">
              {stats.status_stats.call_target || 0}
            </p>
          </div>
          <div className="card">
            <p className="text-gray-600 text-sm">重複件数</p>
            <p className="text-3xl font-bold text-red-600">
              {stats.status_stats.duplicates || 0}
            </p>
          </div>
        </div>

        {/* Charts Row 1 */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Category Distribution */}
          <div className="card">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              ジャンル別分布
            </h3>
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name} (${value})`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryData.map((_entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 text-center py-8">
                データがありません
              </p>
            )}
          </div>

          {/* Status Distribution */}
          <div className="card">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              ステータス分類
            </h3>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={statusData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 text-center py-8">
                データがありません
              </p>
            )}
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Region Distribution */}
          <div className="card">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              地域別分布 (Top 10)
            </h3>
            {regionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={regionData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={80} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 text-center py-8">
                データがありません
              </p>
            )}
          </div>

          {/* Missing Data */}
          <div className="card">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              欠損データ率 (Top 10)
            </h3>
            {nullPercentData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={nullPercentData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" unit="%" />
                  <YAxis dataKey="name" type="category" width={100} />
                  <Tooltip formatter={(value) => `${Number(value).toFixed(2)}%`} />
                  <Bar dataKey="null_percent" fill="#ffc658" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 text-center py-8">
                欠損データなし
              </p>
            )}
          </div>
        </div>

        {/* Field Statistics Table */}
        <div className="card mb-8">
          <h3 className="text-xl font-bold text-gray-800 mb-4">
            フィールド統計
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-4 py-2 text-left">カラム名</th>
                  <th className="px-4 py-2 text-left">入力値</th>
                  <th className="px-4 py-2 text-left">一意値</th>
                  <th className="px-4 py-2 text-left">空値数</th>
                  <th className="px-4 py-2 text-left">欠損率</th>
                </tr>
              </thead>
              <tbody>
                {stats.columns.slice(0, 15).map((col) => {
                  const stat = stats.field_stats[col];
                  return (
                    <tr key={col} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium">{col}</td>
                      <td className="px-4 py-2">{stat.total}</td>
                      <td className="px-4 py-2">{stat.unique}</td>
                      <td className="px-4 py-2">{stat.null_count}</td>
                      <td className="px-4 py-2">
                        <span
                          className={
                            parseFloat(stat.null_percent) > 50
                              ? "text-red-600 font-medium"
                              : ""
                          }
                        >
                          {stat.null_percent}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="card flex gap-4 justify-center">
          <Link
            href={`/dashboard/export/${uploadId}`}
            className="btn btn-primary"
          >
            📥 セグメント分割してエクスポート
          </Link>
          <Link href="/dashboard" className="btn btn-secondary">
            ダッシュボードに戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
