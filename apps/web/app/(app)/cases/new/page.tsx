'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { ErrorState, LoadingState } from '@/components/States';
import {
  adminApi,
  casesApi,
  patientsApi,
  staffApi,
  type BranchDto,
  type PatientDto,
  type ProtocolVersionDto,
  type StaffDto,
} from '@/lib/api';
import { JAW_SCOPE_LABELS } from '@/lib/constants';

function formatName(entity: { lastName: string; firstName: string; middleName?: string | null }) {
  return [entity.lastName, entity.firstName, entity.middleName].filter(Boolean).join(' ');
}

export default function NewCasePage() {
  const router = useRouter();
  const [patients, setPatients] = useState<PatientDto[]>([]);
  const [staff, setStaff] = useState<StaffDto[]>([]);
  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [versions, setVersions] = useState<ProtocolVersionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [p, s, b, v] = await Promise.all([
          patientsApi.list(),
          staffApi.list(),
          adminApi.branches(),
          adminApi.protocolVersions(),
        ]);
        setPatients(p);
        setStaff(s);
        setBranches(b);
        setVersions(v.filter((x) => x.status === 'PUBLISHED'));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки справочников');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const created = await casesApi.create({
        patientId: String(fd.get('patientId')),
        clinicalScenario: String(fd.get('clinicalScenario')),
        jawScope: String(fd.get('jawScope')),
        treatmentStartDate: String(fd.get('treatmentStartDate')),
        branchId: String(fd.get('branchId') || '') || undefined,
        protocolVersionId: String(fd.get('protocolVersionId')),
        consultingDoctorId: String(fd.get('consultingDoctorId')),
        orthopedistId: String(fd.get('orthopedistId')),
        surgeonId: String(fd.get('surgeonId')),
        dentalTechnicianId: String(fd.get('dentalTechnicianId')),
        externalClinicalCaseId: String(fd.get('externalClinicalCaseId') || '') || undefined,
      });
      router.push(`/cases/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания случая');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingState label="Загрузка справочников…" />;

  return (
    <div>
      <PageHeader
        title="Новый клинический случай"
        description="Strategic Implant® — без поля «лечащий врач»"
        actions={
          <Link href="/dashboard" className="btn-secondary">
            Назад
          </Link>
        }
      />

      {error ? <div className="alert-error mb-4">{error}</div> : null}

      <form onSubmit={handleSubmit} className="card max-w-3xl space-y-5">
        <div>
          <label className="label-field" htmlFor="patientId">
            Пациент *
          </label>
          <select id="patientId" name="patientId" required className="input-field">
            <option value="">Выберите пациента</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {formatName(p)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label-field" htmlFor="clinicalScenario">
            Клинический сценарий *
          </label>
          <textarea
            id="clinicalScenario"
            name="clinicalScenario"
            required
            rows={3}
            className="input-field"
            placeholder="Например: полная реабилитация верхней и нижней челюсти Strategic Implant®"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label-field" htmlFor="jawScope">
              Область челюстей *
            </label>
            <select id="jawScope" name="jawScope" required className="input-field">
              {Object.entries(JAW_SCOPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field" htmlFor="treatmentStartDate">
              Дата начала лечения *
            </label>
            <input id="treatmentStartDate" name="treatmentStartDate" type="date" required className="input-field" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label-field" htmlFor="branchId">
              Филиал
            </label>
            <select id="branchId" name="branchId" className="input-field">
              <option value="">Не указан</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field" htmlFor="protocolVersionId">
              Версия протокола *
            </label>
            <select id="protocolVersionId" name="protocolVersionId" required className="input-field">
              <option value="">Выберите версию</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.protocolName ?? v.protocolId} — v{v.version}
                </option>
              ))}
            </select>
          </div>
        </div>

        <fieldset className="space-y-3 rounded border border-border p-4">
          <legend className="px-1 text-sm font-medium">Участники случая *</legend>
          {[
            { name: 'consultingDoctorId', label: 'Консультирующий врач' },
            { name: 'orthopedistId', label: 'Ортопед' },
            { name: 'surgeonId', label: 'Хирург' },
            { name: 'dentalTechnicianId', label: 'Зубной техник' },
          ].map((field) => (
            <div key={field.name}>
              <label className="label-field" htmlFor={field.name}>
                {field.label}
              </label>
              <select id={field.name} name={field.name} required className="input-field">
                <option value="">Выберите сотрудника</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {formatName(s)}
                    {s.specialization ? ` — ${s.specialization}` : ''}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </fieldset>

        <div>
          <label className="label-field" htmlFor="externalClinicalCaseId">
            Связь с 1С (опционально)
          </label>
          <input
            id="externalClinicalCaseId"
            name="externalClinicalCaseId"
            className="input-field"
            placeholder="Внешний ID случая в 1С"
          />
        </div>

        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? 'Создание…' : 'Создать случай'}
        </button>
      </form>
    </div>
  );
}
