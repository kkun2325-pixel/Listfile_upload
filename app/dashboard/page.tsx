"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

// ── 型定義 ────────────────────────────────────────────────

interface GroupStat {
  tokunyu:  number;
  mitorunyu: number;
  rank_distribution: { rank: string; count: number }[];
}

interface Stats {
  total:               number;
  seisa_count:         number;
  unseisa_count:       number;
  tokunyu_count:       number;
  honsha_seisa_count?: number;
  missing: { jikanfuri: number; teikyu: number; sekisuu: number; genre: number; bikou: number };
  groups: Record<string, GroupStat>;
  list_rank_distribution: { rank: string; count: number }[];
}

type TabKey = "全体" | "飲食SH" | "サイネージ" | "デリバリー" | "ペイメント";
const TABS: TabKey[] = ["全体", "飲食SH", "サイネージ", "デリバリー", "ペイメント"];

// 結果ランク カラー（0〜10）
const RESULT_RANK_COLORS: Record<string, string> = {
  "0": "#d1d5db", "1": "#9ca3af", "2": "#60a5fa",
  "3": "#a78bfa", "4": "#f87171", "5": "#34d399",
  "6": "#fbbf24", "7": "#3b82f6", "8": "#fb923c",
  "9": "#10b981", "10": "#ef4444",
};

const LIST_RANK_COLORS: Record<string, string> = {
  "1": "#dbeafe", "2": "#93c5fd", "3": "#60a5fa",
  "4": "#3b82f6", "5": "#2563eb", "6": "#1d4ed8", "7": "#1e3a8a",
};

// ── コンポーネント ────────────────────────────────────────

function StatCard({
  label, value, sub, valueColor, bgClass,
}: {
  label: string; value: number; sub?: string;
  valueColor: string; bgClass?: string;
}) {
  return (
    <div className={`rounded-xl border p-5 ${bgClass ?? "bg-white border-gray-200"}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${valueColor}`}>{value.toLocaleString()}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function MissingCard({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
  return (
    <div className="bg-white rounded-xl border border-orange-100 p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-orange-500">{value.toLocaleString()}</p>
      <div className="mt-2 flex items-center gap-2">
        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
          <div
            className="bg-orange-400 h-1.5 rounded-full"
            style={{ width: `${Math.min(parseFloat(pct), 100)}%` }}
          />
        </div>
        <span className="text-xs text-gray-400 shrink-0">{pct}%</span>
      </div>
    </div>
  );
}

function ResultRankTooltip({
  active, payload, rankLabels,
}: {
  active?: boolean;
  payload?: { payload: { rank: string; count: number } }[];
  rankLabels: Record<string, string>;
}) {
  if (!active || !payload?.length) return null;
  const { rank, count } = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-md text-xs max-w-[200px]">
      <p className="font-semibold text-gray-700 mb-0.5">ランク {rank}</p>
      <p className="text-gray-500 mb-1 leading-snug">{rankLabels[rank] ?? rank}</p>
      <p className="font-semibold text-gray-800">{count.toLocaleString()} 件</p>
    </div>
  );
}

function ListRankTooltip({
  active, payload, rankLabels,
}: {
  active?: boolean;
  payload?: { payload: { rank: string; count: number } }[];
  rankLabels: Record<string, string>;
}) {
  if (!active || !payload?.length) return null;
  const { rank, count } = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-md text-xs max-w-[220px]">
      <p className="font-semibold text-blue-700 mb-0.5">リストランク {rank}</p>
      <p className="text-gray-500 mb-1 leading-snug">{rankLabels[rank] ?? rank}</p>
      <p className="font-semibold text-gray-800">{count.toLocaleString()} 件</p>
    </div>
  );
}

// ── メインページ ──────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats]               = useState<Stats | null>(null);
  const [resultRankLabels, setRRL]      = useState<Record<string, string>>({});
  const [listRankLabels, setLRL]        = useState<Record<string, string>>({});
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState("");
  const [activeTab, setActiveTab]       = useState<TabKey>("飲食SH");

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) { router.push("/login"); return; }
    fetch("/api/dashboard", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (r.status === 401) { router.push("/login"); return null; } return r.json(); })
      .then(data => {
        if (!data) return;
        if (!data.success) { setError(data.message ?? "エラーが発生しました"); return; }
        setStats(data.stats);
        setRRL(data.result_rank_labels ?? {});
        setLRL(data.list_rank_labels ?? {});
      })
      .catch(() => setError("データ取得に失敗しました"))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
    </div>
  );

  if (error) return (
    <div className="p-8">
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
    </div>
  );

  if (!stats) return null;

  const seisaRate = stats.total > 0 ? ((stats.seisa_count / stats.total) * 100).toFixed(1) : "0.0";
  const group     = stats.groups[activeTab] ?? { tokunyu: 0, mitorunyu: 0, rank_distribution: [] };
  const rankChartData = group.rank_distribution.filter(d => d.rank !== '0');

  return (
    <div className="p-8 max-w-5xl">

      {/* ─── ヘッダー ─── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>
          <p className="text-sm text-gray-500 mt-1">リストDB 全体統計</p>
        </div>
        <Link
          href="/dashboard/upload"
          className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          アップロード
        </Link>
      </div>

      {/* ─── 行①：メインサマリー ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        <StatCard
          label="総リスト数" value={stats.total} sub="DB全件数"
          valueColor="text-gray-800"
        />
        <StatCard
          label="店舗精査済数" value={stats.seisa_count} sub={`精査率 ${seisaRate}%`}
          valueColor="text-blue-600"
        />
        <StatCard
          label="未精査数" value={stats.unseisa_count} sub="要精査"
          valueColor="text-orange-500"
        />
        <StatCard
          label="本社精査済数" value={stats.honsha_seisa_count ?? 0} sub="本社精査 = 1"
          valueColor="text-purple-600" bgClass="bg-purple-50 border-purple-200"
        />
        <StatCard
          label="投入可能数" value={stats.tokunyu_count} sub="精査済み＆未投入"
          valueColor="text-green-700" bgClass="bg-green-50 border-green-200"
        />
      </div>

      {/* ─── 行②：未精査内訳 ─── */}
      <div className="mb-8">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-0.5">
          未精査内訳（欠損カラム別）
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <MissingCard label="時間振り未登録" value={stats.missing.jikanfuri} total={stats.total} />
          <MissingCard label="定休日未登録"   value={stats.missing.teikyu}    total={stats.total} />
          <MissingCard label="席数未登録"     value={stats.missing.sekisuu}   total={stats.total} />
          <MissingCard label="ジャンル未登録" value={stats.missing.genre}     total={stats.total} />
          <MissingCard label="備考未登録"     value={stats.missing.bikou}     total={stats.total} />
        </div>
      </div>

      {/* ─── リストランク分布 ─── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <p className="text-sm font-semibold text-gray-700 mb-3">リストランク別件数（情報充填度）</p>
        {stats.list_rank_distribution.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.list_rank_distribution} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <XAxis dataKey="rank" tick={{ fontSize: 11 }} tickFormatter={v => `Rank ${v}`} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => Number(v).toLocaleString()} width={56} />
                <Tooltip content={<ListRankTooltip rankLabels={listRankLabels} />} />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {stats.list_rank_distribution.map((entry, i) => (
                    <Cell key={i} fill={LIST_RANK_COLORS[entry.rank] ?? "#3b82f6"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
              {stats.list_rank_distribution.map(({ rank }) => (
                <span key={rank} className="flex items-center gap-1 text-xs text-gray-500">
                  <span
                    className="w-2.5 h-2.5 rounded-sm inline-block shrink-0"
                    style={{ backgroundColor: LIST_RANK_COLORS[rank] ?? "#3b82f6" }}
                  />
                  {rank}: {listRankLabels[rank] ?? rank}
                </span>
              ))}
            </div>
          </>
        ) : (
          <p className="text-gray-400 text-sm text-center py-8">データなし</p>
        )}
      </div>

      {/* ─── リストグループ別集計（タブ） ─── */}
      <div className="bg-white rounded-xl border border-gray-200 mb-6">
        {/* タブバー */}
        <div className="flex border-b border-gray-200">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "border-b-2 border-gray-900 text-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* 投入済 / 未投入 */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">{activeTab === "全体" ? "架電済数" : "投入済数"}</p>
              <p className="text-2xl font-bold text-blue-600">{group.tokunyu.toLocaleString()}</p>
              <p className="text-xs text-gray-400 mt-1">最大進捗 ≥ 1</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">{activeTab === "全体" ? "未架電数" : "未投入数"}</p>
              <p className="text-2xl font-bold text-gray-700">{group.mitorunyu.toLocaleString()}</p>
              <p className="text-xs text-gray-400 mt-1">最大進捗 = 0</p>
            </div>
          </div>

          {/* 結果ランク棒グラフ */}
          <p className="text-sm font-semibold text-gray-700 mb-3">
            {activeTab === "全体" ? "最大進捗ランク別件数（全体）" : "結果ランク別件数"}
          </p>
          {rankChartData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={rankChartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <XAxis dataKey="rank" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => Number(v).toLocaleString()} width={52} />
                  <Tooltip content={<ResultRankTooltip rankLabels={resultRankLabels} />} />
                  <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                    {rankChartData.map((entry, i) => (
                      <Cell key={i} fill={RESULT_RANK_COLORS[entry.rank] ?? "#6b7280"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {/* 凡例 */}
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                {rankChartData.map(({ rank }) => (
                  <span key={rank} className="flex items-center gap-1 text-xs text-gray-500">
                    <span
                      className="w-2.5 h-2.5 rounded-sm inline-block shrink-0"
                      style={{ backgroundColor: RESULT_RANK_COLORS[rank] ?? "#6b7280" }}
                    />
                    {rank}: {resultRankLabels[rank] ?? rank}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="text-gray-400 text-sm text-center py-8">データなし</p>
          )}
        </div>
      </div>

    </div>
  );
}
