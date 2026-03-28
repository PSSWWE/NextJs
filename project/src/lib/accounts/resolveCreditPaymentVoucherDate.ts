/** Max difference (currency) to treat ledger line and Payment as the same amount. */
const AMOUNT_EPS = 0.02;

export type PaymentRowForVoucherDate = {
  id: number;
  date: Date;
  amount: number;
  invoice: string | null;
  reference: string | null;
};

export type LedgerCreditForPaymentMatch = {
  amount: number;
  invoice: string | null;
  reference: string | null;
  createdAt: Date;
};

/**
 * References reused for many payments (e.g. "00000") must not map every line to one Payment.date.
 * Uses Payment.date from the row entered in Payments — matched by invoice + amount, strong reference,
 * or disambiguation vs ledger createdAt — not reference alone when the reference is a placeholder.
 */
export function isWeakPaymentReference(
  ref: string | null | undefined
): boolean {
  if (ref == null) return true;
  const s = String(ref).trim();
  if (s.length === 0) return true;
  if (/^0+$/.test(s)) return true;
  return false;
}

function amountsClose(a: number, b: number): boolean {
  return Math.abs(Number(a) - Number(b)) <= AMOUNT_EPS;
}

function closestPaymentDate(
  rows: PaymentRowForVoucherDate[],
  anchor: Date
): Date {
  const t0 = anchor.getTime();
  let best = rows[0];
  let bestDiff = Math.abs(rows[0].date.getTime() - t0);
  for (let i = 1; i < rows.length; i++) {
    const d = Math.abs(rows[i].date.getTime() - t0);
    if (d < bestDiff) {
      bestDiff = d;
      best = rows[i];
    }
  }
  return best.date;
}

/**
 * Resolve voucher date for a customer CREDIT (INCOME payment) or vendor CREDIT (EXPENSE payment)
 * ledger line. `payments` must already be scoped to that party (same customer or vendor).
 */
export function resolveCreditPaymentVoucherDate(
  ledger: LedgerCreditForPaymentMatch,
  payments: PaymentRowForVoucherDate[]
): Date | undefined {
  if (payments.length === 0) return undefined;

  // 1) Invoice + amount (handles shared placeholder reference across invoices)
  if (ledger.invoice) {
    const m = payments.filter(
      (p) =>
        p.invoice === ledger.invoice && amountsClose(p.amount, ledger.amount)
    );
    if (m.length === 1) return m[0].date;
    if (m.length > 1) return closestPaymentDate(m, ledger.createdAt);
  }

  // 2) Strong reference + amount
  if (!isWeakPaymentReference(ledger.reference)) {
    const m = payments.filter(
      (p) =>
        p.reference === ledger.reference && amountsClose(p.amount, ledger.amount)
    );
    if (m.length === 1) return m[0].date;
    if (m.length > 1) return closestPaymentDate(m, ledger.createdAt);

    const byRef = payments.filter((p) => p.reference === ledger.reference);
    if (byRef.length === 1) return byRef[0].date;
  }

  // 3) Strong reference + invoice + amount (tighter than ref-only)
  if (ledger.invoice && !isWeakPaymentReference(ledger.reference)) {
    const m = payments.filter(
      (p) =>
        p.invoice === ledger.invoice &&
        p.reference === ledger.reference &&
        amountsClose(p.amount, ledger.amount)
    );
    if (m.length === 1) return m[0].date;
    if (m.length > 1) return closestPaymentDate(m, ledger.createdAt);
  }

  // 4) Exactly one payment on this invoice (legacy behaviour when unambiguous)
  if (ledger.invoice) {
    const byInv = payments.filter((p) => p.invoice === ledger.invoice);
    if (byInv.length === 1) return byInv[0].date;
  }

  // 5) Weak / missing reference: amount match among fetched payments, disambiguate by time
  const byAmt = payments.filter((p) => amountsClose(p.amount, ledger.amount));
  if (byAmt.length === 1) return byAmt[0].date;
  if (byAmt.length > 1) return closestPaymentDate(byAmt, ledger.createdAt);

  return undefined;
}
