# 16 管理者ツールページ

**ルート:** `/dashboard/admin`  
**ファイル:** `app/dashboard/admin/page.tsx`  
**API:** `/api/admin/*` 各種

---

## 概要

データベース管理・メンテナンス・診断を行う管理者専用ページ。  
一般ユーザーにはアクセスさせないよう権限制御が必要。

---

## 管理ツール一覧

| ツール名 | API | 用途 |
|----------|-----|------|
| DBマイグレーション | `POST /api/admin/migrate` | スキーマ更新 |
| DB情報確認 | `POST /api/admin/dbinfo` | テーブル・件数確認 |
| DBバキューム | `POST /api/admin/vacuum` | DB最適化 |
| スナップショット | `POST /api/admin/snapshot` | データバックアップ |
| ユーザー管理 | `POST /api/admin/users` | ユーザー一覧・操作 |
| カラム削除 | `POST /api/admin/drop-columns` | 不要カラム削除 |
| 空行クリーン | `POST /api/admin/clean-empty-rows` | 空行の削除 |
| 無効電話番号クリーン | `POST /api/admin/clean-invalid-phones` | 異常データ削除 |
| シート清掃 | `POST /api/admin/cleanse-seats` | シートデータ整理 |
| 清斎診断 | `POST /api/admin/seisa-diag` | 清斎データ診断 |
| Evercall連携 | `POST /api/admin/evercall` | Evercall API 操作 |
| コール履歴インポート | `POST /api/admin/import-call-history` | コール履歴取込 |

---

## フェーズ進捗

- [x] **Phase 1: 要件整理・設計**
  - [x] 各管理ツールの機能確認
  - [x] 管理者権限の制御方針の確認
  - [ ] 操作ログの記録要否確認

- [x] **Phase 2: UIスケルトン**
  - [x] 各ツールのボタン・パネルレイアウト
  - [x] 実行結果の表示エリア

- [x] **Phase 3: フロントエンド実装**
  - [x] 各ツールの実行ボタン
  - [x] 実行結果のJSON/テキスト表示
  - [ ] 確認ダイアログ（危険な操作用）
  - [ ] 操作ログの表示

- [x] **Phase 4: API連携**
  - [x] 各 `/api/admin/*` エンドポイントへの接続
  - [ ] 管理者権限チェックの徹底確認

- [ ] **Phase 5: テスト・バグ修正**
  - [ ] 各ツールの動作確認
  - [ ] 非管理者ユーザーのアクセス制御確認

- [ ] **Phase 6: 完成・レビュー**
  - [ ] セキュリティ最終確認
  - [ ] 危険な操作への二重確認UI実装

---

## 現在状況

**🟡 実装中 — Phase 3〜5 確認ダイアログ・権限制御が未完成**

---

## 関連ファイル

- `app/dashboard/admin/page.tsx` — ページ本体
- `app/api/admin/*/route.ts` — 各管理 API
- `lib/db.ts` — DB操作
- `lib/auth.ts` — 権限チェック

---

## メモ・課題

- **重要:** カラム削除・バキューム・空行クリーンなど破壊的操作には確認ダイアログを必ず実装する
- 管理者権限（`role: admin`）のミドルウェアチェックを全エンドポイントに適用する
- 操作ログをDBに記録する仕組みを検討する
