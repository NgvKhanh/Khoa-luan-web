import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { createBoard } from '../../lib/api/board';
import {
  searchUnsplashPhotos,
  trackUnsplashDownload,
  type UnsplashPhoto,
} from '../../lib/api/unsplash';
import { BOARD_COLORS } from '../../lib/boardColors';
import { getErrorMessage } from '../../lib/errorMessage';
import type { Board } from '../../types/board';

type Background =
  | { type: 'color'; value: string }
  | {
      type: 'image';
      url: string;
      thumb: string;
      downloadLocation: string;
      creditName: string;
      creditUrl: string;
    };

const DEFAULT_BG: Background = { type: 'color', value: BOARD_COLORS[0]! };

function bgToImage(p: UnsplashPhoto): Background {
  return {
    type: 'image',
    url: p.fullUrl,
    thumb: p.thumbUrl,
    downloadLocation: p.downloadLocation,
    creditName: p.attributionName,
    creditUrl: p.attributionUrl,
  };
}

// Xem truoc: khung bang nho + 3 cot mo phong (giong Trello)
function Preview({ bg }: { bg: Background }) {
  const style =
    bg.type === 'image'
      ? { backgroundImage: `url(${bg.thumb})` }
      : { backgroundColor: bg.value };
  return (
    <div
      className="mb-3 flex h-24 items-start justify-center gap-1.5 rounded-lg bg-cover bg-center p-3 shadow-inner"
      style={style}
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-full w-1/3 rounded-md bg-white/85 shadow-sm"
          style={{ height: `${70 - i * 12}%` }}
        />
      ))}
    </div>
  );
}

interface Props {
  onCreated: (board: Board) => void;
  onClose: () => void;
  className?: string;
}

export default function CreateBoardDialog({
  onCreated,
  onClose,
  className = '',
}: Props) {
  const [view, setView] = useState<'main' | 'photos'>('main');
  const [name, setName] = useState('');
  const [bg, setBg] = useState<Background>(DEFAULT_BG);
  const touched = useRef(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Anh Unsplash
  const [photos, setPhotos] = useState<UnsplashPhoto[]>([]);
  const [unsplashOff, setUnsplashOff] = useState(false);
  const [photosError, setPhotosError] = useState<string | null>(null);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Tai anh (lan dau + khi doi tu khoa). Debounce 400ms cho o tim kiem.
  useEffect(() => {
    let alive = true;
    setLoadingPhotos(true);
    setPhotosError(null);
    const t = setTimeout(() => {
      searchUnsplashPhotos(search, 1)
        .then((res) => {
          if (!alive) return;
          setPhotos(res.photos);
          setPage(1);
          setTotalPages(res.totalPages);
          // Chua chon gi -> lay anh dau lam mac dinh (giong Trello)
          if (!touched.current && !search && res.photos[0]) {
            setBg(bgToImage(res.photos[0]));
          }
        })
        .catch((err) => {
          if (!alive) return;
          const status = err?.response?.status;
          if (status === 503) setUnsplashOff(true);
          else setPhotosError(getErrorMessage(err, 'Không tải được ảnh.'));
        })
        .finally(() => alive && setLoadingPhotos(false));
    }, search ? 400 : 0);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [search]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const res = await searchUnsplashPhotos(search, page + 1);
      setPhotos((cur) => [...cur, ...res.photos]);
      setPage((p) => p + 1);
      setTotalPages(res.totalPages);
    } catch (err) {
      setPhotosError(getErrorMessage(err, 'Không tải được ảnh.'));
    } finally {
      setLoadingMore(false);
    }
  }

  function pick(next: Background) {
    touched.current = true;
    setBg(next);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const board = await createBoard({
        name: name.trim(),
        color: bg.type === 'color' ? bg.value : undefined,
        backgroundImage: bg.type === 'image' ? bg.url : undefined,
      });
      if (bg.type === 'image') void trackUnsplashDownload(bg.downloadLocation);
      onCreated(board);
    } catch (err) {
      setError(getErrorMessage(err, 'Không tạo được bảng.'));
      setSubmitting(false);
    }
  }

  function onNameKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') onClose();
  }

  const quickPhotos = photos.slice(0, 4);
  const canLoadMore = totalPages === null || page < totalPages;

  // ---------- Man hinh chon anh ----------
  if (view === 'photos') {
    return (
      <div
        className={`w-80 rounded-xl border border-slate-200 bg-white p-3 text-slate-800 shadow-2xl ${className}`}
      >
        <div className="mb-2 flex items-center">
          <button
            type="button"
            onClick={() => setView('main')}
            aria-label="Quay lại"
            className="rounded p-1 text-slate-500 hover:bg-slate-100"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <p className="flex-1 text-center text-sm font-semibold">
            Ảnh của Unsplash
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="rounded p-1 text-slate-500 hover:bg-slate-100"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm ảnh (biển, núi, bầu trời...)"
          className="mb-2 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-[#0c66e4] focus:outline-none"
        />

        {photosError && (
          <p className="mb-2 text-xs text-red-600">{photosError}</p>
        )}

        <div className="max-h-72 overflow-y-auto">
          {loadingPhotos ? (
            <p className="py-6 text-center text-sm text-slate-400">Đang tải...</p>
          ) : photos.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              Không có ảnh nào.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-1.5">
                {photos.map((p) => {
                  const selected = bg.type === 'image' && bg.url === p.fullUrl;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      title={`Ảnh của ${p.attributionName} / Unsplash`}
                      onClick={() => {
                        pick(bgToImage(p));
                        setView('main');
                      }}
                      className={`relative h-16 overflow-hidden rounded-md bg-cover bg-center ring-offset-1 transition ${
                        selected ? 'ring-2 ring-[#0c66e4]' : 'hover:opacity-90'
                      }`}
                      style={{
                        backgroundImage: `url(${p.thumbUrl})`,
                        backgroundColor: p.color,
                      }}
                    />
                  );
                })}
              </div>

              {canLoadMore && (
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="mt-2 w-full rounded-lg border border-slate-200 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  {loadingMore ? 'Đang tải...' : 'Tải thêm ảnh'}
                </button>
              )}
            </>
          )}
        </div>

        <p className="mt-2 text-center text-[11px] text-slate-400">
          Ảnh cung cấp bởi Unsplash
        </p>
      </div>
    );
  }

  // ---------- Man hinh chinh ----------
  return (
    <form
      onSubmit={submit}
      className={`w-80 rounded-xl border border-slate-200 bg-white p-3 text-slate-800 shadow-2xl ${className}`}
    >
      <div className="mb-2 flex items-center">
        <p className="flex-1 text-center text-sm font-semibold">Tạo bảng</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="rounded p-1 text-slate-500 hover:bg-slate-100"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <Preview bg={bg} />

      <p className="mb-1.5 text-xs font-semibold text-slate-500">Phông nền</p>

      {!unsplashOff && (
        <div className="mb-2 grid grid-cols-5 gap-1.5">
          {quickPhotos.map((p) => {
            const selected = bg.type === 'image' && bg.url === p.fullUrl;
            return (
              <button
                key={p.id}
                type="button"
                title={`Ảnh của ${p.attributionName} / Unsplash`}
                onClick={() => pick(bgToImage(p))}
                className={`relative h-10 overflow-hidden rounded-md bg-cover bg-center ${
                  selected ? 'ring-2 ring-[#0c66e4] ring-offset-1' : ''
                }`}
                style={{
                  backgroundImage: `url(${p.thumbUrl})`,
                  backgroundColor: p.color,
                }}
              />
            );
          })}
          {loadingPhotos && quickPhotos.length === 0 && (
            <>
              <span className="h-10 animate-pulse rounded-md bg-slate-200" />
              <span className="h-10 animate-pulse rounded-md bg-slate-200" />
              <span className="h-10 animate-pulse rounded-md bg-slate-200" />
              <span className="h-10 animate-pulse rounded-md bg-slate-200" />
            </>
          )}
          <button
            type="button"
            onClick={() => setView('photos')}
            aria-label="Xem thêm ảnh"
            className="grid h-10 place-items-center rounded-md bg-slate-100 text-slate-500 hover:bg-slate-200"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
              <circle cx="5" cy="12" r="1.8" />
              <circle cx="12" cy="12" r="1.8" />
              <circle cx="19" cy="12" r="1.8" />
            </svg>
          </button>
        </div>
      )}

      <div className="mb-2 grid grid-cols-8 gap-1.5">
        {BOARD_COLORS.map((c) => {
          const selected = bg.type === 'color' && bg.value === c;
          return (
            <button
              key={c}
              type="button"
              aria-label={`Màu ${c}`}
              onClick={() => pick({ type: 'color', value: c })}
              className={`h-6 rounded ${
                selected ? 'ring-2 ring-slate-800 ring-offset-1' : ''
              }`}
              style={{ backgroundColor: c }}
            />
          );
        })}
      </div>

      {bg.type === 'image' && (
        <p className="mb-2 truncate text-[11px] text-slate-400">
          Ảnh:{' '}
          <a
            href={bg.creditUrl}
            target="_blank"
            rel="noreferrer"
            className="hover:underline"
          >
            {bg.creditName}
          </a>{' '}
          / Unsplash
        </p>
      )}

      <label className="mb-1 block text-xs font-semibold text-slate-500">
        Tiêu đề bảng <span className="text-red-500">*</span>
      </label>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={onNameKeyDown}
        placeholder="Nhập tên bảng..."
        className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm focus:border-[#0c66e4] focus:outline-none focus:ring-1 focus:ring-[#0c66e4]"
      />
      {!name.trim() && (
        <p className="mt-1 text-xs text-slate-500">
          👋 Tiêu đề bảng là bắt buộc
        </p>
      )}

      <label className="mb-1 mt-3 block text-xs font-semibold text-slate-500">
        Quyền xem
      </label>
      <div className="flex items-center gap-2 rounded-lg border border-slate-300 px-2.5 py-2 text-sm text-slate-600">
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" />
        </svg>
        Không gian làm việc
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !name.trim()}
        className="mt-3 w-full rounded-lg bg-[#0c66e4] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0a5cd4] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? 'Đang tạo...' : 'Tạo mới'}
      </button>
    </form>
  );
}
