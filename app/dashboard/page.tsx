"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, Legend,
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
  missing: { jikanfuri: number; teikyu: number; sekisuu: number; genre: number; bikou: number; name: number; address: number };
  groups: Record<string, GroupStat>;
  list_rank_distribution: { rank: string; count: number }[];
}

interface CalcRankStats {
  distribution: Record<string, number>;
  rank1Missing: { seki_only: number; jikan_only: number; both: number };
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
  const [rankHistory, setRankHistory]   = useState<Record<string, string | number>[]>([]);
  const [calcRankStats, setCalcRankStats] = useState<CalcRankStats | null>(null);

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

    // ランク推移履歴を取得
    fetch("/api/admin/snapshot", { headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` } })
      .then(r => r.json())
      .then(data => { if (data.success) setRankHistory(data.history ?? []); })
      .catch(() => {});

    // 計算ランク統計を取得
    fetch("/api/dashboard/rank-stats", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { if (data.success) setCalcRankStats({ distribution: data.distribution, rank1Missing: data.rank1Missing }); })
      .catch(() => {});
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
        <div className="grid grid-cols-2 lg:grid-cols-7 gap-3">
          <MissingCard label="店名未登録"     value={stats.missing.name}      total={stats.total} />
          <MissingCard label="住所未登録"     value={stats.missing.address}   total={stats.total} />
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

      {/* ─── ランク推移グラフ ＋ ランク1クイック出力 ─── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="mb-4">
          <p className="text-sm font-semibold text-gray-700">リストランク推移（週次）</p>
          <p className="text-xs text-gray-400 mt-0.5">管理画面「ランク記録」で定期的にスナップショットを保存すると反映されます</p>
        </div>

        {rankHistory.length >= 2 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={rankHistory} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(5)} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => Number(v).toLocaleString()} width={56} />
              <Tooltip formatter={(v, name) => [`${Number(v).toLocaleString()}件`, `ランク${name}`]} labelFormatter={l => `📅 ${l}`} />
              <Legend formatter={name => `ランク${name}`} />
              {["1","2","3","4","5","6","7"].map((rank) => (
                <Line key={rank} type="monotone" dataKey={rank} dot={false} strokeWidth={2}
                  stroke={LIST_RANK_COLORS[rank] ?? "#3b82f6"} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10 text-gray-300 mb-3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            <p className="text-sm text-gray-500">スナップショットが2件以上たまると<br />推移グラフが表示されます</p>
            <p className="text-xs text-gray-400 mt-1">管理画面 → ランク記録 から記録してください</p>
          </div>
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

      {/* ─── ランクアップ TODO ─── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="mb-4">
          <p className="text-sm font-semibold text-gray-700">リストランクアップ TODO</p>
          <p className="text-xs text-gray-400 mt-0.5">フィールドデータ・架電履歴から自動計算（リアルタイム）</p>
        </div>

        {calcRankStats ? (
          <div className="space-y-3">
            <RankTodoRow
              from={0} to={1}
              fromCount={calcRankStats.distribution["0"] ?? 0}
              toCount={calcRankStats.distribution["1"] ?? 0}
              action="店名・電話番号・住所を入力"
              actionColor="text-red-600"
              details={null}
            />
            <RankTodoRow
              from={1} to={2}
              fromCount={calcRankStats.distribution["1"] ?? 0}
              toCount={calcRankStats.distribution["2"] ?? 0}
              action="席数・時間振りを入力"
              actionColor="text-orange-500"
              details={[
                { label: "席数のみ空白", count: calcRankStats.rank1Missing.seki_only },
                { label: "時間振りのみ空白", count: calcRankStats.rank1Missing.jikan_only },
                { label: "両方空白", count: calcRankStats.rank1Missing.both },
              ]}
            />
            <RankTodoRow
              from={2} to={3}
              fromCount={calcRankStats.distribution["2"] ?? 0}
              toCount={calcRankStats.distribution["3"] ?? 0}
              action="架電して現アナ確認（通電確認）"
              actionColor="text-yellow-600"
              details={null}
            />
            <RankTodoRow
              from={3} to={4}
              fromCount={calcRankStats.distribution["3"] ?? 0}
              toCount={calcRankStats.distribution["4"] ?? 0}
              action="架電して対応履歴を作る（担当者と会話）"
              actionColor="text-blue-500"
              details={null}
            />
            <RankTodoRow
              from={4} to={5}
              fromCount={calcRankStats.distribution["4"] ?? 0}
              toCount={calcRankStats.distribution["5"] ?? 0}
              action="決裁者まで繋ぐ"
              actionColor="text-indigo-500"
              details={null}
            />
            <RankTodoRow
              from={5} to={6}
              fromCount={calcRankStats.distribution["5"] ?? 0}
              toCount={calcRankStats.distribution["6"] ?? 0}
              action="用件を伝えて有効な会話を作る"
              actionColor="text-purple-500"
              details={null}
            />
            <RankTodoRow
              from={6} to={7}
              fromCount={calcRankStats.distribution["6"] ?? 0}
              toCount={calcRankStats.distribution["7"] ?? 0}
              action="アポ・受注"
              actionColor="text-green-600"
              details={null}
            />
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
              <span className="text-xs font-bold text-green-700 bg-green-200 rounded px-2 py-0.5">ランク7</span>
              <span className="text-sm font-semibold text-green-700">
                アポ受注済 — {(calcRankStats.distribution["7"] ?? 0).toLocaleString()}件
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-10 text-gray-400 text-sm">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-300 mr-3" />
            計算中...
          </div>
        )}
      </div>

    </div>
  );
}

function RankTodoRow({
  from, to, fromCount, toCount, action, actionColor, details,
}: {
  from: number; to: number;
  fromCount: number; toCount: number;
  action: string; actionColor: string;
  details: { label: string; count: number }[] | null;
}) {
  const RANK_BG: Record<number, string> = {
    0: "bg-gray-100 text-gray-600",
    1: "bg-blue-100 text-blue-700",
    2: "bg-blue-200 text-blue-800",
    3: "bg-blue-300 text-blue-900",
    4: "bg-blue-400 text-white",
    5: "bg-blue-500 text-white",
    6: "bg-blue-700 text-white",
    7: "bg-blue-900 text-white",
  };
  return (
    <div className="flex items-start gap-3 border border-gray-100 rounded-lg px-4 py-3 hover:bg-gray-50">
      <div className="flex flex-col items-center gap-1 shrink-0 w-20">
        <span className={`text-xs font-bold rounded px-2 py-0.5 ${RANK_BG[from]}`}>ランク{from}</span>
        <span className="text-sm font-semibold text-gray-800">{fromCount.toLocaleString()}<span className="text-xs text-gray-400">件</span></span>
      </div>
      <div className="flex flex-col justify-center shrink-0 mt-1">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-gray-300">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${actionColor}`}>{action}</p>
        {details && (
          <div className="flex flex-wrap gap-3 mt-1.5">
            {details.map(d => (
              <span key={d.label} className="text-xs text-gray-500">
                {d.label}: <span className="font-semibold text-gray-700">{d.count.toLocaleString()}件</span>
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-col items-center gap-1 shrink-0 w-20">
        <span className={`text-xs font-bold rounded px-2 py-0.5 ${RANK_BG[to]}`}>ランク{to}</span>
        <span className="text-sm font-semibold text-gray-800">{toCount.toLocaleString()}<span className="text-xs text-gray-400">件</span></span>
      </div>
    </div>
  );
}
