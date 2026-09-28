// Bo luat hieu cau hoi - nhanh B0 (CHATBOT_MODULE.md §10.1, §4.1, §8.2).
import { describe, expect, it } from 'vitest';
import { foldText } from '../src/modules/ai/ai.rules';
import {
  CHAT_FOCUSES,
  CHAT_INTENTS,
  CHAT_PERIODS,
  type ChatFocus,
  type ChatIntent,
  type ChatPeriod,
  type ParsedQuestion,
} from '../src/modules/chat/chat.intent';
import { matchMember, type RosterMember } from '../src/modules/chat/chat.members';
import { parseByRules } from '../src/modules/chat/chat.rules';

const ROSTER: RosterMember[] = [
  { userId: 'lan1', name: 'Nguyễn Thị Lan' },
  { userId: 'lan2', name: 'Trần Lan' },
  { userId: 'minh', name: 'Hoàng Minh' },
  { userId: 'binh', name: 'Bình' },
  { userId: 'tanh', name: 'Tuấn Anh' },
];

/** Danh sach nguoi co ten TRUNG voi tu chi thoi gian / tu thuong khi bo dau. */
const TRAPS: RosterMember[] = [
  { userId: 'tuan', name: 'Lê Văn Tuấn' },
  { userId: 'tuanp', name: 'Tuan' }, // ten luu khong dau
  { userId: 'mai', name: 'Phạm Mai' },
  { userId: 'nam', name: 'Đỗ Nam' },
  { userId: 'an', name: 'Võ An' },
  { userId: 'thang', name: 'Trịnh Thắng' },
  { userId: 'minh', name: 'Minh' },
];

function P(
  intent: ChatIntent,
  period: ChatPeriod | null = null,
  focus: ChatFocus | null = null,
  member: string | null = null
): ParsedQuestion {
  return { intent, period, focus, member };
}

describe('parseByRules - cau hoi mau', () => {
  it('bon nhom cau hoi, thao tac va ngoai pham vi', () => {
    const cases: [string, ParsedQuestion][] = [
      // Viec ca nhan
      ['Việc nào của tôi sắp đến hạn?', P('MY_TASKS', 'NEXT_7_DAYS', 'OPEN')],
      ['Tuần sau tôi có việc gì?', P('MY_TASKS', 'NEXT_WEEK')],
      ['Tôi có việc gì quá hạn không?', P('MY_TASKS', null, 'OVERDUE')],
      ['Tuần này tôi xong những gì?', P('MY_TASKS', 'THIS_WEEK', 'DONE')],
      ['Việc chưa xong nào của tôi quá hạn?', P('MY_TASKS', null, 'OVERDUE')],
      ['Thẻ nào của tôi đang bị kẹt?', P('MY_TASKS', null, 'BLOCKED')],
      ['Kết thúc tuần này tôi còn việc gì?', P('MY_TASKS', 'THIS_WEEK')], // "kết thúc" khong phai "kẹt"
      ['ket thuc tuan nay toi con viec gi', P('MY_TASKS', 'THIS_WEEK')], // khong dau: "ket" + "thuc" khong phai "kẹt"
      ['Em có việc gì quá hạn không?', P('MY_TASKS', null, 'OVERDUE')],
      ['Tiến độ của em thế nào?', P('MY_TASKS')], // "em" tu xung -> khong phai tien do nhom
      ['Việc nào được giao cho tôi?', P('MY_TASKS')], // "được giao" khong phai thao tac
      ['mai tôi có việc gì', P('MY_TASKS', 'TOMORROW')],
      ['Việc nào 7 ngày tới của tôi?', P('MY_TASKS', 'NEXT_7_DAYS')],
      ['Có việc nào trễ hạn không?', P('MY_TASKS', null, 'OVERDUE')],
      ['Tiến độ của tôi thế nào?', P('MY_TASKS')],
      ['Việc của anh ấy', P('MY_TASKS')], // "anh ấy" khong phai ten "Tuấn Anh" (gioi han da biet: hieu la viec cua toi)
      ['Hôm nay và tuần sau tôi có việc gì?', P('MY_TASKS', 'TODAY')], // nhieu ky -> ky nhac TRUOC
      ['Tôi chán việc này quá', P('MY_TASKS')], // "chán" go co dau khong phai "chặn"
      // Uu tien
      ['Hôm nay tôi nên xử lý gì trước?', P('MY_PRIORITIES', 'TODAY')],
      ['Tôi nên ưu tiên việc nào?', P('MY_PRIORITIES')],
      ['Lan nên làm gì trước?', P('MEMBER_TASKS', null, null, 'lan')],
      // Mot nguoi
      ['Lan đang làm gì, đã xong những việc nào?', P('MEMBER_TASKS', null, null, 'lan')],
      ['Minh đang làm gì?', P('MEMBER_TASKS', null, 'OPEN', 'minh')],
      ['viec cua Minh qua han', P('MEMBER_TASKS', null, 'OVERDUE', 'minh')],
      ['Bình đã hoàn thành những gì tuần trước?', P('MEMBER_TASKS', 'LAST_WEEK', 'DONE', 'bình')],
      ['Việc của chị Lan', P('MEMBER_TASKS', null, null, 'lan')],
      ['Tuấn Anh có việc gì quá hạn?', P('MEMBER_TASKS', null, 'OVERDUE', 'tuấn anh')],
      ['Nguyễn Thị Lan đang giữ những việc gì?', P('MEMBER_TASKS', null, 'OPEN', 'nguyễn thị lan')],
      ['Lan?', P('MEMBER_TASKS', null, null, 'lan')],
      ['Tuần này Lan thế nào?', P('MEMBER_TASKS', 'THIS_WEEK', null, 'lan')], // chi nho viet hoa giua cau
      ['Việc của Lan trong dự án?', P('MEMBER_TASKS', null, null, 'lan')], // co ca ten lan tu chi nhom -> ten thang
      // Nhom
      ['Tuần này nhóm hoàn thành gì, còn vướng gì?', P('TEAM_SUMMARY', 'THIS_WEEK')], // xong + vuong -> tong quan
      ['Nhóm có việc nào quá hạn?', P('TEAM_SUMMARY', null, 'OVERDUE')],
      ['bảng này có việc nào bị chặn không', P('TEAM_SUMMARY', null, 'BLOCKED')],
      ['Việc nào chưa giao?', P('TEAM_SUMMARY')],
      ['Tiến độ dự án tuần này thế nào?', P('TEAM_SUMMARY', 'THIS_WEEK')],
      ['Tuần trước nhóm xong bao nhiêu việc?', P('TEAM_SUMMARY', 'LAST_WEEK', 'DONE')],
      ['Ai đang có nhiều việc?', P('TEAM_WORKLOAD')],
      ['Mỗi người đang giữ bao nhiêu việc?', P('TEAM_WORKLOAD', null, 'OPEN')],
      ['Ai rảnh nhất tuần này?', P('TEAM_WORKLOAD', 'THIS_WEEK')],
      ['Ai quá tải?', P('TEAM_WORKLOAD')],
      ['khối lượng công việc của mọi người', P('TEAM_WORKLOAD')],
      // Thao tac / ngoai pham vi
      ['Tạo thẻ mới cho Lan', P('UNSUPPORTED')],
      ['Giao việc này cho Minh', P('UNSUPPORTED')],
      ['Xoá các thẻ quá hạn của tôi', P('UNSUPPORTED')],
      ['Đổi hạn thẻ này sang thứ 6', P('UNSUPPORTED')],
      ['doi han the nay', P('UNSUPPORTED')],
      ['Email của Lan là gì?', P('UNSUPPORTED')],
      ['Số điện thoại của Minh?', P('UNSUPPORTED')],
      ['Hồ sơ của Lan', P('UNSUPPORTED')],
      ['xin chào', P('UNSUPPORTED')],
      ['', P('UNSUPPORTED')],
      ['còn gì nữa không?', P('UNSUPPORTED')], // dau hieu noi tiep nhung khong co tham so nao
      // Cau noi tiep (NONE: chat.followup quyet dinh)
      ['còn Minh thì sao?', P('NONE', null, null, 'minh')],
      ['còn tuần sau thì sao?', P('NONE', 'NEXT_WEEK')],
      ['còn tôi?', P('NONE', null, null, 'tôi')],
      ['còn em thì sao?', P('NONE', null, null, 'tôi')],
      ['tuần sau?', P('NONE', 'NEXT_WEEK')],
      ['Vậy còn quá hạn?', P('NONE', null, 'OVERDUE')],
      ['Quá hạn thì sao?', P('NONE', null, 'OVERDUE')], // dau hieu noi tiep o CUOI cau
      ['Thời tiết hôm nay thế nào?', P('NONE', 'TODAY')], // khong co ngu canh truoc -> followup tra UNSUPPORTED
      ['còn việc nào của tôi bị chặn?', P('MY_TASKS', null, 'BLOCKED')], // co tu "việc" -> cau hoi moi
    ];
    for (const [q, expected] of cases) expect(parseByRules(q, ROSTER), q).toEqual(expected);
  });

  it('tu de nham voi ten khi bo dau: tuần/Tuấn, mai/Mai, năm/Nam, an toàn/An, tháng/Thắng, mình/Minh', () => {
    const noMember: [string, ChatIntent, ChatPeriod | null][] = [
      ['Tuần sau tôi có việc gì?', 'MY_TASKS', 'NEXT_WEEK'],
      ['tuan sau toi co viec gi', 'MY_TASKS', 'NEXT_WEEK'],
      ['Việc của tuần sau', 'MY_TASKS', 'NEXT_WEEK'],
      ['Tuần tới nhóm cần làm gì?', 'TEAM_SUMMARY', 'NEXT_WEEK'],
      ['3 tuần nữa tôi có việc gì', 'MY_TASKS', null],
      ['2 tuần có việc gì của tôi', 'MY_TASKS', null], // so dung truoc "tuần"
      ['Đêm mai tôi có việc gì', 'MY_TASKS', 'TOMORROW'], // "đêm mai" khong nam trong cum thoi gian nhung van khong phai Mai
      ['Đêm mai có việc gì không?', 'MY_TASKS', 'TOMORROW'], // co dau hieu "có" ngay sau ma van khong phai Mai
      // Cum thoi gian ngay sau "của": co dau hieu ten nhung van phai loai
      ['viec cua thang nay', 'MY_TASKS', null],
      ['Tiến độ của năm nay', 'TEAM_SUMMARY', null],
      ['Việc của tuần vừa qua', 'MY_TASKS', 'LAST_WEEK'], // "vừa" khong o danh sach tu bo nghia -> nho cum thoi gian da chiem tu
      ['Ngày mai tôi có việc gì?', 'MY_TASKS', 'TOMORROW'],
      ['Sáng mai có việc gì?', 'MY_TASKS', 'TOMORROW'],
      ['ngay mai co viec gi', 'MY_TASKS', 'TOMORROW'],
      ['Năm nay nhóm xong bao nhiêu việc?', 'TEAM_SUMMARY', null],
      ['nam nay nhom xong bao nhieu viec', 'TEAM_SUMMARY', null],
      ['Việc an toàn của tôi', 'MY_TASKS', null],
      ['Tháng này tôi có việc gì?', 'MY_TASKS', null],
      ['thang nay toi co viec gi', 'MY_TASKS', null],
      ['mình có việc gì quá hạn', 'MY_TASKS', null],
      ['viec cua minh qua han', 'MY_TASKS', null], // ca cau khong dau: "minh" = "mình"
    ];
    for (const [q, intent, period] of noMember) {
      const r = parseByRules(q, TRAPS);
      expect(r.member, q).toBeNull();
      expect([r.intent, r.period], q).toEqual([intent, period]);
    }

    const withMember: [string, string, ChatPeriod | null][] = [
      ['Mai đang làm gì?', 'mai', null],
      ['Việc của Tuấn tuần sau', 'tuấn', 'NEXT_WEEK'],
      ['Nam có việc gì quá hạn?', 'nam', null],
      ['An đang làm gì?', 'an', null],
      ['Thắng đang làm gì?', 'thắng', null],
      ['Việc của minh', 'minh', null], // cau co dau ma "minh" khong dau -> la ten
      ['tuan dang lam gi', 'tuan', null], // khop ca "Tuấn" lan "Tuan" -> tang sau hoi lai
    ];
    for (const [q, member, period] of withMember) {
      const r = parseByRules(q, TRAPS);
      expect([r.intent, r.member, r.period], q).toEqual(['MEMBER_TASKS', member, period]);
    }
    // ten luu KHONG dau ("Tuan") co the la Tuấn/Tuân/Tuần... -> khop ca hai cach go, tang sau hoi lai
    expect(matchMember('tuan', TRAPS).kind).toBe('MANY');
    expect(matchMember('tuấn', TRAPS).kind).toBe('MANY');
    expect(matchMember('Lê Văn Tuấn', TRAPS).kind).toBe('ONE');
  });

  it('go khong dau / NFD cho cung ket qua; cat cau dai qua 500 ky tu', () => {
    const questions = [
      'Việc nào của tôi sắp đến hạn?',
      'Hôm nay tôi nên xử lý gì trước?',
      'Lan đang làm gì, đã xong những việc nào?',
      'Tuần này nhóm hoàn thành gì, còn vướng gì?',
      'Ai đang có nhiều việc?',
      'Tuần sau tôi có việc gì?',
      'Tôi có việc gì quá hạn không?',
      'Tuần này tôi xong những gì?',
      'Bình đã hoàn thành những gì tuần trước?',
      'Mỗi người đang giữ bao nhiêu việc?',
      'Nhóm có việc nào quá hạn?',
      'Việc nào chưa giao?',
      'Tôi nên ưu tiên việc nào?',
      'còn Minh thì sao?',
      'còn tuần sau thì sao?',
      'Vậy còn quá hạn?',
      'Tuần trước nhóm xong bao nhiêu việc?',
    ];
    const key = (r: ParsedQuestion) => ({ ...r, member: r.member === null ? null : foldText(r.member) });
    // Bo dau nhung GIU hoa/thuong (nguoi go khong dau van viet hoa ten rieng)
    const plainOf = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
    for (const q of questions) {
      const base = parseByRules(q, ROSTER);
      expect(plainOf(q)).not.toMatch(/[^ -~]/u); // da thuc su khong dau
      expect(key(parseByRules(plainOf(q), ROSTER)), `khong dau: ${q}`).toEqual(key(base));
      expect(parseByRules(q.normalize('NFD'), ROSTER), `NFD: ${q}`).toEqual(base);
    }

    const tail = ' Lan đang làm gì';
    const long = 'x '.repeat(250) + tail; // phan "Lan..." nam sau ky tu thu 500
    expect(long.length).toBeGreaterThan(500);
    expect(parseByRules(long, ROSTER)).toEqual(P('UNSUPPORTED'));
    expect(parseByRules('x '.repeat(200) + tail, ROSTER).intent).toBe('MEMBER_TASKS');
  });

  it('tinh chat tren 3000 cau ngau nhien: khong nem loi, ket qua hop le va tat dinh; du nhanh', () => {
    const vocab = [
      'tôi', 'toi', 'mình', 'minh', 'Minh', 'Lan', 'lan', 'chị', 'anh', 'Tuấn', 'tuần', 'tuan', 'sau', 'này', 'nay',
      'trước', 'tới', 'hôm', 'ngày', 'mai', 'Mai', 'việc', 'viec', 'thẻ', 'hạn', 'quá', 'sắp', 'đến', 'xong', 'chưa',
      'hoàn', 'thành', 'bị', 'chặn', 'kẹt', 'vướng', 'nhóm', 'ai', 'nhiều', 'mọi', 'người', 'bao', 'nhiêu', 'nên',
      'làm', 'gì', 'ưu', 'tiên', 'còn', 'thì', 'sao', 'của', 'đang', 'có', 'không', 'tạo', 'giao', 'được', 'email',
      '7', 'bảy', 'Nguyễn', 'Thị', 'Bình', '?', ',', '!', '😀', '<script>', '...', '  ',
    ];
    let seed = 42;
    const rand = (n: number) => {
      seed = (seed * 48271) % 2147483647;
      return seed % n;
    };
    const intents = new Set<string>(CHAT_INTENTS);
    const periods = new Set<string>(CHAT_PERIODS);
    const focuses = new Set<string>(CHAT_FOCUSES);
    const seen = new Set<string>();
    const t0 = performance.now();
    for (let n = 0; n < 3000; n++) {
      const words = Array.from({ length: 1 + rand(14) }, () => vocab[rand(vocab.length)]);
      const q = words.join(rand(3) === 0 ? '' : ' ');
      const r = parseByRules(q, ROSTER);
      seen.add(r.intent);
      expect(intents.has(r.intent), q).toBe(true);
      expect(r.period === null || periods.has(r.period), q).toBe(true);
      expect(r.focus === null || focuses.has(r.focus), q).toBe(true);
      if (r.intent === 'UNSUPPORTED') expect([r.period, r.focus, r.member], q).toEqual([null, null, null]);
      if (r.intent === 'MEMBER_TASKS') expect(matchMember(r.member ?? '', ROSTER).kind, q).not.toBe('NONE');
      if (['MY_TASKS', 'MY_PRIORITIES', 'TEAM_SUMMARY', 'TEAM_WORKLOAD'].includes(r.intent)) {
        expect(r.member, q).toBeNull();
      }
      if (r.intent === 'NONE') expect(r.period !== null || r.focus !== null || r.member !== null, q).toBe(true);
      expect(parseByRules(q, ROSTER), q).toEqual(r);
    }
    expect((performance.now() - t0) / 3000).toBeLessThan(5);
    expect([...seen].sort()).toEqual([...CHAT_INTENTS].sort()); // bo sinh cham duoc moi nhanh
  });
});
