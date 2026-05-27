"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      router.push("/login");
    }
  }, [router]);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith(".csv")) {
        setError("CSVファイルのみアップロード可能です");
        setFile(null);
        return;
      }
      setError("");
      setFile(selectedFile);
    }
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

      setSuccess(
        `ファイルをアップロードしました（${data.row_count}行、重複${data.duplicate_count}件）`
      );
      setFile(null);

      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    } catch (err) {
      setError("エラーが発生しました");
    } finally {
      setLoading(false);
    }
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
        <div className="max-w-md mx-auto mt-8">
          <div className="card">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
              ファイルをアップロード
            </h2>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
                {success}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-input"
                />
                <label htmlFor="file-input" className="cursor-pointer">
                  <p className="text-4xl mb-2">📁</p>
                  <p className="text-gray-600 font-medium">
                    {file ? file.name : "ファイルをドラッグしてドロップ"}
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    またはクリックして選択
                  </p>
                </label>
              </div>

              <button
                type="submit"
                disabled={!file || loading}
                className="w-full btn btn-primary mt-6 disabled:opacity-50"
              >
                {loading ? "アップロード中..." : "アップロード"}
              </button>
            </form>

            <p className="text-sm text-gray-500 mt-4">
              ※ CSVファイルのみアップロード可能です
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
