import { CountSignal } from '@/components/CountSignal';

interface PageHeaderProps {
  title: string;
  description?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  count?: number;
}

export function PageHeader({ title, description, subtitle, actions, count }: PageHeaderProps) {
  const text = subtitle ?? description;
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-graphite">
          {count != null ? <CountSignal count={count}>{title}</CountSignal> : title}
        </h1>
        {text ? <p className="mt-1 text-sm text-graphite/70">{text}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
