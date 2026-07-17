# Интеграция с 1С:Медицина. Стоматология 2.1

## Принцип: standalone first

MVP **полностью работает без 1С**. Интеграция — опциональный слой.

## Stoma1cGateway

```typescript
interface Stoma1cGateway {
  getPatientById(patientId: string): Promise<Stoma1cPatient>;
  searchPatients(query: Stoma1cPatientSearchQuery): Promise<Stoma1cPatient[]>;
  getStaff(): Promise<Stoma1cStaffMember[]>;
  getBranches(): Promise<Stoma1cBranch[]>;
  getAppointments(query: Stoma1cAppointmentQuery): Promise<Stoma1cAppointment[]>;
  pushPhotoProtocolStatus(payload: PhotoProtocolStatusPayload): Promise<void>;
  attachPhotoProtocolReport(payload: PhotoProtocolReportPayload): Promise<void>;
}
```

## Реализации

| Gateway | Когда |
|---------|-------|
| DisabledStoma1cGateway | `STOMA1C_INTEGRATION_ENABLED=false`, mock off |
| MockStoma1cGateway | dev/test |
| Stoma1cApiGateway | production (scaffold) |

## Режимы

### Standalone
`MIS_PROVIDER=none`, `STOMA1C_INTEGRATION_ENABLED=false`

### Stoma1c Ready
`MIS_PROVIDER=stoma1c`, `STOMA1C_INTEGRATION_ENABLED=false` — manual ExternalEntityReference

### Stoma1c Integrated
`STOMA1C_INTEGRATION_ENABLED=true` — sync через API, retry queue при недоступности

## Запрещено

- Прямой SQL к базе 1С
- 1С как условие запуска MVP

## ExternalEntityReference

Связь internal ↔ external ID с syncStatus: MANUAL, SYNCED, ERROR, CONFLICT.

## IntegrationEvent

Outbound/inbound events с idempotencyKey, redacted payloads, retry.
