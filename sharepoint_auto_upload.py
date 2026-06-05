"""
SharePoint → csv-upload-app 自動アップロードスクリプト
------------------------------------------------------
毎日実行してSharePointのExcelファイルをCSVに変換し、アプリにアップロードします。

必要なライブラリのインストール:
    pip install msal requests openpyxl pandas python-dotenv

設定:
    .env.upload ファイルに認証情報を記載してください（.env.upload.example 参照）
"""

import os
import io
import csv
import sys
import json
import logging
import tempfile
from datetime import date
from pathlib import Path

import requests
import pandas as pd
from msal import ConfidentialClientApplication
from dotenv import load_dotenv

# ── ログ設定 ──────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("sharepoint_upload.log", encoding="utf-8"),
    ],
)
log = logging.getLogger(__name__)

# ── 設定読み込み ──────────────────────────────────────────────
load_dotenv(".env.upload")

# Azure AD / Microsoft Graph
TENANT_ID     = os.environ["AZURE_TENANT_ID"]
CLIENT_ID     = os.environ["AZURE_CLIENT_ID"]
CLIENT_SECRET = os.environ["AZURE_CLIENT_SECRET"]

# SharePoint ファイル情報
SHAREPOINT_SITE_ID = os.environ["SHAREPOINT_SITE_ID"]   # sites/{site-id}
SHAREPOINT_FILE_ID = os.environ.get("SHAREPOINT_FILE_ID", "")   # item id (推奨)
SHAREPOINT_FILE_PATH = os.environ.get("SHAREPOINT_FILE_PATH", "")  # 例: /sites/xxx/Shared Documents/data.xlsx

# csv-upload-app 設定
APP_URL       = os.environ["APP_URL"].rstrip("/")   # 例: https://your-app.vercel.app
APP_USERNAME  = os.environ["APP_USERNAME"]
APP_PASSWORD  = os.environ["APP_PASSWORD"]

# アップロード設定（任意）
WORKER_NAME  = os.environ.get("UPLOAD_WORKER_NAME", "")
TEAM_NAME    = os.environ.get("UPLOAD_TEAM_NAME", "")
WORK_HOURS   = float(os.environ.get("UPLOAD_WORK_HOURS", "0") or 0)

# Excel シート設定
EXCEL_SHEET_NAME = os.environ.get("EXCEL_SHEET_NAME", "")  # 空欄=最初のシート
EXCEL_HEADER_ROW = int(os.environ.get("EXCEL_HEADER_ROW", "1"))  # ヘッダー行番号(1始まり)


# ── Step 1: Microsoft Graph アクセストークン取得 ───────────────
def get_graph_token() -> str:
    log.info("Microsoft Graph トークンを取得中...")
    app = ConfidentialClientApplication(
        CLIENT_ID,
        authority=f"https://login.microsoftonline.com/{TENANT_ID}",
        client_credential=CLIENT_SECRET,
    )
    result = app.acquire_token_for_client(scopes=["https://graph.microsoft.com/.default"])
    if "access_token" not in result:
        raise RuntimeError(f"トークン取得失敗: {result.get('error_description', result)}")
    log.info("トークン取得成功")
    return result["access_token"]


# ── Step 2: SharePoint から Excel をダウンロード ──────────────
def download_excel(token: str) -> bytes:
    headers = {"Authorization": f"Bearer {token}"}

    if SHAREPOINT_FILE_ID:
        # ファイルIDで直接取得（推奨・高速）
        url = f"https://graph.microsoft.com/v1.0/sites/{SHAREPOINT_SITE_ID}/drive/items/{SHAREPOINT_FILE_ID}/content"
    elif SHAREPOINT_FILE_PATH:
        # パスで取得
        encoded = requests.utils.quote(SHAREPOINT_FILE_PATH)
        url = f"https://graph.microsoft.com/v1.0/sites/{SHAREPOINT_SITE_ID}/drive/root:{encoded}:/content"
    else:
        raise ValueError("SHAREPOINT_FILE_ID または SHAREPOINT_FILE_PATH を設定してください")

    log.info(f"SharePoint からダウンロード中: {url}")
    res = requests.get(url, headers=headers, timeout=60)
    res.raise_for_status()
    log.info(f"ダウンロード完了: {len(res.content):,} bytes")
    return res.content


# ── Step 3: Excel → CSV 変換 ──────────────────────────────────
def excel_to_csv(excel_bytes: bytes) -> tuple[str, int]:
    """(csv_string, row_count) を返す"""
    log.info("Excel → CSV 変換中...")
    sheet = EXCEL_SHEET_NAME if EXCEL_SHEET_NAME else 0
    header_row = EXCEL_HEADER_ROW - 1  # 0始まりに変換

    df = pd.read_excel(
        io.BytesIO(excel_bytes),
        sheet_name=sheet,
        header=header_row,
        dtype=str,
    )

    # 完全に空の行を除去
    df.dropna(how="all", inplace=True)
    df.fillna("", inplace=True)

    buf = io.StringIO()
    df.to_csv(buf, index=False, encoding="utf-8-sig")
    csv_str = buf.getvalue()

    log.info(f"変換完了: {len(df)} 行")
    return csv_str, len(df)


# ── Step 4: アプリにログインしてJWTトークン取得 ───────────────
def app_login() -> str:
    log.info(f"アプリにログイン中: {APP_URL}")
    res = requests.post(
        f"{APP_URL}/api/auth/login",
        json={"username": APP_USERNAME, "password": APP_PASSWORD},
        timeout=30,
    )
    res.raise_for_status()
    data = res.json()
    if not data.get("success"):
        raise RuntimeError(f"ログイン失敗: {data.get('message')}")
    log.info("ログイン成功")
    return data["token"]


# ── Step 5: CSVをアプリにアップロード ────────────────────────
def upload_csv(jwt_token: str, csv_str: str, filename: str) -> dict:
    log.info("CSVをアプリにアップロード中...")
    headers = {
        "Authorization": f"Bearer {jwt_token}",
        "Content-Type": "application/octet-stream",
    }

    # FormData形式でアップロード
    files = {
        "file": (filename, csv_str.encode("utf-8-sig"), "text/csv"),
    }
    data = {
        "report_date": date.today().isoformat(),
    }
    if WORKER_NAME:
        data["worker_name"] = WORKER_NAME
    if TEAM_NAME:
        data["team_name"] = TEAM_NAME
    if WORK_HOURS:
        data["work_hours"] = str(WORK_HOURS)

    res = requests.post(
        f"{APP_URL}/api/upload",
        headers={"Authorization": f"Bearer {jwt_token}"},
        files=files,
        data=data,
        timeout=120,
    )
    res.raise_for_status()
    result = res.json()
    log.info(f"アップロード結果: {result}")
    return result


# ── メイン ────────────────────────────────────────────────────
def main():
    log.info("=== SharePoint 自動アップロード 開始 ===")
    try:
        # 1. Graph トークン
        graph_token = get_graph_token()

        # 2. Excelダウンロード
        excel_bytes = download_excel(graph_token)

        # 3. CSV変換
        today_str = date.today().strftime("%Y%m%d")
        filename  = f"sharepoint_auto_{today_str}.csv"
        csv_str, row_count = excel_to_csv(excel_bytes)

        # 4. アプリログイン
        jwt_token = app_login()

        # 5. アップロード
        result = upload_csv(jwt_token, csv_str, filename)

        log.info(f"=== 完了: {row_count}行, 新規{result.get('inserted_count',0)}件, 更新{result.get('updated_count',0)}件 ===")

    except Exception as e:
        log.error(f"エラーが発生しました: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
