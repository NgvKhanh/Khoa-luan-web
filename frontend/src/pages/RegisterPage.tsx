import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthShell, { authFieldClass } from '../components/auth/AuthShell';
import GoogleAuthButton from '../components/auth/GoogleAuthButton';
import PasswordField from '../components/auth/PasswordField';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../lib/errorMessage';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await register(name, email, password);
      const redirectTo =
        (location.state as { from?: string } | null)?.from ?? '/';
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Không thể đăng ký. Vui lòng thử lại.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Tạo tài khoản"
      subtitle="Chỉ mất một phút để bắt đầu với TaskFlow."
      footer={
        <>
          Đã có tài khoản?{' '}
          <Link
            to="/login"
            state={location.state}
            className="font-semibold text-white hover:underline"
          >
            Đăng nhập
          </Link>
        </>
      }
    >
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Họ tên
          </label>
          <input
            type="text"
            required
            minLength={2}
            autoComplete="name"
            placeholder="Nguyễn Văn A"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={authFieldClass}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={authFieldClass}
          />
        </div>

        <PasswordField
          label="Mật khẩu"
          value={password}
          onChange={setPassword}
          minLength={6}
          autoComplete="new-password"
        />
        <p className="-mt-2 text-xs text-slate-400">Tối thiểu 6 ký tự.</p>

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-1 rounded-lg bg-[#1558bc] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0f4aa8] disabled:opacity-60"
        >
          {isSubmitting ? 'Đang tạo tài khoản...' : 'Đăng ký'}
        </button>
      </form>

      <GoogleAuthButton />
    </AuthShell>
  );
}
