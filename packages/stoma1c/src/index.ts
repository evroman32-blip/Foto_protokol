import type {
  Stoma1cGateway,
  Stoma1cPatient,
  Stoma1cPatientSearchQuery,
  Stoma1cStaffMember,
  Stoma1cBranch,
  Stoma1cAppointment,
  Stoma1cAppointmentQuery,
  PhotoProtocolStatusPayload,
  PhotoProtocolReportPayload,
} from '@mandarin/contracts';

export class Stoma1cDisabledError extends Error {
  constructor(message = 'Интеграция с 1С отключена') {
    super(message);
    this.name = 'Stoma1cDisabledError';
  }
}

export class DisabledStoma1cGateway implements Stoma1cGateway {
  async getPatientById(_patientId: string): Promise<Stoma1cPatient> {
    throw new Stoma1cDisabledError();
  }
  async searchPatients(_query: Stoma1cPatientSearchQuery): Promise<Stoma1cPatient[]> {
    throw new Stoma1cDisabledError();
  }
  async getStaff(): Promise<Stoma1cStaffMember[]> {
    throw new Stoma1cDisabledError();
  }
  async getBranches(): Promise<Stoma1cBranch[]> {
    throw new Stoma1cDisabledError();
  }
  async getAppointments(_query: Stoma1cAppointmentQuery): Promise<Stoma1cAppointment[]> {
    throw new Stoma1cDisabledError();
  }
  async pushPhotoProtocolStatus(_payload: PhotoProtocolStatusPayload): Promise<void> {
    throw new Stoma1cDisabledError();
  }
  async attachPhotoProtocolReport(_payload: PhotoProtocolReportPayload): Promise<void> {
    throw new Stoma1cDisabledError();
  }
}

export class MockStoma1cGateway implements Stoma1cGateway {
  async getPatientById(patientId: string): Promise<Stoma1cPatient> {
    return {
      externalId: `1c-patient-${patientId}`,
      lastName: 'Mock',
      firstName: 'Patient',
      birthDate: '1980-01-01',
    };
  }

  async searchPatients(query: Stoma1cPatientSearchQuery): Promise<Stoma1cPatient[]> {
    return [{
      externalId: '1c-demo-001',
      lastName: 'Mock',
      firstName: query.query,
    }];
  }

  async getStaff(): Promise<Stoma1cStaffMember[]> {
    return [{
      externalId: '1c-staff-001',
      lastName: 'Mock',
      firstName: 'Doctor',
      position: 'Врач',
    }];
  }

  async getBranches(): Promise<Stoma1cBranch[]> {
    return [{ externalId: '1c-branch-001', name: 'Mock Branch' }];
  }

  async getAppointments(_query: Stoma1cAppointmentQuery): Promise<Stoma1cAppointment[]> {
    return [];
  }

  async pushPhotoProtocolStatus(_payload: PhotoProtocolStatusPayload): Promise<void> {
    // mock: no-op
  }

  async attachPhotoProtocolReport(_payload: PhotoProtocolReportPayload): Promise<void> {
    // mock: no-op
  }
}

export interface Stoma1cApiConfig {
  baseUrl: string;
  apiToken: string;
  databaseId?: string;
}

export class Stoma1cApiGateway implements Stoma1cGateway {
  constructor(private readonly config: Stoma1cApiConfig) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.config.baseUrl.replace(/\/$/, '')}${path}`;
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.config.apiToken}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    if (!response.ok) {
      throw new Error(`Stoma1c API error: ${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<T>;
  }

  async getPatientById(patientId: string): Promise<Stoma1cPatient> {
    return this.request<Stoma1cPatient>(`/patients/${encodeURIComponent(patientId)}`);
  }

  async searchPatients(query: Stoma1cPatientSearchQuery): Promise<Stoma1cPatient[]> {
    const params = new URLSearchParams({ q: query.query, limit: String(query.limit ?? 20) });
    return this.request<Stoma1cPatient[]>(`/patients/search?${params}`);
  }

  async getStaff(): Promise<Stoma1cStaffMember[]> {
    return this.request<Stoma1cStaffMember[]>('/staff');
  }

  async getBranches(): Promise<Stoma1cBranch[]> {
    return this.request<Stoma1cBranch[]>('/branches');
  }

  async getAppointments(query: Stoma1cAppointmentQuery): Promise<Stoma1cAppointment[]> {
    const params = new URLSearchParams();
    if (query.from) params.set('from', query.from);
    if (query.to) params.set('to', query.to);
    if (query.branchExternalId) params.set('branchId', query.branchExternalId);
    return this.request<Stoma1cAppointment[]>(`/appointments?${params}`);
  }

  async pushPhotoProtocolStatus(payload: PhotoProtocolStatusPayload): Promise<void> {
    await this.request<void>('/photo-protocol/status', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async attachPhotoProtocolReport(payload: PhotoProtocolReportPayload): Promise<void> {
    await this.request<void>('/photo-protocol/reports', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
}

export function createStoma1cGateway(options: {
  enabled: boolean;
  useMock: boolean;
  apiConfig?: Stoma1cApiConfig;
}): Stoma1cGateway {
  if (!options.enabled) {
    return options.useMock ? new MockStoma1cGateway() : new DisabledStoma1cGateway();
  }
  if (!options.apiConfig?.baseUrl || !options.apiConfig?.apiToken) {
    throw new Error('Stoma1c API config required when integration enabled');
  }
  return new Stoma1cApiGateway(options.apiConfig);
}
