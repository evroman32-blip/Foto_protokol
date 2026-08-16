'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useCurrentUser } from '@/lib/use-current-user';

function initials(lastName?: string, firstName?: string) {
  const a = lastName?.trim()?.[0] ?? '';
  const b = firstName?.trim()?.[0] ?? '';
  return (a + b).toUpperCase() || '•';
}

function GuestAccountBar() {
  const pathname = usePathname();
  const from = encodeURIComponent(pathname || '/home');

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-white px-4 py-2 lg:px-8">
      <div className="flex items-center gap-2">
        <Link
          href={`/login?from=${from}`}
          className="btn-secondary h-10 !text-graphite hover:!text-graphite"
        >
          Вход
        </Link>
        <Link href="/register" className="btn-primary h-10 !text-white hover:!text-white">
          Регистрация
        </Link>
      </div>
      <div
        className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white shadow-sm ring-2 ring-white"
        aria-hidden
        title="Клиника Мандарин"
      >
        М
      </div>
    </header>
  );
}

export function AccountBar({ isGuest = false }: { isGuest?: boolean }) {
  const { user, loading } = useCurrentUser();

  if (!user) {
    if (isGuest || !loading) return <GuestAccountBar />;
    return <div className="h-14 shrink-0 border-b border-border bg-white" />;
  }

  const fio = [user.lastName, user.firstName].filter(Boolean).join(' ') || user.email;
  const color = user.accentColor || '#e85d04';
  const pending = user.accountStatus === 'PENDING';

  return (
    <header className="flex shrink-0 items-center justify-end gap-3 border-b border-border bg-white px-4 py-2 lg:px-8">
      {pending ? (
        <span className="mr-auto text-xs text-status-warning">
          Права «{user.requestedRoleLabel ?? user.requestedRole}» ожидают подтверждения. Сейчас
          доступен только просмотр.
        </span>
      ) : (
        <span className="mr-auto" />
      )}
      <div className="text-right">
        <div className="text-sm font-medium text-graphite">{fio}</div>
        <div className="text-xs text-gray-500">{user.roleLabel}</div>
      </div>
      <Link
        href="/profile"
        title="Настройки аккаунта"
        className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white shadow-sm ring-2 ring-white"
        style={{ backgroundColor: color }}
      >
        {initials(user.lastName, user.firstName)}
      </Link>
    </header>
  );
}
