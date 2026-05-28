"use client";

import { ArrowUpRight, ArrowDownRight, PieChart } from "lucide-react";

export default function PortfolioView({
  portfolio: incomingPortfolio = [],
  totalValue: incomingTotalValue = 0,
  totalGain: incomingTotalGain = 0,
  totalDividends: incomingTotalDividends = 0,
}) {
  // ────────────────────────────────────────────────────────────────
  // No hardcoded/test data anymore – we always use real props
  // ────────────────────────────────────────────────────────────────

  const portfolio = Array.isArray(incomingPortfolio) ? incomingPortfolio : [];

  const safeTotalValue     = Number(incomingTotalValue)     || 0;
  const safeTotalGain      = Number(incomingTotalGain)      || 0;
  const safeTotalDividends = Number(incomingTotalDividends) || 0;

  const invested = safeTotalValue - safeTotalGain;
  const gainPercent =
    invested > 0 ? ((safeTotalGain / invested) * 100).toFixed(1) : "0.0";

  const formatCurrency = (val) =>
    "M" +
    Number(val).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">Total Portfolio Value</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {formatCurrency(safeTotalValue)}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">Total P&L (incl. income)</p>
          <p
            className={`mt-1 flex items-center gap-1 text-2xl font-bold ${
              safeTotalGain >= 0 ? "text-primary" : "text-destructive"
            }`}
          >
            {safeTotalGain >= 0 ? (
              <ArrowUpRight className="h-5 w-5" />
            ) : (
              <ArrowDownRight className="h-5 w-5" />
            )}
            {safeTotalGain >= 0 ? "+" : "-"}{formatCurrency(Math.abs(safeTotalGain))}
          </p>
          <p
            className={`text-xs ${
              safeTotalGain >= 0 ? "text-primary" : "text-destructive"
            }`}
          >
            {safeTotalGain >= 0 ? "+" : ""}
            {gainPercent}% on cost basis
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">Dividend / Income Received</p>
          <p className="mt-1 text-2xl font-bold text-amber-500">
            {formatCurrency(safeTotalDividends)}
          </p>
          <p className="text-xs text-muted-foreground">
            {safeTotalDividends > 0 ? "Credited to wallet" : "No income payments yet"}
          </p>
        </div>
      </div>

      {/* Portfolio Allocation */}
      {portfolio.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold text-foreground">
            Portfolio Allocation
          </h3>
          <div className="flex flex-wrap items-center gap-6">
            <div className="relative h-40 w-40 flex-shrink-0">
              <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                {(() => {
                  let offset = 0;
                  const colors = [
                    "hsl(var(--primary))",
                    "hsl(var(--accent))",
                    "hsl(var(--chart-3))",
                    "hsl(var(--chart-4))",
                    "hsl(var(--chart-5))",
                  ];
                  return portfolio.map((p, i) => {
                    const pct =
                      safeTotalValue > 0
                        ? (p.currentValue / safeTotalValue) * 100
                        : 0;
                    const dashArray = `${pct * 2.827} ${282.7 - pct * 2.827}`;
                    const dashOffset = -offset * 2.827;
                    offset += pct;
                    return (
                      <circle
                        key={p.securityId}
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke={colors[i % colors.length]}
                        strokeWidth="10"
                        strokeDasharray={dashArray}
                        strokeDashoffset={dashOffset}
                      />
                    );
                  });
                })()}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-sm font-bold text-foreground">
                  {formatCurrency(safeTotalValue)}
                </p>
              </div>
            </div>

            <div className="flex-1 space-y-2">
              {portfolio.map((p, i) => {
                const pct =
                  safeTotalValue > 0
                    ? ((p.currentValue / safeTotalValue) * 100).toFixed(1)
                    : "0.0";
                const colors = [
                  "bg-primary",
                  "bg-accent",
                  "bg-chart-3",
                  "bg-chart-4",
                  "bg-chart-5",
                ];
                return (
                  <div key={p.securityId} className="flex items-center gap-3">
                    <span
                      className={`h-3 w-3 rounded-full ${
                        colors[i % colors.length]
                      }`}
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">
                          {p.security?.symbol || "N/A"}
                        </span>
                        <span className="text-sm text-foreground">{pct}%</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-secondary">
                        <div
                          className={`h-full rounded-full ${
                            colors[i % colors.length]
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Holdings Table */}
      {portfolio.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <PieChart className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">No holdings yet</p>
          <p className="text-xs text-muted-foreground">
            Start trading to build your portfolio
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary text-left">
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Security
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Units
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Avg Price
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Current Price
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Market Value
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Income
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Total P&L
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    P&L %
                  </th>
                </tr>
              </thead>
              <tbody>
                {portfolio.map((p) => (
                  <tr
                    key={p.securityId}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-mono font-bold text-foreground">
                          {p.security?.symbol || "N/A"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {p.security?.name || ""}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-foreground">
                      {p.units}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-foreground">
                      M{p.avgPrice.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-foreground">
                      M{(p.security?.price || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">
                      M{p.currentValue.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-amber-500">
                      {(p.dividendIncome ?? 0) > 0
                        ? `+M${Number(p.dividendIncome).toFixed(2)}`
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono font-semibold ${
                        p.gain >= 0 ? "text-primary" : "text-destructive"
                      }`}
                    >
                      {p.gain >= 0 ? "+" : ""}M{Math.abs(p.gain).toFixed(2)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono font-semibold ${
                        p.gainPercent >= 0 ? "text-primary" : "text-destructive"
                      }`}
                    >
                      {p.gainPercent >= 0 ? "+" : ""}
                      {p.gainPercent.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}