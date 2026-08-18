import { InfoPageShell, InfoPhoto, InfoSection, InfoVideo } from '@/components/info/InfoBlocks';
import { ProtocolLogicDiagram, TeamPhotoGraphic } from '@/components/info/InfoDiagrams';

const STAGES = [
  { n: '01', name: 'Предоперационный этап', why: 'Исходное состояние лица, полости рта и Rg до вмешательства' },
  { n: '02', name: 'Послеоперационный хирургический и Rg-контроль', why: 'Доказать установку, срезы имплантатов и подтверждение хирурга' },
  { n: '03', name: 'Оттиски / сканы', why: 'Цифровой или аналоговый слепок для прототипа' },
  { n: '04', name: 'Межчелюстные соотношения', why: 'Высота, средняя линия, поддержка губы, ВНЧС' },
  { n: '05', name: 'Первый прототип', why: 'Проверка эстетики, фонетики и окклюзии в динамике' },
  { n: '06', name: 'Долгосрочная фиксация прототипа', why: 'Пациент уходит с рабочей конструкцией' },
  { n: '07', name: 'Контроль 1–3 недели', why: 'Ранние отклонения до финального протеза' },
  { n: '08', name: 'Примерка финальной конструкции', why: 'Согласование формы и прикуса перед фиксацией' },
  { n: '09', name: 'Финальная фиксация', why: 'Факт установки постоянной работы' },
  { n: '10', name: 'Контроль после финальной фиксации', why: 'Подтверждение результата' },
  { n: '11', name: 'Коррекции / переделки / осложнения', why: 'Отдельный маршрут, если что-то пошло не по плану' },
];

export default function PhotoProtocolLogicPage() {
  return (
    <InfoPageShell
      title="Логика PhotoProtocol & Strategic Implant®"
      description="Зачем системе этапы, комплектность и аудит — и как это связано с методом"
    >
      <InfoSection title="Зачем PhotoProtocol">
        <p>
          Strategic Implant® даёт функцию сразу. Значит, ошибка на раннем этапе быстро становится
          клинической проблемой. PhotoProtocol не лечит и не заменяет врача: он не даёт закрыть этап,
          пока нет полного комплекта фото, видео, рентгена и подтверждений.
        </p>
        <p>
          Каждый файл привязан к требованию этапа. Так можно через месяцы доказать, что высота
          прикуса, срезы имплантатов или фонетика прототипа были сняты и приняты.
        </p>
      </InfoSection>

      <InfoPhoto
        title="Графика: quality gate"
        caption="Этап закрывается только при полном комплекте. Неполный набор — не «почти готово», а открытый этап."
      >
        <ProtocolLogicDiagram />
      </InfoPhoto>

      <InfoSection title="Как метод связан с этапами">
        <p>
          Хирургия без немедленного протеза ломает логику Strategic Implant®. Поэтому после
          Rg-контроля идут оттиски/сканы, межчелюстные соотношения и прототип — не «когда удобно», а
          как продолжение одной конструкции. Финальная фиксация возможна только после контролей
          прототипа.
        </p>
      </InfoSection>

      <div className="card overflow-hidden p-0">
        <div className="border-b border-border px-5 py-3 text-lg font-semibold text-graphite">
          Этапы и их смысл
        </div>
        <div className="table-wrap border-0">
          <table className="data-table">
            <thead>
              <tr>
                <th>№</th>
                <th>Этап</th>
                <th>Зачем в методе</th>
              </tr>
            </thead>
            <tbody>
              {STAGES.map((stage) => (
                <tr key={stage.n}>
                  <td className="font-mono text-accent">{stage.n}</td>
                  <td className="font-medium">{stage.name}</td>
                  <td className="text-graphite/80">{stage.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <InfoPhoto
        title="Фото-схема ответственности"
        caption="Случай ведут четыре участника. Система хранит, кто что загрузил и кто закрыл этап."
      >
        <TeamPhotoGraphic />
      </InfoPhoto>

      <InfoSection title="Правила, которые нельзя обойти">
        <ul className="list-disc space-y-1 pl-5">
          <li>Закрыть этап может главный врач или тот, кто этап начал.</li>
          <li>После закрытия состав файлов правит только модератор.</li>
          <li>Эксперт видит протокол по номеру карты, без ФИО пациента.</li>
          <li>Удаление карточек и случаев — только у модератора.</li>
        </ul>
      </InfoSection>

      <InfoVideo
        title="Логика PhotoProtocol & Strategic Implant®"
        chapters={[
          { time: '00:00', label: 'Почему метод требует фотопротокол' },
          { time: '01:30', label: 'Комплектность: фото, видео, Rg, STL' },
          { time: '03:10', label: 'Как закрывается этап' },
          { time: '04:30', label: 'Аудит и роли участников' },
        ]}
      />
    </InfoPageShell>
  );
}
