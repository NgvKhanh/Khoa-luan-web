import { useEffect, useState } from 'react';
import { assetUrl } from '../lib/assets';
import { initialsOf } from '../lib/avatar';

const AVATAR_COLORS = [
  '#0079BF',
  '#D29034',
  '#519839',
  '#B04632',
  '#89609E',
  '#CD5A91',
  '#00AECC',
  '#4BBF6B',
];

function colorOf(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i += 1)
    h = (h * 31 + id.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[Math.abs(h)]!;
}

/**
 * O avatar tron dung chung: hien anh dai dien neu co (avatarUrl),
 * nguoc lai hien chu cai dau ten tren nen mau theo id.
 */
export default function Avatar({
  id,
  name,
  avatarUrl,
  className = 'h-7 w-7 text-xs',
}: {
  id: string;
  name: string;
  avatarUrl?: string | null;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  // Doi anh -> thu tai lai
  useEffect(() => setBroken(false), [avatarUrl]);

  if (avatarUrl && !broken) {
    return (
      <img
        src={assetUrl(avatarUrl)}
        alt={name}
        title={name}
        onError={() => setBroken(true)}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full font-semibold text-white ${className}`}
      style={{ backgroundColor: colorOf(id) }}
      title={name}
    >
      {initialsOf(name)}
    </span>
  );
}
