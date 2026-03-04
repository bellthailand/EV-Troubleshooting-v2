"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import Link from "next/link";

interface FileEntry {
  name: string;
  type: string;
  data: string;
}

interface Case {
  id: string;
  created_at: string;
  date: string;
  station: string;
  charger_type: string;
  error_code: string;
  symptom: string;
  root_cause: string;
  solution: string;
  tags: string;
  files: FileEntry[];
}

export default function HomePage() {
  const [keyword,  setKeyword]  = useState("");
  const [cases,    setCases]    = useState<Case[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [searched, setSearched] = useState(false);

  const search = useCallback(async (kw: string) => {
    setLoading(true);
    setSearched(true);
    let query = supabase
      .from("cases")
      .select("*")
      .order("date", { ascending: false })
      .limit(50);

    if (kw.trim()) {
      query = query.or(
        `error_code.ilike.%${kw}%,symptom.ilike.%${kw}%,root_cause.ilike.%${kw}%,station.ilike.%${kw}%,tags.ilike.%${kw}%`
      );
    }

    const { data, error } = await query;
    setLoading(false);
    if (error) { alert("Error: " + error.message); return; }
    setCases((data as Case[]) ?? []);
  }, []);

  useEffect(() => { search(""); }, [search]);

  const C = { bg:"#07090f", bg2:"#0d1117", bg3:"#111823", brd:"#1c2a3a", cyn:"#00c8ff", grn:"#00e87a", sub:"#4a6274", txt:"#c9d6e3", yel:"#ffd700", amb:"#ff8c00" };
  const FONT = "monospace";

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.txt, fontFamily: FONT, fontSize: 13 }}>

      {/* Header */}
      <div style={{ background: "#070d14", borderBottom: `1px solid ${C.brd}`, padding: "10px 16px", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 800, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 9, color: C.sub, textTransform: "uppercase", letterSpacing: "0.15em" }}>EV CHARGER</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.cyn }}>TROUBLESHOOTING & INTELLIGENCE SYSTEM</div>
          </div>
          <Link href="/new-case" style={{ padding: "8px 16px", borderRadius: 6, background: `linear-gradient(135deg,${C.grn},#00aa55)`, color: "#000", fontWeight: 700, fontSize: 12, textDecoration: "none", fontFamily: FONT }}>
            + บันทึกเคสใหม่
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: 16 }}>

        {/* Search */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && search(keyword)}
            placeholder="ค้นหา Error Code / อาการ / สถานี / สาเหตุ / Tag..."
            style={{ flex: 1, background: C.bg3, border: `1px solid ${C.brd}`, borderRadius: 6, color: C.txt, fontSize: 13, padding: "10px 14px", outline: "none", fontFamily: FONT }}
          />
          <button
            onClick={() => search(keyword)}
            style={{ padding: "10px 20px", borderRadius: 6, border: "none", background: `linear-gradient(135deg,${C.cyn},#0088cc)`, color: "#000", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: FONT }}
          >
            🔍 ค้นหา
          </button>
        </div>

        {/* Stats */}
        <div style={{ fontSize: 10, color: C.sub, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
          {loading ? "กำลังโหลด..." : `พบ ${cases.length} เคส${keyword ? ` ที่ตรงกับ "${keyword}"` : " ล่าสุด"}`}
        </div>

        {/* Empty */}
        {!loading && searched && cases.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: C.sub }}>
            <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>🔍</div>
            <div>ไม่พบเคสที่ตรงกัน</div>
          </div>
        )}

        {/* Case list */}
        {cases.map(c => (
          <div key={c.id} style={{ background: C.bg2, border: `1px solid ${C.brd}`, borderRadius: 8, padding: 16, marginBottom: 12 }}>

            {/* Top row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: C.sub }}>{c.date} · {c.station} {c.charger_type ? `· ${c.charger_type}` : ""}</div>
                {c.error_code && (
                  <div style={{ marginTop: 4 }}>
                    <span style={{ background: "#ff8c0022", border: "1px solid #ff8c00", borderRadius: 4, padding: "2px 8px", color: "#ff8c00", fontSize: 10, fontWeight: 700 }}>
                      {c.error_code}
                    </span>
                  </div>
                )}
              </div>
              {c.tags && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end", maxWidth: 200 }}>
                  {c.tags.split(",").map((t, i) => (
                    <span key={i} style={{ background: C.bg3, border: `1px solid ${C.brd}`, borderRadius: 3, padding: "2px 7px", color: C.sub, fontSize: 9 }}>
                      {t.trim()}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Fields */}
            {[
              ["อาการที่พบ",       c.symptom,    C.txt],
              ["สาเหตุที่แท้จริง", c.root_cause, C.yel],
              ["วิธีแก้ไข",        c.solution,   C.grn],
            ].map(([label, value, color]) => value ? (
              <div key={label as string} style={{ background: C.bg3, borderRadius: 6, padding: "10px 12px", marginBottom: 8 }}>
                <div style={{ fontSize: 9, color: C.sub, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{label}</div>
                <div style={{ color: color as string, fontSize: 12, lineHeight: 1.6 }}>{value}</div>
              </div>
            ) : null)}

            {/* Files */}
            {c.files && c.files.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 9, color: C.sub, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                  ไฟล์แนบ ({c.files.length})
                </div>

                {/* Images */}
                {c.files.filter(f => f.type.startsWith("image/")).length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginBottom: 8 }}>
                    {c.files.filter(f => f.type.startsWith("image/")).map((f, i) => (
                      <img key={i} src={f.data} alt={f.name} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 6, border: `1px solid ${C.brd}` }} />
                    ))}
                  </div>
                )}

                {/* PDFs */}
                {c.files.filter(f => f.type === "application/pdf").map((f, i) => (
                  <a key={i} href={f.data} download={f.name}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 6, border: `1px solid ${C.brd}`, color: C.cyn, fontSize: 11, textDecoration: "none", marginRight: 6, marginBottom: 4 }}>
                    📄 {f.name}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}