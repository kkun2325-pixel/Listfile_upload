# 03 ダッシュボード TOP

**ルート:** `/dashboard` または `/dashboard/top`  
**ファイル:** `app/dashboard/page.tsx` / `app/dashboard/top/page.tsx`  
**API:** `GET /api/dashboard`

---

## 概要

ログイン後に最初に表示されるメインダッシュボード。  
全体の統計サマリー・最近のアップロード・アクティビティを一覧表示する。

---

## フェーズ進捗

- [x] **Phase 1: 要件整理・設計**
  - [x] 表示すべき統計情報の定義
  - [x] 各セクションの役割確認
  - [ ] ウィジェット構成の最終決定

- [x] **Phase 2: UIスケルトン**
  - [x] ダッシュボードレイアウト（カード・グリッド）
  - [x] サイドバー（`app/components/Sidebar.tsx`）との組み合わせ

- [x] **Phase 3: フロントエンド実装**
  - [x] 統計カードのコンポーネント化
  - [ ] リアルタイム更新の実装
  - [ ] レスポンシブ対応の確認

- [x] **Phase 4: API連携**
  - [x] `GET /api/dashboard` からデータ取得
  - [ ] ローディング・エラー状態の実装

- [ ] **Phase 5: テスト・バグ修正**
  - [ ] データ取得の動作確認
  - [ ] 空データ時の表示確認

- [ ] **Phase 6: 完成・レビュー**
  - [ ] UIの最終調整
  - [ ] パフォーマンス確認

---

## 現在状況

**🟡 実装中 — Phase 3〜4 進行中**

---

## 関連ファイル

- `app/dashboard/page.tsx` — ダッシュボードホーム
- `app/dashboard/top/page.tsx` — トップページ
- `app/dashboard/layout.tsx` — ダッシュボードレイアウト
- `app/components/Sidebar.tsx` — サイドバーナビゲーション
- `app/api/dashboard/route.ts` — ダッシュボードデータ API

---

## メモ・課題

- `dashboard/page.tsx` と `dashboard/top/page.tsx` の役割分担を明確にする
- サイドバーのアクティブ状態の管理を確認
