import { cookies } from 'next/headers';

import { AccountBar } from '@/components/AccountBar';
import { ConfirmDeleteProvider } from '@/components/ConfirmDeleteDialog';
import { Sidebar } from '@/components/Sidebar';
import { AUTH_COOKIE } from '@/lib/constants';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  const isGuest = !token;

  return (
    <ConfirmDeleteProvider>
      <div className="flex min-h-screen">
        <Sidebar isGuest={isGuest} />
        <div className="flex min-w-0 flex-1 flex-col">
          <AccountBar isGuest={isGuest} />
          <main className="flex-1 overflow-x-hidden bg-surface-muted p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </ConfirmDeleteProvider>
  );
}