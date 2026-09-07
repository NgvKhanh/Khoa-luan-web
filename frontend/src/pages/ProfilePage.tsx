import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { updateProfile, uploadAvatar } from '../lib/api/auth';
import { assetUrl } from '../lib/assets';
import { initialsOf } from '../lib/avatar';
import { getErrorMessage } from '../lib/errorMessage';

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
      setSaved(true);
    } catch (err) {
      setError(getErrorMessage(err, 'Không tải được ảnh đại diện.'));
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

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
        Hồ sơ
      </h1>

      <form
        onSubmit={submit}
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800"
      >
        <div className="mb-5 flex items-center gap-4">
          {preview ? (
            <img
              src={assetUrl(preview)}
              alt=""
              className="h-16 w-16 rounded-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <span className="grid h-16 w-16 place-items-center rounded-full bg-[#7f5ad5] text-lg font-semibold text-white">
              {user ? initialsOf(user.name) : '?'}
            </span>
          )}
          <div className="min-w-0">
            <p className="mb-1 truncate text-sm text-slate-500 dark:text-slate-400">
              {user?.email}
            </p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {uploading ? 'Đang tải lên...' : 'Tải ảnh lên'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={onPickAvatar}
            />
          </div>
        </div>

        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Tên hiển thị
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#0c66e4] focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        />

        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Ảnh đại diện (URL)
        </label>
        <input
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          placeholder="https://..."
          className="mb-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#0c66e4] focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        />
        <p className="mb-4 text-xs text-slate-400">
          Dán liên kết ảnh, hoặc dùng nút "Tải ảnh lên" ở trên. Để trống để dùng
          chữ cái đầu tên.
        </p>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        {saved && (
          <p className="mb-3 text-sm text-emerald-600">Đã lưu hồ sơ.</p>
        )}

        <div className="flex gap-2">
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
      </form>
    </div>
  );
}
