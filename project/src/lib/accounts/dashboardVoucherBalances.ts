import type { PrismaClient } from "@prisma/client";

type LedgerTxn = {
  type: string;
  amount: number;
  createdAt: Date;
  invoice: string | null;
  reference: string | null;
};

type WithVoucher = LedgerTxn & { voucherDate: Date };

function isStartingBalance(t: LedgerTxn): boolean {
  return !!t.reference?.startsWith("STARTING-BALANCE");
}

function compareCustomerVoucherOrder(a: WithVoucher, b: WithVoucher): number {
  const dateDiff = a.voucherDate.getTime() - b.voucherDate.getTime();
  if (dateDiff !== 0) return dateDiff;
  if (a.type === "DEBIT" && b.type === "CREDIT") return -1;
  if (a.type === "CREDIT" && b.type === "DEBIT") return 1;
  if (a.invoice && b.invoice) {
    const invA = parseInt(a.invoice, 10);
    const invB = parseInt(b.invoice, 10);
    if (!Number.isNaN(invA) && !Number.isNaN(invB)) return invA - invB;
    return a.invoice.localeCompare(b.invoice);
  }
  return 0;
}

function compareVendorVoucherOrder(a: WithVoucher, b: WithVoucher): number {
  const dateDiff = a.voucherDate.getTime() - b.voucherDate.getTime();
  if (dateDiff !== 0) return dateDiff;
  if (a.type === "DEBIT" && b.type === "CREDIT") return 1;
  if (a.type === "CREDIT" && b.type === "DEBIT") return -1;
  if (a.invoice && b.invoice) {
    const invA = parseInt(a.invoice, 10);
    const invB = parseInt(b.invoice, 10);
    if (!Number.isNaN(invA) && !Number.isNaN(invB)) return invA - invB;
    return a.invoice.localeCompare(b.invoice);
  }
  return 0;
}

function customerVoucherDate(
  t: LedgerTxn,
  creditNotesMap: Map<string, Date>,
  invoicesMap: Map<string, { shipmentDate?: Date }>,
  paymentsByReference: Map<string, Date>,
  paymentsByInvoice: Map<string, Date>,
  customerId: number
): Date {
  let voucherDate = t.createdAt;
  if (t.reference) {
    const creditNoteDate = creditNotesMap.get(t.reference);
    if (creditNoteDate) voucherDate = creditNoteDate;
  }
  if (t.invoice) {
    const invoiceData = invoicesMap.get(t.invoice);
    if (t.type === "DEBIT" && invoiceData?.shipmentDate) {
      voucherDate = invoiceData.shipmentDate;
    } else if (t.type === "CREDIT") {
      const paymentDate =
        (t.reference
          ? paymentsByReference.get(`${customerId}:${t.reference}`)
          : undefined) ||
        (t.invoice
          ? paymentsByInvoice.get(`${customerId}:${t.invoice}`)
          : undefined);
      if (paymentDate) voucherDate = paymentDate;
    }
  }
  return voucherDate;
}

function vendorVoucherDate(
  t: LedgerTxn,
  debitNotesMap: Map<string, Date>,
  invoicesMap: Map<string, { shipmentDate?: Date }>,
  paymentsByReference: Map<string, Date>,
  paymentsByInvoice: Map<string, Date>,
  vendorId: number
): Date {
  let voucherDate = t.createdAt;
  if (t.reference) {
    const debitNoteDate = debitNotesMap.get(t.reference);
    if (debitNoteDate) voucherDate = debitNoteDate;
  }
  if (t.invoice) {
    const invoiceData = invoicesMap.get(t.invoice);
    if (t.type === "DEBIT" && invoiceData?.shipmentDate) {
      voucherDate = invoiceData.shipmentDate;
    } else if (t.type === "CREDIT") {
      const paymentDate =
        (t.reference
          ? paymentsByReference.get(`${vendorId}:${t.reference}`)
          : undefined) ||
        (t.invoice
          ? paymentsByInvoice.get(`${vendorId}:${t.invoice}`)
          : undefined);
      if (paymentDate) voucherDate = paymentDate;
    }
  }
  return voucherDate;
}

function customerNetAsOf(sorted: WithVoucher[], endExclusive: Date): number {
  const S = sorted.find((t) => isStartingBalance(t));
  let running = 0;
  if (S) {
    running = S.type === "DEBIT" ? -S.amount : S.amount;
  }
  for (const t of sorted) {
    if (isStartingBalance(t)) continue;
    if (t.voucherDate >= endExclusive) continue;
    running =
      t.type === "CREDIT" ? running + t.amount : running - t.amount;
  }
  return running;
}

function vendorNetAsOf(sorted: WithVoucher[], endExclusive: Date): number {
  const S = sorted.find((t) => isStartingBalance(t));
  let running = 0;
  if (S) {
    running = S.type === "DEBIT" ? S.amount : -S.amount;
  }
  for (const t of sorted) {
    if (isStartingBalance(t)) continue;
    if (t.voucherDate >= endExclusive) continue;
    running =
      t.type === "DEBIT" ? running + t.amount : running - t.amount;
  }
  return running;
}

async function buildInvoicesShipmentMap(
  prisma: PrismaClient,
  invoiceNumbers: string[]
): Promise<Map<string, { shipmentDate?: Date }>> {
  const map = new Map<string, { shipmentDate?: Date }>();
  if (invoiceNumbers.length === 0) return map;
  const invoices = await prisma.invoice.findMany({
    where: { invoiceNumber: { in: invoiceNumbers } },
    include: {
      shipment: { select: { shipmentDate: true } },
    },
  });
  for (const inv of invoices) {
    map.set(inv.invoiceNumber, {
      shipmentDate: inv.shipment?.shipmentDate ?? undefined,
    });
  }
  return map;
}

/**
 * Month-end AR/AP style nets using the same voucher-date rules as
 * `/api/accounts/transactions/customer/[id]` and `vendor/[id]` (recalc path).
 * Loads ledger rows once; higher DB egress than raw SQL but matches the books.
 */
export async function computeMonthlyPartyNetsUsingVoucherDates(
  prisma: PrismaClient,
  endExclusiveDates: Date[]
): Promise<Array<{ customerNet: number; vendorNet: number }>> {
  const [allCustomerTx, allVendorTx] = await Promise.all([
    prisma.customerTransaction.findMany({
      select: {
        customerId: true,
        type: true,
        amount: true,
        createdAt: true,
        invoice: true,
        reference: true,
      },
    }),
    prisma.vendorTransaction.findMany({
      select: {
        vendorId: true,
        type: true,
        amount: true,
        createdAt: true,
        invoice: true,
        reference: true,
      },
    }),
  ]);

  const creditNoteRefs = allCustomerTx
    .filter(
      (t) =>
        t.reference?.startsWith("#CREDIT") || t.reference?.startsWith("#DEBIT")
    )
    .map((t) => t.reference!)
    .filter((ref, i, self) => self.indexOf(ref) === i);

  const debitNoteRefs = allVendorTx
    .filter(
      (t) =>
        t.reference?.startsWith("#DEBIT") || t.reference?.startsWith("#CREDIT")
    )
    .map((t) => t.reference!)
    .filter((ref, i, self) => self.indexOf(ref) === i);

  const customerInvoiceNums = allCustomerTx
    .filter((t) => t.invoice)
    .map((t) => t.invoice!)
    .filter((inv, i, self) => self.indexOf(inv) === i);
  const vendorInvoiceNums = allVendorTx
    .filter((t) => t.invoice)
    .map((t) => t.invoice!)
    .filter((inv, i, self) => self.indexOf(inv) === i);
  const allInvoiceNums = [
    ...new Set([...customerInvoiceNums, ...vendorInvoiceNums]),
  ];

  const creditNotesMap = new Map<string, Date>();
  const debitNotesMap = new Map<string, Date>();

  const [invoicesMap, creditNotes, debitNotes] = await Promise.all([
    buildInvoicesShipmentMap(prisma, allInvoiceNums),
    creditNoteRefs.length > 0
      ? prisma.creditNote.findMany({
          where: { creditNoteNumber: { in: creditNoteRefs } },
          select: { creditNoteNumber: true, date: true },
        })
      : Promise.resolve([]),
    debitNoteRefs.length > 0
      ? prisma.debitNote.findMany({
          where: { debitNoteNumber: { in: debitNoteRefs } },
          select: { debitNoteNumber: true, date: true },
        })
      : Promise.resolve([]),
  ]);

  for (const cn of creditNotes) {
    if (cn.date) creditNotesMap.set(cn.creditNoteNumber, cn.date);
  }
  for (const dn of debitNotes) {
    if (dn.date) debitNotesMap.set(dn.debitNoteNumber, dn.date);
  }

  const customerCreditRefs = new Set<string>();
  const customerCreditInvs = new Set<string>();
  for (const t of allCustomerTx) {
    if (t.type !== "CREDIT") continue;
    if (t.reference) customerCreditRefs.add(t.reference);
    if (t.invoice) customerCreditInvs.add(t.invoice);
  }
  const vendorCreditRefs = new Set<string>();
  const vendorCreditInvs = new Set<string>();
  for (const t of allVendorTx) {
    if (t.type !== "CREDIT") continue;
    if (t.reference) vendorCreditRefs.add(t.reference);
    if (t.invoice) vendorCreditInvs.add(t.invoice);
  }

  const customerIds = [
    ...new Set(allCustomerTx.map((t) => t.customerId)),
  ] as number[];
  const vendorIds = [...new Set(allVendorTx.map((t) => t.vendorId))] as number[];

  const customerPaymentByRef = new Map<string, Date>();
  const customerPaymentByInv = new Map<string, Date>();
  const vendorPaymentByRef = new Map<string, Date>();
  const vendorPaymentByInv = new Map<string, Date>();

  const customerPayOr: object[] = [];
  if (customerCreditRefs.size > 0) {
    customerPayOr.push({
      reference: { in: [...customerCreditRefs] },
    });
  }
  if (customerCreditInvs.size > 0) {
    customerPayOr.push({ invoice: { in: [...customerCreditInvs] } });
  }

  const vendorPayOr: object[] = [];
  if (vendorCreditRefs.size > 0) {
    vendorPayOr.push({
      reference: { in: [...vendorCreditRefs] },
    });
  }
  if (vendorCreditInvs.size > 0) {
    vendorPayOr.push({ invoice: { in: [...vendorCreditInvs] } });
  }

  const [customerPayments, vendorPayments] = await Promise.all([
    customerIds.length > 0 && customerPayOr.length > 0
      ? prisma.payment.findMany({
          where: {
            transactionType: "INCOME",
            fromCustomerId: { in: customerIds },
            OR: customerPayOr,
          },
          select: {
            fromCustomerId: true,
            reference: true,
            invoice: true,
            date: true,
          },
          orderBy: { date: "desc" },
        })
      : Promise.resolve([]),
    vendorIds.length > 0 && vendorPayOr.length > 0
      ? prisma.payment.findMany({
          where: {
            transactionType: "EXPENSE",
            toVendorId: { in: vendorIds },
            OR: vendorPayOr,
          },
          select: {
            toVendorId: true,
            reference: true,
            invoice: true,
            date: true,
          },
          orderBy: { date: "desc" },
        })
      : Promise.resolve([]),
  ]);

  for (const p of customerPayments) {
    if (!p.fromCustomerId || !p.date) continue;
    const cid = p.fromCustomerId;
    if (p.reference && !customerPaymentByRef.has(`${cid}:${p.reference}`)) {
      customerPaymentByRef.set(`${cid}:${p.reference}`, p.date);
    }
    if (p.invoice && !customerPaymentByInv.has(`${cid}:${p.invoice}`)) {
      customerPaymentByInv.set(`${cid}:${p.invoice}`, p.date);
    }
  }
  for (const p of vendorPayments) {
    if (!p.toVendorId || !p.date) continue;
    const vid = p.toVendorId;
    if (p.reference && !vendorPaymentByRef.has(`${vid}:${p.reference}`)) {
      vendorPaymentByRef.set(`${vid}:${p.reference}`, p.date);
    }
    if (p.invoice && !vendorPaymentByInv.has(`${vid}:${p.invoice}`)) {
      vendorPaymentByInv.set(`${vid}:${p.invoice}`, p.date);
    }
  }

  const customerByParty = new Map<number, LedgerTxn[]>();
  for (const row of allCustomerTx) {
    const list = customerByParty.get(row.customerId) ?? [];
    list.push({
      type: row.type,
      amount: row.amount,
      createdAt: row.createdAt,
      invoice: row.invoice,
      reference: row.reference,
    });
    customerByParty.set(row.customerId, list);
  }

  const vendorByParty = new Map<number, LedgerTxn[]>();
  for (const row of allVendorTx) {
    const list = vendorByParty.get(row.vendorId) ?? [];
    list.push({
      type: row.type,
      amount: row.amount,
      createdAt: row.createdAt,
      invoice: row.invoice,
      reference: row.reference,
    });
    vendorByParty.set(row.vendorId, list);
  }

  const customerSorted = new Map<number, WithVoucher[]>();
  for (const [customerId, txns] of customerByParty) {
    const withV = txns.map((t) => ({
      ...t,
      voucherDate: customerVoucherDate(
        t,
        creditNotesMap,
        invoicesMap,
        customerPaymentByRef,
        customerPaymentByInv,
        customerId
      ),
    }));
    withV.sort(compareCustomerVoucherOrder);
    customerSorted.set(customerId, withV);
  }

  const vendorSorted = new Map<number, WithVoucher[]>();
  for (const [vendorId, txns] of vendorByParty) {
    const withV = txns.map((t) => ({
      ...t,
      voucherDate: vendorVoucherDate(
        t,
        debitNotesMap,
        invoicesMap,
        vendorPaymentByRef,
        vendorPaymentByInv,
        vendorId
      ),
    }));
    withV.sort(compareVendorVoucherOrder);
    vendorSorted.set(vendorId, withV);
  }

  const results = endExclusiveDates.map(() => ({
    customerNet: 0,
    vendorNet: 0,
  }));

  for (let m = 0; m < endExclusiveDates.length; m++) {
    const endExclusive = endExclusiveDates[m];
    let customerSum = 0;
    for (const sorted of customerSorted.values()) {
      customerSum += customerNetAsOf(sorted, endExclusive);
    }
    let vendorSum = 0;
    for (const sorted of vendorSorted.values()) {
      vendorSum += vendorNetAsOf(sorted, endExclusive);
    }
    results[m].customerNet = customerSum;
    results[m].vendorNet = vendorSum;
  }

  return results;
}
