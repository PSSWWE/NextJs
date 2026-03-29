"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Users,
  Package,
  Settings,
  BarChart2,
  ShoppingCart,
  LayoutGrid,
  Globe,
  Truck,
  Plus,
  DollarSign,
  ChevronDown,
  ChevronUp,
  LogOut,
  Edit3,
  User,
  Building2,
  Search,
  FileText,
  CreditCard,
  Book,
  BookOpen,
  ClipboardList,
  Zap,
  TrendingUp,
  Mail,
  Receipt,
  Wallet,
  TrendingDown,
  ArrowDownCircle,
  ArrowUpCircle,
} from "lucide-react";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import { AnimatePresence, motion } from "framer-motion";

const links = [
  { href: "/dashboard/customers", label: "Customers", icon: User },
  { href: "/dashboard/recipients", label: "Recipients", icon: Users },
  { href: "/dashboard/vendors", label: "Vendors", icon: Building2 },
  { href: "/dashboard/users", label: "Users", icon: Users },
];

interface DecodedToken {
  name: string;
  email?: string;
}

const Sidebar = ({ isOpen }: { isOpen: boolean }) => {
  const pathname = usePathname();
  const router = useRouter();
  const [userName, setUserName] = useState("User");
  const [isHovered, setIsHovered] = useState(false);
  const [shipmentOpen, setShipmentOpen] = useState(
    pathname.startsWith("/dashboard/shipments") ||
      pathname.startsWith("/dashboard/add-shipment") ||
      pathname.startsWith("/dashboard/rate-calculator")
  );
  const [accountsOpen, setAccountsOpen] = useState(
    pathname.startsWith("/dashboard/accounts")
  );

  const [incomeOpen, setIncomeOpen] = useState(
    pathname.startsWith("/dashboard/income")
  );
  const [expenseOpen, setExpenseOpen] = useState(
    pathname.startsWith("/dashboard/expense")
  );
  const [settingsOpen, setSettingsOpen] = useState(
    pathname.startsWith("/dashboard/shipment-settings")
  );
  const [reportsOpen, setReportsOpen] = useState(
    pathname.startsWith("/dashboard/reports") || pathname.startsWith("/dashboard/accounts/ledger")
  );

  useEffect(() => {
    const token = Cookies.get("token");
    if (token) {
      try {
        const decoded = jwtDecode<DecodedToken>(token);
        setUserName(decoded.name || "User");
      } catch (err) {
        console.error("Failed to decode token:", err);
      }
    }
  }, []);

  const handleLogout = () => {
    Cookies.remove("token");
    router.push("/auth/login");
  };

  const handleMouseEnter = () => {
    if (!isOpen) {
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    if (!isOpen) {
      setIsHovered(false);
    }
  };

  // Determine if sidebar should be expanded (either permanently open or hovered)
  const shouldExpand = isOpen || isHovered;

  const subLinksShipment = [
    { href: "/dashboard/shipments", label: "All Shipments", icon: Package },
    { href: "/dashboard/add-shipment", label: "Add Shipment", icon: Plus },
    {
      href: "/dashboard/rate-calculator",
      label: "Rate Calculator",
      icon: DollarSign,
    },
  ];
  const subLinksSettings = [
    {
      href: "/dashboard/settings/logistics",
      label: "Logistics Settings",
      icon: Truck,
    },
    {
      href: "/dashboard/settings/payment",
      label: "Payment Settings",
      icon: CreditCard,
    },
    {
      href: "/dashboard/settings/shipment-info-settings",
      label: "Shipment Info Settings",
      icon: Edit3,
    },
    {
      href: "/dashboard/settings/manage-zones",
      label: "Manage Zones",
      icon: Plus,
    },
    {
      href: "/dashboard/settings/manage-rate-list",
      label: "Manage Rate List",
      icon: DollarSign,
    },
    {
      href: "/dashboard/settings/remote-area-lookup",
      label: "Remote Area",
      icon: Search,
    },
    {
      href: "/dashboard/settings",
      label: "General Settings",
      icon: Plus,
    },
  ];

  const subLinksAccounts = [
    {
      href: "/dashboard/chart-of-accounts",
      label: "Chart of Accounts",
      icon: ClipboardList,
    },
    {
      href: "/dashboard/accounts/account-books",
      label: "Account Books",
      icon: BookOpen,
    },
    {
      href: "/dashboard/journal-entries",
      label: "Journal Entries",
      icon: Book,
    },
    {
      href: "/dashboard/accounts/balance-sheet",
      label: "Balance Sheet",
      icon: BarChart2,
    },
    {
      href: "/dashboard/accounts/income-statement",
      label: "Income Statement",
      icon: TrendingUp,
    },
  ];

  const subLinksIncome = [
    { href: "/dashboard/income/invoices", label: "Invoices", icon: FileText },
    { href: "/dashboard/income/revenue", label: "Revenue", icon: TrendingUp },
    {
      href: "/dashboard/income/credit-notes",
      label: "Credit Notes",
      icon: FileText,
    },
  ];

  const subLinksExpense = [
    { href: "/dashboard/expense/bills", label: "Bills", icon: FileText },
    {
      href: "/dashboard/expense/payments",
      label: "Payments",
      icon: CreditCard,
    },
    {
      href: "/dashboard/expense/debit-notes",
      label: "Debit Notes",
      icon: FileText,
    },
  ];

  const subLinksReports = [
    { href: "/dashboard/accounts/ledger", label: "Ledger", icon: BookOpen },
    { href: "/dashboard/accounts/customer-balances", label: "Customer Balances", icon: Wallet },
    { href: "/dashboard/accounts/vendor-balances", label: "Vendor Balances", icon: Wallet },
    { href: "/dashboard/accounts/payments-received", label: "Payments Received", icon: ArrowDownCircle },
    { href: "/dashboard/accounts/vendor-payments", label: "Vendor Payments", icon: ArrowUpCircle },
  ];

  return (
    <aside
      className={`h-full bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out ${
        shouldExpand ? "w-64" : "w-20"
      }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="flex flex-col h-full">
        <nav className="flex-1 px-2 py-6 space-y-2 overflow-y-auto scrollbar-hide">
          {/* Add Shipment */}
          {/* <Link
            href="/dashboard/add-shipment"
            className={`flex items-center gap-4 transition-all duration-200 text-sm font-medium rounded-lg px-3 py-2 group 
    bg-rose-700 hover:bg-rose-900 text-white`}
          >
            <Plus className="w-5 h-5 flex-shrink-0" />
            <span
              className={`whitespace-nowrap transition-all duration-200 ${
                isOpen ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
              }`}
            >
              Add Shipment
            </span>
          </Link> */}

          {/* Dashboard */}
          <Link
            href="/dashboard"
            className={`flex items-center gap-4 transition-all duration-200 text-sm font-medium rounded-lg px-3 py-2 group ${
              pathname === "/dashboard"
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }`}
          >
            <LayoutGrid className="w-5 h-5 shrink-0" />
            <span
              className={`whitespace-nowrap transition-all duration-200 ${
                shouldExpand ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
              }`}
            >
              Dashboard
            </span>
          </Link>

          {/* Email Management */}
          <Link
            href="/dashboard/email"
            className={`flex items-center gap-4 transition-all duration-200 text-sm font-medium rounded-lg px-3 py-2 group ${
              pathname === "/dashboard/email"
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }`}
          >
            <Mail className="w-5 h-5 shrink-0" />
            <span
              className={`whitespace-nowrap transition-all duration-200 ${
                shouldExpand ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
              }`}
            >
              Email
            </span>
          </Link>

          {/* Shipments Collapsible */}
          <div>
            <button
              onClick={() => setShipmentOpen(!shipmentOpen)}
              className={`flex items-center justify-between w-full text-left transition-all duration-200 text-sm font-medium rounded-lg px-3 py-2 ${
                pathname.startsWith("/dashboard/shipments") ||
                pathname.startsWith("/dashboard/add-shipment") ||
                pathname.startsWith("/dashboard/rate-calculator")
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <div className="flex items-center gap-4">
                <Package className="w-5 h-5 shrink-0" />
                <span
                  className={`whitespace-nowrap transition-all duration-200 ${
                    shouldExpand
                      ? "opacity-100"
                      : "opacity-0 w-0 overflow-hidden"
                  }`}
                >
                  Shipments
                </span>
              </div>
              {shouldExpand &&
                (shipmentOpen ? (
                  <ChevronUp className="w-4 h-4 ml-auto" />
                ) : (
                  <ChevronDown className="w-4 h-4 ml-auto" />
                ))}
            </button>

            <AnimatePresence>
              {shipmentOpen && shouldExpand && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="pl-10 mt-2 space-y-1"
                >
                  {subLinksShipment.map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className={`flex items-center gap-3 text-sm rounded-md px-3 py-2 transition-all ${
                        pathname === href
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {label}
                    </Link>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Other Static Links */}
          {links.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-4 transition-all duration-200 text-sm font-medium rounded-lg px-3 py-2 group ${
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span
                  className={`whitespace-nowrap transition-all duration-200 ${
                    shouldExpand
                      ? "opacity-100"
                      : "opacity-0 w-0 overflow-hidden"
                  }`}
                >
                  {label}
                </span>
              </Link>
            );
          })}

          {/* Income Collapsible */}
          <div>
            <button
              onClick={() => setIncomeOpen(!incomeOpen)}
              className={`flex items-center justify-between w-full text-left transition-all duration-200 text-sm font-medium rounded-lg px-3 py-2 ${
                pathname.startsWith("/dashboard/income") ||
                pathname.startsWith("/dashboard/accounts/revenue")
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <div className="flex items-center gap-4">
                <TrendingUp className="w-5 h-5 shrink-0" />
                <span
                  className={`whitespace-nowrap transition-all duration-200 ${
                    shouldExpand
                      ? "opacity-100"
                      : "opacity-0 w-0 overflow-hidden"
                  }`}
                >
                  Income
                </span>
              </div>
              {shouldExpand &&
                (incomeOpen ? (
                  <ChevronUp className="w-4 h-4 ml-auto" />
                ) : (
                  <ChevronDown className="w-4 h-4 ml-auto" />
                ))}
            </button>

            <AnimatePresence>
              {incomeOpen && shouldExpand && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="pl-10 mt-2 space-y-1"
                >
                  {subLinksIncome.map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className={`flex items-center gap-3 text-sm rounded-md px-3 py-2 transition-all ${
                        pathname === href
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {label}
                    </Link>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Expense Collapsible */}
          <div>
            <button
              onClick={() => setExpenseOpen(!expenseOpen)}
              className={`flex items-center justify-between w-full text-left transition-all duration-200 text-sm font-medium rounded-lg px-3 py-2 ${
                pathname.startsWith("/dashboard/expense") &&
                !pathname.startsWith("/dashboard/accounts/payments")
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <div className="flex items-center gap-4">
                <ShoppingCart className="w-5 h-5 shrink-0" />
                <span
                  className={`whitespace-nowrap transition-all duration-200 ${
                    shouldExpand
                      ? "opacity-100"
                      : "opacity-0 w-0 overflow-hidden"
                  }`}
                >
                  Expense
                </span>
              </div>
              {shouldExpand &&
                (expenseOpen ? (
                  <ChevronUp className="w-4 h-4 ml-auto" />
                ) : (
                  <ChevronDown className="w-4 h-4 ml-auto" />
                ))}
            </button>

            <AnimatePresence>
              {expenseOpen && shouldExpand && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="pl-10 mt-2 space-y-1"
                >
                  {subLinksExpense.map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className={`flex items-center gap-3 text-sm rounded-md px-3 py-2 transition-all ${
                        pathname === href
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {label}
                    </Link>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {/* Transactions */}
          <Link
            href="/dashboard/accounts/payments"
            className={`flex items-center gap-4 transition-all duration-200 text-sm font-medium rounded-lg px-3 py-2 group ${
              pathname.startsWith("/dashboard/transactions") ||
              pathname.startsWith("/dashboard/accounts/payments")
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }`}
          >
            <CreditCard className="w-5 h-5 shrink-0" />
            <span
              className={`whitespace-nowrap transition-all duration-200 ${
                shouldExpand ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
              }`}
            >
              Transactions
            </span>
          </Link>

          {/* Accounts Collapsible */}
          <div>
            <button
              onClick={() => setAccountsOpen(!accountsOpen)}
              className={`flex items-center justify-between w-full text-left transition-all duration-200 text-sm font-medium rounded-lg px-3 py-2 ${
                pathname.startsWith("/dashboard/accounts") &&
                !pathname.startsWith("/dashboard/accounts/payments") &&
                !pathname.startsWith("/dashboard/accounts/ledger")
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <div className="flex items-center gap-4">
                <DollarSign className="w-5 h-5 shrink-0" />
                <span
                  className={`whitespace-nowrap transition-all duration-200 ${
                    shouldExpand ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
                  }`}
                >
                  Accounts
                </span>
              </div>
              {shouldExpand &&
                (accountsOpen ? (
                  <ChevronUp className="w-4 h-4 ml-auto" />
                ) : (
                  <ChevronDown className="w-4 h-4 ml-auto" />
                ))}
            </button>

            <AnimatePresence>
              {accountsOpen && shouldExpand && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="pl-10 mt-2 space-y-1"
                >
                  {subLinksAccounts.map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className={`flex items-center gap-3 text-sm rounded-md px-3 py-2 transition-all ${
                        pathname === href
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {label}
                    </Link>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Reports Collapsible */}
          <div>
            <button
              onClick={() => setReportsOpen(!reportsOpen)}
              className={`flex items-center justify-between w-full text-left transition-all duration-200 text-sm font-medium rounded-lg px-3 py-2 ${
                pathname.startsWith("/dashboard/reports") || pathname.startsWith("/dashboard/accounts/ledger")
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <div className="flex items-center gap-4">
                <ClipboardList className="w-5 h-5 shrink-0" />
                <span
                  className={`whitespace-nowrap transition-all duration-200 ${
                    shouldExpand
                      ? "opacity-100"
                      : "opacity-0 w-0 overflow-hidden"
                  }`}
                >
                  Reports
                </span>
              </div>
              {shouldExpand &&
                (reportsOpen ? (
                  <ChevronUp className="w-4 h-4 ml-auto" />
                ) : (
                  <ChevronDown className="w-4 h-4 ml-auto" />
                ))}
            </button>

            <AnimatePresence>
              {reportsOpen && shouldExpand && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="pl-10 mt-2 space-y-1"
                >
                  {subLinksReports.map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className={`flex items-center gap-3 text-sm rounded-md px-3 py-2 transition-all ${
                        pathname === href
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {label}
                    </Link>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Settings Collapsible */}
          <div>
            <button
              onClick={() => setSettingsOpen(!settingsOpen)}
              className={`flex items-center justify-between w-full text-left transition-all duration-200 text-sm font-medium rounded-lg px-3 py-2 ${
                pathname.startsWith("/dashboard/shipment-settings")
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <div className="flex items-center gap-4">
                <Settings className="w-5 h-5 shrink-0" />
                <span
                  className={`whitespace-nowrap transition-all duration-200 ${
                    shouldExpand ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
                  }`}
                >
                  Settings
                </span>
              </div>
              {shouldExpand &&
                (settingsOpen ? (
                  <ChevronUp className="w-4 h-4 ml-auto" />
                ) : (
                  <ChevronDown className="w-4 h-4 ml-auto" />
                ))}
            </button>

            <AnimatePresence>
              {settingsOpen && shouldExpand && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="pl-10 mt-2 space-y-1"
                >
                  {subLinksSettings.map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className={`flex items-center gap-3 text-sm rounded-md px-3 py-2 transition-all ${
                        pathname === href
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {label}
                    </Link>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </nav>

        {/* User Info + Logout */}
        <div className="px-3 mt-auto pb-6 space-y-2">
          <button
            type="button"
            className="flex items-center gap-3 w-full text-sm font-medium text-sidebar-foreground rounded-lg px-3 py-2 hover:bg-sidebar-accent transition-all duration-200"
          >
            <div className="w-6 h-6 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-xs font-semibold text-gray-700 dark:text-white shrink-0">
              {shouldExpand ? userName[0]?.toUpperCase() : ""}
            </div>
            <span
              className={`transition-all duration-200 ${
                shouldExpand ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
              }`}
            >
              {userName}
            </span>
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full text-sm font-medium text-red-600 rounded-lg px-3 py-2 hover:bg-red-100 dark:hover:bg-red-900 transition-all duration-200"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span
              className={`transition-all duration-200 ${
                shouldExpand ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
              }`}
            >
              Logout
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
