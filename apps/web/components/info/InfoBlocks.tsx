import Link from 'next/link';

import { PageHeader } from '@/components/PageHeader';

export function InfoPageShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={title}
        description={description}
        actions={
          <Link href="/dashboard" className="btn-secondary">
            К панели
          </Link>
        }
      />
      {children}
    </div>
  );
}

export function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-3">
      <h2 className="text-lg font-semibold text-graphite">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-graphite/90">{children}</div>
    </section>
  );
}

export function InfoPhoto({
  title,
  caption,
  children,
}: {
  title: string;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <figure className="overflow-hidden rounded border border-border bg-white">
      <div className="flex aspect-[16/9] items-center justify-center bg-surface-muted">{children}</div>
      <figcaption className="border-t border-border px-4 py-3">
        <div className="text-sm font-medium text-graphite">{title}</div>
        <p className="mt-1 text-xs text-graphite/70">{caption}</p>
      </figcaption>
    </figure>
  );
}

export function InfoVideo({
  title,
  chapters,
}: {
  title: string;
  chapters: { time: string; label: string }[];
}) {
  return (
    <section className="card space-y-4">
      <h2 className="text-lg font-semibold text-graphite">Видео</h2>
      <div className="overflow-hidden rounded border border-border">
        <div className="relative flex aspect-video items-center justify-center bg-graphite text-white">
          <div className="absolute inset-0 bg-gradient-to-tr from-graphite via-graphite to-accent/40" />
          <div className="relative text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/80">
              <span className="ml-1 text-xl">▶</span>
            </div>
            <div className="text-sm font-medium">{title}</div>
            <p className="mt-1 text-xs text-white/70">Учебный ролик для команды клиники</p>
          </div>
        </div>
        <ol className="divide-y divide-border bg-white">
          {chapters.map((chapter) => (
            <li key={chapter.label} className="flex gap-3 px-4 py-2 text-sm">
              <span className="w-12 shrink-0 font-mono text-xs text-accent">{chapter.time}</span>
              <span className="text-graphite">{chapter.label}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
