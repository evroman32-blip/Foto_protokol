# Модель данных

Полная схема: `packages/database/prisma/schema.prisma`

## Основные сущности

| Сущность | Назначение |
|----------|------------|
| User / StaffMember | Пользователи системы и сотрудники (раздельно) |
| Branch | Филиалы |
| Patient | Пациенты (local / stoma1c / import) |
| ClinicalCase | Клинический случай |
| CaseParticipant | Участники случая (4 обязательных primary) |
| Protocol / ProtocolVersion | Протокол и версии |
| StageTemplate / StageInstance | Шаблоны и экземпляры этапов |
| MediaRequirement / RequirementInstance | Требования к медиа |
| MediaAsset / MediaDerivative / MediaMetadata | Файлы и производные |
| MediaAssignment | Распределение по чек-листу |
| QualityProfile / QualityCheckResult | Техническое качество |
| UploadBatch / UploadChunk | Resumable upload |
| RadiologyStudy | ОПТГ, КТ, DICOM |
| ImplantPlacementMethod | Справочник 25 методов |
| SurgicalImplantRecord | Реестр имплантатов |
| ImplantRadiologyAttachment | КТ-срезы и evidence flags |
| SurgeonRadiologyConfirmation | Подтверждение хирурга |
| StructuredClinicalFields | Поля JAW_RELATION |
| DoctorConfirmation / StageClosure | Подтверждение и закрытие |
| EmergencyEvent | Неотложные события |
| AuditEvent | Журнал (append-only) |
| GeneratedReport | PDF-отчёты |
| ExternalEntityReference | Связь с 1С |
| IntegrationEvent | События интеграции |

## Ключевые ограничения

- UUID для всех id
- Unique: `localPatientNumber`, `protocolId+version`, `protocolVersionId+stageCode+requirementCode`
- CaseParticipant: unique `(clinicalCaseId, staffMemberId, participantRole)`
- ExternalEntityReference: unique `(system, entityType, externalDatabaseId, externalEntityId)`

## Enum-ы

См. schema.prisma — все enum синхронизированы с `@mandarin/contracts`.
