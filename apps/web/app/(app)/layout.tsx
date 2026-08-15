import { AccountBar } from '@/components/AccountBar';
import { Sidebar } from '@/components/Sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AccountBar />
        <main className="flex-1 overflow-x-hidden bg-surface-muted p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
