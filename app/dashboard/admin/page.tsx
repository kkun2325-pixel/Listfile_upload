"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Status = "idle" | "running" | "success" | "error";

interface MigrationResult {
  status: string;
  message: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [migrateStatus, setMigrateStatus] = useState<Status>("idle");
  const [migrateResult, setMigrateResult] = useState<MigrationResult | null>(null);
  const [initStatus, setInitStatus] = useState<Status>("idle");
  const [initResult, setInitResult]   = useState<string>("");

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) router.push("/login");
  }, [router]);

  // ── スキーマ移行（既存データを保持して新カラム構造に移行）──
  async function handleMigrate() {
    setMigrateStatus("running");
    setMigrateResult(null);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/migrate-schema", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setMigrateStatus("success");
        setMigrateResult({ status: data.status, message: data.message });
      } else {
        setMigrateStatus("error");
        setMigrateResult({ status: "error", message: data.message });
      }
    } catch (e) {
      setMigrateStatus("error");
      setMigrateResult({ status: "error", message: String(e) });
    }
  }

  // ── DB初期化（全データ削除 + 新スキーマで再構築）──
  async function handleInitDb() {
    if (!confirm("全データが削除されます。本当に実行しますか？")) return;
    setInitStatus("running");
    setInitResult("");
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/init-db", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setInitStatus("success");
        setInitResult("データベースを初期化しました。");
      } else {
        setInitStatus("error");
        setInitResult(data.message || "初期化に失敗しました。");
      }
    } catch (e) {
      setInitStatus("error");
      setInitResult(String(e));
    }
  }

  const statusBg: Record<Status, string> = {
    idle:    "",
    running: "bg-yellow-50 border-yellow-200 text-yellow-800",
    success: "bg-green-50 border-green-200 text-green-800",
    error:   "bg-red-50 border-red-200 text-red-700",
  };

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">管理</h1>
        <p className="text-sm text-gray-500 mt-1">データベース管理・スキーマ操作</p>
      </div>

      {/* ── スキーマ移行 ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
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

        {migrateStatus !== "idle" && migrateResult && (
          <div className={`mt-4 border rounded-lg px-4 py-3 text-sm ${statusBg[migrateStatus]}`}>
            <span className="font-semibold mr-2">
              {migrateStatus === "success" ? "✓" : migrateStatus === "error" ? "✗" : "…"}
              {" "}[{migrateResult.status}]
            </span>
            {migrateResult.message}
          </div>
        )}
      </div>

      {/* ── DB初期化 ── */}
      <div className="bg-white rounded-xl border border-red-200 p-6">
        <h2 className="text-base font-semibold text-red-700 mb-1">DB初期化（危険）</h2>
        <p className="text-sm text-gray-500 mb-4">
          全テーブルを削除して新スキーマで再作成します。
          <strong className="text-red-600">アップロード済みの全データが消えます。</strong>
          開発環境のリセット専用です。
        </p>
        <button
          onClick={handleInitDb}
          disabled={initStatus === "running"}
          className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {initStatus === "running" ? "初期化中..." : "DB初期化（全データ削除）"}
        </button>

        {initStatus !== "idle" && initResult && (
          <div className={`mt-4 border rounded-lg px-4 py-3 text-sm ${statusBg[initStatus]}`}>
            {initResult}
          </div>
        )}
      </div>
    </div>
  );
}
