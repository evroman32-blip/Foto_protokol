/**
 * Синхронизация положений JAW_RELATION с новым списком (15 пунктов).
 * Запуск:
 *   DATABASE_URL=... npx tsx tools/sync-jaw-relation-requirements.ts
 */
import { PrismaClient, MediaType } from '@prisma/client';

const prisma = new PrismaClient();

const ITEMS: Array<{
  code: string;
  name: string;
  mediaType: MediaType;
  specialRule?: string;
  instruction?: string;
}> = [
  { code: 'JR_LARIN_FRONT', name: 'Larin анфас', mediaType: 'PHOTO' },
  { code: 'JR_LARIN_PROFILE_RIGHT', name: 'Larin профиль справа', mediaType: 'PHOTO' },
  { code: 'JR_LARIN_PROFILE_LEFT', name: 'Larin профиль слева', mediaType: 'PHOTO' },
  {
    code: 'JR_BITE_HEIGHT_STAGE_1',
    name: 'Определение высоты прикуса (высота покоя)',
    mediaType: 'PHOTO',
  },
  {
    code: 'JR_BITE_HEIGHT_STAGE_2',
    name: 'Определение высоты прикуса (рабочая высота)',
    mediaType: 'PHOTO',
  },
  {
    code: 'JR_UPPER_RIM_INCISORS_FRONT',
    name: 'Видимость верхне-губной линии резцов анфас',
    mediaType: 'PHOTO',
  },
  {
    code: 'JR_UPPER_RIM_INCISORS_PROFILE',
    name: 'Видимость верхне-губной линии резцов профиль',
    mediaType: 'PHOTO',
  },
  { code: 'JR_MIDLINE', name: 'Средняя линия', mediaType: 'PHOTO' },
  { code: 'JR_CANINE_LINE', name: 'Клыковая линия', mediaType: 'PHOTO' },
  {
    code: 'JR_UPPER_LIP_SUPPORT_FRONT',
    name: 'Поддержка верхней губы анфас (оба шаблона, губы сомкнуты, без напряжения)',
    mediaType: 'PHOTO',
    instruction: 'Оба шаблона, губы сомкнуты, без напряжения',
  },
  {
    code: 'JR_UPPER_LIP_SUPPORT_PROFILE',
    name: 'Поддержка верхней губы профиль (оба шаблона, губы сомкнуты, без напряжения)',
    mediaType: 'PHOTO',
    instruction: 'Оба шаблона, губы сомкнуты, без напряжения',
  },
  {
    code: 'JR_DESIRED_TOOTH_FORM_FRONT',
    name: 'Желаемая форма зубов (фронт)',
    mediaType: 'PHOTO',
    specialRule: 'desiredToothShade',
    instruction: 'Выберите желаемый цвет зубов: BL1–BL4, B1, A1–A4',
  },
  {
    code: 'JR_OPTG_WITH_TEMPLATES',
    name: 'ОПТГ с шаблонами',
    mediaType: 'RADIOLOGY_IMAGE',
  },
  { code: 'JR_TMJ_RIGHT', name: 'R-грамма ВНЧС справа', mediaType: 'RADIOLOGY_IMAGE' },
  { code: 'JR_TMJ_LEFT', name: 'R-грамма ВНЧС слева', mediaType: 'RADIOLOGY_IMAGE' },
];

async function main() {
  const templates = await prisma.stageTemplate.findMany({
    where: { code: 'JAW_RELATION' },
    include: { mediaRequirements: true },
  });
  if (!templates.length) {
    throw new Error('StageTemplate JAW_RELATION not found');
  }

  const keepCodes = new Set(ITEMS.map((i) => i.code));

  for (const template of templates) {
    console.log(`Template ${template.id} (${template.name})`);

    // Deactivate obsolete requirements (force)
    for (const req of template.mediaRequirements) {
      if (!keepCodes.has(req.code)) {
        await prisma.mediaRequirement.update({
          where: { id: req.id },
          data: { isActive: false },
        });
        console.log(`  deactivate ${req.code}`);
      }
    }

    for (let i = 0; i < ITEMS.length; i++) {
      const item = ITEMS[i]!;
      const sortOrder = i + 1;
      const existing = template.mediaRequirements.find((r) => r.code === item.code);
      if (existing) {
        await prisma.mediaRequirement.update({
          where: { id: existing.id },
          data: {
            name: item.name,
            mediaType: item.mediaType,
            sortOrder,
            isActive: true,
            required: true,
            minCount: 1,
            specialRule: item.specialRule ?? null,
            instruction: item.instruction ?? null,
          },
        });
        console.log(`  update ${sortOrder} ${item.code}`);
      } else {
        const created = await prisma.mediaRequirement.create({
          data: {
            protocolVersionId: template.protocolVersionId,
            stageTemplateId: template.id,
            code: item.code,
            name: item.name,
            mediaType: item.mediaType,
            sortOrder,
            isActive: true,
            required: true,
            minCount: 1,
            allowMultiple: false,
            specialRule: item.specialRule ?? null,
            instruction: item.instruction ?? null,
          },
        });
        console.log(`  create ${sortOrder} ${item.code}`);
        template.mediaRequirements.push(created);
      }
    }

    // Ensure all active requirements exist on open stages
    const active = await prisma.mediaRequirement.findMany({
      where: { stageTemplateId: template.id, isActive: true },
      select: { id: true },
    });
    const openStages = await prisma.stageInstance.findMany({
      where: {
        stageTemplateId: template.id,
        status: { not: 'CLOSED' },
        clinicalCase: { status: { notIn: ['COMPLETED', 'ARCHIVED'] } },
      },
      select: { id: true },
    });
    for (const stage of openStages) {
      for (const req of active) {
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
    console.log(`  active=${active.length}, stages=${openStages.length}`);
  }

  console.log('Done. Active JAW_RELATION requirements:', keepCodes.size);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
