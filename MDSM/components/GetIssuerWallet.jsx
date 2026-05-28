'use client';

import React, { useState } from 'react';

export default function GetIssuerWallet() {
  const [issuerId, setIssuerId] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const getIssuerWallet = async (id) => {
    setLoading(true);
    setResult(null);

    try {
      // ← Replace this mock later with real API call
      await new Promise(resolve => setTimeout(resolve, 600));

      const mockWallets = {
        60: '0x3d858298271464e7239aE40D6E6812936CD78c2B',
        61: '0xdAcb9cc8b596a7F0e5937A847d5b5e56E3208bbE',
        64: '0xCB0F7F6c523214b66268Ef68Bb57e9fdf5767F67',
      };

      const wallet = mockWallets[id];

      if (!wallet) {
        setResult({ error: `No wallet found for issuer ${id}` });
      } else {
        setResult({
          success: true,
          walletAddress: wallet,
          issuerId: id
        });
      }
    } catch (error) {
      setResult({ error: 'Failed to fetch wallet address. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const id = parseInt(issuerId.trim(), 10);

    if (!id || isNaN(id)) {
      setResult({ error: 'Please enter a valid numeric Issuer ID' });
      return;
    }

    getIssuerWallet(id);
  };

  const copyToClipboard = (address) => {
    navigator.clipboard.writeText(address);
    alert('✅ Wallet address copied!');
  };

  return (
    <div style={{ 
      maxWidth: '520px', 
      margin: '40px auto', 
      padding: '32px', 
      fontFamily: 'system-ui, Arial, sans-serif',
      backgroundColor: '#f9fafb',
      borderRadius: '12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
    }}>
      <h2>Get Issuer Wallet</h2>
      <p style={{ color: '#555', marginBottom: '24px' }}>
        Enter Issuer ID to retrieve wallet address
      </p>

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={issuerId}
          onChange={(e) => setIssuerId(e.target.value)}
          placeholder="Enter Issuer ID (e.g. 60)"
          style={{
            width: '100%',
            padding: '14px',
            fontSize: '16px',
            border: '1px solid #ccc',
            borderRadius: '8px',
            marginBottom: '12px'
          }}
        />
        
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px',
            backgroundColor: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Fetching...' : 'Get Wallet Address'}
        </button>
      </form>

      {result && (
        <div style={{
          marginTop: '24px',
          padding: '20px',
          borderRadius: '8px',
          backgroundColor: result.success ? '#ecfdf5' : '#fef2f2',
          border: `1px solid ${result.success ? '#a7f3d0' : '#fecaca'}`
        }}>
          {result.success ? (
            <>
              <div style={{ color: '#166534', fontWeight: 'bold', marginBottom: '12px' }}>
                ✅ Wallet Found for ID {result.issuerId}
              </div>
              <div style={{
                backgroundColor: '#fff',
                padding: '16px',
                borderRadius: '6px',
                fontFamily: 'monospace',
                wordBreak: 'break-all',
                marginBottom: '16px'
              }}>
                {result.walletAddress}
              </div>
              <button
                onClick={() => copyToClipboard(result.walletAddress)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                📋 Copy Address
              </button>
            </>
          ) : (
            <div style={{ color: '#b91c1c' }}>❌ {result.error}</div>
          )}
        </div>
      )}
    </div>
  );
}