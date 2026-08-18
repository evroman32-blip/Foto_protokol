'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { BrandPanel } from '@/components/BrandPanel';
import { CountSignal } from '@/components/CountSignal';
import { BRAND } from '@/lib/constants';
import { isModeratorRole } from '@mandarin/contracts';
import { usePendingAccountRequestCount } from '@/lib/pending-account-requests';
import { useCurrentUser } from '@/lib/use-current-user';

interface NavItem {
  href: string;
  label: string;
  prefix?: string;
  roles?: string[];
  hideForExpert?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
  hideForExpert?: boolean;
  moderatorOnly?: boolean;
}

const NAV: NavGroup[] = [
  {
    title: 'Клиника',
    items: [
      { href: '/home', label: 'Главная', prefix: '/home' },
      { href: '/dashboard', label: 'Панель управления' },
      { href: '/patients', label: 'Пациенты', prefix: '/patients' },
      { href: '/staff', label: 'Сотрудники', prefix: '/staff' },
      { href: '/cases/new', label: 'Новый случай', prefix: '/cases/new' },
    ],
  },
  {
    title: 'Полезная информация',
    items: [
      {
        href: '/info/strategic-implant',
        label: 'Описание метода Strategic Implant®',
        prefix: '/info/strategic-implant',
      },
      {
        href: '/info/principles',
        label: 'Базовые принципы Strategic Implant®',
        prefix: '/info/principles',
      },
      {
        href: '/info/photoprotocol',
        label: 'Логика PhotoProtocol & Strategic Implant®',
        prefix: '/info/photoprotocol',
      },
    ],
  },
  {
    title: 'Управление',
    moderatorOnly: true,
    items: [
      { href: '/management', label: 'Обзор', prefix: '/management' },
      { href: '/management/audit', label: 'Аудит' },
      { href: '/management/emergency-events', label: 'Неотложные события' },
      { href: '/management/integration-events', label: 'Интеграции' },
      { href: '/management/reports', label: 'Отчёты' },
    ],
  },
  {
    title: 'Модерация',
    moderatorOnly: true,
    items: [
      {
        href: '/admin/accounts',
        label: 'Заявки на доступ',
        roles: ['MODERATOR', 'CHIEF_DOCTOR'],
      },
      { href: '/admin/branches', label: 'Филиалы', prefix: '/admin/branches' },
      { href: '/admin/protocols', label: 'Протоколы', prefix: '/admin/protocols' },
      { href: '/admin/implant-placement-methods', label: 'Методы имплантации' },
      { href: '/admin/implant-types', label: 'Виды имплантатов' },
      { href: '/admin/settings', label: 'Настройки' },
      { href: '/admin/yandex-ai', label: 'Yandex AI' },
      { href: '/admin/stoma1c', label: '1С:Стоматология' },
    ],
  },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.href === '/dashboard') return pathname === '/dashboard';
  if (item.href === '/home') return pathname === '/home';
  const base = item.prefix ?? item.href;
  return pathname === item.href || pathname.startsWith(`${base}/`) || pathname.startsWith(base);
}

export function Sidebar({ isGuest = false }: { isGuest?: boolean }) {
  const pathname = usePathname();
  const { user, loading, role, canApproveAccounts, canCreateCase, isModerator, isExpert } =
    useCurrentUser();
  const pendingAccountRequests = usePendingAccountRequestCount(canApproveAccounts);

  if (!user && (isGuest || !loading)) {
    return <BrandPanel />;
  }

  if (!user && loading) {
    return <aside className="w-64 shrink-0 border-r border-border bg-white" />;
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-white">
      <div className="border-b border-border px-5 py-5">
        <div className="text-base font-semibold text-graphite">{BRAND.title}</div>
        <div className="mt-0.5 text-xs font-medium text-accent">{BRAND.subtitle}</div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV.map((group) => {
          if (group.moderatorOnly && !isModerator) return null;
          const items = group.items.filter((item) => {
            if (isExpert) return item.href === '/home' || item.href === '/dashboard';
            if (item.href === '/cases/new' && !canCreateCase) return false;
            if (item.roles && role) {
              const allowed =
                item.roles.includes(role) ||
                (item.roles.includes('MODERATOR') && isModeratorRole(role));
              if (!allowed) return false;
            }
            return true;
          });
          if (!items.length) return null;
          return (
            <div key={group.title} className="mb-5">
              <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {group.title}
              </div>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active = isActive(pathname, item);
                  const badge =
                    item.href === '/admin/accounts' ? pendingAccountRequests : 0;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-label={
                          badge > 0 ? `${item.label}, заявок: ${badge}` : item.label
                        }
                        className={`block rounded px-2 py-2 text-sm leading-snug transition ${
                          active
                            ? 'border-l-2 border-accent bg-accent-light font-medium text-accent'
                            : 'text-graphite hover:bg-surface-muted'
                        }`}
                      >
                        <CountSignal count={badge}>{item.label}</CountSignal>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
