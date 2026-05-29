"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const GENRE_OPTIONS = [
  "居酒屋・バー", "肉料理", "和食", "うどん/そば", "粉もの・鉄板",
  "アジア料理", "洋食", "カフェ・軽飲食", "レストラン・多国籍",
  "その他飲食店", "ラーメン",
];

const BIKOU_OPTIONS = [
  "なし", "単価8000円以上", "全個室", "完全予約制/コースのみ",
  "テイクアウト専門店", "ディナー営業なし", "商業施設内店舗",
  "リニューアル/移転", "時間30未満", "スナック/クラブ",
];

interface TimeRow { time_category: string; count: number }

// ─── MultiSelect ────────────────────────────────────────────
function MultiSelect({
  options, value, onChange, placeholder,
}: { options: string[]; value: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOut(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOut);
    return () => document.removeEventListener("mousedown", onOut);
  }, []);

  function toggle(opt: string) {
    onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt]);
  }

  const label =
    value.length === 0 ? placeholder
    : value.length === 1 ? value[0]
    : `${value.length}件選択`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-300 ${
          value.length > 0 ? "border-blue-300 text-gray-800" : "border-gray-200 text-gray-400"
        }`}
      >
        <span className="truncate">{label}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
          className={`w-3.5 h-3.5 ml-1 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {value.length > 0 && (
            <button
              type="button"
              onClick={() => { onChange([]); setOpen(false); }}
              className="w-full px-3 py-2 text-xs text-left text-gray-400 hover:bg-gray-50 border-b border-gray-100"
            >
              ✕ 選択をクリア
            </button>
          )}
          {options.map(opt => (
            <label key={opt} className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={value.includes(opt)}
                onChange={() => toggle(opt)}
                className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 cursor-pointer"
              />
              <span className="text-sm text-gray-700 select-none">{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── メインページ ────────────────────────────────────────────
export default function AnalysisPage() {
  const router = useRouter();

  // フィルター
  const [prefOptions, setPrefOptions]   = useState<string[]>([]);
  const [selPrefs, setSelPrefs]         = useState<string[]>([]);
  const [seatMin, setSeatMin]           = useState("");
  const [seatMax, setSeatMax]           = useState("");
  const [selGenres, setSelGenres]       = useState<string[]>([]);
  const [selBikou, setSelBikou]         = useState<string[]>([]);

  // データ
  const [rows, setRows]                 = useState<TimeRow[]>([]);
  const [total, setTotal]               = useState(0);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState("");

  const firstLoad = useRef(true);
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) { router.push("/login"); return; }

    const delay = firstLoad.current ? 0 : 400;
    firstLoad.current = false;
    setLoading(true);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const sp = new URLSearchParams();
        selPrefs.forEach(p  => sp.append("prefectures", p));
        selGenres.forEach(g => sp.append("genres", g));
        selBikou.forEach(b  => sp.append("bikou", b));
        if (seatMin) sp.set("seatMin", seatMin);
        if (seatMax) sp.set("seatMax", seatMax);

        const r = await fetch(`/api/analysis?${sp}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await r.json();
        if (!d.success) { setError(d.message); return; }
        setPrefOptions(d.prefectures);
        setRows(d.rows);
        setTotal(d.total);
      } catch {
        setError("データ取得に失敗しました");
      } finally {
        setLoading(false);
      }
    }, delay);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selPrefs, seatMin, seatMax, selGenres, selBikou]);

  function reset() {
    setSelPrefs([]); setSeatMin(""); setSeatMax("");
    setSelGenres([]); setSelBikou([]);
  }

  const hasFilter =
    selPrefs.length > 0 || seatMin !== "" || seatMax !== "" ||
    selGenres.length > 0 || selBikou.length > 0;

  const seatLabel =
    seatMin && seatMax ? `${seatMin}〜${seatMax}席`
    : seatMin ? `${seatMin}席以上`
    : seatMax ? `${seatMax}席以下`
    : "";

  return (
    <div className="p-8 max-w-4xl">
      {/* ヘッダー */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">分析</h1>
        <p className="text-sm text-gray-500 mt-1">時間振り別件数の集計・絞り込み</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
      )}

      {/* ── 絞り込みパネル ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">絞り込み</h2>
          {hasFilter && (
            <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-700 underline">
              条件をクリア
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 都道府県 */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              都道府県
              {selPrefs.length > 0 && (
                <span className="ml-1.5 text-blue-600 font-normal">{selPrefs.length}件</span>
              )}
            </label>
            <MultiSelect
              options={prefOptions}
              value={selPrefs}
              onChange={setSelPrefs}
              placeholder="すべて"
            />
          </div>

          {/* 席数 */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              席数
              {seatLabel && (
                <span className="ml-1.5 text-blue-600 font-normal">{seatLabel}</span>
              )}
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="number" value={seatMin} onChange={e => setSeatMin(e.target.value)}
                placeholder="以上" min={0}
                className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
              />
              <span className="text-gray-400 text-xs shrink-0">〜</span>
              <input
                type="number" value={seatMax} onChange={e => setSeatMax(e.target.value)}
                placeholder="以下" min={0}
                className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
              />
            </div>
          </div>

          {/* ジャンル */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              ジャンル
              {selGenres.length > 0 && (
                <span className="ml-1.5 text-blue-600 font-normal">{selGenres.length}件</span>
              )}
            </label>
            <MultiSelect
              options={GENRE_OPTIONS}
              value={selGenres}
              onChange={setSelGenres}
              placeholder="すべて"
            />
          </div>

          {/* 備考 */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              備考
              {selBikou.length > 0 && (
                <span className="ml-1.5 text-blue-600 font-normal">{selBikou.length}件</span>
              )}
            </label>
            <MultiSelect
              options={BIKOU_OPTIONS}
              value={selBikou}
              onChange={setSelBikou}
              placeholder="すべて"
            />
          </div>
        </div>
      </div>

      {/* ── 時間振り別件数テーブル ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">時間振り別件数</h2>
          {loading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400" />
          ) : (
            <span className="text-sm text-gray-400">
              合計 <span className="font-semibold text-gray-900">{total.toLocaleString()}</span> 件
            </span>
          )}
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 w-48">時間振り</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 w-28">件数</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 w-24">割合(%)</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">　</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const pct = total > 0 ? (row.count / total) * 100 : 0;
              const isOther = row.time_category === "その他・未登録";
              return (
                <tr
                  key={row.time_category}
                  className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${isOther ? "text-gray-400" : ""}`}
                >
                  <td className={`px-5 py-3 font-medium ${isOther ? "text-gray-400" : "text-gray-800"}`}>
                    {row.time_category}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-gray-700">
                    {row.count.toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-gray-500">
                    {pct.toFixed(1)}%
                  </td>
                  <td className="px-5 py-3 pr-8">
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${isOther ? "bg-gray-300" : "bg-blue-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}

            {/* 合計行 */}
            <tr className="border-t-2 border-gray-200 bg-gray-50">
              <td className="px-5 py-3 font-semibold text-gray-900">合計</td>
              <td className="px-5 py-3 text-right font-bold font-mono text-gray-900">
                {total.toLocaleString()}
              </td>
              <td className="px-5 py-3 text-right font-mono text-gray-600">100%</td>
              <td className="px-5 py-3" />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
