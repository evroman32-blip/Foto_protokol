import { PrismaClient, UserRole, ParticipantRole, OwnerRole, MediaType, JawScope } from '@prisma/client';
import { hashSync } from 'bcryptjs';
import { StageCode, SURGEON_RADIOLOGY_CONFIRMATION_TEXT } from '@mandarin/contracts';

const prisma = new PrismaClient();
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'ChangeMe123!';
const passwordHash = hashSync(DEMO_PASSWORD, 10);

const STAGE_DEFS: Array<{
  code: StageCode;
  name: string;
  sortOrder: number;
  ownerRole: OwnerRole;
  dependsOn?: StageCode;
  startBlocked?: boolean;
  closeBlocked?: boolean;
}> = [
  { code: StageCode.PRE_OPERATION, name: 'Предоперационный этап', sortOrder: 1, ownerRole: OwnerRole.ORTHOPEDIST },
  { code: StageCode.POSTOP_SURGICAL_RADIOLOGY_CONTROL, name: 'Послеоперационный хирургический и рентгенологический контроль', sortOrder: 2, ownerRole: OwnerRole.SURGEON },
  { code: StageCode.IMPRESSIONS_OR_SCANS, name: 'Оттиски / сканы', sortOrder: 3, ownerRole: OwnerRole.ORTHOPEDIST },
  { code: StageCode.JAW_RELATION, name: 'Межчелюстные соотношения', sortOrder: 4, ownerRole: OwnerRole.ORTHOPEDIST, dependsOn: StageCode.POSTOP_SURGICAL_RADIOLOGY_CONTROL, startBlocked: true, closeBlocked: true },
  { code: StageCode.FIRST_PROTOTYPE, name: 'Первый прототип', sortOrder: 5, ownerRole: OwnerRole.ORTHOPEDIST },
  { code: StageCode.LONG_TERM_PROTOTYPE_FIXATION, name: 'Долгосрочная фиксация прототипа', sortOrder: 6, ownerRole: OwnerRole.ORTHOPEDIST },
  { code: StageCode.CONTROL_1_3_WEEKS, name: 'Контроль 1–3 недели', sortOrder: 7, ownerRole: OwnerRole.ORTHOPEDIST },
  { code: StageCode.FINAL_PROSTHESIS_TRYIN, name: 'Примерка финальной конструкции', sortOrder: 8, ownerRole: OwnerRole.ORTHOPEDIST },
  { code: StageCode.FINAL_FIXATION, name: 'Финальная фиксация', sortOrder: 9, ownerRole: OwnerRole.ORTHOPEDIST },
  { code: StageCode.POST_FINAL_CONTROL, name: 'Контроль после финальной фиксации', sortOrder: 10, ownerRole: OwnerRole.ORTHOPEDIST },
  { code: StageCode.CORRECTIONS_REMAKES_COMPLICATIONS, name: 'Коррекции / переделки / осложнения', sortOrder: 11, ownerRole: OwnerRole.ORTHOPEDIST },
];

const IMPLANT_METHODS = [
  { code: 'M1A_MULTI_DIRECTIONAL_NON_PARALLEL', methodNumber: 1, submethodCode: '1a', nameRu: 'Многонаправленная непараллельная установка имплантатов', isGeneral: true, sortOrder: 1 },
  { code: 'M1B_STRATEGIC_IMPLANT_POSITIONS', methodNumber: 1, submethodCode: '1b', nameRu: 'Стратегические позиции имплантатов / классические положения', isGeneral: true, sortOrder: 2 },
  { code: 'M1C_BASAL_BONE', methodNumber: 1, submethodCode: '1c', nameRu: 'Базальная кость / установка на 2-й или 3-й кортикальной пластинке', isGeneral: true, requiresCorticalTarget: true, sortOrder: 3 },
  { code: 'M2_CHIN_AREA_PLACEMENT', methodNumber: 2, nameRu: 'Установка в области подбородка', jawScope: JawScope.LOWER, sortOrder: 4 },
  { code: 'M3_ANTERIOR_FIXATION_SEGMENTAL_BRIDGE', methodNumber: 3, nameRu: 'Передняя фиксация при сегментарном мосте через линию симметрии', jawScope: JawScope.LOWER, requiresCorticalTarget: true, sortOrder: 5 },
  { code: 'M4_NERVE_BYPASS', methodNumber: 4, nameRu: 'Обход нижнечелюстного нерва', jawScope: JawScope.LOWER, requiresNerveRelation: true, sortOrder: 6 },
  { code: 'M5A_LINGUAL_CORTICAL_DISTAL_MANDIBLE', methodNumber: 5, submethodCode: '5a', nameRu: 'Лингвальный кортикальный имплантат в дистальном отделе нижней челюсти', jawScope: JawScope.LOWER, requiresCorticalTarget: true, requiresNerveRelation: true, sortOrder: 7 },
  { code: 'M5B_VESTIBULAR_CORTICAL_DISTAL_MANDIBLE', methodNumber: 5, submethodCode: '5b', nameRu: 'Вестибулярный кортикальный имплантат в дистальном отделе нижней челюсти', jawScope: JawScope.LOWER, requiresCorticalTarget: true, requiresNerveRelation: true, sortOrder: 8 },
  { code: 'M6_LARGE_DIAMETER_LINGUAL_PALATAL_VESTIBULAR_CORTICAL', methodNumber: 6, nameRu: 'BCS большого диаметра в лингвальном/палатинальном и вестибулярном кортикальном положении', jawScope: JawScope.BOTH, requiresCorticalTarget: true, sortOrder: 9 },
  { code: 'M7A_NASAL_FLOOR_CORTICAL_ENGAGEMENT', methodNumber: 7, submethodCode: '7a', nameRu: 'Вовлечение кортикальной кости с вовлечением дна полости носа', jawScope: JawScope.UPPER, requiresNasalFloorRelation: true, requiresCorticalTarget: true, sortOrder: 10 },
  { code: 'M7B_PALATAL_NASAL_FLOOR_PLACEMENT', methodNumber: 7, submethodCode: '7b', nameRu: 'Палатинальная установка с дном полости носа', jawScope: JawScope.UPPER, requiresNasalFloorRelation: true, requiresCorticalTarget: true, sortOrder: 11 },
  { code: 'M8A_MAXILLARY_SINUS_FLOOR_CORTICAL_ENGAGEMENT', methodNumber: 8, submethodCode: '8a', nameRu: 'Установка с вовлечением кортикальной кости дна верхнечелюстной пазухи', jawScope: JawScope.UPPER, requiresSinusRelation: true, requiresCorticalTarget: true, sortOrder: 12 },
  { code: 'M8B_SINUS_SEPTA_MULTICORTICAL_FIXATION', methodNumber: 8, submethodCode: '8b', nameRu: 'Мультикортикальная фиксация через перегородки верхнечелюстной пазухи', jawScope: JawScope.UPPER, requiresSinusRelation: true, requiresCorticalTarget: true, sortOrder: 13 },
  { code: 'M9_UPPER_CANINE_BYPASS', methodNumber: 9, nameRu: 'Обход верхнего клыка / резцовой зоны', jawScope: JawScope.UPPER, sortOrder: 14 },
  { code: 'M10_TUBERO_PTERYGOID', methodNumber: 10, nameRu: 'Туберо-пterygoid установка', jawScope: JawScope.UPPER, requiresPterygoidRelation: true, requiresCorticalTarget: true, sortOrder: 15 },
  { code: 'M10A_DOUBLE_TUBERO_PTERYGOID', methodNumber: 10, submethodCode: '10a', nameRu: 'Двойная tubero-pterygoid установка', jawScope: JawScope.UPPER, requiresPterygoidRelation: true, requiresCorticalTarget: true, sortOrder: 16 },
  { code: 'M11A_BONE_PALATAL_TO_MAXILLARY_SINUS', methodNumber: 11, submethodCode: '11a', nameRu: 'Установка в кости между альвеолой и верхнечелюстной пазухой', jawScope: JawScope.UPPER, requiresSinusRelation: true, requiresCorticalTarget: true, sortOrder: 17 },
  { code: 'M11B_MEDIAN_PALATAL_SUTURE', methodNumber: 11, submethodCode: '11b', nameRu: 'Установка в медианный палатинальный шов', jawScope: JawScope.UPPER, requiresCorticalTarget: true, sortOrder: 18 },
  { code: 'M11C_ALVEOLAR_PALATAL_FIXATION', methodNumber: 11, submethodCode: '11c', nameRu: 'Альвеолярно-пalatinal фиксация', jawScope: JawScope.UPPER, requiresCorticalTarget: true, sortOrder: 19 },
  { code: 'M12_ZYGOMATIC_IMPLANT', methodNumber: 12, nameRu: 'Скуловой имплантат / установка в скуловую кость', jawScope: JawScope.UPPER, requiresZygomaticRelation: true, requiresCorticalTarget: true, sortOrder: 20 },
  { code: 'M13_TRANSCORTICAL_DISTAL_MANDIBLE_CAUDAL_TO_NAI', methodNumber: 13, nameRu: 'Транскортикальная установка в дистальном отделе нижней челюсти кaudal к нижнеальвеолярному нерву', jawScope: JawScope.LOWER, requiresNerveRelation: true, requiresCorticalTarget: true, sortOrder: 21 },
  { code: 'M14_HORIZONTAL_BICORTICAL_FRESH_LOWER_PREMOLAR_SOCKET', methodNumber: 14, nameRu: 'Горизонтальная бикортикальная установка в лунку свежевылеченного нижнего premolar', jawScope: JawScope.LOWER, requiresCorticalTarget: true, sortOrder: 22 },
  { code: 'M15_PALATAL_SOCKET_UPPER_MOLAR', methodNumber: 15, nameRu: 'Установка Strategic Implant вертикально в лунку верхнего molar', jawScope: JawScope.UPPER, requiresCorticalTarget: true, sortOrder: 23 },
  { code: 'M16A_TWO_IMPLANTS_UPPER_FIRST_PREMOLAR', methodNumber: 16, submethodCode: '16a', nameRu: 'Два имплантата в области первого premolar верхней челюсти', jawScope: JawScope.UPPER, sortOrder: 24 },
  { code: 'M16B_TWO_IMPLANTS_UPPER_SECOND_PREMOLAR_SOCKET', methodNumber: 16, submethodCode: '16b', nameRu: 'Два имплантата в лунке второго premolar верхней челюсти для tubero-pterygoid фиксации', jawScope: JawScope.UPPER, sortOrder: 25 },
];

type ReqDef = {
  code: string;
  name: string;
  mediaType: MediaType;
  required?: boolean;
  minCount?: number;
  sortOrder: number;
  specialRule?: string;
  qualityProfileName?: string;
};

function preopRequirements(): ReqDef[] {
  const codes: Array<[string, string]> = [
    ['PREOP_FACE_FRONT_REST', 'Анфас в покое'],
    ['PREOP_FACE_FRONT_SMILE', 'Анфас с улыбкой'],
    ['PREOP_PROFILE_RIGHT_REST', 'Профиль справа в покое'],
    ['PREOP_PROFILE_RIGHT_SMILE', 'Профиль справа с улыбкой'],
    ['PREOP_PROFILE_LEFT_REST', 'Профиль слева в покое'],
    ['PREOP_PROFILE_LEFT_SMILE', 'Профиль слева с улыбкой'],
    ['PREOP_POSITION_12', 'Позиция 12 часов'],
    ['PREOP_NHP', 'NHP'],
    ['PREOP_INTRAORAL_FRONT', 'Инtraoral фронтально'],
    ['PREOP_INTRAORAL_RIGHT', 'Инtraoral справа'],
    ['PREOP_INTRAORAL_LEFT', 'Инtraoral слева'],
    ['PREOP_OCCLUSAL_UPPER', 'Окclusal верх'],
    ['PREOP_OCCLUSAL_LOWER', 'Окclusal низ'],
    ['PREOP_SOFT_TISSUES', 'Мягкие ткани'],
    ['PREOP_EXISTING_PROSTHESIS_OPTIONAL', 'Существующий протез (опционально)'],
    ['PREOP_ADDITIONAL_MEDIA', 'Дополнительные материалы'],
  ];
  return codes.map(([code, name], i) => ({
    code,
    name,
    mediaType: MediaType.PHOTO,
    required: !code.includes('OPTIONAL') && !code.includes('ADDITIONAL'),
    minCount: code.includes('ADDITIONAL') ? 0 : 1,
    sortOrder: i + 1,
    qualityProfileName: 'photo-standard',
  }));
}

function postopRequirements(): ReqDef[] {
  return [
    { code: 'POSTOP_OPTG', name: 'Послеоперационное ОПТГ', mediaType: MediaType.RADIOLOGY_IMAGE, sortOrder: 1 },
    { code: 'POSTOP_CBCT_STUDY', name: 'Послеоперационная КТ / КЛКТ', mediaType: MediaType.RADIOLOGY_STUDY, sortOrder: 2 },
    { code: 'POSTOP_IMPLANT_CT_SLICES', name: 'КТ-срезы по каждому имплантату', mediaType: MediaType.RADIOLOGY_IMAGE, sortOrder: 3, specialRule: 'oneConfirmedSlicePerImplant' },
    { code: 'POSTOP_IMPLANT_METHOD_REGISTRY', name: 'Реестр методов установки', mediaType: MediaType.STRUCTURED_DATA, sortOrder: 4, specialRule: 'everyImplantHasActualMethod' },
    { code: 'POSTOP_SURGEON_CONFIRMATION', name: 'Подтверждение хирурга', mediaType: MediaType.STRUCTURED_CONFIRMATION, sortOrder: 5 },
  ];
}

function jawRelationRequirements(): ReqDef[] {
  const codes: Array<[string, string]> = [
    ['JR_UPPER_TEMPLATE_PRIMARY', 'Верхний шаблон primary'],
    ['JR_LOWER_TEMPLATE_PRIMARY', 'Нижний шаблон primary'],
    ['JR_BOTH_TEMPLATES', 'Оба шаблона'],
    ['JR_UPPER_LIP_SUPPORT', 'Поддержка верхней губы'],
    ['JR_CHEEK_SUPPORT', 'Поддержка щеки'],
    ['JR_UPPER_RIM_VISIBILITY', 'Видимость верхней губной линии'],
    ['JR_PROSTHETIC_PLANE', 'Протезная плоскость'],
    ['JR_CAMPER_LINE', 'Линия Кэмпера'],
    ['JR_LARIN_DEVICE', 'Прибор Larin'],
    ['JR_MIDLINE', 'Средняя линия'],
    ['JR_CANINE_LINES', 'Клыковые линии'],
    ['JR_SMILE_LINE', 'Линия улыбки'],
    ['JR_REST_HEIGHT_MEASUREMENT', 'Измерение высоты покоя'],
    ['JR_WORKING_HEIGHT', 'Рабочая высота'],
    ['JR_FINAL_WAX_REGISTRATION', 'Финальная wax-регистрация'],
    ['JR_REGISTRATION_REINSERTED', 'Регистрация reinserted'],
    ['JR_BEFORE_OPTG', 'ОПТГ до этапа'],
    ['JR_OPTG_DOCUMENT', 'Документ ОПТГ'],
  ];
  return codes.map(([code, name], i) => ({
    code,
    name,
    mediaType: code.includes('OPTG') ? MediaType.RADIOLOGY_IMAGE : MediaType.PHOTO,
    sortOrder: i + 1,
    qualityProfileName: 'photo-standard',
  }));
}

function firstPrototypeRequirements(): ReqDef[] {
  const photos: Array<[string, string]> = [
    ['FP_FIT', 'Посадка'],
    ['FP_MIDLINE', 'Средняя линия'],
    ['FP_SYMMETRY', 'Симметрия'],
    ['FP_SMILE_LINE', 'Линия улыбки'],
    ['FP_INCISOR_VISIBILITY', 'Видимость резцов'],
    ['FP_LIP_SUPPORT', 'Поддержка губ'],
    ['FP_BUCCAL_CORRIDORS', 'Щечные коридоры'],
    ['FP_ARCH_WIDTH', 'Ширина дуги'],
    ['FP_SAGITTAL_GAP', 'Сагittal gap'],
    ['FP_INCISAL_EDGE_POSITION', 'Положение режущего края'],
    ['FP_FRONTAL_RELATION', 'Фронтальное соотношение'],
    ['FP_SOFT_TISSUES', 'Мягкие ткани'],
    ['FP_OCCLUSAL_VIEWS', 'Окclusal views'],
  ];
  const reqs = photos.map(([code, name], i) => ({
    code,
    name,
    mediaType: MediaType.PHOTO,
    sortOrder: i + 1,
    qualityProfileName: 'photo-standard',
  }));
  reqs.push(
    { code: 'FP_VIDEO_SPEECH', name: 'Речь и фонетика', mediaType: MediaType.VIDEO, sortOrder: 20, qualityProfileName: 'video-speech' },
    { code: 'FP_VIDEO_FACE_DYNAMICS', name: 'Динамика лица, губ и улыбки', mediaType: MediaType.VIDEO, sortOrder: 21, qualityProfileName: 'video-standard' },
  );
  return reqs;
}

function finalFixationRequirements(): ReqDef[] {
  const codes: Array<[string, string]> = [
    ['FF_FACE_FRONT_REST', 'Лицо анфас покой'],
    ['FF_FACE_FRONT_SMILE', 'Лицо анфас улыбка'],
    ['FF_PROFILE_RIGHT', 'Профиль справа'],
    ['FF_PROFILE_LEFT', 'Профиль слева'],
    ['FF_POSITION_12', 'Позиция 12'],
    ['FF_POSITION_6', 'Позиция 6'],
    ['FF_INTRAORAL_FRONT', 'Интраорально фронтально'],
    ['FF_INTRAORAL_RIGHT', 'Интраорально справа'],
    ['FF_INTRAORAL_LEFT', 'Интраорально слева'],
    ['FF_OCCLUSAL_UPPER', 'Окклюзия верх'],
    ['FF_OCCLUSAL_LOWER', 'Окклюзия низ'],
    ['FF_SOFT_TISSUES', 'Мягкие ткани'],
    ['FF_HYGIENE_SPACES', 'Гигиенические промежутки'],
    ['FF_IMPLANT_ACCESS', 'Доступ к имплантатам'],
    ['FF_FINAL_SYMMETRY', 'Финальная симметрия'],
    ['FF_ADDITIONAL_MEDIA', 'Дополнительные материалы'],
  ];
  return codes.map(([code, name], i) => ({
    code,
    name,
    mediaType: MediaType.PHOTO,
    required: !code.includes('ADDITIONAL'),
    minCount: code.includes('ADDITIONAL') ? 0 : 1,
    sortOrder: i + 1,
    qualityProfileName: 'photo-standard',
  }));
}

function photoPositions(
  prefix: string,
  codes: Array<[string, string]>,
  opts?: { includeAdditional?: boolean },
): ReqDef[] {
  const list = codes.map(([suffix, name], i) => ({
    code: `${prefix}_${suffix}`,
    name,
    mediaType: MediaType.PHOTO,
    required: true,
    minCount: 1,
    sortOrder: i + 1,
    qualityProfileName: 'photo-standard',
  }));
  if (opts?.includeAdditional !== false) {
    list.push({
      code: `${prefix}_ADDITIONAL_MEDIA`,
      name: 'Дополнительные материалы',
      mediaType: MediaType.PHOTO,
      required: false,
      minCount: 0,
      sortOrder: list.length + 1,
      qualityProfileName: 'photo-standard',
    });
  }
  return list;
}

function impressionsRequirements(): ReqDef[] {
  return [
    {
      code: 'IMP_SCAN_UPPER',
      name: 'Скан / STL верхней челюсти',
      mediaType: MediaType.STL,
      sortOrder: 1,
    },
    {
      code: 'IMP_SCAN_LOWER',
      name: 'Скан / STL нижней челюсти',
      mediaType: MediaType.STL,
      sortOrder: 2,
    },
    {
      code: 'IMP_SCAN_BITE',
      name: 'Скан / STL в прикусе',
      mediaType: MediaType.STL,
      required: false,
      minCount: 0,
      sortOrder: 3,
    },
    {
      code: 'IMP_PHOTO_IMPRESSIONS',
      name: 'Фото оттисков',
      mediaType: MediaType.PHOTO,
      sortOrder: 4,
      qualityProfileName: 'photo-standard',
    },
    {
      code: 'IMP_ADDITIONAL_MEDIA',
      name: 'Дополнительные материалы',
      mediaType: MediaType.PHOTO,
      required: false,
      minCount: 0,
      sortOrder: 5,
      qualityProfileName: 'photo-standard',
    },
  ];
}

function longTermPrototypeRequirements(): ReqDef[] {
  return [
    ...photoPositions('LTP', [
      ['FACE_FRONT_REST', 'Лицо анфас покой'],
      ['FACE_FRONT_SMILE', 'Лицо анфас улыбка'],
      ['INTRAORAL_FRONT', 'Интраорально фронтально'],
      ['INTRAORAL_RIGHT', 'Интраорально справа'],
      ['INTRAORAL_LEFT', 'Интраорально слева'],
      ['OCCLUSAL_UPPER', 'Окклюзия верх'],
      ['OCCLUSAL_LOWER', 'Окклюзия низ'],
      ['SOFT_TISSUES', 'Мягкие ткани'],
      ['FIT', 'Посадка / фиксация'],
    ]),
    {
      code: 'LTP_VIDEO_SPEECH',
      name: 'Речь и фонетика',
      mediaType: MediaType.VIDEO,
      required: false,
      minCount: 0,
      sortOrder: 20,
      qualityProfileName: 'video-speech',
    },
  ];
}

function control1To3WeeksRequirements(): ReqDef[] {
  return [
    ...photoPositions('C13', [
      ['FACE_FRONT_REST', 'Лицо анфас покой'],
      ['FACE_FRONT_SMILE', 'Лицо анфас улыбка'],
      ['INTRAORAL_FRONT', 'Интраорально фронтально'],
      ['INTRAORAL_RIGHT', 'Интраорально справа'],
      ['INTRAORAL_LEFT', 'Интраорально слева'],
      ['SOFT_TISSUES', 'Мягкие ткани'],
      ['HYGIENE', 'Гигиена / состояние тканей'],
    ]),
    {
      code: 'C13_OPTG',
      name: 'Контрольное ОПТГ',
      mediaType: MediaType.RADIOLOGY_IMAGE,
      sortOrder: 20,
    },
  ];
}

function finalTryinRequirements(): ReqDef[] {
  return [
    ...photoPositions('TRYIN', [
      ['FIT', 'Посадка'],
      ['MIDLINE', 'Средняя линия'],
      ['SYMMETRY', 'Симметрия'],
      ['SMILE_LINE', 'Линия улыбки'],
      ['LIP_SUPPORT', 'Поддержка губ'],
      ['INTRAORAL_FRONT', 'Интраорально фронтально'],
      ['INTRAORAL_RIGHT', 'Интраорально справа'],
      ['INTRAORAL_LEFT', 'Интраорально слева'],
      ['OCCLUSAL_VIEWS', 'Окклюзионные виды'],
      ['SOFT_TISSUES', 'Мягкие ткани'],
    ]),
    {
      code: 'TRYIN_VIDEO_SPEECH',
      name: 'Речь и фонетика',
      mediaType: MediaType.VIDEO,
      sortOrder: 20,
      qualityProfileName: 'video-speech',
    },
    {
      code: 'TRYIN_VIDEO_FACE_DYNAMICS',
      name: 'Динамика лица и улыбки',
      mediaType: MediaType.VIDEO,
      required: false,
      minCount: 0,
      sortOrder: 21,
      qualityProfileName: 'video-standard',
    },
  ];
}

function postFinalControlRequirements(): ReqDef[] {
  return [
    ...photoPositions('PFC', [
      ['FACE_FRONT_REST', 'Лицо анфас покой'],
      ['FACE_FRONT_SMILE', 'Лицо анфас улыбка'],
      ['INTRAORAL_FRONT', 'Интраорально фронтально'],
      ['INTRAORAL_RIGHT', 'Интраорально справа'],
      ['INTRAORAL_LEFT', 'Интраорально слева'],
      ['OCCLUSAL_UPPER', 'Окклюзия верх'],
      ['OCCLUSAL_LOWER', 'Окклюзия низ'],
      ['SOFT_TISSUES', 'Мягкие ткани'],
      ['HYGIENE_SPACES', 'Гигиенические промежутки'],
    ]),
    {
      code: 'PFC_OPTG',
      name: 'Контрольное ОПТГ',
      mediaType: MediaType.RADIOLOGY_IMAGE,
      sortOrder: 20,
    },
  ];
}

function correctionsRequirements(): ReqDef[] {
  return [
    {
      code: 'CORR_PROBLEM_AREA',
      name: 'Зона коррекции / осложнения',
      mediaType: MediaType.PHOTO,
      sortOrder: 1,
      qualityProfileName: 'photo-standard',
    },
    {
      code: 'CORR_BEFORE',
      name: 'До коррекции',
      mediaType: MediaType.PHOTO,
      sortOrder: 2,
      qualityProfileName: 'photo-standard',
    },
    {
      code: 'CORR_AFTER',
      name: 'После коррекции',
      mediaType: MediaType.PHOTO,
      sortOrder: 3,
      qualityProfileName: 'photo-standard',
    },
    {
      code: 'CORR_DOCUMENT',
      name: 'Документ / заключение',
      mediaType: MediaType.DOCUMENT,
      required: false,
      minCount: 0,
      sortOrder: 4,
    },
    {
      code: 'CORR_ADDITIONAL_MEDIA',
      name: 'Дополнительные материалы',
      mediaType: MediaType.PHOTO,
      required: false,
      minCount: 0,
      sortOrder: 5,
      qualityProfileName: 'photo-standard',
    },
  ];
}

const MEDIA_BY_STAGE: Partial<Record<StageCode, () => ReqDef[]>> = {
  [StageCode.PRE_OPERATION]: preopRequirements,
  [StageCode.POSTOP_SURGICAL_RADIOLOGY_CONTROL]: postopRequirements,
  [StageCode.IMPRESSIONS_OR_SCANS]: impressionsRequirements,
  [StageCode.JAW_RELATION]: jawRelationRequirements,
  [StageCode.FIRST_PROTOTYPE]: firstPrototypeRequirements,
  [StageCode.LONG_TERM_PROTOTYPE_FIXATION]: longTermPrototypeRequirements,
  [StageCode.CONTROL_1_3_WEEKS]: control1To3WeeksRequirements,
  [StageCode.FINAL_PROSTHESIS_TRYIN]: finalTryinRequirements,
  [StageCode.FINAL_FIXATION]: finalFixationRequirements,
  [StageCode.POST_FINAL_CONTROL]: postFinalControlRequirements,
  [StageCode.CORRECTIONS_REMAKES_COMPLICATIONS]: correctionsRequirements,
};

async function main() {
  const branchCentral = await prisma.branch.upsert({
    where: { code: 'CENTRAL' },
    update: { name: 'Центральный' },
    create: { code: 'CENTRAL', name: 'Центральный', address: 'Москва, Центральный филиал' },
  });
  const branchNorth = await prisma.branch.upsert({
    where: { code: 'NORTH' },
    update: { name: 'Северный' },
    create: { code: 'NORTH', name: 'Северный', address: 'Москва, Северный филиал' },
  });

  const usersSpec: Array<{
    email: string;
    role: UserRole;
    lastName: string;
    firstName: string;
    position: string;
    participantRole?: ParticipantRole;
    branchId: string;
  }> = [
    { email: 'admin@example.local', role: UserRole.SYSTEM_ADMIN, lastName: 'Админов', firstName: 'Системный', position: 'Администратор', branchId: branchCentral.id },
    { email: 'chief@example.local', role: UserRole.CHIEF_DOCTOR, lastName: 'Главный', firstName: 'Врач', position: 'Главный врач', participantRole: ParticipantRole.CONSULTING_DOCTOR, branchId: branchCentral.id },
    { email: 'manager@example.local', role: UserRole.ORTHOPEDIC_MANAGER, lastName: 'Менеджер', firstName: 'Ортопедический', position: 'Руководитель ортопедии', branchId: branchCentral.id },
    { email: 'surgeon@example.local', role: UserRole.SURGEON, lastName: 'Хирургов', firstName: 'Иван', position: 'Хирург', participantRole: ParticipantRole.SURGEON, branchId: branchCentral.id },
    { email: 'ortho@example.local', role: UserRole.ORTHOPEDIST, lastName: 'Ортопедов', firstName: 'Пётр', position: 'Ортопед', participantRole: ParticipantRole.ORTHOPEDIST, branchId: branchCentral.id },
    { email: 'tech@example.local', role: UserRole.DENTAL_TECHNICIAN, lastName: 'Техников', firstName: 'Алексей', position: 'Зубной техник', participantRole: ParticipantRole.DENTAL_TECHNICIAN, branchId: branchCentral.id },
    { email: 'auditor@example.local', role: UserRole.AUDITOR, lastName: 'Аудиторов', firstName: 'Олег', position: 'Аудитор', branchId: branchCentral.id },
  ];

  const staffByEmail: Record<string, { staffId: string; userId: string }> = {};

  for (const u of usersSpec) {
    const staff = await prisma.staffMember.upsert({
      where: { id: `seed-staff-${u.email}` },
      update: { lastName: u.lastName, firstName: u.firstName, position: u.position, branchId: u.branchId },
      create: {
        id: `seed-staff-${u.email}`,
        lastName: u.lastName,
        firstName: u.firstName,
        position: u.position,
        branchId: u.branchId,
      },
    });
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { passwordHash, role: u.role, isActive: true, staffMemberId: staff.id },
      create: {
        email: u.email,
        passwordHash,
        role: u.role,
        staffMemberId: staff.id,
        isActive: true,
      },
    });
    staffByEmail[u.email] = { staffId: staff.id, userId: user.id };
  }

  const photoProfile = await prisma.qualityProfile.upsert({
    where: { id: 'seed-quality-photo' },
    update: {},
    create: {
      id: 'seed-quality-photo',
      name: 'photo-standard',
      mediaType: MediaType.PHOTO,
      minWidth: 1920,
      minHeight: 1080,
      maxBlurScore: 0.35,
      minBrightness: 0.15,
      maxBrightness: 0.92,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/tiff'],
    },
  });

  const videoProfile = await prisma.qualityProfile.upsert({
    where: { id: 'seed-quality-video' },
    update: {},
    create: {
      id: 'seed-quality-video',
      name: 'video-standard',
      mediaType: MediaType.VIDEO,
      minWidth: 1280,
      minHeight: 720,
      minVideoDurationSec: 3,
      maxVideoDurationSec: 600,
      allowedMimeTypes: ['video/mp4', 'video/quicktime'],
    },
  });

  const speechProfile = await prisma.qualityProfile.upsert({
    where: { id: 'seed-quality-speech' },
    update: {},
    create: {
      id: 'seed-quality-speech',
      name: 'video-speech',
      mediaType: MediaType.VIDEO,
      minWidth: 1280,
      minHeight: 720,
      requireAudio: true,
      minVideoDurationSec: 5,
      maxVideoDurationSec: 300,
      allowedMimeTypes: ['video/mp4', 'video/quicktime'],
    },
  });

  const profileByName: Record<string, string> = {
    'photo-standard': photoProfile.id,
    'video-standard': videoProfile.id,
    'video-speech': speechProfile.id,
  };

  const protocol = await prisma.protocol.upsert({
    where: { code: 'STRATEGIC_IMPLANT_V1' },
    update: { name: 'Strategic Implant PhotoProtocol v1' },
    create: {
      code: 'STRATEGIC_IMPLANT_V1',
      name: 'Strategic Implant PhotoProtocol v1',
      description: 'MVP протокол Strategic Implant®',
    },
  });

  const version = await prisma.protocolVersion.upsert({
    where: { protocolId_version: { protocolId: protocol.id, version: '1.0' } },
    update: { status: 'PUBLISHED', publishedAt: new Date() },
    create: {
      protocolId: protocol.id,
      version: '1.0',
      status: 'PUBLISHED',
      publishedAt: new Date(),
      createdBy: staffByEmail['admin@example.local']!.userId,
    },
  });

  const stageTemplateIds: Record<string, string> = {};

  for (const st of STAGE_DEFS) {
    const template = await prisma.stageTemplate.upsert({
      where: { protocolVersionId_code: { protocolVersionId: version.id, code: st.code } },
      update: {
        name: st.name,
        sortOrder: st.sortOrder,
        ownerRole: st.ownerRole,
        dependsOnStageCode: st.dependsOn ?? null,
        startBlockedUntilDependencyClosed: st.startBlocked ?? false,
        closeBlockedUntilDependencyClosed: st.closeBlocked ?? false,
        description: null,
      },
      create: {
        protocolVersionId: version.id,
        code: st.code,
        name: st.name,
        sortOrder: st.sortOrder,
        ownerRole: st.ownerRole,
        dependsOnStageCode: st.dependsOn ?? null,
        startBlockedUntilDependencyClosed: st.startBlocked ?? false,
        closeBlockedUntilDependencyClosed: st.closeBlocked ?? false,
      },
    });
    stageTemplateIds[st.code] = template.id;

    const reqFactory = MEDIA_BY_STAGE[st.code];
    if (reqFactory) {
      for (const req of reqFactory()) {
        await prisma.mediaRequirement.upsert({
          where: { stageTemplateId_code: { stageTemplateId: template.id, code: req.code } },
          // Не перезаписываем ручные правки админа (имя, isActive, minCount и т.д.)
          update: {},
          create: {
            protocolVersionId: version.id,
            stageTemplateId: template.id,
            code: req.code,
            name: req.name,
            mediaType: req.mediaType,
            required: req.required ?? true,
            minCount: req.minCount ?? 1,
            sortOrder: req.sortOrder,
            allowMultiple: false,
            specialRule: req.specialRule ?? null,
            qualityProfileId: req.qualityProfileName ? profileByName[req.qualityProfileName] : null,
          },
        });
      }
    }
  }

  for (const method of IMPLANT_METHODS) {
    await prisma.implantPlacementMethod.upsert({
      where: { code: method.code },
      update: { nameRu: method.nameRu, sortOrder: method.sortOrder },
      create: {
        code: method.code,
        methodNumber: method.methodNumber,
        submethodCode: method.submethodCode ?? null,
        nameRu: method.nameRu,
        jawScope: method.jawScope ?? JawScope.BOTH,
        requiresOptg: false,
        requiresCbct: false,
        requiresCtSlice: true,
        requiresCorticalTarget: method.requiresCorticalTarget ?? false,
        requiresNerveRelation: method.requiresNerveRelation ?? false,
        requiresSinusRelation: method.requiresSinusRelation ?? false,
        requiresNasalFloorRelation: method.requiresNasalFloorRelation ?? false,
        requiresPterygoidRelation: method.requiresPterygoidRelation ?? false,
        requiresZygomaticRelation: method.requiresZygomaticRelation ?? false,
        isGeneral: method.isGeneral ?? false,
        isActive: true,
        sortOrder: method.sortOrder,
      },
    });
  }

  const patient = await prisma.patient.upsert({
    where: { localPatientNumber: 'LOCAL-0001' },
    update: {},
    create: {
      localPatientNumber: 'LOCAL-0001',
      lastName: 'Демидов',
      firstName: 'Андрей',
      middleName: 'Сергеевич',
      birthDate: new Date('1975-03-15'),
      sex: 'MALE',
      phone: '+7 (916) 000-00-01',
      branchId: branchCentral.id,
      source: 'LOCAL',
      comment: 'Demo patient без связи с 1С',
    },
  });

  const clinicalCase = await prisma.clinicalCase.upsert({
    where: { id: 'seed-clinical-case-001' },
    update: { status: 'ACTIVE' },
    create: {
      id: 'seed-clinical-case-001',
      patientId: patient.id,
      clinicalScenario: 'Полная адентия — Strategic Implant® на обе челюсти',
      jawScope: JawScope.BOTH,
      treatmentStartDate: new Date('2026-01-10'),
      branchId: branchCentral.id,
      protocolVersionId: version.id,
      status: 'ACTIVE',
      createdBy: staffByEmail['ortho@example.local']!.userId,
    },
  });

  const participantMap: Array<[string, ParticipantRole]> = [
    ['chief@example.local', ParticipantRole.CONSULTING_DOCTOR],
    ['ortho@example.local', ParticipantRole.ORTHOPEDIST],
    ['surgeon@example.local', ParticipantRole.SURGEON],
    ['tech@example.local', ParticipantRole.DENTAL_TECHNICIAN],
  ];

  for (const [email, role] of participantMap) {
    const { staffId, userId } = staffByEmail[email]!;
    await prisma.caseParticipant.upsert({
      where: { id: `seed-participant-${role}` },
      update: { isPrimary: true, removedAt: null },
      create: {
        id: `seed-participant-${role}`,
        clinicalCaseId: clinicalCase.id,
        staffMemberId: staffId,
        participantRole: role,
        isPrimary: true,
        assignedBy: userId,
      },
    });
  }

  const mvpStages = [
    StageCode.PRE_OPERATION,
    StageCode.POSTOP_SURGICAL_RADIOLOGY_CONTROL,
    StageCode.JAW_RELATION,
    StageCode.FIRST_PROTOTYPE,
    StageCode.FINAL_FIXATION,
  ];

  let postopStageId: string | null = null;

  for (const code of ALL_STAGE_CODES_FROM_DEFS()) {
    const templateId = stageTemplateIds[code];
    if (!templateId) continue;
    const isMvp = mvpStages.includes(code as StageCode);
    const stage = await prisma.stageInstance.upsert({
      where: { id: `seed-stage-${code}` },
      update: {},
      create: {
        id: `seed-stage-${code}`,
        clinicalCaseId: clinicalCase.id,
        stageTemplateId: templateId,
        protocolVersionId: version.id,
        status: isMvp ? 'DRAFT' : 'NOT_STARTED',
        openedAt: isMvp ? new Date() : null,
      },
    });
    if (code === StageCode.POSTOP_SURGICAL_RADIOLOGY_CONTROL) {
      postopStageId = stage.id;
    }
  }

  // Досеять RequirementInstance для всех открытых этапов всех случаев
  // (новые положения протокола должны сразу работать на каждом этапе)
  const openStages = await prisma.stageInstance.findMany({
    where: { status: { not: 'CLOSED' } },
    select: { id: true, stageTemplateId: true },
  });
  for (const stage of openStages) {
    const requirements = await prisma.mediaRequirement.findMany({
      where: { stageTemplateId: stage.stageTemplateId, isActive: true },
    });
    for (const req of requirements) {
      await prisma.requirementInstance.upsert({
        where: {
          stageInstanceId_mediaRequirementId: {
            stageInstanceId: stage.id,
            mediaRequirementId: req.id,
          },
        },
        update: {},
        create: {
          stageInstanceId: stage.id,
          mediaRequirementId: req.id,
          status: 'PENDING',
        },
      });
    }
  }

  if (postopStageId) {
    await prisma.surgicalImplantRecord.upsert({
      where: { stageInstanceId_implantNumber: { stageInstanceId: postopStageId, implantNumber: 1 } },
      update: {},
      create: {
        clinicalCaseId: clinicalCase.id,
        stageInstanceId: postopStageId,
        implantNumber: 1,
        implantLabel: 'IMP-01',
        jawScope: JawScope.LOWER,
        side: 'LEFT',
        actualMethodCode: 'M2_CHIN_AREA_PLACEMENT',
        status: 'DRAFT',
        createdBy: staffByEmail['surgeon@example.local']!.userId,
        surgeonComment: 'Demo draft implant record',
      },
    });
  }

  console.log('Seed completed.');
  console.log(`Password for all demo users: ${DEMO_PASSWORD}`);
  for (const u of usersSpec) {
    console.log(`  ${u.email} (${u.role})`);
  }
  console.log(`Branches: ${branchCentral.name}, ${branchNorth.name}`);
  console.log(`Patient: ${patient.localPatientNumber} (LOCAL, no 1C)`);
  console.log(`Protocol: ${protocol.code} v${version.version}`);
  console.log(`Clinical case: ${clinicalCase.id} (${clinicalCase.status})`);
  console.log(`Implant methods: ${IMPLANT_METHODS.length}`);
  console.log(`Surgeon confirmation text reference: ${SURGEON_RADIOLOGY_CONFIRMATION_TEXT.slice(0, 60)}...`);
}

function ALL_STAGE_CODES_FROM_DEFS(): string[] {
  return STAGE_DEFS.map((s) => s.code);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
