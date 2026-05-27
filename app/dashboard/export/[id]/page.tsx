"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

interface FilterValues {
  住所１: string;
  時間振り: string;
  席数: string;
  ジャンル: string;
  備考: string;
}

const FILTER_COLUMNS = ["住所１", "時間振り", "席数", "ジャンル", "備考"] as const;

const emptyFilters: FilterValues = {
  住所１: "",
  時間振り: "",
  席数: "",
  ジャンル: "",
  備考: "",
};

export default function ExportDetailPage() {
  const router = useRouter();
  const params = useParams();
  const uploadId = params.id as string;

  const [filters, setFilters] = useState<FilterValues>({ ...emptyFilters });
  const [uploadInfo, setUploadInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [resultCount, setResultCount] = useState<number | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) { router.push("/login"); return; }
    fetchUploadInfo(token);
  }, [router, uploadId]);

  async function fetchUploadInfo(token: string) {
    try {
      const res = await fetch("/api/uploads", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { if (res.status === 401) router.push("/login"); return; }
      const result = await res.json();
      const upload = result.uploads?.find((u: any) => u.id === uploadId);
      setUploadInfo(upload);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function buildRules() {
    return FILTER_COLUMNS
      .filter((col) => filters[col].trim() !== "")
      .map((col) => ({ field: col, operator: "contains", value: filters[col].trim() }));
  }

  async function handleExport(e: FormEvent) {
    e.preventDefault();
    setError("");
    setExporting(true);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ upload_id: uploadId, rules: buildRules() }),
      });

      if (!res.ok) { setError("エクスポートに失敗しました"); return; }

      // ファイル行数をヘッダーから取得（あれば）
      const contentDisp = res.headers.get("x-result-count");
      if (contentDisp) setResultCount(Number(contentDisp));

      const blob = await res.blob();
      const csvText = await blob.text();
      const lines = csvText.split("\n").filter(Boolean);
      setResultCount(Math.max(0, lines.length - 1)); // ヘッダー除く

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `export_${uploadInfo?.original_filename || uploadId}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      setError("エクスポート処理中にエラーが発生しました");
    } finally {
      setExporting(false);
    }
  }

  function handleReset() {
    setFilters({ ...emptyFilters });
    setResultCount(null);
  }

  const activeFiltersCount = FILTER_COLUMNS.filter((c) => filters[c].trim() !== "").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* ヘッダー */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">エクスポート</h1>
        <p className="text-sm text-gray-500 mt-1">
          {uploadInfo?.original_filename}
        </p>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* ファイル情報 */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">ファイル情報</h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-gray-400 text-xs">ファイル名</dt>
                <dd className="font-medium text-gray-800 mt-0.5 break-all">{uploadInfo?.original_filename}</dd>
              </div>
              <div>
                <dt className="text-gray-400 text-xs">行数</dt>
                <dd className="font-semibold text-gray-900 mt-0.5 text-lg">{uploadInfo?.row_count?.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-gray-400 text-xs">アップロード日時</dt>
                <dd className="text-gray-600 mt-0.5">
                  {uploadInfo?.uploaded_at && new Date(uploadInfo.uploaded_at).toLocaleString("ja-JP")}
                </dd>
              </div>
            </dl>

            {resultCount !== null && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <dt className="text-gray-400 text-xs">抽出件数</dt>
                <dd className="font-semibold text-green-700 mt-0.5 text-lg">{resultCount.toLocaleString()} 件</dd>
              </div>
            )}
          </div>
        </div>

        {/* フィルターフォーム */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-gray-900">フィルター条件</h2>
              {activeFiltersCount > 0 && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                  {activeFiltersCount} 件適用中
                </span>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleExport}>
              <div className="space-y-4 mb-6">
                {FILTER_COLUMNS.map((col) => (
                  <div key={col} className="flex items-center gap-4">
                    <label className="w-28 text-sm font-medium text-gray-700 shrink-0">
                      {col}
                    </label>
                    <input
                      type="text"
                      value={filters[col]}
                      onChange={(e) =>
                        setFilters((prev) => ({ ...prev, [col]: e.target.value }))
                      }
                      placeholder={`${col} で絞り込む（部分一致）`}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-transparent transition-all"
                    />
                  </div>
                ))}
              </div>

              <p className="text-xs text-gray-400 mb-5">
                ※ 空白のフィールドはフィルターに適用されません（全データが含まれます）
              </p>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  リセット
                </button>
                <button
                  type="submit"
                  disabled={exporting}
                  className="flex items-center gap-2 px-5 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  {exporting ? "エクスポート中..." : "CSVをエクスポート"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
