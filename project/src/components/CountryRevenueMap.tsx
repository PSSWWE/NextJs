"use client";

import { useMemo, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import { getCountryNameFromCode } from "@/lib/utils";

const GEO_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

type RevenueItem = { destination: string; revenue: number; shipments: number };

type Props = {
  data: RevenueItem[];
  onHoverCountry?: (isoCode: string | null) => void;
};

const ISO3_TO_ISO2: Record<string, string> = {
  AFG: "AF", ALB: "AL", DZA: "DZ", AND: "AD", AGO: "AO", ATG: "AG",
  ARG: "AR", ARM: "AM", AUS: "AU", AUT: "AT", AZE: "AZ", BHS: "BS",
  BHR: "BH", BGD: "BD", BRB: "BB", BLR: "BY", BEL: "BE", BLZ: "BZ",
  BEN: "BJ", BTN: "BT", BOL: "BO", BIH: "BA", BWA: "BW", BRA: "BR",
  BRN: "BN", BGR: "BG", BFA: "BF", BDI: "BI", KHM: "KH", CMR: "CM",
  CAN: "CA", CPV: "CV", CAF: "CF", TCD: "TD", CHL: "CL", CHN: "CN",
  COL: "CO", COM: "KM", COG: "CG", COD: "CD", CRI: "CR", CIV: "CI",
  HRV: "HR", CUB: "CU", CYP: "CY", CZE: "CZ", DNK: "DK", DJI: "DJ",
  DMA: "DM", DOM: "DO", ECU: "EC", EGY: "EG", SLV: "SV", GNQ: "GQ",
  ERI: "ER", EST: "EE", SWZ: "SZ", ETH: "ET", FJI: "FJ", FIN: "FI",
  FRA: "FR", GAB: "GA", GMB: "GM", GEO: "GE", DEU: "DE", GHA: "GH",
  GRC: "GR", GRD: "GD", GTM: "GT", GIN: "GN", GNB: "GW", GUY: "GY",
  HTI: "HT", HND: "HN", HUN: "HU", ISL: "IS", IND: "IN", IDN: "ID",
  IRN: "IR", IRQ: "IQ", IRL: "IE", ISR: "IL", ITA: "IT", JAM: "JM",
  JPN: "JP", JOR: "JO", KAZ: "KZ", KEN: "KE", KIR: "KI", PRK: "KP",
  KOR: "KR", KWT: "KW", KGZ: "KG", LAO: "LA", LVA: "LV", LBN: "LB",
  LSO: "LS", LBR: "LR", LBY: "LY", LIE: "LI", LTU: "LT", LUX: "LU",
  MDG: "MG", MWI: "MW", MYS: "MY", MDV: "MV", MLI: "ML", MLT: "MT",
  MHL: "MH", MRT: "MR", MUS: "MU", MEX: "MX", FSM: "FM", MDA: "MD",
  MCO: "MC", MNG: "MN", MNE: "ME", MAR: "MA", MOZ: "MZ", MMR: "MM",
  NAM: "NA", NRU: "NR", NPL: "NP", NLD: "NL", NZL: "NZ", NIC: "NI",
  NER: "NE", NGA: "NG", MKD: "MK", NOR: "NO", OMN: "OM", PAK: "PK",
  PLW: "PW", PAN: "PA", PNG: "PG", PRY: "PY", PER: "PE", PHL: "PH",
  POL: "PL", PRT: "PT", QAT: "QA", ROU: "RO", RUS: "RU", RWA: "RW",
  KNA: "KN", LCA: "LC", VCT: "VC", WSM: "WS", SMR: "SM", STP: "ST",
  SAU: "SA", SEN: "SN", SRB: "RS", SYC: "SC", SLE: "SL", SGP: "SG",
  SVK: "SK", SVN: "SI", SLB: "SB", SOM: "SO", ZAF: "ZA", SSD: "SS",
  ESP: "ES", LKA: "LK", SDN: "SD", SUR: "SR", SWE: "SE", CHE: "CH",
  SYR: "SY", TWN: "TW", TJK: "TJ", TZA: "TZ", THA: "TH", TLS: "TL",
  TGO: "TG", TON: "TO", TTO: "TT", TUN: "TN", TUR: "TR", TKM: "TM",
  TUV: "TV", UGA: "UG", UKR: "UA", ARE: "AE", GBR: "GB", USA: "US",
  URY: "UY", UZB: "UZ", VUT: "VU", VEN: "VE", VNM: "VN", YEM: "YE",
  ZMB: "ZM", ZWE: "ZW", PSE: "PS", XKX: "XK", SDS: "SD",
};

function colorForRatio(ratio: number): string {
  if (ratio > 0.8) return "#1d4ed8";
  if (ratio > 0.6) return "#2563eb";
  if (ratio > 0.4) return "#3b82f6";
  if (ratio > 0.2) return "#60a5fa";
  if (ratio > 0) return "#93c5fd";
  return "#f3f4f6";
}

export default function CountryRevenueMap({ data, onHoverCountry }: Props) {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    name: string;
    revenue: number;
    shipments: number;
  } | null>(null);

  const revenueByIso2 = useMemo(() => {
    const out: Record<string, { revenue: number; shipments: number }> = {};
    data.forEach((d) => {
      const iso = (d.destination || "").trim().toUpperCase();
      if (iso && d.revenue > 0) {
        const prev = out[iso] || { revenue: 0, shipments: 0 };
        out[iso] = {
          revenue: prev.revenue + d.revenue,
          shipments: prev.shipments + d.shipments,
        };
      }
    });
    return out;
  }, [data]);

  const maxRevenue = useMemo(
    () => Math.max(1, ...Object.values(revenueByIso2).map((v) => v.revenue)),
    [revenueByIso2]
  );

  return (
    <div className="relative">
      <ComposableMap
        projectionConfig={{ rotate: [-10, 0, 0], scale: 147 }}
        height={400}
        style={{ width: "100%", height: "auto" }}
      >
        <ZoomableGroup center={[0, 20]} zoom={1}>
          <Geographies geography={GEO_URL}>
            {({ geographies }: { geographies: any[] }) =>
              geographies.map((geo) => {
                const iso3: string = geo.properties?.ISO_A3 || geo.id || "";
                const iso2 = ISO3_TO_ISO2[iso3] || "";
                const entry = revenueByIso2[iso2];
                const ratio = entry ? entry.revenue / maxRevenue : 0;
                const fill = entry ? colorForRatio(ratio) : "#f3f4f6";

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={fill}
                    stroke="#d1d5db"
                    strokeWidth={0.5}
                    onMouseEnter={(evt: React.MouseEvent<SVGPathElement>) => {
                      const name =
                        getCountryNameFromCode(iso2) ||
                        geo.properties?.name ||
                        iso3;
                      setTooltip({
                        x: evt.clientX,
                        y: evt.clientY,
                        name,
                        revenue: entry?.revenue || 0,
                        shipments: entry?.shipments || 0,
                      });
                      onHoverCountry?.(iso2 || null);
                    }}
                    onMouseMove={(evt: React.MouseEvent<SVGPathElement>) => {
                      setTooltip((prev) =>
                        prev ? { ...prev, x: evt.clientX, y: evt.clientY } : prev
                      );
                    }}
                    onMouseLeave={() => {
                      setTooltip(null);
                      onHoverCountry?.(null);
                    }}
                    style={{
                      default: { outline: "none" },
                      hover: {
                        fill: entry ? "#1e40af" : "#e5e7eb",
                        stroke: "#fff",
                        strokeWidth: 1.5,
                        outline: "none",
                        cursor: "pointer",
                      },
                      pressed: { outline: "none" },
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-lg"
          style={{ left: tooltip.x + 12, top: tooltip.y - 40 }}
        >
          <div className="font-semibold text-sm">{tooltip.name}</div>
          {tooltip.revenue > 0 ? (
            <>
              <div className="mt-1 text-gray-300">
                Revenue:{" "}
                <span className="text-white font-medium">
                  {tooltip.revenue.toLocaleString()}
                </span>
              </div>
              <div className="text-gray-300">
                Shipments:{" "}
                <span className="text-white font-medium">
                  {tooltip.shipments.toLocaleString()}
                </span>
              </div>
            </>
          ) : (
            <div className="mt-1 text-gray-400">No revenue data</div>
          )}
        </div>
      )}

      <div className="flex items-center justify-center gap-2 mt-2 text-[10px] text-gray-500 dark:text-gray-400">
        <span>Low</span>
        <div className="flex h-2 rounded overflow-hidden">
          {["#93c5fd", "#60a5fa", "#3b82f6", "#2563eb", "#1d4ed8"].map((c) => (
            <div key={c} className="w-6" style={{ background: c }} />
          ))}
        </div>
        <span>High revenue</span>
      </div>
    </div>
  );
}
