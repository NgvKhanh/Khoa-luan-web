import { useEffect, useRef, useState } from 'react';
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

// So lan thu tai lai anh khi loi (loi tam thoi: server vua restart, mang chap chon...)
const MAX_RETRY = 3;
const RETRY_DELAY = [500, 1500, 3000];

/**
 * O avatar tron dung chung: hien anh dai dien neu co (avatarUrl),
 * nguoc lai hien chu cai dau ten tren nen mau theo id.
 * Anh loi -> thu tai lai vai lan (backoff) roi moi tam roi ve chu cai;
 * quay lai tab -> thu lai 1 lan nua (phong khi server phuc hoi sau).
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
  // attempt: 0 = lan dau; >0 = da thu lai n lan; -1 = da bo cuoc -> hien chu cai
  const [attempt, setAttempt] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Doi anh -> reset ve thu lai tu dau
  useEffect(() => {
    setAttempt(0);
    return () => clearTimeout(timerRef.current);
  }, [avatarUrl]);

  // Da bo cuoc: khi nguoi dung quay lai tab thi thu lai 1 lan
  useEffect(() => {
    if (attempt !== -1) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') setAttempt(0);
    };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [attempt]);

  if (avatarUrl && attempt !== -1) {
    // Them tham so ?r= khi thu lai de bo qua cache anh loi
    const base = assetUrl(avatarUrl);
    const src = attempt > 0 ? `${base}${base.includes('?') ? '&' : '?'}r=${attempt}` : base;
    return (
      <img
        key={src}
        src={src}
        alt={name}
        title={name}
        decoding="async"
        onError={() => {
          clearTimeout(timerRef.current);
          if (attempt < MAX_RETRY) {
            timerRef.current = setTimeout(
              () => setAttempt((a) => a + 1),
              RETRY_DELAY[attempt] ?? 3000
            );
          } else {
            setAttempt(-1);
          }
        }}
        className={`shrink-0 rounded-full bg-slate-200 object-cover ${className}`}
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
