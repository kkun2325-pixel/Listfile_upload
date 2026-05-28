"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) router.push("/login");
  }, [router]);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (!selected.name.endsWith(".csv")) {
      setError("CSVファイルのみアップロード可能です");
      setFile(null);
      return;
    }
    setError("");
    setFile(selected);
  }

  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (!dropped) return;
    if (!dropped.name.endsWith(".csv")) {
      setError("CSVファイルのみアップロード可能です");
      return;
    }
    setError("");
    setFile(dropped);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    if (!file) {
      setError("ファイルを選択してください");
      setLoading(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);
      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.message || "アップロードに失敗しました");
        return;
      }

      const parts: string[] = [];
      if (data.inserted_count > 0) parts.push(`新規追加 ${data.inserted_count.toLocaleString()} 件`);
      if (data.updated_count  > 0) parts.push(`更新 ${data.updated_count.toLocaleString()} 件`);
      if (parts.length === 0) parts.push(`${data.row_count.toLocaleString()} 行処理`);
      setSuccess(`アップロード完了（${parts.join("、")}）`);
      setFile(null);
      setTimeout(() => router.push("/dashboard/history"), 2000);
    } catch {
      setError("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">アップロード</h1>
        <p className="text-sm text-gray-500 mt-1">CSVファイルをアップロードしてください</p>
      </div>

      <div className="max-w-lg">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <label
              htmlFor="file-input"
              className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-10 cursor-pointer transition-colors ${
                dragOver
                  ? "border-gray-500 bg-gray-50"
                  : file
                  ? "border-green-400 bg-green-50"
                  : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
                className={`w-10 h-10 mb-3 ${file ? "text-green-500" : "text-gray-400"}`}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <span className={`text-sm font-medium ${file ? "text-green-700" : "text-gray-600"}`}>
                {file ? file.name : "ファイルをドラッグ＆ドロップ"}
              </span>
              <span className="text-xs text-gray-400 mt-1">またはクリックして選択</span>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                id="file-input"
              />
            </label>

            <button
              type="submit"
              disabled={!file || loading}
              className="w-full mt-4 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "アップロード中..." : "アップロード"}
            </button>
          </form>

          <p className="text-xs text-gray-400 mt-3 text-center">
            ※ CSVファイル（.csv）のみ対応
          </p>
        </div>
      </div>
    </div>
  );
}
