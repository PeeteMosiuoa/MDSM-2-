"use client";

import { useState, useEffect } from "react";
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  X,
  Info,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { depositFunds, withdrawFunds } from "@/lib/store";

// Reusable Toast component (inside the file for simplicity)
function Toast({ type, message, onClose }) {
  const icons = {
    success: <CheckCircle2 className="h-5 w-5 text-green-500" />,
    error: <AlertCircle className="h-5 w-5 text-red-500" />,
    info: <Info className="h-5 w-5 text-blue-500" />,
  };

  const bg = {
    success: "bg-green-50 border-green-200 text-green-800",
    error: "bg-red-50 border-red-200 text-red-800",
    info: "bg-blue-50 border-blue-200 text-blue-800",
  };

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-start gap-3 rounded-lg p-4 shadow-lg border animate-slide-up ${bg[type] || bg.info}`}
      style={{ maxWidth: "320px" }}
    >
      {icons[type] || icons.info}
      <div className="flex-1">
        <p className="font-medium">{message}</p>
      </div>
      <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function WalletView({ user, wallet, onRefresh }) {
  const [mode, setMode] = useState(null);
  const [amountRaw, setAmountRaw] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  // Local balance – protected after successful transaction
  const [displayBalance, setDisplayBalance] = useState(wallet?.balance ?? 0);

  // Lock flag + timestamp: ignore parent for 12 seconds after server update
  const [lockUntil, setLockUntil] = useState(0);

  // Toast state (we'll show one at a time for simplicity)
  const [toast, setToast] = useState(null);

  // Sync from parent only if lock has expired
  useEffect(function () {
    var now = Date.now();
    if (now > lockUntil && wallet?.balance != null) {
      setDisplayBalance(Number(wallet.balance));
    }
  }, [wallet?.balance, lockUntil]);

  useEffect(function () {
    if (result?.success) {
      var timer = setTimeout(function () {
        setResult(null);
      }, 10000);
      return function () {
        clearTimeout(timer);
      };
    }
  }, [result]);

  function handleAmountChange(e) {
    var val = e.target.value;
    if (/^\d*\.?\d{0,2}$/.test(val)) {
      setAmountRaw(val);
    }
  }

  var displayAmount = amountRaw
    ? Number(amountRaw).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    : "";

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setResult(null);

    var amountNum = Number(amountRaw);
    if (isNaN(amountNum) || amountNum <= 0) {
      setResult({ success: false, message: "Enter an amount greater than 0." });
      setLoading(false);
      return;
    }

    if (mode === "deposit") {
      if (amountNum < 1_000) {
        setResult({ success: false, message: "Minimum deposit is M1,000." });
        setLoading(false);
        return;
      }
      if (amountNum > 100_000_000) {
        setResult({ success: false, message: "Maximum deposit is M100,000,000." });
        setLoading(false);
        return;
      }
    }

    if (mode === "withdraw" && amountNum > displayBalance) {
      setResult({ success: false, message: "Insufficient balance." });
      setLoading(false);
      return;
    }

    try {
      var response;
      if (mode === "deposit") {
        response = await depositFunds(user.id, amountNum);
      } else {
        response = await withdrawFunds(user.id, amountNum);
      }

      console.log("[WalletView] Server response:", response);

      if (response?.error) {
        setResult({ success: false, message: response.error });
        // Show error toast
        setToast({
          type: "error",
          message: response.error,
        });
        return;
      }

      var newBalance =
        response?.newBalance ??
        response?.balance ??
        response?.wallet?.balance ??
        response?.updatedBalance;

      if (newBalance !== undefined) {
        newBalance = Number(newBalance);
        setDisplayBalance(newBalance);

        // Lock for 12 seconds
        setLockUntil(Date.now() + 12000);

        // Show success toast
        setToast({
          type: "success",
          message: mode === "deposit"
            ? `Successfully deposited M${amountNum.toLocaleString()}! New balance: M${newBalance.toLocaleString()}`
            : `Withdrawal of M${amountNum.toLocaleString()} successful. New balance: M${newBalance.toLocaleString()}`,
        });

        setResult({
          success: true,
          message: "Success! New balance: M" + newBalance.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }) + " (dashboard refreshing...)",
        });
      } else {
        setResult({
          success: true,
          message: "Success! Refreshing balance...",
        });
      }

      // Trigger parent refresh with delay
      if (onRefresh) {
        setTimeout(onRefresh, 1500);
      }

      setAmountRaw("");
      setMode(null);
    } catch (err) {
      console.error("[WalletView] Transaction error:", err);
      setResult({
        success: false,
        message: err.message || "Failed – check console",
      });
      // Show error toast
      setToast({
        type: "error",
        message: "Transaction failed: " + (err.message || "Unknown error"),
      });
    } finally {
      setLoading(false);
    }
  }

  // Clear toast after timeout
  useEffect(() => {
    if (toast) {
      var timer = setTimeout(() => setToast(null), 6000);
      return function () {
        clearTimeout(timer);
      };
    }
  }, [toast]);

  return (
    <>
      {/* Main Wallet Card */}
      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center justify-between">
              <span>Virtual Trading Wallet</span>
              <Wallet className="h-6 w-6 text-blue-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center sm:text-left">
              <p className="text-sm text-gray-600">Available Balance</p>
              <p className="mt-1 text-4xl font-bold text-blue-700">
                M{Number(displayBalance).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {wallet?.currency || "LSL"} • Simulation only
              </p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4">
              <Button
                onClick={function () {
                  setMode("deposit");
                  setResult(null);
                  setAmountRaw("");
                }}
                className="h-11 bg-blue-600 hover:bg-blue-700"
              >
                <ArrowDownLeft className="mr-2 h-4 w-4" />
                Deposit
              </Button>
              <Button
                variant="outline"
                onClick={function () {
                  setMode("withdraw");
                  setResult(null);
                  setAmountRaw("");
                }}
                className="h-11"
              >
                <ArrowUpRight className="mr-2 h-4 w-4" />
                Withdraw
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Transaction Form */}
        {mode && (
          <Card className={mode === "deposit" ? "border-green-200" : "border-red-200"}>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle>
                  {mode === "deposit" ? "Add Virtual Funds" : "Withdraw Virtual Funds"}
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={function () { setMode(null); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="amount">Amount (LSL)</Label>
                    {mode === "deposit" && (
                      <span className="text-[11px] text-muted-foreground">
                        Min M1,000 · Max M100,000,000
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      id="amount"
                      type="text"
                      inputMode="decimal"
                      value={displayAmount}
                      onChange={handleAmountChange}
                      placeholder={mode === "deposit" ? "1,000 – 100,000,000" : "0"}
                      className={`text-lg h-12 pl-10 ${
                        mode === "deposit" && amountRaw
                          ? Number(amountRaw) < 1_000 || Number(amountRaw) > 100_000_000
                            ? "border-destructive focus-visible:ring-destructive"
                            : "border-primary/50"
                          : ""
                      }`}
                      required
                      disabled={loading}
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                      M
                    </span>
                  </div>

                  {/* Deposit range hint */}
                  {mode === "deposit" && amountRaw && (() => {
                    const n = Number(amountRaw);
                    if (n < 1_000)
                      return <p className="text-xs text-destructive">Minimum deposit is M1,000.</p>;
                    if (n > 100_000_000)
                      return <p className="text-xs text-destructive">Maximum deposit is M100,000,000.</p>;
                    return null;
                  })()}

                  {/* Quick-pick presets (deposit only) */}
                  {mode === "deposit" && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {[1_000, 5_000, 10_000, 50_000, 100_000, 500_000].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setAmountRaw(String(preset))}
                          disabled={loading}
                          className="rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:bg-primary/10 hover:text-primary transition-colors"
                        >
                          M{preset.toLocaleString()}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={function () { setMode(null); }}
                    disabled={loading}
                  >
                    Cancel
                  </Button>

                  <Button
                    type="submit"
                    className={"flex-1 " + (mode === "deposit" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700")}
                    disabled={
                      loading ||
                      !amountRaw ||
                      (mode === "deposit" && (Number(amountRaw) < 1_000 || Number(amountRaw) > 100_000_000))
                    }
                  >
                    {loading ? "Processing..." : mode === "deposit" ? "Add M" + (displayAmount || "0") : "Withdraw M" + (displayAmount || "0")}
                  </Button>
                </div>

                {result && (
                  <div
                    className={
                      "mt-4 flex items-start gap-3 rounded-lg p-4 text-sm border " +
                      (result.success
                        ? "bg-green-50 border-green-200 text-green-800"
                        : "bg-red-50 border-red-200 text-red-800")
                    }
                  >
                    {result.success ? (
                      <CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1">{result.message}</div>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Toast Notification */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={function () { setToast(null); }}
        />
      )}
    </>
  );
}