'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';

export type PersonOption = {
  id: string;
  lastName: string;
  firstName: string;
  middleName?: string | null;
};

function normalize(value: string) {
  return value.trim().toLocaleLowerCase('ru');
}

function formatName(person: PersonOption) {
  return [person.lastName, person.firstName, person.middleName].filter(Boolean).join(' ');
}

function highlightLastName(lastName: string, query: string) {
  const needle = query.trim();
  if (!needle) return lastName;
  const index = lastName.toLocaleLowerCase('ru').indexOf(needle.toLocaleLowerCase('ru'));
  if (index < 0) return lastName;
  return (
    <>
      {lastName.slice(0, index)}
      <mark className="rounded-sm bg-accent-light p-0 font-semibold text-accent">
        {lastName.slice(index, index + needle.length)}
      </mark>
      {lastName.slice(index + needle.length)}
    </>
  );
}

type SearchablePersonSelectProps = {
  id: string;
  name: string;
  people: PersonOption[];
  required?: boolean;
  placeholder?: string;
  onQueryChange?: (query: string) => void;
};

export function SearchablePersonSelect({
  id,
  name,
  people,
  required,
  placeholder = 'Начните вводить фамилию',
  onQueryChange,
}: SearchablePersonSelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const selected = people.find((person) => person.id === selectedId) ?? null;
  const displayValue = open || !selected ? query : formatName(selected);

  const matches = useMemo(() => {
    const needle = normalize(query);
    const rows = needle
      ? people.filter((person) => normalize(person.lastName).includes(needle))
      : [...people];
    return rows.sort((a, b) => formatName(a).localeCompare(formatName(b), 'ru', { sensitivity: 'base' }));
  }, [people, query]);

  useEffect(() => {
    onQueryChange?.(query);
  }, [query, onQueryChange]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  useEffect(() => {
    function onDocMouseDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        if (selected) setQuery('');
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [selected]);

  function selectPerson(person: PersonOption) {
    setSelectedId(person.id);
    setQuery('');
    setOpen(false);
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
      selectPerson(matches[activeIndex]);
      return;
    }
    if (event.key === 'Escape') {
      setOpen(false);
      if (selected) setQuery('');
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        tabIndex={-1}
        aria-hidden
        className="sr-only"
        name={name}
        value={selectedId}
        required={required}
        onChange={() => undefined}
        onInvalid={() => inputRef.current?.focus()}
      />
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
        value={displayValue}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          if (selectedId) setSelectedId('');
        }}
        onFocus={() => {
          setOpen(true);
          if (selected) setQuery('');
        }}
        onKeyDown={handleKeyDown}
      />
      <button
        type="button"
        tabIndex={-1}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-graphite/50"
        aria-label="Показать список"
        onClick={() => {
          setOpen((value) => !value);
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
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded border border-border bg-white shadow-sm"
        >
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-graphite/60">Совпадений нет</li>
          ) : (
            matches.map((person, index) => (
              <li key={person.id} role="option" aria-selected={person.id === selectedId}>
                <button
                  type="button"
                  className={`w-full px-3 py-2 text-left text-sm ${
                    index === activeIndex ? 'bg-accent-light' : 'hover:bg-surface-muted'
                  }`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectPerson(person)}
                >
                  {highlightLastName(person.lastName, query)}
                  {` ${[person.firstName, person.middleName].filter(Boolean).join(' ')}`}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
