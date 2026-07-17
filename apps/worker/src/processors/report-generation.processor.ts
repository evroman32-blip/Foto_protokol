import { Job } from 'bullmq';
import { prisma } from '@mandarin/database';
import PDFDocument from 'pdfkit';

export function createReportGenerationProcessor() {
  return async (job: Job<{
    clinicalCaseId: string;
    stageInstanceId?: string;
    reportType: string;
    generatedBy: string;
  }>) => {
    const clinicalCase = await prisma.clinicalCase.findUniqueOrThrow({
      where: { id: job.data.clinicalCaseId },
      include: { patient: true },
    });

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument();
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.fontSize(18).text('Mandarin PhotoProtocol — отчёт');
      doc.moveDown();
      doc.fontSize(12).text(`Тип: ${job.data.reportType}`);
      doc.text(`Пациент: ${clinicalCase.patient.lastName} ${clinicalCase.patient.firstName}`);
      doc.end();
    });

    const objectKey = `reports/${job.data.reportType}/${job.data.clinicalCaseId}.pdf`;

    const report = await prisma.generatedReport.create({
      data: {
        clinicalCaseId: job.data.clinicalCaseId,
        stageInstanceId: job.data.stageInstanceId ?? null,
        reportType: job.data.reportType as never,
        objectKey,
        generatedBy: job.data.generatedBy,
        status: 'READY',
      },
    });

    return { reportId: report.id, sizeBytes: buffer.length, objectKey };
  };
}
