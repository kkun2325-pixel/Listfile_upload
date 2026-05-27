"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Upload {
  id: string;
  filename: string;
  original_filename: string;
  row_count: number;
  duplicate_count: number;
  uploaded_at: string;
  status: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      router.push("/login");
      return;
    }

    // Decode token to get email (simple JWT decode)
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      setUsername(payload.username);
    } catch {
      router.push("/login");
    }

    fetchUploads(token);
  }, [router]);

  async function fetchUploads(token: string) {
    try {
      const response = await fetch("/api/uploads", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/login");
        }
        return;
      }

      const data = await response.json();
      setUploads(data.uploads || []);
    } catch (err) {
      console.error("Error fetching uploads:", err);
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("auth_token");
    router.push("/");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white shadow">
        <div className="container flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600 py-4">
            CSV Upload Manager
          </h1>
          <div className="space-x-4">
            <span className="text-gray-600">{username}</span>
            <button onClick={handleLogout} className="btn btn-secondary">
              ログアウト
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold text-gray-800">ダッシュボード</h2>
          <Link href="/dashboard/upload" className="btn btn-primary">
            📤 ファイルをアップロード
          </Link>
        </div>

        {/* Uploads Table */}
        <div className="card">
          <h3 className="text-xl font-bold text-gray-800 mb-4">
            アップロード履歴
          </h3>

          {uploads.length === 0 ? (
            <p className="text-gray-600 py-8 text-center">
              まだアップロードがありません
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left">ファイル名</th>
                    <th className="px-4 py-2 text-left">行数</th>
                    <th className="px-4 py-2 text-left">重複数</th>
                    <th className="px-4 py-2 text-left">ステータス</th>
                    <th className="px-4 py-2 text-left">アップロード日時</th>
                    <th className="px-4 py-2 text-left">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {uploads.map((upload) => (
                    <tr key={upload.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2">{upload.original_filename}</td>
                      <td className="px-4 py-2">{upload.row_count}</td>
                      <td className="px-4 py-2">{upload.duplicate_count}</td>
                      <td className="px-4 py-2">
                        <span className="inline-block bg-green-100 text-green-800 px-2 py-1 rounded">
                          {upload.status}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        {new Date(upload.uploaded_at).toLocaleString("ja-JP")}
                      </td>
                      <td className="px-4 py-2">
                        <Link
                          href={`/dashboard/view/${upload.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          表示
                        </Link>
                        {" | "}
                        <Link
                          href={`/dashboard/export/${upload.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          エクスポート
                        </Link>
                        {" | "}
                        <Link
                          href={`/dashboard/analysis/${upload.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          分析
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
