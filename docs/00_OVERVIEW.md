# アプリ全体 進捗管理

## アプリ概要

**アプリ名:** listfilemanager  
**技術スタック:** Next.js 14 / TypeScript / Tailwind CSS / SQLite (本番: CockroachDB)  
**用途:** CSV アップロード・エクスポート・コール分析・店舗管理・Beautyサロン管理

---

## ページ一覧と進捗サマリー

| # | ページ名 | ファイル | フェーズ | 現在状況 |
|---|----------|----------|----------|----------|
| 01 | ログイン | [01_login-page.md](01_login-page.md) | P1〜P6 | 🟢 完成 |
| 02 | ユーザー登録 | [02_register-page.md](02_register-page.md) | P1〜P6 | 🟢 完成 |
| 03 | ダッシュボード TOP | [03_dashboard-top.md](03_dashboard-top.md) | P1〜P6 | 🟡 実装中 |
| 04 | アップロード | [04_upload-page.md](04_upload-page.md) | P1〜P6 | 🟢 完成 |
| 05 | アップロード履歴 | [05_upload-history.md](05_upload-history.md) | P1〜P6 | 🟡 実装中 |
| 06 | アップロード詳細 | [06_upload-detail.md](06_upload-detail.md) | P1〜P6 | 🟡 実装中 |
| 07 | エクスポート | [07_export-page.md](07_export-page.md) | P1〜P6 | 🟡 実装中 |
| 08 | エクスポートテンプレート詳細 | [08_export-template-detail.md](08_export-template-detail.md) | P1〜P6 | 🟡 実装中 |
| 09 | コール分析 | [09_call-analysis.md](09_call-analysis.md) | P1〜P6 | 🟡 実装中 |
| 10 | 生産性レポート | [10_productivity.md](10_productivity.md) | P1〜P6 | 🟡 実装中 |
| 11 | 店舗管理 | [11_store-management.md](11_store-management.md) | P1〜P6 | 🟡 実装中 |
| 12 | SharePoint連携 | [12_sharepoint.md](12_sharepoint.md) | P1〜P6 | 🔴 未着手 |
| 13 | Beauty ホーム | [13_beauty-home.md](13_beauty-home.md) | P1〜P6 | 🟡 実装中 |
| 14 | Beauty ダッシュボード | [14_beauty-dashboard.md](14_beauty-dashboard.md) | P1〜P6 | 🟡 実装中 |
| 15 | Beauty 店舗詳細 | [15_beauty-store-detail.md](15_beauty-store-detail.md) | P1〜P6 | 🟡 実装中 |
| 16 | 管理者ツール | [16_admin-tools.md](16_admin-tools.md) | P1〜P6 | 🟡 実装中 |

**凡例:** 🟢 完成 / 🟡 実装中 / 🔴 未着手 / ⚪ 未定

---

## フェーズ定義（全ページ共通）

各ページのフェーズは以下の6段階で管理します。

| フェーズ | 内容 |
|----------|------|
| **Phase 1** | 要件整理・設計（何を作るか明確にする） |
| **Phase 2** | UIスケルトン（見た目の骨格を作る） |
| **Phase 3** | フロントエンド実装（UI・ロジック・状態管理） |
| **Phase 4** | API連携・バックエンド（データの取得・送信） |
| **Phase 5** | テスト・バグ修正（動作確認・修正） |
| **Phase 6** | 完成・レビュー（最終確認・リリース判断） |

---

## アプリ全体フェーズ

| 大フェーズ | 対象ページ | 状況 |
|------------|------------|------|
| **フェーズ A: 認証基盤** | ログイン・登録 | 🟢 完成 |
| **フェーズ B: アップロード機能** | アップロード・履歴・詳細 | 🟡 実装中 |
| **フェーズ C: エクスポート機能** | エクスポート・テンプレート | 🟡 実装中 |
| **フェーズ D: 分析・レポート** | コール分析・生産性 | 🟡 実装中 |
| **フェーズ E: 店舗管理** | 店舗管理・ダッシュボードTOP | 🟡 実装中 |
| **フェーズ F: Beautyモジュール** | Beauty 3ページ | 🟡 実装中 |
| **フェーズ G: 管理機能** | 管理者ツール | 🟡 実装中 |
| **フェーズ H: 外部連携** | SharePoint | 🔴 未着手 |
