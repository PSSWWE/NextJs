"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { FeatureCollection, Feature, Geometry } from "geojson";
import { getCountryNameFromCode } from "@/lib/utils";

const GEO_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

type RevenueItem = { destination: string; revenue: number; shipments: number };

type CountryInfo = {
  iso: string;
  name: string;
  revenue: number;
  shipments: number;
};

type Props = {
  data: RevenueItem[];
  onHoverCountry?: (isoCode: string | null) => void;
  onClickCountry?: (info: CountryInfo | null) => void;
  onFullscreen?: () => void;
};

type CountryFeature = Feature<Geometry, { name: string }> & { id?: string };

const ISO_NUM_TO_ISO2: Record<string, string> = {
  "004":"AF","008":"AL","012":"DZ","020":"AD","024":"AO","028":"AG",
  "032":"AR","051":"AM","036":"AU","040":"AT","031":"AZ","044":"BS",
  "048":"BH","050":"BD","052":"BB","112":"BY","056":"BE","084":"BZ",
  "204":"BJ","064":"BT","068":"BO","070":"BA","072":"BW","076":"BR",
  "096":"BN","100":"BG","854":"BF","108":"BI","116":"KH","120":"CM",
  "124":"CA","132":"CV","140":"CF","148":"TD","152":"CL","156":"CN",
  "170":"CO","174":"KM","178":"CG","180":"CD","188":"CR","384":"CI",
  "191":"HR","192":"CU","196":"CY","203":"CZ","208":"DK","262":"DJ",
  "212":"DM","214":"DO","218":"EC","818":"EG","222":"SV","226":"GQ",
  "232":"ER","233":"EE","748":"SZ","231":"ET","242":"FJ","246":"FI",
  "250":"FR","266":"GA","270":"GM","268":"GE","276":"DE","288":"GH",
  "300":"GR","308":"GD","320":"GT","324":"GN","624":"GW","328":"GY",
  "332":"HT","340":"HN","348":"HU","352":"IS","356":"IN","360":"ID",
  "364":"IR","368":"IQ","372":"IE","376":"IL","380":"IT","388":"JM",
  "392":"JP","400":"JO","398":"KZ","404":"KE","296":"KI","408":"KP",
  "410":"KR","414":"KW","417":"KG","418":"LA","428":"LV","422":"LB",
  "426":"LS","430":"LR","434":"LY","438":"LI","440":"LT","442":"LU",
  "450":"MG","454":"MW","458":"MY","462":"MV","466":"ML","470":"MT",
  "584":"MH","478":"MR","480":"MU","484":"MX","583":"FM","498":"MD",
  "492":"MC","496":"MN","499":"ME","504":"MA","508":"MZ","104":"MM",
  "516":"NA","520":"NR","524":"NP","528":"NL","554":"NZ","558":"NI",
  "562":"NE","566":"NG","807":"MK","578":"NO","512":"OM","586":"PK",
  "585":"PW","591":"PA","598":"PG","600":"PY","604":"PE","608":"PH",
  "616":"PL","620":"PT","634":"QA","642":"RO","643":"RU","646":"RW",
  "659":"KN","662":"LC","670":"VC","882":"WS","674":"SM","678":"ST",
  "682":"SA","686":"SN","688":"RS","690":"SC","694":"SL","702":"SG",
  "703":"SK","705":"SI","090":"SB","706":"SO","710":"ZA","728":"SS",
  "724":"ES","144":"LK","729":"SD","740":"SR","752":"SE","756":"CH",
  "760":"SY","158":"TW","762":"TJ","834":"TZ","764":"TH","626":"TL",
  "768":"TG","776":"TO","780":"TT","788":"TN","792":"TR","795":"TM",
  "798":"TV","800":"UG","804":"UA","784":"AE","826":"GB","840":"US",
  "858":"UY","860":"UZ","548":"VU","862":"VE","704":"VN","887":"YE",
  "894":"ZM","716":"ZW","275":"PS","-99":"XK",
};

const PALETTE = ["#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ef4444"];

const ANTARCTICA_ID = "010";

const BASE_WIDTH = 960;
const BASE_HEIGHT = 460;
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

const baseProjection = geoNaturalEarth1()
  .scale(185)
  .translate([BASE_WIDTH / 2 - 35, BASE_HEIGHT / 2 + 35]);

const basePath = geoPath().projection(baseProjection);

export default function CountryRevenueMap({ data, onHoverCountry, onClickCountry, onFullscreen }: Props) {
  const [features, setFeatures] = useState<CountryFeature[]>([]);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    name: string;
    revenue: number;
    shipments: number;
  } | null>(null);
  const [selected, setSelected] = useState<CountryInfo | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(GEO_URL)
      .then((r) => r.json())
      .then((topo: Topology) => {
        const geom = topo.objects.countries as GeometryCollection;
        const fc = feature(topo, geom) as unknown as FeatureCollection<Geometry, { name: string }>;
        setFeatures(
          (fc.features as CountryFeature[]).filter((f) => f.id !== ANTARCTICA_ID)
        );
      })
      .catch(() => {});
  }, []);

  const revenueByIso2 = useMemo(() => {
    const out: Record<string, { revenue: number; shipments: number }> = {};
    data.forEach((d) => {
      const iso = (d.destination || "").trim().toUpperCase();
      if (iso && (d.revenue > 0 || d.shipments > 0)) {
        const prev = out[iso] || { revenue: 0, shipments: 0 };
        out[iso] = {
          revenue: prev.revenue + d.revenue,
          shipments: prev.shipments + d.shipments,
        };
      }
    });
    return out;
  }, [data]);

  const colorByIso2 = useMemo(() => {
    const byIso: Record<string, string> = {};
    const entries = Object.entries(revenueByIso2).filter(([, v]) => v.shipments > 0);

    const positives = entries
      .filter(([, v]) => v.revenue > 0)
      .sort((a, b) => a[1].revenue - b[1].revenue);

    const denom = Math.max(1, positives.length - 1);
    positives.forEach(([iso], idx) => {
      const bucket = Math.round((idx / denom) * (PALETTE.length - 1));
      byIso[iso] = PALETTE[bucket];
    });

    // Shipments with zero revenue still get a visible color.
    entries
      .filter(([iso, v]) => !byIso[iso] && v.shipments > 0)
      .forEach(([iso]) => {
        byIso[iso] = "#a3e635";
      });

    return byIso;
  }, [revenueByIso2]);

  const handleZoom = useCallback((delta: number) => {
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + delta)));
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    handleZoom(e.deltaY < 0 ? 0.3 : -0.3);
  }, [handleZoom]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }, [pan]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPan({ x: dragStart.current.panX + dx, y: dragStart.current.panY + dy });
  }, [dragging]);

  const handlePointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  const handleReset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelected(null);
    onClickCountry?.(null);
  }, [onClickCountry]);

  if (features.length === 0) {
    return (
      <div className="h-[400px] flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
        Loading map...
      </div>
    );
  }

  const tx = BASE_WIDTH / 2 + pan.x / (containerRef.current?.clientWidth || 1) * BASE_WIDTH;
  const ty = BASE_HEIGHT / 2 + pan.y / (containerRef.current?.clientHeight || 1) * BASE_HEIGHT;

  return (
    <div className="relative select-none" ref={containerRef}>
      <div
        className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700"
        style={{ cursor: dragging ? "grabbing" : "grab" }}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <svg
          viewBox={`0 0 ${BASE_WIDTH} ${BASE_HEIGHT}`}
          className="w-full h-auto"
          style={{ maxHeight: 460 }}
        >
          <g transform={`translate(${tx}, ${ty}) scale(${zoom}) translate(${-BASE_WIDTH / 2}, ${-BASE_HEIGHT / 2})`}>
            {features.map((f) => {
              const numericId = f.id || "";
              const iso2 = ISO_NUM_TO_ISO2[numericId] || "";
              const entry = revenueByIso2[iso2];
              const isSelected = selected?.iso === iso2 && iso2 !== "";
              const fill = isSelected
                ? "#7c3aed"
                : colorByIso2[iso2] || "#e5e7eb";
              const d = basePath(f) || "";

              return (
                <path
                  key={numericId || Math.random()}
                  d={d}
                  fill={fill}
                  stroke={isSelected ? "#fff" : "#9ca3af"}
                  strokeWidth={isSelected ? 1.5 / zoom : 0.5 / zoom}
                  onMouseEnter={(evt) => {
                    const name =
                      getCountryNameFromCode(iso2) ||
                      f.properties?.name ||
                      numericId;
                    setTooltip({
                      x: evt.clientX,
                      y: evt.clientY,
                      name,
                      revenue: entry?.revenue || 0,
                      shipments: entry?.shipments || 0,
                    });
                    onHoverCountry?.(iso2 || null);
                    if (!isSelected) {
                      (evt.target as SVGPathElement).setAttribute(
                        "fill",
                        entry ? "#c2410c" : "#d1d5db"
                      );
                      (evt.target as SVGPathElement).setAttribute("stroke", "#fff");
                      (evt.target as SVGPathElement).setAttribute(
                        "stroke-width",
                        String(1.5 / zoom)
                      );
                    }
                  }}
                  onMouseMove={(evt) => {
                    setTooltip((prev) =>
                      prev ? { ...prev, x: evt.clientX, y: evt.clientY } : prev
                    );
                  }}
                  onMouseLeave={(evt) => {
                    setTooltip(null);
                    onHoverCountry?.(null);
                    if (!isSelected) {
                      (evt.target as SVGPathElement).setAttribute("fill", fill);
                      (evt.target as SVGPathElement).setAttribute("stroke", "#9ca3af");
                      (evt.target as SVGPathElement).setAttribute(
                        "stroke-width",
                        String(0.5 / zoom)
                      );
                    }
                  }}
                  onClick={() => {
                    const name =
                      getCountryNameFromCode(iso2) ||
                      f.properties?.name ||
                      numericId;
                    const info: CountryInfo = {
                      iso: iso2,
                      name,
                      revenue: entry?.revenue || 0,
                      shipments: entry?.shipments || 0,
                    };
                    const toggling = selected?.iso === iso2;
                    setSelected(toggling ? null : info);
                    onClickCountry?.(toggling ? null : info);
                  }}
                  style={{ cursor: "pointer" }}
                />
              );
            })}
          </g>
        </svg>
      </div>

      {/* Zoom controls */}
      <div className="absolute top-2 right-2 flex flex-col gap-1">
        <button
          onClick={() => handleZoom(0.5)}
          className="w-7 h-7 flex items-center justify-center rounded bg-white dark:bg-slate-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm font-bold shadow hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
          title="Zoom in"
        >
          +
        </button>
        <button
          onClick={() => handleZoom(-0.5)}
          className="w-7 h-7 flex items-center justify-center rounded bg-white dark:bg-slate-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm font-bold shadow hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
          title="Zoom out"
        >
          −
        </button>
        <button
          onClick={handleReset}
          className="w-7 h-7 flex items-center justify-center rounded bg-white dark:bg-slate-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 shadow hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
          title="Reset view"
        >
          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor">
            <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 1 1 .908-.418A6 6 0 1 1 8 2v1z" />
            <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966a.25.25 0 0 1 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z" />
          </svg>
        </button>
        {onFullscreen && (
          <button
            onClick={onFullscreen}
            className="w-7 h-7 flex items-center justify-center rounded bg-white dark:bg-slate-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 shadow hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
            title="Fullscreen"
          >
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="10 2 14 2 14 6" />
              <polyline points="6 14 2 14 2 10" />
              <line x1="14" y1="2" x2="9.5" y2="6.5" />
              <line x1="2" y1="14" x2="6.5" y2="9.5" />
            </svg>
          </button>
        )}
      </div>

      {/* Selected country info panel */}
      {selected && (
        <div className="absolute bottom-10 left-2 right-2 sm:left-auto sm:right-2 sm:w-56 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 shadow-lg p-3 text-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold text-gray-800 dark:text-white">{selected.name}</span>
            <button
              onClick={() => { setSelected(null); onClickCountry?.(null); }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs"
            >
              ✕
            </button>
          </div>
          {selected.revenue > 0 ? (
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Revenue</span>
                <span className="font-medium text-gray-800 dark:text-gray-100">
                  {selected.revenue.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Shipments</span>
                <span className="font-medium text-gray-800 dark:text-gray-100">
                  {selected.shipments.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Avg / Shipment</span>
                <span className="font-medium text-gray-800 dark:text-gray-100">
                  {selected.shipments > 0
                    ? Math.round(selected.revenue / selected.shipments).toLocaleString()
                    : "—"}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-400">No revenue data for this country</div>
          )}
        </div>
      )}

      {/* Hover tooltip */}
      {tooltip && !dragging && (
        <div
          className="pointer-events-none fixed z-50 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-lg"
          style={{ left: tooltip.x + 14, top: tooltip.y - 44 }}
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

      {/* Legend */}
      <div className="flex items-center justify-center gap-2 mt-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
        <span>Ranked</span>
        <div className="flex h-2.5 rounded overflow-hidden">
          {PALETTE.map((c) => (
            <div key={c} className="w-10" style={{ background: c }} />
          ))}
        </div>
        <span>Top revenue</span>
      </div>
    </div>
  );
}
