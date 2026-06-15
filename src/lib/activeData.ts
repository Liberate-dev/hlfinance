import type { Bon } from '../store/useStore';

export function isActiveTransaction(tx: Bon): boolean {
  return tx.deleted_at == null;
}

export function activeTransactions(transactions: Bon[]): Bon[] {
  return transactions.filter(isActiveTransaction);
}