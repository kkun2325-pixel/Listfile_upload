"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ── 型 ─────────────────────────────────────────────────────
interface Store {
  レコード番号: string;
  名前: string;
  店舗電話番号: string;
  住所1: string;
  業種: string;
  HP保有: string;
  席数: string;
  従業員: string;
  calls: number;
  taio: number;
  kassai: number;
  taio_rate: number;
  kassai_rate: number;
  last_call: string;
}

const GYOSHU_OPTIONS = ["ヘアサロン", "整体", "エステ", "その他専門店", "ジム"];
const HP_OPTIONS     = ["HP", "HPB", "インスタ", "その他予約サイト", "なし"];
const SORT_OPTIONS   = [
  { value: "calls_desc",  label: "架電数↓" },
  { value: "taio_desc",   label: "対応率↓" },
  { value: "kassai_desc", label: "決裁率↓" },
];

// 対応率の色
function rateColor(r: number) {
  if (r >= 40) return "text-green-600 font-bold";
  if (r >= 30) return "text-blue-600";
  if (r >= 20) return "text-yellow-600";
  return "text-red-500";
}

export default function BeautyPage() {
  const router = useRouter();
  const [stores, setStores]     = useState<Store[]>([]);
  const [loading, setLoading]   = useState(false);
  const [search,  setSearch]    = useState("");
  const [pref,    setPref]      = useState("");
  const [gyoshu,  setGyoshu]    = useState("");
  const [hp,      setHp]        = useState("");
  const [sort,    setSort]      = useState("calls_desc");
  const [page,    setPage]      = useState(1);
  const [hasMore, setHasMore]   = useState(true);
  const LIMIT = 50;

  const fetchStores = useCallback(async (p: number, reset = false) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(p), limit: String(LIMIT), sort,
        ...(search && { search }),
        ...(pref   && { pref }),
        ...(gyoshu && { gyoshu }),
        ...(hp     && { hp }),
      });
      const res  = await fetch(`/api/beauty/stores?${qs}`);
      const json = await res.json();
      if (!json.success) return;
      const rows: Store[] = json.data ?? [];
      setStores(prev => reset ? rows : [...prev, ...rows]);
      setHasMore(rows.length === LIMIT);
    } finally {
      setLoading(false);
    }
  }, [search, pref, gyoshu, hp, sort]);

  // 初回 / フィルター変更
  useEffect(() => {
    setPage(1);
    setStores([]);
    fetchStores(1, true);
  }, [search, pref, gyoshu, hp, sort]);

  function loadMore() {
    const next = page + 1;
    setPage(next);
    fetchStores(next);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-700 text-sm">← ダッシュボード</Link>
            <span className="text-gray-300">|</span>
            <h1 className="text-lg font-bold text-pink-600">💄 美容リスト</h1>
          </div>
          <span className="text-xs text-gray-400">SHリストマスタ × 架電履歴</span>
        </div>
      </header>

      <div className="max-w-screen-xl mx-auto px-4 py-4">
        {/* フィルター */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-gray-500 mb-1">店名 / 電話番号</label>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="検索..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">業種</label>
            <select value={gyoshu} onChange={e => setGyoshu(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300">
              <option value="">全業種</option>
              {GYOSHU_OPTIONS.map(g => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">HP保有</label>
            <select value={hp} onChange={e => setHp(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300">
              <option value="">全て</option>
              {HP_OPTIONS.map(h => <option key={h}>{h}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">並び順</label>
            <select value={sort} onChange={e => setSort(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300">
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <button onClick={() => { setSearch(""); setPref(""); setGyoshu(""); setHp(""); setSort("calls_desc"); }}
            className="text-xs text-gray-400 hover:text-gray-700 underline">リセット</button>
        </div>

        {/* テーブル */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">店名</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">電話番号</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">都道府県</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">業種</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">HP</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">席数</th>
                  <th className="text-right px-4 py-3 font-semibold text-blue-600">架電数</th>
                  <th className="text-right px-4 py-3 font-semibold text-emerald-600">対応数</th>
                  <th className="text-right px-4 py-3 font-semibold text-emerald-600">対応率</th>
                  <th className="text-right px-4 py-3 font-semibold text-purple-600">決裁数</th>
                  <th className="text-right px-4 py-3 font-semibold text-purple-600">決裁率</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-400">最終架電</th>
                </tr>
              </thead>
              <tbody>
                {stores.length === 0 && !loading && (
                  <tr>
                    <td colSpan={12} className="text-center py-12 text-gray-400">
                      {loading ? "読み込み中..." : "データがありません"}
                    </td>
                  </tr>
                )}
                {stores.map((s, i) => (
                  <tr
                    key={`${s.店舗電話番号}-${i}`}
                    onClick={() => router.push(`/beauty/${encodeURIComponent(s.店舗電話番号)}`)}
                    className="border-b border-gray-100 hover:bg-pink-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-2.5 font-medium text-gray-800 max-w-[200px] truncate">{s.名前 || "—"}</td>
                    <td className="px-4 py-2.5 text-gray-600 font-mono text-xs">{s.店舗電話番号}</td>
                    <td className="px-4 py-2.5 text-gray-600">{s.住所1 || "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className="bg-pink-50 text-pink-700 text-xs rounded-full px-2 py-0.5">{s.業種 || "—"}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      {s.HP保有 && <span className="bg-blue-50 text-blue-700 text-xs rounded px-1.5 py-0.5">{s.HP保有}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-500">{s.席数 ? `${s.席数}席` : "—"}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-blue-700">{s.calls.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right text-emerald-600">{s.taio.toLocaleString()}</td>
                    <td className={`px-4 py-2.5 text-right ${rateColor(s.taio_rate)}`}>{s.taio_rate}%</td>
                    <td className="px-4 py-2.5 text-right text-purple-600">{s.kassai.toLocaleString()}</td>
                    <td className={`px-4 py-2.5 text-right ${rateColor(s.kassai_rate)}`}>{s.kassai_rate}%</td>
                    <td className="px-4 py-2.5 text-right text-xs text-gray-400">{s.last_call || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ロードmore / ローダー */}
          <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between">
            <span className="text-xs text-gray-400">{stores.length} 件表示中</span>
            {hasMore && !loading && (
              <button onClick={loadMore}
                className="text-sm text-pink-600 hover:text-pink-800 font-medium">
                さらに読み込む →
              </button>
            )}
            {loading && <span className="text-xs text-gray-400 animate-pulse">読み込み中...</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
