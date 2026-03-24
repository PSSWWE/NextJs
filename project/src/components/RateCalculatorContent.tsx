"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Country } from "country-state-city";
import { Plane, Info, Printer, Clock, Home, Truck, PackageSearch, Shield, AlertTriangle, ArrowRight, Mail, Package, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

function FlagIcon({ country, className }: { country: any; className?: string }) {
  if (!country?.isoCode) return null;
  const code = country.isoCode.toLowerCase();
  return (
    <img
      src={`https://flagcdn.com/w40/${code}.png`}
      srcSet={`https://flagcdn.com/w80/${code}.png 2x`}
      alt={country.name || code}
      className={className || "w-5 h-3.5 object-cover rounded-sm inline-block"}
      loading="lazy"
    />
  );
}

const documentTypes = [
  "Document",
  "Non Document",
  "FedEx Pak"
];

function getLogoForService(service: string | undefined): string | null {
  if (!service) return null;
  const s = service.toUpperCase();
  if (s.includes("UPS")) return "/logo/UPS.png";
  if (s.includes("DHL")) return "/logo/DHL.png";
  if (s.includes("FEDEX")) return "/logo/FedEx.png";
  if (s.includes("SNWWE") || s.includes("SKYNET")) return "/logo/Skynet.png";
  if (s.includes("PARCEL") || s.includes("PARCELFORCE")) return "/logo/Parcelforce.png";
  if (s.includes("DPD")) return "/logo/DPD.png";
  return null;
}

function getServiceTypeLabel(service: string | undefined): string {
  if (!service) return "International Priority";
  const s = service.toUpperCase();
  if (s.includes("DHL")) return "Express Worldwide";
  if (s.includes("UPS")) return "Express Saver\u00AE";
  if (s.includes("FEDEX")) return "International Priority";
  if (s.includes("SNWWE") || s.includes("SKYNET")) return "International Export Express";
  if (s.includes("PARCEL") || s.includes("PARCELFORCE")) return "Express 48";
  return "International Priority";
}

function getDeliveryDays(service: string | undefined, isExpress: boolean): string {
  if (isExpress) return "4-5 BD";
  const origin = getOriginFromService(service);
  const o = origin.toUpperCase();
  if (o === "DUBAI" || o === "UK" || o === "LONDON") return "8-10 BD";
  return "1-6 BD";
}

function getOriginFromService(service: string | undefined): string {
  if (!service) return "Pakistan";
  const s = service.toUpperCase();
  if (s.includes("LHE")) return "Lahore";
  if (s.includes("DXB")) return "Dubai";
  if (s.includes("KHI")) return "Karachi";
  if (s.includes("ISB")) return "Islamabad";
  if (s.includes("SNWWE") || s.includes("SKYNET")) return "Lahore";
  if (s.includes("LHR")) return "London";
  if (s.includes("EU")) return "Germany";
  if (s.includes("SIN")) return "Singapore";
  if (s.includes("NY")) return "New York";
  if (s.includes("KUL")) return "Kuala Lumpur";
  return "Pakistan";
}

interface RateCalculatorContentProps {
  publicView?: boolean;
}

export default function RateCalculatorContent({ publicView = false }: RateCalculatorContentProps) {
  const [form, setForm] = useState({
    weight: "",
    length: "0",
    width: "0",
    height: "0",
    origin: "Pakistan",
    destination: "",
    originZip: "",
    destinationZip: "",
    docType: "",
    profitPercentage: publicView ? "5" : "0",
  });

  const [countries, setCountries] = useState<any[]>([]);
  const [results, setResults] = useState<{
    profitPercentage: number;
    fixedCharge: {
      weight: number;
      amount: number;
    } | null;
    top3Rates: Array<{
      rank: number;
      zone: number;
      country: string;
      service: string;
      bestRate: { 
        weight: number; 
        price: number; 
        vendor: string;
        originalPrice: number;
      };
    }>;
    zones: Array<{
      zone: number;
      country: string;
      service: string;
      bestRate: { 
        weight: number; 
        price: number; 
        vendor: string;
        originalPrice: number;
      };
    }>;
    bestOverallRate: {
      zone: number;
      country: string;
      service: string;
      bestRate: { 
        weight: number; 
        price: number; 
        vendor: string;
        originalPrice: number;
      };
    };
    allRates: Array<{
      zone: number;
      weight: number;
      price: number;
      vendor: string;
      service: string;
      originalPrice: number;
    }>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showFixedCharges, setShowFixedCharges] = useState(true);
  const [publicResultsTab, setPublicResultsTab] = useState<"all" | "express" | "economy">("express");
  const [infoModalOpen, setInfoModalOpen] = useState(false);

  useEffect(() => {
    const allCountries = Country.getAllCountries();
    setCountries(allCountries);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value =
      e.target.type === "number"
        ? Math.max(0, Number(e.target.value)).toString()
        : e.target.value;
    setForm({ ...form, [e.target.name]: value });
  };

  const handleSelect = (value: string, field: string) => {
    setForm({ ...form, [field]: value });
  };

  const handleCalculate = async () => {
    const { weight, length, width, height, origin, destination, originZip, destinationZip, docType, profitPercentage } = form;
    const w = parseFloat(weight);
    const l = parseFloat(length);
    const wd = parseFloat(width);
    const h = parseFloat(height);
    const profit = publicView ? 5 : parseFloat(profitPercentage);

    if ([w, l, wd, h].some((v) => isNaN(v) || v < 0)) {
      setError("Please enter valid non-negative numbers for all dimensions and weight.");
      setResults(null);
      return;
    }

    if (!origin || !destination || !docType) {
      setError("Please fill in all required fields: Origin, Destination, and Document Type.");
      setResults(null);
      return;
    }

    if (!publicView && (isNaN(profit) || profit < 0)) {
      setError("Please enter a valid profit percentage (0 or greater).");
      setResults(null);
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/rate-calc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          origin, 
          destination, 
          originZip,
          destinationZip,
          weight: w,
          docType,
          height: h,
          width: wd,
          length: l,
          profitPercentage: publicView ? 5 : profit
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "No matching rate found.");
        setResults(null);
      } else {
        setResults(data);
      }
    } catch (err) {
      setError("Something went wrong while fetching rates.");
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-none mx-auto"
    >
      {/* ──── PUBLIC VIEW ──── */}
      {publicView && (
        <div className="space-y-6">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center leading-snug">
            <span className="bg-linear-to-r from-sky-400 to-blue-500 bg-clip-text text-transparent">One platform —</span>
            <br />
            <span className="text-slate-800">for all your shipping needs</span>
          </h1>

          <div className="rounded-2xl bg-slate-100 p-5 sm:p-7 space-y-5">
            {/* Origin / Destination row */}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-end">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold tracking-wide text-slate-600">Collection from</Label>
                <div className="grid grid-cols-2 gap-2 items-center">
                  <Select onValueChange={(value) => handleSelect(value, "origin")} value={form.origin}>
                    <SelectTrigger className="w-full h-[42px] bg-white border-slate-200 rounded-xl text-sm">
                      <SelectValue placeholder="Select origin" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {countries.map((country) => (
                        <SelectItem key={country.isoCode} value={country.name} className="text-sm">
                          <span className="flex items-center gap-2">
                            <FlagIcon country={country} />
                            <span>{country.name}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    name="originZip"
                    value={form.originZip}
                    onChange={handleChange}
                    placeholder="Zip/Area Code"
                    className="h-[42px] w-full bg-white border-slate-200 rounded-xl text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center justify-center h-11">
                <div className="w-9 h-9 rounded-full bg-sky-100 flex items-center justify-center">
                  <ArrowRight className="w-4 h-4 text-sky-500" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold tracking-wide text-slate-600">Delivery to</Label>
                <div className="grid grid-cols-2 gap-2 items-center">
                  <Select onValueChange={(value) => handleSelect(value, "destination")} value={form.destination}>
                    <SelectTrigger className="w-full h-[42px] bg-white border-slate-200 rounded-xl text-sm">
                      <SelectValue placeholder="Select destination" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {countries.map((country) => (
                        <SelectItem key={country.isoCode} value={country.name} className="text-sm">
                          <span className="flex items-center gap-2">
                            <FlagIcon country={country} />
                            <span>{country.name}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    name="destinationZip"
                    value={form.destinationZip}
                    onChange={handleChange}
                    placeholder="Zip/Area Code"
                    className="h-[42px] w-full bg-white border-slate-200 rounded-xl text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Package type selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold tracking-wide text-slate-600">Type</Label><div className="grid grid-cols-3 gap-2 sm:gap-3">
                {([
                  { value: "Document", label: "Document", icon: Mail },
                  { value: "Non Document", label: "Non Document", icon: Package },
                  { value: "FedEx Pak", label: "FedEx Pak", icon: FileText },
                ] as const).map((pkg) => {
                  const Icon = pkg.icon;
                  const selected = form.docType === pkg.value;
                  return (
                    <button
                      key={pkg.value}
                      type="button"
                      onClick={() => handleSelect(pkg.value, "docType")}
                      className={`flex items-center justify-center gap-2 rounded-xl h-11 text-sm font-medium transition-all border ${
                        selected
                          ? "bg-white border-sky-400 text-sky-600 shadow-sm ring-1 ring-sky-400"
                          : "bg-white/60 border-slate-200 text-slate-600 hover:bg-white hover:border-slate-300"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{pkg.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Weight and dimensions row */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold tracking-wide text-slate-600">Package</Label>
              <div className="grid grid-cols-4 gap-2 sm:gap-3">
                <div className="relative">
                  <Input
                    id="weight" name="weight" type="number" min="0" step="0.1"
                    value={form.weight} onChange={handleChange} placeholder="5"
                    className="h-11 bg-white border-slate-200 rounded-xl text-sm pr-9"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">kg</span>
                </div>
                <div className="relative">
                  <Input
                    id="length" name="length" type="number" min="0"
                    value={form.length} onChange={handleChange} placeholder="0"
                    className="h-11 bg-white border-slate-200 rounded-xl text-sm pr-9"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">cm</span>
                </div>
                <div className="relative">
                  <Input
                    id="width" name="width" type="number" min="0"
                    value={form.width} onChange={handleChange} placeholder="0"
                    className="h-11 bg-white border-slate-200 rounded-xl text-sm pr-9"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">cm</span>
                </div>
                <div className="relative">
                  <Input
                    id="height" name="height" type="number" min="0"
                    value={form.height} onChange={handleChange} placeholder="0"
                    className="h-11 bg-white border-slate-200 rounded-xl text-sm pr-9"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">cm</span>
                </div>
              </div>
            </div>
          </div>

          {/* Calculate button */}
          <div className="flex flex-col items-center gap-3 px-5 sm:px-7">
            <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full">
              <div />
              <Button
                className="h-12 w-full rounded-full bg-linear-to-r from-sky-400 to-blue-500 hover:from-sky-500 hover:to-blue-600 text-white font-semibold text-sm sm:text-base shadow-lg shadow-sky-200/50 transition-all"
                onClick={handleCalculate}
                disabled={loading}
              >
                {loading ? "Calculating..." : "Calculate the Price"}
                {!loading && <ArrowRight className="w-4 h-4 ml-2" />}
              </Button>
              <div />
            </div>
            <p className="text-xs sm:text-sm text-slate-500 text-center">
              Delivery price is based on the greater of actual or volumetric weight. You can calculate the volumetric weight{" "}
              <a
                href="/tools/volumetric-calculator"
                className="underline text-sky-500 hover:text-sky-600 font-medium"
              >
                here
              </a>.
            </p>
          </div>

          {error && (
            <div className="text-red-500 text-center mt-2 font-medium text-xs sm:text-sm">{error}</div>
          )}

          {results && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 sm:mt-6 space-y-3 sm:space-y-4"
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setPublicResultsTab("express")}
                  className={`rounded-full px-4 py-1.5 text-xs sm:text-sm font-semibold border transition-colors ${
                    publicResultsTab === "express"
                      ? "bg-sky-400 text-white border-sky-400 shadow-sm"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Express
                </button>
                <button
                  type="button"
                  onClick={() => setPublicResultsTab("economy")}
                  className={`rounded-full px-4 py-1.5 text-xs sm:text-sm font-semibold border transition-colors ${
                    publicResultsTab === "economy"
                      ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Economy
                </button>
                <button
                  type="button"
                  onClick={() => setPublicResultsTab("all")}
                  className={`rounded-full px-4 py-1.5 text-xs sm:text-sm font-semibold border transition-colors ${
                    publicResultsTab === "all"
                      ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  All
                </button>
              </div>

              {(() => {
                const allRates = results.allRates || [];
                const EXPRESS_SERVICES = ["UPS_C2S", "DHL_LHE", "FedEx_LHE"];
                const ECONOMY_SERVICES = ["SNWWE"];
                const expressRates = allRates.filter(
                  (rate) => rate.service && EXPRESS_SERVICES.includes(rate.service)
                );
                const economyRates = allRates.filter((rate) => {
                  if (rate.service && ECONOMY_SERVICES.includes(rate.service)) return true;
                  const origin = getOriginFromService(rate.service).toUpperCase();
                  return origin === "DUBAI" || origin === "LONDON" || origin === "UK" || origin === "SINGAPORE";
                });
                const rawDisplayRates =
                  publicResultsTab === "express" && expressRates.length > 0
                    ? expressRates
                    : publicResultsTab === "economy" && economyRates.length > 0
                      ? economyRates
                      : allRates;
                const byService = new Map<string, typeof allRates[0]>();
                for (const rate of rawDisplayRates) {
                  const key = rate.service ?? rate.vendor ?? String(Math.random());
                  const existing = byService.get(key);
                  if (!existing || rate.price > existing.price) {
                    byService.set(key, rate);
                  }
                }
                const displayRates = Array.from(byService.values()).sort(
                  (a, b) => a.price - b.price
                );

                return (
                  <div className="space-y-3">
                    {displayRates.map((rate, index) => {
                      const logoSrc = getLogoForService(rate.service);
                      const origin =
                        publicResultsTab === "express"
                          ? "Lahore"
                          : getOriginFromService(rate.service);
                      const rank = index < 3 ? index + 1 : null;
                      return (
                        <div
                          key={`${rate.vendor}-${rate.service}-${rate.weight}-${index}`}
                          className="rounded-xl border border-slate-200 bg-white shadow-sm px-3 sm:px-5 py-2.5 sm:py-3 relative"
                        >
                          {rank !== null && (
                            <span
                              className={`absolute top-2 left-2 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white ${
                                rank === 1 ? "bg-amber-500" : rank === 2 ? "bg-slate-400" : "bg-amber-700"
                              }`}
                              aria-label={`Rank ${rank}`}
                            >
                              {rank}
                            </span>
                          )}
                          <div className="flex items-center justify-between w-full flex-wrap gap-y-2">
                            <div className="flex items-center justify-center rounded-md bg-white border border-slate-200 px-2 py-1.5 shadow-sm shrink-0 w-[72px] h-[40px] sm:w-[90px] sm:h-[46px]">
                              {logoSrc ? (
                                <Image
                                  src={logoSrc}
                                  alt={rate.service || rate.vendor || "Carrier"}
                                  width={80} height={36}
                                  className="h-6 w-auto object-contain sm:h-8"
                                />
                              ) : (
                                <span className="text-[11px] sm:text-xs font-bold text-slate-900 text-center leading-tight">
                                  {rate.vendor || "Carrier"}
                                </span>
                              )}
                            </div>

                            <div className="flex flex-col items-center gap-px shrink-0">
                              <Plane className="w-4 h-4 sm:w-[18px] sm:h-[18px] text-slate-700" />
                              <span className="text-[10px] sm:text-xs font-semibold text-slate-800 text-center leading-tight">{getServiceTypeLabel(rate.service)}</span>
                              <span className="text-[9px] sm:text-[10px] text-slate-500 text-center leading-tight">Origin: {origin}</span>
                            </div>
                            <div className="flex flex-col items-center gap-px shrink-0">
                              <Home className="w-4 h-4 sm:w-[18px] sm:h-[18px] text-slate-700" />
                              <span className="text-[10px] sm:text-xs font-medium text-slate-700 text-center leading-tight">Collection</span>
                              <span className="text-[9px] sm:text-[10px] text-slate-500 text-center leading-tight">Sender address</span>
                            </div>
                            <div className="flex flex-col items-center gap-px shrink-0">
                              <Clock className="w-4 h-4 sm:w-[18px] sm:h-[18px] text-slate-700" />
                              <span className="text-[10px] sm:text-xs font-medium text-slate-700 text-center leading-tight">Delivery</span>
                              <span className="text-[9px] sm:text-[10px] text-slate-500 text-center leading-tight">on average {getDeliveryDays(rate.service, publicResultsTab === "express")}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setInfoModalOpen(true)}
                              className="flex flex-col items-center gap-px shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                            >
                              <Info className="w-4 h-4 sm:w-[18px] sm:h-[18px] text-slate-700" />
                              <span className="text-[10px] sm:text-xs font-medium text-slate-700 text-center leading-tight">Information</span>
                            </button>

                            <div className="text-right shrink-0">
                              <p className="text-base sm:text-lg font-bold text-slate-900 whitespace-nowrap">
                                Rs. {rate.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                              <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">
                                Rs. {(rate.price / rate.weight).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per kg
                              </p>
                            </div>

                            <Link
                              href="/auth/login"
                              className="inline-flex items-center justify-center gap-1 rounded-full border-2 border-sky-400 bg-white px-3.5 py-1.5 text-xs sm:text-sm font-bold text-sky-500 hover:bg-sky-50 transition-colors shrink-0 whitespace-nowrap"
                            >
                              BOOK <span>&#10145;</span>
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </motion.div>
          )}
        </div>
      )}

      {/* ──── DASHBOARD VIEW ──── */}
      {!publicView && (
        <Card className="w-full min-h-[400px] border border-gray-200 dark:border-gray-700 overflow-hidden">
          <CardContent className="p-3 sm:p-4 lg:p-6 overflow-y-auto h-full">
            <h1 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold mb-4 sm:mb-6 lg:mb-8 text-center text-primary">
              Rate Calculator
            </h1>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="origin" className="text-xs sm:text-sm">Origin</Label>
                <Select onValueChange={(value) => handleSelect(value, "origin")} value={form.origin}>
                  <SelectTrigger className="w-full text-xs sm:text-sm">
                    <SelectValue placeholder="Select an origin" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {countries.map((country) => (
                      <SelectItem key={country.isoCode} value={country.name} className="text-xs sm:text-sm">
                        <span className="flex items-center gap-2">
                          <FlagIcon country={country} />
                          <span>{country.name}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="destination" className="text-xs sm:text-sm">Destination</Label>
                <Select onValueChange={(value) => handleSelect(value, "destination")} value={form.destination}>
                  <SelectTrigger className="w-full text-xs sm:text-sm">
                    <SelectValue placeholder="Select a destination" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {countries.map((country) => (
                      <SelectItem key={country.isoCode} value={country.name} className="text-xs sm:text-sm">
                        <span className="flex items-center gap-2">
                          <FlagIcon country={country} />
                          <span>{country.name}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="originZip" className="text-xs sm:text-sm">Origin zip</Label>
                <Input name="originZip" value={form.originZip} onChange={handleChange} placeholder="Zip / Postal code" className="text-xs sm:text-sm" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="destinationZip" className="text-xs sm:text-sm">Destination zip</Label>
                <Input name="destinationZip" value={form.destinationZip} onChange={handleChange} placeholder="Zip / Postal code" className="text-xs sm:text-sm" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="docType" className="text-xs sm:text-sm">Type</Label>
                <Select onValueChange={(value) => handleSelect(value, "docType")} value={form.docType}>
                  <SelectTrigger className="w-full text-xs sm:text-sm">
                    <SelectValue placeholder="Select document type" />
                  </SelectTrigger>
                  <SelectContent>
                    {documentTypes.map((type) => (
                      <SelectItem key={type} value={type} className="text-xs sm:text-sm">{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="weight" className="text-xs sm:text-sm">Weight (kg)</Label>
                <Input id="weight" name="weight" type="number" min="0" step="0.1" value={form.weight} onChange={handleChange} placeholder="0.5" className="text-xs sm:text-sm" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="length" className="text-xs sm:text-sm">Length (cm)</Label>
                <Input id="length" name="length" type="number" min="0" value={form.length} onChange={handleChange} placeholder="0" className="text-xs sm:text-sm" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="width" className="text-xs sm:text-sm">Width (cm)</Label>
                <Input id="width" name="width" type="number" min="0" value={form.width} onChange={handleChange} placeholder="0" className="text-xs sm:text-sm" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="height" className="text-xs sm:text-sm">Height (cm)</Label>
                <Input id="height" name="height" type="number" min="0" value={form.height} onChange={handleChange} placeholder="0" className="text-xs sm:text-sm" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profitPercentage" className="text-xs sm:text-sm">Profit Percentage (%)</Label>
                <Input id="profitPercentage" name="profitPercentage" type="number" min="0" step="0.1" value={form.profitPercentage} onChange={handleChange} placeholder="10" className="text-xs sm:text-sm" />
              </div>
            </div>

            <Button className="w-full mt-4 sm:mt-6 text-sm sm:text-base lg:text-lg" onClick={handleCalculate} disabled={loading}>
              {loading ? "Calculating..." : "Calculate Rate"}
            </Button>

            {error && (
              <div className="text-red-500 text-center mt-4 font-medium text-xs sm:text-sm">{error}</div>
            )}

            {results && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 sm:mt-6 space-y-3 sm:space-y-4"
              >
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
                  {results.top3Rates.map((rate, index) => (
                    <Card 
                      key={index}
                      className={`${
                        index === 0 
                          ? 'bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-700' 
                          : index === 1 
                          ? 'bg-blue-50 dark:bg-blue-950 border-blue-300 dark:border-blue-700'
                          : 'bg-orange-50 dark:bg-orange-950 border-orange-300 dark:border-orange-700'
                      } border`}
                    >
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex flex-col justify-between items-start gap-3 h-full">
                          <div className="w-full">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className={`font-semibold text-sm sm:text-base lg:text-lg ${
                                index === 0 ? 'text-green-800 dark:text-green-200' : index === 1 ? 'text-blue-800 dark:text-blue-200' : 'text-orange-800 dark:text-orange-200'
                              }`}>
                                {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'} {index === 0 ? 'Best' : index === 1 ? '2nd Best' : '3rd Best'} Rate
                              </h3>
                              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                index === 0 ? 'bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200' 
                                  : index === 1 ? 'bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-200'
                                  : 'bg-orange-200 text-orange-800 dark:bg-orange-800 dark:text-orange-200'
                              }`}>
                                #{rate.rank}
                              </span>
                            </div>
                            <p className={`text-xs sm:text-sm mb-2 ${
                              index === 0 ? 'text-green-600 dark:text-green-300' : index === 1 ? 'text-blue-600 dark:text-blue-300' : 'text-orange-600 dark:text-orange-300'
                            }`}>
                              <span className="hidden sm:inline">Country: {rate.country} | Zone: {rate.zone} | Service: {rate.service}</span>
                              <span className="sm:hidden">{rate.country} | Z{rate.zone} | {rate.service}</span>
                            </p>
                            {results.profitPercentage > 0 && (
                              <p className={`text-xs mb-1 ${index === 0 ? 'text-green-500 dark:text-green-400' : index === 1 ? 'text-blue-500 dark:text-blue-400' : 'text-orange-500 dark:text-orange-400'}`}>
                                <span className="hidden sm:inline">Profit: +{results.profitPercentage}% | Original: Rs. {rate.bestRate.originalPrice}</span>
                                <span className="sm:hidden">+{results.profitPercentage}% | Orig: Rs. {rate.bestRate.originalPrice}</span>
                              </p>
                            )}
                            {results.fixedCharge && (
                              <p className={`text-xs ${index === 0 ? 'text-green-500 dark:text-green-400' : index === 1 ? 'text-blue-500 dark:text-blue-400' : 'text-orange-500 dark:text-orange-400'}`}>
                                <span className="hidden sm:inline">Total: Rs. {rate.bestRate.price}</span>
                                <span className="sm:hidden">Total: Rs. {rate.bestRate.price}</span>
                              </p>
                            )}
                          </div>
                          <div className="w-full text-left">
                            <p className={`text-sm sm:text-base lg:text-lg font-bold ${
                              index === 0 ? 'text-green-800 dark:text-green-200' : index === 1 ? 'text-blue-800 dark:text-blue-200' : 'text-orange-800 dark:text-orange-200'
                            }`}>
                              Rs. {rate.bestRate.price}
                            </p>
                            <p className={`text-xs sm:text-sm ${
                              index === 0 ? 'text-green-600 dark:text-green-300' : index === 1 ? 'text-blue-600 dark:text-blue-300' : 'text-orange-600 dark:text-orange-300'
                            }`}>
                              <span className="hidden sm:inline">Weight: {rate.bestRate.weight}kg | Vendor: {rate.bestRate.vendor}</span>
                              <span className="sm:hidden">{rate.bestRate.weight}kg | {rate.bestRate.vendor}</span>
                            </p>
                            <p className={`text-xs ${index === 0 ? 'text-green-500 dark:text-green-400' : index === 1 ? 'text-blue-500 dark:text-blue-400' : 'text-orange-500 dark:text-orange-400'}`}>
                              <span className="hidden sm:inline">Price per kg: Rs. {((rate.bestRate.price) / rate.bestRate.weight).toFixed(2)}</span>
                              <span className="sm:hidden">Rs. {((rate.bestRate.price) / rate.bestRate.weight).toFixed(2)}/kg</span>
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Card>
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3 sm:mb-4">
                      <h3 className="font-semibold text-sm sm:text-base lg:text-lg">
                        All Available Rates ({results.zones.length} zones)
                      </h3>
                      {results.fixedCharge && (
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={showFixedCharges}
                            onCheckedChange={(checked) => setShowFixedCharges(!!checked)}
                            className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                          />
                          <Label className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">Show Charges</Label>
                        </div>
                      )}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs sm:text-sm border-separate border-spacing-y-1 sm:border-spacing-y-2">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-2 sm:px-4">Vendor</th>
                            <th className="text-left py-2 px-2 sm:px-4">Zone</th>
                            <th className="text-left py-2 px-2 sm:px-4">Service</th>
                            <th className="text-left py-2 px-2 sm:px-4">Weight (kg)</th>
                            {results.fixedCharge && !showFixedCharges && (
                              <th className="text-left py-2 px-2 sm:px-4">Fixed Charge (Rs.)</th>
                            )}
                            <th className="text-left py-2 px-2 sm:px-4">Original Price (Rs.)</th>
                            <th className="text-left py-2 px-2 sm:px-4">Final Price (Rs.)</th>
                            <th className="text-left py-2 px-2 sm:px-4">Price per kg (Rs.)</th>
                            <th className="text-left py-2 px-2 sm:px-4">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {results.allRates.map((rate, index) => {
                            const topRate = results.top3Rates.find(topRate => 
                              rate.zone === topRate.zone && rate.weight === topRate.bestRate.weight && rate.price === topRate.bestRate.price
                            );
                            let rowBgColor = '';
                            if (topRate) {
                              if (topRate.rank === 1) rowBgColor = 'bg-green-50 dark:bg-green-950';
                              else if (topRate.rank === 2) rowBgColor = 'bg-blue-50 dark:bg-blue-950';
                              else if (topRate.rank === 3) rowBgColor = 'bg-orange-50 dark:bg-orange-950';
                            }
                            return (
                              <tr key={index} className={`border-b hover:bg-gray-50 dark:hover:bg-gray-800 ${rowBgColor}`}>
                                <td className="py-2 px-2 sm:px-4 font-medium">{rate.vendor}</td>
                                <td className="py-2 px-2 sm:px-4">{rate.zone}</td>
                                <td className="py-2 sm:px-4">{rate.service}</td>
                                <td className="py-2 px-2 sm:px-4">{rate.weight}</td>
                                {results.fixedCharge && !showFixedCharges && (
                                  <td className="py-2 px-2 sm:px-4 text-purple-600 dark:text-purple-400">{results.fixedCharge.amount}</td>
                                )}
                                <td className="py-2 px-2 sm:px-4 text-gray-600 dark:text-gray-400">{rate.originalPrice}</td>
                                <td className="py-2 px-2 sm:px-4 font-medium">{rate.price}</td>
                                <td className="py-2 px-2 sm:px-4 text-blue-600 dark:text-blue-400">{((rate.price)/ rate.weight).toFixed(2)}</td>
                                <td className="py-2 px-2 sm:px-4">
                                  {topRate ? (
                                    <span className={`font-medium ${topRate.rank === 1 ? 'text-green-600 dark:text-green-400' : topRate.rank === 2 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
                                      {topRate.rank === 1 ? '🥇 Best' : topRate.rank === 2 ? '🥈 2nd' : '🥉 3rd'}
                                    </span>
                                  ) : (
                                    <span className="text-gray-500">Available</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Information modal (public rate calculator) */}
      {publicView && (
        <Dialog open={infoModalOpen} onOpenChange={setInfoModalOpen}>
          <DialogContent
            size="5xl"
            className="max-h-[90vh] overflow-y-auto border-0 bg-[#1e3a5f] text-white p-0 gap-0 [&_button]:text-white [&_button:hover]:text-white/90"
            showCloseButton={true}
          >
            <DialogTitle className="sr-only">Service information</DialogTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 sm:p-8">
              <div className="space-y-6">
                <section>
                  <div className="flex items-center gap-2 mb-2">
                    <Truck className="w-5 h-5 shrink-0" />
                    <h3 className="font-bold text-sm uppercase tracking-wide">Delivery term</h3>
                  </div>
                  <p className="text-sm text-white/95 leading-relaxed">
                    Please note that the delivery times given in the calculator are not very precise, please refer to the timescales below.
                    When sending a shipment outside the EU, the consignee is responsible for customs formalities. The customs brokers of the chosen carrier will contact the consignee directly, and <strong>PSS Worldwide is not involved in customs procedures.</strong>
                    When sending more than one package, the boxes may be separated during transit and delivered at different times.
                  </p>
                </section>
                <section>
                  <div className="flex items-center gap-2 mb-2">
                    <Home className="w-5 h-5 shrink-0" />
                    <h3 className="font-bold text-sm uppercase tracking-wide">Collection address</h3>
                  </div>
                  <p className="text-sm text-white/95 leading-relaxed">
                    Parcels are collected from home/work addresses on weekdays 09:00 to 17:00 hrs., depending on the sender&apos;s location.
                    Courier call may not be available in all areas. If the courier cannot arrive, the package must be delivered to the nearest collection point. You can find the nearest location by clicking here.
                  </p>
                </section>
                <section>
                  <div className="flex items-center gap-2 mb-2">
                    <PackageSearch className="w-5 h-5 shrink-0" />
                    <h3 className="font-bold text-sm uppercase tracking-wide">Parcel tracking</h3>
                  </div>
                  <p className="text-sm text-white/95 leading-relaxed">Trackable service.</p>
                </section>
              </div>
              <div className="space-y-6">
                <section>
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-5 h-5 shrink-0" />
                    <h3 className="font-bold text-sm uppercase tracking-wide">Cover</h3>
                  </div>
                  <p className="text-sm text-white/95 leading-relaxed">
                    Free standard cover of up to 100 EUR per parcel.
                    Neither the Standard nor the Supplementary insurance is valid for Forbidden Items and Non-Refundable Items. Prohibited items
                  </p>
                </section>
                <section>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <h3 className="font-bold text-sm uppercase tracking-wide">Features and restrictions</h3>
                  </div>
                  <p className="text-sm text-white/95 leading-relaxed">
                    Max. weight - 68 kg.
                    Max. length - 240 cm.
                    This service uses the greater of actual weight and volumetric weight when calculating price. If the dimensions and weight of the shipment provided during the order do not correspond to the exact data - the price of the service may be recalculated after the order is submitted.
                  </p>
                </section>
                <section>
                  <div className="flex items-center gap-2 mb-2">
                    <Printer className="w-5 h-5 shrink-0" />
                    <h3 className="font-bold text-sm uppercase tracking-wide">Printer</h3>
                  </div>
                  <p className="text-sm text-white/95 leading-relaxed">
                    Print and attach the shipping documents in a clearly visible place of the packaging (documents will be sent within 15-20 min. after successful payment).
                  </p>
                </section>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </motion.div>
  );
}
