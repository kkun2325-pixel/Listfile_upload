# 07 エクスポートページ

**ルート:** `/dashboard/export`  
**ファイル:** `app/dashboard/export/page.tsx`  
**API:** `POST /api/export` / `GET /api/export/templates` / `GET /api/export/preview`

---

## 概要

アップロードデータをフィルタリングしてCSVエクスポートするページ。  
エクスポートテンプレートの選択・作成・プレビュー・ZIP出力が可能。  
清斎リスト（Seisa）のバッチ処理にも対応。

---

## フェーズ進捗

- [x] **Phase 1: 要件整理・設計**
  - [x] エクスポート条件（フィルター項目）の定義
  - [x] テンプレート保存の仕組みの設計
  - [x] 出力形式（CSV / ZIP）の確認
  - [x] 清斎リスト（Seisa）連携の要件確認

- [x] **Phase 2: UIスケルトン**
  - [x] フィルターパネルのレイアウト
  - [x] テンプレート選択UI
  - [x] プレビューエリア
  - [x] エクスポートボタン

- [x] **Phase 3: フロントエンド実装**
  - [x] フィルター条件の状態管理
  - [x] テンプレート一覧の表示・選択
  - [x] プレビューデータの表示
  - [ ] ZIP ダウンロードのハンドリング
  - [ ] エクスポート件数カウントの表示

- [x] **Phase 4: API連携**
  - [x] `GET /api/export/templates` テンプレート一覧取得
  - [x] `POST /api/export/templates` テンプレート保存
  - [x] `GET /api/export/preview` プレビューデータ取得
  - [x] `POST /api/export` エクスポート実行
  - [x] `POST /api/export/zip` ZIP生成
  - [ ] `GET /api/export/next-number` 連番取得

- [ ] **Phase 5: テスト・バグ修正**
  - [ ] 各フィルター条件の動作確認
  - [ ] ZIP出力の動作確認
  - [ ] 大量データのエクスポートパフォーマンス確認

- [ ] **Phase 6: 完成・レビュー**
  - [ ] UX最終確認
  - [ ] エクスポート履歴との連携確認

---

## 現在状況

**🟡 実装中 — Phase 3〜4 一部未実装**

---

## 関連ファイル

- `app/dashboard/export/page.tsx` — ページ本体
- `app/api/export/route.ts` — エクスポート実行
- `app/api/export/preview/route.ts` — プレビュー
- `app/api/export/zip/route.ts` — ZIP生成
- `app/api/export/templates/route.ts` — テンプレート管理
- `app/api/export/next-number/route.ts` — 連番管理
- `app/api/export/seisa-list/route.ts` — 清斎リスト
- `app/api/export/unseisa/route.ts` — 未清斎データ
- `lib/csv.ts` — CSV生成ユーティリティ

---

## メモ・課題

- 清斎（Seisa）リストの仕様をドキュメント化する必要あり
- ZIPダウンロード時のブラウザ挙動を確認する
- `export/history` との連携ページを別途設計
