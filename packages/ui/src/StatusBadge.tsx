import styles from './StatusBadge.module.css';

export type StatusVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

export interface StatusBadgeProps {
  label: string;
  variant?: StatusVariant;
}

export function StatusBadge({ label, variant = 'neutral' }: StatusBadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[variant]}`}>
      {label}
    </span>
  );
}
