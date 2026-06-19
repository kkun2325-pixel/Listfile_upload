"use client";

import { createContext, useContext, useRef, useState } from "react";

interface UploadProgressState {
  current: number;
  total: number;
  filename: string;
  done: boolean;
}

interface UploadProgressCtx {
  progress: UploadProgressState | null;
  startProgress: (total: number, filename: string) => void;
  updateProgress: (current: number) => void;
  finishProgress: () => void;
}

const UploadProgressContext = createContext<UploadProgressCtx>({
  progress: null,
  startProgress: () => {},
  updateProgress: () => {},
  finishProgress: () => {},
});

export function UploadProgressProvider({ children }: { children: React.ReactNode }) {
  const [progress, setProgress] = useState<UploadProgressState | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function startProgress(total: number, filename: string) {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    setProgress({ current: 0, total, filename, done: false });
  }

  function updateProgress(current: number) {
    setProgress(prev => prev ? { ...prev, current } : null);
  }

  function finishProgress() {
    setProgress(prev => prev ? { ...prev, done: true } : null);
    dismissTimer.current = setTimeout(() => setProgress(null), 4000);
  }

  return (
    <UploadProgressContext.Provider value={{ progress, startProgress, updateProgress, finishProgress }}>
      {children}
    </UploadProgressContext.Provider>
  );
}

export function useUploadProgress() {
  return useContext(UploadProgressContext);
}