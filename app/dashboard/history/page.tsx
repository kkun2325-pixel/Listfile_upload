"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface HistoryItem {
  id: string;
  username: string;
  worker_name: string | null;
  report_date: string | null;
  original_filename: string;
  row_count: number;
  inserted_count: number;
  updated_count: number;
  fill_count: number;
  uploaded_at: string;
  status: string;
  work_hours: number | null;
}

export default function HistoryPage() {
  const router = useRouter();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) { router.push("/login"); return; }
    fetchHistory(token);
  }, [router]);

  async function fetchHistory(token: string) {
    try {
      const res = await fetch("/api/history", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        if (res.status === 401) router.push("/login");
        setError("履歴の取得に失敗しました");
        return;
      }
      const data = await res.json();
      setHistory(data.uploads || []);
    } catch {
      setError("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  const totalInserted = history.reduce((s, h) => s + h.inserted_count, 0);
  const totalUpdated  = history.reduce((s, h) => s + h.updated_count,  0);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">アップロード履歴</h1>
        <p className="text-sm text-gray-500 mt-1">全ユーザーのアップロード履歴</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      {history.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm mb-4">まだアップロードがありません</p>
          <Link
            href="/dashboard/upload"
            className="inline-block px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700"
          >
            ファイルをアップロード
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">ユーザー名</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">担当者名</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">報告対象日</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">ファイル名</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 whitespace-nowrap">行数</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 whitespace-nowrap">
                    <span className="text-green-700">新規追加</span>
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 whitespace-nowrap">
                    <span className="text-blue-700">更新件数</span>
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 whitespace-nowrap">作業時間</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">アップロード日時</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600">
                          {item.username.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-gray-700 font-medium">{item.username}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-700">
                      {item.worker_name ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-700 whitespace-nowrap">
                      {item.report_date
                        ? new Date(item.report_date + "T00:00:00").toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-gray-900 max-w-xs truncate">
                      {item.original_filename}
                    </td>
                    <td className="px-5 py-3.5 text-right text-gray-500 text-xs">
                      {item.row_count.toLocaleString()} 行
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {item.inserted_count > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                          +{item.inserted_count.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {item.updated_count > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                          ↻{item.updated_count.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right text-xs text-gray-500 whitespace-nowrap">
                      {item.work_hours != null ? `${item.work_hours}h` : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs whitespace-nowrap">
                      {new Date(item.uploaded_at).toLocaleString("ja-JP")}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/dashboard/export/${item.id}`}
                          className="text-xs text-gray-600 border border-gray-200 px-2.5 py-1 rounded hover:bg-gray-50 transition-colors"
                        >
                          エクスポート
                        </Link>
                        <Link
                          href={`/dashboard/analysis/${item.id}`}
                          className="text-xs text-gray-600 border border-gray-200 px-2.5 py-1 rounded hover:bg-gray-50 transition-colors"
                        >
                          分析
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* フッター統計 */}
          <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex flex-wrap items-center gap-6 text-xs text-gray-500">
            <span>合計 {history.length} 件のアップロード</span>
            <span>総行数 {history.reduce((s, h) => s + h.row_count, 0).toLocaleString()} 行</span>
            <span className="text-green-700 font-medium">新規追加 {totalInserted.toLocaleString()} 件</span>
            <span className="text-blue-700 font-medium">更新 {totalUpdated.toLocaleString()} 件</span>
          </div>
        </div>
      )}
    </div>
  );
}
