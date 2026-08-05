import type {
  StageCompletenessResult,
  StageClosurePermissionResult,
  AiClassificationResult,
  AssistantExplanation,
} from '@mandarin/contracts';

import { API_BASE } from './constants';
import { getStoredToken } from './auth';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  token?: string | null;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, token, headers, ...rest } = options;
  const authToken = token ?? (typeof window !== 'undefined' ? getStoredToken() : null);

  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => undefined);
    const raw = (errBody as { message?: string | string[] })?.message;
    const message = Array.isArray(raw) ? raw.join('; ') : raw ?? `HTTP ${res.status}`;
    throw new ApiError(message, res.status, errBody);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// --- Auth ---
export interface LoginResponse {
  accessToken: string;
  user: { id: string; email: string; role: string; staffMemberId?: string | null };
}

export const authApi = {
  login: (email: string, password: string) =>
    request<LoginResponse>('/api/v1/auth/login', { method: 'POST', body: { email, password } }),
  me: () => request<{ id: string; email: string; role: string }>('/api/v1/auth/me'),
};

// --- Patients ---
export interface PatientDto {
  id: string;
  lastName: string;
  firstName: string;
  middleName?: string | null;
  birthDate?: string | null;
  sex?: string;
  phone?: string | null;
  /** UI alias для localPatientNumber */
  cardNumber?: string | null;
  localPatientNumber?: string | null;
  source?: string;
  externalId?: string | null;
  createdAt?: string;
}

export interface PatientInput {
  lastName: string;
  firstName: string;
  middleName?: string;
  birthDate?: string;
  sex?: string;
  phone?: string;
  /** Номер карты — уходит в API как localPatientNumber */
  cardNumber?: string;
  localPatientNumber?: string;
}

function normalizePatient(p: PatientDto): PatientDto {
  const card = p.cardNumber ?? p.localPatientNumber ?? null;
  return {
    ...p,
    cardNumber: card,
    localPatientNumber: p.localPatientNumber ?? card,
  };
}

function toPatientPayload(data: Partial<PatientInput>) {
  const localPatientNumber = data.localPatientNumber ?? data.cardNumber;
  return {
    ...data,
    localPatientNumber,
    cardNumber: data.cardNumber ?? localPatientNumber,
  };
}

export const patientsApi = {
  list: async (params?: { q?: string }) => {
    const rows = await request<PatientDto[]>(
      `/api/v1/patients${params?.q ? `?q=${encodeURIComponent(params.q)}` : ''}`,
    );
    return rows.map(normalizePatient);
  },
  get: async (id: string) => normalizePatient(await request<PatientDto>(`/api/v1/patients/${id}`)),
  create: async (data: PatientInput) =>
    normalizePatient(
      await request<PatientDto>('/api/v1/patients', { method: 'POST', body: toPatientPayload(data) }),
    ),
  update: async (id: string, data: Partial<PatientInput>) =>
    normalizePatient(
      await request<PatientDto>(`/api/v1/patients/${id}`, {
        method: 'PATCH',
        body: toPatientPayload(data),
      }),
    ),
  remove: (id: string) => request<void>(`/api/v1/patients/${id}`, { method: 'DELETE' }),
};

// --- Staff ---
export interface StaffDto {
  id: string;
  lastName: string;
  firstName: string;
  middleName?: string | null;
  position?: string | null;
  specialization?: string | null;
  roles?: string[];
  isActive?: boolean;
  externalId?: string | null;
}

export interface StaffInput {
  lastName: string;
  firstName: string;
  middleName?: string;
  position?: string;
  specialization?: string;
  roles?: string[];
}

export const staffApi = {
  list: (params?: { q?: string; role?: string }) => {
    const search = new URLSearchParams();
    if (params?.q) search.set('q', params.q);
    if (params?.role) search.set('role', params.role);
    const qs = search.toString();
    return request<StaffDto[]>(`/api/v1/staff${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => request<StaffDto>(`/api/v1/staff/${id}`),
  create: (data: StaffInput) => request<StaffDto>('/api/v1/staff', { method: 'POST', body: data }),
  update: (id: string, data: Partial<StaffInput>) =>
    request<StaffDto>(`/api/v1/staff/${id}`, { method: 'PATCH', body: data }),
};

// --- Branches & Protocols ---
export interface BranchDto {
  id: string;
  code?: string;
  name: string;
  address?: string | null;
  isActive?: boolean;
}

export interface ProtocolVersionDto {
  id: string;
  version: string;
  status: string;
  protocolId: string;
  protocolName?: string;
  protocolCode?: string | null;
  protocol?: { id: string; name: string; code: string };
  stageTemplates?: StageTemplateAdminDto[];
}

export interface MediaRequirementAdminDto {
  id: string;
  stageTemplateId: string;
  code: string;
  name: string;
  description?: string | null;
  mediaType: string;
  required: boolean;
  minCount: number;
  maxCount?: number | null;
  sortOrder: number;
  isActive: boolean;
  instruction?: string | null;
}

export interface StageTemplateAdminDto {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  sortOrder: number;
  ownerRole: string;
  dependsOnStageCode?: string | null;
  isActive?: boolean;
  mediaRequirements?: MediaRequirementAdminDto[];
}

function normalizeProtocolVersion(v: ProtocolVersionDto): ProtocolVersionDto {
  return {
    ...v,
    protocolName: v.protocolName ?? v.protocol?.name ?? v.protocolId,
    protocolCode: v.protocolCode ?? v.protocol?.code ?? null,
  };
}

export const adminApi = {
  branches: (params?: { active?: boolean | 'all' }) => {
    const search = new URLSearchParams();
    if (params?.active === true) search.set('active', 'true');
    const qs = search.toString();
    return request<BranchDto[]>(`/api/v1/branches${qs ? `?${qs}` : ''}`);
  },
  createBranch: (data: { code: string; name: string; address?: string }) =>
    request<BranchDto>('/api/v1/branches', { method: 'POST', body: data }),
  updateBranch: (id: string, data: Partial<BranchDto>) =>
    request<BranchDto>(`/api/v1/branches/${id}`, { method: 'PATCH', body: data }),
  protocolVersions: async () => {
    const rows = await request<ProtocolVersionDto[]>('/api/v1/admin/protocol-versions');
    return rows.map(normalizeProtocolVersion);
  },
  protocolVersion: async (protocolId: string, versionId: string) =>
    normalizeProtocolVersion(
      await request<ProtocolVersionDto>(`/api/v1/admin/protocols/${protocolId}/versions/${versionId}`),
    ),
  updateStageTemplate: (id: string, data: Partial<StageTemplateAdminDto>) =>
    request<StageTemplateAdminDto>(`/api/v1/admin/stage-templates/${id}`, {
      method: 'PATCH',
      body: data,
    }),
  createMediaRequirement: (data: {
    stageTemplateId: string;
    code: string;
    name: string;
    mediaType: string;
    required?: boolean;
    minCount?: number;
    maxCount?: number | null;
    sortOrder?: number;
    instruction?: string;
  }) =>
    request<MediaRequirementAdminDto>('/api/v1/admin/media-requirements', {
      method: 'POST',
      body: data,
    }),
  updateMediaRequirement: (id: string, data: Partial<MediaRequirementAdminDto>) =>
    request<MediaRequirementAdminDto>(`/api/v1/admin/media-requirements/${id}`, {
      method: 'PATCH',
      body: data,
    }),
  deleteMediaRequirement: (id: string) =>
    request<{ ok: boolean }>(`/api/v1/admin/media-requirements/${id}`, {
      method: 'DELETE',
    }),
  createImplantMethod: (data: {
    code: string;
    nameRu: string;
    methodNumber?: number;
    submethodCode?: string;
    jawScope?: string;
    sortOrder?: number;
  }) =>
    request<ImplantMethodDto>('/api/v1/admin/implant-placement-methods', {
      method: 'POST',
      body: data,
    }),
  updateImplantMethod: (
    id: string,
    data: Partial<ImplantMethodDto> & { code?: string },
  ) =>
    request<ImplantMethodDto>(`/api/v1/admin/implant-placement-methods/${id}`, {
      method: 'PATCH',
      body: data,
    }),
  implantTypes: (params?: { active?: boolean | 'all' }) => {
    const search = new URLSearchParams();
    if (params?.active === 'all') search.set('active', 'all');
    else if (params?.active === false) search.set('active', 'false');
    const qs = search.toString();
    return request<ImplantTypeDto[]>(`/api/v1/admin/implant-types${qs ? `?${qs}` : ''}`);
  },
  createImplantType: (data: {
    code: string;
    nameRu: string;
    brand?: string;
    description?: string;
    sortOrder?: number;
  }) =>
    request<ImplantTypeDto>('/api/v1/admin/implant-types', { method: 'POST', body: data }),
  updateImplantType: (id: string, data: Partial<ImplantTypeDto>) =>
    request<ImplantTypeDto>(`/api/v1/admin/implant-types/${id}`, {
      method: 'PATCH',
      body: data,
    }),
  implantMethods: (params?: { q?: string; jawScope?: string; active?: boolean | 'all' }) => {
    const search = new URLSearchParams();
    if (params?.q) search.set('q', params.q);
    if (params?.jawScope) search.set('jawScope', params.jawScope);
    if (params?.active === 'all') search.set('active', 'all');
    else if (params?.active === false) search.set('active', 'false');
    else if (params?.active === true) search.set('active', 'true');
    const qs = search.toString();
    return request<ImplantMethodDto[]>(`/api/v1/admin/implant-placement-methods${qs ? `?${qs}` : ''}`);
  },
  settings: () => request<Record<string, unknown>>('/api/v1/admin/settings'),
  yandexAi: () => request<Record<string, unknown>>('/api/v1/admin/yandex-ai'),
  stoma1c: () => request<Record<string, unknown>>('/api/v1/admin/stoma1c'),
};

export interface ImplantMethodDto {
  id: string;
  code: string;
  methodNumber: number;
  submethodCode?: string | null;
  nameRu: string;
  nameEn?: string | null;
  shortDescription?: string | null;
  anatomicalRegion?: string | null;
  jawScope: string;
  isActive: boolean;
  sortOrder: number;
}

export interface ImplantTypeDto {
  id: string;
  code: string;
  nameRu: string;
  brand?: string | null;
  description?: string | null;
  isActive: boolean;
  sortOrder: number;
}

// --- Cases ---
export interface CaseParticipantDto {
  id: string;
  participantRole: string;
  staffMemberId: string;
  isPrimary: boolean;
  staffMember?: StaffDto;
}

export interface StageInstanceDto {
  id: string;
  status: string;
  stageTemplate: { id: string; code: string; name: string; sortOrder: number };
  impressionCaptureMode?: 'SCAN' | 'IMPRESSION' | null;
  desiredToothShade?: string | null;
  completeness?: StageCompletenessResult;
  closurePermission?: StageClosurePermissionResult;
}

export interface ClinicalCaseDto {
  id: string;
  clinicalScenario: string;
  jawScope: string;
  treatmentStartDate: string;
  status: string;
  patient: PatientDto;
  branch?: BranchDto | null;
  protocolVersion: ProtocolVersionDto;
  participants: CaseParticipantDto[];
  /** Normalized from API `stages` when needed */
  stageInstances: StageInstanceDto[];
  /** Raw Prisma field — kept optional for compatibility */
  stages?: StageInstanceDto[];
  externalRefs?: Array<{ externalId: string; system: string }>;
  createdAt?: string;
}

function normalizeCase(c: ClinicalCaseDto & { stages?: StageInstanceDto[] }): ClinicalCaseDto {
  return {
    ...c,
    stageInstances: c.stageInstances ?? c.stages ?? [],
  };
}

export interface CreateCaseInput {
  patientId: string;
  clinicalScenario: string;
  jawScope: string;
  treatmentStartDate: string;
  branchId?: string;
  protocolVersionId: string;
  consultingDoctorId: string;
  orthopedistId: string;
  surgeonId: string;
  dentalTechnicianId: string;
  externalClinicalCaseId?: string;
}

function toCreateCasePayload(data: CreateCaseInput) {
  return {
    patientId: data.patientId,
    clinicalScenario: data.clinicalScenario,
    jawScope: data.jawScope,
    treatmentStartDate: data.treatmentStartDate,
    branchId: data.branchId,
    protocolVersionId: data.protocolVersionId,
    participants: [
      {
        staffMemberId: data.consultingDoctorId,
        participantRole: 'CONSULTING_DOCTOR',
        isPrimary: true,
      },
      {
        staffMemberId: data.orthopedistId,
        participantRole: 'ORTHOPEDIST',
        isPrimary: true,
      },
      {
        staffMemberId: data.surgeonId,
        participantRole: 'SURGEON',
        isPrimary: true,
      },
      {
        staffMemberId: data.dentalTechnicianId,
        participantRole: 'DENTAL_TECHNICIAN',
        isPrimary: true,
      },
    ],
  };
}

export const casesApi = {
  list: async (params?: { status?: string }) => {
    const qs = params?.status ? `?status=${params.status}` : '';
    const rows = await request<ClinicalCaseDto[]>(`/api/v1/cases${qs}`);
    return rows.map(normalizeCase);
  },
  get: async (id: string) => normalizeCase(await request<ClinicalCaseDto>(`/api/v1/cases/${id}`)),
  create: async (data: CreateCaseInput) =>
    normalizeCase(
      await request<ClinicalCaseDto>('/api/v1/cases', {
        method: 'POST',
        body: toCreateCasePayload(data),
      }),
    ),
};

// --- Stages ---
export interface MediaRequirementDto {
  id: string;
  code: string;
  name: string;
  mediaType: string;
  required: boolean;
  minCount: number;
  maxCount?: number | null;
  sortOrder: number;
  isActive?: boolean;
  specialRule?: string | null;
  instruction?: string | null;
}

export interface RequirementInstanceDto {
  id: string;
  status?: string;
  mediaRequirement: MediaRequirementDto;
}

export interface MediaAssetDto {
  id: string;
  mediaType: string;
  toothPositionFdi?: string | null;
  status: string;
  originalFilename?: string;
  originalFileName?: string;
  displayName?: string | null;
  positionName?: string | null;
  requirementCode?: string | null;
  sortOrder?: number | null;
  mediaRequirementId?: string | null;
  mimeType?: string;
  assignments?: Array<{
    id: string;
    requirementCode?: string | null;
    requirementInstanceId?: string | null;
    source: string;
    status: string;
    confidence?: number;
    requirementInstance?: {
      mediaRequirement?: { id: string; code: string; name: string; sortOrder?: number };
    };
  }>;
}

export interface MediaViewUrlDto {
  id: string;
  url: string;
  /** Same-origin путь к оригиналу (cookie auth) */
  contentPath?: string;
  /** Same-origin путь к превью ~1280px (если нет — API отдаст оригинал) */
  previewPath?: string;
  hasPreview?: boolean;
  mimeType: string;
  mediaType: string;
  originalFileName: string;
  displayName: string;
  title: string;
  requirementCode?: string | null;
  fileSizeBytes?: number;
}

export interface StageDetailDto extends StageInstanceDto {
  clinicalCaseId: string;
  mediaAssets: MediaAssetDto[];
  requirementInstances?: RequirementInstanceDto[];
  auditEvents?: AuditEventDto[];
  dependencyBlockers?: StageCompletenessResult['dependencyBlockers'];
}

export const stagesApi = {
  get: (id: string) => request<StageDetailDto>(`/api/v1/stages/${id}`),
  completeness: (id: string) => request<StageCompletenessResult>(`/api/v1/stages/${id}/completeness`),
  closurePermission: (id: string) =>
    request<StageClosurePermissionResult>(`/api/v1/stages/${id}/closure-permission`),
  close: (id: string) => request<{ success: boolean }>(`/api/v1/stages/${id}/close`, { method: 'POST' }),
  confirmDoctor: (id: string, confirmationText?: string) =>
    request<{ id: string }>(`/api/v1/stages/${id}/confirm`, {
      method: 'POST',
      body: confirmationText ? { confirmationText } : {},
    }),
  setImpressionCaptureMode: (id: string, impressionCaptureMode: 'SCAN' | 'IMPRESSION') =>
    request<StageDetailDto>(`/api/v1/stages/${id}/impression-capture-mode`, {
      method: 'PATCH',
      body: { impressionCaptureMode },
    }),
  setDesiredToothShade: (id: string, desiredToothShade: string) =>
    request<StageDetailDto>(`/api/v1/stages/${id}/desired-tooth-shade`, {
      method: 'PATCH',
      body: { desiredToothShade },
    }),
  emergency: (id: string, data: { description: string }) =>
    request<{ id: string }>(`/api/v1/stages/${id}/emergency-events`, { method: 'POST', body: data }),
};

// --- Upload ---
export interface PresignResponse {
  uploadUrl: string;
  objectKey: string;
  uploadId: string;
  originalFileName?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  /** legacy alias — may be absent until files/complete */
  mediaAssetId?: string;
}

export const uploadApi = {
  createBatch: (stageInstanceId: string) =>
    request<{ batchId: string }>('/api/v1/upload/batches', {
      method: 'POST',
      body: { stageInstanceId },
    }),
  presign: (batchId: string, file: { filename: string; mimeType: string; size: number }) =>
    request<PresignResponse>(`/api/v1/upload/batches/${batchId}/presign`, {
      method: 'POST',
      body: file,
    }),
  completeFile: (
    batchId: string,
    data: {
      uploadId: string;
      objectKey: string;
      originalFileName: string;
      mimeType: string;
      fileSizeBytes: number;
    },
  ) =>
    request<MediaAssetDto>(`/api/v1/upload-batches/${batchId}/files/complete`, {
      method: 'POST',
      body: data,
    }),
  completeBatch: (batchId: string) =>
    request<{ success: boolean }>(`/api/v1/upload/batches/${batchId}/complete`, { method: 'POST' }),
  /**
   * Загрузка через Nest API (MinIO изнутри Docker), не прямой PUT на signed URL.
   * На Timeweb signed URL к MinIO часто даёт 403 SignatureDoesNotMatch.
   */
  uploadFile: async (
    batchId: string,
    presign: PresignResponse,
    file: File,
    onProgress?: (pct: number) => void,
  ): Promise<void> => {
    const authToken = typeof window !== 'undefined' ? getStoredToken() : null;
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('objectKey', presign.objectKey);
    form.append('uploadId', presign.uploadId);
    form.append('mimeType', file.type || 'application/octet-stream');

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE}/api/v1/upload-batches/${batchId}/files/put`);
      if (authToken) xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
      xhr.withCredentials = true;
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else {
          let message = `Upload failed (${xhr.status})`;
          try {
            const body = JSON.parse(xhr.responseText) as { message?: string | string[] };
            const raw = body.message;
            message = Array.isArray(raw) ? raw.join('; ') : raw ?? message;
          } catch {
            /* keep default */
          }
          reject(new Error(message));
        }
      };
      xhr.onerror = () => reject(new Error('Upload failed'));
      xhr.send(form);
    });
  },
};

export const mediaApi = {
  viewUrl: (mediaAssetId: string) =>
    request<MediaViewUrlDto>(`/api/v1/media/${mediaAssetId}/view-url`),
  /** Бинарное содержимое файла (STL и др.) через API — без CORS к S3 */
  fetchContent: async (mediaAssetId: string): Promise<ArrayBuffer> => {
    const authToken = typeof window !== 'undefined' ? getStoredToken() : null;
    const res = await fetch(`${API_BASE}/api/v1/media/${mediaAssetId}/content`, {
      headers: {
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      credentials: 'include',
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => undefined);
      const raw = (errBody as { message?: string | string[] })?.message;
      const message = Array.isArray(raw) ? raw.join('; ') : raw ?? `HTTP ${res.status}`;
      throw new ApiError(message, res.status, errBody);
    }
    return res.arrayBuffer();
  },
  archive: (mediaAssetId: string) =>
    request<{ id: string }>(`/api/v1/media/${mediaAssetId}/archive`, { method: 'POST' }),
  cleanupDuplicates: (stageInstanceId: string) =>
    request<{ archivedCount: number; message: string }>(
      `/api/v1/stages/${stageInstanceId}/media/cleanup-duplicates`,
      { method: 'POST' },
    ),
  assign: (
    mediaAssetId: string,
    data: { requirementInstanceId?: string; requirementCode?: string; source: 'DOCTOR' | 'AI' | 'SURGEON' },
  ) =>
    request<{ id: string }>(`/api/v1/media/${mediaAssetId}/assignment`, {
      method: 'POST',
      body: data,
    }),
  confirmAssignment: (assignmentId: string, requirementCode: string) =>
    request<{ success: boolean }>(`/api/v1/media-assignments/${assignmentId}/confirm`, {
      method: 'POST',
      body: { requirementCode },
    }),
};

// --- Radiology / Surgical ---
export interface RadiologyStudyDto {
  id: string;
  studyType: string;
  status?: string;
  mediaAssetId?: string;
  optgStatus?: string;
}

export interface SurgicalImplantDto {
  id: string;
  implantNumber: number | string;
  implantLabel?: string | null;
  jawScope: string;
  side?: string;
  toothPositionFdi?: string | null;
  implantTypeId?: string | null;
  implantType?: ImplantTypeDto | null;
  actualMethodCode?: string | null;
  actualSubmethodCode?: string | null;
  status: string;
  surgeonComment?: string | null;
  attachments?: Array<{
    id: string;
    attachmentType: string;
    surgeonConfirmed: boolean;
    mediaAssetId: string;
    mediaAsset?: { id: string; originalFileName?: string | null; mimeType?: string | null };
  }>;
  radiologyAttachments?: Array<{
    id: string;
    attachmentType: string;
    surgeonConfirmed: boolean;
    mediaAssetId: string;
    mediaAsset?: { id: string; originalFileName?: string | null; mimeType?: string | null };
  }>;
}

export interface SurgeonConfirmationDto {
  id: string;
  confirmedAt: string;
  allImplantsDocumented: boolean;
  optgUploaded: boolean;
  cbctUploaded: boolean;
  allImplantsHaveCtSlices: boolean;
  allImplantsHaveMethodSelected: boolean;
  hasImplantsForReview: boolean;
  comment?: string | null;
}

export const radiologyApi = {
  studies: (stageInstanceId: string) =>
    request<RadiologyStudyDto[]>(`/api/v1/stages/${stageInstanceId}/radiology-studies`),
  implants: (stageInstanceId: string) =>
    request<SurgicalImplantDto[]>(`/api/v1/stages/${stageInstanceId}/implant-records`),
  createImplant: (stageInstanceId: string, data: Record<string, unknown>) =>
    request<SurgicalImplantDto>(`/api/v1/stages/${stageInstanceId}/implant-records`, {
      method: 'POST',
      body: data,
    }),
  updateImplant: (implantId: string, data: Record<string, unknown>) =>
    request<SurgicalImplantDto>(`/api/v1/implant-records/${implantId}`, {
      method: 'PATCH',
      body: data,
    }),
  deleteImplant: (implantId: string) =>
    request<{ id: string }>(`/api/v1/implant-records/${implantId}`, { method: 'DELETE' }),
  attachSlice: (
    implantId: string,
    data: { mediaAssetId: string; attachmentType?: string; surgeonConfirmed?: boolean },
  ) =>
    request<{ id: string }>(`/api/v1/implants/records/${implantId}/attachments`, {
      method: 'POST',
      body: data,
    }),
  implantTypes: () => request<ImplantTypeDto[]>('/api/v1/implants/types'),
  implantMethods: () => request<ImplantMethodDto[]>('/api/v1/implants/methods'),
  surgeonConfirmation: (stageInstanceId: string) =>
    request<SurgeonConfirmationDto | null>(`/api/v1/stages/${stageInstanceId}/surgeon-confirmation`),
  confirmSurgeon: (
    stageInstanceId: string,
    data: {
      comment?: string;
      allImplantsDocumented: boolean;
      optgUploaded: boolean;
      cbctUploaded: boolean;
      allImplantsHaveCtSlices: boolean;
      allImplantsHaveMethodSelected: boolean;
    },
  ) =>
    request<SurgeonConfirmationDto>(`/api/v1/stages/${stageInstanceId}/surgeon-confirmation`, {
      method: 'POST',
      body: data,
    }),
};

// --- AI ---
export const aiApi = {
  classify: (mediaAssetId: string) =>
    request<AiClassificationResult>(`/api/v1/ai/classify/${mediaAssetId}`, { method: 'POST' }),
  explainBlocking: (stageInstanceId: string) =>
    request<AssistantExplanation>(`/api/v1/ai/stages/${stageInstanceId}/explain-blocking`, {
      method: 'POST',
    }),
  confirmAssignment: (assignmentId: string, requirementCode: string) =>
    request<{ success: boolean }>(`/api/v1/media-assignments/${assignmentId}/confirm`, {
      method: 'POST',
      body: { requirementCode },
    }),
};

// --- Audit & Management ---
export interface AuditEventDto {
  id: string;
  eventType: string;
  actorUserId?: string | null;
  actorEmail?: string | null;
  clinicalCaseId?: string | null;
  stageInstanceId?: string | null;
  payload?: Record<string, unknown>;
  createdAt: string;
}

export interface EmergencyEventDto {
  id: string;
  occurredAt: string;
  reason: string;
  clinicalSituation: string;
}

export interface IntegrationEventDto {
  id: string;
  eventType: string;
  status?: string;
  createdAt: string;
}

export type IntegrationEventsResponse =
  | IntegrationEventDto[]
  | { enabled: boolean; status?: string; events: IntegrationEventDto[] };

export const managementApi = {
  audit: (params?: { from?: string; to?: string; eventType?: string; caseId?: string }) => {
    const search = new URLSearchParams();
    if (params?.from) search.set('from', params.from);
    if (params?.to) search.set('to', params.to);
    if (params?.eventType) search.set('eventType', params.eventType);
    if (params?.caseId) search.set('caseId', params.caseId);
    const qs = search.toString();
    return request<AuditEventDto[]>(`/api/v1/audit${qs ? `?${qs}` : ''}`);
  },
  emergencyEvents: () => request<EmergencyEventDto[]>('/api/v1/management/emergency-events'),
  integrationEvents: () => request<IntegrationEventsResponse>('/api/v1/management/integration-events'),
  reports: () => request<Array<{ id: string; reportType: string; generatedAt: string }>>('/api/v1/management/reports'),
};

export async function checkApiHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/health`, { cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
}

/** Универсальный клиент для страниц MVP */
export const api = {
  get: <T = any>(path: string) => request<T>(path),
  post: <T = any>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body }),
  patch: <T = any>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body }),
  delete: <T = any>(path: string) => request<T>(path, { method: 'DELETE' }),
};
