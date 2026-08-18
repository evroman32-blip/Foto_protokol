/** Decorative left rail for guests: Mandarin clinic + Strategic Implant®. */
export function BrandPanel() {
  return (
    <aside
      className="sticky top-0 flex h-screen w-64 shrink-0 flex-col overflow-hidden border-r border-[#1a1c1e] bg-[#1f2226]"
      aria-label="Клиника Мандарин и Strategic Implant"
    >
      <svg
        viewBox="0 0 256 900"
        className="h-full w-full"
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-labelledby="brand-panel-title"
      >
        <title id="brand-panel-title">Клиника Мандарин · Strategic Implant®</title>
        <defs>
          <linearGradient id="bpBg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2c2f33" />
            <stop offset="55%" stopColor="#1f2226" />
            <stop offset="100%" stopColor="#16181b" />
          </linearGradient>
          <radialGradient id="bpGlow" cx="50%" cy="18%" r="45%">
            <stop offset="0%" stopColor="#e85d04" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#e85d04" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="bpFruit" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ff9a3c" />
            <stop offset="45%" stopColor="#e85d04" />
            <stop offset="100%" stopColor="#c2410c" />
          </linearGradient>
          <linearGradient id="bpMetal" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#9ca3af" />
            <stop offset="40%" stopColor="#f3f4f6" />
            <stop offset="100%" stopColor="#6b7280" />
          </linearGradient>
          <linearGradient id="bpBone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e8d5c4" />
            <stop offset="100%" stopColor="#c4a484" />
          </linearGradient>
        </defs>

        <rect width="256" height="900" fill="url(#bpBg)" />
        <rect width="256" height="900" fill="url(#bpGlow)" />

        {Array.from({ length: 14 }, (_, i) => (
          <circle key={`d1-${i}`} cx={18 + (i % 2) * 12} cy={80 + i * 58} r="1.2" fill="#e85d04" opacity="0.25" />
        ))}
        {Array.from({ length: 14 }, (_, i) => (
          <circle key={`d2-${i}`} cx={226 - (i % 2) * 12} cy={110 + i * 58} r="1.2" fill="#e85d04" opacity="0.25" />
        ))}

        {/* Mandarin fruit */}
        <g transform="translate(128 118)">
          <ellipse cx="0" cy="8" rx="46" ry="44" fill="url(#bpFruit)" />
          <path d="M0 -36 A46 44 0 0 1 38 -8" fill="none" stroke="#ffd7b0" strokeWidth="3" opacity="0.45" />
          {[-3, -2, -1, 1, 2, 3].map((n) => (
            <path
              key={n}
              d={`M0 -34 Q ${n * 14} 8 0 50`}
              fill="none"
              stroke="#c2410c"
              strokeWidth="1.2"
              opacity="0.35"
            />
          ))}
          <path d="M-6 -42 C -2 -70, 22 -68, 18 -40 C 8 -52, 0 -48, -6 -42 Z" fill="#3f7d4e" />
          <path d="M4 -44 C 8 -62, 28 -58, 22 -40" fill="none" stroke="#2f5d3a" strokeWidth="1.5" />
          <circle cx="-10" cy="-6" r="7" fill="#fff" opacity="0.18" />
        </g>

        <text x="128" y="198" textAnchor="middle" fill="#ffffff" fontSize="18" fontWeight="700" fontFamily="Inter, Segoe UI, sans-serif">
          Мандарин
        </text>
        <text x="128" y="220" textAnchor="middle" fill="#e85d04" fontSize="11" fontWeight="600" fontFamily="Inter, Segoe UI, sans-serif">
          PhotoProtocol
        </text>
        <text x="128" y="240" textAnchor="middle" fill="#9ca3af" fontSize="9" fontFamily="Inter, Segoe UI, sans-serif">
          клиника · имплантация
        </text>

        {/* Jaw / bone silhouette */}
        <path
          d="M36 300 C 70 270, 186 270, 220 300 C 228 340, 214 430, 198 470 C 170 510, 86 510, 58 470 C 42 430, 28 340, 36 300 Z"
          fill="url(#bpBone)"
          opacity="0.22"
        />
        <path
          d="M48 318 C 80 296, 176 296, 208 318"
          fill="none"
          stroke="#e85d04"
          strokeWidth="1.4"
          opacity="0.5"
        />

        {/* Disk / basal implant */}
        <g transform="translate(78 355)">
          <rect x="-3" y="-28" width="6" height="22" rx="1.5" fill="url(#bpMetal)" />
          <ellipse cx="0" cy="0" rx="22" ry="6" fill="#d1d5db" />
          <ellipse cx="0" cy="0" rx="22" ry="6" fill="none" stroke="#9ca3af" />
          <ellipse cx="0" cy="16" rx="16" ry="5" fill="#cbd5e1" />
          <rect x="-2.5" y="16" width="5" height="48" rx="1.5" fill="url(#bpMetal)" />
          { [22, 30, 38, 46].map((y) => (
            <path key={y} d={`M-7 ${y} L 7 ${y + 4}`} stroke="#6b7280" strokeWidth="1.1" />
          ))}
        </g>

        {/* BCS-style bicortical screw */}
        <g transform="translate(128 332)">
          <rect x="-5" y="0" width="10" height="10" rx="1" fill="#374151" />
          <rect x="-3.2" y="10" width="6.4" height="36" rx="1.2" fill="url(#bpMetal)" />
          <path d="M-4.5 46 L 4.5 46 L 3.2 118 L -3.2 118 Z" fill="url(#bpMetal)" />
          {[50, 58, 66, 74, 82, 90, 98, 106].map((y) => (
            <path key={y} d={`M-8 ${y} L 8 ${y + 5}`} stroke="#4b5563" strokeWidth="1.3" />
          ))}
          <polygon points="0,128 -2.4,118 2.4,118" fill="#6b7280" />
        </g>

        {/* Compression / threaded implant */}
        <g transform="translate(178 350)">
          <rect x="-4.5" y="-8" width="9" height="8" rx="1" fill="#374151" />
          <path d="M-4 0 L 4 0 L 2.6 96 L -2.6 96 Z" fill="url(#bpMetal)" />
          {[8, 16, 24, 32, 40, 48, 56, 64, 72, 80].map((y) => (
            <path key={y} d={`M-7 ${y} L 7 ${y + 4}`} stroke="#4b5563" strokeWidth="1.15" />
          ))}
          <polygon points="0,104 -2.2,96 2.2,96" fill="#6b7280" />
        </g>

        <text x="128" y="560" textAnchor="middle" fill="#e5e7eb" fontSize="11" fontWeight="600" fontFamily="Inter, Segoe UI, sans-serif">
          Strategic Implant®
        </text>
        <text x="128" y="578" textAnchor="middle" fill="#9ca3af" fontSize="9" fontFamily="Inter, Segoe UI, sans-serif">
          кортикальная опора · немедленная нагрузка
        </text>

        {/* Mini principle marks */}
        {[
          { x: 52, l: 'BCS' },
          { x: 128, l: 'BOI' },
          { x: 204, l: 'KOS' },
        ].map((item) => (
          <g key={item.l}>
            <circle cx={item.x} cy="620" r="16" fill="none" stroke="#e85d04" strokeWidth="1.2" />
            <text
              x={item.x}
              y="624"
              textAnchor="middle"
              fill="#e85d04"
              fontSize="9"
              fontWeight="700"
              fontFamily="Inter, Segoe UI, sans-serif"
            >
              {item.l}
            </text>
          </g>
        ))}

        <text x="128" y="668" textAnchor="middle" fill="#6b7280" fontSize="8" fontFamily="Inter, Segoe UI, sans-serif">
          формы имплантатов метода
        </text>

        <path d="M48 710 H208" stroke="#e85d04" strokeOpacity="0.4" />
        <g transform="translate(128 760)">
          <circle cx="0" cy="0" r="10" fill="#e85d04" />
          <path d="M-4 -1 Q 0 6 4 -1" fill="none" stroke="#fff" strokeWidth="1.2" />
        </g>
        <text x="128" y="792" textAnchor="middle" fill="#6b7280" fontSize="8" fontFamily="Inter, Segoe UI, sans-serif">
          Strategic Implant® — знак метода
        </text>
      </svg>
    </aside>
  );
}
