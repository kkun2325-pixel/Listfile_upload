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
      const res = await fetch("/api/admin/evercall", {
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

  // ─── コール履歴インポート ──────────────────────────────
  const [chFile, setChFile]     = useState<File | null>(null);
  const [chGroup, setChGroup]   = useState<ListGroup>("飲食SH");
  const [chStatus, setChStatus] = useState<Status>("idle");
  const [chMsg, setChMsg]       = useState("");
  const chFileRef = useRef<HTMLInputElement>(null);

  // ─── アクティブセクション ──────────────────────────────
  const [activeSection, setActiveSection] = useState<string | null>(null);
  function toggleSection(id: string) { setActiveSection(prev => prev === id ? null : id); }

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) { router.push("/login"); return; }
    // ロール確認
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (payload.role !== "manager") { router.push("/dashboard"); return; }
    } catch { router.push("/dashboard"); return; }
    loadEcStats(token);
  }, [router]);

  async function loadEcStats(token: string) {
    setEcStatsLoading(true);
    try {
      const res = await fetch("/api/admin/evercall", {
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

  async function handleCallHistoryImport() {
    if (!chFile) { setChMsg("CSVファイルを選択してください"); setChStatus("error"); return; }
    setChStatus("running");
    setChMsg("");
    try {
      const token = localStorage.getItem("auth_token")!;
      const form = new FormData();
      form.append("file", chFile);
      form.append("listGroup", chGroup);
      const res = await fetch("/api/admin/import-call-history", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (data.success) {
        setChStatus("success");
        setChMsg(data.message ?? "完了");
        setChFile(null);
        if (chFileRef.current) chFileRef.current.value = "";
      } else {
        setChStatus("error");
        setChMsg(data.message ?? "インポートに失敗しました");
      }
    } catch (e) {
      setChStatus("error");
      setChMsg(String(e));
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
        const res = await fetch("/api/admin/evercall", {
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

  // ── カード定義 ───────────────────────────────────────────
  const CARDS = [
    {
      id: "call-history", title: "コール履歴", desc: "架電結果CSVを取り込んでDBに反映する",
      bg: "bg-blue-50", border: "border-blue-200", iconBg: "bg-blue-100", iconColor: "text-blue-600",
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>,
    },
    {
      id: "evercall", title: "Evercall投入", desc: "Evercallに投入した電話番号を記録する",
      bg: "bg-green-50", border: "border-green-200", iconBg: "bg-green-100", iconColor: "text-green-600",
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>,
    },
    {
      id: "seisa-diag", title: "精査数診断", desc: "精査数が合わないときに原因を特定する",
      bg: "bg-purple-50", border: "border-purple-200", iconBg: "bg-purple-100", iconColor: "text-purple-600",
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>,
    },
    {
      id: "cleanse-seat", title: "席数整形", desc: "「30席」「20〜30」などの表記を数値に揃える",
      bg: "bg-orange-50", border: "border-orange-200", iconBg: "bg-orange-100", iconColor: "text-orange-600",
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" /></svg>,
    },
    {
      id: "team", title: "チーム管理", desc: "担当チームとメンバーを追加・変更する",
      bg: "bg-indigo-50", border: "border-indigo-200", iconBg: "bg-indigo-100", iconColor: "text-indigo-600",
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>,
    },
    {
      id: "clean-rows", title: "空行削除", desc: "名前・電話番号が空のデータをまとめて消す",
      bg: "bg-gray-50", border: "border-gray-300", iconBg: "bg-gray-100", iconColor: "text-gray-600",
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>,
    },
    {
      id: "clean-phones", title: "電話番号整理", desc: "形式がおかしい電話番号を検出・修正する",
      bg: "bg-red-50", border: "border-red-200", iconBg: "bg-red-100", iconColor: "text-red-600",
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 3.75v4.5m0-4.5h-4.5m4.5 0l-6 6m3 12c-8.284 0-15-6.716-15-15V4.5A2.25 2.25 0 014.5 2.25h1.372c.516 0 .966.351 1.091.852l1.106 4.423c.11.44-.056.902-.417 1.173l-1.293.97a1.062 1.062 0 00-.38 1.21 12.035 12.035 0 007.143 7.143c.441.162.928-.004 1.21-.38l.97-1.293a1.125 1.125 0 011.173-.417l4.423 1.106c.5.125.852.575.852 1.091V19.5a2.25 2.25 0 01-2.25 2.25h-.75z" /></svg>,
    },
    {
      id: "db-migrate", title: "DBスキーマ", desc: "DB構造の変更（通常は使いません）",
      bg: "bg-slate-50", border: "border-slate-200", iconBg: "bg-slate-100", iconColor: "text-slate-600",
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 2.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" /></svg>,
    },
  ] as const;

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">管理</h1>
        <p className="text-sm text-gray-500 mt-1">データベース管理・各種メンテナンス</p>
      </div>

      {/* ── カードグリッド ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {CARDS.map(card => {
          const active = activeSection === card.id;
          return (
            <button
              key={card.id}
              onClick={() => toggleSection(card.id)}
              className={`border rounded-xl p-4 text-left transition-all hover:shadow-sm ${
                active ? `${card.bg} ${card.border}` : "bg-white border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${active ? card.iconBg : "bg-gray-100"} ${active ? card.iconColor : "text-gray-500"}`}>
                {card.icon}
              </div>
              <p className="text-sm font-semibold text-gray-900 leading-snug">{card.title}</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-snug">{card.desc}</p>
            </button>
          );
        })}
      </div>

      {/* ── アクティブセクション ── */}
      <div>
        {/* コール履歴インポート */}
        {activeSection === "call-history" && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1">コール履歴インポート</h2>
            <p className="text-sm text-gray-500 mb-5">
              飲食店架電リストグループCSVを取り込み、コール結果・ステータスからランク（0〜10）を自動判定してDBに反映します。
            </p>
            <div className="flex flex-wrap gap-4 mb-5">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">リストグループ</label>
                <select value={chGroup} onChange={e => setChGroup(e.target.value as ListGroup)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300">
                  {LIST_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">CSVファイル</label>
                <input ref={chFileRef} type="file" accept=".csv" onChange={e => setChFile(e.target.files?.[0] ?? null)}
                  className="block text-sm text-gray-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-gray-300 file:text-sm file:bg-white file:text-gray-700 hover:file:bg-gray-50" />
              </div>
            </div>
            <button onClick={handleCallHistoryImport} disabled={chStatus === "running" || !chFile}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors">
              {chStatus === "running" ? "処理中..." : "取り込み実行"}
            </button>
            {chStatus !== "idle" && chMsg && (
              <div className={`mt-3 rounded-lg px-4 py-3 text-sm ${alertClass[chStatus]}`}>
                {chStatus === "success" && "✓ "}{chStatus === "error" && "✗ "}{chMsg}
              </div>
            )}
            <div className="mt-5 pt-4 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-400 mb-2">ランク判定ルール</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs text-gray-500">
                {[["9","受注"],["6","有効拒否"],["7","フル拒否"],["5","決裁者拒否"],["8","AF切"],["2","見込"],
                  ["3","非決"],["4","入口ガチャ"],["1","留守・不在・SKIP・見込後"],["10","現アナ・他社・対象外・閉業"],
                ].map(([rank, label]) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <span className="font-bold text-gray-700 w-3 text-right shrink-0">{rank}</span>
                    <span className="text-gray-400">:</span>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Evercall投入済 */}
        {activeSection === "evercall" && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Evercall投入済CSV登録</h2>
            <p className="text-sm text-gray-500 mb-5">
              投入済みの電話番号リストをアップロードします。ダッシュボードの投入済数・エクスポートの除外フィルタに反映されます。
            </p>
            <div className="mb-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">現在の登録状況</p>
              {ecStatsLoading ? (
                <p className="text-sm text-gray-400">読み込み中...</p>
              ) : ecStats.length === 0 ? (
                <p className="text-sm text-gray-400">未登録</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {LIST_GROUPS.map(g => {
                    const s = ecStats.find(x => x.list_group === g);
                    return (
                      <div key={g} className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-0.5">{g}</p>
                        <p className="text-lg font-bold text-gray-800">{s ? s.count.toLocaleString() : "0"} 件</p>
                        {s && <p className="text-xs text-gray-400 mt-0.5">{s.latest_invested_at}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="mb-5 pb-5 border-b border-gray-100">
              <p className="text-xs text-gray-500 mb-2">DBに存在しない電話番号をevercall_investedから削除します</p>
              <CleanupButton />
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">リストグループ</label>
                  <select value={ecGroup} onChange={e => setEcGroup(e.target.value as ListGroup)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {LIST_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">投入日（yyyymmdd）</label>
                  <input type="text" value={ecInvestedAt} onChange={e => setEcInvestedAt(e.target.value)}
                    placeholder="20260528"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">CSVファイル（「電話番号」列を含むもの）</label>
                <input ref={fileRef} type="file" accept=".csv" onChange={e => setEcFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200" />
              </div>
              <button onClick={handleEverycallUpload} disabled={ecStatus === "running" || !ecFile}
                className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-40 transition-colors">
                {ecStatus === "running" ? "アップロード中..." : "登録する"}
              </button>
              {ecStatus === "running" && ecProgress.total > 0 && (
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>処理中...</span>
                    <span>{ecProgress.current.toLocaleString()} / {ecProgress.total.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${(ecProgress.current / ecProgress.total) * 100}%` }} />
                  </div>
                </div>
              )}
              {ecStatus !== "idle" && ecMsg && (
                <div className={`rounded-lg px-4 py-3 text-sm ${alertClass[ecStatus]}`}>
                  {ecStatus === "success" && "✓ "}{ecStatus === "error" && "✗ "}{ecMsg}
                </div>
              )}
            </div>
          </div>
        )}

        {activeSection === "seisa-diag"   && <SeisaDiagSection />}
        {activeSection === "cleanse-seat" && <CleanseSeatSection />}
        {activeSection === "team"         && <TeamManagementSection />}
        {activeSection === "clean-rows"   && <CleanEmptyRowsSection />}
        {activeSection === "clean-phones" && <CleanInvalidPhonesSection />}

        {/* DBスキーマ移行 */}
        {activeSection === "db-migrate" && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1">DBスキーマ移行</h2>
            <p className="text-sm text-gray-500 mb-4">
              既存データを保持したまま、旧JSON形式から新固定カラム構造に移行します。
            </p>
            <button onClick={handleMigrate} disabled={migrateStatus === "running"}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors">
              {migrateStatus === "running" ? "移行中..." : "スキーマ移行を実行"}
            </button>
            {migrateStatus !== "idle" && migrateMsg && (
              <div className={`mt-4 rounded-lg px-4 py-3 text-sm ${alertClass[migrateStatus]}`}>
                {migrateStatus === "success" && "✓ "}{migrateStatus === "error" && "✗ "}{migrateMsg}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 精査数診断コンポーネント ──────────────────────────────

interface FunnelStep { step: string; count: number }
interface DiagSample {
  担当者: string; worker_name: string; report_date: string;
  抽出名前: string; 抽出日付4桁: string; 期待日付: string; 日付一致: boolean;
}

function SeisaDiagSection() {
  const [start, setStart]     = useState("2026-06-01");
  const [end, setEnd]         = useState("");
  const [loading, setLoading] = useState(false);
  const [funnel, setFunnel]   = useState<FunnelStep[] | null>(null);
  const [samples, setSamples] = useState<DiagSample[]>([]);
  const [error, setError]     = useState("");
  const [open, setOpen]       = useState(false);

  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") ?? "" : "";

  async function run() {
    setLoading(true); setError(""); setFunnel(null); setSamples([]);
    try {
      const sp = new URLSearchParams({ start });
      if (end) sp.set("end", end);
      const res = await fetch(`/api/admin/seisa-diag?${sp}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (!d.success) { setError(d.message ?? "エラー"); return; }
      setFunnel(d.funnel);
      setSamples(d.samples ?? []);
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }

  const maxCount = funnel ? funnel[0]?.count ?? 1 : 1;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button className="w-full flex items-center justify-between px-6 py-4"
        onClick={() => setOpen(v => !v)}>
        <div>
          <h2 className="text-base font-semibold text-gray-900 text-left">精査数カウント診断</h2>
          <p className="text-xs text-gray-400 mt-0.5 text-left">どの条件で件数が落ちているか調べます</p>
        </div>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
          className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className="px-6 pb-6 border-t border-gray-100 space-y-5">
          {/* 期間指定 */}
          <div className="flex flex-wrap gap-3 items-end pt-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">開始日</label>
              <input type="date" value={start} onChange={e => setStart(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">終了日</label>
              <input type="date" value={end} onChange={e => setEnd(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <button onClick={run} disabled={loading}
              className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-40">
              {loading ? "診断中..." : "診断を実行"}
            </button>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          {/* ファネル表示 */}
          {funnel && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">件数ファネル</p>
              {funnel.map((f, i) => {
                const prev = i > 0 ? funnel[i - 1].count : f.count;
                const drop = prev - f.count;
                const pct  = maxCount > 0 ? Math.round(f.count / maxCount * 100) : 0;
                const isBigDrop = drop > 0 && drop / (prev || 1) > 0.1;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-600">{f.step}</span>
                      <div className="flex items-center gap-2">
                        {drop > 0 && (
                          <span className={`text-xs font-medium ${isBigDrop ? "text-red-500" : "text-gray-400"}`}>
                            {isBigDrop ? "▼" : "↓"} {drop.toLocaleString()} 件減
                          </span>
                        )}
                        <span className="text-sm font-bold text-gray-900 w-24 text-right">
                          {f.count.toLocaleString()} 件
                        </span>
                      </div>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isBigDrop ? "bg-red-400" : "bg-blue-400"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}

              {/* 最終的な損失率 */}
              {funnel.length > 1 && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600">
                    最終精査数: <span className="font-bold text-gray-900">{funnel[funnel.length - 1].count.toLocaleString()} 件</span>
                    <span className="mx-2 text-gray-300">/</span>
                    時間振り入力済み全件: <span className="font-bold text-gray-900">{funnel[0].count.toLocaleString()} 件</span>
                    <span className="mx-2 text-gray-300">→</span>
                    <span className={`font-bold ${funnel[funnel.length-1].count / (funnel[0].count || 1) < 0.8 ? "text-red-500" : "text-green-600"}`}>
                      {maxCount > 0 ? Math.round(funnel[funnel.length-1].count / maxCount * 100) : 0}% がカウントされている
                    </span>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* サンプル */}
          {samples.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                担当者列サンプル（最新10件）
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      {["担当者列の値", "worker_name", "作業日", "抽出名前", "抽出日付", "期待日付", "一致?"].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {samples.map((s, i) => (
                      <tr key={i} className={s.日付一致 ? "" : "bg-red-50"}>
                        <td className="px-3 py-2 font-mono text-gray-800">{s.担当者}</td>
                        <td className="px-3 py-2 text-gray-600">{s.worker_name}</td>
                        <td className="px-3 py-2 text-gray-600">{s.report_date}</td>
                        <td className="px-3 py-2 text-gray-600">{s.抽出名前}</td>
                        <td className={`px-3 py-2 font-mono ${!s.日付一致 ? "text-red-600 font-bold" : "text-gray-600"}`}>{s.抽出日付4桁}</td>
                        <td className="px-3 py-2 font-mono text-gray-600">{s.期待日付}</td>
                        <td className="px-3 py-2">
                          {s.日付一致
                            ? <span className="text-green-600 font-bold">✓</span>
                            : <span className="text-red-500 font-bold">✗</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400">赤行 = 日付不一致のためカウントから除外されているレコード</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 席数クレンジングコンポーネント ───────────────────────

interface SeatPreviewRow { raw: string; cleansed: string | null; count: number }

function CleanseSeatSection() {
  const [previewStatus, setPreviewStatus] = useState<Status>("idle");
  const [execStatus, setExecStatus]       = useState<Status>("idle");
  const [preview, setPreview]   = useState<SeatPreviewRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [msg, setMsg] = useState("");

  const alertClass: Record<Status, string> = {
    idle:    "",
    running: "bg-yellow-50 border border-yellow-200 text-yellow-800",
    success: "bg-green-50 border border-green-200 text-green-800",
    error:   "bg-red-50 border border-red-200 text-red-700",
  };

  async function handlePreview() {
    const token = localStorage.getItem("auth_token");
    if (!token) return;
    setPreviewStatus("running");
    setPreview([]);
    setMsg("");
    try {
      const res  = await fetch("/api/admin/cleanse-seats", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) {
        setPreviewStatus("success");
        setPreview(data.preview ?? []);
        setTotalRows(data.total_rows ?? 0);
      } else {
        setPreviewStatus("error");
        setMsg(data.message ?? "プレビュー失敗");
      }
    } catch (e) { setPreviewStatus("error"); setMsg(String(e)); }
  }

  async function handleExecute() {
    const token = localStorage.getItem("auth_token");
    if (!token) return;
    setExecStatus("running");
    setMsg("");
    try {
      const res  = await fetch("/api/admin/cleanse-seats", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setExecStatus("success");
        setMsg(`完了: ${(data.updated_rows ?? 0).toLocaleString()} 行を更新（${data.patterns ?? 0} パターン）`);
        setPreview([]);
        setTotalRows(0);
      } else {
        setExecStatus("error");
        setMsg(data.message ?? "実行失敗");
      }
    } catch (e) { setExecStatus("error"); setMsg(String(e)); }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-base font-semibold text-gray-900 mb-1">席数データのクレンジング</h2>
      <p className="text-sm text-gray-500 mb-4">
        「20-30」「30席」などの表記を整数に統一します。範囲は平均値、文字混じりは数字のみ抽出。
      </p>

      <div className="flex gap-3 mb-4">
        <button
          onClick={handlePreview}
          disabled={previewStatus === "running" || execStatus === "running"}
          className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
        >
          {previewStatus === "running" ? "確認中..." : "対象を確認"}
        </button>
        <button
          onClick={handleExecute}
          disabled={execStatus === "running" || previewStatus === "running"}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
        >
          {execStatus === "running" ? "実行中..." : "クレンジング実行"}
        </button>
      </div>

      {msg && (
        <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${alertClass[execStatus !== "idle" ? execStatus : previewStatus]}`}>
          {execStatus === "success" && <span className="font-semibold mr-1">✓</span>}
          {(execStatus === "error" || previewStatus === "error") && <span className="font-semibold mr-1">✗</span>}
          {msg}
        </div>
      )}

      {preview.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">
            対象: <span className="font-semibold text-gray-800">{totalRows.toLocaleString()} 行</span>
            （ユニーク値 {preview.length} 件を表示）
          </p>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-3 py-2 text-left text-gray-500 font-semibold">現在の値</th>
                  <th className="px-3 py-2 text-left text-gray-500 font-semibold">変換後</th>
                  <th className="px-3 py-2 text-right text-gray-500 font-semibold">件数</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {preview.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-1.5 font-mono text-gray-700">{r.raw}</td>
                    <td className="px-3 py-1.5 font-mono">
                      {r.cleansed !== null
                        ? <span className="text-blue-700 font-medium">{r.cleansed}</span>
                        : <span className="text-gray-400">NULL（空欄）</span>}
                    </td>
                    <td className="px-3 py-1.5 text-right text-gray-600">{r.count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── チーム管理コンポーネント ──────────────────────────────

interface TeamMember { id: string; name: string; team_id: string }
interface Team { id: string; name: string; members: TeamMember[] }

function TeamManagementSection() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [seedMsg, setSeedMsg] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberTeam, setNewMemberTeam] = useState("");
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") ?? "" : "";

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/teams", { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (d.success) { setTeams(d.teams); if (d.teams.length > 0) setNewMemberTeam(d.teams[0].id); }
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleSeed() {
    setSeedMsg("");
    const r = await fetch("/api/teams", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "seed" }) });
    const d = await r.json();
    setSeedMsg(d.message ?? (d.success ? "完了" : "エラー"));
    load();
  }

  async function handleAddTeam() {
    if (!newTeamName.trim()) return;
    await fetch("/api/teams", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ name: newTeamName.trim() }) });
    setNewTeamName(""); load();
  }

  async function handleAddMember() {
    if (!newMemberName.trim() || !newMemberTeam) return;
    await fetch(`/api/teams/${newMemberTeam}/members`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ name: newMemberName.trim() }) });
    setNewMemberName(""); load();
  }

  async function handleDeleteMember(id: string) {
    await fetch(`/api/teams/members/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    load();
  }

  async function handleDeleteTeam(id: string) {
    if (!confirm("チームとメンバーをすべて削除しますか？")) return;
    await fetch(`/api/teams/members/${id}?type=team`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    load();
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900">チーム・メンバー管理</h2>
        <button onClick={handleSeed} className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50">
          初期データ登録
        </button>
      </div>
      {seedMsg && <p className="text-xs text-green-600 mb-3">{seedMsg}</p>}

      {loading ? (
        <p className="text-sm text-gray-400">読み込み中...</p>
      ) : (
        <>
          {/* チーム一覧 */}
          <div className="space-y-4 mb-6">
            {teams.map(team => (
              <div key={team.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-gray-800">{team.name}</p>
                  <button onClick={() => handleDeleteTeam(team.id)} className="text-xs text-red-500 hover:text-red-700">削除</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {team.members.map(m => (
                    <span key={m.id} className="flex items-center gap-1 bg-gray-100 rounded-full px-2.5 py-0.5 text-xs text-gray-700">
                      {m.name}
                      <button onClick={() => handleDeleteMember(m.id)} className="text-gray-400 hover:text-red-500 ml-0.5">×</button>
                    </span>
                  ))}
                  {team.members.length === 0 && <span className="text-xs text-gray-400">メンバーなし</span>}
                </div>
              </div>
            ))}
          </div>

          {/* メンバー追加 */}
          <div className="border-t border-gray-100 pt-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">メンバー追加</p>
            <div className="flex gap-2">
              <input value={newMemberName} onChange={e => setNewMemberName(e.target.value)} placeholder="名前（苗字のみ）"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              <select value={newMemberTeam} onChange={e => setNewMemberTeam(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <button onClick={handleAddMember} className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700">追加</button>
            </div>
          </div>

          {/* チーム追加 */}
          <div className="border-t border-gray-100 pt-4 mt-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">新規チーム追加</p>
            <div className="flex gap-2">
              <input value={newTeamName} onChange={e => setNewTeamName(e.target.value)} placeholder="チーム名"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              <button onClick={handleAddTeam} className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700">作成</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── 空行クリーンアップ ────────────────────────────────────────

function CleanEmptyRowsSection() {
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [status, setStatus]             = useState<"idle" | "previewing" | "deleting" | "done" | "error">("idle");
  const [deletedCount, setDeletedCount] = useState<number | null>(null);
  const [msg, setMsg]                   = useState("");

  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") ?? "" : "";

  async function handlePreview() {
    setStatus("previewing"); setMsg(""); setPreviewCount(null);
    try {
      const res = await fetch("/api/admin/clean-empty-rows", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (!d.success) { setStatus("error"); setMsg(d.message ?? "エラー"); return; }
      setPreviewCount(d.count);
      setStatus("idle");
    } catch (e) { setStatus("error"); setMsg(String(e)); }
  }

  async function handleDelete() {
    if (!confirm(`名前・電話番号・住所がすべて空のレコード ${previewCount?.toLocaleString()} 件を削除します。よろしいですか？`)) return;
    setStatus("deleting"); setMsg("");
    try {
      const res = await fetch("/api/admin/clean-empty-rows", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (!d.success) { setStatus("error"); setMsg(d.message ?? "エラー"); return; }
      setDeletedCount(d.deleted);
      setPreviewCount(null);
      setStatus("done");
    } catch (e) { setStatus("error"); setMsg(String(e)); }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-base font-semibold text-gray-900 mb-1">空行クリーンアップ</h2>
      <p className="text-sm text-gray-500 mb-4">
        名前・電話番号・住所1・住所2 がすべて空のレコードを削除します。
      </p>

      <div className="flex gap-2">
        <button onClick={handlePreview} disabled={status === "previewing" || status === "deleting"}
          className="px-4 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors">
          {status === "previewing" ? "確認中..." : "件数を確認"}
        </button>
        {previewCount !== null && previewCount > 0 && (
          <button onClick={handleDelete} disabled={status === "deleting"}
            className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-40 transition-colors">
            {status === "deleting" ? "削除中..." : `${previewCount.toLocaleString()} 件を削除`}
          </button>
        )}
      </div>

      {previewCount !== null && (
        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm font-medium text-amber-800">
            対象: <span className="font-bold">{previewCount.toLocaleString()} 件</span>
          </p>
          {previewCount === 0 && (
            <p className="text-xs text-amber-600 mt-1">削除対象のレコードはありません</p>
          )}
        </div>
      )}

      {status === "done" && deletedCount !== null && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm font-medium text-green-800">
            ✓ <span className="font-bold">{deletedCount.toLocaleString()} 件</span> を削除しました
          </p>
        </div>
      )}

      {status === "error" && msg && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{msg}</div>
      )}
    </div>
  );
}

// ── 不正電話番号クリーンアップ ────────────────────────────────

function CleanInvalidPhonesSection() {
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [samples, setSamples]           = useState<string[]>([]);
  const [status, setStatus]             = useState<"idle" | "previewing" | "deleting" | "done" | "error">("idle");
  const [deletedCount, setDeletedCount] = useState<number | null>(null);
  const [msg, setMsg]                   = useState("");

  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") ?? "" : "";

  async function handlePreview() {
    setStatus("previewing"); setMsg(""); setPreviewCount(null); setSamples([]);
    try {
      const res = await fetch("/api/admin/clean-invalid-phones", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (!d.success) { setStatus("error"); setMsg(d.message ?? "エラー"); return; }
      setPreviewCount(d.count);
      setSamples(d.samples ?? []);
      setStatus("idle");
    } catch (e) { setStatus("error"); setMsg(String(e)); }
  }

  async function handleDelete() {
    if (!confirm(`"20000" で始まる10桁の電話番号 ${previewCount?.toLocaleString()} 件を削除します。よろしいですか？`)) return;
    setStatus("deleting"); setMsg("");
    try {
      const res = await fetch("/api/admin/clean-invalid-phones", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (!d.success) { setStatus("error"); setMsg(d.message ?? "エラー"); return; }
      setDeletedCount(d.deleted);
      setPreviewCount(null);
      setSamples([]);
      setStatus("done");
    } catch (e) { setStatus("error"); setMsg(String(e)); }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-base font-semibold text-gray-900 mb-1">不正電話番号クリーンアップ</h2>
      <p className="text-sm text-gray-500 mb-4">
        <code className="bg-gray-100 px-1 rounded text-xs">20000</code> で始まる10桁の電話番号（電話番号ではない疑似データ）をDBから削除します。
      </p>

      <div className="flex gap-2">
        <button onClick={handlePreview} disabled={status === "previewing" || status === "deleting"}
          className="px-4 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors">
          {status === "previewing" ? "確認中..." : "件数を確認"}
        </button>
        {previewCount !== null && previewCount > 0 && (
          <button onClick={handleDelete} disabled={status === "deleting"}
            className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-40 transition-colors">
            {status === "deleting" ? "削除中..." : `${previewCount.toLocaleString()} 件を削除`}
          </button>
        )}
      </div>

      {previewCount !== null && (
        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm font-medium text-amber-800">
            対象: <span className="font-bold">{previewCount.toLocaleString()} 件</span>
          </p>
          {samples.length > 0 && (
            <p className="text-xs text-amber-700 mt-1">
              サンプル: {samples.slice(0, 5).join(", ")}
              {samples.length > 5 && " ..."}
            </p>
          )}
          {previewCount === 0 && (
            <p className="text-xs text-amber-600 mt-1">削除対象のレコードはありません</p>
          )}
        </div>
      )}

      {status === "done" && deletedCount !== null && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm font-medium text-green-800">
            ✓ <span className="font-bold">{deletedCount.toLocaleString()} 件</span> を削除しました
          </p>
        </div>
      )}

      {status === "error" && msg && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{msg}</div>
      )}
    </div>
  );
}
