# Yandex AI

## Роль ИИ

ИИ **не является врачом**. Не ставит диагноз, не подтверждает хирургию/протез/окклюзию, не закрывает этапы.

### ИИ может

- Предлагать распределение фото/видео по чек-листу
- Объяснять blocking reasons
- Формировать summary этапа/аудита
- Помогать искать метод имплантации
- Advisory по техническим ошибкам

## Реализации

| Класс | Режим |
|-------|-------|
| MockAiMediaClassifier | `AI_PROVIDER=mock` |
| MockClinicalAiAssistant | `AI_PROVIDER=mock` |
| YandexAiStudioMediaClassifier | scaffold |
| AliceAiClinicalAssistant | scaffold |

## Обязательное правило

```http
x-data-logging-enabled: false
```

Production-код **принудительно** устанавливает `false`, даже если ENV неверен.

## Sanitizer

`packages/yandex-ai/src/sanitizer.ts`:

- Удаление PII из payload
- Random request token
- Redacted logging

## ENV

```env
AI_PROVIDER=mock|yandex
YANDEX_AI_ENABLED=false|true
YANDEX_CLOUD_FOLDER_ID=
YANDEX_AI_MODEL_URI=
YANDEX_DATA_LOGGING_ENABLED=false
YANDEX_MEDIA_CLASSIFIER_MODE=mock|yandex_multimodal|custom_cv
```

## API endpoints (server-only)

- `POST /api/v1/ai/explain-blocking-reasons`
- `POST /api/v1/ai/stage-summary`
- `POST /api/v1/ai/audit-summary`
- `POST /api/v1/ai/suggest-implant-method`
