import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import Avatar from '../components/Avatar';
import DeclaredProfileSection from '../components/DeclaredProfileSection';
import {
  ProfileIcon,
  ProfilePanel,
  profileInput,
  profilePrimaryButton,
  profileSecondaryButton,
  type ProfileIconName,
} from '../components/profile/ProfileUi';
import { useAuth } from '../context/AuthContext';
import { useBoards } from '../context/BoardsContext';
import { useTheme } from '../context/ThemeContext';
import { updateProfile, uploadAvatar } from '../lib/api/auth';
import { getErrorMessage } from '../lib/errorMessage';

const sections = [
  { id: 'personal', label: 'Thông tin cá nhân', icon: 'user' },
  { id: 'skills', label: 'Kỹ năng & CV', icon: 'skills' },
  { id: 'preferences', label: 'Tùy chọn', icon: 'settings' },
] as const;
const themes = [
  { id: 'light', label: 'Sáng', icon: 'sun' },
  { id: 'dark', label: 'Tối', icon: 'moon' },
  { id: 'system', label: 'Hệ thống', icon: 'monitor' },
] as const;

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function SettingsLink({
  to,
  icon,
  label,
  description,
}: {
  to: string;
  icon: ProfileIconName;
  label: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:hover:bg-slate-700/50"
    >
      <span className="rounded-lg bg-slate-100 p-2.5 text-slate-500 dark:bg-slate-700 dark:text-slate-300">
        <ProfileIcon name={icon} className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">
          {label}
        </span>
        <span className="mt-0.5 block text-xs leading-5 text-slate-500 dark:text-slate-400">
          {description}
        </span>
      </span>
      <ProfileIcon name="arrow" className="h-4 w-4 text-slate-400 group-hover:text-indigo-500" />
    </Link>
  );
}

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const { boards, isLoading: boardsLoading, error: boardsError } = useBoards();
  const { theme, setTheme } = useTheme();
  const [section, setSection] = useState<(typeof sections)[number]['id']>('personal');
  const [name, setName] = useState(user?.name ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? '');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const preview = avatarUrl.trim();
  const dirty = name.trim() !== (user?.name ?? '') || preview !== (user?.avatarUrl ?? '');
  const pending = busy || uploading;
  const starred = boards.filter((b) => b.isStarred).length;

  function clearFeedback() {
    setError(null);
    setNotice(null);
  }

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || pending) return;
    clearFeedback();
    if (
      !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) ||
      file.size > 2 * 1024 * 1024
    ) {
      setError('Chọn ảnh PNG, JPG, WEBP hoặc GIF có dung lượng tối đa 2MB.');
      return;
    }
    setUploading(true);
    try {
      const updated = await uploadAvatar(file);
      updateUser(updated);
      setAvatarUrl(updated.avatarUrl ?? '');
      setNotice('Đã cập nhật ảnh đại diện.');
    } catch (err) {
      setError(getErrorMessage(err, 'Không tải được ảnh đại diện.'));
    } finally {
      setUploading(false);
    }
  }

  async function removeAvatar() {
    if (pending) return;
    setUploading(true);
    clearFeedback();
    try {
      const updated = await updateProfile({ avatarUrl: null });
      updateUser(updated);
      setAvatarUrl('');
      setNotice('Đã xoá ảnh đại diện.');
    } catch (err) {
      setError(getErrorMessage(err, 'Không xoá được ảnh đại diện.'));
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !dirty || pending) return;
    setBusy(true);
    clearFeedback();
    try {
      const updated = await updateProfile({ name: name.trim(), avatarUrl: preview || null });
      updateUser(updated);
      setName(updated.name);
      setAvatarUrl(updated.avatarUrl ?? '');
      setNotice('Đã lưu thay đổi.');
    } catch (err) {
      setError(getErrorMessage(err, 'Không lưu được hồ sơ.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full space-y-6 pb-6">
      <header>
        <p className="mb-2 text-xs font-medium tracking-wide text-slate-500 dark:text-slate-400">
          TÀI KHOẢN
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-[28px] dark:text-slate-100">
          Hồ sơ cá nhân
        </h1>
        <p className="mt-1.5 text-sm leading-6 text-slate-500 dark:text-slate-400">
          Quản lý thông tin của bạn và cách bạn làm việc trên TaskFlow.
        </p>
      </header>

      <section
        aria-label="Tổng quan hồ sơ"
        className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-700 dark:bg-slate-800"
      >
        <div className="h-1.5 bg-gradient-to-r from-cyan-400 via-indigo-400 to-indigo-600" />
        <div className="flex flex-col gap-6 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="relative shrink-0 rounded-full bg-slate-50 p-1.5 ring-1 ring-slate-100 dark:bg-slate-900/50 dark:ring-slate-700">
              <Avatar
                id={user?.id ?? 'me'}
                name={user?.name ?? '?'}
                avatarUrl={preview || null}
                className="h-16 w-16 text-xl sm:h-20 sm:w-20 sm:text-2xl"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={pending}
                aria-label="Thay ảnh đại diện"
                className="absolute -right-0.5 bottom-0 grid h-8 w-8 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-xs hover:text-indigo-600 focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
              >
                <ProfileIcon name="camera" />
              </button>
            </div>
            <div className="min-w-0">
              <p
                className="truncate text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100"
                title={user?.name}
              >
                {user?.name}
              </p>
              <p
                className="mt-1 truncate text-sm text-slate-500 dark:text-slate-400"
                title={user?.email}
              >
                {user?.email}
              </p>
              <p className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <ProfileIcon name="calendar" className="h-3.5 w-3.5" />
                Tham gia từ {fmtDate(user?.createdAt)}
              </p>
            </div>
          </div>
          <dl className="grid shrink-0 grid-cols-2 divide-x divide-slate-200 border-t border-slate-100 pt-4 lg:min-w-52 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-2 dark:divide-slate-700 dark:border-slate-700">
            {[
              { label: 'Bảng tham gia', value: boards.length },
              { label: 'Đánh dấu sao', value: starred },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col px-4 text-center">
                <dt className="order-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {stat.label}
                </dt>
                <dd className="text-2xl font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                  {boardsLoading || boardsError ? '—' : stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        aria-label="Chọn ảnh đại diện"
        hidden
        onChange={onPickAvatar}
      />
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          <ProfileIcon name="check" />
          {notice}
        </p>
      )}
      {uploading && (
        <p role="status" className="text-sm text-slate-500 dark:text-slate-400">
          Đang cập nhật ảnh đại diện…
        </p>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-6">
        <aside className="min-w-0">
          <nav
            aria-label="Cài đặt hồ sơ"
            className="grid grid-cols-3 gap-1 rounded-xl border border-slate-200 bg-white p-1.5 lg:flex lg:flex-col lg:border-0 lg:bg-transparent lg:p-0 dark:border-slate-700 dark:bg-slate-800 lg:dark:bg-transparent"
          >
            {sections.map((item) => (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                type="button"
                aria-label={item.label}
                aria-pressed={section === item.id}
                aria-controls={`profile-${item.id}`}
                onClick={() => setSection(item.id)}
                className={`flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-lg px-1.5 py-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-indigo-500 sm:flex-row sm:gap-2.5 sm:px-3 sm:text-sm lg:justify-start ${section === item.id ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300' : 'text-slate-500 hover:bg-white hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'}`}
              >
                <ProfileIcon name={item.icon} className="h-[18px] w-[18px]" />
                <span className="sm:hidden">{item.id === 'personal' ? 'Cá nhân' : item.label}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="mt-6 hidden border-t border-slate-200 pt-5 lg:block dark:border-slate-700">
            <p className="mb-2 px-3 text-[11px] font-semibold tracking-wider text-slate-400 dark:text-slate-500">
              KHÔNG GIAN CỦA BẠN
            </p>
            {[
              { to: '/my-cards', label: 'Thẻ của tôi', icon: 'board' },
              { to: '/activity', label: 'Hoạt động của tôi', icon: 'activity' },
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-slate-500 hover:bg-white hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                <ProfileIcon name={item.icon as ProfileIconName} />
                {item.label}
              </Link>
            ))}
          </div>
        </aside>

        <div className="min-w-0">
          <div id="profile-personal" hidden={section !== 'personal'}>
            <ProfilePanel
              id="personal-title"
              title="Thông tin cá nhân"
              description="Thông tin giúp mọi người nhận ra bạn trong không gian làm việc."
            >
              <form onSubmit={submit}>
                <div className="space-y-6 p-5 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 p-4 dark:bg-slate-900/40">
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        Ảnh đại diện
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        PNG, JPG, WEBP hoặc GIF · Tối đa 2MB
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        disabled={pending}
                        className={profileSecondaryButton}
                      >
                        <ProfileIcon name="upload" />
                        Tải ảnh lên
                      </button>
                      {preview && (
                        <button
                          type="button"
                          onClick={removeAvatar}
                          disabled={pending}
                          className="min-h-10 rounded-lg px-2 text-sm text-slate-500 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:opacity-50 dark:text-slate-400"
                        >
                          Xoá ảnh
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="profile-name"
                      className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200"
                    >
                      Tên hiển thị
                    </label>
                    <input
                      id="profile-name"
                      autoComplete="name"
                      required
                      minLength={2}
                      maxLength={100}
                      value={name}
                      disabled={pending}
                      onChange={(e) => {
                        setName(e.target.value);
                        clearFeedback();
                      }}
                      className={profileInput}
                      aria-describedby="profile-name-hint"
                    />
                    <p
                      id="profile-name-hint"
                      className="mt-2 text-xs text-slate-500 dark:text-slate-400"
                    >
                      Tên hiển thị trên thẻ công việc, bình luận và trong nhóm.
                    </p>
                  </div>

                  <div>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <label
                        htmlFor="profile-email"
                        className="text-sm font-medium text-slate-700 dark:text-slate-200"
                      >
                        Địa chỉ email
                      </label>
                      {user?.emailVerifiedAt && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                          <ProfileIcon name="check" className="h-3.5 w-3.5" />
                          Đã xác minh
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        id="profile-email"
                        type="email"
                        value={user?.email ?? ''}
                        readOnly
                        className={`${profileInput} pr-10 bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400`}
                        aria-describedby="profile-email-hint"
                      />
                      <ProfileIcon
                        name="lock"
                        className="pointer-events-none absolute right-3.5 top-3 h-4 w-4 text-slate-400"
                      />
                    </div>
                    <p
                      id="profile-email-hint"
                      className="mt-2 text-xs text-slate-500 dark:text-slate-400"
                    >
                      Email được dùng để đăng nhập và không thể thay đổi.
                    </p>
                  </div>

                  <details className="rounded-lg border border-slate-200 dark:border-slate-700">
                    <summary className="cursor-pointer rounded-lg px-4 py-3 text-sm font-medium text-slate-600 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:text-slate-300">
                      Dùng ảnh từ liên kết
                    </summary>
                    <div className="px-4 pb-4">
                      <label
                        htmlFor="profile-avatar-url"
                        className="mb-2 block text-xs text-slate-500 dark:text-slate-400"
                      >
                        Liên kết ảnh đại diện (tùy chọn)
                      </label>
                      <input
                        id="profile-avatar-url"
                        value={avatarUrl}
                        disabled={pending}
                        onChange={(e) => {
                          setAvatarUrl(e.target.value);
                          clearFeedback();
                        }}
                        placeholder="https://example.com/avatar.jpg"
                        className={profileInput}
                      />
                    </div>
                  </details>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:px-6 dark:border-slate-700 dark:bg-slate-900/20">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {dirty ? 'Bạn có thay đổi chưa lưu.' : 'Thông tin của bạn đã được cập nhật.'}
                  </p>
                  <div className="flex items-center gap-2">
                    {dirty && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          setName(user?.name ?? '');
                          setAvatarUrl(user?.avatarUrl ?? '');
                          clearFeedback();
                        }}
                        className={profileSecondaryButton}
                      >
                        Hoàn tác
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={pending || !name.trim() || !dirty}
                      className={profilePrimaryButton}
                    >
                      {busy ? 'Đang lưu…' : 'Lưu thay đổi'}
                    </button>
                  </div>
                </div>
              </form>
            </ProfilePanel>
          </div>

          {/* Keep panels mounted so switching sections preserves unsaved drafts. */}
          <div id="profile-skills" hidden={section !== 'skills'}>
            <ProfilePanel
              id="skills-title"
              title="Kỹ năng & CV"
              description="Chia sẻ kỹ năng và kinh nghiệm để nhận gợi ý công việc phù hợp hơn."
            >
              <div className="p-5 sm:p-6">
                <DeclaredProfileSection />
              </div>
            </ProfilePanel>
          </div>

          <div id="profile-preferences" hidden={section !== 'preferences'} className="space-y-5">
            <ProfilePanel
              id="appearance-title"
              title="Giao diện"
              description="Chọn giao diện phù hợp với cách bạn làm việc."
            >
              <div className="p-5 sm:p-6">
                <div
                  role="group"
                  aria-label="Chế độ giao diện"
                  className="grid grid-cols-3 gap-2 sm:gap-3"
                >
                  {themes.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={theme === item.id}
                      onClick={() => setTheme(item.id)}
                      className={`min-w-0 rounded-xl border-2 p-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 sm:p-3 ${theme === item.id ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/10' : 'border-slate-200 hover:border-slate-300 dark:border-slate-600 dark:hover:border-slate-500'}`}
                    >
                      <span
                        aria-hidden="true"
                        className={`flex h-16 overflow-hidden rounded-md border sm:h-20 ${item.id === 'dark' ? 'border-slate-700 bg-slate-900' : item.id === 'system' ? 'border-slate-300 bg-gradient-to-r from-slate-50 from-50% to-slate-900 to-50%' : 'border-slate-200 bg-slate-50'}`}
                      >
                        <span
                          className={`w-1/4 border-r ${item.id === 'dark' ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}
                        />
                        <span className="flex flex-1 flex-col gap-1.5 p-2 sm:p-3">
                          <span className="h-1.5 w-3/4 rounded bg-indigo-400/70" />
                          <span className="h-1.5 w-full rounded bg-slate-400/25" />
                          <span className="h-1.5 w-2/3 rounded bg-slate-400/25" />
                        </span>
                      </span>
                      <span className="mt-3 flex items-center justify-between gap-1 text-xs font-medium text-slate-700 sm:text-sm dark:text-slate-200">
                        <span className="flex items-center gap-1.5">
                          <ProfileIcon name={item.icon} className="hidden h-4 w-4 sm:block" />
                          {item.label}
                        </span>
                        <span
                          className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${theme === item.id ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 dark:border-slate-500'}`}
                        >
                          {theme === item.id && <ProfileIcon name="check" className="h-3 w-3" />}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
                <p className="mt-4 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  Lựa chọn được lưu tự động trên trình duyệt này. Chế độ Hệ thống sẽ theo cài đặt
                  của thiết bị.
                </p>
              </div>
            </ProfilePanel>
            <ProfilePanel
              id="account-title"
              title="Tài khoản & hoạt động"
              description="Quản lý bảo mật và truy cập công việc cá nhân."
            >
              <div className="space-y-1 p-2 sm:p-3">
                <SettingsLink
                  to="/settings/password"
                  icon="lock"
                  label="Đổi mật khẩu"
                  description="Cập nhật mật khẩu để bảo vệ tài khoản."
                />
                <SettingsLink
                  to="/my-cards"
                  icon="board"
                  label="Thẻ của tôi"
                  description="Xem các công việc được giao cho bạn."
                />
                <SettingsLink
                  to="/activity"
                  icon="activity"
                  label="Hoạt động của tôi"
                  description="Xem lại những cập nhật gần đây của bạn."
                />
              </div>
            </ProfilePanel>
          </div>
        </div>
      </div>
    </div>
  );
}
