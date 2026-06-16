# 08 エクスポートテンプレート詳細ページ

**ルート:** `/dashboard/export/[id]`  
**ファイル:** `app/dashboard/export/[id]/page.tsx`  
**API:** `GET /api/export/templates/[id]` / `DELETE /api/export/templates/[id]`

---

## 概要

保存済みエクスポートテンプレートの詳細・編集・削除ページ。  
テンプレートに設定されたフィルター条件を確認・修正し、  
そのまま再エクスポートを実行することができる。

---

## フェーズ進捗

- [x] **Phase 1: 要件整理・設計**
  - [x] テンプレートの保持データ項目の確認
  - [x] 編集・削除操作の確認
  - [ ] テンプレートからの直接エクスポート機能の要否

- [x] **Phase 2: UIスケルトン**
  - [x] テンプレート詳細表示レイアウト
  - [x] 編集フォーム
  - [x] 削除ボタン

- [ ] **Phase 3: フロントエンド実装**
  - [x] テンプレート詳細データの表示
  - [ ] 編集フォームの状態管理・保存
  - [ ] 削除確認ダイアログ

- [x] **Phase 4: API連携**
  - [x] `GET /api/export/templates/[id]` データ取得
  - [x] `DELETE /api/export/templates/[id]` 削除
  - [ ] テンプレート更新（PUT/PATCH）

- [ ] **Phase 5: テスト・バグ修正**
  - [ ] 存在しないIDアクセス時の404表示確認
  - [ ] 削除後の一覧ページへのリダイレクト確認

- [ ] **Phase 6: 完成・レビュー**
  - [ ] 最終確認

---

## 現在状況

**🟡 実装中 — Phase 3 編集・削除UIが未完成**

---

## 関連ファイル

- `app/dashboard/export/[id]/page.tsx` — ページ本体
- `app/api/export/templates/[id]/route.ts` — テンプレート詳細・削除 API
- `app/api/export/templates/route.ts` — テンプレート一覧・作成 API

---

## メモ・課題

- テンプレートの更新（PUT）APIが未実装
- 削除確認ダイアログのUI実装が必要
