import type { Metadata } from 'next';
import Link from 'next/link';

import { PageHeader } from '@/components/PageHeader';
import {
  MethodTimelineDiagram,
  PrinciplesGridDiagram,
  ProtocolLogicDiagram,
  TeamPhotoGraphic,
} from '@/components/info/InfoDiagrams';

export const metadata: Metadata = {
  title: 'Главная — Mandarin PhotoProtocol',
  description:
    'Клинический фотопротокол Strategic Implant® клиники Мандарин. Справочник этапов, прав доступа и работы команды.',
};

const TOC = [
  { href: '#zachem', label: 'Зачем этот сайт' },
  { href: '#start', label: 'Как начать' },
  { href: '#prava', label: 'Права доступа' },
  { href: '#kartochki', label: 'Пациенты и сотрудники' },
  { href: '#sluchaj', label: 'Клинический случай' },
  { href: '#etapy', label: '11 этапов протокола' },
  { href: '#media', label: 'Фото, видео, Rg, STL' },
  { href: '#zakrytie', label: 'Закрытие этапа' },
  { href: '#hirurgiya', label: 'Хирургический контроль' },
  { href: '#prikus', label: 'Прикус и прототип' },
  { href: '#expert', label: 'Режим эксперта' },
  { href: '#zaprety', label: 'Чего нельзя делать' },
  { href: '#checklist', label: 'Чек-лист смены' },
  { href: '#slovar', label: 'Словарь' },
];

function Section({
  id,
  title,
  kicker,
  children,
}: {
  id: string;
  title: string;
  kicker?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6 space-y-4">
      {kicker ? <p className="text-xs font-semibold uppercase tracking-wide text-accent">{kicker}</p> : null}
      <h2 className="text-2xl font-semibold text-graphite">{title}</h2>
      <div className="space-y-4 text-sm leading-relaxed text-graphite/90">{children}</div>
    </section>
  );
}

function Callout({
  tone,
  title,
  children,
}: {
  tone: 'do' | 'dont' | 'note';
  title: string;
  children: React.ReactNode;
}) {
  const cls =
    tone === 'do'
      ? 'border-status-success bg-green-50'
      : tone === 'dont'
        ? 'border-status-error bg-red-50'
        : 'border-accent bg-accent-light';
  return (
    <div className={`rounded border p-4 ${cls}`}>
      <div className="font-semibold text-graphite">{title}</div>
      <div className="mt-2 space-y-2 text-sm text-graphite/90">{children}</div>
    </div>
  );
}

export default function HomeHandbookPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Главная: правила работы Mandarin PhotoProtocol"
        description="Справочник клиники Strategic Implant® — от регистрации до финальной фиксации"
      />

      <div className="mb-8 overflow-hidden rounded border border-accent bg-graphite text-white">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-accent">Манифест</p>
            <h2 className="mt-2 text-2xl font-semibold">Не закрыли этап — лечения в системе нет</h2>
            <p className="mt-3 text-sm leading-relaxed text-white/80">
              Сайт не заменяет врача. Он хранит доказательную цепочку: кто планировал, кто ставил
              имплантаты, какой прикус зафиксирован, как выглядит прототип и финальная работа.
              Если кадра нет — его не было. Если этап не закрыт — маршрут не пройден.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['01', 'Снять'],
              ['02', 'Привязать к положению'],
              ['03', 'Проверить комплект'],
              ['04', 'Закрыть этап'],
            ].map(([n, t]) => (
              <div key={n} className="rounded border border-white/20 bg-white/5 p-3">
                <div className="font-mono text-accent">{n}</div>
                <div className="mt-1 font-medium">{t}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[220px_1fr]">
        <nav className="xl:sticky xl:top-6 xl:self-start">
          <div className="rounded border border-border bg-white p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Содержание</div>
            <ul className="space-y-1">
              {TOC.map((item) => (
                <li key={item.href}>
                  <a href={item.href} className="block rounded px-2 py-1 text-sm text-graphite hover:bg-accent-light hover:text-accent">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <div className="space-y-12">
          <Section id="zachem" kicker="Смысл системы" title="Зачем PhotoProtocol клинике Strategic Implant®">
            <p>
              Метод даёт пациенту функцию сразу: имплантаты опираются в кортикальную кость, протез
              шинирует опоры в день операции или в ближайшие часы. Ошибка в высоте прикуса, линии
              улыбки или посадке имплантата проявляется быстро. Поэтому каждый ключевой кадр
              обязан жить в протоколе, а не в личной галерее телефона.
            </p>
            <div className="overflow-hidden rounded border border-border">
              <MethodTimelineDiagram />
            </div>
            <p>
              PhotoProtocol — клинический quality gate. Он блокирует закрытие этапа при неполном
              комплекте, ведёт аудит и разделяет ответственность между четырьмя участниками случая.
              Поле «лечащий врач» специально отсутствует: случай ведёт команда.
            </p>
          </Section>

          <Section id="start" kicker="Первый день" title="Как начать работу">
            <ol className="list-decimal space-y-2 pl-5">
              <li>Зарегистрируйтесь с реальной почтой, ФИО, должностью и специализацией, если она нужна.</li>
              <li>Дождитесь подтверждения модератора. До этого доступен только просмотр.</li>
              <li>Эксперт подтверждается сразу, но видит протокол без ФИО пациента — только номер карты.</li>
              <li>После входа откройте эту главную, затем панель случаев, затем карточку пациента.</li>
              <li>Свой профиль (ФИО, телефон, почта, пароль, цвет логотипа) можно править после одобрения.</li>
            </ol>
            <div className="grid gap-3 sm:grid-cols-3">
              <Link href="/patients" className="card block hover:border-accent">
                <div className="font-semibold">Пациенты</div>
                <p className="mt-1 text-xs text-gray-600">Карта, ФИО, поиск по фамилии</p>
              </Link>
              <Link href="/cases/new" className="card block hover:border-accent">
                <div className="font-semibold">Новый случай</div>
                <p className="mt-1 text-xs text-gray-600">Четыре участника и версия протокола</p>
              </Link>
              <Link href="/dashboard" className="card block hover:border-accent">
                <div className="font-semibold">Панель управления</div>
                <p className="mt-1 text-xs text-gray-600">Все случаи и предупреждения комплектности</p>
              </Link>
            </div>
          </Section>

          <Section id="prava" kicker="Кто что может" title="Права доступа">
            <p>
              Права считаются по роли аккаунта и по должности. Если в должности есть слово «врач»
              (главный врач, врач стоматолог, врач) — сотрудник относится к врачам независимо от
              специализации. Куратор лечения равен управляющему клиникой.
            </p>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Кто</th>
                    <th>Случаи</th>
                    <th>Карточки</th>
                    <th>Этапы</th>
                    <th>Удаление</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="font-medium">Модератор / гендиректор</td>
                    <td>всё</td>
                    <td>всё</td>
                    <td>закрытие и правка закрытых</td>
                    <td>только он</td>
                  </tr>
                  <tr>
                    <td className="font-medium">Главный врач</td>
                    <td>создаёт</td>
                    <td>редактирует</td>
                    <td>может закрыть любой этап</td>
                    <td>нет</td>
                  </tr>
                  <tr>
                    <td className="font-medium">Врач, ортопед, хирург, консультант</td>
                    <td>создаёт</td>
                    <td>смотрит</td>
                    <td>закрывает этап, который начал</td>
                    <td>нет</td>
                  </tr>
                  <tr>
                    <td className="font-medium">Управляющий / куратор лечения</td>
                    <td>создаёт</td>
                    <td>редактирует</td>
                    <td>как врач, если начал этап</td>
                    <td>нет</td>
                  </tr>
                  <tr>
                    <td className="font-medium">Администратор клиники</td>
                    <td>создаёт</td>
                    <td>редактирует</td>
                    <td>как врач, если начал этап</td>
                    <td>нет</td>
                  </tr>
                  <tr>
                    <td className="font-medium">Исполнительный директор</td>
                    <td>не создаёт</td>
                    <td>редактирует</td>
                    <td>просмотр</td>
                    <td>нет</td>
                  </tr>
                  <tr>
                    <td className="font-medium">Эксперт</td>
                    <td>только просмотр</td>
                    <td>без ФИО, номер карты</td>
                    <td>без правок</td>
                    <td>нет</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              Меню «Управление» и «Модерация» видит только модератор. Остальным остаются клиника и
              полезная информация. Назначать роль аккаунта может только модератор.
            </p>
          </Section>

          <Section id="kartochki" kicker="Справочники" title="Пациенты и сотрудники">
            <p>
              Пациента ищут по фамилии: вводите буквы — в списке остаются совпадения, лишнее
              исчезает. Для эксперта вместо ФИО показывается номер карты.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Номер карты обязателен. Связь с 1С необязательна.</li>
              <li>Карточку пациента/сотрудника правят ИД, управляющий, куратор, администратор клиники, главный врач и модератор.</li>
              <li>Должности: гендиректор, исполнительный директор, управляющий, администратор клиники, куратор лечения, главный врач, врач стоматолог, врач, зубной техник, гигиенист, ассистент.</li>
              <li>Клинические роли на карточке сотрудника (ортопед, хирург, консультант, техник, анестезиолог, ЛОР-хирург) назначает модератор.</li>
            </ul>
          </Section>

          <Section id="sluchaj" kicker="Старт маршрута" title="Как завести клинический случай">
            <div className="overflow-hidden rounded border border-border">
              <TeamPhotoGraphic />
            </div>
            <ol className="list-decimal space-y-2 pl-5">
              <li>Выберите пациента поиском по фамилии.</li>
              <li>Опишите клинический сценарий — например, полная реабилитация обеих челюстей.</li>
              <li>Укажите область челюстей, дату начала, филиал и опубликованную версию протокола.</li>
              <li>Назначьте четырёх primary-участников: консультирующий врач, ортопед, хирург, зубной техник.</li>
              <li>Сохраните. Система создаст все этапы шаблона.</li>
            </ol>
            <Callout tone="note" title="Почему нет «лечащего врача»">
              <p>
                Strategic Implant® — командный метод. Хирург отвечает за установку и Rg, ортопед — за
                прикус и протез, техник — за конструкцию, консультант — за план. Протокол фиксирует
                всех четверых.
              </p>
            </Callout>
          </Section>

          <Section id="etapy" kicker="Маршрут" title="Одиннадцать этапов — одна история лечения">
            <div className="overflow-hidden rounded border border-border">
              <ProtocolLogicDiagram />
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Этап</th>
                    <th>Кто ведёт</th>
                    <th>Что доказать</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>1. Предоперационный</td>
                    <td>Ортопед</td>
                    <td>Лицо, полость рта, исход до вмешательства</td>
                  </tr>
                  <tr>
                    <td>2. Хирургия + Rg</td>
                    <td>Хирург</td>
                    <td>ОПТГ, карточки срезов, метод установки, подтверждение</td>
                  </tr>
                  <tr>
                    <td>3. Оттиски / сканы</td>
                    <td>Ортопед</td>
                    <td>STL или фото оттисков — один выбранный путь</td>
                  </tr>
                  <tr>
                    <td>4. Межчелюстные соотношения</td>
                    <td>Ортопед</td>
                    <td>Высота, линии, губы, ВНЧС. Закрыт, пока не закрыт этап 2</td>
                  </tr>
                  <tr>
                    <td>5. Первый прототип</td>
                    <td>Ортопед</td>
                    <td>Эстетика, фонетика, окклюзия, видео речи</td>
                  </tr>
                  <tr>
                    <td>6. Долгосрочная фиксация прототипа</td>
                    <td>Ортопед</td>
                    <td>Пациент ушёл с рабочей конструкцией</td>
                  </tr>
                  <tr>
                    <td>7. Контроль 1–3 недели</td>
                    <td>Ортопед</td>
                    <td>Ткани, гигиена, ранние отклонения</td>
                  </tr>
                  <tr>
                    <td>8. Примерка финала</td>
                    <td>Ортопед</td>
                    <td>Посадка, мягкие ткани/цемент, согласие по форме</td>
                  </tr>
                  <tr>
                    <td>9. Финальная фиксация</td>
                    <td>Ортопед</td>
                    <td>Постоянная работа на месте</td>
                  </tr>
                  <tr>
                    <td>10. Контроль после фиксации</td>
                    <td>Ортопед</td>
                    <td>Подтверждённый результат</td>
                  </tr>
                  <tr>
                    <td>11. Коррекции / осложнения</td>
                    <td>Ортопед</td>
                    <td>Отдельный маршрут, если план сломался</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="media" kicker="Съёмка" title="Как вводить данные: фото, видео, рентген, сканы">
            <p>
              Каждое положение — отдельное требование. Название выбирают из каталога поиском (как
              фамилию) или вводят своё, если кадра ещё нет в списке. В окне загрузки видна инструкция:
              ракурс, свет, губы, шаблоны.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="card">
                <h3 className="font-semibold">Фото</h3>
                <p className="mt-2">JPG/PNG/TIFF. Лицо: анфас в покое и с улыбкой, профили, 12 часов, ретрактор. Не обрезайте нос и подбородок. Свет ровный, без жёсткой тени на губе.</p>
              </div>
              <div className="card">
                <h3 className="font-semibold">Видео</h3>
                <p className="mt-2">MP4/MOV. Речь и фонетика, открывание-закрывание, протрузия, латеротрузия, динамика лица. Камера стабильна, пациент говорит фразы с шипящими и губными.</p>
              </div>
              <div className="card">
                <h3 className="font-semibold">Рентген</h3>
                <p className="mt-2">ОПТГ до и после, ОПТГ с шаблонами, ВНЧС. КЛКТ и DICOM в протоколе не требуются и не загружаются. Карточки срезов — JPG на каждый имплантат.</p>
              </div>
              <div className="card">
                <h3 className="font-semibold">STL / оттиски</h3>
                <p className="mt-2">Либо сканы верхней, нижней и прикуса, либо фото оттисков. Режим выбирается на этапе: система не требует оба комплекта сразу.</p>
              </div>
            </div>
            <Callout tone="do" title="Золотое правило кадра">
              <p>
                Сняли — сразу загрузили в нужное положение. «Потом из WhatsApp» ломает комплектность и
                авторство. Файл без положения — просто архив, не доказательство.
              </p>
            </Callout>
          </Section>

          <Section id="zakrytie" kicker="Quality gate" title="Когда этап можно закрыть">
            <p>
              Закрытие — юридический жест протокола. Его делают главный врач, модератор или тот, кто
              этап начал. После закрытия состав файлов правит только модератор.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Все обязательные положения заполнены.</li>
              <li>Нет блокирующих причин комплектности (нет подтверждения хирурга, нет среза и т.д.).</li>
              <li>Зависимый этап не закрыт, пока не закрыт предыдущий (прикус ждёт хирургию).</li>
            </ul>
            <p>
              На панели управления красные строки — блокеры, жёлтые — предупреждения. Зелёный статус
              не значит «лечение окончено», значит «этот этап доказан».
            </p>
          </Section>

          <Section id="hirurgiya" kicker="День операции" title="Послеоперационный хирургический и Rg-контроль">
            <ol className="list-decimal space-y-2 pl-5">
              <li>Загрузите послеоперационное ОПТГ.</li>
              <li>Заведите реестр имплантатов: челюсть, зуб по FDI, метод установки из справочника.</li>
              <li>К каждому имплантату приложите карточку среза JPG.</li>
              <li>Хирург подтверждает комплект: все имплантаты документированы, методы выбраны, срезы есть.</li>
              <li>Только после этого этап можно закрыть — и разблокируется межчелюстное соотношение.</li>
            </ol>
            <Callout tone="dont" title="Частая ошибка">
              <p>
                Закрыть хирургию «на словах», а срезы дослать вечером. Система не примет этап: нет JPG
                среза — нет имплантата в протоколе.
              </p>
            </Callout>
          </Section>

          <Section id="prikus" kicker="Ортопедия" title="Прикус, шаблоны, прототип">
            <div className="overflow-hidden rounded border border-border">
              <PrinciplesGridDiagram />
            </div>
            <p>
              Сначала функция и эстетика на шаблонах: Larin, высота покоя и рабочая высота, видимость
              резцов, центральная и клыковые линии, поддержка губы без напряжения, желаемая форма и
              цвет зубов (BL1–A4). Затем прототип в полупрозрачном сопоставлении с шаблонами, кривая
              Шпее, окклюзионные контакты, видео фонетики.
            </p>
            <p>
              Немедленная нагрузка работает только если протез шинирует опоры. Кадры посадки,
              мягких тканей и цемента — не «красота для Instagram», а контроль края и гигиены.
            </p>
          </Section>

          <Section id="expert" kicker="Консилиум" title="Как смотрит эксперт">
            <p>
              Эксперт нужен для разбора протокола, а не для работы с персональными данными. Он видит
              номера карт, этапы, фото и видео, но не ФИО. Создавать случаи, закрывать этапы и
              удалять файлы эксперт не может.
            </p>
          </Section>

          <Section id="zaprety" kicker="Красные линии" title="Чего система и клиника не прощают">
            <ul className="list-disc space-y-1 pl-5">
              <li>Общие демо-логины и пароли вроде ChangeMe123! — не используются. У каждого свой вход.</li>
              <li>Удалять случаи, пациентов, сотрудников и медиа может только модератор.</li>
              <li>Нельзя править закрытый этап без модератора.</li>
              <li>Нельзя вести случай без четырёх участников.</li>
              <li>Нельзя подменять ФИО в экспертном режиме — сервер тоже скрывает фамилию.</li>
              <li>Нельзя загружать КЛКТ/DICOM вместо карточек срезов.</li>
              <li>Нельзя считать WhatsApp-переписку частью протокола.</li>
            </ul>
          </Section>

          <Section id="checklist" kicker="Практика" title="Чек-лист одной смены">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="card">
                <h3 className="font-semibold">Утром</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Панель: нет ли красных блокеров по вчерашним этапам</li>
                  <li>Пациент найден, случай открыт, этап выбран</li>
                  <li>Камера, ретракторы, шаблоны, ОПТГ готовы</li>
                </ul>
              </div>
              <div className="card">
                <h3 className="font-semibold">В кабинете</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Сняли положение — сразу загрузили</li>
                  <li>Проверили инструкцию к ракурсу</li>
                  <li>Хирургия: реестр + срезы + подтверждение</li>
                </ul>
              </div>
              <div className="card">
                <h3 className="font-semibold">Перед уходом пациента</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Комплектность зелёная или понятный список дыр</li>
                  <li>Этап закрыт, если набор полный</li>
                  <li>Следующий этап не открыт «авансом»</li>
                </ul>
              </div>
              <div className="card">
                <h3 className="font-semibold">Вечером</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Нет файлов «на диске у ассистента»</li>
                  <li>Сложные случаи отмечены в сценарии</li>
                  <li>Эксперту можно отдать протокол по номеру карты</li>
                </ul>
              </div>
            </div>
          </Section>

          <Section id="slovar" kicker="Язык команды" title="Короткий словарь">
            <dl className="grid gap-3 sm:grid-cols-2">
              {[
                ['Положение', 'Конкретный ракурс или файл, который требует этап'],
                ['Комплектность', 'Все обязательные положения закрыты'],
                ['Primary-участник', 'Один из четырёх обязательных врачей/техника случая'],
                ['Quality gate', 'Запрет закрыть этап без доказательств'],
                ['Кортикальная опора', 'Фиксация имплантата в плотной кости'],
                ['Шинирование', 'Объединение опор одной конструкцией'],
                ['Карточка среза', 'JPG-срез конкретного имплантата после операции'],
                ['Модератор', 'Полные права сайта, единственный кто удаляет данные'],
              ].map(([term, def]) => (
                <div key={term} className="rounded border border-border bg-white p-3">
                  <dt className="font-semibold text-graphite">{term}</dt>
                  <dd className="mt-1 text-graphite/80">{def}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap gap-2 pt-2">
              <Link href="/info/strategic-implant" className="btn-secondary">
                Метод Strategic Implant®
              </Link>
              <Link href="/info/principles" className="btn-secondary">
                Базовые принципы
              </Link>
              <Link href="/info/photoprotocol" className="btn-secondary">
                Логика протокола
              </Link>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
