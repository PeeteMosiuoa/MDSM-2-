"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertCircle,
  History,
  Loader2,
  BookOpen,
  X,
  TrendingUp,
  Clock,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  submitPendingOrder,
  getUserTradeHistory,
  placeOrderBookEntry,
  getOrderBook,
  getInvestorOpenOrders,
  cancelOrderBookEntry,
} from "@/lib/store";

const BROKER_FEE_RATE   = 0.05;  // 5%   — market orders (via broker)
const CLEARING_FEE_RATE = 0.005; // 0.5% — limit orders (clearing house each side)

export default function TradingPanel({
  user,
  securities,
  wallet,
  portfolio,
  onTradeComplete,
}) {
  const [selectedSecurity, setSelectedSecurity] = useState(securities[0]?.id || "");
  const [orderMode,  setOrderMode]  = useState("market"); // "market" | "limit"
  const [orderType,  setOrderType]  = useState("buy");
  const [quantity,   setQuantity]   = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [result,     setResult]     = useState(null);
  const [loading,    setLoading]    = useState(false);

  const [tradeHistory,    setTradeHistory]    = useState([]);
  const [historyLoading,  setHistoryLoading]  = useState(false);
  const [openOrders,      setOpenOrders]      = useState([]);
  const [openOrdersLoading, setOpenOrdersLoading] = useState(false);
  const [orderBook,       setOrderBook]       = useState({ bids: [], asks: [] });
  const [obLoading,       setObLoading]       = useState(false);
  const [cancellingId,    setCancellingId]    = useState(null);

  // ─── Load trade history ───────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    if (!user?.id) return;
    setHistoryLoading(true);
    try {
      const history = await getUserTradeHistory(user.id);
      setTradeHistory(history || []);
    } catch (err) {
      console.error("Failed to load trade history:", err);
    } finally {
      setHistoryLoading(false);
    }
  }, [user?.id]);

  // ─── Load open limit orders ───────────────────────────────────────
  const loadOpenOrders = useCallback(async () => {
    if (!user?.id) return;
    setOpenOrdersLoading(true);
    try {
      const orders = await getInvestorOpenOrders(user.id);
      setOpenOrders(orders || []);
    } catch (err) {
      console.error("Failed to load open orders:", err);
    } finally {
      setOpenOrdersLoading(false);
    }
  }, [user?.id]);

  // ─── Load order book for selected security ────────────────────────
  const loadOrderBook = useCallback(async (secId) => {
    if (!secId) return;
    setObLoading(true);
    try {
      const ob = await getOrderBook(secId);
      setOrderBook(ob || { bids: [], asks: [] });
    } catch (err) {
      console.error("Failed to load order book:", err);
    } finally {
      setObLoading(false);
    }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory, onTradeComplete]);
  useEffect(() => { loadOpenOrders(); }, [loadOpenOrders, onTradeComplete]);
  useEffect(() => { loadOrderBook(selectedSecurity); }, [loadOrderBook, selectedSecurity]);

  // Auto-select first security
  useEffect(() => {
    if (
      securities.length > 0 &&
      !securities.some((s) => String(s.id) === String(selectedSecurity))
    ) {
      setSelectedSecurity(String(securities[0].id));
    }
  }, [securities, selectedSecurity]);

  // Pre-fill limit price when switching to limit mode
  useEffect(() => {
    if (orderMode === "limit" && security && !limitPrice) {
      setLimitPrice(Number(security.price || 0).toFixed(2));
    }
  }, [orderMode, selectedSecurity]); // eslint-disable-line react-hooks/exhaustive-deps

  const security = securities.find((s) => String(s.id) === String(selectedSecurity));
  const qty      = Number(quantity) || 0;
  const lp       = Number(limitPrice) || 0;

  // Market order cost
  const marketTotal   = qty * (Number(security?.price) || 0);
  const brokerFee     = +(marketTotal * BROKER_FEE_RATE).toFixed(2);
  const marketNetTotal = orderType === "buy" ? marketTotal + brokerFee : marketTotal - brokerFee;

  // Limit order cost
  const limitTotal    = qty * lp;
  const clearingFee   = +(limitTotal * CLEARING_FEE_RATE).toFixed(2);
  const limitNetTotal = orderType === "buy" ? limitTotal + clearingFee : limitTotal - clearingFee;

  const holding = portfolio.find((p) => String(p.securityId) === String(selectedSecurity));

  async function handleTrade(e) {
    e.preventDefault();
    setResult(null);

    if (!security) {
      setResult({ success: false, message: "Please select a security." });
      return;
    }

    const qtyNum = Number(quantity);
    if (!quantity || isNaN(qtyNum) || qtyNum < 1 || !Number.isInteger(qtyNum)) {
      setResult({ success: false, message: "Quantity must be a positive whole number." });
      return;
    }
    if (qtyNum > 1_000_000) {
      setResult({ success: false, message: "Maximum order size is 1,000,000 tokens." });
      return;
    }

    if (orderMode === "limit") {
      const lpNum = Number(limitPrice);
      if (!limitPrice || isNaN(lpNum) || lpNum <= 0) {
        setResult({ success: false, message: "Enter a valid limit price." });
        return;
      }
    }

    const netCost = orderMode === "market" ? marketNetTotal : limitNetTotal;
    const walletBal = Number(wallet?.balance || 0);

    if (orderType === "sell") {
      const ownedQty = Number(holding?.units || holding?.quantity || 0);
      if (ownedQty <= 0) {
        setResult({ success: false, message: `You hold no ${security.symbol} tokens to sell.` });
        return;
      }
      if (qtyNum > ownedQty) {
        setResult({
          success: false,
          message: `Insufficient holdings: you own ${ownedQty.toLocaleString()} ${security.symbol}.`,
        });
        return;
      }
    }

    if (orderType === "buy" && netCost > walletBal) {
      const feeLabel = orderMode === "market" ? "5% broker fee" : "0.5% clearing fee";
      setResult({
        success: false,
        message: `Insufficient balance. Need M${netCost.toFixed(2)} (incl. ${feeLabel}), have M${walletBal.toFixed(2)}.`,
      });
      return;
    }

    setLoading(true);
    try {
      let res;
      if (orderMode === "market") {
        res = await submitPendingOrder(
          user.id,
          selectedSecurity,
          orderType,
          qtyNum,
          Number(security.price)
        );
      } else {
        res = await placeOrderBookEntry(
          user.id,
          selectedSecurity,
          orderType,
          Number(limitPrice),
          qtyNum
        );
      }

      if (!res?.success) {
        setResult({ success: false, message: res?.error || res?.message || "Order failed" });
        return;
      }

      setResult({ success: true, message: res.message || "Order placed successfully!" });
      setQuantity("");
      if (orderMode === "limit") setLimitPrice("");

      onTradeComplete();
      await Promise.all([loadHistory(), loadOpenOrders(), loadOrderBook(selectedSecurity)]);
    } catch (err) {
      console.error("Trade error:", err);
      setResult({ success: false, message: err.message || "Unexpected error. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel(orderId) {
    setCancellingId(orderId);
    try {
      const res = await cancelOrderBookEntry(orderId, user.id);
      if (res?.success) {
        await Promise.all([loadOpenOrders(), loadOrderBook(selectedSecurity)]);
      }
    } catch (err) {
      console.error("Cancel error:", err);
    } finally {
      setCancellingId(null);
    }
  }

  const isFormDisabled = loading;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* ─────────────────── ORDER FORM ─────────────────── */}
      <div className="lg:col-span-1 space-y-4">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-foreground">Place Order</h3>

          {/* Market / Limit toggle */}
          <div className="mb-3 flex rounded-lg bg-secondary p-1 text-xs font-medium">
            <button
              type="button"
              onClick={() => { setOrderMode("market"); setResult(null); }}
              className={`flex-1 rounded-md py-2 transition-all ${
                orderMode === "market"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="flex items-center justify-center gap-1">
                <Zap className="h-3 w-3" />
                Market
              </span>
            </button>
            <button
              type="button"
              onClick={() => { setOrderMode("limit"); setResult(null); }}
              className={`flex-1 rounded-md py-2 transition-all ${
                orderMode === "limit"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="flex items-center justify-center gap-1">
                <BookOpen className="h-3 w-3" />
                Limit
              </span>
            </button>
          </div>

          {/* Buy / Sell toggle */}
          <div className="mb-5 flex rounded-lg bg-secondary p-1">
            <button
              type="button"
              onClick={() => setOrderType("buy")}
              className={`flex-1 rounded-md py-2.5 text-sm font-medium transition-all ${
                orderType === "buy"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Buy
            </button>
            <button
              type="button"
              onClick={() => setOrderType("sell")}
              className={`flex-1 rounded-md py-2.5 text-sm font-medium transition-all ${
                orderType === "sell"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Sell
            </button>
          </div>

          <form onSubmit={handleTrade} className="space-y-4">
            {/* Security */}
            <div>
              <Label>Security</Label>
              <select
                className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                value={selectedSecurity}
                onChange={(e) => setSelectedSecurity(e.target.value)}
                disabled={isFormDisabled}
              >
                {securities.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.symbol} – {s.name} (M{(Number(s.price) || 0).toFixed(2)})
                  </option>
                ))}
              </select>
            </div>

            {/* Limit price (only in limit mode) */}
            {orderMode === "limit" && (
              <div>
                <Label>Limit Price (M)</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Enter limit price"
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                  disabled={isFormDisabled}
                  className="mt-1.5"
                  required
                />
                {security && lp > 0 && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Market: M{Number(security.price || 0).toFixed(2)} · Your limit: M{lp.toFixed(2)}
                  </p>
                )}
              </div>
            )}

            {/* Quantity */}
            <div>
              <Label>Quantity (Tokens)</Label>
              <Input
                type="number"
                min="1"
                step="1"
                placeholder="Enter quantity"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                disabled={isFormDisabled}
                className="mt-1.5"
                required
              />
              {orderType === "sell" && quantity && qty > 0 && (() => {
                const owned = Number(holding?.units || holding?.quantity || 0);
                if (owned <= 0)
                  return <p className="mt-1 text-[11px] text-destructive">You have no {security?.symbol} tokens.</p>;
                if (qty > owned)
                  return <p className="mt-1 text-[11px] text-destructive">Exceeds holdings ({owned.toLocaleString()} available).</p>;
                return null;
              })()}
            </div>

            {/* Cost summary */}
            {security && (
              <div className="rounded-lg bg-muted/60 p-3.5 text-sm space-y-2">
                {orderMode === "market" ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Market price</span>
                      <span className="font-medium">M{Number(security.price || 0).toFixed(2)}</span>
                    </div>
                    {qty > 0 && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Subtotal</span>
                          <span>M{marketTotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-amber-500">
                          <span>Broker fee (5%)</span>
                          <span>M{brokerFee.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-semibold border-t pt-2">
                          <span>{orderType === "buy" ? "You pay" : "You receive"}</span>
                          <span className={orderType === "buy" ? "text-rose-400" : "text-primary"}>
                            M{marketNetTotal.toFixed(2)}
                          </span>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Limit price</span>
                      <span className="font-medium">{lp > 0 ? `M${lp.toFixed(2)}` : "—"}</span>
                    </div>
                    {qty > 0 && lp > 0 && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Subtotal</span>
                          <span>M{limitTotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-cyan-500">
                          <span>Clearing fee (0.5%)</span>
                          <span>M{clearingFee.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-semibold border-t pt-2">
                          <span>{orderType === "buy" ? "Max you pay" : "Min you receive"}</span>
                          <span className={orderType === "buy" ? "text-rose-400" : "text-primary"}>
                            M{limitNetTotal.toFixed(2)}
                          </span>
                        </div>
                      </>
                    )}
                  </>
                )}
                <div className="flex justify-between border-t pt-2">
                  <span className="text-muted-foreground">Wallet balance</span>
                  <span>M{(Number(wallet?.balance) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                {orderType === "sell" && holding && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Your holdings</span>
                    <span>{(holding.units || holding.quantity || 0).toLocaleString()} tokens</span>
                  </div>
                )}
              </div>
            )}

            {/* Mode hint */}
            <p className="text-center text-[11px] text-muted-foreground leading-tight">
              {orderMode === "market"
                ? "Market order → routed to your broker for execution"
                : "Limit order → posted to order book, matched investor-to-investor"}
            </p>

            <Button
              type="submit"
              className={`w-full ${orderType === "sell" ? "bg-rose-600 hover:bg-rose-700" : ""}`}
              disabled={
                isFormDisabled ||
                !quantity ||
                qty <= 0 ||
                !security ||
                (orderMode === "limit" && (!limitPrice || lp <= 0)) ||
                (orderType === "sell" &&
                  qty > Number(holding?.units || holding?.quantity || 0)) ||
                (orderType === "buy" &&
                  qty > 0 &&
                  (orderMode === "market" ? marketNetTotal : limitNetTotal) > Number(wallet?.balance || 0))
              }
            >
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Placing order...</>
              ) : orderMode === "market" ? (
                orderType === "buy" ? "Submit Market Buy" : "Submit Market Sell"
              ) : (
                orderType === "buy" ? "Place Limit Buy" : "Place Limit Sell"
              )}
            </Button>
          </form>

          {result && (
            <div
              className={`mt-4 rounded-lg border p-3.5 text-sm flex items-start gap-3 ${
                result.success
                  ? "bg-emerald-950/40 border-emerald-800/50 text-emerald-300"
                  : "bg-rose-950/40 border-rose-800/50 text-rose-300"
              }`}
            >
              {result.success
                ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                : <AlertCircle  className="mt-0.5 h-4 w-4 shrink-0" />}
              <p className="whitespace-pre-line leading-snug">{result.message}</p>
            </div>
          )}
        </div>

        {/* ── Order Book (shown when in limit mode or always) ── */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              Order Book
            </h3>
            <span className="text-[11px] text-muted-foreground">
              {security?.symbol || "—"}
            </span>
          </div>
          {obLoading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground text-sm gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (
            <div className="space-y-3">
              {/* Asks (sells) — shown in reverse so lowest ask is closest to spread */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-400 mb-1">
                  Asks (Sell Orders)
                </p>
                {orderBook.asks.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic">No sell orders</p>
                ) : (
                  <div className="space-y-0.5">
                    {[...orderBook.asks].reverse().map((row, i) => (
                      <OrderBookRow
                        key={i}
                        price={row.price}
                        qty={row.total_qty}
                        orders={row.orders}
                        side="ask"
                        maxQty={Math.max(...orderBook.asks.map((r) => Number(r.total_qty)))}
                      />
                    ))}
                  </div>
                )}
              </div>
              {/* Spread */}
              {orderBook.bids.length > 0 && orderBook.asks.length > 0 && (
                <div className="text-center text-[11px] text-muted-foreground py-1 border-y border-dashed">
                  Spread: M{(Number(orderBook.asks[0].price) - Number(orderBook.bids[0].price)).toFixed(2)}
                </div>
              )}
              {/* Bids (buys) */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-1">
                  Bids (Buy Orders)
                </p>
                {orderBook.bids.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic">No buy orders</p>
                ) : (
                  <div className="space-y-0.5">
                    {orderBook.bids.map((row, i) => (
                      <OrderBookRow
                        key={i}
                        price={row.price}
                        qty={row.total_qty}
                        orders={row.orders}
                        side="bid"
                        maxQty={Math.max(...orderBook.bids.map((r) => Number(r.total_qty)))}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─────────────────── SECURITY DETAILS + CHART ─────────────────── */}
      <div className="lg:col-span-2 space-y-5">
        {security ? (
          <>
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-2xl font-bold">{security.symbol}</h3>
                    <Badge variant="secondary" className="capitalize">
                      {security.type || "Equity"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{security.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold">
                    M{Number(security.price || 0).toFixed(2)}
                  </p>
                  <p className={`mt-1 flex items-center justify-end gap-1 text-sm font-medium ${
                    Number(security.change || 0) >= 0 ? "text-emerald-500" : "text-rose-500"
                  }`}>
                    {Number(security.change || 0) >= 0
                      ? <ArrowUpRight className="h-4 w-4" />
                      : <ArrowDownRight className="h-4 w-4" />}
                    {security.change != null ? `M${Math.abs(Number(security.change)).toFixed(2)}` : "—"}
                    {" ("}
                    {security.changePercent != null
                      ? `${Number(security.changePercent).toFixed(1)}%`
                      : "—"}
                    {")"}
                  </p>
                </div>
              </div>
              {security?.priceHistory?.length > 1 && (
                <PriceChart data={security.priceHistory} positive={Number(security?.change || 0) >= 0} />
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatBox label="Market Cap"    value={security?.marketCap ? `M${(Number(security.marketCap)/1e6).toFixed(1)}M` : "—"} />
              <StatBox label="Volume"        value={security?.volume?.toLocaleString() ?? "—"} />
              <StatBox label="Total Tokens"  value={security?.total_supply?.toLocaleString() ?? "—"} />
              <StatBox label="Available"     value={security?.available_tokens?.toLocaleString() ?? "—"} />
            </div>

            {security?.description && (
              <div className="rounded-xl border bg-card p-5">
                <h4 className="mb-2 text-sm font-semibold">About</h4>
                <p className="text-sm leading-relaxed text-muted-foreground">{security.description}</p>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
            Select a security to view details
          </div>
        )}
      </div>

      {/* ─────────────────── OPEN LIMIT ORDERS ─────────────────── */}
      {(openOrders.length > 0 || openOrdersLoading) && (
        <div className="lg:col-span-3">
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Open Limit Orders
              </h3>
              <Badge variant="outline">{openOrders.length} active</Badge>
            </div>
            {openOrdersLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading…
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left py-2.5 px-4 font-medium">Security</th>
                      <th className="text-left py-2.5 px-4 font-medium">Side</th>
                      <th className="text-right py-2.5 px-4 font-medium">Limit Price</th>
                      <th className="text-right py-2.5 px-4 font-medium">Qty</th>
                      <th className="text-right py-2.5 px-4 font-medium">Filled</th>
                      <th className="text-right py-2.5 px-4 font-medium">Remaining</th>
                      <th className="text-center py-2.5 px-4 font-medium">Status</th>
                      <th className="text-left py-2.5 px-4 font-medium">Placed</th>
                      <th className="text-center py-2.5 px-4 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openOrders.map((o) => (
                      <tr key={o.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-2.5 px-4 font-medium">{o.symbol}</td>
                        <td className="py-2.5 px-4">
                          <Badge
                            variant={o.side === "buy" ? "default" : "destructive"}
                            className="capitalize"
                          >
                            {o.side}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono-nums">
                          M{Number(o.price).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-4 text-right">{o.quantity}</td>
                        <td className="py-2.5 px-4 text-right text-primary">{o.filled_qty}</td>
                        <td className="py-2.5 px-4 text-right text-amber-400">{o.remaining_qty}</td>
                        <td className="py-2.5 px-4 text-center">
                          <Badge variant={o.status === "partial" ? "secondary" : "outline"} className="capitalize">
                            {o.status}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-4 text-muted-foreground text-xs">
                          {new Date(o.created_at).toLocaleString([], {
                            month: "short", day: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40"
                            onClick={() => handleCancel(o.id)}
                            disabled={cancellingId === o.id}
                          >
                            {cancellingId === o.id
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <><X className="h-3 w-3 mr-1" />Cancel</>}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────── TRADE / ORDER HISTORY ─────────────────── */}
      <div className="lg:col-span-3">
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <History className="h-5 w-5" />
              My Orders &amp; Trades
            </h3>
            <Badge variant="outline">{tradeHistory.length} records</Badge>
          </div>

          {historyLoading ? (
            <div className="text-center py-10 text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading…
            </div>
          ) : tradeHistory.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No orders or trades yet. Submit your first order above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left py-3 px-4 font-medium">Date</th>
                    <th className="text-left py-3 px-4 font-medium">Type</th>
                    <th className="text-left py-3 px-4 font-medium">Symbol</th>
                    <th className="text-right py-3 px-4 font-medium">Qty</th>
                    <th className="text-right py-3 px-4 font-medium">Price</th>
                    <th className="text-right py-3 px-4 font-medium">Total</th>
                    <th className="text-right py-3 px-4 font-medium text-amber-400">Fee</th>
                    <th className="text-center py-3 px-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tradeHistory.map((trade, idx) => (
                    <tr
                      key={`${trade.order_id || trade.id || "trade"}-${idx}`}
                      className="border-b last:border-0 hover:bg-muted/40"
                    >
                      <td className="py-3 px-4 text-muted-foreground text-xs">
                        {new Date(trade.created_at).toLocaleString([], {
                          month: "short", day: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={trade.type === "buy" ? "default" : "destructive"}
                          className="capitalize"
                        >
                          {trade.type}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 font-medium">{trade.symbol || "—"}</td>
                      <td className="py-3 px-4 text-right">{trade.quantity || "?"}</td>
                      <td className="py-3 px-4 text-right font-mono-nums">
                        M{Number(trade.price || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-medium font-mono-nums">
                        M{Number(trade.total || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right text-amber-400 font-mono-nums">
                        {Number(trade.broker_fee || 0) > 0
                          ? `M${Number(trade.broker_fee).toFixed(2)}`
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge
                          variant={
                            trade.status === "pending"  ? "outline"    :
                            trade.status === "filled"   ? "default"    :
                            trade.status === "settled"  ? "secondary"  :
                            "secondary"
                          }
                          className="capitalize"
                        >
                          {trade.status || "pending"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Order Book Row ──────────────────────────────────────────────────
function OrderBookRow({ price, qty, orders, side, maxQty }) {
  const pct = maxQty > 0 ? (Number(qty) / maxQty) * 100 : 0;
  const isAsk = side === "ask";
  return (
    <div className="relative flex items-center text-[11px] h-5 rounded overflow-hidden">
      {/* depth bar */}
      <div
        className={`absolute inset-y-0 ${isAsk ? "right-0 bg-rose-500/10" : "right-0 bg-primary/10"}`}
        style={{ width: `${pct}%` }}
      />
      <span className={`relative z-10 w-1/2 font-mono-nums ${isAsk ? "text-rose-400" : "text-primary"}`}>
        M{Number(price).toFixed(2)}
      </span>
      <span className="relative z-10 w-1/4 text-right text-muted-foreground">{Number(qty).toLocaleString()}</span>
      <span className="relative z-10 w-1/4 text-right text-muted-foreground/60">{orders}</span>
    </div>
  );
}

// ── Stat Box ────────────────────────────────────────────────────────
function StatBox({ label, value }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-bold">{value}</p>
    </div>
  );
}

// ── Price Chart ─────────────────────────────────────────────────────
function PriceChart({ data, positive }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 600, height = 200, padding = 10;

  const points = data.map((val, i) => ({
    x: padding + (i / (data.length - 1)) * (width  - 2 * padding),
    y: padding + (1 - (val - min) / range) * (height - 2 * padding),
  }));

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const fillD = pathD + ` L${points[points.length-1].x},${height} L${points[0].x},${height} Z`;
  const color = positive ? "hsl(var(--primary))" : "hsl(var(--destructive))";

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0"    />
        </linearGradient>
      </defs>
      <path d={fillD} fill="url(#chartGrad)" />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={points[points.length-1].x} cy={points[points.length-1].y} r="4" fill={color} />
    </svg>
  );
}
