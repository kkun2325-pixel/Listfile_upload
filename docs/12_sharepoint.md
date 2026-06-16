# 12 SharePoint連携ページ

**ルート:** `/dashboard/sharepoint`  
**ファイル:** `app/dashboard/sharepoint/page.tsx`  
**API:** `GET /api/sharepoint-files` / `POST /api/sharepoint-files/[id]/sync` / `POST /api/cron/sharepoint-sync`

---

## 概要

SharePoint上のファイルをリスト表示し、同期・インポートを行うページ。  
定期的な自動同期（cron）も設定可能。  
Python スクリプト（`sharepoint_auto_upload.py`）との連携あり。

---

## フェーズ進捗

- [ ] **Phase 1: 要件整理・設計**
  - [ ] 連携するSharePointサイト・ライブラリの確認
  - [ ] 認証方式の確認（OAuth / APIキー）
  - [ ] 同期対象ファイル種別の確認
  - [ ] 自動同期スケジュールの設計

- [ ] **Phase 2: UIスケルトン**
  - [ ] SharePointファイル一覧レイアウト
  - [ ] 同期ボタン・ステータス表示
  - [ ] 自動同期設定UI

- [ ] **Phase 3: フロントエンド実装**
  - [ ] ファイル一覧の表示
  - [ ] 手動同期ボタンの実装
  - [ ] 同期ステータス表示
  - [ ] エラーメッセージ表示

- [ ] **Phase 4: API連携**
  - [ ] `GET /api/sharepoint-files` ファイル一覧取得
  - [ ] `POST /api/sharepoint-files/[id]/sync` 個別ファイル同期
  - [ ] `POST /api/cron/sharepoint-sync` 定期同期
  - [ ] `lib/sharepoint.ts` の認証フロー確認

- [ ] **Phase 5: テスト・バグ修正**
  - [ ] SharePoint接続の動作確認
  - [ ] 同期処理の動作確認
  - [ ] エラー時のハンドリング確認

- [ ] **Phase 6: 完成・レビュー**
  - [ ] セキュリティ確認（認証情報の管理）
  - [ ] 自動同期スケジュールの動作確認

---

## 現在状況

**🔴 未着手 — Phase 1 から開始**

---

## 関連ファイル

- `app/dashboard/sharepoint/page.tsx` — ページ本体
- `app/api/sharepoint-files/route.ts` — ファイル一覧 API
- `app/api/sharepoint-files/[id]/route.ts` — ファイル詳細 API
- `app/api/sharepoint-files/[id]/sync/route.ts` — 同期 API
- `app/api/cron/sharepoint-sync/route.ts` — 定期同期
- `lib/sharepoint.ts` — SharePoint API クライアント
- `sharepoint_auto_upload.py` — Python 自動アップロードスクリプト

---

## メモ・課題

- SharePoint の認証情報（クライアントID・シークレット）は `.env` で管理
- Python スクリプトとの連携フローを整理する
- cron ジョブの実行環境（Render / Vercel Cron）を確定する
