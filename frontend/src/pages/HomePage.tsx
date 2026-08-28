import { useAuth } from '../context/AuthContext';

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-slate-800">
        Xin chào{user ? `, ${user.name}` : ''}
      </h1>

      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">
        Chưa có nội dung.
      </div>
    </div>
  );
}
