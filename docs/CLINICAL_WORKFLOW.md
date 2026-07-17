# Клинический workflow

## 11-этапный маршрут (промышленная модель)

1. До операции
2. Послеоперационный хирургический и рентгенологический контроль
3. Получение оттисков / сканов
4. Определение межчелюстных соотношений
5. Примерка первого прототипа
6. Фиксация прототипа длительного ношения
7. Контроль 1–3 недели
8. Примерка финальной конструкции
9. Финальная фиксация
10. Контроль после финальной фиксации
11. Коррекции и осложнения

## MVP — 5 детальных этапов

### 1. PRE_OPERATION (owner: ORTHOPEDIST)

15+ фото-позиций + optional + ADDITIONAL_MEDIA (не влияет на комплектность).

### 2. POSTOP_SURGICAL_RADIOLOGY_CONTROL (owner: SURGEON)

- ОПТГ, КТ/КЛКТ
- Реестр имплантатов с методами
- КТ-срез на каждый имплантат
- Подтверждение хирурга

### 3. JAW_RELATION (owner: ORTHOPEDIST)

**Зависимость:** POSTOP_SURGICAL_RADIOLOGY_CONTROL должен быть CLOSED.

18 фото-позиций + structured fields (restHeight, workingHeight, registrationConclusion).

### 4. FIRST_PROTOTYPE (owner: ORTHOPEDIST)

13 фото + 2 обязательных видео (речь с audio, динамика лица).

### 5. FINAL_FIXATION (owner: ORTHOPEDIST)

16 фото-позиций + ADDITIONAL_MEDIA.

## Правила блокировки

- Frontend не вычисляет комплектность — только backend
- AI suggestion не засчитывается до confirm врачом
- Additional media игнорируется для completeness
- Replaced media не засчитывается
- EmergencyEvent не закрывает этап
- 1С absence не blocker в standalone

## Закрытие этапа

1. `StageCompletenessService.isComplete = true`
2. Primary participant с ownerRole
3. DoctorConfirmation (ортопед) или SurgeonRadiologyConfirmation (хирург)
4. Нет unresolved blockers
