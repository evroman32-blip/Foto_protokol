'use client';

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

function normalize(value: string) {
  return value.trim().toLocaleLowerCase('ru');
}

function highlightMatch(text: string, query: string) {
  const needle = query.trim();
  if (!needle) return text;
  const index = text.toLocaleLowerCase('ru').indexOf(needle.toLocaleLowerCase('ru'));
  if (index < 0) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded-sm bg-accent-light p-0 font-semibold text-accent">
        {text.slice(index, index + needle.length)}
      </mark>
      {text.slice(index + needle.length)}
    </>
  );
}

type SearchableTextSelectProps = {
  id?: string;
  value: string;
  options: string[];
  placeholder?: string;
  onChange: (value: string) => void;
};

export function SearchableTextSelect({
  id,
  value,
  options,
  placeholder = 'Начните вводить название',
  onChange,
}: SearchableTextSelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  /** null = показать весь каталог (фокус / стрелка), иначе фильтр по вводу */
  const [filterQuery, setFilterQuery] = useState<string | null>(null);
  const [menuBox, setMenuBox] = useState({ top: 0, left: 0, width: 0 });

  const matches = useMemo(() => {
    const needle = normalize(filterQuery ?? '');
    const rows = needle
      ? options.filter((option) => normalize(option).includes(needle))
      : [...options];
    return rows.sort((a, b) => a.localeCompare(b, 'ru', { sensitivity: 'base' }));
  }, [options, filterQuery]);

  const exactMatch = options.some((option) => normalize(option) === normalize(value));
  const highlightQuery = filterQuery ?? '';

  function syncMenuBox() {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const maxHeight = 288;
    const gap = 4;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const openUp = spaceBelow < 160 && rect.top > spaceBelow;
    setMenuBox({
      top: openUp ? Math.max(8, rect.top - maxHeight - gap) : rect.bottom + gap,
      left: rect.left,
      width: Math.max(rect.width, 280),
    });
  }

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    syncMenuBox();
  }, [open, matches.length]);

  useEffect(() => {
    setActiveIndex(0);
  }, [filterQuery, open]);

  useEffect(() => {
    if (!open) return;
    function onWin() {
      syncMenuBox();
    }
    window.addEventListener('resize', onWin);
    window.addEventListener('scroll', onWin, true);
    return () => {
      window.removeEventListener('resize', onWin);
      window.removeEventListener('scroll', onWin, true);
    };
  }, [open]);

  useEffect(() => {
    function onDocMouseDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  function pick(option: string) {
    onChange(option);
    setFilterQuery(null);
    setOpen(false);
  }

  function openCatalog() {
    setFilterQuery(null);
    setOpen(true);
    requestAnimationFrame(syncMenuBox);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, Math.max(matches.length - 1, 0)));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === 'Enter' && open && matches[activeIndex]) {
      event.preventDefault();
      pick(matches[activeIndex]);
      return;
    }
    if (event.key === 'Escape') setOpen(false);
  }

  const menu =
    mounted && open
      ? createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            style={{
              position: 'fixed',
              top: menuBox.top,
              left: menuBox.left,
              width: menuBox.width,
              zIndex: 80,
            }}
            className="max-h-72 overflow-auto rounded border border-border bg-white shadow-lg"
          >
            {value.trim() && !exactMatch ? (
              <li role="option" aria-selected={false}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm text-graphite hover:bg-surface-muted"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pick(value.trim())}
                >
                  Использовать «{value.trim()}»
                </button>
              </li>
            ) : null}
            {matches.length === 0 && (!value.trim() || exactMatch) ? (
              <li className="px-3 py-2 text-sm text-graphite/60">
                Совпадений нет — можно ввести своё название
              </li>
            ) : (
              matches.map((option, index) => (
                <li key={option} role="option" aria-selected={normalize(option) === normalize(value)}>
                  <button
                    type="button"
                    className={`w-full px-3 py-2 text-left text-sm ${
                      index === activeIndex ? 'bg-accent-light' : 'hover:bg-surface-muted'
                    }`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => pick(option)}
                  >
                    {highlightMatch(option, highlightQuery)}
                  </button>
                </li>
              ))
            )}
          </ul>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className="relative">
      <input
        ref={inputRef}
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        className="input-field pr-9"
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setFilterQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={openCatalog}
        onKeyDown={handleKeyDown}
      />
      <button
        type="button"
        tabIndex={-1}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-graphite/50"
        aria-label="Показать список"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          openCatalog();
          inputRef.current?.focus();
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {menu}
    </div>
  );
}
