"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface SharepointFile {
  id: string;
  name: string;
  sharepoint_site_id: string;
  sharepoint_file_id: string | null;
  sharepoint_file_path: string | null;
  sharepoint_url: string | null;
  last_synced_at: string | null;
  last_sync_status: "never" | "success" | "error";
  last_sync_message: string | null;
  auto_sync_enabled: number;
  created_at: string;
}

const emptyForm = {
  name: "",
  sharepoint_site_id: "",
  sharepoint_file_id: "",
  sharepoint_file_path: "",
  sharepoint_url: "",
  auto_sync_enabled: 1,
};

function StatusBadge({ status }: { status: "never" | "success" | "error" }) {
  if (status === "success") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
      同期済み
    </span>
  );
  if (status === "error") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
      エラー
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" />
      未同期
    </span>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" }) +
    " " + d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

export default function SharepointPage() {
  const router = useRouter();
  const [files, setFiles] = useState<SharepointFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // モーダル状態
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<SharepointFile | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // 同期状態
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{ id: string; message: string; success: boolean } | null>(null);

  // 削除確認
  const [deleteTarget, setDeleteTarget] = useState<SharepointFile | null>(null);
  const [deleting, setDeleting] = useState(false);

  const getToken = () => localStorage.getItem("auth_token") ?? "";

  const fetchFiles = useCallback(async () => {
    const token = getToken();
    if (!token) { router.push("/login"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/sharepoint-files", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json() as { success: boolean; files?: SharepointFile[]; message?: string };
      if (!data.success) { setError(data.message ?? "取得失敗"); return; }
      setFiles(data.files ?? []);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  // モーダルを開く
  function openAdd() {
    setEditTarget(null);
    setForm(emptyForm);
    setFormError("");
    setShowModal(true);
  }
  function openEdit(file: SharepointFile) {
    setEditTarget(file);
    setForm({
      name: file.name,
      sharepoint_site_id: file.sharepoint_site_id,
      sharepoint_file_id: file.sharepoint_file_id ?? "",
      sharepoint_file_path: file.sharepoint_file_path ?? "",
      sharepoint_url: file.sharepoint_url ?? "",
      auto_sync_enabled: file.auto_sync_enabled,
    });
    setFormError("");
    setShowModal(true);
  }

  async function handleSave() {
    setFormError("");
    if (!form.name.trim()) { setFormError("表示名を入力してください"); return; }
    if (!form.sharepoint_site_id.trim()) { setFormError("サイトIDを入力してください"); return; }
    if (!form.sharepoint_file_id.trim() && !form.sharepoint_file_path.trim()) {
      setFormError("ファイルIDまたはファイルパスのどちらかを入力してください"); return;
    }

    setSaving(true);
    const token = getToken();
    try {
      const url    = editTarget ? `/api/sharepoint-files/${editTarget.id}` : "/api/sharepoint-files";
      const method = editTarget ? "PUT" : "POST";
      const res    = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json() as { success: boolean; message?: string };
      if (!data.success) { setFormError(data.message ?? "保存失敗"); return; }
      setShowModal(false);
      await fetchFiles();
    } catch {
      setFormError("通信エラーが発生しました");
    } finally {
      setSaving(false);
    }
  }

  async function handleSync(file: SharepointFile) {
    setSyncingId(file.id);
    setSyncResult(null);
    const token = getToken();
    try {
      const res  = await fetch(`/api/sharepoint-files/${file.id}/sync`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json() as { success: boolean; message?: string };
      setSyncResult({ id: file.id, success: data.success, message: data.message ?? "" });
      await fetchFiles();
    } catch (e) {
      setSyncResult({ id: file.id, success: false, message: String(e) });
    } finally {
      setSyncingId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const token = getToken();
    try {
      await fetch(`/api/sharepoint-files/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setDeleteTarget(null);
      await fetchFiles();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="p-8">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SharePoint連携</h1>
          <p className="text-sm text-gray-500 mt-1">
            オンラインExcelを登録して毎日19時に自動取込 · 現在 {files.length} 件登録
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
          </svg>
          ファイルを追加
        </button>
      </div>

      {/* Azure未設定バナー */}
      {!process.env.NEXT_PUBLIC_AZURE_CONFIGURED && (
        <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex gap-3 items-start">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-amber-500 shrink-0 mt-0.5">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
          </svg>
          <div>
            <p className="text-sm font-semibold text-amber-800">Azure AD 認証情報が未設定です</p>
            <p className="text-xs text-amber-700 mt-0.5">
              ファイルの登録はできますが、同期を実行するには <code className="bg-amber-100 px-1 rounded">.env.local</code> に
              <code className="bg-amber-100 px-1 rounded ml-1">AZURE_TENANT_ID</code>、
              <code className="bg-amber-100 px-1 rounded ml-1">AZURE_CLIENT_ID</code>、
              <code className="bg-amber-100 px-1 rounded ml-1">AZURE_CLIENT_SECRET</code> を追加してください。
            </p>
          </div>
        </div>
      )}

      {/* エラー */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {/* 同期結果トースト */}
      {syncResult && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm border flex items-center justify-between ${
          syncResult.success
            ? "bg-green-50 border-green-200 text-green-700"
            : "bg-red-50 border-red-200 text-red-700"
        }`}>
          <span>{syncResult.success ? "✓ 同期完了: " : "✗ 同期失敗: "}{syncResult.message}</span>
          <button onClick={() => setSyncResult(null)} className="ml-4 opacity-60 hover:opacity-100 text-lg leading-none">×</button>
        </div>
      )}

      {/* ローディング */}
      {loading ? (
        <div className="flex items-center justify-center min-h-60">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
        </div>
      ) : files.length === 0 ? (
        /* 空状態 */
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-16 text-center">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7 text-gray-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm font-medium mb-1">SharePoint Excelが未登録です</p>
          <p className="text-gray-400 text-xs mb-5">「ファイルを追加」からオンラインExcelを登録してください</p>
          <button
            onClick={openAdd}
            className="px-5 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
          >
            最初のファイルを追加
          </button>
        </div>
      ) : (
        /* ファイル一覧カード */
        <div className="grid gap-3">
          {files.map(file => (
            <div
              key={file.id}
              className={`bg-white rounded-xl border p-5 flex items-center gap-5 transition-shadow hover:shadow-sm ${
                file.last_sync_status === "error" ? "border-red-200" : "border-gray-200"
              }`}
            >
              {/* アイコン */}
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                file.last_sync_status === "success" ? "bg-green-50" :
                file.last_sync_status === "error"   ? "bg-red-50"   : "bg-gray-100"
              }`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
                  className={`w-5 h-5 ${
                    file.last_sync_status === "success" ? "text-green-600" :
                    file.last_sync_status === "error"   ? "text-red-500"   : "text-gray-400"
                  }`}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c-.621 0-1.125.504-1.125 1.125v1.5m2.25-2.625h7.5m-7.5 0A1.125 1.125 0 0110.875 12v1.5m0 0c0 .621.504 1.125 1.125 1.125m0 0h7.5" />
                </svg>
              </div>

              {/* ファイル情報 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-gray-900 truncate">{file.name}</span>
                  <StatusBadge status={file.last_sync_status} />
                  {file.auto_sync_enabled === 0 && (
                    <span className="px-1.5 py-0.5 text-xs rounded bg-gray-100 text-gray-400">自動同期OFF</span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span>最終更新: {formatDate(file.last_synced_at)}</span>
                  {file.last_sync_message && file.last_sync_status !== "never" && (
                    <span className={`truncate max-w-xs ${file.last_sync_status === "error" ? "text-red-500" : ""}`}>
                      {file.last_sync_message}
                    </span>
                  )}
                </div>

                {/* SharePoint URL リンク */}
                {file.sharepoint_url && (
                  <a
                    href={file.sharepoint_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-500 hover:underline mt-0.5 inline-block"
                  >
                    SharePointで開く →
                  </a>
                )}
              </div>

              {/* アクションボタン */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleSync(file)}
                  disabled={syncingId === file.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
                >
                  {syncingId === file.id ? (
                    <>
                      <span className="inline-block w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                      同期中...
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-gray-500">
                        <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z" clipRule="evenodd" />
                      </svg>
                      今すぐ同期
                    </>
                  )}
                </button>

                <button
                  onClick={() => openEdit(file)}
                  className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  編集
                </button>

                <button
                  onClick={() => setDeleteTarget(file)}
                  className="px-3 py-1.5 text-xs font-medium border border-red-100 text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 説明フッター */}
      <div className="mt-6 bg-gray-50 rounded-xl border border-gray-200 px-5 py-4">
        <p className="text-xs font-semibold text-gray-600 mb-2">⏰ 自動同期スケジュール</p>
        <p className="text-xs text-gray-500">
          自動同期が有効なファイルは毎日 <strong>19:00（JST）</strong> に自動でSharePointから取得されます。
          「今すぐ同期」ボタンで手動実行も可能です。
          同期結果はステータスバッジで確認できます。
        </p>
      </div>

      {/* ── 追加/編集モーダル ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-7">
            <h2 className="text-lg font-bold text-gray-900 mb-5">
              {editTarget ? "ファイルを編集" : "SharePoint Excelを追加"}
            </h2>

            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg mb-4 text-sm">
                {formError}
              </div>
            )}

            <div className="space-y-4">
              {/* 表示名 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  表示名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="例: 精査リスト＿型"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              {/* SharePoint URL（表示用・オプション） */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SharePoint URL <span className="text-gray-400 font-normal text-xs">（表示用・任意）</span>
                </label>
                <input
                  type="url"
                  value={form.sharepoint_url}
                  onChange={e => setForm(f => ({ ...f, sharepoint_url: e.target.value }))}
                  placeholder="https://your-tenant.sharepoint.com/..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              {/* サイトID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  サイトID <span className="text-red-500">*</span>
                  <a
                    href="https://developer.microsoft.com/ja-jp/graph/graph-explorer"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-xs text-indigo-500 hover:underline font-normal"
                  >
                    Graph Explorerで確認 →
                  </a>
                </label>
                <input
                  type="text"
                  value={form.sharepoint_site_id}
                  onChange={e => setForm(f => ({ ...f, sharepoint_site_id: e.target.value }))}
                  placeholder="your-tenant.sharepoint.com,xxxxxx-...,xxxxxx-..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              {/* ファイルID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ファイルID <span className="text-gray-400 font-normal text-xs">（推奨）</span>
                </label>
                <input
                  type="text"
                  value={form.sharepoint_file_id}
                  onChange={e => setForm(f => ({ ...f, sharepoint_file_id: e.target.value }))}
                  placeholder="Graph Explorerのドライブアイテムのid"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              {/* ファイルパス（代替） */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ファイルパス <span className="text-gray-400 font-normal text-xs">（ファイルIDが不明な場合）</span>
                </label>
                <input
                  type="text"
                  value={form.sharepoint_file_path}
                  onChange={e => setForm(f => ({ ...f, sharepoint_file_path: e.target.value }))}
                  placeholder="/Shared Documents/データ/売上管理.xlsx"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              {/* 自動同期 */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-700">毎日19時に自動同期</p>
                  <p className="text-xs text-gray-400 mt-0.5">OFFにすると手動のみになります</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, auto_sync_enabled: f.auto_sync_enabled === 1 ? 0 : 1 }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    form.auto_sync_enabled === 1 ? "bg-gray-900" : "bg-gray-300"
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    form.auto_sync_enabled === 1 ? "translate-x-6" : "translate-x-1"
                  }`} />
                </button>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-sm rounded-lg hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-40 transition-colors"
              >
                {saving ? "保存中..." : editTarget ? "更新する" : "追加する"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 削除確認モーダル ── */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-7 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6 text-red-600">
                <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
              </svg>
            </div>
            <h2 className="text-base font-bold text-gray-900 mb-1">削除しますか？</h2>
            <p className="text-sm text-gray-500 mb-6">
              <span className="font-semibold">「{deleteTarget.name}」</span> を削除します。<br />
              この操作は取り消せません。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-sm rounded-lg hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-40 transition-colors"
              >
                {deleting ? "削除中..." : "削除する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
