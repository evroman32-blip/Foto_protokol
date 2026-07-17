# Критерии приёмки MVP

## Инфраструктура

- [ ] `docker compose up` поднимает postgres, redis, minio, api, worker, web
- [ ] `npm run db:seed` создаёт демо-данные
- [ ] README и docs на русском

## Standalone

- [ ] Пациент без stoma1cPatientId
- [ ] 4 primary участника случая
- [ ] Нет поля treatingDoctorId
- [ ] 1С не блокирует закрытие этапа

## Этапы

- [ ] 11 StageTemplate в seed
- [ ] 5 MVP этапов с media requirements
- [ ] JAW_RELATION blocked до POSTOP closed
- [ ] FIRST_PROTOTYPE требует 2 видео

## Хирургический этап

- [ ] ОПТГ + КТ blockers
- [ ] Implant registry + method + CT slice blockers
- [ ] Evidence flags для nerve/sinus/nasal/pterygoid/zygomatic
- [ ] Surgeon confirmation required
- [ ] Ортопед не может закрыть surgical stage

## Completeness

- [ ] StageCompletenessService — exact Russian blockingReasons
- [ ] AI suggestion not counted until confirmed
- [ ] Additional/replaced media rules
- [ ] EmergencyEvent does not close stage

## AI / 1C

- [ ] Mock AI по умолчанию
- [ ] x-data-logging-enabled: false forced
- [ ] Stoma1cGateway disabled/mock/scaffold

## Тесты

- [ ] Unit tests StageCompletenessService
- [ ] typecheck проходит
