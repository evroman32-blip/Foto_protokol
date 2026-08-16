export function fioSortKey(person: {
  lastName?: string | null;
  firstName?: string | null;
  middleName?: string | null;
}) {
  return [person.lastName, person.firstName, person.middleName].filter(Boolean).join(' ');
}

export function compareFioRu(
  a: { lastName?: string | null; firstName?: string | null; middleName?: string | null },
  b: { lastName?: string | null; firstName?: string | null; middleName?: string | null },
) {
  return fioSortKey(a).localeCompare(fioSortKey(b), 'ru', { sensitivity: 'base' });
}
