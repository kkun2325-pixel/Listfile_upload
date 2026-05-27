"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    setIsLoggedIn(!!token);
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <nav className="bg-white shadow">
        <div className="container flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600 py-4">CSV Upload Manager</h1>
          <div className="space-x-4">
            {isLoggedIn ? (
              <>
                <Link href="/dashboard" className="btn btn-primary">
                  ダッシュボード
                </Link>
                <button
                  onClick={() => {
                    localStorage.removeItem("auth_token");
                    setIsLoggedIn(false);
                    router.push("/");
                  }}
                  className="btn btn-secondary"
                >
                  ログアウト
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="btn btn-secondary">
                  ログイン
                </Link>
                <Link href="/register" className="btn btn-primary">
                  登録
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <div className="container">
        <div className="text-center py-20">
          <h2 className="text-5xl font-bold text-gray-800 mb-4">
            CSV管理を簡単に
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            複数のCSVファイルをアップロード、管理、処理できるプラットフォーム
          </p>

          {!isLoggedIn && (
            <div className="space-x-4">
              <Link href="/register" className="btn btn-primary">
                今すぐ始める
              </Link>
              <Link href="/login" className="btn btn-secondary">
                ログイン
              </Link>
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-8 mt-16">
          <div className="card">
            <h3 className="text-xl font-bold text-gray-800 mb-2">📤 簡単アップロード</h3>
            <p className="text-gray-600">
              CSVファイルを直感的にアップロード。複数ファイルの一括処理に対応。
            </p>
          </div>
          <div className="card">
            <h3 className="text-xl font-bold text-gray-800 mb-2">💾 安全に保存</h3>
            <p className="text-gray-600">
              データベースに安全に保存。電話番号などをキーにした重複管理。
            </p>
          </div>
          <div className="card">
            <h3 className="text-xl font-bold text-gray-800 mb-2">📊 セグメント分割</h3>
            <p className="text-gray-600">
              条件に応じてデータを分割し、複数のCSVとして出力。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
