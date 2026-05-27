"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

interface Rule {
  field: string;
  operator: "equals" | "contains" | "starts_with" | "greater_than" | "less_than";
  value: string;
}

export default function ExportPage() {
  const router = useRouter();
  const params = useParams();
  const uploadId = params.id as string;
  const [rules, setRules] = useState<Rule[]>([]);
  const [uploadInfo, setUploadInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      router.push("/login");
      return;
    }

    fetchUploadInfo(token);
  }, [router, uploadId]);

  async function fetchUploadInfo(token: string) {
    try {
      const response = await fetch("/api/uploads", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/login");
        }
        return;
      }

      const result = await response.json();
      const upload = result.uploads?.find((u: any) => u.id === uploadId);
      setUploadInfo(upload);
    } catch (err) {
      console.error("Error fetching upload info:", err);
    } finally {
      setLoading(false);
    }
  }

  function addRule() {
    setRules([
      ...rules,
      { field: "", operator: "equals", value: "" },
    ]);
  }

  function removeRule(index: number) {
    setRules(rules.filter((_, i) => i !== index));
  }

  function updateRule(index: number, key: keyof Rule, value: any) {
    const updated = [...rules];
    updated[index][key] = value;
    setRules(updated);
  }

  async function handleExport(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setExporting(true);

    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          upload_id: uploadId,
          rules: rules.filter((r) => r.field && r.value),
        }),
      });

      if (!response.ok) {
        setError("エクスポートに失敗しました");
        return;
      }

      // Download CSV
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `export_${uploadId}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError("エクスポート処理中にエラーが発生しました");
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="container flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600 py-4">
            CSV Upload Manager
          </h1>
          <Link href="/dashboard" className="btn btn-secondary">
            ← ダッシュボードに戻る
          </Link>
        </div>
      </nav>

      <div className="container">
        <h2 className="text-3xl font-bold text-gray-800 mb-6">
          エクスポート：{uploadInfo?.original_filename}
        </h2>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Info Card */}
          <div className="card">
            <h3 className="font-bold mb-4">ファイル情報</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-600">ファイル名</p>
                <p className="font-medium">{uploadInfo?.original_filename}</p>
              </div>
              <div>
                <p className="text-gray-600">行数</p>
                <p className="font-medium">{uploadInfo?.row_count}</p>
              </div>
              <div>
                <p className="text-gray-600">重複数</p>
                <p className="font-medium">{uploadInfo?.duplicate_count}</p>
              </div>
            </div>
          </div>

          {/* Filter Form */}
          <div className="md:col-span-2">
            <div className="card">
              <h3 className="text-xl font-bold text-gray-800 mb-6">
                セグメント分割条件
              </h3>

              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                  {error}
                </div>
              )}

              <form onSubmit={handleExport}>
                {rules.length === 0 ? (
                  <p className="text-gray-600 py-4 text-center">
                    条件が設定されていません（全データがエクスポートされます）
                  </p>
                ) : (
                  <div className="space-y-4 mb-6">
                    {rules.map((rule, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          placeholder="フィールド名"
                          value={rule.field}
                          onChange={(e) =>
                            updateRule(index, "field", e.target.value)
                          }
                          className="input-field flex-1"
                        />
                        <select
                          value={rule.operator}
                          onChange={(e) =>
                            updateRule(
                              index,
                              "operator",
                              e.target.value as Rule["operator"]
                            )
                          }
                          className="input-field"
                        >
                          <option value="equals">等しい</option>
                          <option value="contains">含む</option>
                          <option value="starts_with">始まる</option>
                          <option value="greater_than">&gt;</option>
                          <option value="less_than">&lt;</option>
                        </select>
                        <input
                          type="text"
                          placeholder="値"
                          value={rule.value}
                          onChange={(e) =>
                            updateRule(index, "value", e.target.value)
                          }
                          className="input-field flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => removeRule(index)}
                          className="btn btn-danger"
                        >
                          削除
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={addRule}
                    className="btn btn-secondary"
                  >
                    + 条件を追加
                  </button>
                  <button
                    type="submit"
                    disabled={exporting}
                    className="btn btn-primary disabled:opacity-50"
                  >
                    {exporting ? "エクスポート中..." : "📥 エクスポート"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <div className="mt-6 card">
          <h4 className="font-bold mb-2">使い方</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• 条件を追加して、データをフィルタリングできます</li>
            <li>• フィールド名は CSV の列名を指定してください</li>
            <li>• 複数の条件を追加すると、すべての条件に該当するデータが抽出されます</li>
            <li>• 条件を指定しない場合は全データがエクスポートされます</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
