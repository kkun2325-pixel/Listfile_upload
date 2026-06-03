"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Papa from "papaparse";
import { mapCsvColumnsToDb } from "@/lib/csv";

interface UnregisteredMember {
  name: string;
  selectedTeamId: string;
}

interface TeamMember { id: string; name: string; teamName: string }
interface Team { id: string; name: string; members?: { id: string; name: string }[] }

interface HistoryItem {
  id: string;
  username: string;
  worker_name: string | null;
  report_date: string | null;
  original_filename: string;
  row_count: number;
  inserted_count: number;
  updated_count: number;
  uploaded_at: string;
  status: string;
  work_hours: number | null;
}

type Tab = "upload" | "history";

const TEAM_OPTIONS = ['第五本部', '第五本部（アルバイト）', '第七本部', '第八本部'] as const;

export default function UploadPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("upload");

  // アップロードフォーム状態
  const [file, setFile] = useState<File | null>(null);
  const [reportDate, setReportDate] = useState("");
  const [selectedTeam, setSelectedTeam] = useState("");
  const [workHours, setWorkHours] = useState("");
  const [workerName, setWorkerName] = useState("");    // 確定した担当者名
  const [workerQuery, setWorkerQuery] = useState("");  // 検索テキスト
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [resultModal, setResultModal] = useState<{ inserted: number; seisaCount: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // 担当者チェック
  const [showMemberWarning, setShowMemberWarning] = useState(false);
  const [unregisteredMembers, setUnregisteredMembers] = useState<UnregisteredMember[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [allMembers, setAllMembers] = useState<TeamMember[]>([]);
  const [, setPendingSubmit] = useState(false);

  // 履歴タブ状態
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  const comboboxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) { router.push("/login"); return; }
    fetch("/api/teams", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (!d.success) return;
        setTeams(d.teams);
        const flat: TeamMember[] = (d.teams as Team[]).flatMap(t =>
          (t.members ?? []).map(m => ({ id: m.id, name: m.name, teamName: t.name }))
        );
        setAllMembers(flat.sort((a, b) => a.name.localeCompare(b.name, "ja")));
      })
      .catch(() => {});
  }, [router]);

  // コンボボックス外クリックで閉じる
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // 検索候補の絞り込み
  // 選択チームでメンバーを絞り込み
  const membersForTeam = selectedTeam
    ? allMembers.filter(m => m.teamName === selectedTeam)
    : allMembers;

  const suggestions = (() => {
    const q = workerQuery.trim().toLowerCase();
    if (!q) return membersForTeam.slice(0, 30);
    return membersForTeam.filter(m => m.name.toLowerCase().includes(q));
  })();

  function handleTeamChange(team: string) {
    setSelectedTeam(team);
    setWorkerName("");
    setWorkerQuery("");
    setShowSuggestions(false);
  }

  function handleWorkerQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setWorkerQuery(v);
    setWorkerName(v);
    setShowSuggestions(true);
  }

  function handleSelectMember(m: TeamMember) {
    setWorkerName(m.name);
    setWorkerQuery(m.name);
    setShowSuggestions(false);
  }

  function handleClearWorker() {
    setWorkerName("");
    setWorkerQuery("");
    setShowSuggestions(false);
  }

  async function fetchHistory() {
    const token = localStorage.getItem("auth_token");
    if (!token) return;
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const res = await fetch("/api/history", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { setHistoryError("履歴の取得に失敗しました"); return; }
      const data = await res.json();
      setHistory(data.uploads || []);
    } catch {
      setHistoryError("エラーが発生しました");
    } finally {
      setHistoryLoading(false);
    }
  }

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    if (tab === "history" && history.length === 0 && !historyLoading) {
      fetchHistory();
    }
  }

  function extractWorkerName(raw: string): string {
    return raw.replace(/[0-9].*/g, "").trim();
  }

  async function checkWorkersFromFile(f: File): Promise<string[]> {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = e => {
        const text = e.target?.result as string;
        const { data } = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
        const names = new Set<string>();
        for (const row of data) {
          const raw = row["担当者"] ?? row["担当者 "] ?? "";
          if (raw) {
            const name = extractWorkerName(raw);
            if (name) names.add(name);
          }
        }
        resolve([...names]);
      };
      reader.readAsText(f, "shift-jis");
    });
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (!selected.name.endsWith(".csv")) { setError("CSVファイルのみアップロード可能です"); setFile(null); return; }
    setError("");
    setFile(selected);
  }

  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (!dropped) return;
    if (!dropped.name.endsWith(".csv")) { setError("CSVファイルのみアップロード可能です"); return; }
    setError("");
    setFile(dropped);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!file) { setError("ファイルを選択してください"); return; }
    if (!workHours || isNaN(parseFloat(workHours)) || parseFloat(workHours) <= 0) {
      setError("作業時間を正しく入力してください（例：2.5）"); return;
    }
    if (!reportDate) {
      setError("報告対象日を選択してください"); return;
    }
    if (!selectedTeam) {
      setError("チームを選択してください"); return;
    }
    if (!workerName.trim()) {
      setError("担当者を選択してください"); return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("auth_token");
      const workerNames = await checkWorkersFromFile(file);
      if (workerNames.length > 0) {
        const res = await fetch("/api/uploads/check-members", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ names: workerNames }),
        });
        const d = await res.json();
        if (d.success && d.unregistered.length > 0) {
          setUnregisteredMembers(d.unregistered.map((n: string) => ({ name: n, selectedTeamId: teams[0]?.id ?? "" })));
          setPendingSubmit(true);
          setShowMemberWarning(true);
          setLoading(false);
          return;
        }
      }
      await doUpload();
    } catch (e) {
      setError(`エラー: ${e instanceof Error ? e.message : String(e)}`);
      setLoading(false);
    }
  }

  async function handleMemberWarningConfirm() {
    setShowMemberWarning(false);
    setLoading(true);
    const token = localStorage.getItem("auth_token");
    for (const m of unregisteredMembers) {
      if (m.selectedTeamId) {
        await fetch(`/api/teams/${m.selectedTeamId}/members`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ name: m.name }),
        });
      }
    }
    await doUpload();
  }

  async function doUpload() {
    const BATCH    = 1500; // バッチサイズ（500 → 1500）
    const PARALLEL = 3;    // 中間バッチの並列数

    try {
      const token = localStorage.getItem("auth_token");
      setProgress(0);
      setProgressLabel("CSVを解析中...");

      // ── CSV解析 ──
      const text = await file!.text();
      const parsed = await new Promise<Papa.ParseResult<Record<string, string>>>((resolve) => {
        Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true, complete: resolve });
      });
      if (parsed.errors.length > 0 && parsed.data.length === 0) {
        setError("CSVファイルの解析に失敗しました"); return;
      }
      const allRows    = parsed.data.map(r => mapCsvColumnsToDb(r));
      const totalRows  = allRows.length;
      const seisaCount = allRows.filter(r => r["時間振り"] && r["時間振り"].trim() !== "").length;

      // ── バッチ開始インデックス一覧 ──
      const batchStarts: number[] = [];
      for (let i = 0; i < totalRows; i += BATCH) batchStarts.push(i);
      const numBatches = batchStarts.length;

      let uploadId = "";

      // 進捗更新ヘルパー
      const updateProgress = (sent: number) => {
        const pct = Math.round(10 + (Math.min(sent, totalRows) / totalRows) * 85);
        setProgress(pct);
        setProgressLabel(`送信中... ${Math.min(sent, totalRows).toLocaleString()} / ${totalRows.toLocaleString()} 行`);
      };

      // バッチ送信ヘルパー（並列処理内でも使用）
      const sendOne = async (start: number, isFinal: boolean, isFirst: boolean): Promise<Record<string, unknown>> => {
        const chunk = allRows.slice(start, Math.min(start + BATCH, totalRows));
        const body: Record<string, unknown> = { rows: chunk, row_offset: start, is_final: isFinal };
        if (isFirst) {
          body.filename    = file!.name;
          body.report_date = reportDate;
          body.work_hours  = parseFloat(workHours);
          body.worker_name = workerName.trim();
          body.total_rows  = totalRows;
        } else {
          body.upload_id = uploadId;
        }
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        let data: Record<string, unknown>;
        try { data = await res.json(); }
        catch {
          const txt = await res.text().catch(() => "(読み取り失敗)");
          throw new Error(`サーバーエラー (HTTP ${res.status}): ${txt.substring(0, 200)}`);
        }
        if (!res.ok) throw new Error(String(data.message) || "アップロードに失敗しました");
        return data;
      };

      // ── STEP1: 最初のバッチ（順次・upload_id 取得） ──
      updateProgress(0);
      const firstData = await sendOne(0, numBatches === 1, true);
      uploadId = String(firstData.upload_id ?? "");
      updateProgress(Math.min(BATCH, totalRows));

      if (numBatches === 1) {
        // 1バッチで完了
        setProgress(100); setProgressLabel("完了");
        setResultModal({ inserted: Number(firstData.inserted_count ?? 0), seisaCount });
      } else {
        // ── STEP2: 中間バッチ（並列送信） ──
        const middleStarts = batchStarts.slice(1, numBatches - 1);
        for (let g = 0; g < middleStarts.length; g += PARALLEL) {
          const group = middleStarts.slice(g, g + PARALLEL);
          await Promise.all(group.map(start => sendOne(start, false, false)));
          updateProgress(group[group.length - 1] + BATCH);
        }

        // ── STEP3: 最終バッチ（順次・is_final=true） ──
        const lastStart  = batchStarts[numBatches - 1];
        const finalData  = await sendOne(lastStart, true, false);
        setProgress(100); setProgressLabel("完了");
        setResultModal({ inserted: Number(finalData.inserted_count ?? 0), seisaCount });
      }

      setFile(null); setReportDate(""); setSelectedTeam(""); setWorkHours(""); setWorkerName(""); setWorkerQuery(""); setPendingSubmit(false);
      setTimeout(() => { setProgress(0); setProgressLabel(""); }, 1500);
      await fetchHistory();
      setTimeout(() => handleTabChange("history"), 2000);

    } catch (e) { setError(`アップロードエラー: ${e instanceof Error ? e.message : String(e)}`); }
    finally { setLoading(false); }
  }

  return (
    <div className="p-8">
      {/* アップロード完了モーダル */}
      {resultModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8 text-center">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-green-100 mx-auto mb-5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-7 h-7 text-green-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">アップロード完了</h2>
            <p className="text-xs text-gray-400 mb-7">データが正常に登録されました</p>
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-gray-50 rounded-xl py-5">
                <p className="text-4xl font-bold text-gray-900 tabular-nums">
                  {resultModal.inserted.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mt-2">新規登録</p>
              </div>
              <div className="bg-indigo-50 rounded-xl py-5">
                <p className="text-4xl font-bold text-indigo-600 tabular-nums">
                  {resultModal.seisaCount.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mt-2">精査数</p>
              </div>
            </div>
            <button
              onClick={() => { setResultModal(null); fetchHistory(); handleTabChange("history"); }}
              className="w-full px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">アップロード</h1>
        <p className="text-sm text-gray-500 mt-1">CSVファイルのアップロードと履歴確認</p>
      </div>

      {/* タブ */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {(["upload", "history"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "upload" ? "アップロード" : "履歴"}
          </button>
        ))}
      </div>

      {/* アップロードタブ */}
      {activeTab === "upload" && (
        <div className="max-w-lg">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}

            <form onSubmit={handleSubmit}>
              {/* 報告対象日 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  報告対象日 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={reportDate}
                  onChange={e => setReportDate(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              {/* チーム選択 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  チーム <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedTeam}
                  onChange={e => handleTeamChange(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                >
                  <option value="">チームを選択してください</option>
                  {TEAM_OPTIONS.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* 担当者 検索コンボボックス */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  担当者 <span className="text-red-500">*</span>
                </label>
                <div className="relative" ref={comboboxRef}>
                  <div className={`flex items-center border rounded-lg px-3 py-2 gap-2 transition-colors ${
                    showSuggestions ? "border-gray-900 ring-2 ring-gray-900 ring-opacity-20" : "border-gray-300"
                  }`}>
                    {/* 検索アイコン */}
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4 text-gray-400 shrink-0">
                      <circle cx="8.5" cy="8.5" r="5.5" />
                      <path strokeLinecap="round" d="M13.5 13.5l3 3" />
                    </svg>
                    <input
                      type="text"
                      value={workerQuery}
                      onChange={handleWorkerQueryChange}
                      onFocus={() => setShowSuggestions(true)}
                      placeholder={selectedTeam ? "名前で検索して選択..." : "先にチームを選択してください"}
                      autoComplete="off"
                      className="flex-1 text-sm bg-transparent focus:outline-none"
                    />
                    {/* 選択済みバッジ or クリアボタン */}
                    {workerName && (
                      <button
                        type="button"
                        onClick={handleClearWorker}
                        className="shrink-0 text-gray-400 hover:text-gray-600"
                        tabIndex={-1}
                      >
                        <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                          <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* サジェストドロップダウン */}
                  {showSuggestions && (
                    <ul className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-52 overflow-y-auto">
                      {suggestions.length === 0 ? (
                        <li className="px-3 py-3 text-xs text-gray-400 text-center">
                          一致するメンバーが見つかりません
                        </li>
                      ) : suggestions.map(m => (
                        <li
                          key={m.id}
                          onMouseDown={() => handleSelectMember(m)}
                          className={`flex items-center justify-between px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors ${
                            workerName === m.name ? "bg-gray-50" : ""
                          }`}
                        >
                          <span className={`text-sm ${workerName === m.name ? "font-semibold text-gray-900" : "text-gray-800"}`}>
                            {m.name}
                          </span>
                          <span className="text-xs text-gray-400 ml-3 shrink-0">{m.teamName}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {/* 選択中の表示 */}
                {workerName && allMembers.some(m => m.name === workerName) && (
                  <p className="mt-1 text-xs text-gray-500">
                    選択中: <span className="font-medium text-gray-700">{workerName}</span>
                    {" "}
                    <span className="text-gray-400">
                      ({allMembers.find(m => m.name === workerName)?.teamName})
                    </span>
                  </p>
                )}
              </div>

              {/* 作業時間 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  作業時間 <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={workHours}
                    onChange={e => setWorkHours(e.target.value)}
                    placeholder="例：2.5"
                    className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                  <span className="text-sm text-gray-500">時間</span>
                </div>
              </div>

              {/* ファイル選択 */}
              <label
                htmlFor="file-input"
                className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-10 cursor-pointer transition-colors ${
                  dragOver ? "border-gray-500 bg-gray-50" : file ? "border-green-400 bg-green-50" : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                }`}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
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
                <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" id="file-input" />
              </label>

              <button
                type="submit"
                disabled={!file || loading}
                className="w-full mt-4 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "処理中..." : "アップロード"}
              </button>

              {/* 進捗ゲージ */}
              {loading && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-gray-500">{progressLabel}</span>
                    <span className="text-xs font-semibold text-gray-700">{progress}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gray-900 transition-all duration-300 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}
            </form>
            <p className="text-xs text-gray-400 mt-3 text-center">※ CSVファイル（.csv）のみ対応</p>
          </div>
        </div>
      )}

      {/* 履歴タブ */}
      {activeTab === "history" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">全ユーザーのアップロード履歴</p>
            <button
              onClick={fetchHistory}
              disabled={historyLoading}
              className="text-xs text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40"
            >
              {historyLoading ? "読み込み中..." : "更新"}
            </button>
          </div>

          {historyError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
              {historyError}
            </div>
          )}

          {historyLoading && history.length === 0 ? (
            <div className="flex items-center justify-center min-h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
            </div>
          ) : history.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <p className="text-gray-400 text-sm">まだアップロードがありません</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">ユーザー名</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">担当者名</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">報告対象日</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">ファイル名</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 whitespace-nowrap">行数</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 whitespace-nowrap">
                        <span className="text-green-700">新規追加</span>
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 whitespace-nowrap">
                        <span className="text-blue-700">更新</span>
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 whitespace-nowrap">作業時間</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">日時</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {history.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600 shrink-0">
                              {item.username.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-gray-700 text-xs font-medium">{item.username}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-700">
                          {item.worker_name ?? <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                          {item.report_date
                            ? new Date(item.report_date + "T00:00:00").toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900 text-xs max-w-xs truncate">
                          {item.original_filename}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500 text-xs">
                          {item.row_count.toLocaleString()} 行
                        </td>
                        <td className="px-4 py-3 text-right">
                          {item.inserted_count > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                              +{item.inserted_count.toLocaleString()}
                            </span>
                          ) : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {item.updated_count > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                              ↻{item.updated_count.toLocaleString()}
                            </span>
                          ) : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-gray-500">
                          {item.work_hours != null ? `${item.work_hours}h` : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                          {new Date(item.uploaded_at).toLocaleString("ja-JP")}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/dashboard/export/${item.id}`}
                              className="text-xs text-gray-600 border border-gray-200 px-2 py-1 rounded hover:bg-gray-50 transition-colors"
                            >
                              エクスポート
                            </Link>
                            <Link
                              href={`/dashboard/analysis/${item.id}`}
                              className="text-xs text-gray-600 border border-gray-200 px-2 py-1 rounded hover:bg-gray-50 transition-colors"
                            >
                              分析
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex flex-wrap items-center gap-6 text-xs text-gray-500">
                <span>合計 {history.length} 件</span>
                <span>総行数 {history.reduce((s, h) => s + h.row_count, 0).toLocaleString()} 行</span>
                <span className="text-green-700 font-medium">新規追加 {history.reduce((s, h) => s + h.inserted_count, 0).toLocaleString()} 件</span>
                <span className="text-blue-700 font-medium">更新 {history.reduce((s, h) => s + h.updated_count, 0).toLocaleString()} 件</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 未登録担当者モーダル */}
      {showMemberWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">未登録の担当者があります</h2>
            <p className="text-sm text-gray-500 mb-4">以下の担当者が未登録です。チームを選択してください。</p>
            <div className="space-y-3 mb-6 max-h-60 overflow-y-auto">
              {unregisteredMembers.map((m, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-800 w-20 shrink-0">{m.name}</span>
                  <select
                    value={m.selectedTeamId}
                    onChange={e => setUnregisteredMembers(prev => prev.map((x, j) => j === i ? { ...x, selectedTeamId: e.target.value } : x))}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  >
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowMemberWarning(false); setLoading(false); setPendingSubmit(false); }}
                className="flex-1 px-4 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50"
              >キャンセル</button>
              <button
                onClick={handleMemberWarningConfirm}
                className="flex-1 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700"
              >登録してアップロード</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
