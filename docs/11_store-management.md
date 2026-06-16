# 11 店舗管理ページ

**ルート:** `/dashboard/store`  
**ファイル:** `app/dashboard/store/page.tsx`  
**API:** `GET /api/stores` / `GET /api/stores/[id]` / `GET /api/teams`

---

## 概要

複数店舗・チームのデータを管理するページ。  
店舗一覧表示・店舗ごとのメンバー確認・データ編集（インライン）が可能。  
`EditCell` コンポーネントによるインライン編集をサポート。

---

## フェーズ進捗

- [x] **Phase 1: 要件整理・設計**
  - [x] 表示する店舗情報の項目確認
  - [x] チーム・メンバーとの関連の設計
  - [x] インライン編集の対象カラム確認

- [x] **Phase 2: UIスケルトン**
  - [x] 店舗一覧テーブルレイアウト
  - [x] チーム・メンバー表示エリア
  - [x] 編集インターフェース

- [x] **Phase 3: フロントエンド実装**
  - [x] 店舗一覧の表示
  - [x] インライン編集（`EditCell`コンポーネント）
  - [x] `EditCell` のリマウント問題修正済み
  - [ ] 店舗追加・削除機能
  - [ ] 検索・フィルター機能

- [x] **Phase 4: API連携**
  - [x] `GET /api/stores` 店舗一覧取得
  - [x] `GET /api/stores/[id]` 店舗詳細取得
  - [x] `GET /api/teams` チーム一覧取得
  - [x] `GET /api/teams/[id]/members` メンバー取得
  - [ ] 店舗データ更新 API（PUT）

- [ ] **Phase 5: テスト・バグ修正**
  - [ ] インライン編集の保存確認
  - [ ] 店舗なし時の表示確認

- [ ] **Phase 6: 完成・レビュー**
  - [ ] 最終確認

---

## 現在状況

**🟡 実装中 — Phase 3〜4 一部未実装**

---

## 関連ファイル

- `app/dashboard/store/page.tsx` — ページ本体
- `app/api/stores/route.ts` — 店舗一覧 API
- `app/api/stores/[id]/route.ts` — 店舗詳細 API
- `app/api/teams/route.ts` — チーム API
- `app/api/teams/[id]/members/route.ts` — メンバー API
- `lib/db.ts` — 店舗・チームクエリ

---

## メモ・課題

- 店舗データの更新（PUT）APIが未実装
- `EditCell` は `StorePage` 外に定義することでリマウント問題を解決済み（再発注意）
- 店舗追加フローを設計・実装する
