# 13 Beauty ホームページ

**ルート:** `/beauty`  
**ファイル:** `app/beauty/page.tsx`  
**API:** `GET /api/beauty/stores` / `POST /api/beauty/init`

---

## 概要

Beautyサロン管理モジュールのトップページ。  
サロン一覧の表示・検索・Beauty ダッシュボードへのナビゲーションを提供。  
`/api/beauty/init` で初期データのセットアップも可能。

---

## フェーズ進捗

- [x] **Phase 1: 要件整理・設計**
  - [x] Beauty モジュールのスコープ確認（飲食・美容業種）
  - [x] ホームページで表示する情報の確認
  - [ ] メインダッシュボードとの役割分担の明確化

- [x] **Phase 2: UIスケルトン**
  - [x] サロン一覧レイアウト
  - [x] ナビゲーションリンク配置

- [x] **Phase 3: フロントエンド実装**
  - [x] サロン一覧の表示
  - [x] 検索・フィルター
  - [ ] ページネーション
  - [ ] サロン追加機能

- [x] **Phase 4: API連携**
  - [x] `GET /api/beauty/stores` サロン一覧取得
  - [x] `POST /api/beauty/init` 初期化処理
  - [ ] サロン登録 API

- [ ] **Phase 5: テスト・バグ修正**
  - [ ] 一覧表示の動作確認
  - [ ] 検索の動作確認

- [ ] **Phase 6: 完成・レビュー**
  - [ ] 最終UI確認

---

## 現在状況

**🟡 実装中 — Phase 3〜4 一部未実装**

---

## 関連ファイル

- `app/beauty/page.tsx` — ページ本体
- `app/api/beauty/stores/route.ts` — サロン一覧 API
- `app/api/beauty/init/route.ts` — 初期化 API
- `lib/db.ts` — Beauty データクエリ

---

## メモ・課題

- Beauty モジュールはメインダッシュボードとは別ルート（`/beauty`）に存在
- `POST /api/beauty/init` は初回セットアップ用なので、実行後は非表示にするか管理者のみアクセス可にする
