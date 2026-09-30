import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/Logo';
import AiPlanPreview from '../components/landing/AiPlanPreview';
import BoardPreview from '../components/landing/BoardPreview';
import LandingIcon from '../components/landing/LandingIcon';
import { useAuth } from '../context/AuthContext';
import './LandingPage.css';

const navigation = [
  { label: 'Tính năng', href: '#tinh-nang' },
  { label: 'TaskFlow & AI', href: '#lap-ke-hoach-ai' },
  { label: 'Cách hoạt động', href: '#cach-hoat-dong' },
];
const questions = [
  {
    question: 'TaskFlow phù hợp với ai?',
    answer:
      'Bạn có thể dùng TaskFlow để quản lý công việc cá nhân, làm đồ án hoặc phối hợp trong nhóm. Mỗi dự án có thể được tổ chức thành một bảng riêng, với các danh sách và thẻ công việc phù hợp với quy trình của bạn.',
  },
  {
    question: 'Tôi có cần dùng AI để tạo bảng không?',
    answer:
      'Không bắt buộc. Bạn có thể tự tạo bảng, sử dụng mẫu có sẵn hoặc nhờ AI hỗ trợ lập kế hoạch từ mô tả và tài liệu. Với kế hoạch được gợi ý, bạn có thể xem lại, chỉnh sửa và chọn công việc trước khi tạo bảng.',
  },
  {
    question: 'Gợi ý phân công hoạt động như thế nào?',
    answer:
      'TaskFlow kết hợp thông tin kỹ năng, lịch sử làm việc và khối lượng công việc để gợi ý người phù hợp. Bạn có thể xem lý do gợi ý và chủ động quyết định người nhận việc.',
  },
  {
    question: 'Làm sao để bắt đầu làm việc cùng nhóm?',
    answer:
      'Tạo tài khoản, tạo không gian làm việc và một bảng cho dự án. Sau đó, mời thành viên tham gia, thêm công việc và phân công. Cả nhóm có thể theo dõi tiến độ, bình luận và cập nhật công việc trong cùng một nơi.',
  },
  {
    question: 'Chatbot trợ lý có thể giúp tôi những gì?',
    answer:
      'Hỏi bằng tiếng Việt để tra cứu công việc, việc sắp đến hạn, thứ tự ưu tiên, tiến độ nhóm và khối lượng công việc. Trợ lý trả lời trong phạm vi bạn được phép xem, kèm liên kết tới thẻ khi có kết quả. Trợ lý hiện hỗ trợ tra cứu, chưa tự tạo hoặc chỉnh sửa công việc.',
  },
  {
    question: 'Tôi có thể chia sẻ bảng với người ngoài nhóm không?',
    answer:
      'Bạn có thể bật chế độ công khai nếu có quyền quản lý bảng và gửi liên kết để người khác xem mà không cần đăng nhập. Bản công khai chỉ cho phép xem. Trong nhóm, những thay đổi trên bảng được cập nhật theo thời gian thực để mọi người cùng theo dõi tiến độ.',
  },
];

export default function LandingPage() {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLElement>(null);
  const destination = user ? '/boards' : '/register';
  const actionLabel = user ? 'Vào không gian làm việc' : 'Bắt đầu sử dụng';

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !menuPanelRef.current?.contains(target)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        menuRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  return (
    <div className="landing-page" id="dau-trang">
      <a className="tf-skip-link" href="#noi-dung">
        Đến nội dung chính
      </a>
      <header className="tf-header">
        <div className="tf-wrap tf-header-inner">
          <Link
            to="/"
            aria-label="TaskFlow — Trang chủ"
            className="tf-brand"
            onClick={() => {
              setMenuOpen(false);
              window.scrollTo({ top: 0 });
            }}
          >
            <Logo markClassName="h-9 w-9" textClassName="text-[23px] font-bold tracking-tight" />
          </Link>
          <nav className="tf-desktop-nav" aria-label="Điều hướng giới thiệu">
            {navigation.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>
          <div className="tf-header-actions">
            {!user && (
              <Link className="tf-login-link" to="/login">
                Đăng nhập
              </Link>
            )}
            <Link to={destination} className="tf-button tf-button-primary tf-header-cta">
              {user ? 'Mở TaskFlow' : 'Bắt đầu ngay'}
              <LandingIcon name="arrow" />
            </Link>
            <button
              ref={menuRef}
              type="button"
              className="tf-menu-button"
              aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
              aria-expanded={menuOpen}
              aria-controls="landing-mobile-menu"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <LandingIcon name={menuOpen ? 'close' : 'menu'} />
            </button>
          </div>
          {menuOpen && (
            <nav
              ref={menuPanelRef}
              id="landing-mobile-menu"
              className="tf-mobile-nav"
              aria-label="Điều hướng trên điện thoại"
            >
              {navigation.map((item) => (
                <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>
                  {item.label}
                  <LandingIcon name="chevron" />
                </a>
              ))}
              {!user && (
                <Link to="/login" onClick={() => setMenuOpen(false)}>
                  Đăng nhập
                  <LandingIcon name="arrow" />
                </Link>
              )}
            </nav>
          )}
        </div>
      </header>

      <main id="noi-dung" tabIndex={-1}>
        <section className="tf-hero" aria-labelledby="hero-title">
          <div className="tf-wrap tf-hero-grid">
            <div className="tf-hero-copy">
              <div className="tf-eyebrow-pill">
                <span className="tf-online-dot" />
                Không gian cho những ý tưởng lớn
              </div>
              <h1 id="hero-title">
                Công việc rõ ràng.
                <br />
                <span>
                  Cả nhóm
                  <br className="tf-hero-break" /> cùng tiến.
                </span>
              </h1>
              <p className="tf-hero-description">
                Từ ý tưởng đầu tiên đến công việc hoàn thành. Lập kế hoạch, phối hợp và theo dõi
                tiến độ cùng TaskFlow.
              </p>
              <div className="tf-hero-actions">
                <Link to={destination} className="tf-button tf-button-primary">
                  {actionLabel}
                  <LandingIcon name="arrow" />
                </Link>
                <a href="#lap-ke-hoach-ai" className="tf-button tf-button-secondary">
                  <LandingIcon name="play" />
                  Khám phá cách hoạt động
                </a>
              </div>
              <div className="tf-hero-footnote">
                <span>
                  <LandingIcon name="check" />
                  Dễ bắt đầu
                </span>
                <span>
                  <LandingIcon name="check" />
                  Linh hoạt cho cả nhóm
                </span>
              </div>
            </div>
            <div className="tf-hero-visual">
              <div className="tf-visual-orbit" aria-hidden="true" />
              <div className="tf-preview-top-label">
                <span />
                <span>Ý tưởng có chỗ. Công việc có hướng.</span>
                <LandingIcon name="sparkles" />
              </div>
              <BoardPreview />
              <div className="tf-preview-callout">
                <span className="tf-callout-icon">
                  <LandingIcon name="check" />
                </span>
                <div>
                  <strong>Từng bước nhỏ. Tiến độ rõ.</strong>
                  <span>Cùng nhìn thấy điều gì đang tiếp theo.</span>
                </div>
                <span className="tf-callout-sparkle" aria-hidden="true">
                  ✧
                </span>
              </div>
            </div>
          </div>
          <div className="tf-wrap tf-use-cases">
            <span>CHO MỌI CÁCH BẠN LÀM VIỆC</span>
            <p>
              <LandingIcon name="layers" />
              Dự án cá nhân
            </p>
            <p>
              <LandingIcon name="team" />
              Cộng tác nhóm
            </p>
            <p>
              <LandingIcon name="board" />
              Đồ án & học tập
            </p>
            <p>
              <LandingIcon name="sparkles" />Ý tưởng mới
            </p>
          </div>
        </section>

        <section id="tinh-nang" className="tf-section tf-wrap" aria-labelledby="features-title">
          <div className="tf-section-heading">
            <p className="tf-eyebrow">BỚT PHÂN TÁN, THÊM TẬP TRUNG</p>
            <h2 id="features-title">
              Mọi thứ cần thiết.
              <br />
              Cùng một không gian.
            </h2>
            <p>
              Không phải tìm công việc ở một nơi, trao đổi ở một nơi khác.
              <br className="tf-desktop-break" /> Đưa cả nhóm và kế hoạch về cùng một nhịp.
            </p>
          </div>
          <div className="tf-feature-grid">
            <article className="tf-feature-card">
              <span className="tf-feature-icon tf-feature-cyan">
                <LandingIcon name="board" />
              </span>
              <h3>Nhìn rõ việc. Nắm rõ tiến độ.</h3>
              <p>
                Sắp xếp công việc trên bảng Kanban. Kéo thả thẻ qua từng giai đoạn và cùng nhóm theo
                dõi các cập nhật theo thời gian thực.
              </p>
              <div className="tf-feature-visual tf-mini-flow" aria-hidden="true">
                <div>
                  <i />
                  <span>Cần làm</span>
                  <b />
                  <b />
                </div>
                <div>
                  <i />
                  <span>Đang làm</span>
                  <b />
                  <b />
                </div>
                <div>
                  <i />
                  <span>Hoàn thành</span>
                  <b>
                    <LandingIcon name="check" />
                  </b>
                  <b>
                    <LandingIcon name="check" />
                  </b>
                </div>
              </div>
            </article>
            <article className="tf-feature-card">
              <span className="tf-feature-icon tf-feature-purple">
                <LandingIcon name="team" />
              </span>
              <h3>Công việc phù hợp, đúng người.</h3>
              <p>
                Gợi ý phân công dựa trên kỹ năng, lịch sử làm việc và khối lượng công việc. Quyết
                định vẫn ở bạn.
              </p>
              <div className="tf-feature-visual tf-mini-person" aria-hidden="true">
                <span className="tf-person tf-person-purple">HA</span>
                <div>
                  <strong>Hà Anh</strong>
                  <p>Thiết kế giao diện · Figma</p>
                </div>
                <span className="tf-match-badge">
                  <LandingIcon name="sparkles" />
                  Gợi ý phù hợp
                </span>
              </div>
            </article>
            <article className="tf-feature-card">
              <span className="tf-feature-icon tf-feature-orange">
                <LandingIcon name="calendar" />
              </span>
              <h3>Cùng nhịp với từng thời hạn.</h3>
              <p>
                Theo dõi lịch, hạn hoàn thành và cập nhật từ đồng đội. Những việc cần chú ý luôn có
                chỗ để tìm.
              </p>
              <div className="tf-feature-visual tf-mini-schedule" aria-hidden="true">
                <div>
                  <span>
                    22<small>TH10</small>
                  </span>
                  <p>
                    Hoàn thiện giao diện<small>Đang thực hiện</small>
                  </p>
                  <i />
                </div>
                <div>
                  <span>
                    24<small>TH10</small>
                  </span>
                  <p>
                    Kiểm thử sản phẩm<small>Sắp đến hạn</small>
                  </p>
                  <i />
                </div>
              </div>
            </article>
          </div>
          <article className="tf-assistant-feature" aria-labelledby="assistant-feature-title">
            <div className="tf-assistant-copy">
              <p className="tf-eyebrow">
                <LandingIcon name="message" />
                CHATBOT TRỢ LÝ CÔNG VIỆC
              </p>
              <h3 id="assistant-feature-title">Hỏi tự nhiên. Nắm rõ việc cần làm.</h3>
              <p>
                Tra cứu công việc, xem việc cần ưu tiên và tổng kết tiến độ nhóm bằng tiếng Việt.
                Câu trả lời dựa trên dữ liệu bạn được phép xem, có liên kết tới công việc liên quan.
              </p>
              <Link to={destination} className="tf-text-link">
                {user ? 'Vào TaskFlow để hỏi trợ lý' : 'Bắt đầu với trợ lý'}
                <LandingIcon name="arrow" />
              </Link>
            </div>
            <div
              className="tf-assistant-question"
              role="group"
              aria-label="Ví dụ câu hỏi cho trợ lý"
            >
              <span>CÂU HỎI BẠN CÓ THỂ HỎI</span>
              <blockquote>“Hôm nay tôi nên xử lý gì trước?”</blockquote>
              <p>
                <LandingIcon name="check" />
                Tìm việc quá hạn, đến hạn và những việc tiếp theo.
              </p>
            </div>
          </article>
        </section>

        <section id="lap-ke-hoach-ai" className="tf-ai-section" aria-labelledby="ai-title">
          <div className="tf-wrap tf-ai-grid">
            <div className="tf-ai-copy">
              <p className="tf-eyebrow">
                <LandingIcon name="sparkles" />
                AI, CÙNG BẠN BẮT ĐẦU
              </p>
              <h2 id="ai-title">
                Bạn có ý tưởng.
                <br />
                Cùng biến nó thành
                <br />
                <span>một kế hoạch.</span>
              </h2>
              <p>
                Không còn phải bắt đầu từ một bảng trống. Mô tả điều bạn muốn làm, để TaskFlow hỗ
                trợ chia nhỏ thành những công việc cụ thể.
              </p>
              <ul className="tf-ai-benefits">
                <li>
                  <span>
                    <LandingIcon name="check" />
                  </span>
                  <div>
                    <strong>Bắt đầu từ mô tả hoặc tài liệu</strong>
                    <p>Đưa yêu cầu của bạn vào một kế hoạch có cấu trúc.</p>
                  </div>
                </li>
                <li>
                  <span>
                    <LandingIcon name="check" />
                  </span>
                  <div>
                    <strong>Xem lại, chỉnh sửa, rồi triển khai</strong>
                    <p>Chọn công việc phù hợp trước khi tạo bảng cho nhóm.</p>
                  </div>
                </li>
              </ul>
              <Link to={destination} className="tf-text-link">
                {user ? 'Tạo kế hoạch của bạn' : 'Bắt đầu với ý tưởng của bạn'}
                <LandingIcon name="arrow" />
              </Link>
            </div>
            <AiPlanPreview />
          </div>
        </section>

        <section id="cach-hoat-dong" className="tf-section tf-wrap" aria-labelledby="how-title">
          <div className="tf-section-heading">
            <p className="tf-eyebrow">TỪ Ý TƯỞNG ĐẾN HÀNH ĐỘNG</p>
            <h2 id="how-title">
              Bắt đầu đơn giản.
              <br />
              Tiến về phía trước, cùng nhau.
            </h2>
          </div>
          <div className="tf-steps">
            {[
              {
                number: '01',
                icon: 'layers' as const,
                title: 'Tạo không gian của bạn',
                body: 'Một nơi cho dự án mới. Tạo bảng từ đầu, chọn mẫu hoặc nhận hỗ trợ từ AI.',
              },
              {
                number: '02',
                icon: 'team' as const,
                title: 'Đưa cả nhóm vào cuộc',
                body: 'Mời đồng đội, chia nhỏ công việc và phân công người phụ trách phù hợp.',
              },
              {
                number: '03',
                icon: 'chart' as const,
                title: 'Cùng tiến tới hoàn thành',
                body: 'Cập nhật tiến độ, trao đổi ngay trên thẻ và theo dõi những cột mốc tiếp theo.',
              },
            ].map((step) => (
              <article key={step.number}>
                <div className="tf-step-top">
                  <span>{step.number}</span>
                  <LandingIcon name={step.icon} />
                </div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="tf-faq-section tf-wrap" aria-labelledby="faq-title">
          <div>
            <p className="tf-eyebrow">BẠN CÓ THỂ ĐANG TÒ MÒ</p>
            <h2 id="faq-title">
              Một vài điều
              <br />
              trước khi bắt đầu.
            </h2>
            <p>
              Hiểu thêm về cách TaskFlow
              <br className="tf-desktop-break" /> đồng hành cùng công việc của bạn.
            </p>
          </div>
          <div className="tf-faq-list">
            {questions.map((item) => (
              <details key={item.question}>
                <summary>
                  {item.question}
                  <LandingIcon name="plus" />
                </summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="tf-wrap tf-closing-section" aria-labelledby="closing-title">
          <div className="tf-closing">
            <span className="tf-closing-decoration" aria-hidden="true" />
            <div className="tf-closing-copy">
              <p className="tf-eyebrow">Ý TƯỞNG TIẾP THEO ĐANG CHỜ BẠN</p>
              <h2 id="closing-title">
                Làm việc có hướng.
                <br />
                Cùng nhau đi xa.
              </h2>
              <p>Bắt đầu từ một công việc nhỏ, ngay hôm nay.</p>
            </div>
            <Link to={destination} className="tf-button tf-button-white">
              {actionLabel}
              <LandingIcon name="arrow" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="tf-footer tf-wrap">
        <div>
          <Link
            to="/"
            className="tf-brand"
            aria-label="TaskFlow — Về đầu trang"
            onClick={() => window.scrollTo({ top: 0 })}
          >
            <Logo markClassName="h-8 w-8" textClassName="text-xl font-bold tracking-tight" />
          </Link>
          <p>Một không gian. Cùng nhau tiến bước.</p>
        </div>
        <nav aria-label="Liên kết cuối trang">
          <a href="#tinh-nang">Tính năng</a>
          <a href="#lap-ke-hoach-ai">TaskFlow & AI</a>
          <a href="#cach-hoat-dong">Cách hoạt động</a>
          <Link to={user ? '/boards' : '/login'}>{user ? 'Mở TaskFlow' : 'Đăng nhập'}</Link>
        </nav>
        <div className="tf-footer-bottom">
          <span>© {new Date().getFullYear()} TaskFlow</span>
          <span>Được xây dựng cho những điều bạn muốn hoàn thành.</span>
        </div>
      </footer>
    </div>
  );
}
