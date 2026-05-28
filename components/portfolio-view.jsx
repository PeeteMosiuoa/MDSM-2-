"use client";

export default function PortfolioView({ portfolio = [], totalValue = 0, totalGain = 0 }) {
  const fmt = (n) =>
    `M${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total Value</p>
          <p className="mt-1 text-2xl font-bold">{fmt(totalValue)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total Gain / Loss</p>
          <p className={`mt-1 text-2xl font-bold ${totalGain >= 0 ? "text-emerald-500" : "text-destructive"}`}>
            {totalGain >= 0 ? "+" : ""}{fmt(totalGain)}
          </p>
        </div>
      </div>

      {/* Holdings */}
      {portfolio.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          No holdings yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                {["Symbol", "Name", "Units", "Avg Cost", "Current Price", "Value", "Gain/Loss"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {portfolio.map((item, i) => {
                const gain = (item.currentPrice - item.avgCost) * item.units;
                return (
                  <tr key={i} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3 font-mono font-semibold">{item.symbol}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.name}</td>
                    <td className="px-4 py-3">{Number(item.units || 0).toLocaleString()}</td>
                    <td className="px-4 py-3">{fmt(item.avgCost)}</td>
                    <td className="px-4 py-3">{fmt(item.currentPrice)}</td>
                    <td className="px-4 py-3 font-semibold">{fmt(item.units * item.currentPrice)}</td>
                    <td className={`px-4 py-3 font-semibold ${gain >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                      {gain >= 0 ? "+" : ""}{fmt(gain)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
