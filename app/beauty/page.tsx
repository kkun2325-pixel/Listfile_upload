"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Store {
  レコード番号: string;
  名前: string;
  店舗電話番号: string;
  住所1: string;
  業種: string;
  HP保有: string;
  席数: string;
  従業員: string;
  定休日: string;
  calls: number;
  taio: number;
  kassai: number;
  taio_rate: number;
  kassai_rate: number;
  max_progress_score: number;
  last_call: string;
}

const PROGRESS_MAP: Record<number, { label: string; color: string }> = {
  9: { label: '9', color: 'bg-green-200 text-green-900 font-bold' },
  8: { label: '8', color: 'bg-teal-100 text-teal-800 font-bold' },
  7: { label: '7', color: 'bg-blue-100 text-blue-800' },
  6: { label: '6', color: 'bg-emerald-100 text-emerald-700' },
  5: { label: '5', color: 'bg-purple-100 text-purple-700' },
  4: { label: '2-4', color: 'bg-sky-100 text-sky-700' },
  1: { label: '1', color: 'bg-gray-100 text-gray-500' },
  0: { label: '—', color: 'text-gray-300' },
}

function ProgressBadge({ score }: { score: number }) {
  const p = PROGRESS_MAP[score] ?? PROGRESS_MAP[0]
  return <span className={`text-xs rounded-full px-2 py-0.5 ${p.color}`}>{p.label}</span>
}

function rateColor(r: number) {
  if (r >= 40) return "text-green-600 font-bold";
  if (r >= 30) return "text-blue-600";
  if (r >= 20) return "text-yellow-600";
  return "text-red-500";
}

function SortIcon({ field, current, dir }: { field: string; current: string; dir: string }) {
  if (current !== field) return <span className="text-gray-300 ml-1">↕</span>;
  return <span className="text-blue-500 ml-1">{dir === 'asc' ? '↑' : '↓'}</span>;
}

const GYOSHU_OPTIONS = ["ヘアサロン", "整体", "エステ", "その他専門店", "ジム"];
const HP_OPTIONS     = ["HP", "HPB", "インスタ", "その他予約サイト", "なし"];
const LIMIT = 50;

const PROGRESS_OPTIONS = [
  { score: 9, label: 'アポ 9',   color: 'bg-green-200 text-green-900' },
  { score: 8, label: 'AF  8',    color: 'bg-teal-100 text-teal-800' },
  { score: 7, label: 'フル 7',   color: 'bg-blue-100 text-blue-800' },
  { score: 6, label: '有効 6',   color: 'bg-emerald-100 text-emerald-700' },
  { score: 5, label: '決裁 5',   color: 'bg-purple-100 text-purple-700' },
  { score: 4, label: '対応 2-4', color: 'bg-sky-100 text-sky-700' },
  { score: 1, label: '打電 1',   color: 'bg-gray-100 text-gray-500' },
];

export default function BeautyPage() {
  const router = useRouter();

  const [stores,  setStores]  = useState<Store[]>([]);
  const [total,   setTotal]   = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [page,    setPage]    = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const [search,       setSearch]       = useState('');
  const [gyoshu,       setGyoshu]       = useState('');
  const [hp,           setHp]           = useState('');
  const [taioMin,      setTaioMin]      = useState('');
  const [taioMax,      setTaioMax]      = useState('');
  const [kassaiMin,    setKassaiMin]    = useState('');
  const [kassaiMax,    setKassaiMax]    = useState('');
  const [progressMin,  setProgressMin]  = useState('');
  const [progressMax,  setProgressMax]  = useState('');
  const [staffFilter,  setStaffFilter]  = useState('');
  const [teikyuSearch, setTeikyuSearch] = useState('');
  const [multiStore,   setMultiStore]   = useState('');
  const [lastCallFrom, setLastCallFrom] = useState('');
  const [lastCallTo,   setLastCallTo]   = useState('');

  const [sortField, setSortField] = useState('calls');
  const [sortDir,   setSortDir]   = useState<'asc' | 'desc'>('desc');

  function handleSort(field: string) {
    if (sortField === field) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }

  const fetchStores = useCallback(async (p: number, reset = false) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(p), limit: String(LIMIT),
        sort: sortField, sort_dir: sortDir,
        ...(search       && { search }),
        ...(gyoshu       && { gyoshu }),
        ...(hp           && { hp }),
        ...(taioMin      && { taio_min:      taioMin }),
        ...(taioMax      && { taio_max:      taioMax }),
        ...(kassaiMin    && { kassai_min:    kassaiMin }),
        ...(kassaiMax    && { kassai_max:    kassaiMax }),
        ...(progressMin  && { progress_min: progressMin }),
        ...(progressMax  && { progress_max: progressMax }),
        ...(staffFilter  && { staff:         staffFilter }),
        ...(teikyuSearch && { teikyu:        teikyuSearch }),
        ...(multiStore   && { multi_store:   multiStore }),
        ...(lastCallFrom && { last_call_from: lastCallFrom }),
        ...(lastCallTo   && { last_call_to:   lastCallTo }),
      });
      const res  = await fetch(`/api/beauty/stores?${qs}`);
      const json = await res.json();
      if (!json.success) return;
      const rows: Store[] = json.data ?? [];
      setStores(prev => reset ? rows : [...prev, ...rows]);
      if (reset) setTotal(json.total ?? null);
      setHasMore(rows.length === LIMIT);
    } finally {
      setLoading(false);
    }
  }, [search, gyoshu, hp, taioMin, taioMax, kassaiMin, kassaiMax, progressMin, progressMax, staffFilter, teikyuSearch, multiStore, lastCallFrom, lastCallTo, sortField, sortDir]);

  useEffect(() => {
    setPage(1);
    setStores([]);
    fetchStores(1, true);
  }, [search, gyoshu, hp, taioMin, taioMax, kassaiMin, kassaiMax, progressMin, progressMax, staffFilter, teikyuSearch, multiStore, lastCallFrom, lastCallTo, sortField, sortDir]);

  function loadMore() {
    const next = page + 1;
    setPage(next);
    fetchStores(next);
  }

  function resetFilters() {
    setSearch(''); setGyoshu(''); setHp('');
    setTaioMin(''); setTaioMax(''); setKassaiMin(''); setKassaiMax('');
    setProgressMin(''); setProgressMax('');
    setStaffFilter(''); setTeikyuSearch(''); setMultiStore('');
    setLastCallFrom(''); setLastCallTo('');
    setSortField('calls'); setSortDir('desc');
  }

  function Th({ field, label, align = 'right', color = 'text-gray-600' }: {
    field: string; label: string; align?: string; color?: string;
  }) {
    return (
      <th
        onClick={() => handleSort(field)}
        className={`px-3 py-3 font-semibold ${color} text-xs cursor-pointer hover:bg-gray-100 select-none text-${align} whitespace-nowrap`}
      >
        {label}<SortIcon field={field} current={sortField} dir={sortDir} />
      </th>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-700 text-sm">← ダッシュボード</Link>
            <span className="text-gray-300">|</span>
            <h1 className="text-lg font-bold text-pink-600">美容リスト</h1>
          </div>
          {total !== null && (
            <span className="text-sm text-gray-500 bg-white border border-gray-200 rounded-full px-3 py-1">
              絞り込み結果: <span className="font-bold text-blue-600">{total.toLocaleString()}</span> 件
            </span>
          )}
        </div>
      </header>

      <div className="max-w-screen-2xl mx-auto px-5 py-5">
        {/* フィルターパネル */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 space-y-3">
          {/* 1行目：基本フィルター */}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-gray-500 mb-1">店名 / 電話番号</label>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="検索..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" />
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
              <label className="block text-xs text-gray-500 mb-1">従業員数</label>
              <select value={staffFilter} onChange={e => setStaffFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300">
                <option value="">全て</option>
                <option value="1">1名</option>
                <option value="2">2名</option>
                <option value="3+">3名以上</option>
                <option value="unknown">不明</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">定休日</label>
              <select value={teikyuSearch} onChange={e => setTeikyuSearch(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300">
                <option value="">全て</option>
                {['月','火','水','木','金','土','日','不定休','月火'].map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
                <option value="unknown">不明</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">複数店</label>
              <select value={multiStore} onChange={e => setMultiStore(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300">
                <option value="">全て</option>
                <option value="yes">複数店あり</option>
                <option value="no">単独店のみ</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">最終架電日</label>
              <div className="flex items-center gap-1">
                <input type="date" value={lastCallFrom} onChange={e => setLastCallFrom(e.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-pink-300" />
                <span className="text-gray-400 text-sm">〜</span>
                <input type="date" value={lastCallTo} onChange={e => setLastCallTo(e.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-pink-300" />
              </div>
            </div>
            <button onClick={resetFilters}
              className="text-xs text-gray-400 hover:text-gray-700 underline pb-2">リセット</button>
          </div>

          {/* 2行目：対応率・決裁率・最大進捗 */}
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs text-emerald-600 mb-1 font-medium">対応率 (%)</label>
              <div className="flex items-center gap-1">
                <input type="number" min="0" max="100" value={taioMin}
                  onChange={e => setTaioMin(e.target.value)} placeholder="0"
                  className="w-16 border border-gray-300 rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-emerald-300" />
                <span className="text-gray-400 text-sm">〜</span>
                <input type="number" min="0" max="100" value={taioMax}
                  onChange={e => setTaioMax(e.target.value)} placeholder="100"
                  className="w-16 border border-gray-300 rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-purple-600 mb-1 font-medium">決裁率 (%)</label>
              <div className="flex items-center gap-1">
                <input type="number" min="0" max="100" value={kassaiMin}
                  onChange={e => setKassaiMin(e.target.value)} placeholder="0"
                  className="w-16 border border-gray-300 rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-purple-300" />
                <span className="text-gray-400 text-sm">〜</span>
                <input type="number" min="0" max="100" value={kassaiMax}
                  onChange={e => setKassaiMax(e.target.value)} placeholder="100"
                  className="w-16 border border-gray-300 rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-purple-300" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-orange-500 mb-1 font-medium">最大進捗</label>
              <div className="flex items-center gap-1 flex-wrap">
                <select value={progressMin} onChange={e => setProgressMin(e.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-orange-300">
                  <option value="">下限なし</option>
                  {PROGRESS_OPTIONS.map(p => (
                    <option key={p.score} value={String(p.score)}>{p.label} 以上</option>
                  ))}
                </select>
                <span className="text-gray-400 text-sm">〜</span>
                <select value={progressMax} onChange={e => setProgressMax(e.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-orange-300">
                  <option value="">上限なし</option>
                  {PROGRESS_OPTIONS.map(p => (
                    <option key={p.score} value={String(p.score)}>{p.label} 以下</option>
                  ))}
                </select>
                <div className="flex gap-1 ml-1 flex-wrap">
                  {PROGRESS_OPTIONS.map(p => (
                    <button key={p.score}
                      onClick={() => { setProgressMin(String(p.score)); setProgressMax(String(p.score)); }}
                      className={`text-xs rounded-full px-2 py-0.5 border transition hover:opacity-80 ${
                        progressMin === String(p.score) && progressMax === String(p.score)
                          ? `${p.color} border-transparent font-bold ring-2 ring-orange-300`
                          : `${p.color} border-gray-200`
                      }`}
                    >{p.label}</button>
                  ))}
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-400 pb-2">※ 列ヘッダーをクリックでソート切り替え</p>
          </div>
        </div>

        {/* テーブル */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <Th field="name"        label="店名"     align="left" />
                  <th className="text-left px-3 py-3 font-semibold text-gray-600 text-xs whitespace-nowrap">電話番号</th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-600 text-xs whitespace-nowrap">都道府県</th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-600 text-xs whitespace-nowrap">業種</th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-600 text-xs whitespace-nowrap">HP</th>
                  <Th field="seats"       label="席数"     />
                  <Th field="staff"       label="従業員"   />
                  <Th field="teikyu"      label="定休日"   align="left" color="text-gray-500" />
                  <Th field="calls"       label="架電数"   color="text-blue-600" />
                  <Th field="taio"        label="対応数"   color="text-emerald-600" />
                  <Th field="taio_rate"   label="対応率"   color="text-emerald-600" />
                  <Th field="kassai"      label="決裁数"   color="text-purple-600" />
                  <Th field="kassai_rate" label="決裁率"   color="text-purple-600" />
                  <Th field="progress"    label="最大進捗" color="text-orange-500" />
                  <Th field="last_call"   label="最終架電" color="text-gray-400" />
                </tr>
              </thead>
              <tbody>
                {stores.length === 0 && !loading && (
                  <tr>
                    <td colSpan={15} className="text-center py-16 text-gray-400">
                      データがありません
                    </td>
                  </tr>
                )}
                {stores.map((s, i) => (
                  <tr
                    key={`${s.店舗電話番号}-${i}`}
                    onClick={() => router.push(`/beauty/${encodeURIComponent(s.店舗電話番号)}`)}
                    className="border-b border-gray-100 hover:bg-pink-50 cursor-pointer transition-colors"
                  >
                    <td className="px-3 py-2.5 font-medium text-gray-800 max-w-[160px] truncate">{s.名前 || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-500 font-mono text-xs whitespace-nowrap">{s.店舗電話番号}</td>
                    <td className="px-3 py-2.5 text-gray-500 text-xs whitespace-nowrap">{s.住所1 || '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className="bg-pink-50 text-pink-700 text-xs rounded-full px-2 py-0.5 whitespace-nowrap">{s.業種 || '—'}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      {s.HP保有 && <span className="bg-sky-50 text-sky-600 text-xs rounded px-1.5 py-0.5">{s.HP保有}</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-400 text-xs">{s.席数 ? `${s.席数}席` : '—'}</td>
                    <td className="px-3 py-2.5 text-right text-gray-400 text-xs">{s.従業員 ? `${s.従業員}名` : '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-400 max-w-[60px] truncate">{s.定休日 || '—'}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-blue-700">{s.calls.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right text-emerald-600">{s.taio.toLocaleString()}</td>
                    <td className={`px-3 py-2.5 text-right ${rateColor(s.taio_rate)}`}>{s.taio_rate}%</td>
                    <td className="px-3 py-2.5 text-right text-purple-600">{s.kassai.toLocaleString()}</td>
                    <td className={`px-3 py-2.5 text-right ${rateColor(s.kassai_rate)}`}>{s.kassai_rate}%</td>
                    <td className="px-3 py-2.5 text-center">
                      <ProgressBadge score={s.max_progress_score} />
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs text-gray-400 whitespace-nowrap">{s.last_call || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between">
            <span className="text-xs text-gray-400">
              {stores.length.toLocaleString()} 件表示
              {total !== null && <span className="ml-1 text-gray-300">/ 合計 {total.toLocaleString()} 件</span>}
            </span>
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