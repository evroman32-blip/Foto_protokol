'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { registerConfirmDelete } from '@/lib/confirm-delete';

type ConfirmFn = (message: string) => Promise<boolean>;

const ConfirmDeleteContext = createContext<ConfirmFn | null>(null);

export function ConfirmDeleteProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const finish = useCallback((ok: boolean) => {
    setMessage(null);
    setStep(1);
    resolver.current?.(ok);
    resolver.current = null;
  }, []);

  const confirmDelete = useCallback<ConfirmFn>((nextMessage) => {
    return new Promise((resolve) => {
      resolver.current?.(false);
      resolver.current = resolve;
      setStep(1);
      setMessage(nextMessage);
    });
  }, []);

  useEffect(() => {
    registerConfirmDelete(confirmDelete);
    return () => registerConfirmDelete(null);
  }, [confirmDelete]);

  return (
    <ConfirmDeleteContext.Provider value={confirmDelete}>
      {children}
      {message ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-delete-title"
        >
          <div className="w-full max-w-md rounded border border-border bg-white p-5 shadow-lg">
            <h2 id="confirm-delete-title" className="text-base font-semibold text-graphite">
              {step === 1 ? 'Подтверждение удаления' : 'Повторная проверка'}
            </h2>
            <p className="mt-3 whitespace-pre-line text-sm text-graphite">
              {step === 1
                ? message
                : 'Вы действительно хотите удалить этот объект? Отменить удаление будет нельзя.'}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => finish(false)}>
                Отмена
              </button>
              {step === 1 ? (
                <button type="button" className="btn-danger" onClick={() => setStep(2)}>
                  Удалить
                </button>
              ) : (
                <button type="button" className="btn-danger" onClick={() => finish(true)}>
                  Подтвердить удаление
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmDeleteContext.Provider>
  );
}

export function useConfirmDelete() {
  const fn = useContext(ConfirmDeleteContext);
  if (!fn) {
    throw new Error('ConfirmDeleteProvider не подключён');
  }
  return fn;
}
