"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ComposedChart, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Line, Legend, CartesianGrid,
} from "recharts";

interface Stats {
  master_count: number; calls_count: number;
  calls: number; taio: number; kassai: number;
  taio_rate: number; kassai_rate: number;
}
interface TimeRow   { hour: string; calls: number; taio: number; kassai: number; taio_rate: number; kassai_rate: number }
interface GyoshuRow { gyoshu: string; calls: number; taio_rate: number; kassai_rate: number }
interface PrefRow   { pref: string; calls: number; taio_rate: number }

export default function BeautyDashboardPage() {
  const [stats,    setStats]    = useState<Stats | null>(null);
  const [byTime,   setByTime]   = useState<TimeRow[]>([]);
  const [byGyoshu, setByGyoshu] = useState<GyoshuRow[]>([]);
  const [byPref,   setByPref]   = useState<PrefRow[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    fetch("/api/beauty/dashboard")
      .then(r => r.json())
      .then(j => {
        if (!j.success) return;
        setStats(j.stats);
        setByTime(j.byTime);
        setByGyoshu(j.byGyoshu);
        setByPref(j.byPref);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-500" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-screen-xl mx-auto px-5 py-3 flex items-center gap-4">
          <Link href="/dashboard" className="text-gray-400 hover:text-gray-700 text-sm">← ダッシュボード</Link>
          <span className="text-gray-300">|</span>
          <h1 className="text-lg font-bold text-pink-600">美容 ダッシュボード</h1>
          <div className="flex-1" />
          <Link href="/beauty" className="text-sm text-pink-600 hover:text-pink-800 font-medium">一覧へ →</Link>
        </div>
      </header>

      <div className="max-w-screen-xl mx-auto px-5 py-6 space-y-6">
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'マスタ店舗数', val: stats.master_count.toLocaleString(), unit: '件', color: 'text-gray-700',   bg: 'bg-white' },
              { label: '架電履歴',     val: stats.calls_count.toLocaleString(),  unit: '件', color: 'text-gray-700',   bg: 'bg-white' },
              { label: '突合件数',     val: stats.calls.toLocaleString(),        unit: '件', color: 'text-blue-700',   bg: 'bg-blue-50' },
              { label: '全体対応率',   val: String(stats.taio_rate),             unit: '%',  color: 'text-emerald-700', bg: 'bg-emerald-50' },
              { label: '全体決裁率',   val: String(stats.kassai_rate),           unit: '%',  color: 'text-purple-700', bg: 'bg-purple-50' },
            ].map(c => (
              <div key={c.label} className={`${c.bg} rounded-xl border border-gray-200 px-5 py-4`}>
                <p className="text-xs text-gray-500 mb-1">{c.label}</p>
                <p className={`text-2xl font-extrabold ${c.color}`}>
                  {c.val}<span className="text-sm font-normal text-gray-400 ml-0.5">{c.unit}</span>
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-bold text-gray-700 mb-4">時間帯別 架電件数 &amp; 対応率</h3>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={byTime} margin={{ top: 0, right: 20, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left"  tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v, n) => [typeof v === 'number' ? v.toLocaleString() : v, n]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar    yAxisId="left"  dataKey="calls"       name="架電数"  fill="#fbcfe8" />
              <Line   yAxisId="right" dataKey="taio_rate"   name="対応率%" type="monotone" stroke="#ec4899" strokeWidth={2} dot={false} />
              <Line   yAxisId="right" dataKey="kassai_rate" name="決裁率%" type="monotone" stroke="#a855f7" strokeWidth={2} dot={false} strokeDasharray="4 2" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-4">業種別 対応率 / 決裁率</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byGyoshu} layout="vertical" margin={{ left: 20, right: 30 }}>
                <XAxis type="number" tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} domain={[0, 50]} />
                <YAxis type="category" dataKey="gyoshu" width={80} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => `${v}%`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="taio_rate"   name="対応率%" fill="#34d399" radius={[0, 3, 3, 0]} />
                <Bar dataKey="kassai_rate" name="決裁率%" fill="#a78bfa" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-4">都道府県別 架電数 TOP10</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byPref} layout="vertical" margin={{ left: 20, right: 30 }}>
                <XAxis type="number" tickFormatter={v => v.toLocaleString()} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="pref" width={60} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => typeof v === 'number' ? v.toLocaleString() : String(v ?? '')} />
                <Bar dataKey="calls" name="架電数" fill="#f9a8d4" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-gradient-to-r from-pink-50 to-rose-50 border border-pink-100 rounded-xl p-5 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-800 mb-1">マスタ×架電履歴</h3>
            <p className="text-sm text-gray-500">店舗ごとの対応率・決裁率・時刻ヒートマップを確認</p>
          </div>
          <Link href="/beauty"
            className="bg-pink-600 hover:bg-pink-700 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition shrink-0">
            一覧を見る →
          </Link>
        </div>
      </div>
    </div>
  );
}