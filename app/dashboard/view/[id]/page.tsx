"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

interface CSVData {
  id: string;
  row_number: number;
  data: Record<string, string>;
  phone_number?: string;
  is_duplicate: boolean;
}

export default function ViewDataPage() {
  const router = useRouter();
  const params = useParams();
  const uploadId = params.id as string;
  const [data, setData] = useState<CSVData[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadInfo, setUploadInfo] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      router.push("/login");
      return;
    }

    fetchData(token);
  }, [router, uploadId]);

  async function fetchData(token: string) {
    try {
      // Note: This endpoint needs to be created
      // For now, we'll fetch from uploads and parse
      const response = await fetch("/api/uploads", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/login");
        }
        return;
      }

      const result = await response.json();
      const upload = result.uploads?.find((u: any) => u.id === uploadId);
      setUploadInfo(upload);

      // TODO: Implement GET /api/upload/[id]/data endpoint
      // For now, use mock data
      setData([]);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
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
        <h2 className="text-3xl font-bold text-gray-800 mb-6">
          データ表示：{uploadInfo?.original_filename}
        </h2>

        <div className="card mb-6">
          <h3 className="font-bold mb-4">ファイル情報</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">ファイル名</p>
              <p className="font-medium">{uploadInfo?.original_filename}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">行数</p>
              <p className="font-medium">{uploadInfo?.row_count}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">重複数</p>
              <p className="font-medium">{uploadInfo?.duplicate_count}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">アップロード日時</p>
              <p className="font-medium">
                {uploadInfo?.uploaded_at &&
                  new Date(uploadInfo.uploaded_at).toLocaleString("ja-JP")}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-xl font-bold text-gray-800 mb-4">データ</h3>

          {data.length === 0 ? (
            <p className="text-gray-600 py-8 text-center">
              データ取得機能は現在開発中です
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    {data[0] &&
                      Object.keys(data[0].data).map((key) => (
                        <th key={key} className="px-4 py-2 text-left">
                          {key}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row) => (
                    <tr key={row.id} className="border-b hover:bg-gray-50">
                      {Object.values(row.data).map((value, idx) => (
                        <td key={idx} className="px-4 py-2">
                          {value}
                        </td>
                      ))}
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
