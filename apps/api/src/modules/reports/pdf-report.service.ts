import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { ReportType } from '@prisma/client';

@Injectable()
export class PdfReportService {
  async generateStageReport(data: {
    stageName: string;
    patientName: string;
    blockingReasons: string[];
  }): Promise<Buffer> {
    return this.renderPdf('Отчёт по этапу', (doc) => {
      doc.fontSize(16).text(`Этап: ${data.stageName}`);
      doc.moveDown();
      doc.fontSize(12).text(`Пациент: ${data.patientName}`);
      doc.moveDown();
      doc.text('Блокирующие причины:');
      data.blockingReasons.forEach((r) => doc.text(`• ${r}`));
    });
  }

  async generateCaseReport(data: {
    caseId: string;
    patientName: string;
    stages: Array<{ name: string; status: string }>;
  }): Promise<Buffer> {
    return this.renderPdf('Отчёт по клиническому случаю', (doc) => {
      doc.fontSize(16).text(`Случай: ${data.caseId}`);
      doc.text(`Пациент: ${data.patientName}`);
      doc.moveDown();
      data.stages.forEach((s) => doc.text(`${s.name}: ${s.status}`));
    });
  }

  async generateSurgicalRadiologyReport(data: {
    patientName: string;
    implants: Array<{ number: string; method: string | null }>;
  }): Promise<Buffer> {
    return this.renderPdf('Хирургический рентгенологический отчёт', (doc) => {
      doc.fontSize(16).text(`Пациент: ${data.patientName}`);
      doc.moveDown();
      data.implants.forEach((i) =>
        doc.text(`Имплантат ${i.number}: метод ${i.method ?? 'не указан'}`),
      );
    });
  }

  async generate(reportType: ReportType, payload: Record<string, unknown>): Promise<Buffer> {
    switch (reportType) {
      case ReportType.STAGE_REPORT:
        return this.generateStageReport(payload as never);
      case ReportType.CASE_REPORT:
        return this.generateCaseReport(payload as never);
      case ReportType.SURGICAL_RADIOLOGY_REPORT:
        return this.generateSurgicalRadiologyReport(payload as never);
      default:
        return this.renderPdf('Отчёт PhotoProtocol', (doc) => {
          doc.text(JSON.stringify(payload, null, 2));
        });
    }
  }

  private renderPdf(
    title: string,
    writer: (doc: InstanceType<typeof PDFDocument>) => void,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(20).text(title, { align: 'center' });
      doc.moveDown();
      writer(doc);
      doc.end();
    });
  }
}
