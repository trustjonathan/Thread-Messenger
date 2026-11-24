import { useAvatarSeedOverride } from '@/lib/avatarOverride';

interface Props {
  seed: string;
  label: string;
  userId?: string;
  size?: number;
  variant?: 'identicon' | 'initials';
  className?: string;
}

const PALETTES = [
  { bg: '#DBEAFE', fg: '#1D4ED8' },
  { bg: '#DCFCE7', fg: '#15803D' },
  { bg: '#FEF3C7', fg: '#B45309' },
  { bg: '#FCE7F3', fg: '#BE185D' },
  { bg: '#E0E7FF', fg: '#4338CA' },
  { bg: '#CCFBF1', fg: '#0F766E' },
];

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function getInitials(label: string): string {
  const cleaned = label.trim().replace(/^@/, '');
  if (!cleaned) return '?';
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

export function IdenticonAvatar({ seed, label, userId, size = 40, variant = 'identicon', className = '' }: Props) {
  const overrideSeed = userId ? useAvatarSeedOverride(userId) : null;
  const h = hashSeed((overrideSeed ?? seed) || label || 'default');
  const palette = PALETTES[h % PALETTES.length];
  const initials = getInitials(label);
  const cells: Array<{ x: number; y: number }> = [];
  let bitIndex = 0;
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      const active = ((h >> (bitIndex % 28)) & 1) === 1;
      bitIndex += 1;
      if (active) {
        cells.push({ x: col, y: row });
        if (col < 2) cells.push({ x: 4 - col, y: row });
      }
    }
  }
  return (
    <div
      role="img"
      aria-label={`${label} avatar`}
      style={{ width: size, height: size }}
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-black/10 select-none dark:border-white/10 ${className}`}
    >
      {variant === 'initials' ? (
        <span
          style={{ backgroundColor: palette.bg, color: palette.fg, fontSize: Math.max(11, Math.round(size * 0.38)) }}
          className="flex h-full w-full items-center justify-center font-semibold"
        >
          {initials}
        </span>
      ) : (
        <svg viewBox="0 0 6 6" width={size} height={size} className="h-full w-full" aria-hidden="true">
          <rect width="6" height="6" fill={palette.bg} />
          {cells.map((cell) => (
            <rect key={`${cell.x}-${cell.y}`} x={cell.x + 0.5} y={cell.y + 0.5} width="1" height="1" rx="0.15" fill={palette.fg} />
          ))}
        </svg>
      )}
    </div>
  );
}
