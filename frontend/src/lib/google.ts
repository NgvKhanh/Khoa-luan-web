export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as
  | string
  | undefined;

const GSI_SRC = 'https://accounts.google.com/gsi/client';

let cached: Promise<Window['google'] | null> | null = null;

/**
 * Nap thu vien Google Identity Services (chi khi da cau hinh VITE_GOOGLE_CLIENT_ID)
 * va cho toi khi no san sang. Tra ve null neu chua cau hinh, hoac script khong
 * tai duoc sau ~5 giay (vi du bi chan mang).
 */
export function loadGoogleIdentity(): Promise<Window['google'] | null> {
  if (!GOOGLE_CLIENT_ID) return Promise.resolve(null);
  if (cached) return cached;

  cached = new Promise((resolve) => {
    if (window.google?.accounts?.id) {
      resolve(window.google);
      return;
    }

    if (!document.getElementById('google-gsi-script')) {
      const script = document.createElement('script');
      script.id = 'google-gsi-script';
      script.src = GSI_SRC;
      script.async = true;
      script.onerror = () => resolve(null);
      document.head.appendChild(script);
    }

    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      if (window.google?.accounts?.id) {
        window.clearInterval(timer);
        resolve(window.google);
      } else if (tries > 50) {
        window.clearInterval(timer);
        resolve(null);
      }
    }, 100);
  });

  return cached;
}
