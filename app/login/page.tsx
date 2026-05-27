"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "ログインに失敗しました");
        return;
      }

      localStorage.setItem("auth_token", data.token);
      router.push("/dashboard");
    } catch {
      setError("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="card">
          <h1 className="text-3xl font-bold text-gray-800 mb-8 text-center">
            ログイン
          </h1>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-gray-700 font-medium mb-2">
                ユーザー名
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-field"
                placeholder="ユーザー名を入力"
                required
              />
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">
                パスワード
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="パスワードを入力"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn btn-primary disabled:opacity-50"
            >
              {loading ? "ログイン中..." : "ログイン"}
            </button>
          </form>

          <p className="text-center text-gray-600 mt-6">
            アカウントをお持ちでない方は{" "}
            <Link href="/register" className="text-blue-600 hover:underline">
              新規登録
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
