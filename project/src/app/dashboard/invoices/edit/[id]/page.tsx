'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Save, ArrowLeft, Plus, Trash2, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { Country } from 'country-state-city';

interface InvoiceData {
  id: number;
  invoiceNumber: string;
  createdAt: string;
  invoiceDate?: string;
  referenceNumber?: string;
  totalAmount: number;
  fscCharges: number;
  discount: number;
  shipment?: {
    id: number;
    trackingId?: string;
    destination?: string;
    dayWeek?: boolean;
    packages?: string;
    packaging?: string;
    calculatedValues?: string;
    shipmentDate?: string;
    referenceNumber?: string;
  };
  customer?: {
    id: number;
    CompanyName?: string;
    PersonName?: string;
    Address?: string;
    City?: string;
    Country?: string;
  };
  vendor?: {
    id: number;
    CompanyName?: string;
    name?: string;
    PersonName?: string;
    contactPerson?: string;
    Address?: string;
    address?: string;
    City?: string;
    city?: string;
    Country?: string;
    country?: string;
  };
}

export default function EditInvoicePage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [packages, setPackages] = useState<any[]>([]);
  const [calculatedValues, setCalculatedValues] = useState<any>({});
  const [disclaimer, setDisclaimer] = useState('Any discrepancy in invoice must be notified within 03 days of receipt of this invoice. You are requested to pay the invoice amount through cash payment or cross cheque in favor of PSS with immediate effect.');
  const [note, setNote] = useState('No cash, Cash equivalent, Gold jewelary or Dangerous goods accepted. Insurance is compulsory from shipper side, PSS is notresponsible for any loss and damage goods.');
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [updating, setUpdating] = useState(false);
  const fscInputRef = useRef<HTMLInputElement>(null);
  const [valueFieldWidth, setValueFieldWidth] = useState<number>(180);

  useEffect(() => {
    if (params.id) {
      fetchInvoiceData();
    }
  }, [params.id]);

  // Measure Fsc field width and apply to value fields
  useEffect(() => {
    const updateValueFieldWidth = () => {
      if (fscInputRef.current) {
        // Use requestAnimationFrame to ensure measurement happens after layout
        requestAnimationFrame(() => {
          if (fscInputRef.current) {
            const fscWidth = fscInputRef.current.offsetWidth;
            setValueFieldWidth(fscWidth);
          }
        });
      }
    };

    // Update on mount
    updateValueFieldWidth();
    
    // Use ResizeObserver to watch for size changes (including sidebar toggle)
    let resizeObserver: ResizeObserver | null = null;
    if (fscInputRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        updateValueFieldWidth();
      });
      resizeObserver.observe(fscInputRef.current);
    }

    // Also listen to window resize
    window.addEventListener('resize', updateValueFieldWidth);
    
    // Update after delays to catch layout changes (sidebar transition is 300ms)
    const timeout1 = setTimeout(updateValueFieldWidth, 100);
    const timeout2 = setTimeout(updateValueFieldWidth, 350); // After sidebar transition completes
    const timeout3 = setTimeout(updateValueFieldWidth, 500);

    return () => {
      if (resizeObserver && fscInputRef.current) {
        resizeObserver.unobserve(fscInputRef.current);
        resizeObserver.disconnect();
      }
      window.removeEventListener('resize', updateValueFieldWidth);
      clearTimeout(timeout1);
      clearTimeout(timeout2);
      clearTimeout(timeout3);
    };
  }, [invoiceData]);

  // Update line items when calculatedValues change
  useEffect(() => {
    if (calculatedValues.total && lineItems.length > 0) {
      const currentValue = Number(lineItems[0].value) || 0;
      const calculatedTotal = Number(calculatedValues.total) || 0;
      // Update if current value is 0 or missing, and calculated total exists
      if (currentValue === 0 && calculatedTotal > 0) {
        const updatedLineItems = [...lineItems];
        updatedLineItems[0] = { ...updatedLineItems[0], value: calculatedTotal };
        setLineItems(updatedLineItems);
      }
    }
  }, [calculatedValues, lineItems.length]);

  const fetchInvoiceData = async () => {
    try {
      setLoading(true);
      // Get invID from URL search params
      const urlParams = new URLSearchParams(window.location.search);
      const invID = urlParams.get('invID');
      
      if (!invID) {
        console.error('Invoice ID not found in URL parameters');
        setLoading(false);
        return;
      }
      
      const response = await fetch(`/api/accounts/invoices/${params.id}/edit?invID=${invID}`);
      if (response.ok) {
        const data = await response.json();

        // Ensure referenceNumber is populated from shipment if available
        const mergedData: InvoiceData = {
          ...data,
          referenceNumber:
            data.shipment?.referenceNumber ??
            data.referenceNumber ??
            "",
          shipment: data.shipment
            ? {
                ...data.shipment,
                referenceNumber:
                  data.shipment.referenceNumber ??
                  data.referenceNumber ??
                  data.shipment.referenceNumber ??
                  "",
              }
            : data.shipment,
        };

        setInvoiceData(mergedData);
        
        // Parse calculated values first
        let parsedValues: any = {};
        if (data.shipment?.calculatedValues) {
          try {
            parsedValues = JSON.parse(data.shipment.calculatedValues);
            setCalculatedValues(parsedValues);
          } catch (e) {
            console.error('Error parsing calculated values:', e);
          }
        }
        
        // Parse packages
        if (data.shipment?.packages) {
          try {
            const parsedPackages = typeof data.shipment.packages === 'string' 
              ? JSON.parse(data.shipment.packages) 
              : data.shipment.packages;
            setPackages(parsedPackages);
          } catch (e) {
            console.error('Error parsing packages:', e);
          }
        }

        // Initialize line items - prefer invoice lineItems, fallback to packages or calculated values
        if (data.lineItems && Array.isArray(data.lineItems) && data.lineItems.length > 0) {
          // Use existing line items from invoice, but filter out "Fuel Surcharge" and "Discount"
          // since they're already separate fields (fscCharges and discount)
          const invoiceLineItems = data.lineItems
            .filter((item: any) => 
              item.description !== "Fuel Surcharge" && 
              item.description !== "Discount"
            )
            .map((item: any, index: number) => {
              // If value is 0 or missing, try to use calculatedValues.total or totalAmount
              const itemValue = Number(item.value);
              const finalValue = (itemValue && itemValue > 0) 
                ? itemValue 
                : (Number(parsedValues.total) || Number(data.totalAmount) || 0);
              return {
                id: item.id || (index + 1).toString(),
                description: item.description || '',
                value: finalValue
              };
            });
          setLineItems(invoiceLineItems);
        } else if (data.shipment?.packages) {
          try {
            const parsedPackages = typeof data.shipment.packages === 'string' 
              ? JSON.parse(data.shipment.packages) 
              : data.shipment.packages;
            // Initialize line items from packages
            const initialLineItems = parsedPackages.map((pkg: any, index: number) => ({
              id: pkg.id || (index + 1).toString(),
              description: pkg.packageDescription || '',
              value: Number(pkg.value) || Number(parsedValues.total) || Number(data.totalAmount) || 0
            }));
            setLineItems(initialLineItems);
          } catch (e) {
            console.error('Error parsing packages for line items:', e);
            // Initialize with line item using calculated values if parsing fails
            setLineItems([{ id: '1', description: '', value: Number(parsedValues.total) || Number(data.totalAmount) || 0 }]);
          }
        } else {
          // Initialize with line item using calculated values or totalAmount
          setLineItems([{ id: '1', description: '', value: Number(parsedValues.total) || Number(data.totalAmount) || 0 }]);
        }

        // Set disclaimer if available
        if (data.disclaimer) {
          setDisclaimer(data.disclaimer);
        }

        // Set note if available
        if (data.note) {
          setNote(data.note);
        }
      } else {
        console.error('Failed to fetch invoice data');
      }
    } catch (error) {
      console.error('Error fetching invoice data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!invoiceData) return;

    setUpdating(true);
    try {
      const invID = invoiceData.id;
      const shipmentId = invoiceData.shipment?.id || params.id;

      // Calculate total amount from line items, FSC charges, and discount
      const lineItemsTotal = lineItems.reduce((sum, item) => sum + (item.value || 0), 0);
      const fscCharges = invoiceData.fscCharges || 0;
      const discount = invoiceData.discount || 0;
      const totalAmount = lineItemsTotal + fscCharges - discount;

      // Update calculatedValues with new total
      const updatedCalculatedValues = {
        ...calculatedValues,
        subtotal: lineItemsTotal,
        total: totalAmount,
      };

      // Prepare update data
      const updateData = {
        invoiceNumber: invoiceData.invoiceNumber,
        invoiceDate: invoiceData.invoiceDate || invoiceData.createdAt,
        totalAmount: totalAmount,
        fscCharges: fscCharges,
        discount: discount,
        lineItems: lineItems,
        disclaimer: disclaimer,
        note: note,
        shipment: {
          id: parseInt(shipmentId as string),
          trackingId: invoiceData.shipment?.trackingId || '',
          destination: invoiceData.shipment?.destination || '',
          dayWeek: invoiceData.shipment?.dayWeek || false,
          packages: packages,
          calculatedValues: updatedCalculatedValues,
        },
        referenceNumber: invoiceData.referenceNumber || '',
      };

      // Call the update API
      const response = await fetch(`/api/accounts/invoices/${shipmentId}/edit?invID=${invID}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast.success('Invoice updated successfully!');
        // Refresh the invoice data to get the latest values
        await fetchInvoiceData();
      } else {
        toast.error(`Error updating invoice: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating invoice:', error);
      toast.error('Failed to update invoice. Please try again.');
    } finally {
      setUpdating(false);
    }
  };


  const handlePrint = () => {
    if (invoiceData) {
      const invID = invoiceData.id;
      const shipmentId = invoiceData.shipment?.id || params.id;
      
      // Use lineItems directly
      const finalLineItems = lineItems.length > 0 ? lineItems : [{
        description: 'Service Item',
        value: 0
      }];
      
      // Calculate total amount
      const lineItemsTotal = finalLineItems.reduce((sum, item) => sum + (item.value || 0), 0);
      const fscCharges = invoiceData.fscCharges || 0;
      const discount = invoiceData.discount || 0;
      const totalAmount = lineItemsTotal + fscCharges - discount;
      
      // Create the updated invoice data
      const updatedInvoiceData = {
        ...invoiceData,
        invoiceDate: invoiceData.invoiceDate || invoiceData.createdAt,
        lineItems: finalLineItems,
        totalAmount: totalAmount,
        disclaimer: disclaimer,
        note: note,
        shipment: {
          ...invoiceData.shipment,
          referenceNumber: invoiceData.shipment?.referenceNumber || '',
          packages: packages,
          calculatedValues: calculatedValues,
        }
      };
      
      // Open invoice with updated data for printing with print parameter
      const queryParams = new URLSearchParams({
        invID: invID.toString(),
        data: JSON.stringify(updatedInvoiceData),
        print: 'true'
      });
      
      window.open(`/api/accounts/invoices/${shipmentId}/invoice?${queryParams.toString()}`, '_blank');
    }
  };

  const updatePackage = (index: number, field: string, value: any) => {
    const updatedPackages = [...packages];
    updatedPackages[index] = { ...updatedPackages[index], [field]: value };
    setPackages(updatedPackages);
  };

  const addLineItem = () => {
    setLineItems([...lineItems, {
      id: (lineItems.length + 1).toString(),
      description: '',
      value: 0
    }]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const updateLineItem = (index: number, field: string, value: any) => {
    const updatedItems = [...lineItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setLineItems(updatedItems);
  };

  const addPackage = () => {
    setPackages([...packages, {
      id: (packages.length + 1).toString(),
      packageDescription: '',
      weight: 0,
      length: 0,
      width: 0,
      height: 0,
      amount: 1
    }]);
  };

  const removePackage = (index: number) => {
    setPackages(packages.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!invoiceData) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Invoice not found</h1>
          <Button onClick={() => router.back()} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const isVendor = !!invoiceData.vendor;

  // Helper function to get full country name from code
  const getCountryName = (countryCode: string | undefined): string => {
    if (!countryCode) return '';
    // If it's already a full name (more than 2 characters), return as is
    if (countryCode.length > 2) return countryCode;
    // Try to get full country name from code
    const country = Country.getCountryByCode(countryCode);
    return country ? country.name : countryCode;
  };

  return (
    <div className="w-full min-h-full p-4 sm:p-6 lg:p-8 xl:p-10 bg-white dark:bg-zinc-900">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800 dark:text-white mb-2">
          Edit Invoice
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          Update invoice details
        </p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
        <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 w-full">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-xl sm:text-2xl font-bold text-center text-gray-800 dark:text-white">
              Selling Payment Invoice
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-5 p-4 sm:p-6">
            {/* General Invoice Details Section - Matching PHP layout */}
            <div className="grid grid-cols-36 gap-2">
              <div className="col-span-6">
                <div className="form-group">
                  <Label htmlFor="date" className="font-bold text-sm">
                    Shipment Date
                  </Label>
                  <Input
                    id="date"
                    type="text"
                    value={invoiceData.shipment?.shipmentDate 
                      ? new Date(invoiceData.shipment.shipmentDate).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "2-digit",
                        })
                      : invoiceData.invoiceDate
                      ? new Date(invoiceData.invoiceDate).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "2-digit",
                        })
                      : invoiceData.createdAt
                      ? new Date(invoiceData.createdAt).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "2-digit",
                        })
                      : ''}
                    readOnly
                    className="mt-1 text-sm bg-gray-50 w-full"
                  />
                </div>
              </div>
              <div className="col-span-6">
                <div className="form-group">
                  <Label htmlFor="receiptNumber" className="font-bold text-sm">
                    Booking ID
                  </Label>
                  <Input
                    id="receiptNumber"
                    value={invoiceData.invoiceNumber || ''}
                    onChange={(e) => setInvoiceData({
                      ...invoiceData,
                      shipment: {...invoiceData.shipment!, trackingId: e.target.value}
                    })}
                    readOnly
                    className="mt-1 text-sm bg-gray-50 w-full"
                  />
                </div>
              </div>
              <div className="col-span-6">
                <div className="form-group">
                  <Label htmlFor="trackingNumber" className="font-bold text-sm">
                    Tracking
                  </Label>
                  <Input
                    id="trackingNumber"
                    value={invoiceData.shipment?.trackingId || ''}
                    onChange={(e) => setInvoiceData({
                      ...invoiceData,
                      shipment: {...invoiceData.shipment!, trackingId: e.target.value}
                    })}
                    readOnly
                    className="mt-1 text-sm bg-gray-50 w-full"
                  />
                </div>
              </div>
              <div className="col-span-6">
                <div className="form-group">
                  <Label htmlFor="referenceNumber" className="font-bold text-sm">
                    Reference
                  </Label>
                  <Input
                    id="referenceNumber"
                    value={invoiceData.shipment?.referenceNumber || invoiceData.referenceNumber || ''}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setInvoiceData({
                        ...invoiceData,
                        referenceNumber: newValue,
                        shipment: invoiceData.shipment ? {
                          ...invoiceData.shipment,
                          referenceNumber: newValue
                        } : {
                          id: parseInt(params.id as string),
                          referenceNumber: newValue
                        } as InvoiceData['shipment']
                      });
                    }}
                    className="mt-1 text-sm w-full"
                  />
                </div>
              </div>
              <div className="col-span-6">
                <div className="form-group">
                  <Label htmlFor="destination" className="font-bold text-sm">
                    Country
                  </Label>
                  <Input
                    id="destination"
                    value={getCountryName(invoiceData.shipment?.destination)}
                    onChange={(e) => setInvoiceData({
                      ...invoiceData,
                      shipment: {...invoiceData.shipment!, destination: e.target.value}
                    })}
                    readOnly
                    className="mt-1 text-sm bg-gray-50 w-full"
                  />
                </div>
              </div>
              <div className="col-span-2">
                <div className="form-group">
                  <Label htmlFor="dayWeek" className="font-bold text-sm">
                    Type
                  </Label>
                  <Input
                    id="dayWeek"
                    value={invoiceData.shipment?.packaging}
                    onChange={(e) => setInvoiceData({
                      ...invoiceData,
                      shipment: {...invoiceData.shipment!, dayWeek: e.target.value === 'D'}
                    })}
                    readOnly
                    className="mt-1 text-sm bg-gray-50 w-full"
                  />
                </div>
              </div>
              <div className="col-span-2">
                <div className="form-group">
                  <Label htmlFor="pieces" className="font-bold text-sm">
                    Pcs
                  </Label>
                  <Input
                    id="pieces"
                    type="number"
                    step="1"
                    value={packages.reduce((sum, pkg) => sum + (pkg.amount || 1), 0)}
                    readOnly
                    className="mt-1 bg-gray-50 text-sm w-full"
                  />
                </div>
              </div>
              <div className="col-span-2">
                <div className="form-group">
                  <Label htmlFor="weight" className="font-bold text-sm">
                    Wght
                  </Label>
                  <Input
                    id="weight"
                    type="number"
                    step="0.01"
                    value={packages.reduce((sum, pkg) => sum + (pkg.weight || 0), 0)}
                    onChange={(e) => {
                      // Update first package weight proportionally
                      const totalWeight = parseFloat(e.target.value) || 0;
                      const currentTotal = packages.reduce((sum, pkg) => sum + (pkg.weight || 0), 0);
                      if (packages.length > 0 && currentTotal > 0) {
                        const ratio = totalWeight / currentTotal;
                        const updatedPackages = packages.map(pkg => ({
                          ...pkg,
                          weight: (pkg.weight || 0) * ratio
                        }));
                        setPackages(updatedPackages);
                      } else if (packages.length > 0) {
                        updatePackage(0, 'weight', totalWeight);
                      }
                    }}
                    readOnly
                    className="mt-1 text-sm bg-gray-50 w-full"
                  />
                </div>
              </div>
            </div>

            <br />
            <hr />
            <br />

            {/* Profile and Invoice Specifics Section - Matching PHP layout */}
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-6">
                <div className="form-group">
                  <Label htmlFor="profile" className="font-bold text-sm">
                    Profile
                  </Label>
                  <Input
                    id="profile"
                    value={isVendor ? 'Vendor' : 'Customer'}
                    readOnly
                    className="mt-1 bg-gray-50 text-sm w-full"
                  />
                </div>
              </div>
              <div className="col-span-3">
                <div className="form-group">
                  <Label htmlFor="invoiceNumber" className="font-bold text-sm">
                    Invoice #
                  </Label>
                  <Input
                    id="invoiceNumber"
                    value={invoiceData.invoiceNumber}
                    readOnly
                    className="mt-1 text-sm bg-gray-50 w-full"
                  />
                </div>
              </div>
              <div className="col-span-3">
                <div className="form-group">
                  <Label htmlFor="invoiceDate" className="font-bold text-sm">
                    Invoice Date
                  </Label>
                  <Input
                    id="invoiceDate"
                    type="date"
                    value={invoiceData.invoiceDate 
                      ? new Date(invoiceData.invoiceDate).toISOString().split('T')[0]
                      : new Date(invoiceData.createdAt).toISOString().split('T')[0]}
                    onChange={(e) => setInvoiceData({...invoiceData, invoiceDate: e.target.value})}
                    className="mt-1 text-sm w-full text-left [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-2 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-100"
                    style={{ textAlign: 'left', position: 'relative', paddingRight: '2.5rem' }}
                  />
                </div>
              </div>
            </div>

            {/* Invoice Line Items Section - Matching PHP layout */}
            <div className="space-y-3">
              {/* Header Row */}
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-1"></div>
                <div className="col-span-8">
                  <Label className="font-bold text-sm mb-1 block">Description</Label>
                </div>
                <div className="col-span-3">
                  <Label className="font-bold text-sm mb-1 block">Value</Label>
                </div>
              </div>
              
              {/* Line Items */}
              {lineItems.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-center">
                  {/* Action Buttons Column - col-1 */}
                  <div className="col-span-1 flex items-center">
                    {index === 0 ? (
                      <Button
                        type="button"
                        onClick={addLineItem}
                        size="sm"
                        className="bg-blue-500 hover:bg-blue-600 text-white w-14 h-10 p-0"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeLineItem(index)}
                        className="bg-red-500 hover:bg-red-600 text-white border-red-500 w-14 h-10 p-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  
                  {/* Description Field - col-8 */}
                  <div className="col-span-8">
                    <Input
                      id={`description-${index}`}
                      value={item.description || ''}
                      onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                      className="text-sm w-full h-10"
                      placeholder="Enter your description here."
                    />
                  </div>
                  
                  {/* Value Field - col-3 */}
                  <div className="col-span-3">
                    <Input
                      id={`value-${index}`}
                      type="text"
                      value={item.value !== undefined && item.value !== null ? Number(item.value).toLocaleString() : '0'}
                      onChange={(e) => {
                        const numValue = parseFloat(e.target.value.replace(/,/g, '')) || 0;
                        updateLineItem(index, 'value', numValue);
                      }}
                      className="text-sm w-full h-10 text-right"
                    />
                  </div>
                </div>
              ))}
            </div>

            <br />
            <br />

            {/* Disclaimer and Financial Fields - Matching PHP layout */}
            <div className="grid grid-cols-12 gap-2">
              {/* Notes/Disclaimer - col-7 */}
              <div className="col-span-7">
                <div className="form-group">
                  <Textarea
                    id="disclaimer"
                    value={disclaimer}
                    onChange={(e) => setDisclaimer(e.target.value)}
                    className="h-[250px] resize-y text-sm w-full"
                    placeholder="Enter your Notes here.."
                  />
                </div>
              </div>

              {/* Financial Fields - col-5 */}
              <div className="col-span-5">
                {/* Fsc */}
                <div className="grid grid-cols-12 gap-0 mb-4">
                  <div className="col-span-5 text-right pr-2">
                    <Label className="font-bold text-sm pt-2">Fsc</Label>
                  </div>
                  <div className="col-span-7">
                    <div className="form-group">
                      <Input
                        ref={fscInputRef}
                        id="fscCharges"
                        type="text"
                        value={invoiceData.fscCharges ? Number(invoiceData.fscCharges).toLocaleString() : '0'}
                        onChange={(e) => {
                          const numValue = parseFloat(e.target.value.replace(/,/g, '')) || 0;
                          setInvoiceData({...invoiceData, fscCharges: numValue});
                        }}
                        className="text-sm w-full text-right"
                      />
                    </div>
                  </div>
                </div>

                <br />
                <br />

                {/* Discount */}
                <div className="grid grid-cols-12 gap-0 mb-4">
                  <div className="col-span-5 text-right pr-2">
                    <Label className="font-bold text-sm pt-2">Discount</Label>
                  </div>
                  <div className="col-span-7">
                    <div className="form-group">
                      <Input
                        id="discount"
                        type="text"
                        value={invoiceData.discount ? Number(invoiceData.discount).toLocaleString() : '0'}
                        onChange={(e) => {
                          const numValue = parseFloat(e.target.value.replace(/,/g, '')) || 0;
                          setInvoiceData({...invoiceData, discount: numValue});
                        }}
                        className="text-sm w-full text-right"
                      />
                    </div>
                  </div>
                </div>

                <br />
                <br />

                {/* Total */}
                <div className="grid grid-cols-12 gap-0">
                  <div className="col-span-5 text-right pr-2">
                    <Label className="font-bold text-sm pt-2"><b>Total</b></Label>
                  </div>
                  <div className="col-span-7">
                    <div className="form-group">
                      <Input
                        id="total"
                        type="text"
                        value={(lineItems.reduce((sum, item) => sum + (item.value || 0), 0) + (invoiceData.fscCharges || 0) - (invoiceData.discount || 0)).toLocaleString()}
                        readOnly
                        className="text-sm w-full text-right font-bold bg-gray-100"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <br />
            <br />

            {/* Footer/Note Section */}
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-12">
                <div className="form-group">
                  <Label htmlFor="note" className="font-bold text-sm mb-2 block">
                    Footer/Note
                  </Label>
                  <Textarea
                    id="note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="min-h-[100px] resize-y text-sm w-full"
                    placeholder="Enter footer/note text here..."
                  />
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={updating}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {updating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Update Invoice
                  </>
                )}
              </Button>
              <Button
                type="button"
                onClick={handlePrint}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Printer className="h-4 w-4 mr-2" />
                Print Invoice
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
