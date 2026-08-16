type ConfirmFn = (message: string) => Promise<boolean>;

let impl: ConfirmFn | null = null;

export function registerConfirmDelete(fn: ConfirmFn | null) {
  impl = fn;
}

/** Двухшаговое подтверждение удаления (окно в интерфейсе, не браузерный confirm). */
export async function confirmDelete(message: string): Promise<boolean> {
  if (impl) return impl(message);
  return false;
}
