"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Upload {
  id: string;
  original_filename: string;
  row_count: number;
  uploaded_at: string;
  status: string;
}

export default function ExportIndexPage() {
  const router = useRouter();
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) { router.push("/login"); return; }
    fetchUploads(token);
  }, [router]);

  async function fetchUploads(token: string) {
    try {
      const res = await fetch("/api/uploads", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { if (res.status === 401) router.push("/login"); return; }
      const data = await res.json();
      setUploads(data.uploads || []);
    } catch (e) {
      console.error(e);
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

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">エクスポート</h1>
        <p className="text-sm text-gray-500 mt-1">
          エクスポートするファイルを選択してください
        </p>
      </div>

      {uploads.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">アップロード済みのファイルがありません</p>
          <Link
            href="/dashboard/upload"
            className="inline-block mt-4 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700"
          >
            ファイルをアップロード
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">ファイル名</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">行数</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">アップロード日時</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {uploads.map((upload) => (
                <tr key={upload.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-gray-900">{upload.original_filename}</td>
                  <td className="px-5 py-3.5 text-gray-600">{upload.row_count.toLocaleString()}</td>
                  <td className="px-5 py-3.5 text-gray-500">
                    {new Date(upload.uploaded_at).toLocaleString("ja-JP")}
                  </td>
                  <td className="px-5 py-3.5">
                    <Link
                      href={`/dashboard/export/${upload.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                      エクスポート
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
