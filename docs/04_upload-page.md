# 04 アップロードページ

**ルート:** `/dashboard/upload`  
**ファイル:** `app/dashboard/upload/page.tsx`  
**API:** `POST /api/upload`

---

## 概要

CSVファイルをアップロードして、データベースに取り込むページ。  
ファイル選択 → アップロード → 進捗表示 → 完了通知 の流れ。  
アップロード中はトースト通知（`UploadProgressToast`）で進捗を表示。

---

## フェーズ進捗

- [x] **Phase 1: 要件整理・設計**
  - [x] 受け付けるCSVフォーマットの定義
  - [x] 重複チェック方針の確認（電話番号ベース）
  - [x] 最大ファイルサイズの確認
  - [x] アップロード中の進捗表示方式の確認

- [x] **Phase 2: UIスケルトン**
  - [x] ファイルドロップゾーンのレイアウト
  - [x] アップロードボタン・ファイル名表示
  - [x] 進捗トースト配置

- [x] **Phase 3: フロントエンド実装**
  - [x] ファイル選択・ドラッグ&ドロップ
  - [x] アップロード進捗の状態管理（`UploadProgressContext`）
  - [x] `UploadProgressToast` コンポーネント連携
  - [x] 完了後の画面更新

- [x] **Phase 4: API連携**
  - [x] `POST /api/upload` へのマルチパート送信
  - [x] サーバー側 CSV パース（`lib/csv.ts`）
  - [x] 電話番号なし行のスキップ処理
  - [x] 重複行の除外処理

- [x] **Phase 5: テスト・バグ修正**
  - [x] 正常アップロードの動作確認
  - [x] 電話番号なし行のスキップ確認
  - [x] 大容量ファイルの動作確認
  - [ ] アップロードエラー時のリカバリ確認

- [ ] **Phase 6: 完成・レビュー**
  - [ ] UX最終確認（進捗表示・完了メッセージ）
  - [ ] エラーハンドリングの網羅性確認

---

## 現在状況

**🟢 ほぼ完成 — Phase 5 残タスクあり**

---

## 関連ファイル

- `app/dashboard/upload/page.tsx` — ページ本体
- `app/api/upload/route.ts` — アップロード API
- `app/components/UploadProgressToast.tsx` — 進捗トースト
- `app/contexts/upload-progress.tsx` — 進捗コンテキスト
- `lib/csv.ts` — CSV パース・処理
- `lib/sanitize.ts` — データサニタイズ

---

## メモ・課題

- アップロードエラー時（ネットワーク切断など）の再試行UI が未実装
- 大容量CSVのタイムアウト設定を確認する
