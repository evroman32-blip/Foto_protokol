import styles from './BlockingReasonsList.module.css';

export interface BlockingReasonsListProps {
  reasons: string[];
  title?: string;
}

export function BlockingReasonsList({
  reasons,
  title = 'Причины блокировки',
}: BlockingReasonsListProps) {
  if (reasons.length === 0) return null;

  return (
    <div className={styles.container} role="alert">
      <h3 className={styles.title}>{title}</h3>
      <ul className={styles.list}>
        {reasons.map((reason, index) => (
          <li key={`${index}-${reason}`} className={styles.item}>
            {reason}
          </li>
        ))}
      </ul>
    </div>
  );
}
