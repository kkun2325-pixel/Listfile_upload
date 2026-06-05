/**
 * SharePoint / Microsoft Graph API 連携ライブラリ
 * サーバーサイド専用（Node.js / Next.js API Route から呼び出す）
 */

import * as XLSX from "xlsx";

// ── Graph API トークン取得 ────────────────────────────────────
export async function getGraphToken(): Promise<string> {
  const tenantId     = process.env.AZURE_TENANT_ID;
  const clientId     = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      "Azure AD 認証情報が未設定です。AZURE_TENANT_ID / AZURE_CLIENT_ID / AZURE_CLIENT_SECRET を .env.local に追加してください。"
    );
  }

  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type:    "client_credentials",
    client_id:     clientId,
    client_secret: clientSecret,
    scope:         "https://graph.microsoft.com/.default",
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph トークン取得失敗 (${res.status}): ${text}`);
  }

  const data = await res.json() as { access_token?: string; error_description?: string };
  if (!data.access_token) {
    throw new Error(`トークンなし: ${data.error_description ?? JSON.stringify(data)}`);
  }
  return data.access_token;
}

// ── SharePoint Excel ダウンロード ─────────────────────────────
export async function downloadSharePointFile(
  token: string,
  siteId: string,
  fileId?: string,
  filePath?: string,
): Promise<ArrayBuffer> {
  let url: string;

  if (fileId) {
    url = `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/items/${fileId}/content`;
  } else if (filePath) {
    url = `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:${filePath}:/content`;
  } else {
    throw new Error("file_id または file_path が必要です");
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ダウンロード失敗 (${res.status}): ${text.slice(0, 200)}`);
  }

  return res.arrayBuffer();
}

// ── Excel → CSV行データ変換 ───────────────────────────────────
export interface ParsedSheetResult {
  headers: string[];
  rows: Record<string, string>[];
  rowCount: number;
}

export function parseExcelToRows(
  buffer: ArrayBuffer,
  sheetName?: string,
  headerRow = 1,
): ParsedSheetResult {
  const workbook = XLSX.read(buffer, { type: "array" });

  const sheet = sheetName
    ? workbook.Sheets[sheetName]
    : workbook.Sheets[workbook.SheetNames[0]];

  if (!sheet) {
    throw new Error(`シート "${sheetName ?? workbook.SheetNames[0]}" が見つかりません`);
  }

  // header: headerRow番目を使う（0ベース）
  const jsonRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
  });

  if (jsonRows.length < headerRow) {
    return { headers: [], rows: [], rowCount: 0 };
  }

  const headers = (jsonRows[headerRow - 1] as string[]).map(h => String(h ?? "").trim());

  const rows: Record<string, string>[] = [];
  for (let i = headerRow; i < jsonRows.length; i++) {
    const rawRow = jsonRows[i] as unknown[];
    // 全て空の行をスキップ
    if (rawRow.every(cell => cell === "" || cell === null || cell === undefined)) continue;

    const obj: Record<string, string> = {};
    headers.forEach((header, idx) => {
      if (header) obj[header] = String(rawRow[idx] ?? "");
    });
    rows.push(obj);
  }

  return { headers, rows, rowCount: rows.length };
}

// ── ファイルの最終更新日時を取得 ─────────────────────────────
export async function getSharePointFileMetadata(
  token: string,
  siteId: string,
  fileId?: string,
  filePath?: string,
): Promise<{ lastModifiedDateTime: string; name: string; size: number }> {
  let url: string;

  if (fileId) {
    url = `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/items/${fileId}`;
  } else if (filePath) {
    url = `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:${filePath}`;
  } else {
    throw new Error("file_id または file_path が必要です");
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`メタデータ取得失敗 (${res.status})`);
  }

  const data = await res.json() as {
    lastModifiedDateTime: string;
    name: string;
    size: number;
  };
  return data;
}
