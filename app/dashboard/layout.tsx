import Sidebar from "@/app/components/Sidebar";
import { UploadProgressProvider } from "@/app/contexts/upload-progress";
import UploadProgressToast from "@/app/components/UploadProgressToast";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UploadProgressProvider>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        {/* ml-56 = サイドバー幅(224px)分のオフセット */}
        <main className="flex-1 ml-56 min-w-0">
          {children}
        </main>
      </div>
      <UploadProgressToast />
    </UploadProgressProvider>
  );
}
