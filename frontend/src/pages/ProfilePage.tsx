import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import Avatar from '../components/Avatar';
import { useAuth } from '../context/AuthContext';
import { useBoards } from '../context/BoardsContext';
import { useTheme } from '../context/ThemeContext';
import { updateProfile, uploadAvatar } from '../lib/api/auth';
import { getErrorMessage } from '../lib/errorMessage';

const THEME_LABEL = { light: 'Sáng', dark: 'Tối', system: 'Hệ thống' } as const;

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function Card({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h2>
      {desc && (
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{desc}</p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#0c66e4] focus:outline-none focus:ring-2 focus:ring-[#0c66e4]/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const { boards } = useBoards();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? '');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const starred = boards.filter((b) => b.isStarred).length;

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setUploading(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await uploadAvatar(f);
      updateUser(updated);
      setAvatarUrl(updated.avatarUrl ?? '');
    } catch (err) {
      setError(getErrorMessage(err, 'Không tải được ảnh đại diện.'));
    } finally {
      setUploading(false);
    }
  }

  async function removeAvatar() {
    setUploading(true);
    setError(null);
    try {
      const updated = await updateProfile({ avatarUrl: null });
      updateUser(updated);
      setAvatarUrl('');
    } catch (err) {
      setError(getErrorMessage(err, 'Không xoá được ảnh đại diện.'));
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateProfile({
        name: name.trim(),
        avatarUrl: avatarUrl.trim() || null,
      });
      updateUser(updated);
      setSaved(true);
    } catch (err) {
      setError(getErrorMessage(err, 'Không lưu được hồ sơ.'));
    } finally {
      setBusy(false);
    }
  }

  const preview = avatarUrl.trim();

  const linkRow =
    'flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700';

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        Hồ sơ
      </h1>

      {/* Thẻ danh tính + số liệu */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="h-24 bg-gradient-to-r from-[#0c66e4] via-[#3b6fe0] to-[#7c3aed]" />
        <div className="flex items-end gap-4 px-6 pb-4">
          <span className="-mt-12 rounded-full ring-4 ring-white dark:ring-slate-800">
            <Avatar
              id={user?.id ?? 'me'}
              name={user?.name ?? '?'}
              avatarUrl={preview || null}
              className="h-20 w-20 text-2xl"
            />
          </span>
          <div className="min-w-0 pb-1">
            <p className="truncate text-lg font-bold text-slate-900 dark:text-slate-100">
              {user?.name}
            </p>
            <p className="truncate text-sm text-slate-500 dark:text-slate-400">
              {user?.email}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-slate-200 border-t border-slate-200 text-center dark:divide-slate-700 dark:border-slate-700">
          <div className="py-3">
            <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {boards.length}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Bảng</p>
          </div>
          <div className="py-3">
            <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {starred}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Đánh dấu sao
            </p>
          </div>
          <div className="py-3">
            <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {fmtDate(user?.createdAt)}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tham gia
            </p>
          </div>
        </div>
      </div>

      {/* Ảnh đại diện */}
      <Card
        title="Ảnh đại diện"
        desc="PNG, JPG, WEBP hoặc GIF · tối đa 2MB. Để trống sẽ dùng chữ cái đầu tên."
      >
        <div className="flex items-center gap-4">
          <Avatar
            id={user?.id ?? 'me'}
            name={user?.name ?? '?'}
            avatarUrl={preview || null}
            className="h-16 w-16 text-lg"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="rounded-lg bg-[#0c66e4] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#0a5cd4] disabled:opacity-50"
            >
              {uploading ? 'Đang xử lý...' : 'Tải ảnh lên'}
            </button>
            {preview && (
              <button
                type="button"
                onClick={removeAvatar}
                disabled={uploading}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Xoá ảnh
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              hidden
              onChange={onPickAvatar}
            />
          </div>
        </div>
      </Card>

      {/* Thông tin cá nhân */}
      <form onSubmit={submit}>
        <Card title="Thông tin cá nhân">
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Tên hiển thị
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls + ' mb-4'}
          />

          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Email
          </label>
          <div className="mb-1 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="4" y="11" width="16" height="9" rx="2" />
              <path d="M8 11V8a4 4 0 018 0v3" />
            </svg>
            <span className="truncate">{user?.email}</span>
          </div>
          <p className="mb-4 text-xs text-slate-400">Không thể thay đổi email.</p>

          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Ảnh đại diện qua liên kết (tuỳ chọn)
          </label>
          <input
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://..."
            className={inputCls}
          />
          <p className="mt-1 text-xs text-slate-400">
            Dán một liên kết ảnh, hoặc dùng nút "Tải ảnh lên" ở trên.
          </p>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          {saved && (
            <p className="mt-3 text-sm text-emerald-600">Đã lưu thay đổi.</p>
          )}

          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="rounded-lg bg-[#0c66e4] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a5cd4] disabled:opacity-50"
            >
              {busy ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Quay lại
            </button>
          </div>
        </Card>
      </form>

      {/* Tài khoản & bảo mật */}
      <Card title="Tài khoản & bảo mật">
        <div className="-mx-2 flex flex-col">
          {[
            { label: 'Đổi mật khẩu', to: '/settings/password' },
            { label: 'Thẻ của tôi', to: '/my-cards' },
            { label: 'Hoạt động của tôi', to: '/activity' },
          ].map((it) => (
            <button
              key={it.to}
              type="button"
              onClick={() => navigate(it.to)}
              className={linkRow}
            >
              <span>{it.label}</span>
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          ))}
        </div>

        <div className="my-3 border-t border-slate-200 dark:border-slate-700" />

        <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          Giao diện
        </p>
        <div className="inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
          {(['light', 'dark', 'system'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTheme(t)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                theme === t
                  ? 'bg-[#0c66e4] text-white'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {THEME_LABEL[t]}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
