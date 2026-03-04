"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) return;
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError("Email หรือ Password ไม่ถูกต้อง");
    } else {
      router.push("/");
      router.refresh();
    }
  };

  const F: React.CSSProperties = {
    width: "100%", padding: "10px 14px", borderRadius: 6,
    border: "1px solid #1c2a3a", background: "#111823",
    color: "#c9d6e3", fontSize: 13, fontFamily: "monospace",
    outline: "none", boxSizing: "border-box",
  };
  const L: React.CSSProperties = {
    fontSize: 10, color: "#4a6274", fontWeight: 700,
    letterSpacing: "0.08em", textTransform: "uppercase",
    display: "block", marginBottom: 5,
  };

  return (
    <div style={{ background: "#07090f", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "monospace" }}>
      <div style={{ background: "#0d1117", border: "1px solid #1c2a3a", borderRadius: 12, padding: 32, width: 340 }}>

        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>⚡</div>
          <div style={{ fontSize: 9, color: "#4a6274", textTransform: "uppercase", letterSpacing: "0.15em" }}>EV CHARGER</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#00c8ff" }}>TROUBLESHOOTING SYSTEM</div>
          <div style={{ fontSize: 10, color: "#4a6274", marginTop: 4 }}>กรุณาเข้าสู่ระบบ</div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={L}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="your@email.com"
            style={F}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={L}>Password</label>
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(""); }}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            placeholder="••••••••"
            style={{ ...F, borderColor: error ? "#ff3b3b" : "#1c2a3a" }}
          />
          {error && (
            <div style={{ color: "#ff3b3b", fontSize: 11, marginTop: 6 }}>⚠ {error}</div>
          )}
        </div>

        <button
          onClick={handleLogin}
          disabled={loading || !email || !password}
          style={{ width: "100%", padding: "11px", borderRadius: 6, border: "none", background: (loading || !email || !password) ? "#1c2a3a" : "linear-gradient(135deg,#00c8ff,#0088cc)", color: (loading || !email || !password) ? "#4a6274" : "#000", fontWeight: 700, fontSize: 14, cursor: (loading || !email || !password) ? "not-allowed" : "pointer", fontFamily: "monospace" }}
        >
          {loading ? "⏳ กำลังเข้าสู่ระบบ..." : "🔐 เข้าสู่ระบบ"}
        </button>

      </div>
    </div>
  );
}