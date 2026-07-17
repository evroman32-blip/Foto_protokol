'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { StageTabs } from '@/components/StageTabs';
import { ErrorState, LoadingState } from '@/components/States';
import {
  adminApi,
  radiologyApi,
  type ImplantMethodDto,
  type RadiologyStudyDto,
  type SurgicalImplantDto,
  type SurgeonConfirmationDto,
} from '@/lib/api';

const BLOCKS = [
  { id: 'optg', title: '1. ОПТГ после операции' },
  { id: 'cbct', title: '2. КТ / КЛКТ' },
  { id: 'registry', title: '3. Реестр имплантатов' },
  { id: 'methods', title: '4. Методы установки (справочник M1A–M16B)' },
  { id: 'slices', title: '5. КТ-срезы на имплантат' },
  { id: 'evidence', title: '6. Evidence flags по методу' },
  { id: 'confirmation', title: '7. Подтверждение хирурга' },
] as const;

export default function SurgicalRadiologyPage() {
  const { id: caseId, stageId } = useParams<{ id: string; stageId: string }>();
  const [studies, setStudies] = useState<RadiologyStudyDto[]>([]);
  const [implants, setImplants] = useState<SurgicalImplantDto[]>([]);
  const [methods, setMethods] = useState<ImplantMethodDto[]>([]);
  const [confirmation, setConfirmation] = useState<SurgeonConfirmationDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [studiesData, implantsData, methodsData, confirmationData] = await Promise.all([
        radiologyApi.studies(stageId),
        radiologyApi.implants(stageId),
        adminApi.implantMethods({ active: true }),
        radiologyApi.surgeonConfirmation(stageId),
      ]);
      setStudies(studiesData);
      setImplants(implantsData);
      setMethods(methodsData);
      setConfirmation(confirmationData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [stageId]);

  async function handleConfirm() {
    setBusy(true);
    try {
      const hasOptg = studies.some((s) => s.studyType === 'OPTG');
      const hasCbct = studies.some((s) => s.studyType === 'CBCT' || s.studyType === 'CT');
      const allMethods = implants.every((i) => i.actualMethodCode);
      const allSlices = implants.every((i) =>
        (i.attachments ?? []).some((a) => a.surgeonConfirmed),
      );

      await radiologyApi.confirmSurgeon(stageId, {
        comment,
        allImplantsDocumented: implants.length > 0,
        optgUploaded: hasOptg,
        cbctUploaded: hasCbct,
        allImplantsHaveCtSlices: allSlices,
        allImplantsHaveMethodSelected: allMethods,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка подтверждения');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingState />;
  if (error && !studies.length) return <ErrorState message={error} onRetry={load} />;

  const hasOptg = studies.some((s) => s.studyType === 'OPTG');
  const hasCbct = studies.some((s) => s.studyType === 'CBCT' || s.studyType === 'CT');

  return (
    <div>
      <PageHeader
        title="Хирургический рентгенологический контроль"
        description="7 блоков workflow POSTOP_SURGICAL_RADIOLOGY_CONTROL"
        actions={
          <Link href={`/cases/${caseId}/stages/${stageId}`} className="btn-secondary">
            К этапу
          </Link>
        }
      />

      <StageTabs active="radiology" />

      <div className="space-y-4">
        <section className="card" id={BLOCKS[0].id}>
          <h2 className="mb-2 font-semibold text-graphite">{BLOCKS[0].title}</h2>
          <p className="text-sm text-gray-600">
            {hasOptg ? 'ОПТГ загружено' : 'ОПТГ не загружено — blocker'}
          </p>
        </section>

        <section className="card" id={BLOCKS[1].id}>
          <h2 className="mb-2 font-semibold text-graphite">{BLOCKS[1].title}</h2>
          <p className="text-sm text-gray-600">
            {hasCbct ? 'КТ/КЛКТ загружено' : 'КТ/КЛКТ не загружено — blocker'}
          </p>
        </section>

        <section className="card" id={BLOCKS[2].id}>
          <h2 className="mb-2 font-semibold text-graphite">{BLOCKS[2].title}</h2>
          {implants.length ? (
            <ul className="text-sm">
              {implants.map((i) => (
                <li key={i.id}>
                  #{i.implantNumber} {i.implantLabel ?? ''} — {i.status}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">Реестр пуст</p>
          )}
        </section>

        <section className="card" id={BLOCKS[3].id}>
          <h2 className="mb-2 font-semibold text-graphite">{BLOCKS[3].title}</h2>
          <p className="mb-2 text-sm text-gray-600">Справочник: {methods.length} методов</p>
          <div className="max-h-40 overflow-y-auto text-xs">
            {implants.map((i) => (
              <div key={i.id}>
                #{i.implantNumber}: {i.actualMethodCode ?? 'метод не выбран'}
              </div>
            ))}
          </div>
        </section>

        <section className="card" id={BLOCKS[4].id}>
          <h2 className="mb-2 font-semibold text-graphite">{BLOCKS[4].title}</h2>
          {implants.map((i) => (
            <div key={i.id} className="mb-2 text-sm">
              #{i.implantNumber}: {(i.attachments ?? []).length} вложений
            </div>
          ))}
        </section>

        <section className="card" id={BLOCKS[5].id}>
          <h2 className="mb-2 font-semibold text-graphite">{BLOCKS[5].title}</h2>
          <p className="text-sm text-gray-600">
            Nerve / sinus / nasal floor / pterygoid / zygomatic — проверяются backend при закрытии этапа.
          </p>
        </section>

        <section className="card" id={BLOCKS[6].id}>
          <h2 className="mb-2 font-semibold text-graphite">{BLOCKS[6].title}</h2>
          {confirmation ? (
            <p className="text-sm text-status-success">
              Подтверждено {new Date(confirmation.confirmedAt).toLocaleString('ru-RU')}
            </p>
          ) : (
            <>
              <label className="label-field" htmlFor="comment">
                Комментарий хирурга
              </label>
              <textarea
                id="comment"
                className="input-field mb-3 min-h-[80px]"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <button type="button" className="btn-primary" disabled={busy} onClick={() => void handleConfirm()}>
                Подтвердить рентгенологический комплект
              </button>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
