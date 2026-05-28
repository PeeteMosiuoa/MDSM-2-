// components/KycFormClient.jsx
"use client";

import { useState } from "react";
import { submitKYC } from "@/app/actions/auth";

export default function KycFormClient({ session }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result = await submitKYC(formData);

    if (result?.error) {
      setError(result.error);
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>Submit KYC</h2>
      <input type="text" name="idNumber" placeholder="ID Number" required />
      {/* Add more fields */}
      <button type="submit" disabled={loading}>
        {loading ? "Submitting..." : "Submit"}
      </button>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </form>
  );
}