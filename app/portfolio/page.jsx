// app/portfolio/page.jsx
"use client";

import { useState, useEffect } from "react";
import PortfolioView from "@/components/portfolio-view";

export default function PortfolioPage() {
  const [portfolioData, setPortfolioData] = useState({
    portfolio: [],
    totalValue: 0,
    totalGain: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadPortfolio() {
      try {
        // You can use fetch("/api/portfolio") or call server action
        const res = await fetch("/api/portfolio"); // or your endpoint
        if (!res.ok) throw new Error("Failed to load portfolio");
        const data = await res.json();
        setPortfolioData(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadPortfolio();
  }, []);

  if (loading) {
    return <div className="p-8 text-center">Loading portfolio...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-600">Error: {error}</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Your Portfolio</h1>
      <PortfolioView
        portfolio={portfolioData.portfolio}
        totalValue={portfolioData.totalValue}
        totalGain={portfolioData.totalGain}
      />
    </div>
  );
}