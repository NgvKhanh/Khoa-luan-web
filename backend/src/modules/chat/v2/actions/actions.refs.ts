// "O tham chieu" cua tung thao tac: mot cho duy nhat noi nhung thao tac nhac toi the / cot / nguoi / nhan (HAM THUAN).
// Provenance, do thi phu thuoc, bo phan giai va dem gioi han deu doc cac o nay tu day de khong ai tu liet ke lai.

import { tokenize } from '../../chat.members';
import { foldWords, stripLeadingGeneric } from './actions.text';
import type { ActionOp, MemberRef, Ref } from './actions.schema';

export type SlotName = 'card' | 'list' | 'toList' | 'member' | 'label';
/** Loai thuc the ma o do tro toi (thuoc tinh cua o, khong phai cua tham chieu). */
export type SlotKind = 'card' | 'list' | 'member' | 'label';

export interface Slot {
  name: SlotName;
  kind: SlotKind;
  /** undefined: o khong bat buoc va nguoi dung khong noi (CREATE_CARD khong noi cot nao). */
  ref: MemberRef | undefined;
}

const cardSlot = (ref: Ref): Slot => ({ name: 'card', kind: 'card', ref });

export function slotsOf(op: ActionOp): Slot[] {
  switch (op.type) {
    case 'CREATE_LIST':
      return [];
    case 'CREATE_CARD':
      return [{ name: 'list', kind: 'list', ref: op.list }];
    case 'RENAME_CARD':
    case 'SET_CARD_DUE':
    case 'SET_CARD_STATUS':
      return [cardSlot(op.card)];
    case 'MOVE_CARD':
      return [cardSlot(op.card), { name: 'toList', kind: 'list', ref: op.toList }];
    case 'ASSIGN_MEMBER':
      return [cardSlot(op.card), { name: 'member', kind: 'member', ref: op.member }];
    case 'ASSIGN_UNASSIGNED':
      return [{ name: 'list', kind: 'list', ref: op.list }];
    case 'ADD_LABEL':
      return [cardSlot(op.card), { name: 'label', kind: 'label', ref: op.label }];
  }
}

/** Ban sao cua `op` voi o `name` thay bang `ref` (khong sua op goc). */
export function withRef(op: ActionOp, name: SlotName, ref: Ref): ActionOp {
  switch (op.type) {
    case 'CREATE_CARD':
      return name === 'list' ? { ...op, list: ref } : op;
    case 'RENAME_CARD':
    case 'SET_CARD_DUE':
    case 'SET_CARD_STATUS':
      return name === 'card' ? { ...op, card: ref } : op;
    case 'MOVE_CARD':
      return name === 'card' ? { ...op, card: ref } : name === 'toList' ? { ...op, toList: ref } : op;
    case 'ASSIGN_MEMBER':
      return name === 'card' ? { ...op, card: ref } : name === 'member' ? { ...op, member: ref } : op;
    case 'ADD_LABEL':
      return name === 'card' ? { ...op, card: ref } : name === 'label' ? { ...op, label: ref } : op;
    case 'ASSIGN_UNASSIGNED':
      return name === 'list' ? { ...op, list: ref } : op;
    default:
      return op;
  }
}

/** Chu da bo dau + bo tu chung dau chuoi ("task Login" va "login" cung mot khoa). */
export function foldedName(text: string): string {
  return foldWords(stripLeadingGeneric(text)).join(' ');
}

/**
 * Chu cua mot tham chieu de lam khoa tim kiem: thuong hoa nhung GIU DAU ("Nam" va "Năm" la hai ten khac nhau). Bo phan giai chi coi hai
 * tham chieu la mot khi chung giong het nhau tung tu, nen khong bao gio dung ket qua tim "Nam" cho "Năm".
 */
function signatureName(text: string): string {
  return tokenize(stripLeadingGeneric(text))
    .map((tk) => tk.orig)
    .join(' ');
}

/**
 * Dau van tay cua mot tham chieu DEN MOT THUC THE CO SAN. Hai tham chieu cung dau van tay phai ra cung mot thuc the, nen bo phan
 * giai chi tim mot lan ("Giao Login cho Nam va Register cho Nam": Nam tim mot lan) va mot lan nguoi dung bam chon ap dung cho
 * moi cho nhac cung chu. null = khong phai thuc the co san (PLAN: do chinh ke hoach tao; SELF: la nguoi hoi).
 */
export function refSignature(kind: SlotKind, ref: MemberRef | undefined): string | null {
  if (ref === undefined) return `${kind}:none`;
  switch (ref.by) {
    case 'TEXT':
      return `${kind}:t:${signatureName(ref.text)}`;
    case 'CONTEXT':
      return `${kind}:c:${ref.slot}`;
    case 'SELF':
      return 'member:self';
    case 'PLAN':
    case 'BEST':
      // PLAN: do chinh ke hoach tao; BEST: do may chon theo TUNG the (khong the dung chung ket qua tim kiem giua cac thao tac)
      return null;
  }
}

/** Cac dau van tay KHAC NHAU cua cac thuc the co san ma de xuat nhac toi (de dem so doi tuong tham chieu). */
export function referencedSignatures(ops: readonly ActionOp[]): Set<string> {
  const out = new Set<string>();
  for (const op of ops) {
    for (const slot of slotsOf(op)) {
      if (slot.ref === undefined) continue; // "khong noi cot" khong phai la tham chieu
      const sig = refSignature(slot.kind, slot.ref);
      if (sig !== null && sig !== 'member:self') out.add(sig);
    }
  }
  return out;
}
