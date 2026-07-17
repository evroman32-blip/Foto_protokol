'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

export function AiSuggestions({ stageId }: { stageId: string }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  async function explain() {
    setLoading(true);
    try {
      const res = await api.post('/api/v1/ai/explain-blocking-reasons', { stageId });
      setText(res.summary ?? res.text ?? JSON.stringify(res));
    } catch (e: unknown) {
      setText(e instanceof Error ? e.message : 'Ошибка AI');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded border border-graphite/10 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-graphite">AI-подсказки (advisory)</h3>
        <button
          type="button"
          disabled={loading}
          onClick={explain}
          className="rounded border border-accent px-3 py-1 text-xs text-accent"
        >
          Объяснить блокировки
        </button>
      </div>
      <p className="text-xs text-graphite/60">
        ИИ не ставит диагноз и не закрывает этап. Предложения требуют подтверждения врача.
      </p>
      {text ? <p className="mt-3 text-sm text-graphite">{text}</p> : null}
    </div>
  );
}
