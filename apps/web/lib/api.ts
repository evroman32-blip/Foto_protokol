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
    throw new ApiError(
      (errBody as { message?: string })?.message ?? `HTTP ${res.status}`,
      res.status,
      errBody,
    );
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
  cardNumber?: string | null;
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
  cardNumber?: string;
}

export const patientsApi = {
  list: (params?: { q?: string }) =>
    request<PatientDto[]>(`/api/v1/patients${params?.q ? `?q=${encodeURIComponent(params.q)}` : ''}`),
  get: (id: string) => request<PatientDto>(`/api/v1/patients/${id}`),
  create: (data: PatientInput) => request<PatientDto>('/api/v1/patients', { method: 'POST', body: data }),
  update: (id: string, data: Partial<PatientInput>) =>
    request<PatientDto>(`/api/v1/patients/${id}`, { method: 'PATCH', body: data }),
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
  name: string;
  address?: string | null;
}

export interface ProtocolVersionDto {
  id: string;
  version: string;
  status: string;
  protocolId: string;
  protocolName?: string;
}

export const adminApi = {
  branches: () => request<BranchDto[]>('/api/v1/branches'),
  protocolVersions: () => request<ProtocolVersionDto[]>('/api/v1/admin/protocol-versions'),
  protocolVersion: (protocolId: string, versionId: string) =>
    request<ProtocolVersionDto>(`/api/v1/admin/protocols/${protocolId}/versions/${versionId}`),
  implantMethods: (params?: { q?: string; jawScope?: string; active?: boolean }) => {
    const search = new URLSearchParams();
    if (params?.q) search.set('q', params.q);
    if (params?.jawScope) search.set('jawScope', params.jawScope);
    if (params?.active !== undefined) search.set('active', String(params.active));
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
  stageInstances: StageInstanceDto[];
  externalRefs?: Array<{ externalId: string; system: string }>;
  createdAt?: string;
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

export const casesApi = {
  list: (params?: { status?: string }) => {
    const qs = params?.status ? `?status=${params.status}` : '';
    return request<ClinicalCaseDto[]>(`/api/v1/cases${qs}`);
  },
  get: (id: string) => request<ClinicalCaseDto>(`/api/v1/cases/${id}`),
  create: (data: CreateCaseInput) => request<ClinicalCaseDto>('/api/v1/cases', { method: 'POST', body: data }),
};

// --- Stages ---
export interface MediaAssetDto {
  id: string;
  mediaType: string;
  status: string;
  originalFilename?: string;
  mimeType?: string;
  assignments?: Array<{
    id: string;
    requirementCode: string;
    source: string;
    status: string;
    confidence?: number;
  }>;
}

export interface StageDetailDto extends StageInstanceDto {
  clinicalCaseId: string;
  mediaAssets: MediaAssetDto[];
  auditEvents?: AuditEventDto[];
  dependencyBlockers?: StageCompletenessResult['dependencyBlockers'];
}

export const stagesApi = {
  get: (id: string) => request<StageDetailDto>(`/api/v1/stages/${id}`),
  completeness: (id: string) => request<StageCompletenessResult>(`/api/v1/stages/${id}/completeness`),
  closurePermission: (id: string) =>
    request<StageClosurePermissionResult>(`/api/v1/stages/${id}/closure-permission`),
  close: (id: string) => request<{ success: boolean }>(`/api/v1/stages/${id}/close`, { method: 'POST' }),
  confirmDoctor: (id: string) =>
    request<{ success: boolean }>(`/api/v1/stages/${id}/confirm-doctor`, { method: 'POST' }),
  emergency: (id: string, data: { description: string }) =>
    request<{ id: string }>(`/api/v1/stages/${id}/emergency-events`, { method: 'POST', body: data }),
};

// --- Upload ---
export interface PresignResponse {
  uploadUrl: string;
  objectKey: string;
  mediaAssetId: string;
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
  completeBatch: (batchId: string) =>
    request<{ success: boolean }>(`/api/v1/upload/batches/${batchId}/complete`, { method: 'POST' }),
  uploadFile: async (
    presign: PresignResponse,
    file: File,
    onProgress?: (pct: number) => void,
  ): Promise<void> => {
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', presign.uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('Upload failed')));
      xhr.onerror = () => reject(new Error('Upload failed'));
      xhr.send(file);
    });
  },
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
  implantNumber: string;
  implantLabel?: string | null;
  jawScope: string;
  side?: string;
  toothPositionFdi?: string | null;
  actualMethodCode?: string | null;
  actualSubmethodCode?: string | null;
  status: string;
  surgeonComment?: string | null;
  attachments?: Array<{
    id: string;
    attachmentType: string;
    surgeonConfirmed: boolean;
    mediaAssetId: string;
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
  createImplant: (stageInstanceId: string, data: Partial<SurgicalImplantDto>) =>
    request<SurgicalImplantDto>(`/api/v1/stages/${stageInstanceId}/implant-records`, {
      method: 'POST',
      body: data,
    }),
  updateImplant: (implantId: string, data: Partial<SurgicalImplantDto>) =>
    request<SurgicalImplantDto>(`/api/v1/implant-records/${implantId}`, { method: 'PATCH', body: data }),
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
  emergencyEvents: () => request<AuditEventDto[]>('/api/v1/management/emergency-events'),
  integrationEvents: () => request<AuditEventDto[]>('/api/v1/management/integration-events'),
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
