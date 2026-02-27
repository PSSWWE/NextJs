"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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
import { Plane, Shield, Info, Printer, Clock } from "lucide-react";

const documentTypes = [
  "Document",
  "Non Document",
  "FedEx Pak"
];

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
    docType: "",
    profitPercentage: publicView ? "10" : "0",
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
  const [publicResultsTab, setPublicResultsTab] = useState<"all" | "express">("all");

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
    const { weight, length, width, height, origin, destination, docType, profitPercentage } = form;
    const w = parseFloat(weight);
    const l = parseFloat(length);
    const wd = parseFloat(width);
    const h = parseFloat(height);
    const profit = publicView ? 10 : parseFloat(profitPercentage);

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
          weight: w,
          docType,
          height: h,
          width: wd,
          length: l,
          profitPercentage: publicView ? 10 : profit
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
                    <SelectItem 
                      key={country.isoCode} 
                      value={country.name}
                      className={`text-xs sm:text-sm ${
                        form.origin === country.name 
                          ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 font-medium' 
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {country.name}
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
                    <SelectItem 
                      key={country.isoCode} 
                      value={country.name}
                      className={`text-xs sm:text-sm ${
                        form.destination === country.name 
                          ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 font-medium' 
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {country.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="docType" className="text-xs sm:text-sm">Type</Label>
              <Select onValueChange={(value) => handleSelect(value, "docType")} value={form.docType}>
                <SelectTrigger className="w-full text-xs sm:text-sm">
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  {documentTypes.map((type) => (
                    <SelectItem 
                      key={type} 
                      value={type}
                      className={`text-xs sm:text-sm ${
                        form.docType === type 
                          ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 font-medium' 
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="weight" className="text-xs sm:text-sm">Weight (kg)</Label>
              <Input
                id="weight"
                name="weight"
                type="number"
                min="0"
                step="0.1"
                value={form.weight}
                onChange={handleChange}
                placeholder="0.5"
                className="text-xs sm:text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="length" className="text-xs sm:text-sm">Length (cm)</Label>
              <Input
                id="length"
                name="length"
                type="number"
                min="0"
                value={form.length}
                onChange={handleChange}
                placeholder="0"
                className="text-xs sm:text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="width" className="text-xs sm:text-sm">Width (cm)</Label>
              <Input
                id="width"
                name="width"
                type="number"
                min="0"
                value={form.width}
                onChange={handleChange}
                placeholder="0"
                className="text-xs sm:text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="height" className="text-xs sm:text-sm">Height (cm)</Label>
              <Input
                id="height"
                name="height"
                type="number"
                min="0"
                value={form.height}
                onChange={handleChange}
                placeholder="0"
                className="text-xs sm:text-sm"
              />
            </div>

            {!publicView && (
              <div className="space-y-2">
                <Label htmlFor="profitPercentage" className="text-xs sm:text-sm">Profit Percentage (%)</Label>
                <Input
                  id="profitPercentage"
                  name="profitPercentage"
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.profitPercentage}
                  onChange={handleChange}
                  placeholder="10"
                  className="text-xs sm:text-sm"
                />
              </div>
            )}
          </div>

          <Button 
            className="w-full mt-4 sm:mt-6 text-sm sm:text-base lg:text-lg" 
            onClick={handleCalculate}
            disabled={loading}
          >
            {loading ? "Calculating..." : "Calculate Rate"}
          </Button>

          {error && (
            <div className="text-red-500 text-center mt-4 font-medium text-xs sm:text-sm">
              {error}
            </div>
          )}

          {results && !publicView && (
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
                    {!publicView && results.fixedCharge && (
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={showFixedCharges}
                          onCheckedChange={(checked) => setShowFixedCharges(!!checked)}
                          className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                        />
                        <Label className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                          Show Charges
                        </Label>
                      </div>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs sm:text-sm border-separate border-spacing-y-1 sm:border-spacing-y-2">
                      <thead>
                        <tr className="border-b">
                          {!publicView && (
                            <th className="text-left py-2 px-2 sm:px-4"><span className="hidden sm:inline">Vendor</span><span className="sm:hidden">V</span></th>
                          )}
                          <th className="text-left py-2 px-2 sm:px-4"><span className="hidden sm:inline">Zone</span><span className="sm:hidden">Z</span></th>
                          <th className="text-left py-2 px-2 sm:px-4"><span className="hidden sm:inline">Service</span><span className="sm:hidden">Svc</span></th>
                          <th className="text-left py-2 px-2 sm:px-4"><span className="hidden sm:inline">Weight (kg)</span><span className="sm:hidden">W</span></th>
                          {!publicView && results.fixedCharge && !showFixedCharges && (
                            <th className="text-left py-2 px-2 sm:px-4"><span className="hidden sm:inline">Fixed Charge (Rs.)</span><span className="sm:hidden">Fixed</span></th>
                          )}
                          {!publicView && (
                            <th className="text-left py-2 px-2 sm:px-4"><span className="hidden sm:inline">Original Price (Rs.)</span><span className="sm:hidden">Orig</span></th>
                          )}
                          <th className="text-left py-2 px-2 sm:px-4"><span className="hidden sm:inline">Final Price (Rs.)</span><span className="sm:hidden">Final</span></th>
                          <th className="text-left py-2 px-2 sm:px-4"><span className="hidden sm:inline">Price per kg (Rs.)</span><span className="sm:hidden">Rs/kg</span></th>
                          {!publicView && (
                            <th className="text-left py-2 px-2 sm:px-4"><span className="hidden sm:inline">Status</span><span className="sm:hidden">S</span></th>
                          )}
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
                            <tr key={index} className={`border-b hover:bg-gray-50 dark:hover:bg-gray-800 ${!publicView ? rowBgColor : ""}`}>
                              {!publicView && (
                                <td className="py-2 px-2 sm:px-4 font-medium">
                                  <span className="hidden sm:inline">{rate.vendor}</span>
                                  <span className="sm:hidden">{rate.vendor?.substring(0, 6)}...</span>
                                </td>
                              )}
                              <td className="py-2 px-2 sm:px-4">{rate.zone}</td>
                              <td className="py-2 sm:px-4">
                                <span className="hidden sm:inline">{rate.service}</span>
                                <span className="sm:hidden">{rate.service?.substring(0, 8)}...</span>
                              </td>
                              <td className="py-2 px-2 sm:px-4">{rate.weight}</td>
                              {!publicView && results.fixedCharge && !showFixedCharges && (
                                <td className="py-2 px-2 sm:px-4 text-purple-600 dark:text-purple-400">{results.fixedCharge.amount}</td>
                              )}
                              {!publicView && (
                                <td className="py-2 px-2 sm:px-4 text-gray-600 dark:text-gray-400">{rate.originalPrice}</td>
                              )}
                              <td className="py-2 px-2 sm:px-4 font-medium">{rate.price}</td>
                              <td className="py-2 px-2 sm:px-4 text-blue-600 dark:text-blue-400">{((rate.price)/ rate.weight).toFixed(2)}</td>
                              {!publicView && (
                                <td className="py-2 px-2 sm:px-4">
                                  {topRate ? (
                                    <span className={`font-medium ${topRate.rank === 1 ? 'text-green-600 dark:text-green-400' : topRate.rank === 2 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
                                      {topRate.rank === 1 ? '🥇 Best' : topRate.rank === 2 ? '🥈 2nd' : '🥉 3rd'}
                                  </span>
                                ) : (
                                  <span className="text-gray-500"><span className="hidden sm:inline">Available</span><span className="sm:hidden">Avail</span></span>
                                )}
                                </td>
                              )}
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

          {results && publicView && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 sm:mt-6 space-y-3 sm:space-y-4"
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setPublicResultsTab("all")}
                  className={`rounded-full px-4 py-1.5 text-xs sm:text-sm font-semibold border transition-colors ${
                    publicResultsTab === "all"
                      ? "bg-sky-400 text-white border-sky-400 shadow-sm"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setPublicResultsTab("express")}
                  className={`rounded-full px-4 py-1.5 text-xs sm:text-sm font-semibold border transition-colors ${
                    publicResultsTab === "express"
                      ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Express
                </button>
              </div>

              {(() => {
                const allRates = results.allRates || [];
                const expressRates = allRates.filter((rate) =>
                  /express/i.test(rate.service) ||
                  /priority/i.test(rate.service)
                );
                const displayRates =
                  publicResultsTab === "express" && expressRates.length > 0
                    ? expressRates
                    : allRates;

                return (
                  <div className="space-y-3 sm:space-y-4">
                    {displayRates.map((rate, index) => {
                      const serviceLabel =
                        publicResultsTab === "express"
                          ? `${rate.service} LHR`
                          : rate.service;
                      return (
                        <div
                          key={`${rate.vendor}-${rate.service}-${rate.weight}-${index}`}
                          className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white shadow-sm px-4 sm:px-6 py-3 sm:py-4"
                        >
                          <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
                            <div className="flex items-center justify-center rounded-lg bg-white border border-slate-200 px-3 py-2 shadow-sm">
                              <span className="text-sm sm:text-base font-semibold text-slate-900">
                                {rate.vendor || "Carrier"}
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <p className="text-sm sm:text-base font-semibold text-slate-900">
                                {serviceLabel}
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] sm:text-xs text-slate-600">
                                <span className="inline-flex items-center gap-1">
                                  <Plane className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500" />
                                  <span>International Priority</span>
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <Info className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500" />
                                  <span>Collection at sender address</span>
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500" />
                                  <span>Delivery 1–6 business days</span>
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <Printer className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500" />
                                  <span>Printer required</span>
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <Shield className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500" />
                                  <span>Insurance options</span>
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                            <div className="text-right">
                              <p className="text-lg sm:text-xl font-bold text-slate-900">
                                Rs. {rate.price.toFixed(2)}
                              </p>
                              <p className="text-[11px] sm:text-xs text-slate-500">
                                {rate.weight} kg
                              </p>
                            </div>
                            <Link
                              href="/auth/login"
                              className="inline-flex items-center justify-center rounded-full bg-sky-400 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
                            >
                              Book
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
        </CardContent>
      </Card>
    </motion.div>
  );
}
