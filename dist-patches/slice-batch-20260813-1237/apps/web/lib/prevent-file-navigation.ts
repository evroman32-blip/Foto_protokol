/**
 * Без preventDefault браузер при drag&drop файла на страницу
 * открывает его во вкладке (file://…) вместо передачи в <input type="file">.
 */
export function preventBrowserFileNavigation(e: {
  preventDefault: () => void;
  stopPropagation: () => void;
}) {
  e.preventDefault();
  e.stopPropagation();
}

/** Подключить на document/window на экранах загрузки. */
export function attachDocumentFileDropGuard(): () => void {
  const block = (e: DragEvent) => {
    // Блокируем только если тянут файлы (не текст/ссылки)
    if (e.dataTransfer?.types?.includes('Files')) {
      e.preventDefault();
    }
  };
  const blockDrop = (e: DragEvent) => {
    if (e.dataTransfer?.types?.includes('Files')) {
      e.preventDefault();
    }
  };
  window.addEventListener('dragover', block);
  window.addEventListener('drop', blockDrop);
  return () => {
    window.removeEventListener('dragover', block);
    window.removeEventListener('drop', blockDrop);
  };
}
