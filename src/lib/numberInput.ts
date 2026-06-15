const NAVIGATION_KEYS = new Set([
  'Backspace',
  'Delete',
  'Tab',
  'Escape',
  'Enter',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
]);

export function sanitizeToDigits(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function parseNumberInput(raw: string): number {
  const digits = sanitizeToDigits(raw);
  if (!digits) return 0;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : 0;
}

export function formatNumberInput(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '';
  return Math.round(n).toLocaleString('id-ID');
}

export function isAllowedNominalKey(e: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return true;
  if (NAVIGATION_KEYS.has(e.key)) return true;
  return /^\d$/.test(e.key);
}