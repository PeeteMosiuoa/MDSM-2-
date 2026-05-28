"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Shield, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitKYC } from "@/app/actions/auth";

export default function KycPage({ user, targetDashboard }) {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    idNumber: "",
    idType: "national_id",
    dateOfBirth: "",
    address: "",
    city: "Maseru",
    occupation: "",
    sourceOfFunds: "",

    // Issuer / Broker
    licenseNumber: "",
    directorsInfo: "",
    idProof: null,
    proofOfAddress: null,
    licenseProof: null,
    companyRegProof: null,
    financialsProof: null,

    // Regulator / Admin
    appointmentLetter: null,
  });

  const role = user?.role?.toLowerCase() || "investor";

  // ==================== DASHBOARD ROUTING ====================
  const getCorrectDashboard = () => {
    const defaultDashboards = {
      investor: "/dashboards/investor-dashboard",
      broker: "/dashboards/broker-dashboard",
      issuer: "/dashboards/issuer-dashboard",
      regulator: "/dashboards/regulator-dashboard",
      admin: "/dashboards/admin-dashboard",
    };

    if (targetDashboard && typeof targetDashboard === "string" && targetDashboard.startsWith("/")) {
      return targetDashboard;
    }

    return defaultDashboards[role] || "/dashboards";
  };

  const dashboardRoute = getCorrectDashboard();

  // Session validation
  useEffect(() => {
    const tempUserStr = localStorage.getItem("tempUser");

    if (!tempUserStr || tempUserStr.trim() === "" || tempUserStr === "undefined") {
      setError("No active registration session found. Please register first.");
      setTimeout(() => router.replace("/register"), 2000);
      return;
    }

    try {
      const parsed = JSON.parse(tempUserStr);
      if (!parsed || !parsed.id) {
        localStorage.removeItem("tempUser");
        setError("Invalid session data. Please register again.");
        setTimeout(() => router.replace("/register"), 2000);
      }
    } catch (err) {
      localStorage.removeItem("tempUser");
      setError("Session data corrupted. Please register again.");
      setTimeout(() => router.replace("/register"), 2000);
    }
  }, [router]);

  const update = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    const errors = [];

    if (!formData.address.trim()) errors.push("Address is required");

    if (role === "investor") {
      if (!formData.idNumber.trim()) errors.push("ID/Passport number is required");
      if (!formData.dateOfBirth) errors.push("Date of birth is required");
      if (!formData.occupation.trim()) errors.push("Occupation is required");
      if (!formData.sourceOfFunds) errors.push("Source of funds is required");
      if (!formData.idProof) errors.push("ID document + selfie is required");
    }

    if (["issuer", "broker"].includes(role)) {
      if (!formData.licenseNumber.trim()) errors.push("License/Registration number required");
      if (!formData.directorsInfo.trim()) errors.push("Directors information required");
    }

    if (["regulator", "admin"].includes(role)) {
      if (!formData.appointmentLetter) errors.push("Official appointment letter required");
    }

    return errors.length ? errors.join(" • ") : null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!user?.id) {
      setError("User ID is missing. Please register again.");
      return;
    }

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const payload = new FormData();
      payload.append("userId", user.id.toString());
      payload.append("role", role);
      payload.append("address", formData.address.trim());
      payload.append("city", formData.city.trim());

      if (role === "investor") {
        payload.append("idNumber", formData.idNumber.trim());
        payload.append("idType", formData.idType);
        payload.append("dateOfBirth", formData.dateOfBirth);
        payload.append("occupation", formData.occupation.trim());
        payload.append("sourceOfFunds", formData.sourceOfFunds);

        if (formData.idProof) payload.append("idProof", formData.idProof);
        if (formData.proofOfAddress) payload.append("proofOfAddress", formData.proofOfAddress);
      }

      if (["issuer", "broker"].includes(role)) {
        payload.append("licenseNumber", formData.licenseNumber.trim());
        payload.append("directorsInfo", formData.directorsInfo.trim());
        if (formData.licenseProof) payload.append("licenseProof", formData.licenseProof);
        if (formData.companyRegProof) payload.append("companyRegProof", formData.companyRegProof);
        if (formData.financialsProof) payload.append("financialsProof", formData.financialsProof);
      }

      if (["regulator", "admin"].includes(role)) {
        if (formData.appointmentLetter) payload.append("appointmentLetter", formData.appointmentLetter);
      }

      const result = await submitKYC(payload);

      if (!result?.success) {
        setError(result?.error || "KYC submission failed. Please try again.");
        return;
      }

      // SUCCESS: Promote tempUser → user so the dashboard can read the session
      const rawTemp = localStorage.getItem("tempUser");
      if (rawTemp) {
        localStorage.setItem("user", rawTemp);
        localStorage.removeItem("tempUser");
      }

      setSubmitted(true);

      setTimeout(() => {
        window.location.href = dashboardRoute;
      }, 1400);

    } catch (err) {
      console.error("KYC submission error:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Success Screen
  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-transparent px-4">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-800/75 backdrop-blur-md p-10 text-center shadow-lg">
          <CheckCircle2 className="mx-auto h-16 w-16 text-primary mb-6" />
          <h2 className="text-2xl font-bold mb-3">Verification Submitted</h2>
          <p className="text-muted-foreground mb-8">
            {role === "investor"
              ? "Your KYC documents are under review. You will be notified once approved."
              : "Your application and documents have been submitted for review."}
          </p>
          <Button
            className="w-full"
            size="lg"
            onClick={() => {
              // Ensure user session exists before navigating (belt-and-suspenders)
              const raw = localStorage.getItem("tempUser");
              if (raw) {
                localStorage.setItem("user", raw);
                localStorage.removeItem("tempUser");
              }
              window.location.href = dashboardRoute;
            }}
          >
            Go to {role.charAt(0).toUpperCase() + role.slice(1)} Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Main Form
  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent p-6">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-800/75 backdrop-blur-md p-8 md:p-10 shadow-xl">
        <div className="mb-8 flex items-center gap-4">
          <div className="rounded-xl bg-primary/10 p-3">
            <Shield className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              {role === "investor"
                ? "Investor KYC Verification"
                : role === "issuer"
                ? "Issuer Application & Verification"
                : role === "broker"
                ? "Broker Licensing & KYC"
                : role === "regulator"
                ? "Regulator Access Verification"
                : "Admin Access Verification"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Required under Central Bank of Lesotho regulations
            </p>
          </div>
        </div>

        {["regulator", "admin"].includes(role) && (
          <div className="mb-6 rounded-lg bg-amber-50 p-4 border border-amber-200 text-amber-800 text-sm flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <p>High-privilege roles require manual approval.</p>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-lg bg-destructive/10 p-4 text-sm text-destructive border border-destructive/20">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Common fields */}
          <div>
            <Label>Full Residential / Registered Address</Label>
            <Input
              placeholder="Street, Plot No., District"
              value={formData.address}
              onChange={(e) => update("address", e.target.value)}
              required
            />
          </div>

          <div>
            <Label>City</Label>
            <Input
              value={formData.city}
              onChange={(e) => update("city", e.target.value)}
              placeholder="Maseru"
            />
          </div>

          {/* Investor-specific fields */}
          {role === "investor" && (
            <>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <Label>ID Type</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-white/15 bg-white/10 px-3 py-2 text-sm text-foreground"
                    value={formData.idType}
                    onChange={(e) => update("idType", e.target.value)}
                  >
                    <option value="national_id">National ID</option>
                    <option value="passport">Passport</option>
                    <option value="drivers_license">Driver's License</option>
                  </select>
                </div>
                <div>
                  <Label>ID / Passport Number</Label>
                  <Input
                    placeholder="ID number"
                    value={formData.idNumber}
                    onChange={(e) => update("idNumber", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <Label>Date of Birth</Label>
                  <Input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => update("dateOfBirth", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label>Occupation / Profession</Label>
                  <Input
                    placeholder="e.g. Teacher, Business Owner"
                    value={formData.occupation}
                    onChange={(e) => update("occupation", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <Label>Source of Funds</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-white/15 bg-white/10 px-3 py-2 text-sm text-foreground"
                  value={formData.sourceOfFunds}
                  onChange={(e) => update("sourceOfFunds", e.target.value)}
                  required
                >
                  <option value="">Select source</option>
                  <option value="salary">Salary / Employment</option>
                  <option value="business">Business income</option>
                  <option value="investment">Investment returns</option>
                  <option value="savings">Savings / Inheritance</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <Label>ID Document </Label>
                <Input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => update("idProof", e.target.files?.[0] || null)}
                  required
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Clear photo or scan • Max 6MB
                </p>
              </div>

              <div>
                <Label>Proof of Address </Label>
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => update("proofOfAddress", e.target.files?.[0] || null)}
                />
              </div>
            </>
          )}

          {/* Issuer / Broker fields */}
          {["issuer", "broker"].includes(role) && (
            <>
              <div>
                <Label>
                  {role === "issuer" ? "Company Registration / Listing Reference" : "Broker License Number"}
                </Label>
                <Input
                  placeholder={role === "issuer" ? "C2024-XXXXX or Listing Ref" : "Broker license number"}
                  value={formData.licenseNumber}
                  onChange={(e) => update("licenseNumber", e.target.value)}
                  required
                />
              </div>

              <div>
                <Label>Key Directors / Authorized Representatives</Label>
                <Textarea
                  placeholder="Names, positions, and contact (one per line)"
                  value={formData.directorsInfo}
                  onChange={(e) => update("directorsInfo", e.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <Label>Upload License / Registration Certificate</Label>
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => update("licenseProof", e.target.files?.[0] || null)}
                  />
                </div>
                {role === "issuer" && (
                  <div>
                    <Label>Certificate of Incorporation</Label>
                    <Input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => update("companyRegProof", e.target.files?.[0] || null)}
                    />
                  </div>
                )}
              </div>

              {role === "issuer" && (
                <div>
                  <Label>Audited Financial Statements (optional)</Label>
                  <Input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => update("financialsProof", e.target.files?.[0] || null)}
                  />
                </div>
              )}
            </>
          )}

          {/* Regulator / Admin */}
          {["regulator", "admin"].includes(role) && (
            <div>
              <Label>Official Appointment Letter / Authorization Document</Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => update("appointmentLetter", e.target.files?.[0] || null)}
                required
              />
            </div>
          )}

          <Button
            type="submit"
            className="w-full mt-6"
            disabled={loading}
            size="lg"
          >
            {loading ? "Submitting..." : "Submit Verification Documents"}
          </Button>
        </form>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Your information is encrypted and used solely for compliance and regulatory purposes.
        </p>
      </div>
    </div>
  );
}