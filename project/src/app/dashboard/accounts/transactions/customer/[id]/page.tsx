"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowLeft, Search, Calendar, ArrowUp, ArrowDown, ArrowUpDown, Printer, FileText, Table } from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import {
  format,
  parseISO,
} from "date-fns";



type Customer = {
  id: number;
  CompanyName: string;
  PersonName: string;
  currentBalance: number;
  creditLimit: number;
  Address?: string;
  City?: string;
  Country?: string;
};

type Transaction = {
  id: number;
  type: string;
  amount: number;
  description: string;
  reference?: string;
  invoice?: string;
  previousBalance: number;
  newBalance: number;
  createdAt: string;
  shipmentDate?: string;
  paymentDate?: string;
  creditNoteDate?: string;
};

export default function CustomerTransactionsPage() {
  const router = useRouter();
  const params = useParams();
  const customerId = params.id as string;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState<number | 'all'>(10); // Page size state
  const [periodType, setPeriodType] = useState<'month' | 'last3month' | 'last6month' | 'year' | 'financialyear' | 'custom'>('month');
  const [dateRange, setDateRange] = useState<{ from: Date; to?: Date } | undefined>(() => {
    const now = new Date();
    const firstDayOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );
    const tomorrow = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1
    );
    return { from: firstDayOfMonth, to: tomorrow };
  });
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [loadTime, setLoadTime] = useState<number | null>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const isInitialMount = useRef(true);
  const isTypingDate = useRef(false);

  // Sorting states
  type SortField = "voucherDate" | "amount" | "type" | "description" | "reference";
  type SortOrder = "asc" | "desc";
  const [sortField, setSortField] = useState<SortField>("voucherDate");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  
  // Sort transactions by voucherDate based on the logic
  // The API now calculates balances based on voucher date, so we just need to sort for display
  const sortedTransactions = useMemo(() => {
    if (sortField === "voucherDate") {
      // Sort by voucher date (using the same logic as display)
      return [...transactions].sort((a, b) => {
        const getVoucherDate = (t: Transaction) => {
          // Check if this is a credit/debit note transaction
          const isCreditDebitNote = t.reference?.startsWith("#CREDIT") || t.reference?.startsWith("#DEBIT");
          if (isCreditDebitNote && t.creditNoteDate) {
            return t.creditNoteDate;
          }
          
          const isShipmentTransaction = t.type === "DEBIT" && t.invoice;
          const isPaymentTransaction = t.type === "CREDIT" && t.invoice;
          if (isShipmentTransaction) {
            return t.shipmentDate || t.createdAt;
          }
          if (isPaymentTransaction) {
            return t.paymentDate || t.createdAt;
          }
          return t.createdAt;
        };
        const dateA = new Date(getVoucherDate(a)).getTime();
        const dateB = new Date(getVoucherDate(b)).getTime();
        const dateDiff = sortOrder === "desc" ? dateB - dateA : dateA - dateB;
        
        // Same voucher date
        if (dateDiff === 0) {
          // 1) CREDIT (payment) rows should appear above DEBIT (shipment) rows
          if (a.type === "DEBIT" && b.type === "CREDIT") return 1;
          if (a.type === "CREDIT" && b.type === "DEBIT") return -1;

          // 2) If same type, order by balance so that within the same date
          //    the balances progress in the same direction as shown in the UI.
          if (sortOrder === "desc") {
            // For descending date view, show the lowest balance first on that date
            // so reading top → bottom gives a natural progression.
            return b.newBalance - a.newBalance;
          } else {
            return a.newBalance - b.newBalance;
          }
        }
        
        return dateDiff;
      });
    }
    // For other fields, use backend sorting (already sorted)
    return transactions;
  }, [transactions, sortField, sortOrder]);

  const totalPages = pageSize === 'all' ? 1 : Math.ceil(total / pageSize);

  const fetchCustomerData = async (options?: { recalc?: boolean }) => {
    // Don't fetch if custom period is selected but dates are not provided
    if (periodType === 'custom' && (!customStartDate || !customEndDate || 
        customStartDate.length !== 10 || customEndDate.length !== 10)) {
      setLoading(false);
      return;
    }

    const startTime = performance.now();
    console.log('[Customer Transactions] Fetch started at:', new Date().toISOString());

    try {
      setLoading(true);

      const params = new URLSearchParams({
        page: String(page),
        limit: pageSize === 'all' ? 'all' : String(pageSize),
        ...(searchTerm && { search: searchTerm }),
        ...(dateRange?.from && { fromDate: dateRange.from.toISOString() }),
        ...(dateRange?.to && { toDate: dateRange.to.toISOString() }),
        sortField,
        sortOrder,
      });

      if (options?.recalc) {
        params.set('recalc', 'true');
      }

      const response = await fetch(`/api/accounts/transactions/customer/${customerId}?${params}`);
      const data = await response.json();
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      if (response.ok) {
        setCustomer(data.customer);
        setTransactions(data.transactions);
        setTotal(data.total || data.transactions.length);
        setLoadTime(duration);
        console.log(`[Customer Transactions] Data loaded in ${duration.toFixed(2)}ms (${(duration / 1000).toFixed(2)}s)`);
      } else {
        console.error("Error fetching customer data:", data.error);
        setLoadTime(null);
      }
    } catch (error) {
      console.error("Error fetching customer data:", error);
      setLoadTime(null);
    } finally {
      setLoading(false);
      setIsRecalculating(false);
    }
  };

  // Initial fetch on mount
  useEffect(() => {
    if (customerId) {
      fetchCustomerData();
      isInitialMount.current = false;
    }
  }, [customerId]);

  // Fetch when pagination or filters change (but not on initial mount)
  useEffect(() => {
    if (isInitialMount.current) {
      return;
    }
    // Don't fetch if user is currently typing in date fields
    if (isTypingDate.current) {
      return;
    }
    // Don't fetch if custom period is selected but dates are incomplete
    if (periodType === 'custom') {
      // Check if dates are incomplete - if so, don't fetch
      if (!customStartDate || !customEndDate || 
          customStartDate.length !== 10 || customEndDate.length !== 10) {
        // Don't set loading state if dates are incomplete
        return;
      }
      // Also check if dateRange is undefined (shouldn't happen if dates are complete, but safety check)
      if (!dateRange) {
        return;
      }
    }
    fetchCustomerData();
  }, [page, pageSize, dateRange, sortField, sortOrder, periodType]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setPage(1);
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="ml-2 h-4 w-4" />;
    return sortOrder === "asc" ? (
      <ArrowUp className="ml-2 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4" />
    );
  };

  // Update date range based on period type (doesn't trigger fetch)
  const updatePeriodDates = () => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1); // Tomorrow to include today

    switch (periodType) {
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'last3month':
        const threeMonthsAgo = new Date(now);
        threeMonthsAgo.setMonth(now.getMonth() - 3);
        startDate = new Date(threeMonthsAgo.getFullYear(), threeMonthsAgo.getMonth(), 1);
        break;
      case 'last6month':
        const sixMonthsAgo = new Date(now);
        sixMonthsAgo.setMonth(now.getMonth() - 6);
        startDate = new Date(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth(), 1);
        break;
      case 'year':
        // Last 12 months from today
        const twelveMonthsAgo = new Date(now);
        twelveMonthsAgo.setMonth(now.getMonth() - 12);
        startDate = new Date(twelveMonthsAgo.getFullYear(), twelveMonthsAgo.getMonth(), twelveMonthsAgo.getDate());
        break;
      case 'financialyear':
        if (now.getMonth() >= 6) {
          startDate = new Date(now.getFullYear(), 6, 1); // July 1 of current year
        } else {
          startDate = new Date(now.getFullYear() - 1, 6, 1); // July 1 of previous year
        }
        break;
      case 'custom':
        // Validate that dates are complete (YYYY-MM-DD format, 10 characters)
        if (customStartDate && customEndDate && 
            customStartDate.length === 10 && customEndDate.length === 10) {
          const startDateObj = new Date(customStartDate);
          const endDateObj = new Date(customEndDate);
          // Check if dates are valid
          if (!isNaN(startDateObj.getTime()) && !isNaN(endDateObj.getTime())) {
            startDate = new Date(customStartDate);
            startDate.setHours(0, 0, 0, 0); // Start of the day
            endDate = new Date(customEndDate);
            endDate.setHours(23, 59, 59, 999); // End of the selected day
          } else {
            // Invalid dates - don't update
            setDateRange(undefined);
            return;
          }
        } else {
          // Don't set date range if custom dates not provided or incomplete
          setDateRange(undefined);
          return;
        }
        break;
      default:
        const defaultThreeMonthsAgo = new Date(now);
        defaultThreeMonthsAgo.setMonth(now.getMonth() - 3);
        startDate = new Date(defaultThreeMonthsAgo.getFullYear(), defaultThreeMonthsAgo.getMonth(), 1);
    }

    setDateRange({ from: startDate, to: endDate });
  };

  // Update date range when period type or custom dates change
  // Only update if dates are complete (10 chars each) or period type is not custom
  useEffect(() => {
    if (periodType === 'custom') {
      // Only update if both dates are complete (10 characters = YYYY-MM-DD format)
      if (customStartDate && customEndDate && 
          customStartDate.length === 10 && customEndDate.length === 10) {
        // Delay to ensure typing flag is cleared and user has finished typing
        const timer = setTimeout(() => {
          if (!isTypingDate.current) {
            updatePeriodDates();
          }
        }, 500);
        return () => clearTimeout(timer);
      }
      // Don't update dateRange if dates are incomplete - keep previous value
      // This prevents triggering fetch while user is typing
    } else {
      updatePeriodDates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodType, customStartDate, customEndDate]);

  // Export functions
  const exportToExcel = (data: any[], headers: string[], filename: string) => {
    const csvContent = [headers, ...data]
      .map(row => row.map((cell: any) => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPrint = async (data: any[], headers: string[], title: string, total: number, startingBalance: number, totalDebit: number, totalCredit: number, finalBalance: number) => {
    // Fetch logo from API
    let logoBase64 = '';
    try {
      const assetsResponse = await fetch('/api/assets/logo-footer');
      if (assetsResponse.ok) {
        const assets = await assetsResponse.json();
        logoBase64 = assets.logo || '';
      }
    } catch (error) {
      console.error('Error fetching assets:', error);
    }

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const formatDateRange = () => {
        if (dateRange?.from && dateRange?.to) {
          const formatDate = (date: Date) => {
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = String(date.getFullYear()).slice(-2);
            return `${day}/${month}/${year}`;
          };
          const from = new Date(dateRange.from);
          const to = new Date(dateRange.to);
          return `${formatDate(from)} to ${formatDate(to)}`;
        }
        return 'N/A';
      };

      const customerInfo = customer ? `
        <div class="invoice-info">
          <div class="invoice-col">
            <address>
              <strong>${customer.CompanyName || 'Customer Name'}</strong>${customer.PersonName ? `<br>Attn: ${customer.PersonName}` : ''}${customer.Address ? `<br>${customer.Address}` : ''}${customer.City || customer.Country ? `<br>${customer.City || ''}${customer.City && customer.Country ? ', ' : ''}${customer.Country || ''}` : ''}
            </address>
          </div>
          <div class="invoice-col" style="text-align: right;">
            <p style="margin-bottom: 0;"><b>Account Id: </b><span style="float: right;">${customer.id || 'N/A'}</span></p>
            <p style="margin-bottom: 0;"><b>Period: </b><span style="float: right;">${formatDateRange()}</span></p>
            <p style="margin-top: 20px; margin-bottom: 0;"><b>Starting Balance: </b><span style="float: right;">${(-(startingBalance ?? 0)).toLocaleString()}</span></p>
          </div>
        </div>
      ` : '';
      
      // Wait for images to load before opening print dialog
      const waitForImages = (html: string): Promise<void> => {
        return new Promise((resolve) => {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = html;
          const images = tempDiv.querySelectorAll('img');
          if (images.length === 0) {
            resolve();
            return;
          }
          let loadedCount = 0;
          const totalImages = images.length;
          images.forEach((img) => {
            const newImg = new Image();
            newImg.onload = () => {
              loadedCount++;
              if (loadedCount === totalImages) {
                resolve();
              }
            };
            newImg.onerror = () => {
              loadedCount++;
              if (loadedCount === totalImages) {
                resolve();
              }
            };
            newImg.src = img.getAttribute('src') || '';
          });
        });
      };

      const tableHTML = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>${title}</title>
            <meta charset="utf-8">
            <style>
              * { box-sizing: border-box; }
              html, body { 
                font-family: Arial, sans-serif; 
                margin: 0;
                padding: 0;
                height: 100%;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              body {
                display: flex;
                flex-direction: column;
                min-height: 100vh;
                padding: 20px 10px;
              }
              .header-section {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 30px;
                padding-bottom: 20px;
              }
              .logo-section {
                display: flex;
                align-items: center;
              }
              .logo-section img {
                width: 200px;
                height: auto;
                max-width: 100%;
              }
              .report-info {
                text-align: right;
              }
              .report-title {
                font-size: 20px;
                font-weight: bold;
                color: #333;
                margin-bottom: 10px;
              }
              .report-date {
                color: #666;
                font-size: 14px;
              }
              .invoice-info {
                margin: 20px 0 0 0;
                display: flex;
                border-bottom: none;
              }
              .invoice-col {
                flex: 1;
              }
              .invoice-col address {
                font-style: normal;
                line-height: 1.2;
                margin: 0;
                padding: 0;
              }
              .invoice-col address strong {
                font-size: 16px;
                color: #333;
                display: inline;
                margin: 0;
                padding: 0;
              }
              .invoice-col address br {
                line-height: 1;
                margin: 0;
                padding: 0;
              }
              .invoice-col p {
                margin: 5px 0;
                font-size: 14px;
                color: #666;
              }
              .invoice-col p b {
                color: #333;
              }
              .table-responsive {
                width: 100%;
                margin-top: 20px;
                overflow-x: auto;
              }
              table { 
                border-collapse: collapse; 
                width: 100%; 
                margin: 0;
                background-color: #fff;
                border: 1px solid #ccc;
                border-top: none;
              }
              thead {
                background-color: #4a5568 !important;
              }
              th { 
                background-color: #4a5568 !important;
                color: white;
                font-weight: 600;
                padding: 10px 8px;
                text-align: left;
                border: 1px solid #2d3748;
                font-size: 11px;
                text-transform: none;
                letter-spacing: 0.5px;
                white-space: nowrap;
              }
              td { 
                padding: 8px;
                text-align: left;
                border: 1px solid #e2e8f0;
                font-size: 11px;
                color: #2d3748;
                vertical-align: top;
              }
              td:first-child {
                white-space: nowrap;
              }
              tbody tr {
                background-color: #fff;
              }
              tbody tr:nth-child(even) {
                background-color: #f7fafc;
              }
              tbody tr:hover {
                background-color: #edf2f7;
              }
              .amount-cell {
                text-align: right;
              }
              .balance-cell {
                text-align: right;
                font-weight: 600;
              }
              .total-section {
                margin-top: 25px;
                padding: 12px 20px;
                background-color: #e2e8f0;
                text-align: right;
                font-weight: 700;
                font-size: 14px;
                border: 1px solid #cbd5e0;
                border-radius: 4px;
              }
              .content-wrapper {
                flex: 1;
              }
              @media print {
                html, body { 
                  margin: 0; 
                  padding: 0;
                  height: 100%;
                }
                body {
                  display: flex;
                  flex-direction: column;
                  min-height: 100vh;
                  padding: 15px 5px;
                }
                .content-wrapper {
                  flex: 1;
                }
                .header-section { page-break-after: avoid; }
                table { page-break-inside: auto; }
                tr { page-break-inside: avoid; page-break-after: auto; }
                thead { display: table-header-group; }
                tfoot { display: table-footer-group; }
                @page {
                  margin: 0.5in 0.25in;
                  size: A4;
                }
              }
            </style>
          </head>
          <body>
            <div class="content-wrapper">
              <div class="header-section">
                <div class="logo-section">
                  ${logoBase64 ? `<img src="${logoBase64}" alt="PSS Logo" style="width: 200px; height: auto; max-width: 100%;">` : '<img src="/logo_final.png" alt="PSS Logo" onerror="this.style.display=\'none\'" style="width: 200px; height: auto; max-width: 100%;">'}
                </div>
                <div class="report-info">
                  <div class="report-title">${title}</div>
                  <div class="report-date">Generated on: ${(() => {
                    const date = new Date();
                    const day = String(date.getDate()).padStart(2, '0');
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const year = String(date.getFullYear()).slice(-2);
                    return `${day}/${month}/${year}`;
                  })()}</div>
                </div>
              </div>
              <hr style="border: none; border-top: 2px solid #ddd; margin: 20px 0;">
              
              ${customerInfo}
              
              <div class="table-responsive">
                <table>
                  <thead>
                    <tr>
                      ${headers.map((header, index) => {
                        const isDebit = header.toLowerCase().includes('dr.');
                        const isCredit = header.toLowerCase().includes('cr.');
                        const isBalance = header.toLowerCase() === 'balance';
                        return `<th style="${isDebit || isCredit || isBalance ? 'text-align: right;' : ''}">${header}</th>`;
                      }).join('')}
                    </tr>
                  </thead>
                  <tbody>
                    ${data.map(row => `<tr>${row.map((cell: any, cellIndex: number) => {
                      const header = headers[cellIndex];
                      const isDebit = header?.toLowerCase().includes('dr.');
                      const isCredit = header?.toLowerCase().includes('cr.');
                      const isBalance = header?.toLowerCase() === 'balance';
                      const cellClass = isDebit || isCredit ? 'amount-cell' : isBalance ? 'balance-cell' : '';
                      return `<td class="${cellClass}">${cell}</td>`;
                    }).join('')}</tr>`).join('')}
                  </tbody>
                  <tfoot>
                    <tr style="background-color: #e2e8f0; font-weight: 700;">
                      <td colspan="4" style="text-align: right; padding: 10px 8px; border: 1px solid #cbd5e0;">Total:</td>
                      <td style="text-align: right; padding: 10px 8px; border: 1px solid #cbd5e0; font-weight: 700;">${(totalDebit ?? 0).toLocaleString()}</td>
                      <td style="text-align: right; padding: 10px 8px; border: 1px solid #cbd5e0; font-weight: 700;">${(totalCredit ?? 0).toLocaleString()}</td>
                      <td style="text-align: right; padding: 10px 8px; border: 1px solid #cbd5e0; font-weight: 700;">${(finalBalance ?? 0).toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </body>
        </html>
      `;
      
      printWindow.document.write(tableHTML);
      printWindow.document.close();
      
      // Wait for images to load before printing
      await waitForImages(tableHTML);
      
      // Small delay to ensure everything is rendered
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  };

  const exportToPDF = async (data: any[], headers: string[], title: string, total: number) => {
    setIsGeneratingPDF(true);
    try {
      // Fetch logo and footer from API
      let logoBase64 = '';
      let footerBase64 = '';
      try {
        const assetsResponse = await fetch('/api/assets/logo-footer');
        if (assetsResponse.ok) {
          const assets = await assetsResponse.json();
          logoBase64 = assets.logo || '';
          footerBase64 = assets.footer || '';
        }
      } catch (error) {
        console.error('Error fetching assets:', error);
      }

      const { Document, Page, Text, View, StyleSheet, pdf, Image } = await import('@react-pdf/renderer');
      
      const styles = StyleSheet.create({
        page: {
          flexDirection: 'column',
          backgroundColor: '#ffffff',
          padding: 30,
        },
        title: {
          fontSize: 24,
          marginBottom: 10,
          textAlign: 'center',
          color: '#333',
        },
        subtitle: {
          fontSize: 12,
          marginBottom: 5,
          color: '#666',
        },
        table: {
          width: 'auto',
          borderStyle: 'solid',
          borderWidth: 1,
          borderRightWidth: 0,
          borderBottomWidth: 0,
          borderColor: '#bfbfbf',
        },
        tableRow: {
          margin: 'auto',
          flexDirection: 'row',
        },
        tableColHeader: {
          width: '14.28%',
          borderStyle: 'solid',
          borderWidth: 1,
          borderColor: '#2d3748',
          backgroundColor: '#4a5568',
          padding: 8,
        },
        tableCol: {
          width: '14.28%',
          borderStyle: 'solid',
          borderWidth: 1,
          borderColor: '#e2e8f0',
          padding: 6,
        },
        tableCellHeader: {
          margin: 'auto',
          fontSize: 9,
          fontWeight: 'bold',
          color: '#ffffff',
          whiteSpace: 'nowrap' as const,
        },
        tableCell: {
          margin: 'auto',
          fontSize: 9,
          color: '#2d3748',
        },
        dateCell: {
          whiteSpace: 'nowrap' as const,
        },
        amountCell: {
          textAlign: 'right',
        },
        balanceCell: {
          textAlign: 'right',
          fontWeight: 'bold',
        },
      });

      const MyDocument = () => {
        return (
          <Document>
            <Page size="A4" style={styles.page}>
              <View style={{ marginBottom: 20 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {logoBase64 ? (
                      <Image src={logoBase64} style={{ width: 200 }} />
                    ) : (
                      <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#1e40af' }}>PSS</Text>
                    )}
                  </View>
                  <View style={{ textAlign: 'right' }}>
                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 5 }}>{title}</Text>
                    <Text style={{ fontSize: 10, color: '#666' }}>
                      Generated on: {new Date().toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </Text>
                  </View>
                </View>
                <View style={{ borderBottom: '2 solid #ddd', marginBottom: 20 }} />
                {customer && (
                  <View style={{ border: '1 solid #ddd', padding: 15, backgroundColor: '#fafafa', marginBottom: 15 }}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 15 }}>
                      <View style={{ width: '48%' }}>
                        <Text style={{ fontSize: 9, color: '#666', textTransform: 'uppercase', marginBottom: 3, fontWeight: 'bold' }}>Account Holder</Text>
                        <Text style={{ fontSize: 11, color: '#333', fontWeight: 'bold' }}>{customer.CompanyName || 'Customer Name'}</Text>
                      </View>
                      <View style={{ width: '48%' }}>
                        <Text style={{ fontSize: 9, color: '#666', textTransform: 'uppercase', marginBottom: 3, fontWeight: 'bold' }}>Account Number</Text>
                        <Text style={{ fontSize: 11, color: '#333' }}>{customer.id || 'N/A'}</Text>
                      </View>
                      <View style={{ width: '100%', marginTop: 5 }}>
                        <Text style={{ fontSize: 9, color: '#666', textTransform: 'uppercase', marginBottom: 3, fontWeight: 'bold' }}>Address</Text>
                        <Text style={{ fontSize: 10, color: '#333', lineHeight: 1.4 }}>
                          {customer.Address || ''}{customer.Address && (customer.City || customer.Country) ? ', ' : ''}
                          {customer.City || ''}{customer.City && customer.Country ? ', ' : ''}{customer.Country || ''}
                          {customer.PersonName ? ` | Attn: ${customer.PersonName}` : ''}
                        </Text>
                      </View>
                      <View style={{ width: '48%' }}>
                        <Text style={{ fontSize: 9, color: '#666', textTransform: 'uppercase', marginBottom: 3, fontWeight: 'bold' }}>Account Status</Text>
                        <Text style={{ fontSize: 11, color: '#333' }}>Active</Text>
                      </View>
                      <View style={{ width: '48%' }}>
                        <Text style={{ fontSize: 9, color: '#666', textTransform: 'uppercase', marginBottom: 3, fontWeight: 'bold' }}>Balance at Period End</Text>
                        <Text style={{ fontSize: 11, color: '#1a202c', fontWeight: 'bold' }}>{total.toLocaleString()}</Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>
              
              <View style={styles.table}>
                <View style={styles.tableRow}>
                  {headers.map((header, index) => {
                    const isDebit = header?.toLowerCase().includes('dr.');
                    const isCredit = header?.toLowerCase().includes('cr.');
                    const isBalance = header?.toLowerCase() === 'balance';
                    const headerStyle = isDebit || isCredit || isBalance 
                      ? { ...styles.tableCellHeader, textAlign: 'right' as const }
                      : styles.tableCellHeader;
                    return (
                      <View key={index} style={styles.tableColHeader}>
                        <Text style={headerStyle}>{header}</Text>
                      </View>
                    );
                  })}
                </View>
                
                {data.map((row, rowIndex) => (
                  <View key={rowIndex} style={[styles.tableRow, { backgroundColor: rowIndex % 2 === 0 ? '#fff' : '#f7fafc' }]}>
                    {row.map((cell: any, cellIndex: number) => {
                      const header = headers[cellIndex];
                      const isDebit = header?.toLowerCase().includes('dr.');
                      const isCredit = header?.toLowerCase().includes('cr.');
                      const isBalance = header?.toLowerCase() === 'balance';
                      const isDate = cellIndex === 0; // First column is date
                      const cellStyle = isDebit || isCredit
                        ? { ...styles.tableCell, ...styles.amountCell }
                        : isBalance 
                        ? { ...styles.tableCell, ...styles.balanceCell }
                        : isDate
                        ? { ...styles.tableCell, ...styles.dateCell }
                        : styles.tableCell;
                      return (
                        <View key={cellIndex} style={styles.tableCol}>
                          <Text style={cellStyle}>{String(cell || '')}</Text>
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
              
              <View style={{ marginTop: 20, padding: 12, backgroundColor: '#e2e8f0', border: '1 solid #cbd5e0', borderRadius: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: 'bold', textAlign: 'right' }}>Total Balance: {total.toLocaleString()}</Text>
              </View>
              
            </Page>
          </Document>
        );
      };

      const blob = await pdf(<MyDocument />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${title.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('PDF generation error:', error);
      alert(`Error generating PDF: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const getTransactionExportData = (transactions: Transaction[]) => {
    const headers = ["Date", "Invoice", "Description", "Ref.", "Dr. (Rs.)", "Cr. (Rs.)", "Balance"];
    const data = transactions.map(transaction => {
      let voucherDateToUse: string;
      
      // Check if this is a credit/debit note transaction
      const isCreditDebitNote = transaction.reference?.startsWith("#CREDIT") || transaction.reference?.startsWith("#DEBIT");
      
      if (isCreditDebitNote && transaction.creditNoteDate) {
        // For credit/debit note transactions: use the date from the credit/debit note
        voucherDateToUse = transaction.creditNoteDate;
      } else {
        // Check if this is a shipment transaction (DEBIT with invoice) or payment transaction (CREDIT with invoice)
        const isShipmentTransaction = transaction.type === "DEBIT" && transaction.invoice;
        const isPaymentTransaction = transaction.type === "CREDIT" && transaction.invoice;
        
        if (isShipmentTransaction) {
          // For shipment transactions: voucher date = shipment date (both use shipmentDate)
          voucherDateToUse = transaction.shipmentDate || transaction.createdAt;
        } else if (isPaymentTransaction) {
          // For payment transactions: voucher date = payment date (from Payment table)
          voucherDateToUse = transaction.paymentDate || transaction.createdAt;
        } else {
          // For other transactions: use createdAt for voucher date
          voucherDateToUse = transaction.createdAt;
        }
      }
      
      let formattedDate: string;
      try {
        formattedDate = format(parseISO(voucherDateToUse), "dd/MM/yy");
      } catch (e) {
        const date = new Date(voucherDateToUse);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = String(date.getFullYear()).slice(-2);
        formattedDate = `${day}/${month}/${year}`;
      }
      
      const debit = transaction.type === "DEBIT" ? (transaction.amount ?? 0).toLocaleString() : "-";
      const credit = transaction.type === "CREDIT" ? (transaction.amount ?? 0).toLocaleString() : "-";
      
      // Make pipe characters bold in description
      const descriptionWithBoldPipes = transaction.description.replace(/\|/g, '<b>|</b>');
      
      // Format balance: show "-" if balance is 0, otherwise show inverted balance
      const balance = transaction.newBalance ?? 0;
      const formattedBalance = balance === 0 ? "-" : (-balance).toLocaleString();
      
      return [
        formattedDate,
        transaction.invoice || "-",
        descriptionWithBoldPipes,
        transaction.reference || "-",
        debit,
        credit,
        formattedBalance
      ];
    });
    return { headers, data };
  };

  const handleExportExcel = () => {
    const { headers, data } = getTransactionExportData(sortedTransactions);
    exportToExcel(data, headers, 'customer_transactions');
  };

  const handleExportPrint = async () => {
    // Use the same sorting logic as the table, but reverse to oldest first
    // This preserves the exact same-date ordering from the table
    const getVoucherDate = (t: Transaction) => {
      const isCreditDebitNote = t.reference?.startsWith("#CREDIT") || t.reference?.startsWith("#DEBIT");
      if (isCreditDebitNote && t.creditNoteDate) {
        return t.creditNoteDate;
      }
      const isShipmentTransaction = t.type === "DEBIT" && t.invoice;
      const isPaymentTransaction = t.type === "CREDIT" && t.invoice;
      if (isShipmentTransaction) {
        return t.shipmentDate || t.createdAt;
      } else if (isPaymentTransaction) {
        return t.paymentDate || t.createdAt;
      }
      return t.createdAt;
    };
    
    const sortedForExport = [...sortedTransactions].map((t, index) => ({ ...t, originalIndex: index }))
      .sort((a, b) => {
        const dateA = new Date(getVoucherDate(a)).getTime();
        const dateB = new Date(getVoucherDate(b)).getTime();
        const dateDiff = dateA - dateB; // Oldest first (reversed from table's desc order)
        
        // When dates are the same, use the exact same logic as the table
        // CREDIT (payment) transactions come before DEBIT (shipment/invoice) transactions
        // This matches the table's same-date ordering
        if (dateDiff === 0) {
          if (a.type === "DEBIT" && b.type === "CREDIT") return -1;  // DEBIT comes after (below) CREDIT
          if (a.type === "CREDIT" && b.type === "DEBIT") return 1; // CREDIT comes before (above) DEBIT
          // If both are shipments (DEBIT with invoice), sort by invoice number (smaller first)
          if (a.type === "DEBIT" && b.type === "DEBIT" && a.invoice && b.invoice) {
            const invoiceA = a.invoice.toLowerCase();
            const invoiceB = b.invoice.toLowerCase();
            // Try numeric comparison first, then string comparison
            const numA = parseInt(invoiceA);
            const numB = parseInt(invoiceB);
            if (!isNaN(numA) && !isNaN(numB)) {
              return numA - numB;
            }
            return invoiceA.localeCompare(invoiceB);
          }
          // If same type, preserve original order from sortedTransactions
          return (a as any).originalIndex - (b as any).originalIndex;
        }
        
        return dateDiff;
      })
      .map(({ originalIndex, ...t }) => t) as Transaction[];
    
    // Calculate starting balance (balance before the first transaction in the period)
    const startingBalance = sortedForExport.length > 0 
      ? (sortedForExport[0].previousBalance ?? 0)
      : (customer?.currentBalance ?? 0);
    
    // Calculate totals
    const totalDebit = sortedForExport
      .filter(t => t.type === "DEBIT")
      .reduce((sum, t) => sum + (t.amount ?? 0), 0);
    const totalCredit = sortedForExport
      .filter(t => t.type === "CREDIT")
      .reduce((sum, t) => sum + (t.amount ?? 0), 0);
    const finalBalance = sortedForExport.length > 0 
      ? (sortedForExport[sortedForExport.length - 1].newBalance ?? 0)
      : startingBalance;
    
    const { headers, data } = getTransactionExportData(sortedForExport);
    await exportToPrint(data, headers, 'Customer Transactions Report', total, startingBalance, totalDebit, totalCredit, finalBalance);
  };

  const handleExportPDF = () => {
    // Sort transactions oldest first for export
    const sortedForExport = [...sortedTransactions].sort((a, b) => {
      const getVoucherDate = (t: Transaction) => {
        const isCreditDebitNote = t.reference?.startsWith("#CREDIT") || t.reference?.startsWith("#DEBIT");
        if (isCreditDebitNote && t.creditNoteDate) {
          return t.creditNoteDate;
        }
        const isShipmentTransaction = t.type === "DEBIT" && t.invoice;
        const isPaymentTransaction = t.type === "CREDIT" && t.invoice;
        if (isShipmentTransaction) {
          return t.shipmentDate || t.createdAt;
        } else if (isPaymentTransaction) {
          return t.paymentDate || t.createdAt;
        }
        return t.createdAt;
      };
      const dateA = new Date(getVoucherDate(a)).getTime();
      const dateB = new Date(getVoucherDate(b)).getTime();
      return dateA - dateB; // Oldest first
    });
    const { headers, data } = getTransactionExportData(sortedForExport);
    exportToPDF(data, headers, 'Customer Transactions Report', total);
  };



  if (loading) {
    return (
      <div className="w-full min-h-full p-4 sm:p-6 lg:p-8 xl:p-10 bg-white dark:bg-zinc-900">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="w-full min-h-full p-4 sm:p-6 lg:p-8 xl:p-10 bg-white dark:bg-zinc-900">
        <div className="text-center">Customer not found</div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-full p-4 sm:p-6 lg:p-8 xl:p-10 bg-white dark:bg-zinc-900">
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800 dark:text-white mb-2">
            Customer Transactions
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            {customer.CompanyName} - {customer.PersonName}
          </p>
        </div>

        {/* Balance Display - Top Right */}
        <div className="text-right">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
            Current Balance
          </div>
          <div className="text-2xl font-bold">
            <span
              className={
                customer.currentBalance > 0
                  ? "text-red-600 dark:text-red-400"
                  : customer.currentBalance < 0
                  ? "text-green-600 dark:text-green-400"
                  : "text-gray-600 dark:text-gray-400"
              }
            >
              {customer.currentBalance.toLocaleString()}
            </span>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Credit Limit: {customer.creditLimit.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        {/* Left side - Search field */}
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:max-w-sm">
            <Input
              placeholder="Search by reference, amount, description..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
              }}
              className="pr-12"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPage(1);
                  fetchCustomerData();
                }
              }}
            />
            <div className="absolute right-0 top-0 h-full flex items-center pointer-events-none">
              <div className="bg-blue-500 rounded-r-md px-3 h-full flex items-center">
                <Search className="w-4 h-4 text-white" />
              </div>
            </div>
          </div>
          {loadTime !== null && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Load time: {loadTime.toFixed(0)}ms ({(loadTime / 1000).toFixed(2)}s)
            </div>
          )}
        </div>

        {/* Right side - Show, Export, Recalculate and Date Range */}
        <div className="flex gap-4 items-end">
          {/* Show Entries Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Show:</span>
            <Select
              value={pageSize.toString()}
              onValueChange={(value: string) => {
                setPageSize(value === 'all' ? 'all' : parseInt(value));
              }}
            >
              <SelectTrigger className="w-20 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Export Dropdown */}
          <div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-[120px] justify-between">
                  Export
                  <ArrowUp className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[120px]">
                <DropdownMenuItem onClick={handleExportExcel} className="flex items-center gap-2">
                  <Table className="w-4 h-4" />
                  Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPrint} className="flex items-center gap-2">
                  <Printer className="w-4 h-4" />
                  Print
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={handleExportPDF} 
                  disabled={isGeneratingPDF}
                  className="flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  {isGeneratingPDF ? 'Generating...' : 'PDF'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Recalculate balances */}
          <div>
            <Button
              variant="outline"
              onClick={() => {
                setPage(1);
                setIsRecalculating(true);
                fetchCustomerData({ recalc: true });
              }}
              disabled={loading || isRecalculating}
            >
              {isRecalculating ? 'Recalculating...' : 'Recalculate balances'}
            </Button>
          </div>

          {/* Date Range Filter */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <Select
              value={periodType}
              onValueChange={(value: string) => {
                setPeriodType(value as any);
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Current Month</SelectItem>
                <SelectItem value="last3month">Last 3 Month</SelectItem>
                <SelectItem value="last6month">Last 6 Month</SelectItem>
                <SelectItem value="year">Last 12 Months</SelectItem>
                <SelectItem value="financialyear">Financial Year</SelectItem>
                <SelectItem value="custom">Custom Period</SelectItem>
              </SelectContent>
            </Select>
            
            {periodType === 'custom' && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-500 shrink-0 mt-1" />
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => {
                    isTypingDate.current = true;
                    setCustomStartDate(e.target.value);
                    // Clear typing flag after a delay to allow user to finish typing
                    setTimeout(() => {
                      isTypingDate.current = false;
                    }, 800);
                  }}
                  onBlur={() => {
                    isTypingDate.current = false;
                  }}
                  className="w-full sm:w-44 min-w-[160px]"
                />
                <span className="text-gray-500 shrink-0">to</span>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => {
                    isTypingDate.current = true;
                    setCustomEndDate(e.target.value);
                    // Clear typing flag after a delay to allow user to finish typing
                    setTimeout(() => {
                      isTypingDate.current = false;
                    }, 800);
                  }}
                  onBlur={() => {
                    isTypingDate.current = false;
                  }}
                  className="w-full sm:w-44 min-w-[160px]"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-2xl font-bold text-gray-800 dark:text-white">
              Transaction History
            </CardTitle>
            {loadTime !== null && !loading && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                ⏱️ Loaded in {loadTime.toFixed(0)}ms ({(loadTime / 1000).toFixed(2)}s)
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400 text-center py-10 text-lg">
              No transactions found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto">
                <thead>
                  <tr className="text-sm text-gray-500 dark:text-gray-300 border-b">
                    <th className="px-4 py-2 text-left">
                      <button
                        onClick={() => handleSort("voucherDate")}
                        className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                      >
                        Date {getSortIcon("voucherDate")}
                      </button>
                    </th>
                    <th className="px-4 py-2 text-left">Invoice</th>
                    <th className="px-4 py-2 text-left">
                      <button
                        onClick={() => handleSort("description")}
                        className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                      >
                        Description {getSortIcon("description")}
                      </button>
                    </th>
                    <th className="px-4 py-2 text-left">
                      <button
                        onClick={() => handleSort("reference")}
                        className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                      >
                        Reference {getSortIcon("reference")}
                      </button>
                    </th>
                    <th className="px-4 py-2 text-left">
                      <button
                        onClick={() => handleSort("amount")}
                        className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                      >
                        Debit {getSortIcon("amount")}
                      </button>
                    </th>
                    <th className="px-4 py-2 text-left">
                      <button
                        onClick={() => handleSort("amount")}
                        className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                      >
                        Credit {getSortIcon("amount")}
                      </button>
                    </th>
                    <th className="px-4 py-2 text-left">Balance</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-gray-700 dark:text-gray-200">
                  {sortedTransactions.map((transaction) => {
                    // Determine voucher date and shipment date based on transaction type
                    let voucherDateToUse: string;
                    let shipmentDateToUse: string;
                    
                    // Check if this is a credit/debit note transaction
                    const isCreditDebitNote = transaction.reference?.startsWith("#CREDIT") || transaction.reference?.startsWith("#DEBIT");
                    
                    if (isCreditDebitNote && transaction.creditNoteDate) {
                      // For credit/debit note transactions: use the date from the credit/debit note
                      voucherDateToUse = transaction.creditNoteDate;
                      shipmentDateToUse = transaction.creditNoteDate;
                    } else {
                      // Check if this is a shipment transaction (DEBIT with invoice) or payment transaction (CREDIT with invoice)
                      const isShipmentTransaction = transaction.type === "DEBIT" && transaction.invoice;
                      const isPaymentTransaction = transaction.type === "CREDIT" && transaction.invoice;
                      
                      if (isShipmentTransaction) {
                        // For shipment transactions: voucher date = shipment date (both use shipmentDate)
                        voucherDateToUse = transaction.shipmentDate || transaction.createdAt;
                        shipmentDateToUse = transaction.shipmentDate || transaction.createdAt;
                      } else if (isPaymentTransaction) {
                        // For payment transactions: voucher date = payment date (from Payment table), shipment date = original shipment date
                        voucherDateToUse = transaction.paymentDate || transaction.createdAt;
                        shipmentDateToUse = transaction.shipmentDate || transaction.createdAt;
                      } else {
                        // For other transactions: use createdAt for voucher date, shipmentDate for shipment date
                        voucherDateToUse = transaction.createdAt;
                        shipmentDateToUse = transaction.shipmentDate || transaction.createdAt;
                      }
                    }
                    
                    return (
                    <tr key={transaction.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-4 py-3">
                        {(() => {
                          try {
                            return format(parseISO(voucherDateToUse), "dd/MM/yy");
                          } catch (e) {
                            return new Date(voucherDateToUse).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
                          }
                        })()}
                      </td>
                      <td className="px-4 py-3">{transaction.invoice || "-"}</td>
                      <td className="px-4 py-3">{transaction.description}</td>
                      <td className="px-4 py-3">{transaction.reference || "-"}</td>
                      <td className="px-4 py-3 font-medium">
                        {transaction.type === "DEBIT" ? (
                          <span className="text-red-600 dark:text-red-400">
                            {transaction.amount.toLocaleString()}
                          </span>
                        ) : "-"}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {transaction.type === "CREDIT" ? (
                          <span className="text-green-600 dark:text-green-400">
                            {transaction.amount.toLocaleString()}
                          </span>
                        ) : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            transaction.newBalance > 0
                              ? "text-red-600 dark:text-red-400"
                              : transaction.newBalance < 0
                              ? "text-green-600 dark:text-green-400"
                              : "text-gray-600 dark:text-gray-400"
                          }
                        >
                          {transaction.newBalance.toLocaleString()}
                        </span>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination and Total Count */}
      <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-0 text-sm text-gray-600 dark:text-gray-300">
        <div className="text-center sm:text-left">
          {pageSize === 'all' 
            ? `Showing all ${total} transactions`
            : `Showing ${((page - 1) * (pageSize as number)) + 1} to ${Math.min(page * (pageSize as number), total)} of ${total} transactions`
          }
        </div>
        
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              disabled={page <= 1}
              onClick={() => {
                setPage((prev) => prev - 1);
              }}
              className="hover:scale-105 transition-transform w-full sm:w-auto"
            >
              ← Prev
            </Button>
            <span>
              Page {page} of {totalPages}
            </span>
            <Button
              disabled={page >= totalPages}
              onClick={() => {
                setPage((prev) => prev + 1);
              }}
              className="hover:scale-105 transition-transform w-full sm:w-auto"
            >
              Next →
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
