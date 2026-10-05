import { useState } from 'react';
import LandingIcon from './LandingIcon';

const examples = [
  {
    name: 'Website bán hàng',
    prompt: 'Lập kế hoạch xây dựng website bán hàng cho nhóm 4 người, từ thiết kế đến triển khai.',
    phases: [
      {
        title: 'Khám phá & thiết kế',
        tasks: ['Xác định yêu cầu và luồng mua hàng', 'Thiết kế giao diện sản phẩm, giỏ hàng'],
      },
      {
        title: 'Phát triển & tích hợp',
        tasks: ['Xây dựng danh mục và quản lý sản phẩm', 'Tích hợp giỏ hàng và đặt hàng'],
      },
      {
        title: 'Kiểm thử & ra mắt',
        tasks: ['Kiểm thử quy trình mua hàng', 'Triển khai và theo dõi phản hồi'],
      },
    ],
  },
  {
    name: 'Chiến dịch ra mắt',
    prompt:
      'Lập kế hoạch truyền thông ra mắt một sản phẩm mới, từ nghiên cứu đến tổng kết chiến dịch.',
    phases: [
      {
        title: 'Nghiên cứu & định hướng',
        tasks: ['Xác định khách hàng mục tiêu', 'Thống nhất thông điệp chiến dịch'],
      },
      {
        title: 'Chuẩn bị & triển khai',
        tasks: ['Sản xuất nội dung và hình ảnh', 'Lên lịch đăng tải trên các kênh'],
      },
      {
        title: 'Theo dõi & tổng kết',
        tasks: ['Tổng hợp phản hồi và kết quả', 'Đánh giá và đề xuất cải thiện'],
      },
    ],
  },
  {
    name: 'Đồ án tốt nghiệp',
    prompt:
      'Lập kế hoạch thực hiện đồ án phần mềm, bao gồm nghiên cứu, xây dựng ứng dụng và chuẩn bị bảo vệ.',
    phases: [
      {
        title: 'Nghiên cứu & phân tích',
        tasks: ['Khảo sát và xác định phạm vi đề tài', 'Phân tích yêu cầu và thiết kế hệ thống'],
      },
      {
        title: 'Xây dựng & đánh giá',
        tasks: ['Phát triển các chức năng chính', 'Kiểm thử và đánh giá kết quả'],
      },
      {
        title: 'Báo cáo & bảo vệ',
        tasks: ['Hoàn thiện báo cáo và tài liệu', 'Chuẩn bị slide và demo sản phẩm'],
      },
    ],
  },
] as const;

export default function AiPlanPreview() {
  const [selected, setSelected] = useState(0);
  const [shown, setShown] = useState<number | null>(null);
  const example = examples[selected];
  return (
    <div className="tf-ai-demo">
      <div className="tf-ai-demo-top">
        <span className="tf-ai-mark">
          <LandingIcon name="sparkles" />
        </span>
        <strong>Một ý tưởng, một khởi đầu</strong>
        <span className="tf-demo-badge">Minh họa</span>
      </div>
      <div className="tf-ai-demo-body">
        <p className="tf-demo-label">CHỌN MỘT Ý TƯỞNG ĐỂ KHÁM PHÁ</p>
        <div className="tf-example-options" role="group" aria-label="Ý tưởng kế hoạch mẫu">
          {examples.map((item, i) => (
            <button
              key={item.name}
              type="button"
              aria-pressed={selected === i}
              onClick={() => {
                setSelected(i);
                setShown(null);
              }}
            >
              {item.name}
            </button>
          ))}
        </div>
        <div className="tf-prompt">
          <LandingIcon name="message" />
          <p>{example.prompt}</p>
        </div>
        <button
          type="button"
          className="tf-button tf-button-primary tf-demo-submit"
          onClick={() => setShown(selected)}
        >
          <LandingIcon name="sparkles" />
          {shown === selected ? 'Xem lại kế hoạch mẫu' : 'Xem kế hoạch mẫu'}
          <LandingIcon name="arrow" />
        </button>
        <div className="tf-ai-result" aria-live="polite" aria-atomic="true">
          {shown === null ? (
            <div className="tf-ai-placeholder">
              <LandingIcon name="layers" />
              <p>Từ một mô tả, chia thành từng bước.</p>
              <span>Chọn ý tưởng và xem cách một kế hoạch được tổ chức.</span>
            </div>
          ) : (
            <div>
              <div className="tf-result-heading">
                <span>
                  <LandingIcon name="check" />
                  Kế hoạch tham khảo
                </span>
                <small>3 giai đoạn · 6 công việc</small>
              </div>
              {examples[shown].phases.map((phase, i) => (
                <div key={phase.title} className="tf-plan-phase">
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <h3>{phase.title}</h3>
                    {phase.tasks.map((task) => (
                      <p key={task}>
                        <span aria-hidden="true" />
                        {task}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <p className="tf-demo-note">
          Nội dung mẫu có sẵn. Đăng nhập để tạo kế hoạch từ ý tưởng của bạn.
        </p>
      </div>
    </div>
  );
}
