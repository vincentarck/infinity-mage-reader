"use client";

import { useState, useEffect } from "react";
import Reader from "@/components/Reader";

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    // Check if user is already logged in
    const authStatus = localStorage.getItem("infinity_auth");
    if (authStatus === "true") {
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false); // Finished checking
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (phone === "082213781839" && password === "Namikaze6621594!@#") {
      localStorage.setItem("infinity_auth", "true");
      setIsAuthenticated(true);
      setErrorMsg("");
    } else {
      setErrorMsg("Nomor HP atau Kata Sandi salah.");
    }
  };

  // Wait for initial check
  if (isAuthenticated === null) {
      return <div style={{ minHeight: "100vh", display: 'flex', justifyContent: 'center', alignItems: 'center' }}><div className="spinner" /></div>;
  }

  if (!isAuthenticated) {
    return (
      <div style={{ 
        minHeight: "100vh", display: 'flex', justifyContent: 'center', alignItems: 'center', 
        padding: '1rem' 
      }}>
        <form onSubmit={handleLogin} className="glass" style={{
          padding: '2rem', borderRadius: '20px', width: '100%', maxWidth: '400px',
          display: 'flex', flexDirection: 'column', gap: '1.5rem',
          border: '1px solid var(--glass-border)'
        }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, textAlign: 'center' }}>Login Infinity Mage</h1>
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Masukkan kredensial Anda untuk membaca.</p>
          
          {errorMsg && <div style={{ color: '#ff6b6b', background: 'rgba(255,107,107,0.1)', padding: '0.8rem', borderRadius: '8px', fontSize: '0.9rem', textAlign: 'center' }}>{errorMsg}</div>}

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Nomor HP</label>
            <input 
              type="text" 
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Contoh: 0822..."
              style={{
                width: '100%', padding: '0.8rem', borderRadius: '10px',
                border: '1px solid var(--glass-border)', background: 'var(--background-color)',
                color: 'var(--text-primary)', outline: 'none'
              }}
              required
            />
          </div>

          <div>
             <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Kata Sandi</label>
             <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%', padding: '0.8rem', borderRadius: '10px',
                border: '1px solid var(--glass-border)', background: 'var(--background-color)',
                color: 'var(--text-primary)', outline: 'none'
              }}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ padding: '0.8rem', borderRadius: '10px', fontSize: '1rem', marginTop: '0.5rem' }}>
            Masuk
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <Reader />
    </div>
  );
}
