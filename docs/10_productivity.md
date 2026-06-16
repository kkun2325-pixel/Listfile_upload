# 10 生産性レポートページ

**ルート:** `/dashboard/productivity`  
**ファイル:** `app/dashboard/productivity/page.tsx`  
**API:** `POST /api/productivity` / `POST /api/daily`

---

## 概要

スタッフ・チームの生産性指標を可視化するページ。  
日次データの集計・KPI表示・チーム別パフォーマンス比較などを行う。

---

## フェーズ進捗

- [x] **Phase 1: 要件整理・設計**
  - [x] KPI指標の定義
  - [x] 表示対象（個人 / チーム / 全体）の確認
  - [ ] 期間設定の仕様確認（日次・週次・月次）

- [x] **Phase 2: UIスケルトン**
  - [x] KPIカードのレイアウト
  - [x] チーム別グラフエリア
  - [x] 日次サマリーテーブル

- [x] **Phase 3: フロントエンド実装**
  - [x] KPIデータの表示
  - [x] グラフ表示（Recharts）
  - [ ] 期間フィルター（日次・週次・月次切り替え）
  - [ ] チーム別ドリルダウン

- [x] **Phase 4: API連携**
  - [x] `POST /api/productivity` からデータ取得
  - [x] `POST /api/daily` 日次データ同期
  - [ ] 期間パラメータの API 対応

- [ ] **Phase 5: テスト・バグ修正**
  - [ ] 各指標の計算ロジック確認
  - [ ] データなし時の表示確認
  - [ ] 日次同期処理の動作確認

- [ ] **Phase 6: 完成・レビュー**
  - [ ] KPI定義の最終確認（ビジネス側との合意）
  - [ ] グラフの見やすさ調整

---

## 現在状況

**🟡 実装中 — Phase 3 フィルター未実装**

---

## 関連ファイル

- `app/dashboard/productivity/page.tsx` — ページ本体
- `app/api/productivity/route.ts` — 生産性データ API
- `app/api/daily/route.ts` — 日次同期 API
- `lib/db.ts` — 生産性データクエリ

---

## メモ・課題

- 生産性の定義（何をKPIとするか）をビジネス要件と合わせて確定する
- 日次同期（`/api/daily`）の実行タイミングを確認する
