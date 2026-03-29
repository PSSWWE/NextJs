import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateInvoiceNumber, generateVendorInvoiceNumber, addCustomerTransaction, addVendorTransaction, createJournalEntryForTransaction } from "@/lib/utils";

/**
 * POST /api/add-shipment
 * Creates a new shipment with associated invoices and financial transactions
 * 
 * This endpoint handles:
 * 1. Shipment creation with all package and pricing details
 * 2. Customer and vendor invoice generation
 * 3. Financial transaction recording
 * 4. Balance calculations and applications
 * 5. Journal entry creation for accounting
 */
export async function POST(req: NextRequest) {
  try {
    // ============================================================================
    // SECTION 1: REQUEST DATA EXTRACTION
    // ============================================================================
    const requestBody = await req.json();
    
    // Extract all required fields from the request body
    const {
      trackingId,
      referenceNumber,
      shipmentDate,
      agency,
      office,
      senderName,
      senderAddress,
      recipientName,
      recipientAddress,
      destination,
      deliveryTime,
      invoiceStatus,
      deliveryStatus,
      shippingMode,
      packaging,
      vendor,
      serviceMode,
      amount,
      packageDescription,
      weight,
      length,
      width,
      height,
      weightVol,
      fixedCharge,
      decValue,
      price,
      discount,
      fuelSurcharge,
      insurance,
      customs,
      tax,
      declaredValue,
      reissue,
      profitPercentage,
      cos, // Cost of Service - only used in manual mode
      manualRate,
      packages,
      packageTotals,
      calculatedValues,
      totalPackages,
      totalWeight,
      totalWeightVol,
      vendorPrice,
    } = requestBody;
    
    // Handle nested data structure from frontend
    const finalSenderName = senderName || requestBody.selectedSender?.Company || "";
    const finalSenderAddress = senderAddress || requestBody.selectedSender?.Address || "";
    const finalRecipientName = recipientName || requestBody.selectedRecipient?.Company || "";
    const finalRecipientAddress = recipientAddress || requestBody.selectedRecipient?.Address || "";
    const finalDestination = destination || requestBody.selectedRecipient?.Country || "";
    
    console.log('Data extraction debug:', {
      original: { senderName, senderAddress, recipientName, recipientAddress, destination },
      nested: { 
        selectedSender: requestBody.selectedSender, 
        selectedRecipient: requestBody.selectedRecipient 
      },
      final: { finalSenderName, finalSenderAddress, finalRecipientName, finalRecipientAddress, finalDestination }
    });
    
    // ============================================================================
    // SECTION 2: VALIDATION
    // ============================================================================
    // Validate required fields
    if (!trackingId) {
      return NextResponse.json(
        { error: "Tracking ID is required" },
        { status: 400 }
      );
    }

    // Check if tracking ID already exists
    const existingTrackingId = await prisma.shipment.findUnique({
      where: { trackingId }
    });
    if (existingTrackingId) {
      return NextResponse.json(
        { error: "Tracking ID already exists" },
        { status: 400 }
      );
    }

    // Check if reference number already exists (only if provided)
    if (referenceNumber && referenceNumber.trim() !== '') {
      const existingReferenceNumber = await prisma.shipment.findFirst({
        where: { referenceNumber }
      });
      if (existingReferenceNumber) {
        return NextResponse.json(
          { error: "Reference Number already exists" },
          { status: 400 }
        );
      }
    }

    // ============================================================================
    // SECTION 3: DEBUG LOGGING
    // ============================================================================
    // Log all received data for debugging purposes
    console.log('=== SHIPMENT DATA RECEIVED ===');
    console.log('Basic Form Data:', {
      trackingId,
      referenceNumber,
      agency,
      office,
      senderName,
      senderAddress,
      recipientName,
      recipientAddress,
      destination,
      deliveryTime,
      invoiceStatus,
      deliveryStatus,
      shippingMode,
      packaging,
      vendor,
      serviceMode,
      amount,
      packageDescription,
      weight,
      length,
      width,
      height,
      weightVol,
      fixedCharge,
      decValue,
      price,
      discount,
      fuelSurcharge,
      insurance,
      customs,
      tax,
      declaredValue,
      reissue,
      profitPercentage,
      vendorPrice,
      manualRate,
    });
    
    console.log('Tracking Information:', {
      trackingId: trackingId,
    });
    
    console.log('Destination Information:', {
      finalDestination: finalDestination,
    });
    
    console.log('Package Information:', {
      packages: packages,
      packageTotals: packageTotals,
      totalPackages: totalPackages,
      totalWeight: totalWeight,
      totalWeightVol: totalWeightVol,
    });
    
    console.log('Calculated Values:', calculatedValues);
    
    console.log('Additional Metadata:', {
      manualRate: manualRate,
      vendor: vendor,
      serviceMode: serviceMode,
    });
    
    console.log('Complete Request Body:', requestBody);
    console.log('=== END SHIPMENT DATA ===');

        // ============================================================================
    // SECTION 4: INPUT VALIDATION
    // ============================================================================
    // Define required fields for validation
    const requiredFields = [
      "senderName",
      "senderAddress",
      "recipientName",
      "recipientAddress",
      "destination",
    ];

    // Validate destination (required field)
    if (!finalDestination || finalDestination.trim() === '') {
      return NextResponse.json(
        { success: false, message: "Destination is required." },
        { status: 400 }
      );
    }

    // Validate all other required fields
    const fieldValidations = [
      { field: 'senderName', value: finalSenderName },
      { field: 'senderAddress', value: finalSenderAddress },
      { field: 'recipientName', value: finalRecipientName },
      { field: 'recipientAddress', value: finalRecipientAddress },
    ];

    for (const { field, value } of fieldValidations) {
      if (!value || value.trim() === '') {
        return NextResponse.json(
          { success: false, message: `${field} is required.` },
          { status: 400 }
        );
      }
    }

    // ============================================================================
    // SECTION 5: PRICING CALCULATIONS
    // ============================================================================
    // Parse and calculate all pricing components
    const priceWithProfit = Math.round((parseFloat(price) || 0));
    const fuelSurchargeAmount = Math.round((parseFloat(fuelSurcharge) || 0));
    const discountPercentage = parseFloat(discount) || 0;
    const profitPercentageValue = parseFloat(profitPercentage) || 0;
    
    // Calculate original price by removing profit from the price with profit
    // This is needed because the frontend sends price with profit included
    const originalPrice = profitPercentageValue > 0 ? Math.round((priceWithProfit / (1 + profitPercentageValue / 100)) * 100) / 100 : priceWithProfit;
    
    // Calculate discount amount as percentage of original price
    const discountAmount = Math.round(((originalPrice * discountPercentage) / 100));
    
    // Calculate profit amount as percentage of original price
    const profitAmount = Math.round(((originalPrice * profitPercentageValue) / 100));
    
    // Calculate total costs for customer and vendor
    // Customer invoice uses the price with profit (from frontend)
    const customerTotalCost = Math.round((priceWithProfit + fuelSurchargeAmount - discountAmount));
    // Vendor invoice: use CoS (Cost of Service) if in manual mode, otherwise use vendorPrice
    const vendorTotalCost = manualRate 
      ? Math.round((parseFloat(cos) || 0))
      : Math.round((parseFloat(vendorPrice) || 0));

    // Get subtotal from calculated values or use original price
    const subtotal = calculatedValues?.subtotal ? Math.round((calculatedValues.subtotal)) : originalPrice;
    
    // Log pricing calculations for debugging
    console.log('=== PRICING CALCULATIONS ===');
    console.log('Price from request:', price);
    console.log('Fuel surcharge:', fuelSurcharge);
    console.log('Discount percentage:', discount);
    console.log('Profit percentage:', profitPercentage);
    console.log('Manual rate:', manualRate);
    console.log('CoS (Cost of Service):', cos);
    console.log('Vendor price:', vendorPrice);
    console.log('Fixed charge:', fixedCharge);
    console.log('Original price (no profit):', originalPrice);
    console.log('Customer total cost (with profit):', customerTotalCost);
    console.log(`Vendor total cost (${manualRate ? 'CoS' : 'vendorPrice'}):`, vendorTotalCost);
    console.log('=== END PRICING CALCULATIONS ===');

    // ============================================================================
    // SECTION 6: SHIPMENT CREATION
    // ============================================================================
    // Generate unique invoice number for this shipment
    const invoiceNumber = await generateInvoiceNumber(prisma);

    // Create shipment record in database with all fields
    const shipment = await prisma.shipment.create({
      data: {
        trackingId,
        referenceNumber: referenceNumber,
        invoiceNumber,
        shipmentDate: shipmentDate ? new Date(shipmentDate) : new Date(),
        agency,
        office,
        senderName: finalSenderName,
        senderAddress: finalSenderAddress,
        recipientName: finalRecipientName,
        recipientAddress: finalRecipientAddress,
        destination: finalDestination,
        deliveryTime,
        invoiceStatus: "Unpaid", // Default to Unpaid, will be updated after calculation
        deliveryStatus,
        shippingMode,
        packaging,
        vendor,
        serviceMode,
        amount: parseInt(amount) || 1,
        packageDescription,
        weight: parseFloat(weight) || 0,
        length: parseFloat(length) || 0,
        width: parseFloat(width) || 0,
        height: parseFloat(height) || 0,
        weightVol: parseFloat(weightVol) || 0,
        fixedCharge: parseFloat(fixedCharge) || 0,
        decValue: parseFloat(decValue) || 0,
        price: originalPrice, // Store original price without profit
        discount: discountPercentage,
        fuelSurcharge: fuelSurchargeAmount,
        insurance: parseFloat(insurance) || 0,
        customs: parseFloat(customs) || 0,
        tax: parseFloat(tax) || 0,
        declaredValue: parseFloat(declaredValue) || 0,
        reissue: parseFloat(reissue) || 0,
        profitPercentage: profitPercentageValue, // Store the profit percentage
        cos: parseFloat(cos) || 0, // Store Cost of Service
        totalCost: customerTotalCost, // Use customer total cost for shipment record
        subtotal,
        manualRate: Boolean(manualRate),
        totalPackages: parseInt(totalPackages) || 0,
        totalWeight: parseFloat(totalWeight) || 0,
        totalWeightVol: parseFloat(totalWeightVol) || 0,
        packages: packages ? JSON.stringify(packages) : undefined,
        packageTotals: packageTotals ? JSON.stringify(packageTotals) : undefined,
        calculatedValues: calculatedValues ? JSON.stringify(calculatedValues) : undefined,
      },
    });
    
    console.log('Shipment saved to database:', {
      id: shipment.id,
      trackingId: shipment.trackingId,
      referenceNumber: shipment.referenceNumber,
      invoiceNumber: shipment.invoiceNumber,
      destination: shipment.destination,
      totalCost: shipment.totalCost,
      subtotal: shipment.subtotal,
      profitPercentage: shipment.profitPercentage,
      totalPackages: shipment.totalPackages,
      totalWeight: shipment.totalWeight,
      createdAt: shipment.createdAt,
    });

    // ============================================================================
    // SECTION 6.1: AUTO-ADD INITIAL TRACKING STATUS (Booked + Picked Up)
    // ============================================================================
    const shipmentDateTime = shipment.shipmentDate ? new Date(shipment.shipmentDate) : new Date(shipment.createdAt);
    const bookingDateTime = new Date(shipmentDateTime.getTime() - 2.5 * 60 * 60 * 1000); // 2.5 hours before shipment date
    const initialTrackingHistory = [
      { status: "Booked", timestamp: bookingDateTime.toISOString(), location: "Lahore, Pakistan" },
      { status: "Picked Up", timestamp: shipmentDateTime.toISOString(), location: "Lahore, Pakistan" },
    ];
    await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        trackingStatusHistory: initialTrackingHistory as unknown as object,
        trackingStatus: "Picked Up",
      } as Record<string, unknown>,
    });

    // ============================================================================
    // SECTION 7: INVOICE CREATION
    // ============================================================================
    // Initialize variables for invoice creation
    let customerInvoice = null;
    let vendorInvoice = null;
    
    // Initialize balance calculation variables
    let customerBalance = 0;
    let appliedBalance = 0;
    let remainingAmount = 0;
    let calculatedInvoiceStatus = "Unpaid";
    let vendorBalance = 0;
    let vendorAppliedBalance = 0;
    let vendorRemainingAmount = 0;
    let vendorCalculatedInvoiceStatus = "Unpaid";

    try {
      // Generate vendor invoice number (customer invoice + 5)
      const vendorInvoiceNumber = generateVendorInvoiceNumber(invoiceNumber);

      // ============================================================================
      // SECTION 6.1: CUSTOMER AND VENDOR LOOKUP
      // ============================================================================
      // Find customer and vendor IDs from database
      let customerId = null;
      let vendorId = null;

      // Find customer by name
      if (finalSenderName) {
        const customer = await prisma.customers.findFirst({
          where: { CompanyName: finalSenderName }
        });
        customerId = customer?.id || null;
        customerBalance = customer?.currentBalance || 0;
      }

      // Find vendor by name
      if (vendor) {
        const vendorRecord = await prisma.vendors.findFirst({
          where: { CompanyName: vendor }
        });
        vendorId = vendorRecord?.id || null;
        vendorBalance = vendorRecord?.currentBalance || 0;
      }

      // ============================================================================
      // SECTION 6.2: CUSTOMER BALANCE CALCULATIONS
      // ============================================================================
      // Calculate how much of customer's balance to apply to this invoice
      if (customerBalance > 0) {
        // Calculate remaining amount based on customer balance
        remainingAmount = Math.max(0, customerTotalCost - customerBalance);
        appliedBalance = Math.min(customerBalance, customerTotalCost);
      }
      else {
        remainingAmount = customerTotalCost;
        appliedBalance = 0;
      }
      
      // Determine invoice status based on remaining amount
      if (remainingAmount === 0) {
        calculatedInvoiceStatus = "Paid";
      } else if (appliedBalance > 0) {
        calculatedInvoiceStatus = "Partial";
      }

      // ============================================================================
      // SECTION 6.3: VENDOR BALANCE CALCULATIONS
      // ============================================================================
      // Calculate vendor balance application (inverted logic)
      // If vendor has positive balance, we owe them money, so apply it to reduce our debt
      // If vendor has negative balance, they owe us money, so we apply their debt to reduce our invoice
      if (vendorBalance > 0) {
        // We owe them money, apply their credit to reduce our debt
        vendorRemainingAmount = vendorTotalCost;
        vendorAppliedBalance = 0;
      } else {
        // They owe us money, apply their debt to reduce our invoice
        vendorAppliedBalance = Math.min(Math.abs(vendorBalance), vendorTotalCost);
        vendorRemainingAmount = Math.max(0, vendorTotalCost - vendorAppliedBalance);
      }
      
      console.log('Vendor balance:', vendorBalance);
      console.log('Vendor total cost:', vendorTotalCost);
      console.log('Vendor remaining amount:', vendorRemainingAmount);
      console.log('Vendor applied balance:', vendorAppliedBalance);
      
      // Determine vendor invoice status based on remaining amount
      if (vendorRemainingAmount === 0) {
        vendorCalculatedInvoiceStatus = "Paid";
      } else if (vendorAppliedBalance > 0) {
        vendorCalculatedInvoiceStatus = "Partial";
      }

      // ============================================================================
      // SECTION 6.4: CUSTOMER INVOICE CREATION
      // ============================================================================
      // Create customer invoice using the existing accounts API
      // Use package descriptions from packages array instead of hardcoded "Shipping Service"
      const customerLineItems: { description: string; value: number }[] = [];
      
      // Parse packages if it's a string
      let parsedPackages = packages;
      if (typeof packages === 'string') {
        try {
          parsedPackages = JSON.parse(packages);
        } catch (e) {
          console.error('Error parsing packages:', e);
          parsedPackages = [];
        }
      }
      
      // Create line items from packages using their descriptions
      if (Array.isArray(parsedPackages) && parsedPackages.length > 0) {
        // Distribute the original price across packages based on their weight/value
        const totalWeight = parsedPackages.reduce((sum: number, pkg: any) => sum + (Math.max(pkg.weight || 0, pkg.weightVol || 0)), 0);
        parsedPackages.forEach((pkg: any) => {
          const packageWeight = Math.max(pkg.weight || 0, pkg.weightVol || 0);
          const packageProportion = totalWeight > 0 ? packageWeight / totalWeight : 1 / parsedPackages.length;
          const packageValue = Math.round(originalPrice * packageProportion);
          const description = pkg.packageDescription || 'Shipping Service';
          customerLineItems.push({ description, value: packageValue });
        });
      } else {
        // Fallback if no packages: use original price with default description
        customerLineItems.push({ description: "Shipping Service", value: Math.round(originalPrice) });
      }
      
      // Note: Fuel Surcharge and Discount are NOT added as line items since they're already in fscCharges and discount fields
      
      // Add profit line item if profit percentage is greater than 0
      if (profitPercentageValue > 0) {
        customerLineItems.push({ description: "Profit", value: Math.round(profitAmount) });
      }

      // Add balance applied line item if customer has balance
      if (appliedBalance > 0) {
        customerLineItems.push({ description: "Balance Applied", value: Math.round(-appliedBalance) });
      }

      const customerInvoiceResponse = await fetch(`${req.nextUrl.origin}/api/accounts/invoices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceNumber: invoiceNumber,
          invoiceDate: shipmentDate ? new Date(shipmentDate).toISOString() : new Date().toISOString(),
          trackingNumber: trackingId,
          destination: finalDestination,
          weight: parseFloat(totalWeight) || 0,
          profile: "Customer",
          fscCharges: Math.round(fuelSurchargeAmount),
          discount: Math.round(discountAmount),
          lineItems: customerLineItems,
          customerId: customerId,
          vendorId: null,
          shipmentId: shipment.id,
          disclaimer: "Thank you for your business",
          totalAmount: customerTotalCost, // Use original customer total cost (includes profit)
          currency: "PKR",
          status: calculatedInvoiceStatus
        })
      });

      if (customerInvoiceResponse.ok) {
        customerInvoice = await customerInvoiceResponse.json();
      }

      // Update shipment invoiceStatus to match calculated status
      await prisma.shipment.update({
        where: { id: shipment.id },
        data: { invoiceStatus: calculatedInvoiceStatus }
      });

      // ============================================================================
      // SECTION 6.5: VENDOR INVOICE CREATION
      // ============================================================================
      // Create vendor invoice using the existing accounts API
      // Vendor invoice uses original price without profit
      // Use package descriptions from packages array instead of hardcoded "Vendor Service"
      const vendorLineItems: { description: string; value: number }[] = [];
      
      // Parse packages if it's a string (reuse from customer invoice)
      let vendorParsedPackages = packages;
      if (typeof packages === 'string') {
        try {
          vendorParsedPackages = JSON.parse(packages);
        } catch (e) {
          console.error('Error parsing packages for vendor invoice:', e);
          vendorParsedPackages = [];
        }
      }
      
      // Create line items from packages using their descriptions
      if (Array.isArray(vendorParsedPackages) && vendorParsedPackages.length > 0) {
        // Distribute the original price across packages based on their weight/value
        const totalWeight = vendorParsedPackages.reduce((sum: number, pkg: any) => sum + (Math.max(pkg.weight || 0, pkg.weightVol || 0)), 0);
        vendorParsedPackages.forEach((pkg: any) => {
          const packageWeight = Math.max(pkg.weight || 0, pkg.weightVol || 0);
          const packageProportion = totalWeight > 0 ? packageWeight / totalWeight : 1 / vendorParsedPackages.length;
          const packageValue = Math.round(originalPrice * packageProportion);
          const description = pkg.packageDescription || 'Vendor Service';
          vendorLineItems.push({ description, value: packageValue });
        });
      } else {
        // Fallback if no packages: use original price with default description
        vendorLineItems.push({ description: "Vendor Service", value: Math.round(originalPrice) });
      }
      
      // Note: Fuel Surcharge and Discount are NOT added as line items since they're already in fscCharges and discount fields
      
      // Add balance applied line item if vendor has balance (positive or negative)
      if (vendorAppliedBalance > 0) {
        vendorLineItems.push({ description: "Balance Applied", value: Math.round(-vendorAppliedBalance) });
      }
      
      // Ensure vendor total cost is properly rounded
      const roundedVendorTotalCost = Math.round(vendorTotalCost);

      const vendorInvoiceResponse = await fetch(`${req.nextUrl.origin}/api/accounts/invoices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceNumber: vendorInvoiceNumber,
          invoiceDate: shipmentDate ? new Date(shipmentDate).toISOString() : new Date().toISOString(),
          trackingNumber: trackingId,
          destination: finalDestination,
          weight: parseFloat(totalWeight) || 0,
          profile: "Vendor",
          fscCharges: 0,
          discount: Math.round(discountAmount),
          lineItems: vendorLineItems,
          customerId: null,
          vendorId: vendorId,
          shipmentId: shipment.id,
          disclaimer: "Vendor invoice - original cost without profit",
          totalAmount: vendorTotalCost, // Use original vendor total cost (no profit)
          currency: "PKR",
          status: vendorCalculatedInvoiceStatus
        })
      });

      if (vendorInvoiceResponse.ok) {
        vendorInvoice = await vendorInvoiceResponse.json();
      }

      console.log('Invoices created successfully:', {
        customerInvoice: customerInvoice?.invoiceNumber,
        vendorInvoice: vendorInvoice?.invoiceNumber
      });

          // ============================================================================
    // SECTION 8: FINANCIAL TRANSACTIONS
    // ============================================================================
      try {
        // ============================================================================
        // SECTION 7.1: CUSTOMER TRANSACTIONS
        // ============================================================================
        // Customer transaction (DEBIT - they owe us money)
        if (customerId && remainingAmount >= 0) {
          await addCustomerTransaction(
            prisma,
            customerId,
            'DEBIT',
            remainingAmount,
            `Tracking: ${trackingId} | Country: ${finalDestination} | Type: ${packaging} | Weight: ${totalWeight}Kg`,
            invoiceNumber,
            invoiceNumber,
            shipmentDate ? new Date(shipmentDate) : new Date()
          );
          if (appliedBalance > 0) {
          // Create journal entry for customer debit transaction
          await createJournalEntryForTransaction(
            prisma,
            'CUSTOMER_DEBIT',
            customerTotalCost,
            `Customer invoice for shipment ${trackingId}`,
            invoiceNumber,
            invoiceNumber,
            shipmentDate ? new Date(shipmentDate) : new Date()
          );
          }
          else {
            // Create journal entry for customer debit transaction
          await createJournalEntryForTransaction(
            prisma,
            'CUSTOMER_DEBIT',
            remainingAmount,
            `Customer invoice for shipment ${trackingId}`,
            invoiceNumber,
            invoiceNumber,
            shipmentDate ? new Date(shipmentDate) : new Date()
          );
          }
          
        }

        // If customer has balance and it was applied, create a payment transaction
        if (customerId && appliedBalance > 0) {
          // Create payment record for balance application
          await prisma.payment.create({
            data: {
              transactionType: "INCOME",
              category: "Balance Applied",
              date: new Date(),
              amount: appliedBalance,
              fromPartyType: "CUSTOMER",
              fromCustomerId: customerId,
              fromCustomer: finalSenderName || "",
              toPartyType: "US",
              toVendorId: null,
              toVendor: "",
              mode: "CASH",
              reference: invoiceNumber,
              invoice: invoiceNumber,
              description: `Credit applied for invoice ${invoiceNumber}`
            }
          });
          
          // Create CREDIT transaction for customer (reduces their balance)
          await addCustomerTransaction(
            prisma,
            customerId,
            'DEBIT',
            appliedBalance,
            `Credit applied for invoice ${invoiceNumber}`,
            `CREDIT-${invoiceNumber}`,
            invoiceNumber,
            shipmentDate ? new Date(shipmentDate) : new Date()
          );

          // Create journal entry for customer credit transaction
          await createJournalEntryForTransaction(
            prisma,
            'CUSTOMER_CREDIT',
            appliedBalance,
            `Customer credit applied for invoice ${invoiceNumber}`,
            `CREDIT-${invoiceNumber}`,
            invoiceNumber,
            shipmentDate ? new Date(shipmentDate) : new Date()
          );

          // // Create journal entry for company debit transaction
          // await createJournalEntryForTransaction(
          //   prisma,
          //   'COMPANY_DEBIT',
          //   appliedBalance,
          //   `Customer credit applied for invoice ${invoiceNumber}`,
          //   `CREDIT-${invoiceNumber}`,
          //   invoiceNumber
          // );
        }

        // ============================================================================
        // SECTION 7.2: VENDOR TRANSACTIONS
        // ============================================================================
        // Vendor transaction (DEBIT - we owe vendor money)
        if (vendorId && vendorRemainingAmount >= 0) {
          await addVendorTransaction(
            prisma,
            vendorId,
            'DEBIT',
            vendorRemainingAmount,
            `Tracking: ${trackingId} | Country: ${finalDestination} | Type: ${packaging} | Weight: ${totalWeight}Kg`,
            vendorInvoiceNumber,
            vendorInvoiceNumber,
            shipmentDate ? new Date(shipmentDate) : new Date()
          );
          if (vendorAppliedBalance > 0) {
          // Create journal entry for vendor debit transaction
          await createJournalEntryForTransaction(
            prisma,
            'VENDOR_DEBIT',
            vendorTotalCost,
            `Vendor invoice for shipment ${trackingId}`,
            vendorInvoiceNumber,
            vendorInvoiceNumber,
            shipmentDate ? new Date(shipmentDate) : new Date()
          );
          }
          else {
            // Create journal entry for vendor debit transaction
          await createJournalEntryForTransaction(
            prisma,
            'VENDOR_DEBIT',
            vendorRemainingAmount,
            `Vendor invoice for shipment ${trackingId}`,
            vendorInvoiceNumber,
            vendorInvoiceNumber,
            shipmentDate ? new Date(shipmentDate) : new Date()
          );}
        }

        // If vendor has balance and it was applied, create a payment transaction
        if (vendorId && vendorAppliedBalance > 0) {
          // Create payment record for vendor balance application
          await prisma.payment.create({
            data: {
              transactionType: "EXPENSE",
              category: "Balance Applied",
              date: new Date(),
              amount: vendorAppliedBalance,
              fromPartyType: "US",
              fromCustomerId: null,
              fromCustomer: "",
              toPartyType: "VENDOR",
              toVendorId: vendorId,
              toVendor: vendor || "",
              mode: "CASH",
              reference: vendorInvoiceNumber,
              invoice: vendorInvoiceNumber,
              description: `Credit applied for vendor invoice ${vendorInvoiceNumber}`
            }
          });

          // Create CREDIT transaction for vendor (reduces what we owe them)
          await addVendorTransaction(
            prisma,
            vendorId,
            'DEBIT',
            vendorAppliedBalance,
            `Credit applied for vendor invoice ${vendorInvoiceNumber}`,
            `CREDIT-${vendorInvoiceNumber}`,
            vendorInvoiceNumber,
            shipmentDate ? new Date(shipmentDate) : new Date()
          );

          // Create journal entry for vendor credit transaction
          await createJournalEntryForTransaction(
            prisma,
            'VENDOR_CREDIT',
            vendorAppliedBalance,
            `Vendor credit applied for invoice ${vendorInvoiceNumber}`,
            `CREDIT-${vendorInvoiceNumber}`,
            vendorInvoiceNumber,
            shipmentDate ? new Date(shipmentDate) : new Date()
          );

          // // Create journal entry for company credit transaction
          // await createJournalEntryForTransaction(
          //   prisma,
          //   'COMPANY_CREDIT',
          //   vendorAppliedBalance,
          //   `Vendor credit applied for invoice ${vendorInvoiceNumber}`,
          //   `CREDIT-${vendorInvoiceNumber}`,
          //   vendorInvoiceNumber
          // );
        }

        console.log('Financial transactions created successfully');

      } catch (transactionError) {
        console.error('Error creating financial transactions:', transactionError);
        // Don't fail the shipment creation if transaction creation fails
      }

    } catch (invoiceError) {
      console.error('Error creating invoices:', invoiceError);
      // Don't fail the shipment creation if invoice creation fails
      // The shipment is already saved, we just log the error
    }

    // ============================================================================
    // SECTION 9: RESPONSE
    // ============================================================================
    // Return success response with all created data
    return NextResponse.json({
      success: true,
      message: "Shipment added successfully.",
      shipment,
      invoices: {
        customer: customerInvoice,
        vendor: vendorInvoice
      },
      calculation: {
        originalPrice,
        priceWithProfit,
        fuelSurcharge: fuelSurchargeAmount,
        discountPercentage: discountPercentage,
        discountAmount: discountAmount,
        profitPercentage: profitPercentageValue,
        profitAmount: profitAmount,
        customerTotalCost,
        vendorTotalCost,
        subtotal,
        customerBalance: customerBalance,
        appliedBalance: appliedBalance,
        remainingAmount: remainingAmount,
        invoiceStatus: calculatedInvoiceStatus,
        vendorBalance: vendorBalance,
        vendorAppliedBalance: vendorAppliedBalance,
        vendorRemainingAmount: vendorRemainingAmount,
        vendorInvoiceStatus: vendorCalculatedInvoiceStatus,
      },
      receivedData: {
        trackingId: trackingId,
        invoiceNumber: invoiceNumber,
        destination: finalDestination,
        totalPackages: totalPackages,
        totalWeight: totalWeight,
        totalWeightVol: totalWeightVol,
        calculatedValues: calculatedValues,
      },
    });
  } catch (error) {
    console.error("Add shipment error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to add shipment." },
      { status: 500 }
    );
  }
}
