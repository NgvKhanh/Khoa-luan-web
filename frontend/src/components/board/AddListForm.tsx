import { useState, type FormEvent, type KeyboardEvent } from 'react';

interface Props {
  onAdd: (name: string) => Promise<void>;
}

// O them danh sach (cot) moi, luon nam o cuoi bang - giong "Add another list" cua Trello.
export default function AddListForm({ onAdd }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const value = name.trim();
    if (!value) {
      close();
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await onAdd(value);
      setName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thêm được danh sách.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function close() {
    setIsOpen(false);
    setName('');
    setError(null);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    submit();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') close();
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex h-10 w-72 shrink-0 items-center gap-1 rounded-xl bg-white/25 px-3 text-sm font-medium text-white hover:bg-white/35"
      >
        <span className="text-base leading-none">+</span> Thêm danh sách
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-72 shrink-0 flex-col gap-2 rounded-xl bg-slate-100 p-2"
    >
      <input
        autoFocus
        value={name}
        disabled={isSubmitting}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Nhập tên danh sách..."
        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {isSubmitting ? 'Đang thêm...' : 'Thêm danh sách'}
        </button>
        <button
          type="button"
          onClick={close}
          className="px-1 text-lg leading-none text-slate-500 hover:text-slate-700"
          aria-label="Đóng"
        >
          ×
        </button>
      </div>
    </form>
  );
}
