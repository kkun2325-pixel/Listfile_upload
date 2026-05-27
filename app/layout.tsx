import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CSV Upload Manager",
  description: "複数人でCSVファイルをアップロード・管理するアプリケーション",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="bg-gray-50">
        {children}
      </body>
    </html>
  );
}
