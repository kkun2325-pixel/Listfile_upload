"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

const FILL_FIELDS = ["時間振り", "席数", "定休日", "ジャンル", "備考"] as const;
type FillField = (typeof FILL_FIELDS)[number];

// ── 集計ビュー型 ──────────────────────────────────────────
interface FillStat { filled: number; missing: number; rate: number | null }
interface Member {
  name: string; seisa_count: number; work_hours: number; per_hour: number | null;
  fill: Record<FillField, FillStat>;
}
interface TeamData {
  id: string; name: string; seisa_count: number; work_hours: number;
  per_hour: number | null; fill_rates: Record<FillField | "avg", number | null>;
  taigai: { reason: string; count: number; rate: number }[];
  members: Member[];
}
interface ReportData { total_work_hours: number; teams: TeamData[] }

// ── 日報ビュー型 ──────────────────────────────────────────
interface FillCount { filled: number; total: number }
interface DayMember {
  name: string; seisa_count: number; work_hours: number; per_hour: number | null;
  fill: Record<FillField, FillCount>;
}
interface DayEntry {
  date: string; seisa_count: number; work_hours: number; per_hour: number | null;
  fill: Record<FillField, FillCount>; members: DayMember[];
}
interface DailyTeam {
  id: string; name: string; total_seisa: number; total_hours: number; days: DayEntry[];
}
interface DailyData { teams: DailyTeam[] }

// ── 共通ヘルパー ──────────────────────────────────────────
function RateCell({ val, invert = false }: { val: number | null; invert?: boolean }) {
  if (val === null) return <span className="text-gray-300 text-xs">—</span>;
  const good = invert ? val <= 10 : val >= 90;
  const warn = invert ? val <= 30 : val >= 70;
  return (
    <span className={`text-xs font-medium ${good ? "text-green-600" : warn ? "text-yellow-600" : "text-red-500"}`}>
      {val.toFixed(1)}%
    </span>
  );
}

function FillCountCell({ fill }: { fill: FillCount }) {
  const missing = fill.total - fill.filled;
  return (
    <span className={`text-xs font-medium ${missing === 0 ? "text-green-600" : missing <= 2 ? "text-yellow-600" : "text-red-500"}`}>
      {fill.filled}/{fill.total}
    </span>
  );
}

function formatDate(iso: string): string {
  const m = iso.match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${parseInt(m[2])}/${parseInt(m[3])}` : iso;
}

const AUTO_REFRESH_SEC = 60;

export default function ProductivityPage() {
  const router = useRouter();

  // manager ガード
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) { router.push("/login"); return; }
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (payload.role !== "manager") router.push("/dashboard");
    } catch { router.push("/dashboard"); }
  }, [router]);

  // 共通
  const [viewMode, setViewMode] = useState<"aggregate" | "daily">("aggregate");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate]     = useState("");
  const [activeTeam, setActiveTeam] = useState<string>("__top__");
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(AUTO_REFRESH_SEC);

  // 集計ビュー
  const [data, setData] = useState<ReportData | null>(null);

  // 日報ビュー
  const [dailyData, setDailyData] = useState<DailyData | null>(null);

  const fetchAggregate = useCallback(async () => {
    const token = localStorage.getItem("auth_token");
    if (!token) { router.push("/login"); return; }
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("start", startDate);
      if (endDate)   params.set("end",   endDate);
      const res = await fetch(`/api/productivity?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      if (!d.success) { setError(d.message); return; }
      setData(d as ReportData);
      setLastUpdated(new Date());
      setCountdown(AUTO_REFRESH_SEC);
    } catch { setError("データ取得に失敗しました"); }
    finally { setLoading(false); }
  }, [router, startDate, endDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchDaily = useCallback(async () => {
    const token = localStorage.getItem("auth_token");
    if (!token) { router.push("/login"); return; }
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("start", startDate);
      if (endDate)   params.set("end",   endDate);
      const res = await fetch(`/api/daily?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      if (!d.success) { setError(d.message); return; }
      setDailyData(d as DailyData);
      setLastUpdated(new Date());
      setCountdown(AUTO_REFRESH_SEC);
    } catch { setError("データ取得に失敗しました"); }
    finally { setLoading(false); }
  }, [router, startDate, endDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = useCallback(() => {
    if (viewMode === "aggregate") return fetchAggregate();
    return fetchDaily();
  }, [viewMode, fetchAggregate, fetchDaily]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const interval = setInterval(() => { fetchData(); }, AUTO_REFRESH_SEC * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown(c => (c <= 1 ? AUTO_REFRESH_SEC : c - 1));
    }, 1000);
    return () => clearInterval(tick);
  }, [lastUpdated]);

  // ビュー切替時にリセット
  const switchView = (mode: "aggregate" | "daily") => {
    setViewMode(mode);
    setActiveTeam("__top__");
    setError("");
  };

  if (loading && !data && !dailyData) return (
    <div className="flex items-center justify-center min-h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
    </div>
  );

  // 集計ビュー用
  const teamsWithData = data?.teams.filter(t => t.seisa_count > 0 || t.members.length > 0) ?? [];
  const selectedTeam  = teamsWithData.find(t => t.id === activeTeam) ?? null;

  // 日報ビュー用
  const dailyTeams      = dailyData?.teams ?? [];
  const selectedDailyTeam = dailyTeams.find(t => t.id === activeTeam) ?? null;

  // タブ表示に使うチームリスト（現在のビューに応じて切替）
  const tabTeams = viewMode === "aggregate" ? teamsWithData : dailyTeams;

  return (
    <div className="p-8 max-w-7xl">
      {/* ヘッダー */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">レポート</h1>
          <p className="text-sm text-gray-500 mt-1">2026年6月1日以降のアップロードデータを集計</p>
        </div>
        <div className="flex items-center gap-3 mt-1">
          {lastUpdated && (
            <div className="text-right">
              <p className="text-xs text-gray-400">最終更新: {lastUpdated.toLocaleTimeString("ja-JP")}</p>
              <p className="text-xs text-gray-400">次回更新まで {countdown}秒</p>
            </div>
          )}
          <button onClick={fetchData} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8}
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M4 4v5h5M16 16v-5h-5M4 9a7 7 0 0114 0M16 11a7 7 0 01-14 0" />
            </svg>
            更新
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}

      {/* ビュー切替 + フィルター */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex flex-wrap gap-4 items-end">
        {/* ビュー切替ボタン */}
        <div className="flex rounded-lg border border-gray-300 overflow-hidden">
          <button
            onClick={() => switchView("aggregate")}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              viewMode === "aggregate"
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            集計
          </button>
          <button
            onClick={() => switchView("daily")}
            className={`px-4 py-1.5 text-sm font-medium border-l border-gray-300 transition-colors ${
              viewMode === "daily"
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            日報
          </button>
        </div>
        {/* 期間フィルター */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">開始日</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">終了日</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
        </div>
        <button onClick={fetchData}
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700">
          絞り込み
        </button>
        <button onClick={() => { setStartDate(""); setEndDate(""); }}
          className="px-4 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50">
          リセット
        </button>
      </div>

      {/* タブ */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
        <button
          onClick={() => setActiveTeam("__top__")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
            activeTeam === "__top__"
              ? "border-gray-900 text-gray-900"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          TOP
        </button>
        {tabTeams.map(t => (
          <button key={t.id} onClick={() => setActiveTeam(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
              activeTeam === t.id
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>

      {/* ═══════════════ 集計ビュー ═══════════════ */}
      {viewMode === "aggregate" && (
        <>
          {activeTeam === "__top__" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <p className="text-xs text-gray-500 mb-1">合計稼働時間</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {data?.total_work_hours.toFixed(1) ?? "—"}
                    <span className="text-base font-normal text-gray-500 ml-1">h</span>
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <p className="text-xs text-gray-500 mb-1">合計精査数</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {teamsWithData.reduce((s, t) => s + t.seisa_count, 0).toLocaleString()}
                    <span className="text-base font-normal text-gray-500 ml-1">件</span>
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <p className="text-xs text-gray-500 mb-1">全体 精査数/h</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {(() => {
                      const ts = teamsWithData.reduce((s, t) => s + t.seisa_count, 0);
                      const th = data?.total_work_hours ?? 0;
                      return th > 0 ? (ts / th).toFixed(1) : "—";
                    })()}
                  </p>
                </div>
              </div>
              {teamsWithData.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
                  2026年6月1日以降のデータがありません
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-700">チーム別集計</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">チーム</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 whitespace-nowrap">精査数</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 whitespace-nowrap">稼働時間</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 whitespace-nowrap">精査数/h</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 whitespace-nowrap">時間振り</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 whitespace-nowrap">席数</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 whitespace-nowrap">定休日</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 whitespace-nowrap">ジャンル</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 whitespace-nowrap">備考</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 whitespace-nowrap">平均充填率</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {teamsWithData.map(t => (
                          <tr key={t.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setActiveTeam(t.id)}>
                            <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{t.name}</td>
                            <td className="px-4 py-3 text-right font-medium text-gray-900">{t.seisa_count.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right text-gray-600">{t.work_hours.toFixed(1)}h</td>
                            <td className="px-4 py-3 text-right font-medium text-indigo-600">
                              {t.per_hour != null ? t.per_hour.toFixed(1) : "—"}
                            </td>
                            {FILL_FIELDS.map(f => (
                              <td key={f} className="px-4 py-3 text-right">
                                <RateCell val={t.fill_rates[f]} />
                              </td>
                            ))}
                            <td className="px-4 py-3 text-right">
                              <RateCell val={t.fill_rates.avg} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTeam !== "__top__" && selectedTeam && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-700">対象外理由（{selectedTeam.name}）</p>
                </div>
                {selectedTeam.taigai.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-gray-400">対象外理由のデータがありません</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">理由</th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500">件数</th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500">割合</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 w-64">バー</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {selectedTeam.taigai.map(r => (
                          <tr key={r.reason} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5 text-gray-800">{r.reason}</td>
                            <td className="px-4 py-2.5 text-right font-medium text-gray-900">{r.count.toLocaleString()}</td>
                            <td className="px-4 py-2.5 text-right text-gray-600">{r.rate.toFixed(1)}%</td>
                            <td className="px-4 py-2.5">
                              <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden w-full">
                                <div className="h-full rounded-full bg-orange-400" style={{ width: `${Math.min(r.rate, 100)}%` }} />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-700">個人別精査実績（{selectedTeam.name}）</p>
                </div>
                {selectedTeam.members.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-gray-400">期間内のデータがありません</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">担当者</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 whitespace-nowrap">精査数</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 whitespace-nowrap">稼働時間</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 whitespace-nowrap">精査数/h</th>
                          {FILL_FIELDS.map(f => (
                            <th key={f} className="px-3 py-3 text-center text-xs font-semibold text-gray-500 whitespace-nowrap" colSpan={2}>{f}</th>
                          ))}
                        </tr>
                        <tr className="border-b border-gray-200">
                          <th colSpan={4} />
                          {FILL_FIELDS.map(f => (
                            <>
                              <th key={f + "_m"} className="px-2 py-1.5 text-center text-xs text-gray-400 font-normal whitespace-nowrap">欠損数</th>
                              <th key={f + "_r"} className="px-2 py-1.5 text-center text-xs text-gray-400 font-normal whitespace-nowrap">欠損率</th>
                            </>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {selectedTeam.members.map(m => (
                          <tr key={m.name} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{m.name}</td>
                            <td className="px-4 py-3 text-right font-medium text-gray-900">{m.seisa_count.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right text-gray-600">{m.work_hours.toFixed(1)}h</td>
                            <td className="px-4 py-3 text-right font-medium text-indigo-600">
                              {m.per_hour != null ? m.per_hour.toFixed(1) : "—"}
                            </td>
                            {FILL_FIELDS.map(f => {
                              const stat = m.fill[f];
                              return (
                                <>
                                  <td key={f + "_m"} className="px-2 py-3 text-center text-xs text-gray-600">
                                    {stat.missing > 0
                                      ? <span className="text-red-500 font-medium">{stat.missing.toLocaleString()}</span>
                                      : <span className="text-gray-300">0</span>}
                                  </td>
                                  <td key={f + "_r"} className="px-2 py-3 text-center">
                                    {stat.rate != null
                                      ? <RateCell val={100 - stat.rate} invert />
                                      : <span className="text-gray-300 text-xs">—</span>}
                                  </td>
                                </>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
                          <td className="px-4 py-3 text-xs text-gray-600">合計</td>
                          <td className="px-4 py-3 text-right text-sm text-gray-900">{selectedTeam.seisa_count.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-sm text-gray-600">{selectedTeam.work_hours.toFixed(1)}h</td>
                          <td className="px-4 py-3 text-right text-sm text-indigo-600">
                            {selectedTeam.per_hour != null ? selectedTeam.per_hour.toFixed(1) : "—"}
                          </td>
                          {FILL_FIELDS.map(f => {
                            const totalMissing = selectedTeam.members.reduce((s, m) => s + m.fill[f].missing, 0);
                            const fillRate     = selectedTeam.fill_rates[f];
                            return (
                              <>
                                <td key={f + "_m"} className="px-2 py-3 text-center text-xs">
                                  {totalMissing > 0
                                    ? <span className="text-red-500 font-medium">{totalMissing.toLocaleString()}</span>
                                    : <span className="text-gray-300">0</span>}
                                </td>
                                <td key={f + "_r"} className="px-2 py-3 text-center">
                                  {fillRate != null
                                    ? <RateCell val={100 - fillRate} invert />
                                    : <span className="text-gray-300 text-xs">—</span>}
                                </td>
                              </>
                            );
                          })}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-sm font-semibold text-gray-700 mb-4">情報充填率（{selectedTeam.name}）</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  {FILL_FIELDS.map(f => {
                    const rate = selectedTeam.fill_rates[f];
                    return (
                      <div key={f} className="text-center">
                        <p className="text-xs text-gray-500 mb-1">{f}</p>
                        <p className={`text-2xl font-bold ${
                          rate == null ? "text-gray-300"
                          : rate >= 90 ? "text-green-600"
                          : rate >= 70 ? "text-yellow-600"
                          : "text-red-500"
                        }`}>
                          {rate != null ? `${rate.toFixed(1)}%` : "—"}
                        </p>
                      </div>
                    );
                  })}
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">平均</p>
                    <p className={`text-2xl font-bold ${
                      selectedTeam.fill_rates.avg == null ? "text-gray-300"
                      : selectedTeam.fill_rates.avg >= 90 ? "text-green-600"
                      : selectedTeam.fill_rates.avg >= 70 ? "text-yellow-600"
                      : "text-red-500"
                    }`}>
                      {selectedTeam.fill_rates.avg != null ? `${selectedTeam.fill_rates.avg.toFixed(1)}%` : "—"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══════════════ 日報ビュー ═══════════════ */}
      {viewMode === "daily" && (
        <>
          {/* 日報 TOP タブ */}
          {activeTeam === "__top__" && (
            <div className="space-y-6">
              {dailyTeams.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
                  2026年6月1日以降のデータがありません
                </div>
              ) : (
                <DailyTopTable teams={dailyTeams} onTeamClick={setActiveTeam} />
              )}
            </div>
          )}

          {/* 日報 チームタブ */}
          {activeTeam !== "__top__" && selectedDailyTeam && (
            <DailyTeamView team={selectedDailyTeam} />
          )}
        </>
      )}
    </div>
  );
}

// ─── 日報 TOP テーブル（日付×チームのサマリー） ────────────────────
function DailyTopTable({ teams, onTeamClick }: { teams: DailyTeam[]; onTeamClick: (id: string) => void }) {
  // 全チームの日付セットを収集
  const allDates = [...new Set(teams.flatMap(t => t.days.map(d => d.date)))].sort();

  // date → teamId → dayEntry のマップ
  const matrix: Record<string, Record<string, DayEntry>> = {};
  for (const date of allDates) matrix[date] = {};
  for (const team of teams) {
    for (const day of team.days) {
      matrix[day.date][team.id] = day;
    }
  }

  // 日付ごとの全チーム合計
  const dateTotals: Record<string, { seisa: number; hours: number }> = {};
  for (const date of allDates) {
    dateTotals[date] = { seisa: 0, hours: 0 };
    for (const team of teams) {
      const d = matrix[date][team.id];
      if (d) {
        dateTotals[date].seisa += d.seisa_count;
        dateTotals[date].hours += d.work_hours;
      }
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-700">日付別チームサマリー</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap sticky left-0 bg-gray-50">日付</th>
              {teams.map(t => (
                <th key={t.id} className="px-3 py-3 text-center text-xs font-semibold text-gray-500 whitespace-nowrap" colSpan={2}>
                  <button className="hover:text-gray-900 transition-colors" onClick={() => onTeamClick(t.id)}>
                    {t.name}
                  </button>
                </th>
              ))}
              <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 whitespace-nowrap" colSpan={2}>合計</th>
            </tr>
            <tr className="border-b border-gray-200">
              <th className="sticky left-0 bg-gray-50" />
              {teams.map(t => (
                <>
                  <th key={t.id + "_s"} className="px-2 py-1.5 text-center text-xs text-gray-400 font-normal whitespace-nowrap">精査数</th>
                  <th key={t.id + "_h"} className="px-2 py-1.5 text-center text-xs text-gray-400 font-normal whitespace-nowrap">稼働h</th>
                </>
              ))}
              <th className="px-2 py-1.5 text-center text-xs text-gray-400 font-normal whitespace-nowrap">精査数</th>
              <th className="px-2 py-1.5 text-center text-xs text-gray-400 font-normal whitespace-nowrap">稼働h</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {allDates.map(date => {
              const tot = dateTotals[date];
              return (
                <tr key={date} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-gray-800 whitespace-nowrap sticky left-0 bg-white">
                    {formatDate(date)}
                  </td>
                  {teams.map(t => {
                    const d = matrix[date][t.id];
                    return (
                      <>
                        <td key={t.id + "_s"} className="px-2 py-2.5 text-center text-gray-900">
                          {d ? d.seisa_count.toLocaleString() : <span className="text-gray-300">—</span>}
                        </td>
                        <td key={t.id + "_h"} className="px-2 py-2.5 text-center text-gray-600">
                          {d ? d.work_hours.toFixed(1) : <span className="text-gray-300">—</span>}
                        </td>
                      </>
                    );
                  })}
                  <td className="px-2 py-2.5 text-center font-semibold text-gray-900">{tot.seisa.toLocaleString()}</td>
                  <td className="px-2 py-2.5 text-center font-semibold text-gray-600">{tot.hours.toFixed(1)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
              <td className="px-4 py-3 text-xs text-gray-600 sticky left-0 bg-gray-50">合計</td>
              {teams.map(t => (
                <>
                  <td key={t.id + "_s"} className="px-2 py-3 text-center text-sm text-gray-900">{t.total_seisa.toLocaleString()}</td>
                  <td key={t.id + "_h"} className="px-2 py-3 text-center text-sm text-gray-600">{t.total_hours.toFixed(1)}</td>
                </>
              ))}
              <td className="px-2 py-3 text-center text-sm text-gray-900">
                {teams.reduce((s, t) => s + t.total_seisa, 0).toLocaleString()}
              </td>
              <td className="px-2 py-3 text-center text-sm text-gray-600">
                {teams.reduce((s, t) => s + t.total_hours, 0).toFixed(1)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── 日報 チームタブ（日付グループ + 件数充填表示） ───────────────────
function DailyTeamView({ team }: { team: DailyTeam }) {
  return (
    <div className="space-y-4">
      {/* チームサマリー */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 mb-1">合計精査数</p>
          <p className="text-3xl font-bold text-gray-900">
            {team.total_seisa.toLocaleString()}
            <span className="text-base font-normal text-gray-500 ml-1">件</span>
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 mb-1">合計稼働時間</p>
          <p className="text-3xl font-bold text-gray-900">
            {team.total_hours.toFixed(1)}
            <span className="text-base font-normal text-gray-500 ml-1">h</span>
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 mb-1">平均 精査数/h</p>
          <p className="text-3xl font-bold text-gray-900">
            {team.total_hours > 0 ? (team.total_seisa / team.total_hours).toFixed(1) : "—"}
          </p>
        </div>
      </div>

      {/* 日付別テーブル */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-700">日報（{team.name}）</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">日付</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">担当者</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 whitespace-nowrap">稼働時間</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 whitespace-nowrap">精査数</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 whitespace-nowrap">精査数/h</th>
                {FILL_FIELDS.map(f => (
                  <th key={f} className="px-3 py-3 text-center text-xs font-semibold text-gray-500 whitespace-nowrap">{f}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {team.days.map((day, di) => (
                <>
                  {/* メンバー行 */}
                  {day.members.map((m, mi) => (
                    <tr key={`${day.date}-${m.name}`}
                      className={`border-t border-gray-100 hover:bg-gray-50 transition-colors ${mi === 0 && di > 0 ? "border-t-2 border-gray-200" : ""}`}
                    >
                      {/* 日付は各日の最初の行だけ表示 */}
                      {mi === 0 ? (
                        <td className="px-4 py-2.5 font-semibold text-gray-700 whitespace-nowrap align-top" rowSpan={day.members.length + 1}>
                          {formatDate(day.date)}
                        </td>
                      ) : null}
                      <td className="px-4 py-2.5 text-gray-800 whitespace-nowrap">{m.name}</td>
                      <td className="px-4 py-2.5 text-right text-gray-600">{m.work_hours.toFixed(1)}h</td>
                      <td className="px-4 py-2.5 text-right font-medium text-gray-900">{m.seisa_count.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-indigo-600">
                        {m.per_hour != null ? m.per_hour.toFixed(1) : "—"}
                      </td>
                      {FILL_FIELDS.map(f => (
                        <td key={f} className="px-3 py-2.5 text-center">
                          <FillCountCell fill={m.fill[f]} />
                        </td>
                      ))}
                    </tr>
                  ))}
                  {/* 日計行 */}
                  <tr className="bg-gray-50 border-t border-gray-200">
                    <td className="px-4 py-2 text-xs text-gray-500 font-medium whitespace-nowrap">
                      {formatDate(day.date)} 合計
                    </td>
                    <td className="px-4 py-2 text-right text-xs text-gray-600">{day.work_hours.toFixed(1)}h</td>
                    <td className="px-4 py-2 text-right text-xs font-semibold text-gray-900">{day.seisa_count.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-xs font-medium text-indigo-600">
                      {day.per_hour != null ? day.per_hour.toFixed(1) : "—"}
                    </td>
                    {FILL_FIELDS.map(f => (
                      <td key={f} className="px-3 py-2 text-center">
                        <FillCountCell fill={day.fill[f]} />
                      </td>
                    ))}
                  </tr>
                </>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100 border-t-2 border-gray-300 font-semibold">
                <td className="px-4 py-3 text-xs text-gray-700">総合計</td>
                <td className="px-4 py-3 text-right text-xs text-gray-600">
                  {team.days.reduce((s, d) => s + d.work_hours, 0).toFixed(1)}h
                </td>
                <td className="px-4 py-3 text-right text-sm text-gray-900">{team.total_seisa.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-sm text-indigo-600">
                  {team.total_hours > 0 ? (team.total_seisa / team.total_hours).toFixed(1) : "—"}
                </td>
                {FILL_FIELDS.map(f => {
                  const filled = team.days.reduce((s, d) => s + d.fill[f].filled, 0);
                  const total  = team.days.reduce((s, d) => s + d.fill[f].total,  0);
                  return (
                    <td key={f} className="px-3 py-3 text-center">
                      <FillCountCell fill={{ filled, total }} />
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
