export function MethodTimelineDiagram() {
  return (
    <svg viewBox="0 0 720 220" className="h-auto w-full" role="img" aria-label="Сравнение классического и Strategic Implant маршрута">
      <rect width="720" height="220" fill="#f9fafb" />
      <text x="24" y="36" fill="#2c2f33" fontSize="14" fontWeight="600">
        Классический двухэтапный маршрут
      </text>
      {['Кость / синус', 'Имплантация', 'Остеоинтеграция', 'Протезирование'].map((label, i) => (
        <g key={label} transform={`translate(${24 + i * 170}, 52)`}>
          <rect width="150" height="44" rx="6" fill="#ffffff" stroke="#d1d5db" />
          <text x="75" y="27" textAnchor="middle" fill="#2c2f33" fontSize="12">
            {label}
          </text>
        </g>
      ))}
      <text x="24" y="132" fill="#e85d04" fontSize="14" fontWeight="600">
        Strategic Implant® — немедленная нагрузка
      </text>
      {['Планирование', 'Установка в кортикал', 'Сразу протез', 'Контроль этапов'].map((label, i) => (
        <g key={label} transform={`translate(${24 + i * 170}, 148)`}>
          <rect width="150" height="44" rx="6" fill="#fef3ec" stroke="#e85d04" />
          <text x="75" y="27" textAnchor="middle" fill="#e85d04" fontSize="12" fontWeight="600">
            {label}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function CorticalAnchorageDiagram() {
  return (
    <svg viewBox="0 0 720 240" className="h-auto w-full" role="img" aria-label="Схема кортикальной опоры имплантата">
      <rect width="720" height="240" fill="#f9fafb" />
      <path d="M80 40 C 180 20, 260 30, 340 70 C 400 100, 430 150, 420 210 L 80 210 Z" fill="#f3e2d4" stroke="#d1b39a" />
      <path d="M80 40 C 180 20, 260 30, 340 70 C 300 55, 200 48, 80 58 Z" fill="#c4a484" />
      <path d="M80 188 C 200 176, 320 186, 420 210 L 80 210 Z" fill="#c4a484" />
      <rect x="210" y="36" width="18" height="150" rx="4" fill="#e85d04" />
      <circle cx="219" cy="36" r="10" fill="#2c2f33" />
      <text x="460" y="70" fill="#2c2f33" fontSize="13" fontWeight="600">
        Кортикальная пластинка
      </text>
      <text x="460" y="92" fill="#6b7280" fontSize="12">
        Опора в плотной кости, а не только в губчатой
      </text>
      <text x="460" y="140" fill="#2c2f33" fontSize="13" fontWeight="600">
        Strategic Implant®
      </text>
      <text x="460" y="162" fill="#6b7280" fontSize="12">
        Первичная стабильность для немедленной нагрузки
      </text>
    </svg>
  );
}

export function PrinciplesGridDiagram() {
  const items = [
    { n: '1', t: 'Кортикальная опора' },
    { n: '2', t: 'Немедленная нагрузка' },
    { n: '3', t: 'Протез ведёт установку' },
    { n: '4', t: 'Шинирование конструкции' },
  ];
  return (
    <svg viewBox="0 0 720 180" className="h-auto w-full" role="img" aria-label="Четыре базовых принципа">
      <rect width="720" height="180" fill="#f9fafb" />
      {items.map((item, i) => (
        <g key={item.n} transform={`translate(${24 + i * 174}, 28)`}>
          <rect width="158" height="124" rx="10" fill="#ffffff" stroke="#e85d04" />
          <circle cx="79" cy="40" r="18" fill="#e85d04" />
          <text x="79" y="45" textAnchor="middle" fill="#ffffff" fontSize="14" fontWeight="700">
            {item.n}
          </text>
          <text x="79" y="88" textAnchor="middle" fill="#2c2f33" fontSize="12" fontWeight="600">
            {item.t.split(' ')[0]}
          </text>
          <text x="79" y="108" textAnchor="middle" fill="#2c2f33" fontSize="12" fontWeight="600">
            {item.t.split(' ').slice(1).join(' ')}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function ProtocolLogicDiagram() {
  const stages = [
    'До операции',
    'Хирургия + Rg',
    'Оттиски / сканы',
    'Прикус',
    'Прототип',
    'Фиксация',
  ];
  return (
    <svg viewBox="0 0 720 200" className="h-auto w-full" role="img" aria-label="Логика этапов PhotoProtocol">
      <rect width="720" height="200" fill="#f9fafb" />
      {stages.map((label, i) => {
        const x = 20 + (i % 6) * 116;
        return (
          <g key={label} transform={`translate(${x}, 36)`}>
            <rect width="104" height="72" rx="8" fill={i % 2 ? '#ffffff' : '#fef3ec'} stroke="#e5e7eb" />
            <text x="52" y="32" textAnchor="middle" fill="#e85d04" fontSize="11" fontWeight="700">
              {String(i + 1).padStart(2, '0')}
            </text>
            <text x="52" y="52" textAnchor="middle" fill="#2c2f33" fontSize="10">
              {label}
            </text>
          </g>
        );
      })}
      <text x="360" y="150" textAnchor="middle" fill="#6b7280" fontSize="12">
        Этап закрывается только при полном комплекте фото, видео и Rg
      </text>
      <text x="360" y="172" textAnchor="middle" fill="#2c2f33" fontSize="12" fontWeight="600">
        PhotoProtocol = клинический quality gate, а не замена врача
      </text>
    </svg>
  );
}

export function TeamPhotoGraphic() {
  const roles = ['Консультант', 'Хирург', 'Ортопед', 'Техник'];
  return (
    <svg viewBox="0 0 720 200" className="h-auto w-full" role="img" aria-label="Команда случая">
      <rect width="720" height="200" fill="#2c2f33" />
      {roles.map((role, i) => (
        <g key={role} transform={`translate(${48 + i * 168}, 36)`}>
          <circle cx="60" cy="48" r="32" fill="#e85d04" />
          <text x="60" y="54" textAnchor="middle" fill="#ffffff" fontSize="16" fontWeight="700">
            {role[0]}
          </text>
          <text x="60" y="112" textAnchor="middle" fill="#ffffff" fontSize="13">
            {role}
          </text>
        </g>
      ))}
      <text x="360" y="170" textAnchor="middle" fill="#fef3ec" fontSize="12">
        Четыре обязательных участника клинического случая
      </text>
    </svg>
  );
}
