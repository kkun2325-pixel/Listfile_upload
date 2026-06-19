"use client";

import { useUploadProgress } from "@/app/contexts/upload-progress";

export default function UploadProgressToast() {
  const { progress } = useUploadProgress();
  if (!progress) return null;

  const pct = progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <div className="fixed bottom-5 left-5 z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-4 w-72 transition-all">
      {progress.done ? (
        /* 完了状態 */
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 shrink-0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4 text-green-600">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">取込完了</p>
            <p className="text-xs text-gray-500 truncate">{progress.filename}</p>
            <p className="text-xs font-mono text-green-700 mt-0.5">
              {progress.current.toLocaleString()} 件取込済
            </p>
          </div>
        </div>
      ) : (
        /* 進行中状態 */
        <>
          <div className="flex items-center gap-2 mb-2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-200 border-t-blue-600 shrink-0" />
            <span className="text-sm font-semibold text-gray-800">取込中...</span>
            <span className="ml-auto text-xs text-gray-400 font-mono">{pct}%</span>
          </div>
          <p className="text-xs text-gray-400 truncate mb-2">{progress.filename}</p>
          <div className="w-full bg-gray-100 rounded-full h-1.5 mb-1.5">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-300 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs font-mono text-gray-600">
            <span className="text-blue-700 font-semibold">{progress.current.toLocaleString()}</span>
            {" 件 / "}
            <span>{progress.total.toLocaleString()}</span>
            {" 件中取込済"}
          </p>
        </>
      )}
    </div>
  );
}