import Sidebar from "@/app/components/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      {/* ml-56 = サイドバー幅(224px)分のオフセット */}
      <main className="flex-1 ml-56 min-w-0">
        {children}
      </main>
    </div>
  );
}
