'use client';

import Link from 'next/link';

import { PageHeader } from '@/components/PageHeader';

const LINKS = [
  { href: '/management/audit', label: 'Журнал аудита', desc: 'Неизменяемые события действий пользователей' },
  { href: '/management/emergency-events', label: 'Неотложные события', desc: 'EmergencyEvent — не снимают требования этапа' },
  { href: '/management/integration-events', label: 'События интеграции', desc: '1С:Стоматология — очередь синхронизации' },
  { href: '/management/reports', label: 'Сгенерированные отчёты', desc: 'PDF-отчёты по этапам и случаям' },
];

export default function ManagementPage() {
  return (
    <div>
      <PageHeader title="Управление" description="Аудит, интеграции и отчётность клиники" />
      <div className="grid gap-4 md:grid-cols-2">
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="card block transition hover:border-accent">
            <h2 className="font-semibold text-graphite">{link.label}</h2>
            <p className="mt-1 text-sm text-gray-600">{link.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
