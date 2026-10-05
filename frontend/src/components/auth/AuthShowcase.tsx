// Cột giới thiệu bên phải trang đăng nhập/đăng ký (từ 1024px): một bảng Kanban minh hoạ với DỮ LIỆU DEMO,
// không chứa thông tin người dùng thật. Chỉ để trang trí nên ẩn với trình đọc màn hình.
const COLUMNS = [
  {
    title: 'Cần làm',
    cards: [
      { text: 'Viết nội dung trang giới thiệu', tag: 'Nội dung', tagClass: 'bg-orange-100 text-orange-700', who: 'LA' },
      { text: 'Chuẩn bị bộ hình sản phẩm', tag: 'Thiết kế', tagClass: 'bg-violet-100 text-violet-700', who: 'MN' },
    ],
  },
  {
    title: 'Đang làm',
    cards: [
      { text: 'Thiết kế giao diện website', tag: 'Thiết kế', tagClass: 'bg-violet-100 text-violet-700', who: 'HA' },
      { text: 'Xây dựng trang đăng ký', tag: 'Phát triển', tagClass: 'bg-sky-100 text-sky-700', who: 'TU' },
    ],
  },
  {
    title: 'Hoàn thành',
    cards: [
      { text: 'Thống nhất ý tưởng dự án', tag: 'Kế hoạch', tagClass: 'bg-emerald-100 text-emerald-700', who: 'LA' },
      { text: 'Phác thảo luồng người dùng', tag: 'Kế hoạch', tagClass: 'bg-emerald-100 text-emerald-700', who: 'MN' },
    ],
  },
];

const BENEFITS = [
  'Bảng Kanban kéo thả, xem cả dạng bảng biểu và lịch',
  'Tạo kế hoạch từ mô tả bằng AI, xem lại trước khi áp dụng',
  'Gợi ý người phù hợp cho từng công việc, cả nhóm cùng cập nhật theo thời gian thực',
];

export default function AuthShowcase() {
  return (
    <aside aria-hidden="true" className="hidden flex-col justify-center gap-7 px-10 py-12 text-white lg:flex xl:px-16">
      <div>
        <h2 className="text-3xl font-bold leading-tight tracking-tight xl:text-4xl">
          Công việc rõ ràng.
          <br />
          Cả nhóm cùng tiến.
        </h2>
        <p className="mt-3 max-w-md text-base text-white/85">
          Từ ý tưởng đầu tiên đến công việc hoàn thành, lập kế hoạch, phối hợp và theo dõi tiến độ cùng TaskFlow.
        </p>
      </div>

      <div className="max-w-xl rounded-2xl bg-white/15 p-3 shadow-2xl ring-1 ring-white/25 backdrop-blur-sm">
        <div className="mb-2 flex items-center gap-1.5 px-1">
          <span className="h-2 w-2 rounded-full bg-white/60" />
          <span className="h-2 w-2 rounded-full bg-white/40" />
          <span className="h-2 w-2 rounded-full bg-white/30" />
          <span className="ml-2 text-xs font-medium text-white/85">Ra mắt website mới (dữ liệu minh hoạ)</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {COLUMNS.map((col) => (
            <div key={col.title} className="rounded-xl bg-slate-100/95 p-2">
              <p className="mb-1.5 px-1 text-[11px] font-semibold text-slate-600">{col.title}</p>
              <div className="flex flex-col gap-1.5">
                {col.cards.map((c) => (
                  <div key={c.text} className="rounded-lg bg-white p-2 shadow-sm">
                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${c.tagClass}`}>{c.tag}</span>
                    <p className="mt-1 text-[11px] font-medium leading-snug text-slate-800">{c.text}</p>
                    <span className="mt-1.5 grid h-4 w-4 place-items-center rounded-full bg-slate-700 text-[8px] font-bold text-white">
                      {c.who}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <ul className="flex max-w-md flex-col gap-2 text-sm text-white/90">
        {BENEFITS.map((b) => (
          <li key={b} className="flex items-start gap-2">
            <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 13l4 4L19 7" />
            </svg>
            {b}
          </li>
        ))}
      </ul>
    </aside>
  );
}
