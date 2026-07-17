'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { BRAND } from '@/lib/constants';
import { logout } from '@/lib/auth';

interface NavItem {
  href: string;
  label: string;
  prefix?: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    title: 'Клиника',
    items: [
      { href: '/dashboard', label: 'Панель управления' },
      { href: '/patients', label: 'Пациенты', prefix: '/patients' },
      { href: '/staff', label: 'Сотрудники', prefix: '/staff' },
      { href: '/cases/new', label: 'Новый случай', prefix: '/cases' },
    ],
  },
  {
    title: 'Управление',
    items: [
      { href: '/management', label: 'Обзор', prefix: '/management' },
      { href: '/management/audit', label: 'Аудит' },
      { href: '/management/emergency-events', label: 'Неотложные события' },
      { href: '/management/integration-events', label: 'Интеграции' },
      { href: '/management/reports', label: 'Отчёты' },
    ],
  },
  {
    title: 'Администрирование',
    items: [
      { href: '/admin/branches', label: 'Филиалы', prefix: '/admin/branches' },
      { href: '/admin/protocols', label: 'Протоколы', prefix: '/admin/protocols' },
      { href: '/admin/implant-placement-methods', label: 'Методы имплантации' },
      { href: '/admin/settings', label: 'Настройки' },
      { href: '/admin/yandex-ai', label: 'Yandex AI' },
      { href: '/admin/stoma1c', label: '1С:Стоматология' },
    ],
  },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.href === '/dashboard') return pathname === '/dashboard';
  const base = item.prefix ?? item.href;
  return pathname === item.href || pathname.startsWith(`${base}/`) || pathname.startsWith(base);
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-white">
      <div className="border-b border-border px-5 py-5">
        <div className="text-base font-semibold text-graphite">{BRAND.title}</div>
        <div className="mt-0.5 text-xs font-medium text-accent">{BRAND.subtitle}</div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV.map((group) => (
          <div key={group.title} className="mb-5">
            <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              {group.title}
            </div>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`block rounded px-2 py-2 text-sm transition ${
                        active
                          ? 'border-l-2 border-accent bg-accent-light font-medium text-accent'
                          : 'text-graphite hover:bg-surface-muted'
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-4">
        <button type="button" onClick={handleLogout} className="btn-secondary w-full">
          Выйти
        </button>
      </div>
    </aside>
  );
}
