"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

// ── 型 ─────────────────────────────────────────────────────
interface Master {
  名前: string; 店舗電話番号: string; 住所1: string; 住所2: string;
  業種: string; HP保有: string; 席数: string; 従業員: string; 定休日: string;
}
interface Summary {
  calls: number; taio: number; kassai: number;
  taio_rate: number; kassai_rate: number;
}
interface HeatmapData {
  taio:   Record<string, Record<string, number>>;
  kassai: Record<string, Record<string, number>>;
  days:   string[];
  hours:  string[];
}
interface CallRow {
  コール日: string; 曜日: string; コール時間: string; コール日時: string;
  歩留まり: string; コール結果: string; ステータス: string; メモ: string;
}

// 歩留まりバッジ色
function resultBadge(v: string) {
  const map: Record<string, string> = {
    アポ:  "bg-green-100 text-green-800",
    有効:  "bg-emerald-100 text-emerald-700",
    決裁:  "bg-purple-100 text-purple-700",
    フル:  "bg-blue-100 text-blue-700",
    対応:  "bg-sky-100 text-sky-700",
    打電:  "bg-gray-100 text-gray-500",
  };
  return map[v] ?? "bg-gray-100 text-gray-400";
}

// ヒートマップセル強度
function heatColor(val: number, max: number) {
  if (!val || !max) return "bg-gray-50 text-gray-300";
  const ratio = val / max;
  if (ratio > 0.8) return "bg-pink-600 text-white font-bold";
  if (ratio > 0.6) return "bg-pink-400 text-white";
  if (ratio > 0.4) return "bg-pink-300 text-white";
  if (ratio > 0.2) return "bg-pink-200 text-pink-800";
  return "bg-pink-100 text-pink-600";
}

// ── ヒートマップコンポーネント ──────────────────────────
function Heatmap({ data, days, hours, title }: {
  data: Record<string, Record<string, number>>;
  days: string[]; hours: string[]; title: string;
}) {
  const allVals = hours.flatMap(h => days.map(d => data[h]?.[d] ?? 0));
  const max = Math.max(...allVals, 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-bold text-gray-700 mb-3">{title}</h3>
      <div className="overflow-x-auto">
        <table className="text-xs">
          <thead>
            <tr>
              <th className="w-14 pr-2 text-gray-400 font-normal"></th>
              {days.map(d => (
                <th key={d} className="w-8 text-center text-gray-500 font-semibold pb-1">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hours.map(h => {
              const total = days.reduce((s, d) => s + (data[h]?.[d] ?? 0), 0);
              return (
                <tr key={h}>
                  <td className="pr-2 text-gray-400 text-right">{h}</td>
                  {days.map(d => {
                    const v = data[h]?.[d] ?? 0;
                    return (
                      <td key={d} className={`w-8 h-7 text-center rounded m-0.5 ${heatColor(v, max)}`}>
                        {v > 0 ? v : ""}
                      </td>
                    );
                  })}
                  <td className="pl-2 text-gray-400">{total > 0 ? total : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── メインページ ───────────────────────────────────────────
export default function StoreDetailPage() {
  const { tel } = useParams<{ tel: string }>();
  const router  = useRouter();
  const [data, setData]   = useState<{
    master: Master | null;
    summary: Summary;
    heatmap: HeatmapData;
    calls: CallRow[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tel) return;
    fetch(`/api/beauty/stores/${encodeURIComponent(tel)}`)
      .then(r => r.json())
      .then(json => {
        if (json.success) setData(json);
      })
      .finally(() => setLoading(false));
  }, [tel]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-500" />
    </div>
  );
  if (!data) return <div className="p-8 text-center text-gray-400">データが見つかりません</div>;

  const { master, summary, heatmap, calls } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center gap-4">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-700 text-sm">← 戻る</button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-800 truncate">{master?.名前 || "—"}</h1>
            <p className="text-xs text-gray-400">{decodeURIComponent(tel)}</p>
          </div>
          {master?.HP保有 && (
            <span className="bg-blue-50 text-blue-700 text-xs rounded px-2 py-1">{master.HP保有}</span>
          )}
        </div>
      </header>

      <div className="max-w-screen-xl mx-auto px-4 py-5 space-y-5">
        {/* 店舗情報 */}
        {master && (
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex flex-wrap gap-4 text-sm">
            <span className="text-gray-500">📍 {master.住所1} {master.住所2}</span>
            {master.業種    && <span className="bg-pink-50 text-pink-700 rounded-full px-3 py-0.5 text-xs">{master.業種}</span>}
            {master.席数    && <span className="text-gray-500">🪑 {master.席数}席</span>}
            {master.従業員  && <span className="text-gray-500">👤 {master.従業員}名</span>}
            {master.定休日  && <span className="text-gray-500">🗓 定休: {master.定休日}</span>}
          </div>
        )}

        {/* サマリーカード */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "架電回数",   value: summary.calls.toLocaleString(),     sub: "回",   color: "text-blue-700",   bg: "bg-blue-50" },
            { label: "対応回数",   value: summary.taio.toLocaleString(),      sub: "回",   color: "text-emerald-700", bg: "bg-emerald-50" },
            { label: "対応率",     value: `${summary.taio_rate}`,             sub: "%",    color: summary.taio_rate >= 30 ? "text-green-700" : "text-orange-600", bg: "bg-white" },
            { label: "決裁接触数", value: summary.kassai.toLocaleString(),    sub: "回",   color: "text-purple-700", bg: "bg-purple-50" },
            { label: "決裁接触率", value: `${summary.kassai_rate}`,           sub: "%",    color: summary.kassai_rate >= 20 ? "text-green-700" : "text-orange-600", bg: "bg-white" },
          ].map(c => (
            <div key={c.label} className={`${c.bg} rounded-xl border border-gray-200 px-4 py-3`}>
              <p className="text-xs text-gray-500 mb-0.5">{c.label}</p>
              <p className={`text-2xl font-bold ${c.color}`}>
                {c.value}<span className="text-sm font-normal ml-0.5">{c.sub}</span>
              </p>
            </div>
          ))}
        </div>

        {/* ヒートマップ */}
        <div className="grid md:grid-cols-2 gap-4">
          <Heatmap
            data={heatmap.taio}
            days={heatmap.days}
            hours={heatmap.hours}
            title="📞 対応した曜日×時刻"
          />
          <Heatmap
            data={heatmap.kassai}
            days={heatmap.days}
            hours={heatmap.hours}
            title="✅ 決裁接触した曜日×時刻"
          />
        </div>

        {/* 架電履歴 */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-700 text-sm">📋 架電履歴（全 {calls.length} 件）</h3>
          </div>
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50">
                <tr className="border-b border-gray-200">
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-600">日付</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-gray-600">曜日</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-gray-600">時刻</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-gray-600">歩留まり</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-600">コール結果</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-600">メモ</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((c, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2 text-gray-600">{c.コール日}</td>
                    <td className="px-3 py-2 text-center text-gray-500">{c.曜日}</td>
                    <td className="px-3 py-2 text-center text-gray-500">{c.コール時間}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-xs rounded-full px-2 py-0.5 ${resultBadge(c.歩留まり)}`}>
                        {c.歩留まり || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-600 text-xs max-w-[200px] truncate">{c.コール結果 || "—"}</td>
                    <td className="px-4 py-2 text-gray-400 text-xs max-w-[300px] truncate">{c.メモ || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
