"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

type Status = "idle" | "running" | "success" | "error";

const LIST_GROUPS = ["飲食SH", "サイネージ", "デリバリー", "ペイメント"] as const;
type ListGroup = (typeof LIST_GROUPS)[number];

interface EverycallStat {
  list_group: string;
  count: number;
  latest_invested_at: string;
}

function parsePhoneNumbersFromCSV(text: string): string[] {
  const lines = text.split(/\r?\n/)
  if (lines.length === 0) return []
  const header = lines[0].split(",").map(h => h.replace(/^"|"$/g, "").trim())
  const telIdx = header.findIndex(h => h === "電話番号" || h === "電話" || h.toLowerCase().includes("phone"))
  const idx = telIdx >= 0 ? telIdx : 1  // fallback to 2nd column
  const phones: string[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const cols = line.split(",").map(c => c.replace(/^"|"$/g, "").trim())
    const tel = cols[idx]?.trim()
    if (tel && /^\d/.test(tel)) phones.push(tel)
  }
  return phones
}

function CleanupButton() {
  const [status, setStatus] = useState<Status>("idle");
  const [msg, setMsg] = useState("");

  async function handleCleanup() {
    setStatus("running");
    setMsg("");
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/admin/everycall", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setStatus("success");
        setMsg(`削除完了: ${(data.deleted ?? 0).toLocaleString()} 件`);
      } else {
        setStatus("error");
        setMsg(data.message || "クリーンアップに失敗しました");
      }
    } catch (e) {
      setStatus("error");
      setMsg(String(e));
    }
  }

  const alertClass: Record<Status, string> = {
    idle: "", running: "bg-yellow-50 border border-yellow-200 text-yellow-800",
    success: "bg-green-50 border border-green-200 text-green-800",
    error: "bg-red-50 border border-red-200 text-red-700",
  };

  return (
    <div>
      <button
        onClick={handleCleanup}
        disabled={status === "running"}
        className="px-3 py-1.5 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 disabled:opacity-40 transition-colors"
      >
        {status === "running" ? "クリーンアップ中..." : "不要データを削除"}
      </button>
      {status !== "idle" && msg && (
        <div className={`mt-2 rounded-lg px-3 py-2 text-sm ${alertClass[status]}`}>
          {msg}
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();

  // ─── DBマイグレーション ────────────────────────────────
  const [migrateStatus, setMigrateStatus] = useState<Status>("idle");
  const [migrateMsg, setMigrateMsg] = useState("");

  // ─── エバーコール投入済CSV ─────────────────────────────
  const [ecStats, setEcStats] = useState<EverycallStat[]>([]);
  const [ecStatsLoading, setEcStatsLoading] = useState(true);
  const [ecFile, setEcFile] = useState<File | null>(null);
  const [ecGroup, setEcGroup] = useState<ListGroup>("飲食SH");
  const [ecInvestedAt, setEcInvestedAt] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  });
  const [ecStatus, setEcStatus] = useState<Status>("idle");
  const [ecMsg, setEcMsg] = useState("");
  const [ecProgress, setEcProgress] = useState({ current: 0, total: 0 });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) { router.push("/login"); return; }
    loadEcStats(token);
  }, [router]);

  async function loadEcStats(token: string) {
    setEcStatsLoading(true);
    try {
      const res = await fetch("/api/admin/everycall", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setEcStats(data.stats ?? []);
    } catch { /* ignore */ }
    finally { setEcStatsLoading(false); }
  }

  async function handleMigrate() {
    setMigrateStatus("running");
    setMigrateMsg("");
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/admin/migrate", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setMigrateStatus("success");
        setMigrateMsg(`完了: ${data.message ?? data.status}`);
      } else {
        setMigrateStatus("error");
        setMigrateMsg(data.message || "移行に失敗しました");
      }
    } catch (e) {
      setMigrateStatus("error");
      setMigrateMsg(String(e));
    }
  }

  async function handleEverycallUpload() {
    if (!ecFile) { setEcMsg("CSVファイルを選択してください"); return; }
    setEcStatus("running");
    setEcMsg("");
    setEcProgress({ current: 0, total: 0 });

    try {
      const token = localStorage.getItem("auth_token")!;
      const text = await ecFile.text();
      const phones = parsePhoneNumbersFromCSV(text);

      if (phones.length === 0) {
        setEcStatus("error");
        setEcMsg("電話番号が1件も見つかりませんでした。CSVの列名「電話番号」を確認してください。");
        return;
      }

      const BATCH = 5000;
      const batches = Math.ceil(phones.length / BATCH);
      setEcProgress({ current: 0, total: phones.length });

      let totalInserted = 0;
      for (let i = 0; i < batches; i++) {
        const chunk = phones.slice(i * BATCH, (i + 1) * BATCH);
        const res = await fetch("/api/admin/everycall", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            phone_numbers: chunk,
            list_group: ecGroup,
            invested_at: ecInvestedAt,
          }),
        });
        const data = await res.json();
        if (!data.success) {
          setEcStatus("error");
          setEcMsg(`バッチ ${i + 1}/${batches} 失敗: ${data.message}`);
          return;
        }
        totalInserted += data.inserted ?? chunk.length;
        setEcProgress({ current: Math.min((i + 1) * BATCH, phones.length), total: phones.length });
      }

      setEcStatus("success");
      setEcMsg(`完了: ${phones.length.toLocaleString()} 件処理（うち新規 ${totalInserted.toLocaleString()} 件登録）`);
      // 統計リロード
      loadEcStats(token);
      setEcFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      setEcStatus("error");
      setEcMsg(String(e));
    }
  }

  const alertClass: Record<Status, string> = {
    idle:    "",
    running: "bg-yellow-50 border border-yellow-200 text-yellow-800",
    success: "bg-green-50 border border-green-200 text-green-800",
    error:   "bg-red-50 border border-red-200 text-red-700",
  };

  return (
    <div className="p-8 max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">管理</h1>
        <p className="text-sm text-gray-500 mt-1">データベース管理・スキーマ操作</p>
      </div>

      {/* ─── DBスキーマ移行 ─── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">DBスキーマ移行</h2>
        <p className="text-sm text-gray-500 mb-4">
          既存データを保持したまま、旧JSON形式から新固定カラム構造に移行します。
        </p>
        <button
          onClick={handleMigrate}
          disabled={migrateStatus === "running"}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
        >
          {migrateStatus === "running" ? "移行中..." : "スキーマ移行を実行"}
        </button>
        {migrateStatus !== "idle" && migrateMsg && (
          <div className={`mt-4 rounded-lg px-4 py-3 text-sm ${alertClass[migrateStatus]}`}>
            {migrateStatus === "success" && <span className="font-semibold mr-1">✓</span>}
            {migrateStatus === "error"   && <span className="font-semibold mr-1">✗</span>}
            {migrateMsg}
          </div>
        )}
      </div>

      {/* ─── エバーコール投入済 ─── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">エバーコール投入済CSV登録</h2>
        <p className="text-sm text-gray-500 mb-4">
          Everycallに投入済みの電話番号リストをアップロードします。
          ダッシュボードの「投入済数/未投入数」およびエクスポートの除外フィルタに使用されます。
        </p>

        {/* 現在の統計 */}
        <div className="mb-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">現在の登録状況</p>
          {ecStatsLoading ? (
            <p className="text-sm text-gray-400">読み込み中...</p>
          ) : ecStats.length === 0 ? (
            <p className="text-sm text-gray-400">未登録</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {LIST_GROUPS.map(g => {
                const s = ecStats.find(x => x.list_group === g);
                return (
                  <div key={g} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-0.5">{g}</p>
                    <p className="text-lg font-bold text-gray-800">
                      {s ? s.count.toLocaleString() : "0"} 件
                    </p>
                    {s && (
                      <p className="text-xs text-gray-400 mt-0.5">投入日: {s.latest_invested_at}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* クリーンアップ */}
        <div className="mb-5 pb-5 border-b border-gray-100">
          <p className="text-xs text-gray-500 mb-2">
            csv_dataに存在しない電話番号をeverycall_investedから削除します（DB容量節約）
          </p>
          <CleanupButton />
        </div>

        {/* アップロードフォーム */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">リストグループ</label>
              <select
                value={ecGroup}
                onChange={e => setEcGroup(e.target.value as ListGroup)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {LIST_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">投入日（yyyymmdd）</label>
              <input
                type="text"
                value={ecInvestedAt}
                onChange={e => setEcInvestedAt(e.target.value)}
                placeholder="20260528"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              CSVファイル（「電話番号」列を含むもの）
            </label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={e => setEcFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
            />
          </div>
          <button
            onClick={handleEverycallUpload}
            disabled={ecStatus === "running" || !ecFile}
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-40 transition-colors"
          >
            {ecStatus === "running" ? "アップロード中..." : "登録する"}
          </button>

          {/* 進捗バー */}
          {ecStatus === "running" && ecProgress.total > 0 && (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>処理中...</span>
                <span>{ecProgress.current.toLocaleString()} / {ecProgress.total.toLocaleString()}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${(ecProgress.current / ecProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {ecStatus !== "idle" && ecMsg && (
            <div className={`rounded-lg px-4 py-3 text-sm ${alertClass[ecStatus]}`}>
              {ecStatus === "success" && <span className="font-semibold mr-1">✓</span>}
              {ecStatus === "error"   && <span className="font-semibold mr-1">✗</span>}
              {ecMsg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
