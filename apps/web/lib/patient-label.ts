export function patientCardNumber(patient: {
  cardNumber?: string | null;
  localPatientNumber?: string | null;
}) {
  return (patient.cardNumber ?? patient.localPatientNumber ?? '').trim();
}

export function formatPatientLabel(
  patient: {
    lastName?: string | null;
    firstName?: string | null;
    middleName?: string | null;
    cardNumber?: string | null;
    localPatientNumber?: string | null;
  },
  options?: { hideFio?: boolean },
) {
  const card = patientCardNumber(patient);
  if (options?.hideFio) {
    return card || 'Карта не указана';
  }
  const fio = [patient.lastName, patient.firstName, patient.middleName].filter(Boolean).join(' ');
  return fio || card || 'Пациент';
}
