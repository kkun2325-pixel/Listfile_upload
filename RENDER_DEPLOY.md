# Render デプロイ手順書

## 前提条件

- GitHubアカウント（リポジトリ: `kkun2325-pixel/Listfile_upload`）
- Renderアカウント（https://render.com）
- CockroachDBの接続文字列（現在Vercelに設定済みの `DATABASE_URL`）

---

## 1. GitHubへのプッシュ

本番コードをGitHubに反映します。

```bash
cd "C:\Users\deita\Desktop\claude code\csv-upload-app"
git add render.yaml package.json postcss.config.js
git commit -m "Add Render configuration"
git push origin main
```

---

## 2. Renderアカウントの準備

1. https://render.com にアクセスし、GitHubアカウントでサインアップ/ログイン
2. ダッシュボードが表示されたら次のステップへ

---

## 3. Webサービスの作成

### 3-1. 新規サービス作成

1. ダッシュボード右上の **「+ New」** → **「Web Service」** をクリック
2. **「Build and deploy from a Git repository」** を選択 → **「Connect」**

### 3-2. GitHubリポジトリの接続

1. **「Connect GitHub」** をクリック
2. GitHubで認証 → `Listfile_upload` リポジトリを選択
3. **「Connect」** をクリック

### 3-3. サービス設定

以下の内容を入力します：

| 項目 | 設定値 |
|------|--------|
| Name | `listfile-upload` |
| Region | `Singapore` （日本に最も近い） |
| Branch | `main` |
| Runtime | `Node` |
| Build Command | `npm install && npm run build` |
| Start Command | `npm run start` |
| Plan | `Free`（または `Starter` 以上） |

> **※ render.yaml がリポジトリにある場合、設定は自動読み込みされます**

---

## 4. 環境変数の設定

**「Advanced」** セクションの **「Add Environment Variable」** から以下を追加します。

| キー | 値 |
|------|-----|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `postgresql://listfile_user:...@skiing-burro-16418.jxf.gcp-asia-southeast1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full` |
| `JWT_SECRET` | `csv-upload-secret-2026-xK9mP2vL8nQ5wZ` |
| `NEXT_PUBLIC_API_URL` | `https://listfile-upload.onrender.com` ※デプロイ後に確定するURLに変更 |

> **⚠️ `DATABASE_URL` と `JWT_SECRET` はシークレット値です。**
> Renderの **「Secret File」** または **「Environment Variable（シークレット）」** として登録してください。

---

## 5. デプロイ実行

1. **「Create Web Service」** ボタンをクリック
2. ビルドログが表示されます。以下の流れで進みます：

```
==> Running build command 'npm install && npm run build'
...
✓ Compiled successfully
✓ Generating static pages (41/41)
Build Completed

==> Starting service with 'npm run start'
- ready started server on 0.0.0.0:PORT
```

3. ステータスが **「Live」** になれば完了です

---

## 6. デプロイ後の動作確認

### 6-1. アクセス確認

RenderのダッシュボードでURLを確認します（例: `https://listfile-upload.onrender.com`）

### 6-2. 動作確認チェックリスト

```
□ ログインページが表示される
□ managerアカウントでログインできる
□ ダッシュボードが表示される
□ アップロード機能が動作する
□ エクスポートページが表示される（managerのみ）
□ レポートページが表示される（managerのみ）
□ アサイン履歴が参照できる
```

### 6-3. DB接続の確認

ログイン成功 = CockroachDBへの接続成功です。
失敗する場合は環境変数 `DATABASE_URL` を再確認してください。

---

## 7. NEXT_PUBLIC_API_URL の更新

デプロイ後、RenderのURLが確定したら環境変数を更新します：

1. Renderダッシュボード → サービス → **「Environment」**
2. `NEXT_PUBLIC_API_URL` を `https://listfile-upload.onrender.com` に更新
3. **「Save Changes」** → 自動的に再デプロイされます

---

## 8. 無料プランの注意事項

| 項目 | 内容 |
|------|------|
| スリープ | 15分間アクセスがないと停止 |
| コールドスタート | 次のアクセス時に30〜60秒かかる |
| 解決策 | Starterプラン（$7/月）に変更するとスリープなし |

業務利用の場合は **Starterプラン以上** を推奨します。

---

## 9. Vercel から Render への完全切り替え

動作確認が完了したら：

1. Renderの本番URLを関係者に共有
2. Vercelのプロジェクトを削除（任意）
3. DNSでカスタムドメインを使っている場合はRenderの **「Custom Domain」** で設定

---

## トラブルシューティング

### ビルドエラー: `Type error`

```
原因: TypeScriptの型エラー
対処: ローカルで `npm run build` を実行して事前確認
```

### 起動エラー: `DATABASE_URL が設定されていません`

```
原因: 環境変数が未設定
対処: Renderダッシュボードで DATABASE_URL を確認・再設定
```

### ログイン後に白画面

```
原因: NEXT_PUBLIC_API_URL が localhost のまま
対処: Render の URL に更新して再デプロイ
```

### DB接続エラー: SSL certificate

```
原因: CockroachDB の sslmode=verify-full が失敗
対処: DATABASE_URL に ?sslmode=require を試す
      または CockroachDB ダッシュボードで接続元IPを確認
```
