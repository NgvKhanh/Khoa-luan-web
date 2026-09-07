/**
 * Noi dung cac email he thong gui cho nguoi dung.
 * Moi ham tra ve { subject, html } de dua thang vao sendMail().
 */

const BRAND = '#0c66e4';

/** Khung chung: header TaskFlow + phan than + chan trang. */
function layout(bodyHtml: string): string {
  return `
  <div style="background:#f1f5f9;padding:24px 0;font-family:system-ui,-apple-system,'Segoe UI',sans-serif">
    <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
      <div style="background:${BRAND};padding:16px 24px">
        <span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:-0.02em">TaskFlow</span>
      </div>
      <div style="padding:24px;color:#1e293b;font-size:14px;line-height:1.6">
        ${bodyHtml}
      </div>
      <div style="padding:16px 24px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:12px">
        Email tu dong tu TaskFlow &mdash; Do an tot nghiep. Vui long khong tra loi email nay.
      </div>
    </div>
  </div>`;
}

function button(url: string, label: string): string {
  return `
    <a href="${url}"
       style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;
              padding:10px 20px;border-radius:8px;font-weight:600;font-size:14px">
      ${label}
    </a>`;
}

export function resetPasswordEmail(input: {
  name: string;
  url: string;
  expiresInMinutes: number;
}): { subject: string; html: string } {
  const { name, url, expiresInMinutes } = input;
  return {
    subject: 'Dat lai mat khau TaskFlow',
    html: layout(`
      <p>Chao ${escapeHtml(name)},</p>
      <p>Chung toi nhan duoc yeu cau dat lai mat khau cho tai khoan cua ban.
         Bam nut duoi day de tao mat khau moi:</p>
      <p style="margin:20px 0">${button(url, 'Dat lai mat khau')}</p>
      <p style="color:#64748b">Lien ket co hieu luc trong ${expiresInMinutes} phut.
         Neu ban khong yeu cau, hay bo qua email nay &mdash; mat khau hien tai van an toan.</p>
      <p style="color:#94a3b8;font-size:12px;word-break:break-all">
         Neu nut khong hoat dong, sao chep dia chi sau vao trinh duyet:<br>${url}</p>
    `),
  };
}

export function verifyEmailEmail(input: {
  name: string;
  url: string;
  expiresInHours: number;
}): { subject: string; html: string } {
  const { name, url, expiresInHours } = input;
  return {
    subject: 'Xac minh email TaskFlow',
    html: layout(`
      <p>Chao ${escapeHtml(name)},</p>
      <p>Cam on ban da dang ky TaskFlow. Bam nut duoi day de xac minh dia chi email:</p>
      <p style="margin:20px 0">${button(url, 'Xac minh email')}</p>
      <p style="color:#64748b">Lien ket co hieu luc trong ${expiresInHours} gio.
         Neu ban khong tao tai khoan nay, hay bo qua email.</p>
      <p style="color:#94a3b8;font-size:12px;word-break:break-all">
         Neu nut khong hoat dong, sao chep dia chi sau vao trinh duyet:<br>${url}</p>
    `),
  };
}

/** Chan cac ky tu HTML nguy hiem trong du lieu do nguoi dung nhap (ten). */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
