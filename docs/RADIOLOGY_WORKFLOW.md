# Рентгенологический workflow

## Поддерживаемые форматы

JPG, PNG, PDF, DCM/DICOM, DICOM ZIP.

## POSTOP_SURGICAL_RADIOLOGY_CONTROL

### Обязательные компоненты

1. **RadiologyStudy studyType=OPTG** — послеоперационное ОПТГ
2. **RadiologyStudy studyType=CBCT|CT** — КТ/КЛКТ
3. **SurgicalImplantRecord** — реестр имплантатов
4. **ImplantRadiologyAttachment** — КТ-срез на имплантат (surgeonConfirmed)
5. **SurgeonRadiologyConfirmation** — подтверждение хирурга

## Справочник методов

25 методов M1A–M16B с evidence flags:

- requiresNerveRelation
- requiresSinusRelation
- requiresNasalFloorRelation
- requiresPterygoidRelation
- requiresZygomaticRelation
- requiresCorticalTarget

## Evidence на КТ-срезе

Для методов с флагами система требует соответствующий `shows*Relation=true` на подтверждённом attachment.

## MVP exclusions

- DICOM viewer
- Измерения в DICOM
- Автоанализ положения имплантата

## DICOM-ready

Модель поддерживает DICOM_SERIES, dicomSeriesAssetId, metadata (modality, studyDate, seriesDescription).
