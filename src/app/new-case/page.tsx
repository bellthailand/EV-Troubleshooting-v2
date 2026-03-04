"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";

interface FileEntry {
  name: string;
  type: string;
  data: string;
}

export default function NewCasePage() {
  const [date,        setDate]        = useState("");
  const [station,     setStation]     = useState("");
  const [chargerType, setChargerType] = useState("");
  const [errorCode,   setErrorCode]   = useState("");
  const [symptom,     setSymptom]     = useState("");
  const [rootCause,   setRootCause]   = useState("");
  const [solution,    setSolution]    = useState("");
  const [tags,        setTags]        = useState("");
  const [fileList,    setFileList]    = useState<File[]>([]);
  const [loading,     setLoading]     = useState(false);

  const compressImage = (file: File): Promise<string> =>
    new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let w = img.width, h = img.height;
          if (w > 800) { h = Math.round(h * 800 / w); w = 800; }
          canvas.width = w; canvas.height = h;
          canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", 0.7));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });

  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target?.result as string);
      reader.readAsDataURL(file);
    });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selected = Array.from(e.target.files);
    if (selected.length > 5) {
      alert("อัปโหลดได้ไม่เกิน 5 ไฟล์");
      return;
    }
    setFileList(selected);
  };

  const handleSubmit = async () => {
    if (!date || !station || !symptom) {
      alert("กรุณากรอก วันที่ / สถานี / อาการ อย่างน้อย");
      return;
    }
    setLoading(true);

    const files: FileEntry[] = await Promise.all(
      fileList.map(async f => ({
        name: f.name,
        type: f.type,
        data: f.type.startsWith("image/")
          ? await compressImage(f)
          : await readFileAsBase64(f),
      }))
    );

    const { error } = await supabase.from("cases").insert([{
      date, station, charger_type: chargerType,
      error_code: errorCode, symptom, root_cause: rootCause,
      solution, tags, files,
    }]);

    setLoading(false);
    if (error) {
      alert("Error: " + error.message);
    } else {
      alert("บันทึกสำเร็จ ✅");
      setDate(""); setStation(""); setChargerType(""); setErrorCode("");
      setSymptom(""); setRootCause(""); setSolution(""); setTags("");
      setFileList([]);
    }
  };

  const F: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: 6,
    border: "1px solid #2a3a4a", background: "#111823",
    color: "#c9d6e3", fontSize: 13, boxSizing: "border-box",
    fontFamily: "monospace", outline: "none",
  };
  const L: React.CSSProperties = {
    fontSize: 10, color: "#4a6274", fontWeight: 700,
    letterSpacing: "0.08em", display: "block",
    marginBottom: 5, textTransform: "uppercase",
  };
  const ROW: React.CSSProperties = { marginBottom: 14 };

  return (
    <div style={{ background: "#07090f", minHeight: "100vh", color: "#c9d6e3", fontFamily: "monospace", fontSize: 13 }}>
      <div style={{ background: "#070d14", borderBottom: "1px solid #1c2a3a", padding: "12px 16px", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ fontSize: 9, color: "#4a6274", textTransform: "uppercase", letterSpacing: "0.15em" }}>EV CHARGER</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#00c8ff" }}>บันทึกเคสใหม่</div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: 16 }}>
        <div style={{ background: "#0d1117", border: "1px solid #1c2a3a", borderRadius: 8, padding: 16 }}>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <div>
              <label style={L}>วันที่ *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={F} />
            </div>
            <div>
              <label style={L}>สถานีชาร์จ *</label>
              <input type="text" value={station} onChange={e => setStation(e.target.value)} placeholder="เช่น ปตท. รามคำแหง" style={F} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <div>
              <label style={L}>Charger Type</label>
              <input type="text" value={chargerType} onChange={e => setChargerType(e.target.value)} placeholder="เช่น DC 30kW, AC 22kW" style={F} />
            </div>
            <div>
              <label style={L}>Error Code</label>
              <input type="text" value={errorCode} onChange={e => setErrorCode(e.target.value)} placeholder="เช่น 0x0400, Code 14" style={F} />
            </div>
          </div>

          <div style={ROW}>
            <label style={L}>อาการที่พบ *</label>
            <textarea value={symptom} onChange={e => setSymptom(e.target.value)} placeholder="อธิบายอาการที่พบ..." rows={3} style={{ ...F, resize: "vertical" }} />
          </div>

          <div style={ROW}>
            <label style={L}>สาเหตุที่แท้จริง</label>
            <textarea value={rootCause} onChange={e => setRootCause(e.target.value)} placeholder="Root cause ที่วิเคราะห์ได้..." rows={3} style={{ ...F, resize: "vertical" }} />
          </div>

          <div style={ROW}>
            <label style={L}>วิธีแก้ไข</label>
            <textarea value={solution} onChange={e => setSolution(e.target.value)} placeholder="ขั้นตอนการแก้ไข..." rows={3} style={{ ...F, resize: "vertical" }} />
          </div>

          <div style={ROW}>
            <label style={L}>Tags</label>
            <input type="text" value={tags} onChange={e => setTags(e.target.value)} placeholder="เช่น module,contactor,spd (คั่นด้วยจุลภาค)" style={F} />
          </div>

          <div style={ROW}>
            <label style={L}>ไฟล์แนบ — รูป / PDF (สูงสุด 5 ไฟล์)</label>
            <input
              type="file" accept="image/*,.pdf" multiple
              onChange={handleFileChange}
              style={{ ...F, padding: "7px 12px", cursor: "pointer" }}
            />
            {fileList.length > 0 && (
              <ul style={{ marginTop: 8, paddingLeft: 18, fontSize: 12, color: "#4a6274" }}>
                {fileList.map((f, i) => (
                  <li key={i} style={{ marginBottom: 3 }}>
                    {f.type.startsWith("image/") ? "🖼 " : "📄 "}{f.name}
                    <span style={{ color: "#2a3a4a", marginLeft: 6 }}>({(f.size / 1024).toFixed(0)} KB)</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            onClick={handleSubmit} disabled={loading}
            style={{ width: "100%", padding: "12px", borderRadius: 6, border: "none", background: loading ? "#1c2a3a" : "linear-gradient(135deg,#00c8ff,#0088cc)", color: loading ? "#4a6274" : "#000", fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "monospace" }}
          >
            {loading ? "⏳ กำลังบันทึก..." : "💾 บันทึกเคส"}
          </button>
        </div>
      </div>
    </div>
  );
}