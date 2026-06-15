interface CustomerKodeRow {
  kode: string;
  deleted_at: string | null;
}

/** Generate next code like HL-C06 following existing HL-C## pattern. */
export function generateCustomerKode(customers: CustomerKodeRow[]): string {
  const prefix = 'HL-C';
  const nums = customers
    .filter((c) => c.deleted_at === null)
    .map((c) => {
      const match = c.kode.match(/^HL-C(\d+)$/i);
      return match ? parseInt(match[1], 10) : NaN;
    })
    .filter((n) => !isNaN(n));

  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `${prefix}${String(next).padStart(2, '0')}`;
}