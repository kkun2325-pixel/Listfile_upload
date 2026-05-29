"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Cell,
} from "recharts";

interface Row {
  worker_name: string;
  work_date: string | null;
  work_hours: number | null;
  seisa_count: number;
  target_count: number;
  missing_count: number;
  invalid_input_count: number;
  team_name: string;
  team_id: string;
  target_rate: string;
  missing_rate: string;
  per_hour: string | null;
}
interface Team { id: string; name: string }

const TEAM_COLORS = ["#6366f1","#f59e0b","#10b981","#ef4444","#3b82f6","#8b5cf6"]

export default function ProductivityPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [startDate, setStartDate]   = useState("");
  const [endDate, setEndDate]       = useState("");
  const [teamFilter, setTeamFilter] = useState("all");
  const [memberFilter, setMemberFilter] = useState("");

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem("auth_token");
    if (!token) { router.push("/login"); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate)    params.set("start",  startDate);
      if (endDate)      params.set("end",    endDate);
      if (teamFilter !== "all") params.set("team", teamFilter);
      if (memberFilter) params.set("member", memberFilter);

      const r = await fetch(`/api/productivity?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (!d.success) { setError(d.message); return; }
      setRows(d.rows);
      setTeams(d.teams as Team[]);
    } catch { setError("データ取得に失敗しました"); }
    finally { setLoading(false); }
  }, [router, startDate, endDate, teamFilter, memberFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // グラフデータ生成
  const teamBarData = (() => {
    const map: Record<string, number> = {};
    for (const r of rows) { map[r.team_name] = (map[r.team_name] ?? 0) + r.seisa_count; }
    return Object.entries(map).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  })();

  const workerBarData = (() => {
    const map: Record<string, { total: number; hours: number }> = {};
    for (const r of rows) {
      if (!map[r.worker_name]) map[r.worker_name] = { total: 0, hours: 0 };
      map[r.worker_name].total += r.seisa_count;
      map[r.worker_name].hours += r.work_hours ?? 0;
    }
    return Object.entries(map)
      .map(([name, { total, hours }]) => ({ name, per_hour: hours > 0 ? parseFloat((total / hours).toFixed(1)) : 0 }))
      .sort((a, b) => b.per_hour - a.per_hour)
      .slice(0, 20);
  })();

  const dateLineData = (() => {
    const map: Record<string, number> = {};
    for (const r of rows) {
      if (!r.work_date) continue;
      map[r.work_date] = (map[r.work_date] ?? 0) + r.seisa_count;
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));
  })();

  const uniqueWorkers = [...new Set(rows.map(r => r.worker_name))].sort();

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
    </div>
  );

  return (
    <div className="p-8 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">生産性レポート</h1>
        <p className="text-sm text-gray-500 mt-1">担当者別の精査実績・生産性指標</p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}

      {/* フィルター */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex flex-wrap gap-4 items-end">
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
        <div>
          <label className="block text-xs text-gray-500 mb-1">チーム</label>
          <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
            <option value="all">全チーム</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">担当者</label>
          <select value={memberFilter} onChange={e => setMemberFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
            <option value="">全員</option>
            {uniqueWorkers.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
        <button onClick={fetchData}
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700">
          絞り込み
        </button>
        <button onClick={() => { setStartDate(""); setEndDate(""); setTeamFilter("all"); setMemberFilter(""); }}
          className="px-4 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50">
          リセット
        </button>
      </div>

      {/* グラフ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* チーム別精査数 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">チーム別精査数</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={teamBarData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => Number(v).toLocaleString()} width={50} />
              <Tooltip formatter={(v) => (v as number).toLocaleString()} />
              <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                {teamBarData.map((_, i) => <Cell key={i} fill={TEAM_COLORS[i % TEAM_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 担当者別1時間あたり精査数 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">担当者別 精査数/時間</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={workerBarData} layout="vertical" margin={{ top: 4, right: 16, left: 30, bottom: 4 }}>
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={40} />
              <Tooltip />
              <Bar dataKey="per_hour" fill="#6366f1" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 日付別精査数推移 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">日付別精査数推移</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={dateLineData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => Number(v).toLocaleString()} width={50} />
              <Tooltip formatter={(v) => (v as number).toLocaleString()} />
              <Line type="monotone" dataKey="count" stroke="#6366f1" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 集計テーブル */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">担当者</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">チーム</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">作業日</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 whitespace-nowrap">精査数</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 whitespace-nowrap">作成数</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 whitespace-nowrap">作成率</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 whitespace-nowrap">作業時間</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 whitespace-nowrap">1h精査数</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 whitespace-nowrap">欠損数</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 whitespace-nowrap">欠損率</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 whitespace-nowrap">入力精度</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={11} className="px-3 py-8 text-center text-sm text-gray-400">データがありません</td></tr>
              ) : rows.map((r, i) => (
                <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2 font-medium text-gray-800">{r.worker_name}</td>
                  <td className="px-3 py-2 text-gray-600">{r.team_name}</td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.work_date ?? "-"}</td>
                  <td className="px-3 py-2 text-right font-medium">{r.seisa_count.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">{r.target_count.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">
                    <span className={`${parseFloat(r.target_rate) >= 50 ? "text-green-600" : "text-orange-500"}`}>
                      {r.target_rate}%
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">{r.work_hours != null ? `${r.work_hours}h` : "-"}</td>
                  <td className="px-3 py-2 text-right font-medium text-indigo-600">{r.per_hour ?? "-"}</td>
                  <td className="px-3 py-2 text-right">{r.missing_count.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">
                    <span className={`${parseFloat(r.missing_rate) >= 20 ? "text-red-500" : "text-gray-600"}`}>
                      {r.missing_rate}%
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className={`${r.invalid_input_count > 0 ? "text-red-500 font-medium" : "text-gray-400"}`}>
                      {r.invalid_input_count > 0 ? `${r.invalid_input_count}件` : "問題なし"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length > 0 && (
          <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
            {rows.length.toLocaleString()} 件表示
          </div>
        )}
      </div>
    </div>
  );
}
