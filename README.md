# CSV Upload Management App

複数人でCSVファイルをアップロード・管理・処理するNext.jsウェブアプリケーション。

## 機能

- ✅ ユーザー認証（登録・ログイン）
- ✅ CSVファイルのアップロード
- ✅ データベースへのデータ保存
- ✅ 重複排除（電話番号などをキー）
- ✅ アップロード履歴の蓄積
- ✅ セグメント分割機能
- ✅ 複数CSVのエクスポート

## 技術スタック

- **フロントエンド**: Next.js 14, React, TypeScript, Tailwind CSS
- **バックエンド**: Next.js API Routes
- **データベース**: SQLite
- **認証**: JWT + Bcrypt
- **CSV処理**: PapaParse

## セットアップ

### 1. 依存関係をインストール

```bash
npm install
```

### 2. データベースの初期化

```bash
npm run init-db
```

### 3. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

## プロジェクト構造

```
csv-upload-app/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   │   ├── auth/         # 認証関連
│   │   ├── upload/       # ファイルアップロード
│   │   └── export/       # データエクスポート
│   ├── layout.tsx         # メインレイアウト
│   ├── page.tsx          # ホームページ
│   ├── login/            # ログインページ
│   ├── register/         # 登録ページ
│   └── dashboard/        # ダッシュボード
├── lib/                   # ユーティリティ関数
│   ├── db.ts            # データベースユーティリティ
│   ├── auth.ts          # 認証ユーティリティ
│   ├── csv.ts           # CSV処理ユーティリティ
│   └── types.ts         # 型定義
├── db/                    # データベース初期化
└── data/                  # SQLiteデータベースファイル
```

## API エンドポイント

### 認証
- `POST /api/auth/register` - ユーザー登録
- `POST /api/auth/login` - ログイン
- `POST /api/auth/logout` - ログアウト

### ファイル操作
- `POST /api/upload` - CSVファイルアップロード
- `GET /api/uploads` - アップロード履歴取得
- `POST /api/export` - セグメント分割とCSVエクスポート

## 使用方法

1. **ユーザー登録**: メールアドレスとパスワードで登録
2. **ログイン**: 登録したユーザーでログイン
3. **ファイルアップロード**: ダッシュボードからCSVファイルをアップロード
4. **データ管理**: アップロードされたデータを確認・検索
5. **セグメント分割**: 条件に応じてデータを分割
6. **エクスポート**: 結果をCSVファイルとしてダウンロード

## 注意事項

- 本番環境では `.env.local` の `JWT_SECRET` を変更してください
- SQLiteデータベースはファイルベースなので、本番環境ではPostgreSQLなどに移行してください

## ライセンス

MIT
