import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getCountryNameFromCode } from "@/lib/utils";
import { computeMonthlyPartyNetsUsingVoucherDates } from "@/lib/accounts/dashboardVoucherBalances";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    
    // Test basic database connectivity and data
    console.log('=== TESTING DATABASE CONNECTIVITY ===');
    const testShipment = await prisma.shipment.findFirst();
    const testCustomer = await prisma.customers.findFirst();
    const testInvoice = await prisma.invoice.findFirst();
    
    console.log('Test Data:', {
      hasShipments: !!testShipment,
      hasCustomers: !!testCustomer,
      hasInvoices: !!testInvoice,
      sampleShipment: testShipment ? { id: testShipment.id, destination: testShipment.destination } : null,
      sampleCustomer: testCustomer ? { id: testCustomer.id, CompanyName: testCustomer.CompanyName } : null,
      sampleInvoice: testInvoice ? { id: testInvoice.id, destination: testInvoice.destination, totalAmount: testInvoice.totalAmount } : null
    });
    console.log('=== END TESTING ===');
    
    // Get total shipments
    const totalShipments = await prisma.shipment.count();
    
    // Get total users
    const totalUsers = await prisma.user.count();
    
    // Get total customers
    const totalCustomers = await prisma.customers.count();
    
    // Get active customers (customers with ActiveStatus = "Active")
    const activeCustomers = await prisma.customers.count({
      where: {
        ActiveStatus: "Active"
      }
    });
    
    // Get inactive customers (customers with ActiveStatus = "Inactive")
    const inactiveCustomers = await prisma.customers.count({
      where: {
        ActiveStatus: "Inactive"
      }
    });
    
    // Get currently active users (users active in the last 30 minutes)
    // We'll implement a simple activity tracking system
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    
    // Try to get active users from the user activity endpoint
    let activeUsers = 0;
    
    try {
      console.log("🔄 Attempting to call user-activity endpoint...");
      const activityUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/user-activity`;
      console.log("🌐 Calling URL:", activityUrl);
      
      // Call the user activity endpoint to get current active users
      const activityResponse = await fetch(activityUrl);
      console.log("📡 Activity response status:", activityResponse.status);
      console.log("📡 Activity response ok:", activityResponse.ok);
      
      if (activityResponse.ok) {
        const activityData = await activityResponse.json();
        console.log("✅ Activity data received:", activityData);
        activeUsers = activityData.activeUsers || 0;
        console.log("👥 Active users from endpoint:", activeUsers);
      } else {
        console.log("❌ Activity endpoint failed, falling back to status-based counting");
        // Fallback: count users with ACTIVE status
        activeUsers = await prisma.user.count({
          where: {
            status: "ACTIVE"
          }
        });
        console.log("👥 Fallback active users count:", activeUsers);
      }
    } catch (error) {
      console.log("❌ User activity tracking error:", error);
      console.log("🔄 Falling back to status-based counting");
      // Fallback: count users with ACTIVE status
      activeUsers = await prisma.user.count({
        where: {
          status: "ACTIVE"
        }
      });
      console.log("👥 Fallback active users count:", activeUsers);
    }
    
    // If no active users found, fall back to total users
    if (activeUsers === 0) {
      activeUsers = totalUsers;
    }
    
    // Use activeUsers if we have them, otherwise fall back to totalUsers
    const currentActiveUsers = activeUsers > 0 ? activeUsers : totalUsers;
    
    // Get total revenue from customer invoices
    const totalRevenueResult = await prisma.invoice.aggregate({
      where: {
        customerId: { not: null }, // Only customer invoices
        status: { not: "Cancelled" }
      },
      _sum: {
        totalAmount: true
      }
    });
    const totalRevenue = totalRevenueResult._sum.totalAmount || 0;
    
    // Get new orders (shipments with shipment date this month)
    const newOrders = await prisma.shipment.count({
      where: {
        shipmentDate: {
          gte: new Date(currentYear, currentMonth, 1),
          lt: new Date(currentYear, currentMonth + 1, 1)
        }
      }
    });
    
    // Get monthly earnings for the current year (using shipmentDate from related shipments)
    const monthlyEarnings = [];
    for (let month = 0; month < 12; month++) {
      const startDate = new Date(currentYear, month, 1);
      const endDate = new Date(currentYear, month + 1, 1);
      
      // Get invoices with their related shipments, then filter by shipmentDate
      const invoices = await prisma.invoice.findMany({
        where: {
          customerId: { not: null },
          status: { not: "Cancelled" },
          shipment: {
            shipmentDate: {
              gte: startDate,
              lt: endDate
            }
          }
        },
        select: {
          totalAmount: true
        }
      });
      
      const monthRevenue = invoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
      
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      monthlyEarnings.push({
        month: monthNames[month],
        earnings: monthRevenue
      });
    }
    
    // Get recent shipments with real data (ordered by shipmentDate)
    const recentShipments = await prisma.shipment.findMany({
      take: 10,
      orderBy: {
        shipmentDate: 'desc'
      },
      select: {
        id: true,
        trackingId: true,
        invoiceNumber: true,
        senderName: true,
        recipientName: true,
        destination: true,
        totalCost: true,
        deliveryStatus: true,
        invoiceStatus: true,
        packaging: true,
        amount: true,
        totalWeight: true,
        weight: true,
        shipmentDate: true,
        createdAt: true,
        serviceMode: true
      }
    });
    
    // Get invoice statuses for all shipments
    const invoiceNumbers = recentShipments.map(s => s.invoiceNumber).filter(Boolean);
    const invoices = await prisma.invoice.findMany({
      where: {
        invoiceNumber: {
          in: invoiceNumbers
        }
      },
      select: {
        invoiceNumber: true,
        status: true
      }
    });
    
    // Create a map of invoiceNumber -> status for quick lookup
    const invoiceStatusMap = new Map(
      invoices.map(inv => [inv.invoiceNumber, inv.status])
    );
    
    // Transform recent shipments to match expected format
    const transformedRecentShipments = recentShipments.map(shipment => {
      // Get invoice status from Invoice table, fallback to shipment's invoiceStatus, then "Unpaid"
      const invoiceStatus = invoiceStatusMap.get(shipment.invoiceNumber) 
        || shipment.invoiceStatus 
        || "Unpaid";
      
      // Convert country code to full country name
      const destinationCountry = shipment.destination 
        ? getCountryNameFromCode(shipment.destination) 
        : shipment.destination || "N/A";
      
      return {
        id: shipment.id,
        trackingId: shipment.trackingId,
        invoiceNumber: shipment.invoiceNumber,
        senderName: shipment.senderName,
        recipientName: shipment.recipientName,
        destination: destinationCountry,
        totalCost: shipment.totalCost,
        status: shipment.deliveryStatus || "Pending",
        invoiceStatus: invoiceStatus,
        packaging: shipment.packaging || "N/A",
        amount: shipment.amount || 1,
        totalWeight: shipment.totalWeight || shipment.weight || 0,
        shipmentDate: shipment.shipmentDate || shipment.createdAt,
        createdAt: shipment.createdAt.toISOString(),
        serviceMode: shipment.serviceMode
      };
    });
    
    // Get recent payments from the main Payment table
    const recentPayments = await prisma.payment.findMany({
      take: 10,
      orderBy: {
        date: 'desc'
      },
      select: {
        id: true,
        transactionType: true,
        amount: true,
        description: true,
        reference: true,
        invoice: true,
        date: true,
        category: true,
        mode: true,
        fromPartyType: true,
        fromCustomer: true,
        toPartyType: true,
        toVendor: true
      }
    });
    
    // Transform payments to match expected format
    const transformedPayments = recentPayments.map(payment => {
      // Determine party name and type based on transaction type
      let partyName = '';
      let partyType = '';
      
      if (payment.transactionType === 'INCOME') {
        // Income means money coming in (from customer to us)
        partyName = payment.fromCustomer || 'Customer';
        partyType = 'Customer';
      } else if (payment.transactionType === 'EXPENSE') {
        // Expense means money going out (from us to vendor)
        partyName = payment.toVendor || 'Vendor';
        partyType = 'Vendor';
      } else {
        // For other transaction types, show both parties
        partyName = `${payment.fromCustomer || 'N/A'} → ${payment.toVendor || 'N/A'}`;
        partyType = 'Transfer';
      }
      
      return {
        id: payment.id,
        type: payment.transactionType,
        amount: payment.amount,
        description: payment.description || payment.category || 'Payment',
        reference: payment.reference || 'N/A',
        invoice: payment.invoice || 'N/A',
        previousBalance: 0, // Not available in Payment model
        newBalance: 0, // Not available in Payment model
        partyName: partyName,
        partyType: partyType,
        paymentMode: payment.mode || 'N/A',
        category: payment.category,
        createdAt: payment.date.toISOString()
      };
    });
    
    // Get shipment status distribution
    const shipmentStatuses = await prisma.shipment.groupBy({
      by: ['deliveryStatus'],
      _count: {
        id: true
      }
    });
    
    const shipmentStatusDistribution = shipmentStatuses.map(status => ({
      status: status.deliveryStatus || "Pending",
      count: status._count.id,
      color: getStatusColor(status.deliveryStatus || "Pending")
    }));
    
    // Get revenue by destination with shipments - all countries
    const allDestinationsForRevenue = await prisma.shipment.groupBy({
      by: ['destination'],
      _count: {
        id: true
      }
    });
    
    const topDestinationsForRevenue = allDestinationsForRevenue
      .filter(dest => dest.destination && dest.destination.trim() !== "")
      .sort((a, b) => b._count.id - a._count.id);
    
    // Calculate revenue for each destination using shipment-invoice relationship
    const revenueByDestinationWithRevenue = await Promise.all(
      topDestinationsForRevenue.map(async (dest) => {
        // Get shipments with this destination
        const shipmentsWithDestination = await prisma.shipment.findMany({
          where: {
            destination: dest.destination
          },
          select: {
            id: true,
            invoiceNumber: true
          }
        });
        
        // Get invoices for these shipments using shipmentId relationship
        const shipmentIds = shipmentsWithDestination.map(s => s.id);
        
        let destinationRevenue = 0;
        if (shipmentIds.length > 0) {
          const revenueResult = await prisma.invoice.aggregate({
            where: {
              shipmentId: {
                in: shipmentIds
              },
              customerId: { not: null },
              status: { not: "Cancelled" }
            },
            _sum: {
              totalAmount: true
            }
          });
          destinationRevenue = revenueResult._sum.totalAmount || 0;
        }
        
        return {
          destination: dest.destination,
          revenue: destinationRevenue,
          shipments: dest._count.id
        };
      })
    );
    
    const transformedRevenueByDestination = revenueByDestinationWithRevenue
      .sort((a, b) => b.revenue - a.revenue);
    
    // Get monthly shipments count for last 12 months (using shipmentDate)
    const monthlyShipments = [];
    const currentDate = new Date();
    const monthNamesShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    for (let i = 11; i >= 0; i--) {
      // Calculate the date for i months ago
      const targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      const endDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 1);
      
      const monthShipments = await prisma.shipment.count({
        where: {
          shipmentDate: {
            gte: startDate,
            lt: endDate
          }
        }
      });
      
      // Get revenue for invoices with shipments in this month (using shipmentDate)
      const invoices = await prisma.invoice.findMany({
        where: {
          customerId: { not: null },
          status: { not: "Cancelled" },
          shipment: {
            shipmentDate: {
              gte: startDate,
              lt: endDate
            }
          }
        },
        select: {
          totalAmount: true
        }
      });
      
      const monthRevenue = invoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
      
      monthlyShipments.push({
        month: `${monthNamesShort[targetDate.getMonth()]} ${targetDate.getFullYear().toString().slice(-2)}`,
        shipments: monthShipments,
        revenue: monthRevenue
      });
    }
    
    // Get top destinations with revenue - filter out null/empty destinations
    const allDestinations = await prisma.shipment.groupBy({
      by: ['destination'],
      _count: {
        id: true
      }
    });
    
    // Filter out null/empty destinations and sort by count
    const topDestinations = allDestinations
      .filter(dest => dest.destination && dest.destination.trim() !== "")
      .sort((a, b) => b._count.id - a._count.id)
      .slice(0, 5);
    
    // Calculate revenue for each destination using shipment-invoice relationship
    const topDestinationsWithRevenue = await Promise.all(
      topDestinations.map(async (dest) => {
        // Get revenue from invoices linked to shipments with this destination via shipmentId
        const shipmentsWithDestination = await prisma.shipment.findMany({
          where: {
            destination: dest.destination
          },
          select: {
            id: true,
            invoiceNumber: true
          }
        });
        
        // Get invoices for these shipments using shipmentId relationship
        const shipmentIds = shipmentsWithDestination.map(s => s.id);
        
        let destinationRevenue = 0;
        if (shipmentIds.length > 0) {
          const revenueResult = await prisma.invoice.aggregate({
            where: {
              shipmentId: {
                in: shipmentIds
              },
              customerId: { not: null },
              status: { not: "Cancelled" }
            },
            _sum: {
              totalAmount: true
            }
          });
          destinationRevenue = revenueResult._sum.totalAmount || 0;
        }
        
        return {
          destination: dest.destination,
          shipments: dest._count.id,
          revenue: destinationRevenue
        };
      })
    );
    
    const transformedTopDestinations = topDestinationsWithRevenue;
    
    // Get customer-destination relationship - show top customers and their preferred destinations
    const customerDestinationMap = await prisma.customers.findMany({
      select: {
        CompanyName: true,
        invoices: {
          where: {
            status: { not: "Cancelled" }
          },
          select: {
            destination: true,
            totalAmount: true
          }
        }
      },
      take: 8
    });
    
    const transformedCustomerDestinationMap = customerDestinationMap
      .filter(customer => customer.invoices.length > 0)
      .map(customer => {
        // Get the most frequent destination for this customer
        const destinationCounts = customer.invoices.reduce((acc, invoice) => {
          acc[invoice.destination] = (acc[invoice.destination] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        const preferredDestination = Object.entries(destinationCounts)
          .sort(([,a], [,b]) => b - a)[0]?.[0] || 'Unknown';
        
        return {
          customer: customer.CompanyName,
          destination: preferredDestination,
          shipments: customer.invoices.length
        };
      })
      .sort((a, b) => b.shipments - a.shipments)
      .slice(0, 8);
    
    // Get all customers with their invoices to calculate shipment counts
    const allCustomers = await prisma.customers.findMany({
      select: {
        CompanyName: true,
        currentBalance: true,
        invoices: {
          where: {
            status: { not: "Cancelled" }
          },
          select: {
            totalAmount: true,
            shipment: {
              select: {
                shipmentDate: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });
    
    // Calculate metrics for each customer and sort by shipment count
    const customersWithMetrics = await Promise.all(allCustomers.map(async (customer) => {
      const totalSpent = customer.invoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
      const shipments = customer.invoices.length;
      const avgOrderValue = shipments > 0 ? totalSpent / shipments : 0;
      
      // Get the last shipment date from all invoices with shipments
      // Find the most recent shipment date by checking all invoices
      let lastShipmentDate: Date | null = null;
      const shipmentDates: Date[] = [];
      
      for (const invoice of customer.invoices) {
        if (invoice.shipment?.shipmentDate) {
          shipmentDates.push(invoice.shipment.shipmentDate);
        }
      }
      
      // Get the most recent shipment date
      if (shipmentDates.length > 0) {
        lastShipmentDate = shipmentDates.reduce((latest, current) => {
          return current > latest ? current : latest;
        });
      }
      
      return {
        customer: customer.CompanyName,
        shipments,
        totalSpent,
        avgOrderValue,
        currentBalance: customer.currentBalance || 0,
        lastShipmentDate: lastShipmentDate ? lastShipmentDate.toISOString() : null
      };
    }));
    
    // Sort by shipment count (descending) and take top 25
    const transformedTopCustomers = customersWithMetrics
      .sort((a, b) => b.shipments - a.shipments)
      .slice(0, 25);
    
    // Calculate performance metrics
    const totalDelivered = await prisma.shipment.count({
      where: {
        deliveryStatus: "Delivered"
      }
    });
    
    const deliveryRate = totalShipments > 0 ? (totalDelivered / totalShipments) * 100 : 0;
    
    // Calculate average delivery time from actual delivery data
    let avgDeliveryTime = 0;
    if (totalDelivered > 0) {
      const deliveredShipments = await prisma.shipment.findMany({
        where: {
          deliveryStatus: "Delivered"
        },
        select: {
          createdAt: true,
          shipmentDate: true
        }
      });
      
      // Calculate average days between creation and shipment date
      const totalDays = deliveredShipments.reduce((sum, shipment) => {
        const shipmentDate = shipment.shipmentDate;
        const creationDate = shipment.createdAt;
        const daysDiff = Math.ceil((shipmentDate.getTime() - creationDate.getTime()) / (1000 * 60 * 60 * 24));
        return sum + Math.max(0, daysDiff); // Ensure non-negative
      }, 0);
      
      avgDeliveryTime = totalDays > 0 ? Math.round((totalDays / deliveredShipments.length) * 10) / 10 : 0;
    }
    
    // Calculate customer satisfaction based on delivery success rate
    let customerSatisfaction = 0;
    if (totalShipments > 0) {
      const failedShipments = await prisma.shipment.count({
        where: {
          deliveryStatus: "Failed"
        }
      });
      
      const successRate = ((totalShipments - failedShipments) / totalShipments) * 100;
      // Convert success rate to 5-star scale (90%+ = 5 stars, 80%+ = 4 stars, etc.)
      if (successRate >= 90) customerSatisfaction = 5.0;
      else if (successRate >= 80) customerSatisfaction = 4.5;
      else if (successRate >= 70) customerSatisfaction = 4.0;
      else if (successRate >= 60) customerSatisfaction = 3.5;
      else if (successRate >= 50) customerSatisfaction = 3.0;
      else customerSatisfaction = 2.5;
    }
    
    // Calculate revenue growth (comparing current month with previous month using shipmentDate)
    const currentMonthInvoices = await prisma.invoice.findMany({
      where: {
        customerId: { not: null },
        status: { not: "Cancelled" },
        shipment: {
          shipmentDate: {
            gte: new Date(currentYear, currentMonth, 1),
            lt: new Date(currentYear, currentMonth + 1, 1)
          }
        }
      },
      select: {
        totalAmount: true
      }
    });
    
    const previousMonthInvoices = await prisma.invoice.findMany({
      where: {
        customerId: { not: null },
        status: { not: "Cancelled" },
        shipment: {
          shipmentDate: {
            gte: new Date(currentYear, currentMonth - 1, 1),
            lt: new Date(currentYear, currentMonth, 1)
          }
        }
      },
      select: {
        totalAmount: true
      }
    });
    
    const currentMonthTotal = currentMonthInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const previousMonthTotal = previousMonthInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const revenueGrowth = previousMonthTotal > 0 ? ((currentMonthTotal - previousMonthTotal) / previousMonthTotal) * 100 : 0;
    
    // Calculate shipment growth rate (comparing current month with previous month using shipmentDate)
    const currentMonthShipments = await prisma.shipment.count({
      where: {
        shipmentDate: {
          gte: new Date(currentYear, currentMonth, 1),
          lt: new Date(currentYear, currentMonth + 1, 1)
        }
      }
    });
    
    const previousMonthShipments = await prisma.shipment.count({
      where: {
        shipmentDate: {
          gte: new Date(currentYear, currentMonth - 1, 1),
          lt: new Date(currentYear, currentMonth, 1)
        }
      }
    });
    
    const shipmentGrowth = previousMonthShipments > 0 ? ((currentMonthShipments - previousMonthShipments) / previousMonthShipments) * 100 : 0;
    
    // Calculate customer growth rate
    const currentMonthCustomers = await prisma.customers.count({
      where: {
        createdAt: {
          gte: new Date(currentYear, currentMonth, 1),
          lt: new Date(currentYear, currentMonth + 1, 1)
        }
      }
    });
    
    const previousMonthCustomers = await prisma.customers.count({
      where: {
        createdAt: {
          gte: new Date(currentYear, currentMonth - 1, 1),
          lt: new Date(currentYear, currentMonth, 1)
        }
      }
    });
    
    const customerGrowth = previousMonthCustomers > 0 ? ((currentMonthCustomers - previousMonthCustomers) / previousMonthCustomers) * 100 : 0;
    
    // Calculate accounts payable and receivable
    // Note: Customer balances are negative when they owe us money (accounts receivable)
    // Vendor balances are positive when we owe them money (accounts payable)
    const accountsReceivable = await prisma.customers.aggregate({
      _sum: {
        currentBalance: true
      }
    });
    
    const accountsPayable = await prisma.vendors.aggregate({
      _sum: {
        currentBalance: true
      }
    });
    
    // Calculate current month accounts receivable (from invoices created this month)
    const currentMonthReceivable = await prisma.invoice.aggregate({
      where: {
        customerId: { not: null },
        status: { not: "Cancelled" },
        createdAt: {
          gte: new Date(currentYear, currentMonth, 1),
          lt: new Date(currentYear, currentMonth + 1, 1)
        }
      },
      _sum: {
        totalAmount: true
      }
    });
    
    const currentMonthReceivableAmount = currentMonthReceivable._sum.totalAmount || 0;
    
    // Last 12 months: nets from ledger using voucher dates (shipment / payment / note dates), same rules as accounts transaction pages
    const currentDateForAccounts = new Date();
    const monthNamesForAccounts = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthSlices: { targetDate: Date; endExclusive: Date }[] = [];
    for (let i = 11; i >= 0; i--) {
      const targetDate = new Date(
        currentDateForAccounts.getFullYear(),
        currentDateForAccounts.getMonth() - i,
        1
      );
      const endExclusive = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 1);
      monthSlices.push({ targetDate, endExclusive });
    }

    const voucherMonthNets = await computeMonthlyPartyNetsUsingVoucherDates(
      prisma,
      monthSlices.map((s) => s.endExclusive)
    );

    const monthlyAccountsData: {
      month: string;
      receivable: number;
      payable: number;
    }[] = monthSlices.map(({ targetDate }, i) => {
      const { customerNet, vendorNet } = voucherMonthNets[i];
      return {
        month: `${monthNamesForAccounts[targetDate.getMonth()]} ${targetDate.getFullYear().toString().slice(-2)}`,
        receivable: Math.abs(Math.min(customerNet, 0)),
        payable: Math.max(vendorNet, 0),
      };
    });
    
    // Calculate percentage changes for metric cards
    const calculatePercentageChange = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100 * 10) / 10;
    };
    
    // Calculate shipment percentage change (comparing current month with previous month)
    const shipmentPercentageChange = calculatePercentageChange(currentMonthShipments, previousMonthShipments);
    
    // Calculate customer percentage change
    const customerPercentageChange = calculatePercentageChange(currentMonthCustomers, previousMonthCustomers);
    
    // Calculate revenue percentage change
    const revenuePercentageChange = calculatePercentageChange(currentMonthTotal, previousMonthTotal);
    
    // Get deliveries by country (only delivered shipments)
    const deliveriesByCountry = await prisma.shipment.groupBy({
      by: ['destination'],
      where: {
        deliveryStatus: 'Delivered'
      },
      _count: {
        id: true
      }
    });
    
    const transformedDeliveriesByCountry = deliveriesByCountry.map(item => ({
      country: item.destination,
      deliveries: item._count.id
    }));
    
    const data = {
      totalShipments,
      totalUsers: currentActiveUsers, // Show active users instead of total users
      totalRevenue,
      newOrders,
      monthlyEarnings,
      recentShipments: transformedRecentShipments,
      recentPayments: transformedPayments,
      shipmentStatusDistribution,
      revenueByDestination: transformedRevenueByDestination,
      monthlyShipments,
      topDestinations: transformedTopDestinations,
      customerDestinationMap: transformedCustomerDestinationMap,
      topCustomers: transformedTopCustomers,
      performanceMetrics: {
        deliveryRate: Math.round(deliveryRate * 10) / 10,
        avgDeliveryTime,
        customerSatisfaction,
        revenueGrowth: Math.round(revenueGrowth * 10) / 10
      },
      growthMetrics: {
        shipmentGrowth: Math.round(shipmentGrowth * 10) / 10,
        customerGrowth: Math.round(customerGrowth * 10) / 10
      },
      percentageChanges: {
        shipmentPercentageChange,
        customerPercentageChange,
        revenuePercentageChange
      },
      accountsData: {
        // For receivable: negative customer balances become positive (they owe us money)
        accountsReceivable: Math.abs(Math.min(accountsReceivable._sum.currentBalance || 0, 0)),
        // For payable: positive vendor balances stay positive (we owe them money)
        accountsPayable: Math.max(accountsPayable._sum.currentBalance || 0, 0),
        monthlyAccountsData
      },
      currentMonthData: {
        revenue: currentMonthTotal,
        shipments: currentMonthShipments,
        accountsReceivable: currentMonthReceivableAmount,
        customers: currentMonthCustomers
      },
      deliveriesByCountry: transformedDeliveriesByCountry
    };
    
    // Debug logging
    console.log('Dashboard Data:', {
      totalShipments,
      totalUsers,
      totalRevenue,
      revenueByDestination: transformedRevenueByDestination,
      topDestinations: transformedTopDestinations,
      customerDestinationMap: transformedCustomerDestinationMap
    });
    
    // Additional debugging for problematic charts
    console.log('=== DEBUGGING PROBLEMATIC CHARTS ===');
    console.log('1. Revenue by Destination:', {
      raw: topDestinationsForRevenue,
      transformed: transformedRevenueByDestination,
      length: transformedRevenueByDestination.length
    });
    console.log('2. Top Destinations:', {
      raw: topDestinations,
      transformed: transformedTopDestinations,
      length: transformedTopDestinations.length
    });
    console.log('3. Customer Destination Map:', {
      raw: customerDestinationMap,
      transformed: transformedCustomerDestinationMap,
      length: transformedCustomerDestinationMap.length
    });
    console.log('=== END DEBUGGING ===');
    
    // Ensure all arrays have data, if not provide fallback data
    const finalData = {
      totalShipments: totalShipments || 0,
      totalUsers: currentActiveUsers || 0, // Show active users instead of total users
      totalCustomers: totalCustomers || 0,
      activeCustomers: activeCustomers || 0,
      inactiveCustomers: inactiveCustomers || 0,
      totalRevenue: totalRevenue || 0,
      newOrders: newOrders || 0,
      monthlyEarnings: monthlyEarnings.length > 0 ? monthlyEarnings : [
        { month: "Jan", earnings: 0 },
        { month: "Feb", earnings: 0 },
        { month: "Mar", earnings: 0 },
        { month: "Apr", earnings: 0 },
        { month: "May", earnings: 0 },
        { month: "Jun", earnings: 0 },
        { month: "Jul", earnings: 0 },
        { month: "Aug", earnings: 0 },
        { month: "Sep", earnings: 0 },
        { month: "Oct", earnings: 0 },
        { month: "Nov", earnings: 0 },
        { month: "Dec", earnings: 0 }
      ],
      recentShipments: transformedRecentShipments.length > 0 ? transformedRecentShipments : [],
      recentPayments: transformedPayments.length > 0 ? transformedPayments : [],
      shipmentStatusDistribution: shipmentStatusDistribution.length > 0 ? shipmentStatusDistribution : [
        { status: "Pending", count: 0, color: "#F59E0B" }
      ],
      revenueByDestination: transformedRevenueByDestination.length > 0 ? transformedRevenueByDestination : [
        { destination: "No Data", revenue: 0, shipments: 0 }
      ],
      monthlyShipments: monthlyShipments.length > 0 ? monthlyShipments : [
        { month: "Jan", shipments: 0, revenue: 0 },
        { month: "Feb", shipments: 0, revenue: 0 },
        { month: "Mar", shipments: 0, revenue: 0 },
        { month: "Apr", shipments: 0, revenue: 0 },
        { month: "May", shipments: 0, revenue: 0 },
        { month: "Jun", shipments: 0, revenue: 0 },
        { month: "Jul", shipments: 0, revenue: 0 },
        { month: "Aug", shipments: 0, revenue: 0 },
        { month: "Sep", shipments: 0, revenue: 0 },
        { month: "Oct", shipments: 0, revenue: 0 },
        { month: "Nov", shipments: 0, revenue: 0 },
        { month: "Dec", shipments: 0, revenue: 0 }
      ],
      topDestinations: transformedTopDestinations.length > 0 ? transformedTopDestinations : [
        { destination: "No Data", shipments: 0, revenue: 0 }
      ],
      customerDestinationMap: transformedCustomerDestinationMap.length > 0 ? transformedCustomerDestinationMap : [
        { customer: "No Data", destination: "No Data", shipments: 0 }
      ],
      topCustomers: transformedTopCustomers.length > 0 ? transformedTopCustomers : [
        { customer: "No Data", shipments: 0, totalSpent: 0, avgOrderValue: 0 }
      ],
      performanceMetrics: {
        deliveryRate: Math.round(deliveryRate * 10) / 10 || 0,
        avgDeliveryTime: avgDeliveryTime || 0,
        customerSatisfaction: customerSatisfaction || 0,
        revenueGrowth: Math.round(revenueGrowth * 10) / 10 || 0
      },
      growthMetrics: {
        shipmentGrowth: Math.round(shipmentGrowth * 10) / 10 || 0,
        customerGrowth: Math.round(customerGrowth * 10) / 10 || 0
      },
      percentageChanges: {
        shipmentPercentageChange: shipmentPercentageChange || 0,
        customerPercentageChange: customerPercentageChange || 0,
        revenuePercentageChange: revenuePercentageChange || 0
      },
      accountsData: {
        accountsReceivable: accountsReceivable._sum.currentBalance || 0,
        accountsPayable: accountsPayable._sum.currentBalance || 0,
        monthlyAccountsData: monthlyAccountsData.length > 0 ? monthlyAccountsData : [
          { month: "Jan", receivable: 0, payable: 0 },
          { month: "Feb", receivable: 0, payable: 0 },
          { month: "Mar", receivable: 0, payable: 0 },
          { month: "Apr", receivable: 0, payable: 0 },
          { month: "May", receivable: 0, payable: 0 },
          { month: "Jun", receivable: 0, payable: 0 },
          { month: "Jul", receivable: 0, payable: 0 },
          { month: "Aug", receivable: 0, payable: 0 },
          { month: "Sep", receivable: 0, payable: 0 },
          { month: "Oct", receivable: 0, payable: 0 },
          { month: "Nov", receivable: 0, payable: 0 },
          { month: "Dec", receivable: 0, payable: 0 }
        ]
      },
      currentMonthData: {
        revenue: currentMonthTotal || 0,
        shipments: currentMonthShipments || 0,
        accountsReceivable: currentMonthReceivableAmount || 0,
        customers: currentMonthCustomers || 0
      }
    };
    
    return NextResponse.json(finalData);
  } catch (error) {
    console.error("Error generating dashboard data:", error);
    return NextResponse.json(
      { error: "Failed to generate dashboard data" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case "Delivered":
      return "#10B981";
    case "In Transit":
      return "#3B82F6";
    case "Pending":
      return "#F59E0B";
    case "Failed":
      return "#EF4444";
    default:
      return "#6B7280";
  }
}
