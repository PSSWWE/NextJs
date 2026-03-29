"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  LineChart,
  TrendingUp,
  TrendingDown,
  Users,
  ShoppingCart,
  Truck,
  Package,
  DollarSign,
  Calendar,
  MapPin,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Maximize2,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  Line,
  AreaChart,
  Area,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from "recharts";
import { Country } from "country-state-city";
import { getCountryNameFromCode } from "@/lib/utils";
import { getTrackingUrl } from "@/lib/tracking-links";
import CountryRevenueMap from "@/components/CountryRevenueMap";

/** Compact Y-axis for large currency-style values (e.g. 80M, 1.2B). */
function formatAccountsTrendAxis(value: number): string {
  if (value === 0) return "0";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) {
    const n = value / 1_000_000_000;
    const s =
      Math.abs(n) >= 100 || Math.abs(n % 1) < 1e-6
        ? n.toFixed(0)
        : n.toFixed(1);
    return `${s}B`;
  }
  if (abs >= 1_000_000) {
    const n = value / 1_000_000;
    const s =
      Math.abs(n) >= 100 || Math.abs(n % 1) < 1e-6
        ? n.toFixed(0)
        : n.toFixed(1);
    return `${s}M`;
  }
  if (abs >= 1_000) {
    const n = value / 1_000;
    const s =
      Math.abs(n) >= 100 || Math.abs(n % 1) < 1e-6
        ? n.toFixed(0)
        : n.toFixed(1);
    return `${s}K`;
  }
  return value.toLocaleString();
}

// Active slice renderer for the country pie chart: slightly larger with white border.
const DashboardPage = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'shipments' | 'payments'>('shipments');
  const [showReceivableModal, setShowReceivableModal] = useState(false);
  const [showCustomersModal, setShowCustomersModal] = useState(false);
  const [selectedCountryIso, setSelectedCountryIso] = useState<string | null>(null);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [data, setData] = useState({
    totalShipments: 0,
    totalUsers: 0,
    totalCustomers: 0,
    activeCustomers: 0,
    inactiveCustomers: 0,
    totalRevenue: 0,
    newOrders: 0,
    monthlyEarnings: [] as { month: string; earnings: number }[],
    recentShipments: [] as {
      id: number;
      trackingId: string;
      invoiceNumber: string;
      senderName: string;
      recipientName: string;
      destination: string;
      totalCost: number;
      status: string;
      invoiceStatus: string;
      packaging: string;
      amount: number;
      totalWeight: number;
      shipmentDate: Date;
      createdAt: string;
      serviceMode?: string | null;
    }[],
    recentPayments: [] as {
      id: number;
      type: string;
      amount: number;
      description: string;
      reference: string;
      invoice: string;
      partyName: string;
      partyType: string;
      category?: string;
      paymentMode?: string;
      createdAt: string;
    }[],
    // Real data from database
    shipmentStatusDistribution: [] as { status: string; count: number; color: string }[],
    revenueByDestination: [] as { destination: string; revenue: number; shipments: number }[],
    monthlyShipments: [] as { month: string; shipments: number; revenue: number }[],
    topDestinations: [] as { destination: string; shipments: number; revenue: number }[],
    performanceMetrics: {
      deliveryRate: 0,
      avgDeliveryTime: 0,
      customerSatisfaction: 0,
      revenueGrowth: 0,
    },
    growthMetrics: {
      shipmentGrowth: 0,
      customerGrowth: 0,
    },
    percentageChanges: {
      shipmentPercentageChange: 0,
      customerPercentageChange: 0,
      revenuePercentageChange: 0,
    },
    accountsData: {
      accountsReceivable: 0,
      accountsPayable: 0,
      monthlyAccountsData: [] as { month: string; receivable: number; payable: number }[],
    },
    currentMonthData: {
      revenue: 0,
      shipments: 0,
      accountsReceivable: 0,
      customers: 0,
    },
    customerDestinationMap: [] as { customer: string; destination: string; shipments: number }[],
    topCustomers: [] as { customer: string; shipments: number; totalSpent: number; avgOrderValue: number; currentBalance: number; lastShipmentDate: string | null }[],
    deliveriesByCountry: [] as { country: string; deliveries: number }[],
  });

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/dashboard");
        const json = await res.json();
        
        console.log('Dashboard Page - Received Data:', json);
        console.log('Chart Data Check:', {
          revenueByDestination: json.revenueByDestination,
          topDestinations: json.topDestinations,
          customerDestinationMap: json.customerDestinationMap
        });
        
        // Use real data directly from the API
        setData(json);
        
        // Initialize selected country to first country
        if (json.revenueByDestination && json.revenueByDestination.length > 0) {
          const first = json.revenueByDestination
            .filter((d: any) => d.destination && d.destination !== "No Data" && d.revenue > 0)
            .slice(0, 1)[0];
          if (first) {
            setSelectedCountryIso(first.destination);
          }
        }
      } catch (error) {
        console.error("Error fetching dashboard data", error);
      }
    };
    fetchData();

    // Set up user activity tracking
    const trackUserActivity = async () => {
      try {
        console.log("🔄 Starting user activity tracking...");
        
        // Try to get token from cookies
        const token = document.cookie
          .split("; ")
          .find((row) => row.startsWith("token="))
          ?.split("=")[1];
        
        console.log("🍪 Token from cookies:", token ? "Token found" : "No token found");
        if (token) {
          console.log("🔑 Token preview:", token.substring(0, 20) + "...");
        }

        if (token) {
          console.log("📡 Sending activity update to /api/user-activity");
          const response = await fetch("/api/user-activity", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ token }),
          });
          
          console.log("📡 Activity update response status:", response.status);
          if (response.ok) {
            const result = await response.json();
            console.log("✅ Activity update successful:", result);
          } else {
            console.log("❌ Activity update failed:", response.status, response.statusText);
          }
        } else {
          console.log("⚠️ No token found, skipping activity update");
        }
      } catch (error) {
        console.error("❌ Error tracking user activity:", error);
      }
    };

    // Track activity immediately
    trackUserActivity();

    // Set up periodic activity tracking (every 2 minutes)
    const activityInterval = setInterval(trackUserActivity, 2 * 60 * 1000);

    // Cleanup interval on unmount
    return () => clearInterval(activityInterval);
  }, []);


  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#FF6B9D', '#C77DFF', '#FFA500', '#00CED1', '#FF1493', '#32CD32', '#FF4500'];

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 p-3 sm:p-4 md:p-6">
      <div className="max-w-[95%] xl:max-w-[98%] 2xl:max-w-[99%] mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-6 md:mb-8"
        >
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-800 dark:text-white mb-2">
            Dashboard Overview
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
            Welcome back! Here's what's happening with your logistics business today.
          </p>
        </motion.div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-6 md:mb-8">
          <MetricCard
            title="Total Revenue"
            value={data.totalRevenue.toLocaleString()}
            change={data.percentageChanges?.revenuePercentageChange || 0}
            icon={<DollarSign className="w-5 h-5 sm:w-6 sm:h-6" />}
            bgColor="bg-gradient-to-r from-green-500 to-emerald-600"
            iconColor="text-white"
            currentMonth={(data.currentMonthData?.revenue || 0).toLocaleString()}
          />
          <MetricCard
            title="Receivables"
            value={data.accountsData.accountsReceivable.toLocaleString()}
            change={data.percentageChanges?.revenuePercentageChange || 0}
            icon={<DollarSign className="w-5 h-5 sm:w-6 sm:h-6" />}
            bgColor="bg-gradient-to-r from-orange-500 to-red-600"
            iconColor="text-white"
            onClick={() => setShowReceivableModal(true)}
            currentMonth={(data.currentMonthData?.accountsReceivable || 0).toLocaleString()}
          />
          <MetricCard
            title="Total Shipments"
            value={data.totalShipments.toLocaleString()}
            change={data.percentageChanges?.shipmentPercentageChange || 0}
            icon={<Truck className="w-5 h-5 sm:w-6 sm:h-6" />}
            bgColor="bg-gradient-to-r from-blue-500 to-indigo-600"
            iconColor="text-white"
            currentMonth={(data.currentMonthData?.shipments || 0).toLocaleString()}
          />
          <MetricCard
            title="Total Customers"
            value={data.totalCustomers.toLocaleString()}
            change={data.percentageChanges?.customerPercentageChange || 0}
            icon={<Users className="w-5 h-5 sm:w-6 sm:h-6" />}
            bgColor="bg-gradient-to-r from-purple-500 to-pink-600"
            iconColor="text-white"
            onClick={() => setShowCustomersModal(true)}
            currentMonth={(data.currentMonthData?.customers || 0).toLocaleString()}
          />
        </div>


        {/* Accounts Payable vs Receivable Chart - First Chart */}
        <div className="mb-6 md:mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-white">
                Accounts Payable vs Receivable Trend
              </h3>
              <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500" />
            </div>
            <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
              <AreaChart
                data={data.accountsData?.monthlyAccountsData || []}
                margin={{ top: 8, right: 12, left: 4, bottom: 4 }}
              >
                <defs>
                  <linearGradient id="colorReceivable" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.1}/>
                  </linearGradient>
                  <linearGradient id="colorPayable" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                <XAxis dataKey="month" stroke="#6B7280" fontSize={12} />
                <YAxis
                  stroke="#6B7280"
                  fontSize={11}
                  width={52}
                  tickFormatter={formatAccountsTrendAxis}
                  tickMargin={6}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1F2937', 
                    border: 'none', 
                    borderRadius: '8px',
                    color: '#F9FAFB',
                    fontSize: '12px'
                  }}
                  formatter={(value, name) => {
                    const n = typeof value === "number" ? value : Number(value);
                    return [
                      n.toLocaleString(),
                      name === "receivable" ? "Receivable" : "Payable",
                    ];
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="receivable" 
                  stroke="#10B981" 
                  strokeWidth={3}
                  fill="url(#colorReceivable)" 
                  name="receivable"
                />
                <Area 
                  type="monotone" 
                  dataKey="payable" 
                  stroke="#EF4444" 
                  strokeWidth={3}
                  fill="url(#colorPayable)" 
                  name="payable"
                />
              </AreaChart>
            </ResponsiveContainer>
            <div className="mt-3 sm:mt-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400 text-center">
              Green: Accounts Receivable (Money owed to you) | Red: Accounts Payable (Money you owe)
            </div>
          </motion.div>
        </div>


        {/* Additional Charts */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 md:gap-8 mb-6 md:mb-8 items-stretch">
          {/* Monthly Shipments vs Revenue */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 flex flex-col"
          >
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-white">
                Shipments vs Revenue
              </h3>
              <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500" />
            </div>
            <div className="flex-1 min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthlyShipments} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                  <XAxis
                    dataKey="month"
                    stroke="#6B7280"
                    fontSize={12}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis yAxisId="left" stroke="#6B7280" fontSize={12} />
                  <YAxis yAxisId="right" orientation="right" stroke="#6B7280" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1F2937', 
                      border: 'none', 
                      borderRadius: '8px',
                      color: '#F9FAFB',
                      fontSize: '12px'
                    }}
                  />
                  <Bar yAxisId="left" dataKey="shipments" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={3} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Shipments and Revenue by Country */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 flex flex-col"
          >
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-white">
                Shipments and Revenue by Country
              </h3>
              <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
            </div>
            {data.revenueByDestination && data.revenueByDestination.length > 0 && data.revenueByDestination[0].destination !== "No Data" && (data.revenueByDestination.some(d => d.revenue > 0) || data.revenueByDestination.some(d => d.shipments > 0)) ? (
              <div className="space-y-3">
                <CountryRevenueMap
                  data={data.revenueByDestination
                    .filter(d => d.destination && d.destination !== "No Data")}
                  onHoverCountry={setSelectedCountryIso}
                  onClickCountry={(info) => setSelectedCountryIso(info?.iso || null)}
                  onFullscreen={() => setMapFullscreen(true)}
                />

              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-500 dark:text-gray-400">
                <div className="text-center">
                  <DollarSign className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>No data available</p>
                  <p className="text-sm">Check if you have shipments and invoices in your database</p>
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* Fullscreen Map Modal */}
        {mapFullscreen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-8">
            <div className="relative w-full max-w-5xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                  Shipments and Revenue by Country
                </h3>
                <button
                  onClick={() => setMapFullscreen(false)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
              <CountryRevenueMap
                data={data.revenueByDestination
                  .filter(d => d.destination && d.destination !== "No Data")}
                onHoverCountry={setSelectedCountryIso}
                onClickCountry={(info) => setSelectedCountryIso(info?.iso || null)}
              />
            </div>
          </div>
        )}

        {/* Top Customers Chart */}
        <div className="mb-6 md:mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-white">
                Top Customers
              </h3>
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
            </div>
            <ResponsiveContainer width="100%" height={400} className="sm:h-[450px]">
              <BarChart data={data.topCustomers.slice(0, 25)} margin={{ top: 5, right: 30, left: 0, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                <XAxis 
                  dataKey="customer" 
                  stroke="#6B7280" 
                  angle={-45} 
                  textAnchor="end" 
                  height={50} 
                  fontSize={10}
                  interval={0}
                />
                <YAxis yAxisId="left" stroke="#6B7280" fontSize={12} />
                <YAxis yAxisId="right" orientation="right" stroke="#6B7280" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1F2937', 
                    border: 'none', 
                    borderRadius: '8px',
                    color: '#F9FAFB',
                    fontSize: '12px'
                  }}
                  formatter={(value, name) => [
                    name === 'shipments' ? value : value.toLocaleString(),
                    name === 'shipments' ? 'Shipments' : name === 'totalSpent' ? 'Total Spent' : 'Avg Order Value'
                  ]}
                  labelFormatter={(label) => label}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const customer = data.topCustomers.find(c => c.customer === label);
                      const formattedDate = customer?.lastShipmentDate 
                        ? new Date(customer.lastShipmentDate).toLocaleDateString('en-GB', { 
                            year: '2-digit', 
                            month: '2-digit', 
                            day: '2-digit' 
                          }).split('/').join('/')
                        : null;
                      
                      return (
                        <div style={{
                          backgroundColor: '#1F2937',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '12px',
                          color: '#F9FAFB',
                          fontSize: '12px'
                        }}>
                          <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>
                            {label}
                          </div>
                          {payload.map((entry: any, index: number) => (
                            <div key={index} style={{ marginBottom: '4px' }}>
                              <span style={{ color: entry.color }}>
                                {entry.name === 'shipments' ? 'Shipments' : entry.name === 'totalSpent' ? 'Total Spent' : 'Avg Order Value'}:{' '}
                                {entry.name === 'shipments' ? entry.value : entry.value.toLocaleString()}
                              </span>
                            </div>
                          ))}
                          {formattedDate && (
                            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #374151', fontSize: '11px', color: '#9CA3AF' }}>
                              Last Shipment: {formattedDate}
                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar yAxisId="left" dataKey="shipments" fill="#10B981" radius={[4, 4, 0, 0]} name="shipments" />
                <Line yAxisId="right" type="monotone" dataKey="totalSpent" stroke="#F59E0B" strokeWidth={3} name="totalSpent" />
                <Line yAxisId="right" type="monotone" dataKey="avgOrderValue" stroke="#EF4444" strokeWidth={2} name="avgOrderValue" />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 sm:mt-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400 text-center">
              Shipments (bars), Total Spent (orange line), Avg Order Value (red line)
            </div>
          </motion.div>
        </div>

        {/* Recent Activity Table - Tabbed Interface */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div className="flex items-center gap-2">
              {/* Tab Navigation */}
              <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('shipments')}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 flex items-center gap-2 ${
                    activeTab === 'shipments'
                      ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                  }`}
                >
                  <Package className="w-4 h-4" />
                  Recent Shipments
                </button>
                <button
                  onClick={() => setActiveTab('payments')}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 flex items-center gap-2 ${
                    activeTab === 'payments'
                      ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                  }`}
                >
                  <DollarSign className="w-4 h-4" />
                  Recent Payments
                </button>
              </div>
            </div>
            <button
              onClick={() => {
                if (activeTab === 'shipments') {
                  router.push('/dashboard/shipments?status=All');
                } else {
                  router.push('/dashboard/accounts/payments?type=All');
                }
              }}
              className="px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-md transition-all duration-200 flex items-center gap-2"
            >
              View All
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>

          {/* Tab Content */}
          <div className="overflow-x-auto">
            {activeTab === 'shipments' ? (
              /* Shipments Table */
              <table className="min-w-full table-auto border-separate border-spacing-y-2 sm:border-spacing-y-4">
                <thead>
                  <tr className="text-xs sm:text-sm text-gray-500 dark:text-gray-300">
                    <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">Date</th>
                    <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">Booking#</th>
                    <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">Sender</th>
                    <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">Receiver</th>
                    <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">Country</th>
                    <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">Type</th>
                    <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">Pcs</th>
                    <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">Weight</th>
                    <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">Tracking</th>
                    <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">Status</th>
                    <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">Total Cost</th>
                    <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">Invoice Status</th>
                  </tr>
                </thead>
                <tbody className="text-xs sm:text-sm text-gray-700 dark:text-gray-200 font-light">
                  {data.recentShipments.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="px-2 sm:px-3 lg:px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                        No recent shipments found.
                      </td>
                    </tr>
                  ) : (
                    data.recentShipments.map((shipment, index) => (
                      <motion.tr
                        key={shipment.id}
                        className="bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                      >
                        <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                          {new Date(shipment.shipmentDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                        </td>
                        <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                          <button
                            onClick={() => router.push(`/dashboard/shipments/${shipment.id}`)}
                            className="font-bold text-blue-600 hover:text-white hover:bg-blue-600 px-2 py-1 rounded transition-colors duration-200 cursor-pointer"
                          >
                            {shipment.invoiceNumber}
                          </button>
                        </td>
                        <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                          <span className="hidden sm:inline">{shipment.senderName}</span>
                          <span className="sm:hidden">{shipment.senderName?.substring(0, 10)}...</span>
                        </td>
                        <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                          <span className="hidden sm:inline">{shipment.recipientName}</span>
                          <span className="sm:hidden">{shipment.recipientName?.substring(0, 10)}...</span>
                        </td>
                        <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                          <span className="hidden sm:inline">{shipment.destination}</span>
                          <span className="sm:hidden">{shipment.destination?.substring(0, 8)}...</span>
                        </td>
                        <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">{shipment.packaging || "N/A"}</td>
                        <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">{shipment.amount || 1}</td>
                        <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">{shipment.totalWeight || 0}</td>
                        <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                          {getTrackingUrl(shipment) ? (
                            <a
                              href={getTrackingUrl(shipment)!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-bold text-purple-600 hover:text-white hover:bg-purple-600 px-2 py-1 rounded transition-colors duration-200 cursor-pointer inline-block"
                            >
                              <span className="hidden sm:inline">{shipment.trackingId}</span>
                              <span className="sm:hidden">{shipment.trackingId?.substring(0, 8)}...</span>
                            </a>
                          ) : (
                            <button
                              onClick={() => router.push(`/dashboard/shipments/${shipment.id}`)}
                              className="font-bold text-purple-600 hover:text-white hover:bg-purple-600 px-2 py-1 rounded transition-colors duration-200 cursor-pointer"
                            >
                              <span className="hidden sm:inline">{shipment.trackingId}</span>
                              <span className="sm:hidden">{shipment.trackingId?.substring(0, 8)}...</span>
                            </button>
                          )}
                        </td>
                        <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                          <span
                            className={`px-1 sm:px-2 py-1 rounded text-xs font-medium ${getDeliveryStatusColor(
                              shipment.status
                            )}`}
                          >
                            <span className="hidden sm:inline">
                              {shipment.status || "N/A"}
                            </span>
                            <span className="sm:hidden">
                              {shipment.status?.substring(0, 3) || "N/A"}
                            </span>
                          </span>
                        </td>
                        <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                          <span className="hidden sm:inline">{shipment.totalCost.toLocaleString()}</span>
                          <span className="sm:hidden">{shipment.totalCost.toLocaleString()}</span>
                        </td>
                        <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                          <span
                            className={`px-1 sm:px-2 py-1 rounded text-xs font-medium ${getInvoiceColor(
                              shipment.invoiceStatus
                            )}`}
                          >
                            <span className="hidden sm:inline">
                              {shipment.invoiceStatus || "N/A"}
                            </span>
                            <span className="sm:hidden">
                              {shipment.invoiceStatus?.substring(0, 3) || "N/A"}
                            </span>
                          </span>
                        </td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              /* Payments Table */
              <table className="min-w-full table-auto border-separate border-spacing-y-2 sm:border-spacing-y-4">
                <thead>
                  <tr className="text-xs sm:text-sm text-gray-500 dark:text-gray-300">
                    <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">Date</th>
                    <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">Type</th>
                    <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">Party</th>
                    <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">Category</th>
                    <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">Description</th>
                    <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">Reference</th>
                    <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">Invoice</th>
                    <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">Amount</th>
                    <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">Mode</th>
                  </tr>
                </thead>
                <tbody className="text-xs sm:text-sm text-gray-700 dark:text-gray-200 font-light">
                  {data.recentPayments.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-2 sm:px-3 lg:px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                        No recent payments found.
                      </td>
                    </tr>
                  ) : (
                    data.recentPayments.map((payment, index) => (
                      <motion.tr
                        key={payment.id}
                        className="bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                      >
                        <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                          {new Date(payment.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                        </td>
                        <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              payment.type === 'INCOME' 
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                : payment.type === 'EXPENSE'
                                ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                            }`}
                          >
                            {payment.type}
                          </span>
                        </td>
                        <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                          <div>
                            <div className="font-medium">{payment.partyName}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{payment.partyType}</div>
                          </div>
                        </td>
                        <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                          <span className="hidden sm:inline">{payment.category || 'N/A'}</span>
                          <span className="sm:hidden">{payment.category?.substring(0, 8) || 'N/A'}</span>
                        </td>
                        <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                          <span className="hidden sm:inline">{payment.description}</span>
                          <span className="sm:hidden">{payment.description?.substring(0, 15)}...</span>
                        </td>
                        <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                          <span className="hidden sm:inline">{payment.reference}</span>
                          <span className="sm:hidden">{payment.reference?.substring(0, 8)}...</span>
                        </td>
                        <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                          <span className="hidden sm:inline">{payment.invoice}</span>
                          <span className="sm:hidden">{payment.invoice?.substring(0, 8)}...</span>
                        </td>
                        <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3 font-bold">
                          <span className={payment.type === 'INCOME' ? 'text-green-600' : 'text-red-600'}>
                            {payment.amount.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3 text-gray-600 dark:text-gray-400">
                          <span className="hidden sm:inline">{payment.paymentMode || 'N/A'}</span>
                          <span className="sm:hidden">{payment.paymentMode?.substring(0, 4) || 'N/A'}</span>
                        </td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </motion.div>
      </div>

      {/* Accounts Receivable Modal */}
      {showReceivableModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setShowReceivableModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                  Accounts Receivable Details
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Customers who owe you money
                </p>
              </div>
              <button
                onClick={() => setShowReceivableModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-200 dark:border-green-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-green-600 dark:text-green-400">Total Receivable</p>
                      <p className="text-2xl font-bold text-green-800 dark:text-green-200">
                        {data.accountsData.accountsReceivable.toLocaleString()}
                      </p>
                    </div>
                    <DollarSign className="w-8 h-8 text-green-600" />
                  </div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-600 dark:text-blue-400">Customers with Balances</p>
                      <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">
                        {data.topCustomers.filter(c => c.currentBalance < 0).length}
                      </p>
                    </div>
                    <Users className="w-8 h-8 text-blue-600" />
                  </div>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-xl border border-orange-200 dark:border-orange-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-orange-600 dark:text-orange-400">Largest Balance</p>
                      <p className="text-2xl font-bold text-orange-800 dark:text-orange-200">
                        {data.topCustomers.filter(c => c.currentBalance < 0).length > 0 
                          ? Math.abs(Math.min(...data.topCustomers.filter(c => c.currentBalance < 0).map(c => c.currentBalance))).toLocaleString()
                          : '0'
                        }
                      </p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-orange-600" />
                  </div>
                </div>
              </div>

              {/* Customer Receivables Table */}
              <div className="bg-white dark:bg-slate-700 rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-600">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                    Customer Outstanding Balances
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-slate-600">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">
                          Customer
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">
                          Total spent
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">
                          Shipments
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">
                          Avg order value
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">
                          Outstanding
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-700 divide-y divide-gray-200 dark:divide-gray-600">
                      {data.topCustomers
                        .filter(customer => customer.currentBalance < 0)
                        .sort((a, b) => a.currentBalance - b.currentBalance) // Sort by most negative first (most owed)
                        .map((customer, index) => (
                          <tr key={index} className="hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {customer.customer}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900 dark:text-white font-medium">
                                {customer.totalSpent.toLocaleString()}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {customer.shipments}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {customer.avgOrderValue.toLocaleString()}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-red-600 dark:text-red-400">
                                {Math.abs(customer.currentBalance).toLocaleString()}
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Customers Modal */}
      {showCustomersModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setShowCustomersModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                  Customer Overview
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Active and inactive customer breakdown
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.location.href = '/dashboard/customers/inactive'}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Users className="w-4 h-4" />
                  Check Inactive
                </button>
                <button
                  onClick={() => setShowCustomersModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-purple-600 dark:text-purple-400">Total Customers</p>
                      <p className="text-2xl font-bold text-purple-800 dark:text-purple-200">
                        {data.totalCustomers.toLocaleString()}
                      </p>
                    </div>
                    <Users className="w-8 h-8 text-purple-600" />
                  </div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-200 dark:border-green-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-green-600 dark:text-green-400">Active Customers</p>
                      <p className="text-2xl font-bold text-green-800 dark:text-green-200">
                        {data.activeCustomers.toLocaleString()}
                      </p>
                    </div>
                    <Activity className="w-8 h-8 text-green-600" />
                  </div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-200 dark:border-red-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-red-600 dark:text-red-400">Inactive Customers</p>
                      <p className="text-2xl font-bold text-red-800 dark:text-red-200">
                        {data.inactiveCustomers.toLocaleString()}
                      </p>
                    </div>
                    <Users className="w-8 h-8 text-red-600" />
                  </div>
                </div>
              </div>

              {/* Customer Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-slate-700 rounded-xl border border-gray-200 dark:border-gray-600 p-6">
                  <h4 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                    Customer Activity Rate
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Active Rate</span>
                      <span className="text-lg font-bold text-green-600">
                        {data.totalCustomers > 0 ? ((data.activeCustomers / data.totalCustomers) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${data.totalCustomers > 0 ? (data.activeCustomers / data.totalCustomers) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-700 rounded-xl border border-gray-200 dark:border-gray-600 p-6">
                  <h4 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                    Customer Status Summary
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">Active</span>
                      </div>
                      <span className="text-lg font-bold text-gray-800 dark:text-white">
                        {data.activeCustomers}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">Inactive</span>
                      </div>
                      <span className="text-lg font-bold text-gray-800 dark:text-white">
                        {data.inactiveCustomers}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                <div className="flex items-start">
                  <div className="shrink-0">
                    <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      Customer Status Information
                    </h3>
                    <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                      <p>
                        Active customers are those with "Active" status in the system. Inactive customers 
                        have been marked as "Inactive" and may require attention or reactivation.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

const MetricCard = ({ title, value, change, icon, bgColor, iconColor, onClick, currentMonth }: {
  title: string | React.ReactNode;
  value: string | number;
  change: number;
  icon: React.ReactNode;
  bgColor: string;
  iconColor: string;
  onClick?: () => void;
  currentMonth?: string | number;
}) => {
  // Helper function to get light background color based on bgColor
  const getLightBgColor = () => {
    if (bgColor.includes('green')) return 'bg-green-100 dark:bg-green-900/20';
    if (bgColor.includes('orange') || bgColor.includes('red')) return 'bg-red-100 dark:bg-red-900/20';
    if (bgColor.includes('blue')) return 'bg-blue-100 dark:bg-blue-900/20';
    if (bgColor.includes('purple')) return 'bg-purple-100 dark:bg-purple-900/20';
    return 'bg-gray-100 dark:bg-gray-900/20';
  };

  // Helper function to get text color based on bgColor
  const getTextColor = () => {
    if (bgColor.includes('green')) return 'text-green-700 dark:text-green-300';
    if (bgColor.includes('orange') || bgColor.includes('red')) return 'text-red-700 dark:text-red-300';
    if (bgColor.includes('blue')) return 'text-blue-700 dark:text-blue-300';
    if (bgColor.includes('purple')) return 'text-purple-700 dark:text-purple-300';
    return 'text-gray-700 dark:text-gray-300';
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`relative bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all duration-300 ${onClick ? 'cursor-pointer hover:scale-105' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center mb-3 sm:mb-4 relative">
        <div className="flex items-center gap-3 sm:gap-4 flex-1">
          <div className={`${bgColor} ${iconColor} p-2 sm:p-3 rounded-lg sm:rounded-xl`}>{icon}</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1 pr-16 sm:pr-20 truncate">{title}</p>
            <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">{value}</h3>
          </div>
        </div>
        <div className="absolute top-0 right-0">
          <div className={`flex items-center text-xs sm:text-sm font-medium ${
            change >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {change >= 0 ? <ArrowUpRight className="w-3 h-3 sm:w-4 sm:h-4 mr-1" /> : <ArrowDownRight className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />}
            {Math.abs(change)}%
          </div>
        </div>
      </div>
      <div>
        {currentMonth !== undefined && (
          <div className="mt-3 flex items-center justify-end gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Since last month</span>
            <div className={`px-3 py-1.5 rounded-full ${getLightBgColor()} ${getTextColor()}`}>
              <span className="text-sm font-semibold">
                {typeof currentMonth === 'number' ? currentMonth.toLocaleString() : currentMonth}
              </span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

const PerformanceCard = ({ title, value, icon, color, bgColor }: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
    className={`${bgColor} p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-transparent hover:shadow-lg transition-all duration-300`}
  >
    <div className="flex items-center gap-2 sm:gap-3">
      <div className={`${color} p-2 rounded-lg bg-white dark:bg-slate-700`}>{icon}</div>
      <div>
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">{title}</p>
        <h3 className={`text-base sm:text-lg lg:text-xl font-bold ${color}`}>{value}</h3>
      </div>
    </div>
  </motion.div>
);

const StatusBadge = ({ status }: { status: string }) => {
  const getStatusStyle = (status: string) => {
    switch (status) {
      case "Delivered":
        return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 border-green-200 dark:border-green-800";
      case "Out for Delivery":
        return "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800";
      case "Arrived at Destination":
        return "bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-400 border-teal-200 dark:border-teal-800";
      case "In Transit":
        return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 border-blue-200 dark:border-blue-800";
      case "Pending":
        return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800";
      default:
        return "bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-800";
    }
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusStyle(status)}`}>
      {status}
    </span>
  );
};

const getInvoiceColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case "unpaid":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    case "paid":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case "partial":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    case "overdue":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "cancelled":
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
  }
};

const getDeliveryStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case "delivered":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case "in_transit":
    case "in transit":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    case "processing":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "in_warehouse":
    case "in warehouse":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
    case "cancelled":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
  }
};

export default DashboardPage;
