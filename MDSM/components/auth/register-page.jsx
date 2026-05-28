"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, ArrowLeft, Eye, EyeOff, Users, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerUser } from "@/app/actions/auth";
import { getBrokers, assignBroker } from "@/lib/store";

export default function RegisterPage({ onBack, onLogin }) {
  const router = useRouter();

  const [formData, setFormData] = useState({
    name:            "",
    email:           "",
    password:        "",
    confirmPassword: "",
    phone:           "",
    role:            "investor",
    companyReg:      "",
    brokerId:        "",   // only used for investor role
  });

  const [brokers, setBrokers]             = useState([]);
  const [brokersLoading, setBrokersLoading] = useState(false);
  const [error, setError]                 = useState("");
  const [fieldErrors, setFieldErrors]     = useState({});
  const [showPassword, setShowPassword]   = useState(false);
  const [showConfirm, setShowConfirm]     = useState(false);
  const [loading, setLoading]             = useState(false);

  const setFieldError = (field, msg) =>
    setFieldErrors((p) => ({ ...p, [field]: msg }));
  const clearFieldError = (field) =>
    setFieldErrors((p) => { const n = { ...p }; delete n[field]; return n; });

  // Password strength helper
  const pwStrength = (pw) => {
    let score = 0;
    if (pw.length >= 8)               score++;
    if (/[A-Z]/.test(pw))             score++;
    if (/[0-9]/.test(pw))             score++;
    if (/[^A-Za-z0-9]/.test(pw))      score++;
    return score; // 0-4
  };
  const strengthLabel = ["Too short","Weak","Fair","Good","Strong"];
  const strengthColor = ["bg-red-500","bg-red-400","bg-amber-400","bg-yellow-400","bg-emerald-500"];
  const pwScore = pwStrength(formData.password);

  const update = (field, value) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  // Clear company reg when not issuer; load brokers when investor
  useEffect(() => {
    if (formData.role !== "issuer") update("companyReg", "");
    if (formData.role !== "investor") {
      update("brokerId", "");
      setBrokers([]);
      return;
    }

    setBrokersLoading(true);
    getBrokers()
      .then((rows) => setBrokers(Array.isArray(rows) ? rows : []))
      .catch(() => setBrokers([]))
      .finally(() => setBrokersLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.role]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    const errs = {};

    // Name
    const nameTrimmed = formData.name.trim();
    if (!nameTrimmed)              errs.name = "This field is required.";
    else if (nameTrimmed.length < 2) errs.name = "Must be at least 2 characters.";
    else if (nameTrimmed.length > 100) errs.name = "Must be 100 characters or fewer.";

    // Email
    const emailTrimmed = formData.email.trim().toLowerCase();
    if (!emailTrimmed)             errs.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed))
                                   errs.email = "Enter a valid email address.";

    // Phone (optional but format-checked if provided)
    const phoneTrimmed = formData.phone.trim();
    if (phoneTrimmed && !/^\+?[\d\s\-().]{7,20}$/.test(phoneTrimmed))
      errs.phone = "Enter a valid phone number (e.g. +266 5800 0000).";

    // Password
    if (!formData.password)        errs.password = "Password is required.";
    else if (formData.password.length < 8)
                                   errs.password = "Password must be at least 8 characters.";

    // Confirm password
    if (!formData.confirmPassword) errs.confirmPassword = "Please confirm your password.";
    else if (formData.password !== formData.confirmPassword)
                                   errs.confirmPassword = "Passwords do not match.";

    // Role
    const allowedRoles = ["investor", "issuer", "broker"];
    if (!allowedRoles.includes(formData.role))
      errs.role = "Please select a valid account type.";

    // Issuer — company reg
    if (formData.role === "issuer") {
      const reg = formData.companyReg.trim();
      if (!reg)          errs.companyReg = "Company registration number is required.";
      else if (reg.length < 5) errs.companyReg = "Must be at least 5 characters.";
      else if (!/^[A-Za-z0-9\- ]+$/.test(reg)) errs.companyReg = "Only letters, numbers, hyphens and spaces allowed.";
    }

    // Investor — broker
    if (formData.role === "investor" && !formData.brokerId)
      errs.brokerId = "Please select a dedicated broker.";

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setError("Please fix the errors below before continuing.");
      return;
    }

    setLoading(true);

    const data = new FormData();
    data.append("name",  formData.name.trim());
    data.append("email", formData.email.trim().toLowerCase());
    data.append("password", formData.password);
    data.append("phone", formData.phone.trim());
    data.append("role",  formData.role);
    if (formData.role === "issuer" && formData.companyReg.trim()) {
      data.append("companyReg", formData.companyReg.trim());
    }

    try {
      const result = await registerUser(data);

      if (!result?.success) {
        setError(result?.error || "Registration failed");
        return;
      }

      const userId = result?.user?.id;

      // Assign broker immediately after investor account creation
      if (formData.role === "investor" && userId && formData.brokerId) {
        try {
          await assignBroker(userId, Number(formData.brokerId));
        } catch (brokerErr) {
          console.warn("[REGISTER] Broker assignment failed:", brokerErr);
          // Non-fatal — investor can reassign from dashboard
        }
      }

      if (userId) {
        localStorage.setItem("tempUser", JSON.stringify({
          id:            userId,
          name:          result.user.name  || formData.name.trim(),
          email:         result.user.email || formData.email.trim(),
          role:          result.user.role  || formData.role,
          walletAddress: result.user.walletAddress,
          registeredAt:  Date.now(),
        }));
      }

      router.push("/kyc");
      router.refresh();

    } catch (err) {
      console.error("[REGISTER] Error:", err);
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const getNameLabel = () => (formData.role === "issuer" ? "Company Name" : "Full Name");
  const publicRoles  = ["investor", "issuer", "broker"];

  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent px-4 py-12">
      <div className="w-full max-w-md">
        <button onClick={onBack}
          className="mb-8 flex items-center gap-2 rounded-full border border-white/30 bg-black/40 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/60 hover:border-white/60">
          <ArrowLeft className="h-4 w-4" /> Back to Home
        </button>

        <div className="rounded-2xl border border-white/10 bg-slate-800/75 backdrop-blur-md p-8 shadow-xl">
          <div className="mb-8 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <BarChart3 className="h-7 w-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Create Account</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Join the Maseru Digital Securities Market
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-6 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive border border-destructive/20">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Role Selection */}
            <div>
              <Label className="mb-2 block">Account Type</Label>
              <div className="grid grid-cols-3 gap-2.5">
                {publicRoles.map((role) => (
                  <button key={role} type="button" onClick={() => update("role", role)}
                    className={`rounded-lg border px-3 py-2.5 text-xs font-medium capitalize transition-all ${
                      formData.role === role
                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                        : "border-white/15 hover:border-primary/40 bg-white/5 text-muted-foreground"
                    }`}>
                    {role}
                  </button>
                ))}
              </div>
            </div>

            {/* Name */}
            <div>
              <Label>{getNameLabel()} <span className="text-red-500">*</span></Label>
              <Input placeholder={getNameLabel()} value={formData.name} maxLength={100}
                onChange={(e) => { update("name", e.target.value); clearFieldError("name"); }}
                autoComplete="name"
                className={fieldErrors.name ? "border-red-500 focus:border-red-500" : ""} />
              {fieldErrors.name && <p className="mt-1 text-xs text-red-400">{fieldErrors.name}</p>}
            </div>

            {/* Company Registration – issuer only */}
            {formData.role === "issuer" && (
              <div>
                <Label>Company Registration Number <span className="text-red-500">*</span></Label>
                <Input placeholder="e.g. C2024-12345" value={formData.companyReg} maxLength={50}
                  onChange={(e) => { update("companyReg", e.target.value); clearFieldError("companyReg"); }}
                  className={fieldErrors.companyReg ? "border-red-500 focus:border-red-500" : ""} />
                <p className="mt-1 text-[11px] text-muted-foreground">Letters, numbers, hyphens — minimum 5 characters</p>
                {fieldErrors.companyReg && <p className="mt-1 text-xs text-red-400">{fieldErrors.companyReg}</p>}
              </div>
            )}

            {/* Email */}
            <div>
              <Label>Email Address <span className="text-red-500">*</span></Label>
              <Input type="email" placeholder="you@example.co.ls" value={formData.email}
                onChange={(e) => { update("email", e.target.value); clearFieldError("email"); }}
                autoComplete="email"
                className={fieldErrors.email ? "border-red-500 focus:border-red-500" : ""} />
              {fieldErrors.email && <p className="mt-1 text-xs text-red-400">{fieldErrors.email}</p>}
            </div>

            {/* Phone */}
            <div>
              <Label>Phone Number <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input type="tel" placeholder="+266 5800 0000" value={formData.phone}
                onChange={(e) => { update("phone", e.target.value); clearFieldError("phone"); }}
                autoComplete="tel"
                className={fieldErrors.phone ? "border-red-500 focus:border-red-500" : ""} />
              {fieldErrors.phone && <p className="mt-1 text-xs text-red-400">{fieldErrors.phone}</p>}
            </div>

            {/* Password */}
            <div>
              <Label>Password <span className="text-red-500">*</span></Label>
              <div className="relative">
                <Input type={showPassword ? "text" : "password"} placeholder="Minimum 8 characters"
                  value={formData.password}
                  onChange={(e) => { update("password", e.target.value); clearFieldError("password"); clearFieldError("confirmPassword"); }}
                  autoComplete="new-password"
                  className={fieldErrors.password ? "border-red-500 focus:border-red-500" : ""} />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {/* Strength meter */}
              {formData.password.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1">
                    {[1,2,3,4].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${pwScore >= i ? strengthColor[pwScore] : "bg-white/10"}`} />
                    ))}
                  </div>
                  <p className={`text-[11px] font-medium ${pwScore <= 1 ? "text-red-400" : pwScore === 2 ? "text-amber-400" : pwScore === 3 ? "text-yellow-400" : "text-emerald-400"}`}>
                    {strengthLabel[pwScore]} — {pwScore < 4 ? "add uppercase, numbers or symbols to strengthen" : "Strong password!"}
                  </p>
                </div>
              )}
              {fieldErrors.password && <p className="mt-1 text-xs text-red-400">{fieldErrors.password}</p>}
            </div>

            {/* Confirm Password */}
            <div>
              <Label>Confirm Password <span className="text-red-500">*</span></Label>
              <div className="relative">
                <Input type={showConfirm ? "text" : "password"} placeholder="Repeat password"
                  value={formData.confirmPassword}
                  onChange={(e) => { update("confirmPassword", e.target.value); clearFieldError("confirmPassword"); }}
                  autoComplete="new-password"
                  className={fieldErrors.confirmPassword ? "border-red-500 focus:border-red-500" : ""} />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <p className="mt-1 text-xs text-red-400">Passwords do not match.</p>
              )}
              {formData.confirmPassword && formData.password === formData.confirmPassword && formData.confirmPassword.length > 0 && (
                <p className="mt-1 text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Passwords match</p>
              )}
              {fieldErrors.confirmPassword && <p className="mt-1 text-xs text-red-400">{fieldErrors.confirmPassword}</p>}
            </div>

            {/* ── Broker Selection (investor only) ── */}
            {formData.role === "investor" && (
              <div>
                <Label className="mb-2 block">
                  Dedicated Broker <span className="text-red-500">*</span>
                </Label>
                <p className="text-xs text-muted-foreground mb-3">
                  Choose a licensed broker who will manage and execute your orders.
                </p>

                {brokersLoading ? (
                  <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading brokers…
                  </div>
                ) : brokers.length === 0 ? (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-400">
                    No licensed brokers are currently registered. Please contact support.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {brokers.map((b) => {
                      const isSelected = String(formData.brokerId) === String(b.id);
                      return (
                        <button key={b.id} type="button"
                          onClick={() => update("brokerId", b.id)}
                          className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                            isSelected
                              ? "border-primary bg-primary/10"
                              : "border-white/10 bg-white/5 hover:border-primary/40 hover:bg-white/[0.07]"
                          }`}>
                          {/* Avatar */}
                          <div className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm
                            ${isSelected ? "bg-primary/30 text-primary" : "bg-slate-700 text-slate-400"}`}>
                            {(b.full_name || "?")[0].toUpperCase()}
                          </div>
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className={`font-semibold text-sm truncate ${isSelected ? "text-primary" : "text-foreground"}`}>
                              {b.full_name}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">{b.email}</p>
                          </div>
                          {/* Check */}
                          {isSelected && (
                            <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                {fieldErrors.brokerId && <p className="mt-2 text-xs text-red-400">{fieldErrors.brokerId}</p>}
              </div>
            )}

            <Button type="submit" className="w-full mt-2" disabled={loading}>
              {loading
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating Account…</>
                : "Create Account"}
            </Button>
          </form>

          <div className="mt-8 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <button onClick={onLogin} className="font-medium text-primary hover:underline">
              Sign in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
