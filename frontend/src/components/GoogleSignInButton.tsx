import { useEffect, useRef, useState } from 'react';
import { GOOGLE_CLIENT_ID, loadGoogleIdentity } from '../lib/google';

interface Props {
  // Nhan ID token cua Google, tra ve promise de nut biet luc nao xong
  onCredential: (idToken: string) => void | Promise<void>;
  text?: 'signin_with' | 'signup_with' | 'continue_with';
}

// Nut "Dang nhap bang Google" - do chinh thu vien cua Google ve.
// Neu chua cau hinh VITE_GOOGLE_CLIENT_ID thi khong hien gi ca.
export default function GoogleSignInButton({
  onCredential,
  text = 'continue_with',
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onCredential);
  const [failed, setFailed] = useState(false);

  // Luon giu tham chieu toi callback moi nhat ma khong lam chay lai effect ben duoi
  useEffect(() => {
    callbackRef.current = onCredential;
  });

  useEffect(() => {
    let cancelled = false;

    loadGoogleIdentity().then((google) => {
      if (cancelled) return;
      if (!google || !containerRef.current) {
        setFailed(true);
        return;
      }

      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID as string,
        callback: (response) => {
          void callbackRef.current(response.credential);
        },
      });
      google.accounts.id.renderButton(containerRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text,
        width: 320,
        locale: 'vi',
      });
    });

    return () => {
      cancelled = true;
    };
  }, [text]);

  if (!GOOGLE_CLIENT_ID) return null;

  if (failed) {
    return (
      <p className="text-center text-xs text-slate-400">
        Không tải được nút Google (kiểm tra mạng hoặc cấu hình Client ID).
      </p>
    );
  }

  return <div ref={containerRef} className="flex justify-center" />;
}
