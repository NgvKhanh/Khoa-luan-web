import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthShell, { authFieldClass } from '../components/auth/AuthShell';
import PasswordField from '../components/auth/PasswordField';
import GoogleSignInButton from '../components/GoogleSignInButton';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../lib/errorMessage';

export default function LoginPage() {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function redirectAfterAuth() {
    const redirectTo = (location.state as { from?: string } | null)?.from ?? '/';
    navigate(redirectTo, { replace: true });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      redirectAfterAuth();
    } catch (err) {
      setError(getErrorMessage(err, 'Không thể đăng nhập. Vui lòng thử lại.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogle(idToken: string) {
    setError(null);
    setIsSubmitting(true);
    try {
      await loginWithGoogle(idToken);
      redirectAfterAuth();
    } catch (err) {
      setError(getErrorMessage(err, 'Đăng nhập bằng Google thất bại.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Đăng nhập"
      subtitle="Chào mừng bạn quay lại TaskFlow."
      footer={
        <>
          Chưa có tài khoản?{' '}
          <Link to="/register" className="font-medium text-[#1558bc] hover:underline">
            Đăng ký
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
          autoComplete="current-password"
        />

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-1 rounded-lg bg-[#1558bc] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0f4aa8] disabled:opacity-60"
        >
          {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        HOẶC
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <GoogleSignInButton text="signin_with" onCredential={handleGoogle} />
    </AuthShell>
  );
}
