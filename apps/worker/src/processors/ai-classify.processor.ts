import { Job } from 'bullmq';
import { prisma } from '@mandarin/database';
import { AssignmentSource, AssignmentStatus } from '@mandarin/contracts';

export function createAiClassifyProcessor() {
  return async (job: Job<{ mediaAssetId: string }>) => {
    const asset = await prisma.mediaAsset.findUniqueOrThrow({
      where: { id: job.data.mediaAssetId },
      include: {
        stageInstance: {
          include: {
            requirementInstances: { include: { mediaRequirement: true } },
          },
        },
      },
    });

    const codes = asset.stageInstance.requirementInstances
      .map((ri) => ri.mediaRequirement.code)
      .filter(Boolean);

    const suggestionCode = codes[0] ?? null;
    if (!suggestionCode) {
      return { mediaAssetId: asset.id, suggestions: [] };
    }

    await prisma.mediaAssignment.create({
      data: {
        mediaAssetId: asset.id,
        source: AssignmentSource.AI,
        status: AssignmentStatus.SUGGESTED,
        confidence: 0.8,
      },
    });

    await prisma.mediaAsset.update({
      where: { id: asset.id },
      data: { status: 'AI_SUGGESTED' },
    });

    return { mediaAssetId: asset.id, suggestionCode };
  };
}
