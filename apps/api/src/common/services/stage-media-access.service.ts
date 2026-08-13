import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { StageInstanceStatus, UserRole } from '@mandarin/contracts';

import type { AuthUser } from '../decorators/current-user.decorator';
import { PrismaService } from './prisma.service';

/** Кто может править состав файлов уже закрытого этапа. */
const CLOSED_STAGE_EDITOR_ROLES: string[] = [UserRole.SYSTEM_ADMIN, UserRole.CHIEF_DOCTOR];

export const CLOSED_STAGE_MEDIA_MESSAGE =
  'Этап закрыт: менять состав загруженных файлов могут только главный врач и администратор.';

/**
 * Единая проверка для всех операций, меняющих состав медиаматериалов этапа
 * (загрузка, назначение, отклонение, архивация, срезы имплантатов, исследования).
 */
@Injectable()
export class StageMediaAccessService {
  constructor(private readonly prisma: PrismaService) {}

  canEditClosedStage(user?: AuthUser | null): boolean {
    return Boolean(user && CLOSED_STAGE_EDITOR_ROLES.includes(user.role));
  }

  /** Возвращает статус этапа, чтобы вызывающий код не сбрасывал CLOSED. */
  async assertCanMutateStage(stageInstanceId: string, user: AuthUser): Promise<string> {
    const stage = await this.prisma.stageInstance.findUnique({
      where: { id: stageInstanceId },
      select: { status: true },
    });
    if (!stage) throw new NotFoundException('Этап не найден');

    if (stage.status === StageInstanceStatus.CLOSED && !this.canEditClosedStage(user)) {
      throw new ForbiddenException(CLOSED_STAGE_MEDIA_MESSAGE);
    }

    return stage.status;
  }

  async assertCanMutateByBatch(uploadBatchId: string, user: AuthUser): Promise<string> {
    const batch = await this.prisma.uploadBatch.findUnique({
      where: { id: uploadBatchId },
      select: { stageInstanceId: true },
    });
    if (!batch) throw new NotFoundException('Пакет загрузки не найден');
    return this.assertCanMutateStage(batch.stageInstanceId, user);
  }

  async assertCanMutateByMediaAsset(mediaAssetId: string, user: AuthUser): Promise<string> {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: mediaAssetId },
      select: { stageInstanceId: true },
    });
    if (!asset) throw new NotFoundException('Файл не найден');
    return this.assertCanMutateStage(asset.stageInstanceId, user);
  }

  async assertCanMutateByImplantRecord(implantRecordId: string, user: AuthUser): Promise<string> {
    const record = await this.prisma.surgicalImplantRecord.findUnique({
      where: { id: implantRecordId },
      select: { stageInstanceId: true },
    });
    if (!record) throw new NotFoundException('Карточка имплантата не найдена');
    return this.assertCanMutateStage(record.stageInstanceId, user);
  }

  async assertCanMutateByRadiologyStudy(studyId: string, user: AuthUser): Promise<string> {
    const study = await this.prisma.radiologyStudy.findUnique({
      where: { id: studyId },
      select: { stageInstanceId: true },
    });
    if (!study) throw new NotFoundException('Исследование не найдено');
    return this.assertCanMutateStage(study.stageInstanceId, user);
  }

  isClosed(status: string | null | undefined): boolean {
    return status === StageInstanceStatus.CLOSED;
  }
}
