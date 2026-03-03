"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function Page() {
  const [date, setDate] = useState("");
  const [station, setStation] = useState("");
  const [issue, setIssue] = useState("");
  const [solution, setSolution] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // อัปโหลดรูปไป Storage
  const handleImages = async (files: FileList | null) => {
    if (!files) return;

    const uploadedUrls: string[] = [];

    for (const file of Array.from(files).slice(0, 5)) {
      const fileName = `${Date.now()}-${file.name}`;

      const { error } = await supabase.storage
        .from("case-images")
        .upload(fileName, file);

      if (error) {
        alert("Upload error: " + error.message);
        return;
      }

      const { data } = supabase.storage
        .from("case-images")
        .getPublicUrl(fileName);

      uploadedUrls.push(data.publicUrl);
    }

    setImages(prev => [...prev, ...uploadedUrls].slice(0, 5));
  };

  // บันทึกข้อมูลลง database
  const handleSubmit = async () => {
    if (!date || !station || !issue || !solution) {
      alert("กรุณากรอกข้อมูลให้ครบทุกช่อง");
      return;
    }

    setLoading(true);

    const { error } = await supabase
      .from("cases")
      .insert([{ date, station, issue, solution, images }]);

    setLoading(false);

    if (error) {
      alert("Error: " + error.message);
    } else {
      alert("Saved");
      setDate("");
      setStation("");
      setIssue("");
      setSolution("");
      setImages([]);
    }
  };

  const inputStyle = {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 6,
    border: "1px solid #ccc",
    fontSize: 14,
    boxSizing: "border-box" as const
  };

  const labelStyle = {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 6
  };

  return (
    <div style={{ maxWidth: 600, margin: "40px auto", padding: "0 16px", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>
        บันทึกเคสใหม่
      </h1>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>วันที่</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>สถานีชาร์จ</label>
        <input type="text" value={station} onChange={e => setStation(e.target.value)} style={inputStyle} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>อาการที่พบ</label>
        <textarea value={issue} onChange={e => setIssue(e.target.value)} rows={4} style={{ ...inputStyle, resize: "vertical" }} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>วิธีแก้ไข</label>
        <textarea value={solution} onChange={e => setSolution(e.target.value)} rows={4} style={{ ...inputStyle, resize: "vertical" }} />
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>รูปภาพหน้างาน (สูงสุด 5 รูป)</label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={e => handleImages(e.target.files)}
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading}
        style={{
          width: "100%",
          padding: "12px",
          borderRadius: 6,
          border: "none",
          background: loading ? "#999" : "#0070f3",
          color: "#fff",
          fontSize: 15,
          fontWeight: 700
        }}
      >
        {loading ? "กำลังบันทึก..." : "บันทึกเคส"}
      </button>
    </div>
  );
}