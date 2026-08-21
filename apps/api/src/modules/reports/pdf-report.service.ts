import { existsSync } from 'fs';
import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { ReportType } from '@prisma/client';
import { isImplantSliceCardsRequirement } from '@mandarin/contracts';

export type ProtocolPdfStage = {
  name: string;
  sortOrder: number;
  isActive?: boolean | null;
  mediaRequirements: Array<{
    name: string;
    code?: string | null;
    mediaType: string;
    instruction?: string | null;
    description?: string | null;
    sortOrder: number;
    isActive?: boolean | null;
    specialRule?: string | null;
  }>;
};

type FontPair = { regular: string; bold: string };

function resolveCyrillicFonts(): FontPair | null {
  const candidates: FontPair[] = [
    {
      regular: 'C:\\Windows\\Fonts\\arial.ttf',
      bold: 'C:\\Windows\\Fonts\\arialbd.ttf',
    },
    {
      regular: '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
      bold: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    },
    {
      regular: '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
      bold: '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    },
  ];
  for (const fonts of candidates) {
    if (existsSync(fonts.regular)) {
      return {
        regular: fonts.regular,
        bold: existsSync(fonts.bold) ? fonts.bold : fonts.regular,
      };
    }
  }
  return null;
}

function isRemovedCtDicomRequirement(req: {
  code?: string | null;
  name?: string | null;
  mediaType?: string | null;
}) {
  const code = (req.code ?? '').toUpperCase();
  const name = req.name ?? '';
  const mediaType = req.mediaType ?? '';
  return (
    mediaType === 'RADIOLOGY_STUDY' ||
    mediaType === 'DICOM_SERIES' ||
    code === 'POSTOP_CBCT_STUDY' ||
    code === 'POSTOP_IMPLANT_CT_SLICES' ||
    code.includes('CBCT') ||
    code.includes('DICOM') ||
    name.includes('КЛКТ') ||
    name.includes('КТ-срезы') ||
    name.includes('DICOM')
  );
}

function uploadFileTypeLabel(req: {
  mediaType: string;
  code?: string | null;
  name?: string | null;
  specialRule?: string | null;
}): string {
  if (isImplantSliceCardsRequirement(req)) {
    return 'Фото (карточки срезов JPG)';
  }
  switch (req.mediaType) {
    case 'PHOTO':
      return 'Фото';
    case 'VIDEO':
      return 'Видео';
    case 'DOCUMENT':
      return 'Документ';
    case 'STL':
      return 'STL (3D-модель)';
    case 'RADIOLOGY_IMAGE':
      return 'Рентген-изображение';
    case 'STRUCTURED_DATA':
      return 'Структурированные данные';
    case 'STRUCTURED_CONFIRMATION':
      return 'Подтверждение';
    default:
      return req.mediaType;
  }
}

function safePdfFilename(name: string, version: string): string {
  const base = (name || 'protocol')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  const ver = (version || '1').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_');
  return `${base || 'protocol'}_v${ver}.pdf`;
}

@Injectable()
export class PdfReportService {
  protocolPdfFilename(protocolName: string, version: string): string {
    return safePdfFilename(protocolName, version);
  }

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

  async generateProtocolSpecification(data: {
    protocolName: string;
    version: string;
    status?: string | null;
    stages: ProtocolPdfStage[];
  }): Promise<Buffer> {
    return this.collectPdf((doc, fonts) => {
      const regular = fonts?.regular ?? 'Helvetica';
      const bold = fonts?.bold ?? 'Helvetica-Bold';

      doc.font(bold).fontSize(18).text(data.protocolName || 'Протокол', { align: 'left' });
      doc.moveDown(0.35);
      doc
        .font(regular)
        .fontSize(10)
        .fillColor('#4b5563')
        .text(`Версия ${data.version}${data.status ? ` · статус ${data.status}` : ''}`);
      doc
        .fontSize(9)
        .text(
          `Сформировано ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`,
        );
      doc.fillColor('#111827');
      doc.moveDown(0.8);
      doc
        .moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .strokeColor('#d1d5db')
        .stroke();
      doc.moveDown(0.8);

      const stages = data.stages
        .filter((stage) => stage.isActive !== false)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      if (!stages.length) {
        doc.font(regular).fontSize(11).text('В протоколе нет активных этапов.');
        return;
      }

      stages.forEach((stage, stageIndex) => {
        const stageNumber = stage.sortOrder > 0 ? stage.sortOrder : stageIndex + 1;
        const positions = [...(stage.mediaRequirements ?? [])]
          .filter((req) => req.isActive !== false && !isRemovedCtDicomRequirement(req))
          .sort((a, b) => a.sortOrder - b.sortOrder);

        doc.font(bold).fontSize(13).fillColor('#111827').text(`${stageNumber}. ${stage.name}`);
        doc.moveDown(0.35);

        if (!positions.length) {
          doc.font(regular).fontSize(10).fillColor('#6b7280').text('Нет активных положений.');
          doc.moveDown(0.6);
          return;
        }

        positions.forEach((req, posIndex) => {
          const posNumber = posIndex + 1;
          doc
            .font(bold)
            .fontSize(11)
            .fillColor('#111827')
            .text(`${stageNumber}.${posNumber}. ${req.name || 'Положение'}`);
          doc
            .font(regular)
            .fontSize(10)
            .fillColor('#111827')
            .text(`Тип файла для загрузки: ${uploadFileTypeLabel(req)}`);
          const description = (req.instruction || req.description || '').trim();
          if (description) {
            doc.moveDown(0.15);
            doc.font(bold).fontSize(10).text('Описание:');
            doc.font(regular).fontSize(10).text(description, { align: 'left' });
          }
          doc.moveDown(0.45);
        });

        doc.moveDown(0.25);
      });
    });
  }

  private applyCyrillicFonts(doc: InstanceType<typeof PDFDocument>): FontPair | null {
    const files = resolveCyrillicFonts();
    if (!files) return null;
    doc.registerFont('ProtocolSans', files.regular);
    doc.registerFont('ProtocolSans-Bold', files.bold);
    doc.font('ProtocolSans');
    return { regular: 'ProtocolSans', bold: 'ProtocolSans-Bold' };
  }

  private collectPdf(
    writer: (doc: InstanceType<typeof PDFDocument>, fonts: FontPair | null) => void,
    title?: string,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        margin: 48,
        size: 'A4',
        info: title ? { Title: title, Author: 'Mandarin PhotoProtocol' } : { Author: 'Mandarin PhotoProtocol' },
      });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      const fonts = this.applyCyrillicFonts(doc);
      writer(doc, fonts);
      doc.end();
    });
  }

  private renderPdf(
    title: string,
    writer: (doc: InstanceType<typeof PDFDocument>) => void,
  ): Promise<Buffer> {
    return this.collectPdf((doc, fonts) => {
      doc.font(fonts?.bold ?? 'Helvetica-Bold').fontSize(20).text(title, { align: 'center' });
      doc.moveDown();
      doc.font(fonts?.regular ?? 'Helvetica');
      writer(doc);
    }, title);
  }
}
