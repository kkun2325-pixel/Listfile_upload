# 設計: store_id 導入によるデータ管理の再設計

**決定日:** 2026-06-15  
**ステータス:** 実装中

---

## 背景・問題

- `csv_data` の主キーは `id`（毎アップロードで新規UUID）
- 重複チェックキーは `電話番号` だが、過去のコードが COALESCE なしで上書き → 名前・住所・精査データが消えた
- `upload_id` が行に直接紐づくため、再アップロードのたびに上書きされ追跡不能になっていた

---

## 決定内容（確定）

| 項目 | 内容 |
| ---- | ---- |
| ① テーブル構成 | 既存 `csv_data` に `store_id` カラム追加（分割しない） |
| ② 旧データ | 再アップロード完了後に完全削除（TRUNCATE） |
| ③ store_id 形式 | 連番 `S-00001` 形式（5桁ゼロパディング） |

---

## 新しいデータモデル

```text
csv_data テーブル（変更後）

store_id   TEXT UNIQUE  ← 【新規】永続ID。電話番号に1対1で対応。変わらない。
id         TEXT PK      ← 行の技術的UUID（変わる可能性あり）
電話番号   TEXT         ← ビジネスキー（一致チェックに使用）
名前       TEXT         ← 【UPDATE対象に追加】COALESCE で保護
住所1      TEXT         ← 【UPDATE対象に追加】COALESCE で保護
住所2      TEXT         ← 【UPDATE対象に追加】COALESCE で保護
（精査フィールド群）   ← 既存通り COALESCE で保護
upload_id  TEXT         ← 最後に更新したアップロードの記録（追跡用のみ）
```

---

## store_id の採番ルール

```text
形式: S-XXXXX（Sプレフィックス + 5桁ゼロパディング）
例:   S-00001, S-00002, ..., S-99999

採番: INSERT 時に MAX(store_id) + 1 をサーバーサイドで自動採番
     UPDATE 時は store_id を変更しない
```

---

## アップロードフロー（新）

```text
CSV アップロード
    ↓
各行の電話番号で csv_data を一括検索
    ↓
 ┌─────────────┬─────────────────────┐
 │ 既存電話番号 │  新規電話番号        │
 │（UPDATE）   │  （INSERT）          │
 │             │                     │
 │ store_id は │  store_id を連番採番 │
 │ 変えない    │  S-XXXXX を新規発行  │
 │             │                     │
 │ COALESCE で │  全フィールドを      │
 │ 全フィールド│  そのまま INSERT     │
 │ 保護        │                     │
 └─────────────┴─────────────────────┘
```

---

## コード変更箇所

### lib/db.ts

| 変更 | 内容 |
| ---- | ---- |
| `initDb()` | CREATE TABLE に `store_id TEXT UNIQUE` 追加 |
| `migrateSchema()` | `store_id TEXT UNIQUE` を ALTER TABLE で追加 |
| `COL_COUNT` | 54 → 55 |
| `INSERT_COLS` | `store_id` を追加 |
| `rowToArgs()` | `storeId` 引数を追加 |
| `generateStoreIds()` | 連番 store_id 採番関数（新規追加） |
| `batchUpsertCSVRows()` | INSERT: store_id 採番 / UPDATE: 名前・住所1・住所2 追加 |

### 新規 API

| ファイル | 内容 |
| -------- | ---- |
| `app/api/admin/truncate-store-data/route.ts` | csv_data 全削除（manager ロール限定） |

---

## 移行手順（本番適用時）

```text
Step 1: コードデプロイ（store_id カラム追加マイグレーション含む）
Step 2: 管理者ページから「DBマイグレーション」実行
         → store_id カラムが csv_data に追加される
Step 3: 管理者ページから「データリセット」実行
         → csv_data の全行を削除
Step 4: 保存していたマスターCSVを再アップロード
         → 全行に新規 store_id（S-00001〜）が採番されて INSERT
Step 5: 完了確認（store_id の付番・件数・精査データの確認）
```

---

## 完了条件

- [x] csv_data に store_id カラムが存在する（initDb + migrateSchema）
- [x] INSERT 時に `S-XXXXX` 形式の store_id が自動採番される
- [x] UPDATE 時に store_id は変更されない
- [x] 再アップロードで名前・住所1・住所2 が COALESCE で復元できる
- [x] 管理者用リセット API が存在する（`DELETE /api/admin/truncate-store-data`）
- [ ] 管理者ページ UI にリセットボタンを追加する
- [ ] 本番 DB に migrateSchema を実行して store_id カラムを追加する
- [ ] マスター CSV を再アップロードして全行に store_id を付与する
