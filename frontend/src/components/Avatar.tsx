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
const RETRY_DELAY = [800, 2000, 4000];

/**
 * O avatar tron dung chung.
 * - Luon hien chu cai dau ten lam nen.
 * - Neu co avatarUrl: tai anh ngam ben tren, chi hien khi tai xong.
 *   -> anh loi / cham -> nguoi dung chi thay chu cai, KHONG bao gio thay
 *      bieu tuong "anh vo" cua trinh duyet.
 * - Anh loi thi thu lai vai lan (backoff); quay lai tab -> thu lai 1 lan.
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
  const [attempt, setAttempt] = useState(0); // -1 = da bo cuoc
  const [loaded, setLoaded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Doi anh -> reset
  useEffect(() => {
    setAttempt(0);
    setLoaded(false);
    return () => clearTimeout(timerRef.current);
  }, [avatarUrl]);

  // Da bo cuoc: khi quay lai tab thi thu lai 1 lan
  useEffect(() => {
    if (attempt !== -1) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        setLoaded(false);
        setAttempt(0);
      }
    };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [attempt]);

  const showImg = Boolean(avatarUrl) && attempt !== -1;
  let src = '';
  if (showImg) {
    const base = assetUrl(avatarUrl as string);
    src = attempt > 0 ? `${base}${base.includes('?') ? '&' : '?'}r=${attempt}` : base;
  }

  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold text-white ${className}`}
      style={{ backgroundColor: colorOf(id) }}
      title={name}
    >
      <span className={loaded ? 'invisible' : ''}>{initialsOf(name)}</span>
      {showImg && (
        <img
          key={src}
          src={src}
          alt=""
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => {
            clearTimeout(timerRef.current);
            if (attempt < MAX_RETRY) {
              timerRef.current = setTimeout(
                () => setAttempt((a) => a + 1),
                RETRY_DELAY[attempt] ?? 4000
              );
            } else {
              setAttempt(-1);
            }
          }}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
    </span>
  );
}
