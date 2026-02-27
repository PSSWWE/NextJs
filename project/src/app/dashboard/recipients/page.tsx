"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Recipients } from "@prisma/client";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, EllipsisVertical, Eye, Search, ArrowUpDown, ArrowUp, ArrowDown, Printer, FileText, Table } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Country as country } from "country-state-city";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import DeleteDialog from "@/components/DeleteDialog";
import ViewRecipientDialog from "@/components/ViewRecipientDialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";



type SortField = "id" | "CompanyName" | "PersonName" | "Phone" | "City" | "Country";
type SortOrder = "asc" | "desc";

export default function RecipientsPage() {
  const router = useRouter();
  const [recipients, setRecipients] = useState<Recipients[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<any>(null);
  const [recipientToDelete, setRecipientToDelete] = useState<any>(null);
  const [sortField, setSortField] = useState<SortField>("id");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pageSize, setPageSize] = useState<number | 'all'>(10); // Default page size
  const [activeTab, setActiveTab] = useState<"all" | "remote">("all");
  const [remoteTotal, setRemoteTotal] = useState(0);
  const [grandTotal, setGrandTotal] = useState(0);

  const totalPages = pageSize === 'all' ? 1 : Math.ceil(total / pageSize);

  const fetchRecipients = async () => {
    const params = new URLSearchParams({
      page: String(page),
      limit: pageSize === 'all' ? 'all' : String(pageSize),
      ...(searchTerm && { search: searchTerm }),
      sortField: sortField,
      sortOrder: sortOrder,
      ...(activeTab === "remote" ? { onlyRemote: "true" } : {}),
    });

    const res = await fetch(`/api/recipients?${params}`);
    const { recipients, total, remoteTotal } = await res.json();
    setRecipients(recipients);
    setTotal(total);

    // grandTotal should always reflect the full count of recipients (all)
    if (activeTab === "all" && typeof total === "number") {
      setGrandTotal(total);
    }

    if (typeof remoteTotal === "number") {
      setRemoteTotal(remoteTotal);
    }
  };

  useEffect(() => {
    fetchRecipients();
  }, [page, searchTerm, sortField, sortOrder, pageSize, activeTab]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="ml-2 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4" />
    );
  };

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

  const exportToPrint = (data: any[], headers: string[], title: string, total: number) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const tableHTML = `
        <html>
          <head>
            <title>${title}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              table { border-collapse: collapse; width: 100%; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
              h1 { color: #333; }
            </style>
          </head>
          <body>
            <h1>${title}</h1>
            <p>Total: ${total}</p>
            <p>Generated on: ${new Date().toLocaleDateString()}</p>
            <table>
              <thead>
                <tr>
                  ${headers.map(header => `<th>${header}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${data.map(row => `<tr>${row.map((cell: any) => `<td>${cell}</td>`).join('')}</tr>`).join('')}
              </tbody>
            </table>
          </body>
        </html>
      `;
      
      printWindow.document.write(tableHTML);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const exportToPDF = async (data: any[], headers: string[], title: string, total: number) => {
    setIsGeneratingPDF(true);
    try {
      console.log('Starting PDF generation...');
      
      // Use @react-pdf/renderer for PDF generation
      const { Document, Page, Text, View, StyleSheet, pdf } = await import('@react-pdf/renderer');
      
      // Create styles
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
          width: '16.66%',
          borderStyle: 'solid',
          borderWidth: 1,
          borderLeftWidth: 0,
          borderTopWidth: 0,
          borderColor: '#bfbfbf',
          backgroundColor: '#4285f4',
        },
        tableCol: {
          width: '16.66%',
          borderStyle: 'solid',
          borderWidth: 1,
          borderLeftWidth: 0,
          borderTopWidth: 0,
          borderColor: '#bfbfbf',
        },
        tableCellHeader: {
          margin: 'auto',
          marginTop: 5,
          fontSize: 10,
          fontWeight: 'bold',
          color: '#ffffff',
        },
        tableCell: {
          margin: 'auto',
          marginTop: 5,
          fontSize: 10,
          color: '#333',
        },
      });

      // Create PDF document
      const MyDocument = () => {
        return (
          <Document>
            <Page size="A4" style={styles.page}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>Total: {total}</Text>
              <Text style={styles.subtitle}>Generated on: {new Date().toLocaleDateString()}</Text>
              
              <View style={styles.table}>
                {/* Header Row */}
                <View style={styles.tableRow}>
                  {headers.map((header, index) => (
                    <View key={index} style={styles.tableColHeader}>
                      <Text style={styles.tableCellHeader}>{header}</Text>
                    </View>
                  ))}
                </View>
                
                {/* Data Rows */}
                {data.map((row, rowIndex) => (
                  <View key={rowIndex} style={styles.tableRow}>
                    {row.map((cell: any, cellIndex: number) => (
                      <View key={cellIndex} style={styles.tableCol}>
                        <Text style={styles.tableCell}>{String(cell || '')}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            </Page>
          </Document>
        );
      };

      // Generate and download PDF
      const blob = await pdf(<MyDocument />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${title.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      console.log('PDF generated successfully using @react-pdf/renderer');
    } catch (error: any) {
      console.error('PDF generation error:', error);
      console.error('Error details:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name
      });
      alert(`Error generating PDF: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const getRecipientExportData = (recipients: any[]) => {
    const headers = ["ID", "Company Name", "Contact Person", "Phone", "City", "Country"];
    const data = recipients.map(recipient => [
      recipient.id,
      recipient.CompanyName,
      recipient.PersonName,
      recipient.Phone,
      recipient.City,
      country.getCountryByCode(recipient.Country)?.name || recipient.Country
    ]);
    return { headers, data };
  };

  const handleExportExcel = () => {
    const { headers, data } = getRecipientExportData(recipients);
    exportToExcel(data, headers, 'recipients');
  };

  const handleExportPrint = () => {
    const { headers, data } = getRecipientExportData(recipients);
    exportToPrint(data, headers, 'Recipients Report', total);
  };

  const handleExportPDF = () => {
    const { headers, data } = getRecipientExportData(recipients);
    exportToPDF(data, headers, 'Recipients Report', total);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-10 w-full bg-white dark:bg-zinc-900 transition-all duration-300 ease-in-out ml-0 lg:ml-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-4">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800 dark:text-white">
          Recipients
        </h2>
        <div className="flex items-center gap-3 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab("all");
              setPage(1);
            }}
            className={`px-4 py-2 text-xs sm:text-sm font-medium rounded-md flex flex-col items-center justify-center transition-all min-w-[130px] ${
              activeTab === "all"
                ? "bg-blue-50 dark:bg-blue-900/30 text-indigo-600 dark:text-indigo-400 shadow-sm"
                : "bg-transparent text-gray-600 dark:text-gray-300 hover:bg-blue-50/60 dark:hover:bg-blue-900/20 hover:text-gray-800 dark:hover:text-gray-100"
            }`}
          >
            <span className="text-lg sm:text-xl font-bold text-blue-600 dark:text-blue-300">
              {grandTotal}
            </span>
            <span className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-300 mt-0.5">
              All Recipients
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("remote");
              setPage(1);
            }}
            className={`px-4 py-2 text-xs sm:text-sm font-medium rounded-md flex flex-col items-center justify-center transition-all min-w-[130px] ${
              activeTab === "remote"
                ? "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 shadow-sm"
                : "bg-transparent text-gray-600 dark:text-gray-300 hover:bg-red-50/60 dark:hover:bg-red-900/20 hover:text-red-700 dark:hover:text-red-300"
            }`}
          >
            <span className="text-lg sm:text-xl font-bold text-red-600 dark:text-red-300">
              {remoteTotal}
            </span>
            <span className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-300 mt-0.5">
              Remote Recipients
            </span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 sm:mb-6 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4">
        {/* Left side - Page size and Search bar */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-end w-full lg:w-auto">
          {/* Page size select */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Show:</span>
            <Select
              value={pageSize.toString()}
              onValueChange={(value: string) => {
                setPageSize(value === 'all' ? 'all' : parseInt(value));
                setPage(1); // Reset to first page when changing page size
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

          {/* Search bar with icon */}
          <div className="flex flex-1 max-w-sm">
            {/* Search input */}
            <Input
              placeholder="Search by company name, person name, phone, city, or country"
              value={searchTerm}
              onChange={(e) => {
                setPage(1);
                setSearchTerm(e.target.value);
              }}
              className="rounded-r-none"
            />
            {/* Icon box */}
            <div className="bg-blue-500 px-3 flex items-center justify-center rounded-r-md">
              <Search className="text-white w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Right side - Export and Add buttons */}
        <div className="flex gap-2">
          {/* Export Dropdown */}
          <div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="w-[120px] justify-between bg-blue-500 text-white hover:bg-blue-600 border-blue-500">
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

          {/* Add Recipient button */}
          <Button asChild>
            <Link href="/dashboard/recipients/add-recipients">
              <Plus className="w-4 h-4 mr-2" />
              Add Recipient
            </Link>
          </Button>
        </div>
      </div>
      
      {/* Recipients Table */}
      <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <CardContent className="p-3 sm:p-4 lg:p-6 overflow-x-auto">
          {recipients.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400 text-center py-10 text-lg">
              No recipients found.
            </p>
          ) : (
            <table className="min-w-full table-auto border-separate border-spacing-y-2 sm:border-spacing-y-4">
              <thead>
                <tr className="text-xs sm:text-sm text-gray-500 dark:text-gray-300">
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("id")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                      <span className="hidden sm:inline">ID</span>
                      <span className="sm:hidden">ID</span>
                      {getSortIcon("id")}
                    </button>
                  </th>
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("CompanyName")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                      <span className="hidden sm:inline">Company Name</span>
                      <span className="sm:hidden">Company</span>
                      {getSortIcon("CompanyName")}
                    </button>
                  </th>
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("PersonName")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                      <span className="hidden sm:inline">Contact Person</span>
                      <span className="sm:hidden">Contact</span>
                      {getSortIcon("PersonName")}
                    </button>
                  </th>
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("Phone")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                      <span className="hidden sm:inline">Phone</span>
                      <span className="sm:hidden">Phone</span>
                      {getSortIcon("Phone")}
                    </button>
                  </th>
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("City")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                      <span className="hidden sm:inline">City</span>
                      <span className="sm:hidden">City</span>
                      {getSortIcon("City")}
                    </button>
                  </th>
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("Country")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                      <span className="hidden sm:inline">Country</span>
                      <span className="sm:hidden">Country</span>
                      {getSortIcon("Country")}
                    </button>
                  </th>
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <span className="hidden sm:inline">Action</span>
                    <span className="sm:hidden">Action</span>
                  </th>
                </tr>
              </thead>
              <AnimatePresence>
                <tbody className="text-xs sm:text-sm text-gray-700 dark:text-gray-200 font-light">
                  {recipients.map((recipient) => (
                    <motion.tr
                      key={recipient.id}
                      className={`rounded-lg shadow-sm hover:shadow-md transition-all duration-300 border ${
                        recipient.isRemoteArea
                          ? "bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-500/50 ring-1 ring-red-200/80 dark:ring-red-500/50"
                          : "bg-white dark:bg-gray-800 border-transparent"
                      }`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                    >
                      <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3 font-medium">{recipient.id}</td>
                      <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                        {recipient.isRemoteArea && (recipient as any).remoteAreaCompanies ? (
                          <>
                            <span 
                              className="hidden sm:inline text-red-600 dark:text-red-400 font-semibold cursor-pointer"
                              onClick={() => {
                                setSelectedRecipient(recipient);
                                setOpenViewDialog(true);
                              }}
                            >
                              {recipient.CompanyName}
                            </span>
                            <span 
                              className="sm:hidden text-red-600 dark:text-red-400 font-semibold cursor-pointer"
                              onClick={() => {
                                setSelectedRecipient(recipient);
                                setOpenViewDialog(true);
                              }}
                            >
                              {recipient.CompanyName?.substring(0, 15)}...
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="hidden sm:inline">
                              {recipient.CompanyName}
                            </span>
                            <span className="sm:hidden">
                              {recipient.CompanyName?.substring(0, 15)}...
                            </span>
                          </>
                        )}
                      </td>
                      <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                        <span className="hidden sm:inline">{recipient.PersonName}</span>
                        <span className="sm:hidden">{recipient.PersonName?.substring(0, 12)}...</span>
                      </td>
                      <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">{recipient.Phone}</td>
                      <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">{recipient.City}</td>
                      <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                        <span className="hidden sm:inline">{country.getCountryByCode(recipient.Country)?.name}</span>
                        <span className="sm:hidden">{country.getCountryByCode(recipient.Country)?.name?.substring(0, 10)}...</span>
                      </td>
                      <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-2 hover:bg-gray-100 rounded">
                              <EllipsisVertical />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-36">
                            <DropdownMenuItem
                              onClick={() =>
                                router.push(`recipients/add-recipients?id=${recipient.id}`)
                              }
                            >
                              ✏️ Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setRecipientToDelete(recipient);
                                setOpenDeleteDialog(true);
                              }}
                            >
                              🗑️ Delete
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedRecipient(recipient);
                                setOpenViewDialog(true);
                              }}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Dialog
                          open={openDeleteDialog}
                          onOpenChange={setOpenDeleteDialog}
                        >
                          <DialogContent className="max-w-md w-full">
                            <DeleteDialog
                              entityType="recipient"
                              entityId={recipientToDelete?.id || 0}
                              onDelete={() => {
                                fetchRecipients();
                                setRecipientToDelete(null);
                              }}
                              onClose={() => {
                                setOpenDeleteDialog(false);
                                setRecipientToDelete(null);
                              }}
                            />
                          </DialogContent>
                        </Dialog>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </AnimatePresence>
            </table>
          )}
        </CardContent>
      </Card>

      {/* View Recipient Dialog */}
      <ViewRecipientDialog
        recipient={selectedRecipient}
        open={openViewDialog}
        onOpenChange={setOpenViewDialog}
      />

      {/* Pagination and Total Count */}
      <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-0 text-sm text-gray-600 dark:text-gray-300">
        <div className="text-center sm:text-left">
          {pageSize === 'all' 
            ? `Showing all ${total} recipients`
            : `Showing ${((page - 1) * (pageSize as number)) + 1} to ${Math.min(page * (pageSize as number), total)} of ${total} recipients`
          }
        </div>
        
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              disabled={page <= 1}
              onClick={() => setPage((prev) => prev - 1)}
              className="hover:scale-105 transition-transform w-full sm:w-auto"
            >
              ← Prev
            </Button>
            <span>
              Page {page} of {totalPages}
            </span>
            <Button
              disabled={page >= totalPages}
              onClick={() => setPage((prev) => prev + 1)}
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
