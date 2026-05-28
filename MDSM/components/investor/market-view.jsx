"use client";

import { useState, useCallback, useRef } from "react";
import {
  Search,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  X,
  ArrowUpRight,
  BarChart2,
  Activity,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

// ─────────────────────────────────────────────────────────────────────────────
// Seeded LCG — gives deterministic "random" numbers per security so the
// chart looks the same every render without hitting the server.
// ─────────────────────────────────────────────────────────────────────────────
function seededRng(seed) {
  let s = (seed ^ 0xdeadbeef) >>> 0;
  return () => {
    s = Math.imul(1664525, s) + 1013904223;
    s = s >>> 0;
    return s / 0xffffffff;
  };
}

function generateCandles(securityId, currentPrice, count = 40) {
  const rng = seededRng(securityId * 1337 + 42);
  const vol = Math.max(currentPrice * 0.018, 0.02); // 1.8% daily vol

  // Start from a price ±20% of current, then walk forward to today
  let prevClose = currentPrice * (0.80 + rng() * 0.40);

  const candles = [];
  for (let i = 0; i < count; i++) {
    const open = prevClose;
    const change = (rng() - 0.485) * vol; // tiny upward drift
    const close = Math.max(0.001, open + change);
    const wickHi = rng() * vol * 0.8;
    const wickLo = rng() * vol * 0.8;
    const high = Math.max(open, close) + wickHi;
    const low = Math.max(0.001, Math.min(open, close) - wickLo);
    const volume = Math.floor(rng() * 90_000 + 8_000);

    const date = new Date();
    date.setDate(date.getDate() - (count - 1 - i));

    candles.push({ date, open, high, low, close, volume });
    prevClose = close;
  }

  // Snap last candle's close to the real current price
  const last = candles[candles.length - 1];
  last.close = currentPrice;
  last.high = Math.max(last.open, currentPrice, last.high);
  last.low = Math.min(last.open, currentPrice, last.low);

  return candles;
}

// ─────────────────────────────────────────────────────────────────────────────
// CandlestickChart — pure SVG, no dependencies
// ─────────────────────────────────────────────────────────────────────────────
function CandlestickChart({ candles, hoverIdx, onHover }) {
  const W = 700;
  const H_candle = 230;
  const H_vol    = 60;
  const H_gap    = 8;
  const H_total  = H_candle + H_gap + H_vol;
  const PAD_L = 56;
  const PAD_R = 12;
  const PAD_T = 12;
  const PAD_B = 24;

  const chartW = W - PAD_L - PAD_R;
  const chartH = H_candle - PAD_T;

  const prices = candles.flatMap((c) => [c.high, c.low]);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const priceRange = maxP - minP || 1;

  const maxVol = Math.max(...candles.map((c) => c.volume));

  const n = candles.length;
  const slotW = chartW / n;
  const bodyW = Math.max(3, slotW * 0.55);

  const xOf  = (i) => PAD_L + (i + 0.5) * slotW;
  const yOfP = (p) => PAD_T + (1 - (p - minP) / priceRange) * chartH;
  const yOfV = (v) => H_candle + H_gap + H_vol - (v / maxVol) * H_vol;

  // Y-axis price ticks
  const yTicks = 5;
  const yLabels = Array.from({ length: yTicks }, (_, i) => {
    const p = minP + (i / (yTicks - 1)) * priceRange;
    return { p, y: yOfP(p) };
  });

  // X-axis date labels (every ~7 candles)
  const step = Math.max(1, Math.round(n / 6));
  const xLabels = candles
    .map((c, i) => ({ c, i }))
    .filter(({ i }) => i % step === 0);

  // Hoverable area — full SVG height
  const handleMouseMove = useCallback(
    (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const svgX = ((e.clientX - rect.left) / rect.width) * W;
      const i = Math.floor((svgX - PAD_L) / slotW);
      onHover(i >= 0 && i < n ? i : null);
    },
    [slotW, n, onHover]
  );

  const hc = hoverIdx != null ? candles[hoverIdx] : null;

  return (
    <svg
      viewBox={`0 0 ${W} ${H_total + PAD_B}`}
      className="w-full h-auto select-none"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => onHover(null)}
    >
      {/* ── Background grid ── */}
      {yLabels.map(({ y }, i) => (
        <line key={i} x1={PAD_L} y1={y} x2={W - PAD_R} y2={y}
          stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
      ))}

      {/* ── Y-axis labels (price) ── */}
      {yLabels.map(({ p, y }, i) => (
        <text key={i} x={PAD_L - 5} y={y + 3.5}
          textAnchor="end" fontSize="9" fill="rgba(148,163,184,0.65)" fontFamily="monospace">
          {p.toFixed(2)}
        </text>
      ))}

      {/* ── X-axis labels (dates) ── */}
      {xLabels.map(({ c, i }) => (
        <text key={i} x={xOf(i)} y={H_total + PAD_B - 4}
          textAnchor="middle" fontSize="9" fill="rgba(148,163,184,0.5)" fontFamily="monospace">
          {c.date.toLocaleDateString("en", { month: "short", day: "numeric" })}
        </text>
      ))}

      {/* ── Volume bars ── */}
      {candles.map((c, i) => {
        const isUp = c.close >= c.open;
        const x = xOf(i);
        const vY = yOfV(c.volume);
        const vH = H_total + H_gap - vY;
        return (
          <rect key={i}
            x={x - bodyW / 2} y={vY} width={bodyW} height={Math.max(1, vH)}
            fill={isUp ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}
            rx="1"
          />
        );
      })}

      {/* ── Volume label ── */}
      <text x={PAD_L - 5} y={H_candle + H_gap + 10}
        textAnchor="end" fontSize="8" fill="rgba(148,163,184,0.4)" fontFamily="monospace">
        VOL
      </text>

      {/* ── Candles ── */}
      {candles.map((c, i) => {
        const isUp   = c.close >= c.open;
        const color  = isUp ? "#10b981" : "#ef4444";
        const x      = xOf(i);
        const wickT  = yOfP(c.high);
        const wickB  = yOfP(c.low);
        const bodyT  = yOfP(Math.max(c.open, c.close));
        const bodyB  = yOfP(Math.min(c.open, c.close));
        const bodyH  = Math.max(1.5, bodyB - bodyT);
        const isHov  = i === hoverIdx;

        return (
          <g key={i} opacity={hoverIdx != null && !isHov ? 0.45 : 1}>
            {/* Wick */}
            <line x1={x} y1={wickT} x2={x} y2={wickB}
              stroke={color} strokeWidth={isHov ? 1.5 : 1} />
            {/* Body */}
            <rect x={x - bodyW / 2} y={bodyT} width={bodyW} height={bodyH}
              fill={isUp ? color : color}
              opacity={isHov ? 1 : 0.85}
              rx="1.5"
            />
            {/* Hover highlight ring */}
            {isHov && (
              <rect x={x - bodyW / 2 - 2} y={bodyT - 2}
                width={bodyW + 4} height={bodyH + 4}
                fill="none" stroke={color} strokeWidth="1" opacity="0.5" rx="2" />
            )}
          </g>
        );
      })}

      {/* ── Hover vertical line ── */}
      {hoverIdx != null && (
        <line
          x1={xOf(hoverIdx)} y1={PAD_T}
          x2={xOf(hoverIdx)} y2={H_total + H_gap}
          stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="3,3"
        />
      )}

      {/* ── Current price dashed line ── */}
      {(() => {
        const lastClose = candles[candles.length - 1]?.close;
        if (lastClose == null) return null;
        const y = yOfP(lastClose);
        return (
          <g>
            <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y}
              stroke="rgba(99,179,237,0.35)" strokeWidth="1" strokeDasharray="4,3" />
            <rect x={W - PAD_R} y={y - 7} width={PAD_R + 2} height={14}
              fill="rgba(99,179,237,0.2)" rx="2" />
            <text x={W - PAD_R + 1} y={y + 3.5}
              fontSize="7.5" fill="rgba(99,179,237,0.9)" fontFamily="monospace">
              {lastClose.toFixed(2)}
            </text>
          </g>
        );
      })()}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────────────────────
function getDisplayType(sec) {
  if (sec.type?.trim()) return sec.type.charAt(0).toUpperCase() + sec.type.slice(1).toLowerCase();
  const n = (sec.name || "").toLowerCase();
  if (n.includes("fund")) return "Fund";
  if (n.includes("bond")) return "Bond";
  return "Equity";
}

const TYPE_COLORS = {
  equity:  "bg-blue-500/15 text-blue-300 border-blue-500/25",
  shares:  "bg-blue-500/15 text-blue-300 border-blue-500/25",
  bond:    "bg-amber-500/15 text-amber-300 border-amber-500/25",
  debt:    "bg-amber-500/15 text-amber-300 border-amber-500/25",
  fund:    "bg-purple-500/15 text-purple-300 border-purple-500/25",
  token:   "bg-cyan-500/15 text-cyan-300 border-cyan-500/25",
};

function typeColor(sec) {
  const t = (sec.type || "equity").toLowerCase();
  return TYPE_COLORS[t] || TYPE_COLORS.equity;
}

// ─────────────────────────────────────────────────────────────────────────────
// SecurityDetailPanel — shown when a row is clicked
// ─────────────────────────────────────────────────────────────────────────────
function SecurityDetailPanel({ sec, onClose }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const candles = generateCandles(sec.id, Number(sec.price || 1));

  const first    = candles[0];
  const last     = candles[candles.length - 1];
  const hc       = hoverIdx != null ? candles[hoverIdx] : last;

  const change    = last.close - first.open;
  const changePct = first.open > 0 ? (change / first.open) * 100 : 0;
  const isUp      = change >= 0;

  const fmt = (v) => Number(v).toFixed(2);
  const fmtVol = (v) => v >= 1_000_000
    ? `${(v / 1_000_000).toFixed(1)}M`
    : v >= 1_000 ? `${(v / 1_000).toFixed(0)}K`
    : String(v);

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-slate-900 overflow-hidden mb-4 shadow-2xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 px-5 py-4 border-b border-white/[0.06]">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/15 border border-blue-500/20 flex-shrink-0">
            <span className="font-mono font-black text-blue-300 text-sm">
              {(sec.symbol || "?").slice(0, 2)}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-lg font-bold font-mono text-white">{sec.symbol}</h3>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${typeColor(sec)}`}>
                {getDisplayType(sec)}
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-0.5">{sec.name}</p>
          </div>
        </div>

        <div className="flex items-start gap-5 flex-shrink-0">
          {/* Price + change */}
          <div className="text-right">
            <p className="text-2xl font-bold font-mono text-white">M{fmt(last.close)}</p>
            <div className={`inline-flex items-center gap-1 text-sm font-semibold mt-0.5 ${isUp ? "text-emerald-400" : "text-red-400"}`}>
              {isUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {isUp ? "+" : ""}{changePct.toFixed(2)}% (30d)
            </div>
          </div>
          {/* Close button */}
          <button onClick={onClose}
            className="mt-1 flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-white/[0.08] hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* OHLCV stats row — shows hovered candle or last candle */}
      <div className="grid grid-cols-5 divide-x divide-white/[0.05] border-b border-white/[0.06]">
        {[
          { label: "OPEN",   value: `M${fmt(hc.open)}` },
          { label: "HIGH",   value: `M${fmt(hc.high)}`,   color: "text-emerald-400" },
          { label: "LOW",    value: `M${fmt(hc.low)}`,    color: "text-red-400" },
          { label: "CLOSE",  value: `M${fmt(hc.close)}` },
          { label: "VOLUME", value: fmtVol(hc.volume) },
        ].map(({ label, value, color }) => (
          <div key={label} className="px-4 py-2.5 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</p>
            <p className={`font-mono font-semibold text-sm mt-0.5 ${color || "text-white"}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Candlestick chart */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 mb-3 px-1">
          <BarChart2 className="h-3.5 w-3.5 text-slate-500" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            40-Day Candlestick  ·  {hoverIdx != null
              ? candles[hoverIdx].date.toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" })
              : "Hover to inspect"}
          </span>
        </div>
        <CandlestickChart candles={candles} hoverIdx={hoverIdx} onHover={setHoverIdx} />
      </div>

      {/* Footer stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/[0.04] border-t border-white/[0.06]">
        {[
          { label: "Market Cap",     value: sec.price && sec.total_supply ? `M${((Number(sec.price) * Number(sec.total_supply)) / 1e6).toFixed(2)}M` : "—" },
          { label: "Total Supply",   value: Number(sec.total_supply || 0).toLocaleString() },
          { label: "Available",      value: Number(sec.available_tokens || 0).toLocaleString() },
          { label: "Current Price",  value: `M${fmt(sec.price || 0)}` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-slate-900 px-4 py-3">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{label}</p>
            <p className="font-mono text-sm font-semibold text-white mt-0.5">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MarketView — main export
// ─────────────────────────────────────────────────────────────────────────────
export default function MarketView({ securities, stats }) {
  const [search, setSearch]       = useState("");
  const [filterType, setFilterType] = useState("all");
  const [selectedSec, setSelectedSec] = useState(null);

  const normalised = securities.map((s) => ({ ...s, type: s.type || s.security_type || "equity" }));

  const filtered = normalised.filter((s) => {
    const q = search.toLowerCase();
    const matchSearch = !q || (s.name || "").toLowerCase().includes(q) || (s.symbol || "").toLowerCase().includes(q);
    const matchType   = filterType === "all" || (s.type || "equity").toLowerCase() === filterType;
    return matchSearch && matchType;
  });

  const hasMissingTypes = securities.some((s) => !s.type?.trim());

  const handleRowClick = (sec) => {
    setSelectedSec((prev) => (prev?.id === sec.id ? null : sec));
  };

  return (
    <div className="space-y-4 p-4 lg:p-5">

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-xl font-bold text-white flex items-center gap-2.5">
          Market Data
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Live
          </span>
        </h3>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input placeholder="Search symbol or name…"
              className="pl-9 bg-slate-900 border-white/[0.08] text-white placeholder:text-slate-600 focus:border-blue-500/50"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
            className="rounded-lg border border-white/[0.08] bg-slate-900 text-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500/50">
            <option value="all">All Types</option>
            <option value="equity">Equity</option>
            <option value="shares">Shares</option>
            <option value="bond">Bond</option>
            <option value="fund">Fund</option>
            <option value="token">Token</option>
          </select>
        </div>
      </div>

      {/* ── Type-filter hint ── */}
      {filterType !== "all" && filtered.length === 0 && hasMissingTypes && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-300">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold">No "{filterType}" securities</p>
            <p className="text-xs text-amber-400/70 mt-0.5">
              Securities without an assigned type are treated as Equity. Try "All Types".
            </p>
          </div>
        </div>
      )}

      {/* ── Candlestick detail panel ── */}
      {selectedSec && (
        <SecurityDetailPanel
          sec={selectedSec}
          onClose={() => setSelectedSec(null)}
        />
      )}

      {/* ── Securities table ── */}
      <div className="rounded-2xl border border-white/[0.06] bg-slate-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["Symbol", "Name", "Type", "Price", "Mkt Cap", "Supply", "Available", "Chart"].map((h) => (
                  <th key={h}
                    className={`px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500
                      ${["Price","Mkt Cap","Supply","Available"].includes(h) ? "text-right" : "text-left"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Search className="h-10 w-10 text-slate-700" />
                      <p className="font-medium text-slate-400">
                        {filterType !== "all"
                          ? `No ${filterType} securities found`
                          : "No securities match your search"}
                      </p>
                      <p className="text-xs text-slate-600 max-w-xs">
                        {filterType !== "all" ? "Try switching to 'All Types'." : "Clear the search to see all securities."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((sec) => {
                  const price  = Number(sec.price || 0);
                  const cap    = price * Number(sec.total_supply || 0);
                  const isActive = selectedSec?.id === sec.id;

                  // Use last candle change vs first open for the "change" column
                  // (deterministic same as the chart)
                  const rng0 = seededRng(sec.id * 1337 + 42);
                  const startFactor = 0.80 + rng0() * 0.40;
                  const startPrice = price * startFactor;
                  const rawChgPct = startPrice > 0 ? ((price - startPrice) / startPrice) * 100 : 0;
                  const chgUp = rawChgPct >= 0;

                  return (
                    <tr key={sec.id}
                      onClick={() => handleRowClick(sec)}
                      className={`border-b border-white/[0.04] last:border-0 cursor-pointer transition-colors group
                        ${isActive ? "bg-blue-500/10 border-l-2 border-l-blue-500" : "hover:bg-white/[0.03]"}`}>

                      {/* Symbol */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-black flex-shrink-0
                            ${isActive ? "bg-blue-500/25 text-blue-300" : "bg-slate-800 text-slate-400 group-hover:bg-blue-500/15 group-hover:text-blue-300"}`}>
                            {(sec.symbol || "?").slice(0, 2)}
                          </div>
                          <span className={`font-mono font-bold text-sm ${isActive ? "text-blue-300" : "text-white"}`}>
                            {sec.symbol || "—"}
                          </span>
                          {isActive && (
                            <span className="text-[9px] font-bold text-blue-400 bg-blue-500/15 px-1.5 py-0.5 rounded">▼ CHART</span>
                          )}
                        </div>
                      </td>

                      {/* Name */}
                      <td className="px-5 py-3.5 text-slate-300 max-w-[180px]">
                        <p className="truncate text-sm">{sec.name || "Unnamed"}</p>
                      </td>

                      {/* Type */}
                      <td className="px-5 py-3.5">
                        <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${typeColor(sec)}`}>
                          {getDisplayType(sec)}
                        </span>
                      </td>

                      {/* Price */}
                      <td className="px-5 py-3.5 text-right">
                        <span className="font-mono font-semibold text-white text-sm">
                          {price > 0 ? `M${price.toFixed(2)}` : "—"}
                        </span>
                      </td>

                      {/* Mkt Cap — shows 30-day change */}
                      <td className="px-5 py-3.5 text-right">
                        <div>
                          <p className="text-xs text-slate-400 font-mono">
                            {cap > 0 ? `M${(cap / 1_000_000).toFixed(1)}M` : "—"}
                          </p>
                          <span className={`text-[10px] font-semibold ${chgUp ? "text-emerald-400" : "text-red-400"}`}>
                            {chgUp ? "+" : ""}{rawChgPct.toFixed(1)}% 30d
                          </span>
                        </div>
                      </td>

                      {/* Supply */}
                      <td className="px-5 py-3.5 text-right font-mono text-slate-400 text-xs">
                        {Number(sec.total_supply || 0).toLocaleString()}
                      </td>

                      {/* Available */}
                      <td className="px-5 py-3.5 text-right font-mono text-slate-400 text-xs">
                        {Number(sec.available_tokens || 0).toLocaleString()}
                      </td>

                      {/* Chart hint */}
                      <td className="px-5 py-3.5 text-center">
                        <div className={`inline-flex items-center gap-1 text-xs font-medium transition-colors
                          ${isActive ? "text-blue-400" : "text-slate-600 group-hover:text-slate-300"}`}>
                          <Activity className="h-3.5 w-3.5" />
                          {isActive ? "Close" : "Chart"}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer count */}
        {filtered.length > 0 && (
          <div className="px-5 py-2.5 border-t border-white/[0.04] flex items-center justify-between">
            <span className="text-[11px] text-slate-600">
              {filtered.length} securit{filtered.length === 1 ? "y" : "ies"}
              {selectedSec ? " · Click a row again to close the chart" : " · Click any row to view candlestick chart"}
            </span>
            {selectedSec && (
              <button onClick={() => setSelectedSec(null)}
                className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-white transition-colors">
                <X className="h-3 w-3" /> Close chart
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
