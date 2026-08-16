interface CountSignalProps {
  count: number;
  children: React.ReactNode;
}

/** Orange count in the top-right corner of a label. Hidden when count is 0. */
export function CountSignal({ count, children }: CountSignalProps) {
  const label = count > 99 ? '99+' : String(count);
  return (
    <span className="relative inline-block pr-3">
      {children}
      {count > 0 ? (
        <span
          className="absolute -right-0.5 top-0 -translate-y-1/2 text-[11px] font-semibold leading-none text-accent"
          aria-label={`Заявок: ${count}`}
        >
          {label}
        </span>
      ) : null}
    </span>
  );
}
