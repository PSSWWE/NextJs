import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addVendorTransaction, createJournalEntryForTransaction } from "@/lib/utils";
import { Country } from "country-state-city";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const vendorId = parseInt(id);
    
    if (isNaN(vendorId)) {
      return NextResponse.json(
        { error: "Invalid vendor ID" },
        { status: 400 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limitParam = searchParams.get('limit') || '10';
    const isAllLimit = limitParam === 'all';
    const limit = isAllLimit ? undefined : parseInt(limitParam);
    const search = searchParams.get('search') || '';
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const sortField = searchParams.get('sortField') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const recalcBalances = searchParams.get('recalc') === 'true';

    // Calculate skip for pagination
    const skip = isAllLimit || !limit ? 0 : (page - 1) * limit;

    // Build where clause for filtering
    const whereClause: any = {
      vendorId: vendorId
    };

    // Add search filter
    if (search) {
      // Try to parse as number for price search
      const searchAsNumber = parseFloat(search);
      const isNumericSearch = !isNaN(searchAsNumber);
      
      // Get all country codes that match the search term (by name or code)
      const matchingCountryCodes: string[] = [];
      if (search.trim()) {
        const allCountries = Country.getAllCountries();
        const searchLower = search.toLowerCase().trim();
        allCountries.forEach(country => {
          if (
            country.name.toLowerCase().includes(searchLower) ||
            country.isoCode.toLowerCase().includes(searchLower) ||
            country.name.toLowerCase() === searchLower
          ) {
            matchingCountryCodes.push(country.isoCode);
          }
        });
      }
      
      // Find invoices/shipments matching destination search
      let matchingInvoiceNumbers: string[] = [];
      if (matchingCountryCodes.length > 0 || search.trim()) {
        const invoiceSearchConditions: any = {
          OR: [
            { destination: { contains: search, mode: 'insensitive' } }
          ]
        };
        if (matchingCountryCodes.length > 0) {
          invoiceSearchConditions.OR.push({
            destination: { in: matchingCountryCodes }
          });
        }
        
        const matchingInvoices = await prisma.invoice.findMany({
          where: invoiceSearchConditions,
          select: { invoiceNumber: true }
        });
        matchingInvoiceNumbers = matchingInvoices.map(inv => inv.invoiceNumber);
      }
      
      // Build search conditions
      const searchConditions: any[] = [
        { description: { contains: search, mode: 'insensitive' } },
        { reference: { contains: search, mode: 'insensitive' } }
      ];
      
      // Add amount search (exact match or range)
      if (isNumericSearch) {
        searchConditions.push({
          amount: {
            gte: searchAsNumber * 0.99,
            lte: searchAsNumber * 1.01
          }
        });
      }
      
      // Add invoice number search if we found matching invoices
      if (matchingInvoiceNumbers.length > 0) {
        searchConditions.push({
          invoice: { in: matchingInvoiceNumbers }
        });
      }
      
      whereClause.OR = searchConditions;
    }

    // Note: Date range filtering will be done after calculating voucher dates
    // We don't filter by createdAt here because transactions are displayed by voucher date

    // Validate sort field
    const allowedSortFields = ['createdAt', 'amount', 'type', 'description', 'reference'];
    const validSortField = allowedSortFields.includes(sortField) ? sortField : 'createdAt';
    const validSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

    // Get vendor info
    const vendor = await prisma.vendors.findUnique({
      where: { id: vendorId },
      select: {
        id: true,
        CompanyName: true,
        PersonName: true,
        currentBalance: true,
        creditLimit: true,
        Address: true,
        City: true,
        Country: true
      }
    });

    if (!vendor) {
      return NextResponse.json(
        { error: "Vendor not found" },
        { status: 404 }
      );
    }

    // Lightweight path: just list transactions using existing balances, no full-history recalculation
    if (!recalcBalances) {
      const whereForList: any = { ...whereClause };

      // Apply date range on createdAt (lightweight approximation of voucher-date filtering)
      if (fromDate || toDate) {
        const createdAtFilter: any = {};
        if (fromDate) {
          createdAtFilter.gte = new Date(fromDate);
        }
        if (toDate) {
          createdAtFilter.lte = new Date(toDate);
        }
        whereForList.createdAt = createdAtFilter;
      }

      const [transactions, total] = await Promise.all([
        prisma.vendorTransaction.findMany({
          where: whereForList,
          orderBy: { [validSortField]: validSortOrder },
          ...(isAllLimit || !limit
            ? {}
            : {
                skip,
                take: limit,
              }),
        }),
        prisma.vendorTransaction.count({
          where: whereForList,
        }),
      ]);

      const orderedTransactions = transactions;

      // Batch fetch shipment information and payment dates for paginated transactions
      const paginatedInvoiceNumbers = orderedTransactions
        .filter((t) => t.invoice)
        .map((t) => t.invoice!)
        .filter((inv, index, self) => self.indexOf(inv) === index);

      const paginatedDebitNoteRefs = orderedTransactions
        .filter(
          (t) =>
            t.reference?.startsWith("#DEBIT") ||
            t.reference?.startsWith("#CREDIT")
        )
        .map((t) => t.reference!)
        .filter((ref, index, self) => self.indexOf(ref) === index);

      // Batch fetch invoices with full shipment info
      const paginatedInvoicesMap = new Map<string, any>();
      if (paginatedInvoiceNumbers.length > 0) {
        const paginatedInvoices = await prisma.invoice.findMany({
          where: { invoiceNumber: { in: paginatedInvoiceNumbers } },
          include: {
            shipment: {
              select: {
                trackingId: true,
                weight: true,
                destination: true,
                referenceNumber: true,
                deliveryStatus: true,
                shipmentDate: true,
                recipientName: true,
              },
            },
          },
        });
        paginatedInvoices.forEach((inv) => {
          paginatedInvoicesMap.set(inv.invoiceNumber, inv);
        });
      }

      // Batch fetch debit notes for paginated transactions
      const paginatedDebitNotesMap = new Map<string, Date>();
      if (paginatedDebitNoteRefs.length > 0) {
        const paginatedDebitNotes = await prisma.debitNote.findMany({
          where: { debitNoteNumber: { in: paginatedDebitNoteRefs } },
          select: { debitNoteNumber: true, date: true },
        });
        paginatedDebitNotes.forEach((dn) => {
          if (dn.date) paginatedDebitNotesMap.set(dn.debitNoteNumber, dn.date);
        });
      }

      // Batch fetch payments for CREDIT transactions in paginated results
      const paginatedCreditInvoices = orderedTransactions
        .filter((t) => t.type === "CREDIT" && t.invoice)
        .map((t) => t.invoice!);

      const paginatedPaymentsMap = new Map<string, Date>();
      if (paginatedCreditInvoices.length > 0) {
        const uniquePaginatedInvoices = [...new Set(paginatedCreditInvoices)];
        const paginatedPayments = await prisma.payment.findMany({
          where: {
            invoice: { in: uniquePaginatedInvoices },
            toVendorId: vendorId,
            transactionType: "EXPENSE",
          },
          select: {
            invoice: true,
            date: true,
          },
          orderBy: { date: "desc" },
        });

        // Group by invoice and take the most recent payment for each
        const paymentsByInvoice = new Map<string, Date>();
        paginatedPayments.forEach((p) => {
          if (
            p.date &&
            p.invoice &&
            (!paymentsByInvoice.has(p.invoice) ||
              paymentsByInvoice.get(p.invoice)! < p.date)
          ) {
            paymentsByInvoice.set(p.invoice, p.date);
          }
        });
        paymentsByInvoice.forEach((date, invoice) => {
          paginatedPaymentsMap.set(invoice, date);
        });
      }

      // Map transactions with shipment info using batched data
      const transactionsWithShipmentInfo = orderedTransactions.map(
        (transaction) => {
          let shipmentInfo = null;
          let shipmentDate: string | undefined = undefined;
          let paymentDate: string | undefined = undefined;
          let debitNoteDate: string | undefined = undefined;
          let consigneeName: string | undefined = undefined;

          // Get debit note date from batched data
          if (transaction.reference) {
            const dnDate = paginatedDebitNotesMap.get(transaction.reference);
            if (dnDate) {
              debitNoteDate = dnDate.toISOString();
            }
          }

          if (transaction.invoice) {
            const invoice = paginatedInvoicesMap.get(transaction.invoice);

            if (invoice?.shipment) {
              shipmentInfo = {
                awbNo: invoice.shipment.trackingId,
                weight: invoice.shipment.weight,
                destination: invoice.shipment.destination,
                referenceNo: invoice.shipment.referenceNumber,
                status: invoice.shipment.deliveryStatus || "Sale",
                shipmentDate: invoice.shipment.shipmentDate,
              };

              if (invoice.shipment.shipmentDate) {
                shipmentDate = invoice.shipment.shipmentDate.toISOString();
              }

              if (invoice.shipment.recipientName) {
                consigneeName = invoice.shipment.recipientName;
              }
            }

            // Get payment date from batched data
            if (transaction.type === "CREDIT") {
              const paymentDateObj = paginatedPaymentsMap.get(
                transaction.invoice
              );
              if (paymentDateObj) {
                paymentDate = paymentDateObj.toISOString();
              }
            }
          }

          return {
            ...transaction,
            shipmentInfo,
            shipmentDate,
            paymentDate,
            debitNoteDate,
            consigneeName,
          };
        }
      );

      return NextResponse.json({
        vendor: {
          id: vendor.id,
          CompanyName: vendor.CompanyName,
          PersonName: vendor.PersonName,
          currentBalance: vendor.currentBalance,
          creditLimit: vendor.creditLimit,
          Address: vendor.Address,
          City: vendor.City,
          Country: vendor.Country,
        },
        transactions: transactionsWithShipmentInfo,
        total,
        page,
        limit: isAllLimit || !limit ? total : limit,
        totalPages:
          isAllLimit || !limit
            ? 1
            : Math.ceil(total / (limit || 1)),
      });
    }

    // Heavy path: full-history recalculation, only when explicitly requested
    const allTransactions = await prisma.vendorTransaction.findMany({
      where: { vendorId: vendorId },
      orderBy: { createdAt: 'asc' }, // Sort chronologically by createdAt first
      select: {
        id: true,
        type: true,
        amount: true,
        createdAt: true,
        invoice: true,
        reference: true
      }
    });

    // Batch fetch all related data to avoid N+1 queries
    const debitNoteRefs = allTransactions
      .filter(t => t.reference?.startsWith("#DEBIT") || t.reference?.startsWith("#CREDIT"))
      .map(t => t.reference!)
      .filter((ref, index, self) => self.indexOf(ref) === index); // unique refs
    
    const debitNotesMap = new Map<string, Date>();
    if (debitNoteRefs.length > 0) {
      const debitNotes = await prisma.debitNote.findMany({
        where: { debitNoteNumber: { in: debitNoteRefs } },
        select: { debitNoteNumber: true, date: true }
      });
      debitNotes.forEach(dn => {
        if (dn.date) debitNotesMap.set(dn.debitNoteNumber, dn.date);
      });
    }

    // Batch fetch invoices with shipments
    const invoiceNumbers = allTransactions
      .filter(t => t.invoice)
      .map(t => t.invoice!)
      .filter((inv, index, self) => self.indexOf(inv) === index); // unique invoices
    
    const invoicesMap = new Map<string, { shipmentDate?: Date }>();
    if (invoiceNumbers.length > 0) {
      const invoices = await prisma.invoice.findMany({
        where: { invoiceNumber: { in: invoiceNumbers } },
        include: {
          shipment: {
            select: { shipmentDate: true }
          }
        }
      });
      invoices.forEach(inv => {
        invoicesMap.set(inv.invoiceNumber, {
          shipmentDate: inv.shipment?.shipmentDate || undefined
        });
      });
    }

    // Batch fetch payments for CREDIT transactions
    const creditTransactionsWithInvoices = allTransactions
      .filter(t => t.type === "CREDIT" && t.invoice)
      .map(t => t.invoice!);
    
    const paymentsMap = new Map<string, Date>();
    if (creditTransactionsWithInvoices.length > 0) {
      const uniqueInvoices = [...new Set(creditTransactionsWithInvoices)];
      const payments = await prisma.payment.findMany({
        where: {
          invoice: { in: uniqueInvoices },
          toVendorId: vendorId,
          transactionType: "EXPENSE"
        },
        select: {
          invoice: true,
          date: true
        },
        orderBy: { date: 'desc' }
      });
      
      // Group by invoice and take the most recent payment for each
      const paymentsByInvoice = new Map<string, Date>();
      payments.forEach(p => {
        if (p.date && p.invoice && (!paymentsByInvoice.has(p.invoice) || 
            paymentsByInvoice.get(p.invoice)! < p.date)) {
          paymentsByInvoice.set(p.invoice, p.date);
        }
      });
      paymentsByInvoice.forEach((date, invoice) => {
        paymentsMap.set(invoice, date);
      });
    }

    // Map transactions with voucher dates using batched data
    const transactionsWithVoucherDates = allTransactions.map((transaction) => {
      let voucherDate = transaction.createdAt;
      
      // Check debit note dates
      if (transaction.reference) {
        const debitNoteDate = debitNotesMap.get(transaction.reference);
        if (debitNoteDate) {
          voucherDate = debitNoteDate;
        }
      }

      if (transaction.invoice) {
        const invoiceData = invoicesMap.get(transaction.invoice);
        
        if (transaction.type === "DEBIT" && invoiceData?.shipmentDate) {
          // For DEBIT transactions (vendor invoices), use shipmentDate
          voucherDate = invoiceData.shipmentDate;
        } else if (transaction.type === "CREDIT") {
          // For CREDIT transactions (vendor payments), use payment date
          const paymentDate = paymentsMap.get(transaction.invoice);
          if (paymentDate) {
            voucherDate = paymentDate;
          }
        }
      }
      
      return {
        ...transaction,
        voucherDate
      };
    });

    // Sort by voucher date (not createdAt) for balance calculation
    // For the same date:
    // - CREDIT (payment) before DEBIT (shipment)
    // - Within the same type, order by invoice number ascending so that the
    //   highest invoice ends up last for that date (and therefore gets the
    //   final balance for that date, which the UI then shows at the top).
    transactionsWithVoucherDates.sort((a, b) => {
      const dateDiff = a.voucherDate.getTime() - b.voucherDate.getTime(); // oldest -> newest
      if (dateDiff !== 0) {
        return dateDiff;
      }
      // Same date, different types
      if (a.type === "DEBIT" && b.type === "CREDIT") return 1;
      if (a.type === "CREDIT" && b.type === "DEBIT") return -1;

      // Same date, same type – use invoice number ascending when available
      if (a.invoice && b.invoice) {
        const invA = parseInt(a.invoice, 10);
        const invB = parseInt(b.invoice, 10);
        if (!Number.isNaN(invA) && !Number.isNaN(invB)) {
          return invA - invB; // lowest invoice first, highest last
        }
        return a.invoice.localeCompare(b.invoice);
      }

      return 0;
    });

    // Find starting balance transaction (reference starts with "STARTING-BALANCE")
    const startingBalanceTransaction = transactionsWithVoucherDates.find(
      (t) => t.reference && t.reference.startsWith("STARTING-BALANCE")
    );

    // Calculate initial balance from starting balance transaction
    // For vendors: DEBIT increases balance (we owe them), CREDIT decreases (we pay them)
    // Starting balance transaction sets the initial balance
    let runningBalance = 0;
    if (startingBalanceTransaction) {
      // The starting balance transaction itself represents the initial balance
      // If it's DEBIT, we owe them (positive balance), if CREDIT, they owe us (negative balance)
      runningBalance = startingBalanceTransaction.type === 'DEBIT' 
        ? startingBalanceTransaction.amount 
        : -startingBalanceTransaction.amount;
    }

    // Recalculate balances chronologically based on voucher date
    // Exclude starting balance transaction from the loop since it already sets the initial balance
    const transactionsToUpdate = transactionsWithVoucherDates
      .filter((transaction) => !transaction.reference || !transaction.reference.startsWith("STARTING-BALANCE"))
      .map((transaction) => {
        const previousBalance = runningBalance;
        // For vendors: DEBIT increases balance (we owe them), CREDIT decreases (we pay them)
        const newBalance = transaction.type === 'DEBIT' 
          ? previousBalance + transaction.amount 
          : previousBalance - transaction.amount;
        runningBalance = newBalance;
      
        return {
          id: transaction.id,
          previousBalance,
          newBalance
        };
      });

    // Also update the starting balance transaction with its own balance values
    if (startingBalanceTransaction) {
      const startingBalance = startingBalanceTransaction.type === 'DEBIT' 
        ? startingBalanceTransaction.amount 
        : -startingBalanceTransaction.amount;
      transactionsToUpdate.push({
        id: startingBalanceTransaction.id,
        previousBalance: 0,
        newBalance: startingBalance
      });
    }

    // Update all transactions with recalculated balances
    await Promise.all(
      transactionsToUpdate.map(({ id, previousBalance, newBalance }) =>
        prisma.vendorTransaction.update({
          where: { id },
          data: { previousBalance, newBalance }
        })
      )
    );

    // Update vendor's currentBalance to match the final runningBalance after all transactions
    // Use runningBalance which already has the final calculated balance
    await prisma.vendors.update({
      where: { id: vendorId },
      data: { currentBalance: runningBalance }
    });
    // Update vendor object for response
    vendor.currentBalance = runningBalance;

    // Filter by voucher date if date range is provided
    let filteredTransactions = transactionsWithVoucherDates;
    if (fromDate || toDate) {
      const fromDateObj = fromDate ? new Date(fromDate) : null;
      const toDateObj = toDate ? new Date(toDate) : null;
      
      filteredTransactions = transactionsWithVoucherDates.filter((transaction) => {
        const voucherDate = transaction.voucherDate;
        if (fromDateObj && voucherDate < fromDateObj) {
          return false;
        }
        if (toDateObj && voucherDate > toDateObj) {
          return false;
        }
        return true;
      });
    }

    // Apply search filter if provided
    let matchingTransactionIds: number[] = [];
    if (search) {
      const searchWhereClause: any = {
        vendorId: vendorId
      };
      
      // Try to parse as number for price search
      const searchAsNumber = parseFloat(search);
      const isNumericSearch = !isNaN(searchAsNumber);
      
      // Get all country codes that match the search term (by name or code)
      const matchingCountryCodes: string[] = [];
      if (search.trim()) {
        const allCountries = Country.getAllCountries();
        const searchLower = search.toLowerCase().trim();
        allCountries.forEach(country => {
          if (
            country.name.toLowerCase().includes(searchLower) ||
            country.isoCode.toLowerCase().includes(searchLower) ||
            country.name.toLowerCase() === searchLower
          ) {
            matchingCountryCodes.push(country.isoCode);
          }
        });
      }
      
      // Find invoices/shipments matching destination search
      let matchingInvoiceNumbers: string[] = [];
      if (matchingCountryCodes.length > 0 || search.trim()) {
        const invoiceSearchConditions: any = {
          OR: [
            { destination: { contains: search, mode: 'insensitive' } }
          ]
        };
        if (matchingCountryCodes.length > 0) {
          invoiceSearchConditions.OR.push({
            destination: { in: matchingCountryCodes }
          });
        }
        
        const matchingInvoices = await prisma.invoice.findMany({
          where: invoiceSearchConditions,
          select: { invoiceNumber: true }
        });
        matchingInvoiceNumbers = matchingInvoices.map(inv => inv.invoiceNumber);
      }
      
      // Build search conditions
      const searchConditions: any[] = [
        { description: { contains: search, mode: 'insensitive' } },
        { reference: { contains: search, mode: 'insensitive' } }
      ];
      
      // Add amount search (exact match or range)
      if (isNumericSearch) {
        searchConditions.push({
          amount: {
            gte: searchAsNumber * 0.99,
            lte: searchAsNumber * 1.01
          }
        });
      }
      
      // Add invoice number search if we found matching invoices
      if (matchingInvoiceNumbers.length > 0) {
        searchConditions.push({
          invoice: { in: matchingInvoiceNumbers }
        });
      }
      
      searchWhereClause.OR = searchConditions;
      
      const matchingTransactions = await prisma.vendorTransaction.findMany({
        where: searchWhereClause,
        select: { id: true }
      });
      matchingTransactionIds = matchingTransactions.map(t => t.id);
      
      // Apply search filter to filtered transactions
      filteredTransactions = filteredTransactions.filter(t => matchingTransactionIds.includes(t.id));
    }

    // Get total count after date and search filtering
    const total = filteredTransactions.length;

    // Fetch full transaction data for sorting
    const transactionIds = filteredTransactions.map(t => t.id);
    const fullTransactionsForSorting = await prisma.vendorTransaction.findMany({
      where: { id: { in: transactionIds } },
      orderBy: { [validSortField]: validSortOrder }
    });
    
    // Create a map for quick lookup
    const transactionDataMap = new Map(fullTransactionsForSorting.map(t => [t.id, t]));
    
    // Sort filteredTransactions based on the sort field
    filteredTransactions.sort((a, b) => {
      const transactionA = transactionDataMap.get(a.id);
      const transactionB = transactionDataMap.get(b.id);
      
      if (!transactionA || !transactionB) return 0;
      
      if (validSortField === 'createdAt') {
        // For createdAt, sort by voucher date instead
        const dateDiff = a.voucherDate.getTime() - b.voucherDate.getTime();
        if (dateDiff !== 0) {
          return validSortOrder === 'desc' ? -dateDiff : dateDiff;
        }
        // Same date: DEBIT (shipment/invoice) before CREDIT (payment)
        if (a.type === "DEBIT" && b.type === "CREDIT") return validSortOrder === 'desc' ? 1 : -1;
        if (a.type === "CREDIT" && b.type === "DEBIT") return validSortOrder === 'desc' ? -1 : 1;
        return 0;
      } else {
        // For other fields, use the database sort order
        const aIndex = fullTransactionsForSorting.findIndex(t => t.id === a.id);
        const bIndex = fullTransactionsForSorting.findIndex(t => t.id === b.id);
        return aIndex - bIndex;
      }
    });

    // Apply pagination
    const paginatedTransactionIds = isAllLimit || !limit
      ? filteredTransactions.map(t => t.id)
      : filteredTransactions
          .slice(skip, skip + limit)
          .map(t => t.id);

    // Now get the paginated transactions with updated balances
    // Maintain the order from filteredTransactions
    const transactions = await prisma.vendorTransaction.findMany({
      where: { id: { in: paginatedTransactionIds } },
      include: {
        vendor: {
          select: {
            CompanyName: true,
            PersonName: true
          }
        }
      }
    });
    
    // Sort transactions to match the order from filteredTransactions
    const transactionMap = new Map(transactions.map(t => [t.id, t]));
    const orderedTransactions = paginatedTransactionIds
      .map(id => transactionMap.get(id))
      .filter((t): t is NonNullable<typeof t> => t !== undefined);

    // Batch fetch shipment information and payment dates for paginated transactions
    const paginatedInvoiceNumbers = orderedTransactions
      .filter(t => t.invoice)
      .map(t => t.invoice!)
      .filter((inv, index, self) => self.indexOf(inv) === index);
    
    const paginatedDebitNoteRefs = orderedTransactions
      .filter(t => t.reference?.startsWith("#DEBIT") || t.reference?.startsWith("#CREDIT"))
      .map(t => t.reference!)
      .filter((ref, index, self) => self.indexOf(ref) === index);
    
    // Batch fetch invoices with full shipment info
    const paginatedInvoicesMap = new Map<string, any>();
    if (paginatedInvoiceNumbers.length > 0) {
      const paginatedInvoices = await prisma.invoice.findMany({
        where: { invoiceNumber: { in: paginatedInvoiceNumbers } },
        include: {
          shipment: {
            select: {
              trackingId: true,
              weight: true,
              destination: true,
              referenceNumber: true,
              deliveryStatus: true,
              shipmentDate: true,
              recipientName: true
            }
          }
        }
      });
      paginatedInvoices.forEach(inv => {
        paginatedInvoicesMap.set(inv.invoiceNumber, inv);
      });
    }
    
    // Batch fetch debit notes for paginated transactions
    const paginatedDebitNotesMap = new Map<string, Date>();
    if (paginatedDebitNoteRefs.length > 0) {
      const paginatedDebitNotes = await prisma.debitNote.findMany({
        where: { debitNoteNumber: { in: paginatedDebitNoteRefs } },
        select: { debitNoteNumber: true, date: true }
      });
      paginatedDebitNotes.forEach(dn => {
        if (dn.date) paginatedDebitNotesMap.set(dn.debitNoteNumber, dn.date);
      });
    }
    
    // Batch fetch payments for CREDIT transactions in paginated results
    const paginatedCreditInvoices = orderedTransactions
      .filter(t => t.type === "CREDIT" && t.invoice)
      .map(t => t.invoice!);
    
    const paginatedPaymentsMap = new Map<string, Date>();
    if (paginatedCreditInvoices.length > 0) {
      const uniquePaginatedInvoices = [...new Set(paginatedCreditInvoices)];
      const paginatedPayments = await prisma.payment.findMany({
        where: {
          invoice: { in: uniquePaginatedInvoices },
          toVendorId: vendorId,
          transactionType: "EXPENSE"
        },
        select: {
          invoice: true,
          date: true
        },
        orderBy: { date: 'desc' }
      });
      
      // Group by invoice and take the most recent payment for each
      const paymentsByInvoice = new Map<string, Date>();
      paginatedPayments.forEach(p => {
        if (p.date && p.invoice && (!paymentsByInvoice.has(p.invoice) || 
            paymentsByInvoice.get(p.invoice)! < p.date)) {
          paymentsByInvoice.set(p.invoice, p.date);
        }
      });
      paymentsByInvoice.forEach((date, invoice) => {
        paginatedPaymentsMap.set(invoice, date);
      });
    }
    
    // Map transactions with shipment info using batched data
    const transactionsWithShipmentInfo = orderedTransactions.map((transaction) => {
      let shipmentInfo = null;
      let shipmentDate: string | undefined = undefined;
      let paymentDate: string | undefined = undefined;
      let debitNoteDate: string | undefined = undefined;
        let consigneeName: string | undefined = undefined;
      
      // Get debit note date from batched data
      if (transaction.reference) {
        const dnDate = paginatedDebitNotesMap.get(transaction.reference);
        if (dnDate) {
          debitNoteDate = dnDate.toISOString();
        }
      }
      
      if (transaction.invoice) {
        const invoice = paginatedInvoicesMap.get(transaction.invoice);
        
        if (invoice?.shipment) {
          shipmentInfo = {
            awbNo: invoice.shipment.trackingId,
            weight: invoice.shipment.weight,
            destination: invoice.shipment.destination,
            referenceNo: invoice.shipment.referenceNumber,
            status: invoice.shipment.deliveryStatus || 'Sale',
              shipmentDate: invoice.shipment.shipmentDate
          };
          
          if (invoice.shipment.shipmentDate) {
            shipmentDate = invoice.shipment.shipmentDate.toISOString();
          }

            if (invoice.shipment.recipientName) {
              consigneeName = invoice.shipment.recipientName;
            }
        }
        
        // Get payment date from batched data
        if (transaction.type === "CREDIT") {
          const paymentDateObj = paginatedPaymentsMap.get(transaction.invoice);
          if (paymentDateObj) {
            paymentDate = paymentDateObj.toISOString();
          }
        }
      }
      
      return {
        ...transaction,
        shipmentInfo,
        shipmentDate,
        paymentDate,
          debitNoteDate,
          consigneeName
      };
    });

    return NextResponse.json({
      vendor: {
        id: vendor.id,
        CompanyName: vendor.CompanyName,
        PersonName: vendor.PersonName,
        currentBalance: vendor.currentBalance,
        creditLimit: vendor.creditLimit,
        Address: vendor.Address,
        City: vendor.City,
        Country: vendor.Country
      },
      transactions: transactionsWithShipmentInfo,
      total,
      page,
      limit: isAllLimit || !limit ? total : limit,
      totalPages:
        isAllLimit || !limit
          ? 1
          : Math.ceil(total / (limit || 1))
    });

  } catch (error) {
    console.error("Error fetching vendor transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch vendor transactions" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const vendorId = parseInt(id);
    
    if (isNaN(vendorId)) {
      return NextResponse.json(
        { error: "Invalid vendor ID" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { type, amount, description, reference, date } = body;

    if (!type || !amount || !description) {
      return NextResponse.json(
        { error: "Type, amount, and description are required" },
        { status: 400 }
      );
    }

    if (!['CREDIT', 'DEBIT'].includes(type)) {
      return NextResponse.json(
        { error: "Type must be CREDIT or DEBIT" },
        { status: 400 }
      );
    }

    // Check if this is a starting balance transaction
    const isStartingBalance = reference && reference.startsWith("STARTING-BALANCE");

    if (isStartingBalance) {
      // Find existing starting balance transaction
      const existingStartingBalance = await prisma.vendorTransaction.findFirst({
        where: {
          vendorId: vendorId,
          reference: { startsWith: "STARTING-BALANCE" }
        }
      });

      if (existingStartingBalance) {
        // Use provided date or default to earliest date for starting balance
        const transactionDate = date ? new Date(date) : new Date('1970-01-01');
        
        // Find and delete existing journal entries for this starting balance
        // Use the existing transaction's reference to find matching journal entries
        const existingJournalEntries = await prisma.journalEntry.findMany({
          where: {
            reference: existingStartingBalance.reference 
              ? existingStartingBalance.reference 
              : { startsWith: "STARTING-BALANCE" }
          }
        });
        
        // Delete journal entry lines first, then the journal entries
        for (const entry of existingJournalEntries) {
          await prisma.journalEntryLine.deleteMany({
            where: { journalEntryId: entry.id }
          });
          await prisma.journalEntry.delete({
            where: { id: entry.id }
          });
        }
        
        // Update existing starting balance transaction
        await prisma.vendorTransaction.update({
          where: { id: existingStartingBalance.id },
          data: {
            type: type,
            amount: parseFloat(amount),
            description: description,
            reference: reference,
            createdAt: transactionDate,
            previousBalance: 0,
            newBalance: type === 'DEBIT' ? parseFloat(amount) : -parseFloat(amount)
          }
        });
        
        // Create journal entry with the provided date (skip for CREDIT as it's not needed)
        if (type === 'DEBIT') {
          const transactionType = 'VENDOR_DEBIT';
          await createJournalEntryForTransaction(
            prisma,
            transactionType,
            parseFloat(amount),
            description,
            reference,
            undefined,
            transactionDate
          );
        }

        // Trigger balance recalculation by calling GET endpoint logic
        // We'll need to recalculate all balances
        const allTransactions = await prisma.vendorTransaction.findMany({
          where: { vendorId: vendorId }
        });

        // Recalculate balances (this will be done on next GET request)
        // For now, just return success
        return NextResponse.json({
          success: true,
          message: "Starting balance updated successfully",
          previousBalance: 0,
          newBalance: type === 'DEBIT' ? parseFloat(amount) : -parseFloat(amount)
        });
      }
    }

    const result = await addVendorTransaction(
      prisma,
      vendorId,
      type,
      parseFloat(amount),
      description,
      reference,
      undefined,
      date ? new Date(date) : undefined
    );

    // For starting balance, find the transaction we just created and update it
    if (isStartingBalance) {
      const createdTransaction = await prisma.vendorTransaction.findFirst({
        where: {
          vendorId: vendorId,
          reference: reference
        },
        orderBy: { createdAt: 'desc' }
      });

      if (createdTransaction) {
        // Use provided date or default to earliest date for starting balance
        const transactionDate = date ? new Date(date) : new Date('1970-01-01');
        
        await prisma.vendorTransaction.update({
          where: { id: createdTransaction.id },
          data: {
            createdAt: transactionDate,
            previousBalance: 0,
            newBalance: type === 'DEBIT' ? parseFloat(amount) : -parseFloat(amount)
          }
        });
        
        // Create journal entry for new starting balance (skip for CREDIT as it's not needed)
        if (type === 'DEBIT') {
          const transactionType = 'VENDOR_DEBIT';
          await createJournalEntryForTransaction(
            prisma,
            transactionType,
            parseFloat(amount),
            description,
            reference,
            undefined,
            transactionDate
          );
        }
      }
    }

    // Create journal entry for vendor transaction (skip for starting balance as it's handled above)
    if (!isStartingBalance) {
      const transactionType = type === 'CREDIT' ? 'VENDOR_CREDIT' : 'VENDOR_DEBIT';
      const transactionDate = date ? new Date(date) : undefined;
      await createJournalEntryForTransaction(
        prisma,
        transactionType,
        parseFloat(amount),
        description,
        reference,
        undefined,
        transactionDate
      );
    }

    return NextResponse.json({
      success: true,
      message: "Transaction added successfully",
      previousBalance: result.previousBalance,
      newBalance: result.newBalance
    });

  } catch (error) {
    console.error("Error adding vendor transaction:", error);
    return NextResponse.json(
      { error: "Failed to add transaction" },
      { status: 500 }
    );
  }
}
