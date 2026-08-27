// Bang mau nen on dinh (kieu Trello) - chon theo id nen khong doi qua moi lan render
const PALETTE = [
  '#0079BF',
  '#D29034',
  '#519839',
  '#B04632',
  '#89609E',
  '#CD5A91',
  '#4BBF6B',
  '#00AECC',
  '#838C91',
  '#172B4D',
];

export function colorForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) % PALETTE.length;
  }
  return PALETTE[Math.abs(hash)] ?? PALETTE[0]!;
}

// Lay 1-2 chu cai dau tu ten de hien thi trong o avatar tron
export function initialsOf(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return letters || '?';
}
