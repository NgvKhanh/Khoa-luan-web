import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteDeclaredCv, fetchDeclaredProfile, myCvUrl, saveDeclaredProfile, uploadDeclaredCv } from '../lib/api/assign';
import {
  CV_TEXT_MAX,
  SKILLS_MAX_CHARS,
  WORK_DESC_MAX,
  WORK_ITEMS_MAX,
  WORK_TITLE_MAX,
  draftIssues,
  draftOf,
  formatSize,
  inputOf,
  sameDraft,
  type ProfileDraft,
  type WorkItemDraft,
} from '../lib/declaredProfile';
import { formatViDate } from '../lib/assignDates';
import { getErrorMessage } from '../lib/errorMessage';
import type { DeclaredProfile } from '../types/assign';
import ConfirmDialog from './ConfirmDialog';

// Mục "Hồ sơ kỹ năng" của trang Hồ sơ cá nhân (ASSIGN_MODULE.md §17): kỹ năng, công việc đã làm và CV mà người dùng TỰ KHAI để
// gợi ý phân công dùng làm thành phần "Hồ sơ" ở MỌI không gian. Tải CV lên = máy chủ trích chữ (không dùng AI) để người dùng sửa
// rồi lưu; tệp CV chỉ chính chủ và chủ / quản trị viên không gian chung tải được.

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#0c66e4] focus:outline-none focus:ring-2 focus:ring-[#0c66e4]/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';
const labelCls = 'mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300';
const hintCls = 'mt-1 text-xs text-slate-500 dark:text-slate-400';
const secondaryBtn =
  'rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700';

type Busy = 'save' | 'upload' | 'delete' | null;

export default function DeclaredProfileSection() {
  const [saved, setSaved] = useState<DeclaredProfile | null>(null);
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const newKey = useRef(0);

  const load = useCallback(() => {
    fetchDeclaredProfile()
      .then((p) => {
        setLoadError(null);
        setSaved(p);
        setDraft(draftOf(p));
      })
      .catch((err) => setLoadError(getErrorMessage(err, 'Không tải được hồ sơ kỹ năng.')));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loadError) {
    return (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
        {loadError}{' '}
        <button
          type="button"
          onClick={() => {
            setLoadError(null);
            load();
          }}
          className="font-medium underline"
        >
          Thử lại
        </button>
      </p>
    );
  }
  if (!saved || !draft) {
    return (
      <p role="status" className="text-sm text-slate-500 dark:text-slate-400">
        Đang tải…
      </p>
    );
  }

  const issues = draftIssues(draft);
  const dirty = !sameDraft(draft, draftOf(saved));
  const patch = (p: Partial<ProfileDraft>) => setDraft({ ...draft, ...p });
  const patchWork = (key: string, p: Partial<WorkItemDraft>) =>
    patch({ workItems: draft.workItems.map((w) => (w.key === key ? { ...w, ...p } : w)) });

  function startAction() {
    setError(null);
    setNotice(null);
  }

  async function save() {
    if (!draft || !dirty || issues.length > 0 || busy) return;
    setBusy('save');
    startAction();
    try {
      const p = await saveDeclaredProfile(inputOf(draft));
      setSaved(p);
      setDraft(draftOf(p));
      setNotice('Đã lưu hồ sơ kỹ năng.');
    } catch (err) {
      setError(getErrorMessage(err, 'Không lưu được hồ sơ kỹ năng.'));
    } finally {
      setBusy(null);
    }
  }

  async function onPickCv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || busy || !draft) return;
    setBusy('upload');
    startAction();
    try {
      const r = await uploadDeclaredCv(file);
      // Máy chủ đã lưu tệp + chữ trích; phần kỹ năng / công việc đang sửa dở vẫn giữ nguyên
      setSaved(r.profile);
      setDraft({ ...draft, cvText: r.text });
      setNotice(
        `Đã đọc được ${r.text.length.toLocaleString('vi-VN')} ký tự từ CV${r.truncated ? ' (tệp dài, chỉ lấy phần đầu)' : ''}. Kiểm tra, sửa phần chữ bên dưới rồi bấm "Lưu hồ sơ".`
      );
    } catch (err) {
      setError(getErrorMessage(err, 'Không đọc được tệp CV.'));
    } finally {
      setBusy(null);
    }
  }

  async function doDeleteCv() {
    if (!draft) return;
    setBusy('delete');
    startAction();
    try {
      const p = await deleteDeclaredCv();
      setSaved(p);
      setDraft({ ...draft, cvText: '' });
      setNotice('Đã xoá CV (cả tệp và phần chữ).');
    } catch (err) {
      setError(getErrorMessage(err, 'Không xoá được CV.'));
    } finally {
      setBusy(null);
      setConfirmDelete(false);
    }
  }

  const cv = saved.cv;
  const showCvText = cv !== null || draft.cvText !== '';

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
        <input
          type="checkbox"
          checked={draft.useForAssign}
          onChange={(e) => patch({ useForAssign: e.target.checked })}
          className="mt-0.5 h-4 w-4"
        />
        <span>
          Dùng hồ sơ này cho gợi ý phân công
          <span className="block text-xs text-slate-500 dark:text-slate-400">
            Tắt thì gợi ý coi như bạn chưa khai, và người khác không tải được CV của bạn.
          </span>
        </span>
      </label>

      <div>
        <label htmlFor="declared-skills" className={labelCls}>
          Kỹ năng
        </label>
        <textarea
          id="declared-skills"
          rows={3}
          value={draft.skillsText}
          onChange={(e) => patch({ skillsText: e.target.value })}
          placeholder="vd: React, thiết kế giao diện, SQL, kiểm thử API"
          className={inputCls}
        />
        <p className={hintCls}>
          Mỗi dòng hoặc mỗi dấu phẩy là một kỹ năng · {draft.skillsText.length}/{SKILLS_MAX_CHARS} ký tự
        </p>
      </div>

      <div>
        <p className={labelCls}>Công việc đã làm</p>
        {draft.workItems.length === 0 && <p className="text-xs text-slate-500 dark:text-slate-400">Chưa có công việc nào.</p>}
        <ul className="flex flex-col gap-2">
          {draft.workItems.map((w, i) => (
            <li key={w.key} data-testid={`work-${i}`} className="rounded-lg border border-slate-200 p-2 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <input
                  value={w.title}
                  onChange={(e) => patchWork(w.key, { title: e.target.value })}
                  maxLength={WORK_TITLE_MAX}
                  placeholder="Tên công việc, vd: Trang quản trị bán hàng"
                  aria-label={`Tên công việc ${i + 1}`}
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={() => patch({ workItems: draft.workItems.filter((x) => x.key !== w.key) })}
                  aria-label={`Xoá công việc ${i + 1}`}
                  className="shrink-0 rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                >
                  Xoá
                </button>
              </div>
              <textarea
                value={w.description}
                onChange={(e) => patchWork(w.key, { description: e.target.value })}
                rows={2}
                placeholder="Mô tả ngắn (tuỳ chọn): bạn đã làm gì, dùng công nghệ gì"
                aria-label={`Mô tả công việc ${i + 1}`}
                className={inputCls + ' mt-1.5'}
              />
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => {
            newKey.current += 1;
            patch({ workItems: [...draft.workItems, { key: `moi-${newKey.current}`, title: '', description: '' }] });
          }}
          disabled={draft.workItems.length >= WORK_ITEMS_MAX}
          className={secondaryBtn + ' mt-2'}
        >
          Thêm công việc
        </button>
        <p className={hintCls}>
          Tối đa {WORK_ITEMS_MAX} công việc; tên tối đa {WORK_TITLE_MAX} ký tự, mô tả tối đa {WORK_DESC_MAX} ký tự.
        </p>
      </div>

      <div>
        <p className={labelCls}>CV</p>
        {cv ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium text-slate-800 dark:text-slate-100">{cv.fileName}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {formatSize(cv.size)} · tải lên {formatViDate(cv.uploadedAt)}
            </span>
            <a href={myCvUrl()} download className="text-sm font-medium text-[#0c66e4] hover:underline dark:text-sky-300">
              Tải về
            </a>
          </div>
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400">Chưa tải CV lên.</p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy !== null} className={secondaryBtn}>
            {busy === 'upload' ? 'Đang đọc CV…' : cv ? 'Thay CV' : 'Tải CV lên'}
          </button>
          {(cv || saved.cvText !== null) && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={busy !== null}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/30"
            >
              Xoá CV
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            hidden
            data-testid="cv-file"
            onChange={(e) => void onPickCv(e)}
          />
        </div>
        <p className={hintCls}>
          .pdf hoặc .docx, tối đa 5MB. Hệ thống chỉ trích chữ (không dùng AI); tệp chỉ bạn và chủ / quản trị viên của các không gian
          bạn tham gia tải được.
        </p>
      </div>

      {showCvText && (
        <div>
          <label htmlFor="declared-cv-text" className={labelCls}>
            Nội dung CV dùng cho gợi ý
          </label>
          <textarea
            id="declared-cv-text"
            rows={8}
            value={draft.cvText}
            onChange={(e) => patch({ cvText: e.target.value })}
            className={inputCls}
          />
          <p className={hintCls}>
            Chỉ bạn thấy phần chữ này; khi khớp một thẻ, người khác chỉ thấy "một đoạn trong CV". Xoá bớt thông tin không liên quan
            (địa chỉ, số điện thoại…) · {draft.cvText.length.toLocaleString('vi-VN')}/{CV_TEXT_MAX.toLocaleString('vi-VN')} ký tự
          </p>
        </div>
      )}

      {issues.length > 0 && (
        <ul role="alert" className="list-disc rounded-lg bg-red-50 py-2 pl-7 pr-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {issues.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
          {notice}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={!dirty || issues.length > 0 || busy !== null}
          className="rounded-lg bg-[#0c66e4] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a5cd4] disabled:opacity-50"
        >
          {busy === 'save' ? 'Đang lưu…' : 'Lưu hồ sơ'}
        </button>
        {dirty && (
          <button
            type="button"
            onClick={() => setDraft(draftOf(saved))}
            disabled={busy !== null}
            className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Hoàn tác
          </button>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Xoá CV?"
        message="Tệp CV và phần chữ trích từ CV sẽ bị xoá hẳn; kỹ năng và công việc đã khai vẫn giữ nguyên."
        confirmLabel="Xoá CV"
        danger
        busy={busy === 'delete'}
        onConfirm={() => void doDeleteCv()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
