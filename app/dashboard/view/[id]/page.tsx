"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

export default function ViewDataPage() {
  const router = useRouter();
  const params = useParams();
  const uploadId = params.id as string;
  const [uploadInfo, setUploadInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) { router.push("/login"); return; }
    fetchData(token);
  }, [router, uploadId]);

  async function fetchData(token: string) {
    try {
      const res = await fetch("/api/uploads", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { if (res.status === 401) router.push("/login"); return; }
      const result = await res.json();
      setUploadInfo(result.uploads?.find((u: any) => u.id === uploadId));
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
        <h1 className="text-2xl font-bold text-gray-900">データ表示</h1>
        <p className="text-sm text-gray-500 mt-1">{uploadInfo?.original_filename}</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">ファイル情報</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {[
            { label: "ファイル名",     value: uploadInfo?.original_filename },
            { label: "行数",           value: uploadInfo?.row_count?.toLocaleString() },
            { label: "重複数",         value: uploadInfo?.duplicate_count },
            { label: "アップロード日時", value: uploadInfo?.uploaded_at && new Date(uploadInfo.uploaded_at).toLocaleString("ja-JP") },
          ].map((item) => (
            <div key={item.label}>
              <p className="text-xs text-gray-400">{item.label}</p>
              <p className="font-medium text-gray-800 mt-0.5">{item.value ?? "—"}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <Link
          href={`/dashboard/analysis/${uploadId}`}
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700"
        >
          分析する
        </Link>
        <Link
          href={`/dashboard/export/${uploadId}`}
          className="px-4 py-2 border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
        >
          エクスポート
        </Link>
      </div>
    </div>
  );
}
