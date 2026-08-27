import { useState, type FormEvent, type KeyboardEvent } from 'react';

interface Props {
  onAdd: (title: string) => Promise<void>;
}

// O nhap nhanh de them the vao cuoi mot danh sach (giong Trello).
export default function AddCardForm({ onAdd }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const value = title.trim();
    if (!value) {
      close();
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await onAdd(value);
      setTitle('');
      // Giu form mo de them nhieu the lien tiep
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thêm được thẻ.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function close() {
    setIsOpen(false);
    setTitle('');
    setError(null);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    submit();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
    if (e.key === 'Escape') close();
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="mt-1 flex w-full items-center gap-1 rounded-lg px-2 py-1.5 text-left text-sm text-slate-500 hover:bg-slate-200/70"
      >
        <span className="text-base leading-none">+</span> Thêm thẻ
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-1 flex flex-col gap-2">
      <textarea
        autoFocus
        rows={2}
        value={title}
        disabled={isSubmitting}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Nhập tiêu đề cho thẻ này..."
        className="w-full resize-none rounded-lg border border-slate-300 px-2 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {isSubmitting ? 'Đang thêm...' : 'Thêm thẻ'}
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
