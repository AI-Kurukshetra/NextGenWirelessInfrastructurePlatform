import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export function AppShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="h-screen bg-slate-50">
      <div className="mx-auto flex h-screen min-h-0 max-w-[1600px] items-stretch overflow-hidden">
        <Sidebar />
        <main className="min-h-0 flex-1 overflow-y-auto p-6">
          <Topbar title={title} />
          {children}
        </main>
      </div>
    </div>
  );
}
