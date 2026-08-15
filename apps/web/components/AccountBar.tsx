'use client';

import Link from 'next/link';

import { useCurrentUser } from '@/lib/use-current-user';

function initials(lastName?: string, firstName?: string) {
  const a = lastName?.trim()?.[0] ?? '';
  const b = firstName?.trim()?.[0] ?? '';
  return (a + b).toUpperCase() || '•';
}

export function AccountBar() {
  const { user, loading } = useCurrentUser();

  if (loading || !user) {
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
