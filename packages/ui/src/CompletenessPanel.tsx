import type { StageCompletenessResult } from '@mandarin/contracts';
import { StatusBadge } from './StatusBadge';
import { BlockingReasonsList } from './BlockingReasonsList';
import styles from './CompletenessPanel.module.css';

export interface CompletenessPanelProps {
  result: StageCompletenessResult;
  stageName: string;
}

export function CompletenessPanel({ result, stageName }: CompletenessPanelProps) {
  const confirmedCount = result.missingRequirements.reduce(
    (acc, m) => acc + m.confirmedCount,
    0,
  );
  const requiredTotal = result.missingRequirements.reduce(
    (acc, m) => acc + m.requiredCount,
    0,
  ) + confirmedCount;

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <h2 className={styles.heading}>Комплектность: {stageName}</h2>
        <StatusBadge
          label={result.isComplete ? 'Готов к закрытию' : 'Не готов'}
          variant={result.isComplete ? 'success' : 'error'}
        />
      </header>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Обязательных позиций</span>
          <span className={styles.statValue}>{requiredTotal || '—'}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Недостающих</span>
          <span className={styles.statValue}>{result.missingRequirements.length}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>AI без подтверждения</span>
          <span className={styles.statValue}>{result.unconfirmedAssignments.length}</span>
        </div>
      </div>

      <BlockingReasonsList reasons={result.blockingReasons} />

      {result.warnings.length > 0 && (
        <div className={styles.warnings}>
          <h3 className={styles.warningsTitle}>Предупреждения</h3>
          <ul>
            {result.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
