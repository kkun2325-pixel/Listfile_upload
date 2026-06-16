# 09 コール分析ページ

**ルート:** `/dashboard/call-analysis`  
**ファイル:** `app/dashboard/call-analysis/page.tsx`  
**API:** `POST /api/call-analysis` / `POST /api/admin/import-call-history`

---

## 概要

電話コールデータの分析・可視化ページ。  
電話番号ごとのコール回数・応答率・決定率・時間帯分析を表示。  
コール履歴のインポート機能も管理者向けに提供。

---

## フェーズ進捗

- [x] **Phase 1: 要件整理・設計**
  - [x] 分析指標の定義（応答率・決定率・時間帯別）
  - [x] 表示対象データ（電話番号ベース）の確認
  - [x] グラフの種類・レイアウトの検討
  - [ ] フィルター条件（期間・店舗など）の定義

- [x] **Phase 2: UIスケルトン**
  - [x] 統計カードのレイアウト
  - [x] テーブルレイアウト（電話番号ごとの集計）
  - [x] グラフ配置エリア

- [x] **Phase 3: フロントエンド実装**
  - [x] 統計データの表示
  - [x] 時間帯別グラフ（Recharts 使用）
  - [x] 電話番号ごとのテーブル表示
  - [ ] 期間フィルター
  - [ ] CSV エクスポート機能

- [x] **Phase 4: API連携**
  - [x] `POST /api/call-analysis` からデータ取得
  - [x] `POST /api/admin/import-call-history` でのコール履歴インポート
  - [ ] フィルターパラメータの API 対応

- [ ] **Phase 5: テスト・バグ修正**
  - [ ] コールデータなし時の表示確認
  - [ ] グラフの正確性確認
  - [ ] 大量データ時のパフォーマンス確認

- [ ] **Phase 6: 完成・レビュー**
  - [ ] グラフUIの最終調整
  - [ ] データの正確性を実データで検証

---

## 現在状況

**🟡 実装中 — Phase 3 フィルター未実装**

---

## 関連ファイル

- `app/dashboard/call-analysis/page.tsx` — ページ本体
- `app/api/call-analysis/route.ts` — 分析データ API
- `app/api/admin/import-call-history/route.ts` — 履歴インポート API
- `lib/db.ts` — コール履歴クエリ

---

## メモ・課題

- 期間フィルター（日付範囲）が未実装
- コール履歴インポートの対応CSVフォーマットをドキュメント化する
- Recharts のバージョン確認・グラフのレスポンシブ対応
