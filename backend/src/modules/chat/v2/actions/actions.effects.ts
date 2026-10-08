// HIEU UNG PHU cua mot ke hoach - gom trong BO NHO, CHI phat SAU KHI transaction COMMIT (CHATBOT_V2_ACTIONS_PLAN.md, Phase 2).
//
// Trong transaction chi co viec ghi CSDL (du lieu + Activity). Thong bao, tu dong hoa va su kien socket la hieu ung ra ngoai: neu
// transaction rollback thi KHONG thong bao ai, khong phat gi - nguoi dung khong bao gio thay "thẻ đã chuyển" cho mot thao tac khong xay ra.
// Day la outbox trong bo nho (khong luu bang): neu tien trinh chet dung giua COMMIT va luc phat thi mat thong bao / socket, nhung du lieu
// va Activity (da nam trong transaction) van day du. Cac service ghi tay hien tai cung phat thong bao theo kieu "ban roi quen" nen
// do tin cay tuong duong.

import { emitToBoard } from '../../../../realtime/socket';
import { runAutomationsForCard } from '../../../automation/automation.service';
import { cardMemberIds, notify, type NotificationType } from '../../../notification/notification.service';

/** Ai nhan thong bao: nhung nguoi dang la thanh vien / theo doi the LUC PHAT (tru `exclude`), hoac danh sach cu the. */
export type NotifyTarget = { kind: 'MEMBERS'; cardId: string; exclude: readonly string[] } | { kind: 'USERS'; ids: readonly string[] };

export interface NotificationJob {
  type: NotificationType;
  actorId: string;
  boardId: string;
  cardId: string;
  data: Record<string, unknown>;
  to: NotifyTarget;
}

export interface AutomationJob {
  trigger: 'CARD_CREATED' | 'CARD_MOVED_TO_LIST';
  cardId: string;
  cardTitle: string;
  boardId: string;
  listId: string;
}

/** Mot dong Activity DA duoc ghi trong transaction (chi de bao cao). */
export interface ActivityRecord {
  type: string;
  cardId: string | null;
}

export interface Effects {
  activities: ActivityRecord[];
  notifications: NotificationJob[];
  automations: AutomationJob[];
  /** Bang can bao realtime: MOT su kien moi bang cho ca ke hoach (thao tac tay phat nhieu su kien). */
  boardIds: Set<string>;
}

export const newEffects = (): Effects => ({ activities: [], notifications: [], automations: [], boardIds: new Set() });

export interface DispatchReport {
  notifications: number;
  automations: number;
  sockets: number;
  failed: number;
}

/**
 * Phat hieu ung SAU COMMIT, dung thu tu thao tac. Moi hieu ung la "co gang het suc": mot hieu ung loi chi duoc ghi log, khong lam hong
 * ket qua (du lieu da commit). Thong bao truoc, tu dong hoa sau, socket cuoi cung (de client tai lai dung MOT lan sau khi moi thu xong).
 */
export async function dispatchEffects(effects: Effects): Promise<DispatchReport> {
  const report: DispatchReport = { notifications: 0, automations: 0, sockets: 0, failed: 0 };
  for (const job of effects.notifications) {
    try {
      const to = job.to;
      const recipients = to.kind === 'USERS' ? [...to.ids] : (await cardMemberIds(to.cardId)).filter((id) => !to.exclude.includes(id));
      await notify({ recipients, actorId: job.actorId, type: job.type, boardId: job.boardId, cardId: job.cardId, data: job.data });
      report.notifications += 1;
    } catch (e) {
      report.failed += 1;
      console.error('[chat-actions] gui thong bao that bai:', e);
    }
  }
  for (const job of effects.automations) {
    try {
      await runAutomationsForCard(job.trigger, job.cardId, job.cardTitle, job.boardId, job.listId);
      report.automations += 1;
    } catch (e) {
      report.failed += 1;
      console.error('[chat-actions] chay tu dong hoa that bai:', e);
    }
  }
  for (const boardId of effects.boardIds) {
    try {
      emitToBoard(boardId, 'board:lists-changed');
      report.sockets += 1;
    } catch (e) {
      report.failed += 1;
      console.error('[chat-actions] phat socket that bai:', e);
    }
  }
  return report;
}
