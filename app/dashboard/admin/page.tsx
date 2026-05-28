"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Status = "idle" | "running" | "success" | "error";

export default function AdminPage() {
  const router = useRouter();
  const [migrateStatus, setMigrateStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) router.push("/login");
  }, [router]);

  async function handleMigrate() {
    setMigrateStatus("running");
    setMessage("");
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/admin/migrate", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setMigrateStatus("success");
        setMessage(`完了: ${data.message ?? data.status}`);
      } else {
        setMigrateStatus("error");
        setMessage(data.message || "移行に失敗しました");
      }
    } catch (e) {
      setMigrateStatus("error");
      setMessage(String(e));
    }
  }

  const alertClass: Record<Status, string> = {
    idle:    "",
    running: "bg-yellow-50 border border-yellow-200 text-yellow-800",
    success: "bg-green-50 border border-green-200 text-green-800",
    error:   "bg-red-50 border border-red-200 text-red-700",
  };

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">管理</h1>
        <p className="text-sm text-gray-500 mt-1">データベース管理・スキーマ操作</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">DBスキーマ移行</h2>
        <p className="text-sm text-gray-500 mb-4">
          既存データを保持したまま、旧JSON形式から新固定カラム構造（リストDB準拠）に移行します。
          既に移行済みの場合は何も変更しません。
        </p>

        <button
          onClick={handleMigrate}
          disabled={migrateStatus === "running"}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {migrateStatus === "running" ? "移行中..." : "スキーマ移行を実行"}
        </button>

        {migrateStatus !== "idle" && message && (
          <div className={`mt-4 rounded-lg px-4 py-3 text-sm ${alertClass[migrateStatus]}`}>
            {migrateStatus === "success" && <span className="font-semibold mr-1">✓</span>}
            {migrateStatus === "error"   && <span className="font-semibold mr-1">✗</span>}
            {migrateStatus === "running" && <span className="mr-1">…</span>}
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
