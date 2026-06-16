# 14 Beauty ダッシュボードページ

**ルート:** `/beauty/dashboard`  
**ファイル:** `app/beauty/dashboard/page.tsx`  
**API:** `GET /api/beauty/dashboard`

---

## 概要

Beautyサロン全体の集計データ・KPI・分析を表示するダッシュボード。  
サロン別の実績・コール状況・予約状況などを可視化する。

---

## フェーズ進捗

- [x] **Phase 1: 要件整理・設計**
  - [x] 表示するKPI・指標の定義
  - [ ] サロン比較ビューの要否確認
  - [ ] データ更新頻度の確認

- [x] **Phase 2: UIスケルトン**
  - [x] ダッシュボードカードレイアウト
  - [x] グラフエリアの配置

- [x] **Phase 3: フロントエンド実装**
  - [x] KPIカードの表示
  - [x] グラフ表示
  - [ ] 期間フィルター
  - [ ] サロン別ドリルダウン

- [x] **Phase 4: API連携**
  - [x] `GET /api/beauty/dashboard` からデータ取得
  - [ ] フィルターパラメータの API 対応

- [ ] **Phase 5: テスト・バグ修正**
  - [ ] データ表示の正確性確認
  - [ ] データなし時の表示確認

- [ ] **Phase 6: 完成・レビュー**
  - [ ] ビジネス側とKPI定義の最終確認
  - [ ] グラフUIの調整

---

## 現在状況

**🟡 実装中 — Phase 3〜4 フィルター未実装**

---

## 関連ファイル

- `app/beauty/dashboard/page.tsx` — ページ本体
- `app/api/beauty/dashboard/route.ts` — ダッシュボードデータ API
- `lib/db.ts` — Beauty集計クエリ

---

## メモ・課題

- `/api/beauty/dashboard` が新規追加 API のため、レスポンス仕様を確認する
- Beauty ダッシュボードとメインダッシュボードの指標の重複を整理する
