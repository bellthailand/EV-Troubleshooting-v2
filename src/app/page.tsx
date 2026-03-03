"use client";
import { supabase } from "../lib/supabase";
import { useState, useEffect, useRef, useCallback } from "react";

// ═══════════════════════════════════════════════════════
// CONSTANTS — top level, never recreated
// ═══════════════════════════════════════════════════════
const ERROR_CODES = {
  "01":{ code:"0x0001", name:"RTC fault", cause:"บอร์ดหลักสื่อสารกับ RTC chip ผิดปกติ", fix:["Restart เครื่อง","เปลี่ยน Mainboard"], risk:30 },
  "02":{ code:"0x0004", name:"Card reader fault", cause:"สายหลวม หรือบอร์ดรูดการ์ดเสีย", fix:["ถอดเสียบสายใหม่หลายครั้ง","เปลี่ยนบอร์ดรูดการ์ด"], risk:25 },
  "03":{ code:"0x0008", name:"SPD fault", cause:"อุปกรณ์กันฟ้าผ่าเสีย", fix:["ตรวจสอบไฟแดงที่ SPD","เปลี่ยน SPD"], risk:60 },
  "04":{ code:"0x0010", name:"EPO fault", cause:"ปุ่ม Emergency Stop ค้าง", fix:["หมุนปุ่ม EPO ตามทิศที่กำหนดเพื่อ Reset"], risk:40 },
  "05":{ code:"0x0020", name:"Over voltage Alarm", cause:"แรงดันไฟเกินมาตรฐาน (>437V)", fix:["ตรวจสอบเสถียรภาพไฟในพื้นที่","ตั้งค่า 380V ±15%"], risk:70 },
  "06":{ code:"0x0040", name:"Under voltage Alarm", cause:"แรงดันไฟต่ำกว่ามาตรฐาน (<323V)", fix:["ตรวจสอบแรงดันไฟ","ตั้งค่า 380V ±15%"], risk:65 },
  "07":{ code:"0x0080", name:"Fram fault", cause:"Storage chip สื่อสารผิดปกติ", fix:["Restart เครื่อง","เปลี่ยน Mainboard"], risk:35 },
  "08":{ code:"0x0200", name:"Flash fault", cause:"Storage chip สื่อสารผิดปกติ", fix:["Restart เครื่อง","เปลี่ยน Mainboard"], risk:35 },
  "10":{ code:"0x0400", name:"Lean alarm", cause:"Tilt detection ทำงาน", fix:["ปิด Tilt detection ในการตั้งค่า"], risk:20 },
  "11":{ code:"0x0002", name:"DC meter fault", cause:"Meter address ผิดพลาด หรือสายสื่อสารผิดปกติ", fix:["ตรวจสอบ address","ตรวจสอบสายสื่อสาร"], risk:40 },
  "13":{ code:"0x8000", name:"Over temperature alarm", cause:"Mainboard ร้อนเกินปกติ", fix:["ตัดไฟรอเครื่องเย็น","Restart","ตรวจสอบพัดลม"], risk:75 },
  "14":{ code:"0x4000", name:"Module Comm fault", cause:"Power module สื่อสารผิดปกติ หรือ module เสีย", fix:["ตรวจสอบสายสื่อสาร module","ถอด module ที่เสีย","เปลี่ยน module"], risk:80 },
  "15":{ code:"0x2000", name:"Guard alarm", cause:"ประตูตู้ถูกเปิด", fix:["ตรวจสอบและปิดประตูให้สนิท","ตรวจสอบ door switch"], risk:30 },
};

const RULES = [
  { id:"R001", keywords:["rcd","trip","rcd trip","กระแสรั่ว","leakage"],
    causes:[
      { name:"DC Leakage จากรถยนต์", prob:70, parts:["ไม่ต้องเปลี่ยนอะไหล่"], steps:["วัด Insulation Resistance ระหว่าง DC+ และ PE","ตรวจสอบสายชาร์จ","ลองเปลี่ยนรถทดสอบ"] },
      { name:"EMI Filter เสีย", prob:20, parts:["EMI Filter"], steps:["ตรวจสอบ EMI filter board","วัดค่า leakage ขณะ idle","เปลี่ยน EMI filter"] },
      { name:"N-PE Bonding ผิดปกติ", prob:10, parts:[], steps:["ตรวจสอบ N-PE bonding ที่ MDB","วัดแรงดัน N-PE"] },
    ], hardStop:false },
  { id:"R002", keywords:["กระแสต่ำ","current low","ชาร์จช้า","output ต่ำ","แอมป์ต่ำ"],
    causes:[
      { name:"Power Module เสีย (เคสจริง SN:424090000192)", prob:75, parts:["Power Module"], steps:["เข้าเมนู Communication ดูสถานะแต่ละ module","module ไหนแสดง 0.0V/0.0A = เสีย","ถอด module เสียออก","รันชั่วคราวด้วย module ที่เหลือ","สั่ง module ใหม่เปลี่ยน"] },
      { name:"สายต่อ module หลวม", prob:15, parts:[], steps:["ตรวจสอบสายสื่อสาร CAN bus","ถอดเสียบสายใหม่"] },
      { name:"ตั้งค่ากระแสผิด", prob:10, parts:[], steps:["ตรวจสอบ Current limit setting","ปรับค่าให้ถูกต้อง"] },
    ], hardStop:false },
  { id:"R003", keywords:["mainboard","บอร์ดดับ","เครื่องดับ","ไม่ติด","ไฟแดง","short","ไม่เปิด"],
    causes:[
      { name:"Mainboard Short Circuit (เคสจริง SN:42505000492)", prob:60, parts:["Mainboard","AC Contactor"], steps:["ตรวจสอบ LED บน Mainboard","ดูรอยไหม้หรือกลิ่นไหม้","ตรวจ AC Contactor ด้วยเสมอ","เปลี่ยน Mainboard","เปลี่ยน AC Contactor","ตรวจ SPD ว่ายังทำงานอยู่ไหม"] },
      { name:"ไฟเลี้ยงบอร์ดหาย", prob:25, parts:["Power Supply 24V"], steps:["วัดแรงดัน 24V DC ที่ขั้ว","ตรวจสอบ fuse","เปลี่ยน Power Supply"] },
      { name:"AC Input ไม่มีไฟ", prob:15, parts:[], steps:["ตรวจ Breaker ด้านหน้า","วัดแรงดัน AC Input L1-L2-L3"] },
    ], hardStop:true, hardStopReason:"⚠️ อันตราย — อาจมีแรงดันสูงค้างอยู่ในตัวเก็บประจุ รอ 5 นาทีหลังตัดไฟก่อนแตะ" },
  { id:"R004", keywords:["contactor","คอนแทคเตอร์","ไม่ดูด","คลิก","relay"],
    causes:[
      { name:"AC Contactor เสีย", prob:65, parts:["AC Contactor"], steps:["ฟังเสียง contactor ดูดหรือไม่","วัดแรงดันขา coil","ตรวจสอบรอยไหม้ที่ขา power","เปลี่ยน AC Contactor"] },
      { name:"Mainboard ไม่ส่งสัญญาณ", prob:25, parts:["Mainboard"], steps:["วัดแรงดัน coil signal จาก board","ตรวจสอบ relay output"] },
      { name:"Coil สายหลวม", prob:10, parts:[], steps:["ตรวจสอบสายต่อ coil","ถอดเสียบใหม่"] },
    ], hardStop:true, hardStopReason:"⚠️ อันตราย — ห้ามแตะขา Power ของ Contactor ขณะมีไฟ" },
  { id:"R005", keywords:["spd","ฟ้าผ่า","surge","กันฟ้า","lightning"],
    causes:[
      { name:"SPD เสียจากฟ้าผ่าหรือไฟกระชาก", prob:85, parts:["SPD"], steps:["ตรวจสอบไฟ indicator บน SPD (แดง=เสีย)","เปลี่ยน SPD","ตรวจสอบ Mainboard ด้วย"] },
      { name:"Mainboard เสียพ่วง", prob:15, parts:["Mainboard"], steps:["ตรวจสอบ Mainboard หลังเปลี่ยน SPD"] },
    ], hardStop:false },
  { id:"R006", keywords:["ร้อน","temperature","overtemp","ความร้อน","พัดลม","fan"],
    causes:[
      { name:"พัดลมระบายความร้อนเสีย", prob:55, parts:["Fan / พัดลม"], steps:["ตรวจสอบว่าพัดลมหมุนหรือไม่","วัดแรงดัน fan","เปลี่ยนพัดลม"] },
      { name:"ฝุ่นอุดตัน Heatsink", prob:35, parts:[], steps:["เปิดตู้ตรวจสอบ heatsink","เป่าฝุ่นด้วย air compressor","ทำความสะอาด filter"] },
      { name:"Ambient ร้อนเกินไป", prob:10, parts:[], steps:["วัดอุณหภูมิภายในตู้","ตรวจสอบการระบายอากาศรอบตัวเครื่อง"] },
    ], hardStop:false },
  { id:"R007", keywords:["epo","emergency","หยุดฉุกเฉิน","ปุ่มแดง","กดหยุด"],
    causes:[
      { name:"EPO button ค้าง/ไม่ Reset", prob:90, parts:[], steps:["หมุนปุ่ม EPO ตามเข็มนาฬิกา","กดปุ่ม Reset ถ้ามี","Restart เครื่อง"] },
      { name:"EPO switch เสีย", prob:10, parts:["EPO Switch"], steps:["ตรวจสอบ contact EPO switch","เปลี่ยน EPO switch"] },
    ], hardStop:false },
];

// ═══════════════════════════════════════════════════════
// THEME — static object, never recreated
// ═══════════════════════════════════════════════════════
const C = { bg:"#07090f", bg2:"#0d1117", bg3:"#111823", brd:"#1c2a3a", cyn:"#00c8ff", grn:"#00e87a", red:"#ff3b3b", amb:"#ff8c00", yel:"#ffd700", txt:"#c9d6e3", sub:"#4a6274" };
const FONT = "'JetBrains Mono','Courier New',monospace";
const S = {
  card: { background:C.bg2, border:`1px solid ${C.brd}`, borderRadius:8, padding:16, marginBottom:10 },
  inp:  { background:C.bg3, border:`1px solid ${C.brd}`, borderRadius:6, color:C.txt, fontSize:13, padding:"9px 12px", outline:"none", width:"100%", fontFamily:FONT, boxSizing:"border-box" },
  ta:   { background:C.bg3, border:`1px solid ${C.brd}`, borderRadius:6, color:C.txt, fontSize:13, padding:"9px 12px", outline:"none", width:"100%", fontFamily:FONT, boxSizing:"border-box", minHeight:90, resize:"vertical" },
  btnP: { padding:"11px 20px", borderRadius:6, border:"none", background:`linear-gradient(135deg,${C.cyn},#0088cc)`, color:"#000", fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:FONT },
  btnG: { padding:"11px 20px", borderRadius:6, border:"none", background:`linear-gradient(135deg,${C.grn},#00aa55)`, color:"#000", fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:FONT },
  btnS: { padding:"8px 14px", borderRadius:6, border:`1px solid ${C.brd}`, background:"transparent", color:C.sub, fontSize:11, cursor:"pointer", fontFamily:FONT },
  lbl:  { fontSize:10, color:C.sub, fontWeight:700, letterSpacing:"0.08em", display:"block", marginBottom:5, textTransform:"uppercase" },
};
const tabStyle = (a: any) => ({ flex:1, padding:"9px 0", border:"none", background:"transparent", color:a?C.cyn:C.sub, fontSize:10, fontWeight:a?700:400, cursor:"pointer", fontFamily:FONT, borderBottom:a?`2px solid ${C.cyn}`:`2px solid transparent`, textTransform:"uppercase", letterSpacing:"0.05em" });

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════
function compressImage(
  file: File,
  maxW: number = 800,
  quality: number = 0.7
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event: ProgressEvent<FileReader>) => {
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = maxW / img.width;
        const width = maxW;
        const height = img.height * scale;

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject("Canvas context error");
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };

      if (event.target?.result) {
        img.src = event.target.result as string;
      }
    };

    reader.readAsDataURL(file);
  });
}

const IDX_KEY   = "ev_idx";
const RULES_KEY = "ev_rules";
const caseKey = (id: string) => `ev_case_${id}`;

async function loadIndex() {
  try {
    const r = localStorage.getItem(IDX_KEY);
    return r ? JSON.parse(r) : [];
  } catch {
    return [];
  }
}

async function saveIndex(idx: any) {
  try {
    localStorage.setItem(IDX_KEY, JSON.stringify(idx));
  } catch {}
}

async function loadCase(id: string) {
  try {
    const r = localStorage.getItem(caseKey(id));
    return r ? JSON.parse(r) : null;
  } catch {
    return null;
  }
}

async function saveCase(c: any) {
  try {
    localStorage.setItem(caseKey(c.id), JSON.stringify(c));
  } catch {}
}
   
async function deleteCase(id: string) {
  try {
    localStorage.removeItem(caseKey(id));
  } catch {}
}
function calcRisk(causes: any[], hardStop: boolean) {
  if (hardStop) return 76 + (Math.random()*10|0);
  const base = causes[0]?.parts?.length > 0 ? 55 : 35;
  return Math.min(75, base + (causes[0]?.prob > 70 ? 10 : 0));
}
function riskLevel(score: number) {
  if (score >= 76) return { label:"CRITICAL", color:"#ff3b3b", bg:"#ff3b3b22" };
  if (score >= 56) return { label:"HIGH",     color:"#ff8c00", bg:"#ff8c0022" };
  if (score >= 31) return { label:"MEDIUM",   color:"#ffd700", bg:"#ffd70022" };
  return               { label:"LOW",      color:"#00e87a", bg:"#00e87a22" };
}
function runDiagnose(input: string, customRules: any[]) {
  const text = input.toLowerCase();
  const codeMatch = text.match(/\b(code\s*)?(\d{2})\b/);
  if (codeMatch) {
  const key = codeMatch[2] as keyof typeof ERROR_CODES;

  if (ERROR_CODES[key]) {
    const ec = ERROR_CODES[key];

    return {
      type: "errorcode",
      code: key,
      ec,
      risk: ec.risk,
      rl: riskLevel(ec.risk),
      confidence: 90
    };
  }
 const allRules =[...RULES, ...customRules];
 const matched = allRules
  .map(rule => ({
    rule,
    hits: rule.keywords.filter((k: string) => text.includes(k)).length
  }))
  .filter(m => m.hits > 0)
  .sort((a, b) => b.hits - a.hits); 
  if (!matched.length) return null;
  const best = matched[0].rule;
  const risk = calcRisk(best.causes, best.hardStop);
  return { type:"rule", rule:best, risk, rl:riskLevel(risk), confidence:Math.min(95,60+matched[0].hits*15) };
}

// ═══════════════════════════════════════════════════════
// COMPONENTS — ทั้งหมดอยู่นอก App() เพื่อป้องกัน focus หลุด
// ═══════════════════════════════════════════════════════

function ResultCard({ r }) {
  const rl = r.rl;
  if (r.type === "errorcode") {
    const ec = r.ec;
    return (
      <div style={{...S.card, border:`1px solid ${rl.color}`}}>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12}}>
          <div>
            <div style={{fontSize:10, color:C.sub, textTransform:"uppercase"}}>Error Code Detected</div>
            <div style={{fontSize:15, fontWeight:700, color:C.cyn, marginTop:4}}>Code {r.code} — {ec.name}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{background:rl.bg, border:`1px solid ${rl.color}`, borderRadius:4, padding:"3px 8px", color:rl.color, fontWeight:700, fontSize:11}}>{rl.label}</div>
            <div style={{fontSize:10, color:C.sub, marginTop:3}}>Risk: {r.risk}/100</div>
          </div>
        </div>
        <div style={{background:C.bg3, borderRadius:6, padding:12, marginBottom:10}}>
          <div style={{fontSize:10, color:C.sub, marginBottom:5, textTransform:"uppercase"}}>สาเหตุ</div>
          <div style={{color:C.yel, fontSize:12}}>{ec.cause}</div>
        </div>
        <div style={{background:C.bg3, borderRadius:6, padding:12, marginBottom:10}}>
          <div style={{fontSize:10, color:C.sub, marginBottom:8, textTransform:"uppercase"}}>วิธีแก้ไข</div>
          {ec.fix.map((f,i)=>(
            <div key={i} style={{display:"flex", gap:8, marginBottom:7, alignItems:"flex-start"}}>
              <div style={{width:20, height:20, borderRadius:"50%", background:C.cyn, color:"#000", fontSize:10, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0}}>{i+1}</div>
              <div style={{color:C.txt, fontSize:12}}>{f}</div>
            </div>
          ))}
        </div>
        <div style={{fontSize:10, color:C.sub}}>Confidence: <span style={{color:C.grn, fontWeight:700}}>95%</span> · Code: <span style={{color:C.cyn}}>{ec.code}</span></div>
      </div>
    );
  }
  const rule = r.rule;
  return (
    <div style={{...S.card, border:`1px solid ${rl.color}`}}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12}}>
        <div>
          <div style={{fontSize:10, color:C.sub, textTransform:"uppercase"}}>Diagnosis — {rule.id}</div>
          <div style={{fontSize:14, fontWeight:700, color:C.cyn, marginTop:4}}>{rule.causes[0]?.name}</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{background:rl.bg, border:`1px solid ${rl.color}`, borderRadius:4, padding:"3px 8px", color:rl.color, fontWeight:700, fontSize:11}}>{rl.label}</div>
          <div style={{fontSize:10, color:C.sub, marginTop:3}}>Risk: {r.risk}/100</div>
        </div>
      </div>
      {rule.hardStop && (
        <div style={{background:"#ff3b3b15", border:`1px solid ${C.red}`, borderRadius:6, padding:10, marginBottom:12}}>
          <div style={{color:C.red, fontWeight:700, fontSize:11}}>🚨 SAFETY WARNING</div>
          <div style={{color:"#ff8080", fontSize:11, marginTop:3}}>{rule.hardStopReason}</div>
        </div>
      )}
      <div style={{background:C.bg3, borderRadius:6, padding:12, marginBottom:10}}>
        <div style={{fontSize:10, color:C.sub, marginBottom:8, textTransform:"uppercase"}}>สาเหตุที่เป็นไปได้</div>
        {rule.causes.map((c,i)=>(
          <div key={i} style={{display:"flex", gap:8, alignItems:"center", marginBottom:7}}>
            <div style={{width:38, height:20, borderRadius:3, background:i===0?C.cyn+"33":C.brd, border:`1px solid ${i===0?C.cyn:C.brd}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color:i===0?C.cyn:C.sub, flexShrink:0}}>{c.prob}%</div>
            <div style={{color:i===0?C.txt:C.sub, fontSize:11}}>{c.name}</div>
          </div>
        ))}
      </div>
      <div style={{background:C.bg3, borderRadius:6, padding:12, marginBottom:10}}>
        <div style={{fontSize:10, color:C.sub, marginBottom:8, textTransform:"uppercase"}}>Step by Step</div>
        {rule.causes[0]?.steps.map((s,i)=>(
          <div key={i} style={{display:"flex", gap:8, marginBottom:7, alignItems:"flex-start"}}>
            <div style={{width:20, height:20, borderRadius:"50%", background:C.cyn, color:"#000", fontSize:10, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:1}}>{i+1}</div>
            <div style={{color:C.txt, fontSize:11}}>{s}</div>
          </div>
        ))}
      </div>
      {rule.causes[0]?.parts?.length > 0 && (
        <div style={{display:"flex", gap:6, flexWrap:"wrap", marginBottom:10}}>
          {rule.causes[0].parts.map((p,i)=>(
            <div key={i} style={{background:C.amb+"22", border:`1px solid ${C.amb}`, borderRadius:4, padding:"2px 8px", color:C.amb, fontSize:10}}>{p}</div>
          ))}
        </div>
      )}
      <div style={{fontSize:10, color:C.sub}}>Confidence: <span style={{color:C.grn, fontWeight:700}}>{r.confidence}%</span></div>
    </div>
  );
}

function PhotoUploader({ images, onAdd, onRemove, accentColor }) {
  const col = accentColor || C.cyn;
  return (
    <div>
      <label style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12,padding:"14px",borderRadius:10,border:`2px dashed ${col}55`,background:C.bg3,cursor:"pointer",marginBottom:images.length>0?10:0,WebkitTapHighlightColor:"transparent",boxSizing:"border-box"}}>
        <span style={{fontSize:28}}>📷</span>
        <div>
          <div style={{fontSize:13,fontWeight:700,color:col}}>กดเพื่อเลือกรูป</div>
          <div style={{fontSize:10,color:C.sub,marginTop:2}}>กล้อง / แกลเลอรี · สูงสุด 5 รูป ({images.length}/5)</div>
        </div>
        <input type="file" accept="image/*" multiple style={{display:"none"}} onChange={e=>{ onAdd(e.target.files); e.target.value=""; }}/>
      </label>
      {images.length > 0 && (
        <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6}}>
          {images.map((src,i)=>(
            <div key={i} style={{aspectRatio:"1", borderRadius:6, overflow:"hidden", border:`1px solid ${C.brd}`, position:"relative", background:C.bg}}>
              <img src={src} style={{width:"100%", height:"100%", objectFit:"cover", display:"block"}}/>
              <button onClick={()=>onRemove(i)} style={{position:"absolute",top:2,right:2,background:"rgba(220,38,38,0.9)",border:"none",borderRadius:"50%",width:20,height:20,cursor:"pointer",fontSize:11,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PhotoGrid({ images, cols=3 }) {
  if (!images || images.length === 0) return null;
  return (
    <div style={{display:"grid", gridTemplateColumns:`repeat(${cols},1fr)`, gap:8}}>
      {images.map((src,i)=>(
        <img key={i} src={src} style={{width:"100%", aspectRatio:"1", objectFit:"cover", borderRadius:8, border:`1px solid ${C.brd}`}}/>
      ))}
    </div>
  );
}

// DiagnoseView — รับ props จาก App ไม่มี state ข้างใน
function DiagnoseView({ input, setInput, model, setModel, loc, setLoc, images, onAddImages, onRemoveImage, result, loading, onDiagnose, onSave }) {
  return (
    <div style={{padding:"14px"}}>
      <div style={S.card}>
        <div style={{fontSize:10, color:C.cyn, fontWeight:700, letterSpacing:"0.1em", marginBottom:14, textTransform:"uppercase"}}>▶ วิเคราะห์อาการ</div>
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12}}>
          <div>
            <label style={S.lbl}>รุ่นเครื่อง</label>
            <select value={model} onChange={e=>setModel(e.target.value)} style={{...S.inp, cursor:"pointer"}}>
              {["DC 30kW","DC 60kW","DC 120kW","AC 7kW","AC 22kW"].map(m=><option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={S.lbl}>สถานที่</label>
            <input value={loc} onChange={e=>setLoc(e.target.value)} placeholder="ปตท. รามคำแหง" style={S.inp}/>
          </div>
        </div>
        <div style={{marginBottom:12}}>
          <label style={S.lbl}>อาการ / Error Code *</label>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={"พิมพ์อาการ เช่น:\n- Code 14 กระแสออกต่ำ\n- RCD trip หลังชาร์จ 30 วิ\n- เครื่องดับ ไฟแดง mainboard\n- contactor ไม่ดูด"}
            style={S.ta}
          />
        </div>
        <div style={{marginBottom:12}}>
          <label style={S.lbl}>📷 รูปหน้างาน</label>
          <PhotoUploader images={images} onAdd={onAddImages} onRemove={onRemoveImage} accentColor={C.cyn}/>
        </div>
        <div style={{display:"flex", gap:8}}>
          <button onClick={onDiagnose} disabled={loading||!input.trim()} style={{...S.btnP, flex:1, opacity:(!input.trim()||loading)?0.5:1}}>
            {loading ? "⚙ วิเคราะห์..." : "⚡ วิเคราะห์อาการ"}
          </button>
          {result && <button onClick={onSave} style={{...S.btnG, fontSize:12, padding:"11px 14px"}}>💾 บันทึก</button>}
        </div>
      </div>
      {result === null && !loading && input && (
        <div style={{...S.card, textAlign:"center", padding:30, border:`1px solid ${C.yel}`}}>
          <div style={{fontSize:24, marginBottom:8}}>🔍</div>
          <div style={{color:C.yel, fontSize:12}}>ไม่พบรูปแบบที่ตรงกัน — ลองระบุ Error Code หรืออธิบายอาการให้ละเอียดขึ้น</div>
        </div>
      )}
      {result && !loading && <ResultCard r={result}/>}
    </div>
  );
}

function CasesListView({ index, setViewCase }) {
  return (
    <div style={{padding:"14px"}}>
      <div style={{fontSize:10, color:C.sub, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12}}>
        {index.length} เคส · {index.filter(c=>c.confirmed).length} ยืนยันแล้ว
      </div>
      {index.length === 0 ? (
        <div style={{textAlign:"center", padding:"60px 20px", color:C.sub}}>
          <div style={{fontSize:40, marginBottom:12, opacity:.3}}>📋</div>
          <div>ยังไม่มีเคส — วิเคราะห์แล้วกด บันทึก</div>
        </div>
      ) : index.map(m => (
        <div key={m.id} style={{...S.card, border:`1px solid ${m.confirmed?C.grn:C.brd}`, cursor:"pointer"}}
          onClick={async()=>{ const full=await loadCase(m.id); if(full) setViewCase(full); }}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start"}}>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:10, color:C.sub}}>{m.ts} · {m.model}{m.loc?` · ${m.loc}`:""}</div>
              <div style={{fontWeight:700, color:C.txt, marginTop:4, fontSize:12, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{m.input}</div>
              {m.confirmed && m.actualCause && <div style={{fontSize:10, color:C.grn, marginTop:3}}>✓ {m.actualCause}</div>}
            </div>
            <div style={{display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4, marginLeft:8, flexShrink:0}}>
              <div style={{background:m.rlColor+"22", border:`1px solid ${m.rlColor}`, borderRadius:3, padding:"2px 7px", color:m.rlColor, fontSize:9, fontWeight:700}}>{m.rlLabel}</div>
              {m.confirmed && <div style={{color:C.grn, fontSize:9}}>✓ ยืนยัน</div>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CaseDetailView({ c, onBack, onDelete, onConfirmDone, confirmMode, setConfirmMode, actualCause, setActualCause, repairAction, setRepairAction, partsUsed, setPartsUsed, confirmImages, onAddConfirmImages, onRemoveConfirmImage }) {
  return (
    <div style={{padding:"14px"}}>
      <button onClick={onBack} style={{...S.btnS, marginBottom:12}}>← กลับ</button>
      <div style={S.card}>
        <div style={{fontSize:10, color:C.sub, marginBottom:4}}>{c.ts} · {c.model}{c.loc?` · ${c.loc}`:""}</div>
        <div style={{fontSize:14, fontWeight:700, color:C.cyn, marginBottom:10}}>{c.input}</div>
        {c.result && <ResultCard r={c.result}/>}
      </div>
      {(c.images||[]).length > 0 && (
        <div style={S.card}>
          <div style={{fontSize:10, color:C.sub, textTransform:"uppercase", marginBottom:10}}>รูปหน้างาน ({c.images.length} รูป)</div>
          <PhotoGrid images={c.images}/>
        </div>
      )}
      {c.confirmed ? (
        <div style={{...S.card, border:`1px solid ${C.grn}`}}>
          <div style={{fontSize:10, color:C.grn, fontWeight:700, textTransform:"uppercase", marginBottom:10}}>✓ ยืนยันสาเหตุจริงแล้ว</div>
          {[["สาเหตุจริง",c.actualCause,C.yel],["วิธีแก้",c.repairAction,C.txt],["อะไหล่ที่ใช้",c.partsUsed,C.amb]].map(([lbl,val,color])=>val?(
            <div key={lbl} style={{marginBottom:8}}>
              <div style={{fontSize:10, color:C.sub}}>{lbl}</div>
              <div style={{color, fontSize:12}}>{val}</div>
            </div>
          ):null)}
          {(c.confirmImages||[]).length > 0 && (
            <div style={{marginTop:10}}>
              <div style={{fontSize:10, color:C.sub, marginBottom:8}}>รูปหลักฐานการซ่อม</div>
              <PhotoGrid images={c.confirmImages}/>
            </div>
          )}
          <button onClick={()=>onDelete(c.id)} style={{...S.btnS, color:C.red, borderColor:C.red+"44", fontSize:11, marginTop:12}}>🗑 ลบเคส</button>
        </div>
      ) : confirmMode === c.id ? (
        <div style={S.card}>
          <div style={{fontSize:10, color:C.cyn, fontWeight:700, textTransform:"uppercase", marginBottom:12}}>ยืนยันสาเหตุจริง</div>
          {[["สาเหตุที่แท้จริง *",actualCause,setActualCause,"เช่น Power Module เสีย"],
            ["วิธีแก้ที่ทำ",repairAction,setRepairAction,"เช่น เปลี่ยน module ใหม่"],
            ["อะไหล่ที่ใช้",partsUsed,setPartsUsed,"เช่น Power Module"],
          ].map(([lbl,val,set,ph])=>(
            <div key={lbl} style={{marginBottom:10}}>
              <label style={S.lbl}>{lbl}</label>
              <input value={val} onChange={e=>set(e.target.value)} placeholder={ph} style={S.inp}/>
            </div>
          ))}
          <div style={{marginBottom:12}}>
            <label style={S.lbl}>📷 รูปหลักฐานการซ่อม</label>
            <PhotoUploader images={confirmImages} onAdd={onAddConfirmImages} onRemove={onRemoveConfirmImage} accentColor={C.grn}/>
          </div>
          <div style={{display:"flex", gap:8}}>
            <button onClick={onConfirmDone} disabled={!actualCause.trim()} style={{...S.btnG, flex:1, opacity:!actualCause.trim()?0.5:1, fontSize:12}}>✓ บันทึกยืนยัน</button>
            <button onClick={()=>setConfirmMode(null)} style={{...S.btnS, fontSize:12}}>ยกเลิก</button>
          </div>
        </div>
      ) : (
        <div style={{display:"flex", gap:8}}>
          <button onClick={()=>setConfirmMode(c.id)} style={{...S.btnG, flex:1, fontSize:12}}>✓ ยืนยันสาเหตุจริง + รูปหลักฐาน</button>
          <button onClick={()=>onDelete(c.id)} style={{...S.btnS, color:C.red, borderColor:C.red+"44", fontSize:12}}>🗑</button>
        </div>
      )}
    </div>
  );
}

function DashboardView({ index }) {
  const confirmed = index.filter(c=>c.confirmed);
  const partFreq = {};
  confirmed.forEach(c => {
    if (!c.actualCause) return;
    (c.actualCause+","+(c.partsUsed||"")).split(",").map(p=>p.trim()).filter(Boolean).forEach(p=>{ partFreq[p]=(partFreq[p]||0)+1; });
  });
  const topParts = Object.entries(partFreq).sort((a,b)=>b[1]-a[1]).slice(0,6);
  return (
    <div style={{padding:"14px"}}>
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10}}>
        {[["เคสทั้งหมด",index.length,C.cyn],["ยืนยันแล้ว",confirmed.length,C.grn],
          ["Critical",index.filter(c=>c.rlLabel==="CRITICAL").length,C.red],
          ["Pending",index.filter(c=>!c.confirmed).length,C.yel],
        ].map(([lbl,val,color])=>(
          <div key={lbl} style={{...S.card, marginBottom:0, textAlign:"center", border:`1px solid ${color}33`}}>
            <div style={{fontSize:26, fontWeight:700, color}}>{val}</div>
            <div style={{fontSize:9, color:C.sub, textTransform:"uppercase", letterSpacing:"0.08em", marginTop:3}}>{lbl}</div>
          </div>
        ))}
      </div>
      <div style={S.card}>
        <div style={{fontSize:10, color:C.sub, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12}}>Urgency Distribution</div>
        {[["CRITICAL",C.red],["HIGH",C.amb],["MEDIUM",C.yel],["LOW",C.grn]].map(([lbl,color])=>{
          const count = index.filter(c=>c.rlLabel===lbl).length;
          const pct = index.length ? Math.round(count/index.length*100) : 0;
          return (
            <div key={lbl} style={{marginBottom:10}}>
              <div style={{display:"flex", justifyContent:"space-between", fontSize:10, marginBottom:3}}>
                <span style={{color}}>{lbl}</span><span style={{color:C.sub}}>{count} เคส ({pct}%)</span>
              </div>
              <div style={{background:C.brd, borderRadius:3, height:3}}>
                <div style={{background:color, borderRadius:3, height:3, width:`${pct}%`, transition:"width .5s"}}/>
              </div>
            </div>
          );
        })}
      </div>
      <div style={S.card}>
        <div style={{fontSize:10, color:C.sub, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12}}>อะไหล่ที่ใช้บ่อย</div>
        {topParts.length === 0
          ? <div style={{color:C.sub, fontSize:11, textAlign:"center", padding:"16px 0"}}>ยังไม่มีข้อมูล — ยืนยันเคสก่อน</div>
          : topParts.map(([p,cnt],i)=>(
            <div key={p} style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8, fontSize:11}}>
              <div style={{color:C.txt}}>{i+1}. {p}</div>
              <div style={{background:C.amb+"22", border:`1px solid ${C.amb}33`, borderRadius:3, padding:"2px 7px", color:C.amb, fontSize:10}}>{cnt}×</div>
            </div>
          ))
        }
      </div>
    </div>
  );
}

function AdminView({ customRules, onSaveRules, onToast }) {
  const [kw,setKw]=useState(""); const [cn,setCn]=useState(""); const [st,setSt]=useState("");
  const [pt,setPt]=useState(""); const [hs,setHs]=useState(false); const [hsr,setHsr]=useState("");
  const add = () => {
    if (!kw.trim()||!cn.trim()) return;
    const rule = { id:`C${Date.now()}`, keywords:kw.split(",").map(k=>k.trim().toLowerCase()).filter(Boolean), causes:[{ name:cn, prob:80, parts:pt.split(",").map(p=>p.trim()).filter(Boolean), steps:st.split("\n").filter(Boolean) }], hardStop:hs, hardStopReason:hsr };
    onSaveRules([...customRules, rule]);
    setKw(""); setCn(""); setSt(""); setPt(""); setHs(false); setHsr("");
    onToast("✅ เพิ่มกฎใหม่แล้ว");
  };
  return (
    <div style={{padding:"14px"}}>
      <div style={S.card}>
        <div style={{fontSize:10, color:C.cyn, fontWeight:700, letterSpacing:"0.1em", marginBottom:14, textTransform:"uppercase"}}>+ เพิ่มกฎวินิจฉัยใหม่</div>
        {[["Keywords (คั่น,)",kw,setKw,"เช่น contactor,ไม่ดูด"],["ชื่อสาเหตุหลัก",cn,setCn,"เช่น AC Contactor เสีย"],["อะไหล่ (คั่น,)",pt,setPt,"เช่น AC Contactor"]].map(([lbl,val,set,ph])=>(
          <div key={lbl} style={{marginBottom:10}}>
            <label style={S.lbl}>{lbl}</label>
            <input value={val} onChange={e=>set(e.target.value)} placeholder={ph} style={S.inp}/>
          </div>
        ))}
        <div style={{marginBottom:10}}>
          <label style={S.lbl}>ขั้นตอน (ขึ้นบรรทัดใหม่แต่ละขั้น)</label>
          <textarea value={st} onChange={e=>setSt(e.target.value)} placeholder={"ขั้น 1\nขั้น 2"} style={{...S.inp, minHeight:70, resize:"vertical"}}/>
        </div>
        <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:10}}>
          <input type="checkbox" id="hs" checked={hs} onChange={e=>setHs(e.target.checked)}/>
          <label htmlFor="hs" style={{color:C.red, fontSize:11, cursor:"pointer"}}>🚨 Safety Warning</label>
        </div>
        {hs && <div style={{marginBottom:10}}><label style={S.lbl}>ข้อความเตือน</label><input value={hsr} onChange={e=>setHsr(e.target.value)} placeholder="อันตราย — ตัดไฟก่อนแตะ" style={S.inp}/></div>}
        <button onClick={add} style={{...S.btnP, width:"100%"}}>+ เพิ่มกฎ</button>
      </div>
      {customRules.length > 0 && (
        <div style={S.card}>
          <div style={{fontSize:10, color:C.sub, textTransform:"uppercase", marginBottom:10}}>กฎที่เพิ่มเอง ({customRules.length})</div>
          {customRules.map((r,i)=>(
            <div key={r.id} style={{background:C.bg3, borderRadius:6, padding:10, marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"flex-start"}}>
              <div>
                <div style={{color:C.cyn, fontSize:11, fontWeight:700}}>{r.id}</div>
                <div style={{color:C.txt, fontSize:11, marginTop:3}}>{r.causes[0]?.name}</div>
                <div style={{color:C.sub, fontSize:10, marginTop:2}}>keywords: {r.keywords.join(", ")}</div>
              </div>
              <button onClick={()=>onSaveRules(customRules.filter((_,j)=>j!==i))} style={{...S.btnS, color:C.red, borderColor:C.red+"44", fontSize:10, padding:"4px 8px"}}>ลบ</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// App() — STATE + HANDLERS ONLY
// ทุก component อยู่ข้างบนแล้ว จึงไม่มีการ recreate identity
// ═══════════════════════════════════════════════════════
export default function App() {
  const [tab,           setTab]           = useState("diagnose");
  const [input,         setInput]         = useState("");
  const [model,         setModel]         = useState("DC 30kW");
  const [loc,           setLoc]           = useState("");
  const [images,        setImages]        = useState([]);
  const [result,        setResult]        = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [index,         setIndex]         = useState([]);
  const [customRules,   setCustomRules]   = useState([]);
  const [toast,         setToast]         = useState("");
  const [viewCase,      setViewCase]      = useState(null);
  const [confirmMode,   setConfirmMode]   = useState(null);
  const [actualCause,   setActualCause]   = useState("");
  const [repairAction,  setRepairAction]  = useState("");
  const [partsUsed,     setPartsUsed]     = useState("");
  const [confirmImages, setConfirmImages] = useState([]);
  const toastRef = useRef(null);

  useEffect(() => {
    (async () => {
      const idx = await loadIndex();
      setIndex(idx);
      try { const r = await window.storage.get(RULES_KEY); if(r) setCustomRules(JSON.parse(r.value)); } catch {}
    })();
  }, []);

  const toast$ = useCallback(msg => {
    setToast(msg);
    clearTimeout(toastRef.current);
    toastRef.current = setTimeout(()=>setToast(""), 3000);
  }, []);

  const handleAddImages = useCallback(async files => {
    const arr = Array.from(files).filter(f=>f.type.startsWith("image/")).slice(0,5);
    toast$("⏳ compress รูป...");
    const compressed = await Promise.all(arr.map(f=>compressImage(f)));
    setImages(prev=>[...prev,...compressed].slice(0,5));
    toast$(`✅ เพิ่ม ${arr.length} รูปแล้ว`);
  }, [toast$]);

  const handleRemoveImage = useCallback(i => setImages(prev=>prev.filter((_,j)=>j!==i)), []);

  const handleAddConfirmImages = useCallback(async files => {
    const arr = Array.from(files).filter(f=>f.type.startsWith("image/")).slice(0,5);
    toast$("⏳ compress รูป...");
    const compressed = await Promise.all(arr.map(f=>compressImage(f)));
    setConfirmImages(prev=>[...prev,...compressed].slice(0,5));
    toast$(`✅ เพิ่ม ${arr.length} รูปแล้ว`);
  }, [toast$]);

  const handleRemoveConfirmImage = useCallback(i => setConfirmImages(prev=>prev.filter((_,j)=>j!==i)), []);

  const handleDiagnose = useCallback(() => {
    if (!input.trim()) return;
    setLoading(true);
    setTimeout(() => { setResult(runDiagnose(input, customRules)); setLoading(false); }, 600);
  }, [input, customRules]);

  const handleSave = useCallback(async () => {
    if (!result) return;
    const id = Date.now();
    const meta = { id, ts:new Date().toLocaleString("th-TH"), model, loc, input:input.slice(0,120), risk:result.risk, rlLabel:result.rl.label, rlColor:result.rl.color, confirmed:false };
    const full = { ...meta, input, result, images, confirmImages:[], actualCause:"", repairAction:"", partsUsed:"" };
    await saveCase(full);
    const newIdx = [meta, ...index];
    setIndex(newIdx);
    await saveIndex(newIdx);
    setImages([]); setInput(""); setResult(null); setLoc(""); setModel("DC 30kW");
    toast$(`✅ บันทึกเคสแล้ว (${newIdx.length} เคส)`);
    setTab("cases");
  }, [result, model, loc, input, images, index, toast$]);

  const handleConfirmDone = useCallback(async () => {
    if (!viewCase) return;
    const full = await loadCase(viewCase.id);
    if (!full) return;
    const updated = { ...full, confirmed:true, actualCause, repairAction, partsUsed, confirmImages };
    await saveCase(updated);
    const newIdx = index.map(m=>m.id===viewCase.id?{...m,confirmed:true,actualCause}:m);
    setIndex(newIdx); await saveIndex(newIdx);
    setConfirmMode(null); setActualCause(""); setRepairAction(""); setPartsUsed(""); setConfirmImages([]);
    setViewCase(updated);
    toast$("✅ ยืนยันเคสแล้ว");
  }, [viewCase, actualCause, repairAction, partsUsed, confirmImages, index, toast$]);

  const handleDelete = useCallback(async id => {
    if (!confirm("ลบเคสนี้?")) return;
    await deleteCase(id);
    const newIdx = index.filter(m=>m.id!==id);
    setIndex(newIdx); await saveIndex(newIdx);
    if (viewCase?.id===id) setViewCase(null);
    toast$("🗑 ลบแล้ว");
  }, [index, viewCase, toast$]);

  const handleSaveRules = useCallback(async data => {
    setCustomRules(data);
    try { await window.storage.set(RULES_KEY, JSON.stringify(data)); } catch {}
  }, []);

  const TABS = [["diagnose","⚡","วิเคราะห์"],["cases","📋",`เคส${index.length>0?` (${index.length})`:""}`],["dashboard","📊","สถิติ"],["admin","⚙","กฎ"]];

  return (
    <div style={{background:C.bg, minHeight:"100vh", color:C.txt, fontFamily:FONT, fontSize:13}}>
      <div style={{background:"#070d14", borderBottom:`1px solid ${C.brd}`, padding:"10px 14px", position:"sticky", top:0, zIndex:100}}>
        <div style={{fontSize:9, color:C.sub, letterSpacing:"0.15em", textTransform:"uppercase"}}>EV CHARGER</div>
        <div style={{fontSize:14, fontWeight:700, color:C.cyn, letterSpacing:"0.04em"}}>TROUBLESHOOTING & INTELLIGENCE SYSTEM</div>
        <div style={{fontSize:9, color:C.sub, marginTop:1}}>DC 30kW · Rule-Based Engine · รองรับ 500+ เคส</div>
      </div>
      <div style={{background:"#070d14", borderBottom:`1px solid ${C.brd}`, display:"flex", position:"sticky", top:52, zIndex:99}}>
        {TABS.map(([id,icon,label])=>(
          <button key={id} onClick={()=>{ setViewCase(null); setTab(id); }} style={tabStyle(tab===id)}>
            <div style={{fontSize:16}}>{icon}</div><div style={{marginTop:1}}>{label}</div>
          </button>
        ))}
      </div>

      {tab==="diagnose" && (
        <DiagnoseView
          input={input} setInput={setInput}
          model={model} setModel={setModel}
          loc={loc} setLoc={setLoc}
          images={images} onAddImages={handleAddImages} onRemoveImage={handleRemoveImage}
          result={result} loading={loading}
          onDiagnose={handleDiagnose} onSave={handleSave}
        />
      )}
      {tab==="cases" && !viewCase && (
        <CasesListView index={index} setViewCase={setViewCase}/>
      )}
      {tab==="cases" && viewCase && (
        <CaseDetailView
          c={viewCase} onBack={()=>setViewCase(null)} onDelete={handleDelete}
          onConfirmDone={handleConfirmDone}
          confirmMode={confirmMode} setConfirmMode={setConfirmMode}
          actualCause={actualCause} setActualCause={setActualCause}
          repairAction={repairAction} setRepairAction={setRepairAction}
          partsUsed={partsUsed} setPartsUsed={setPartsUsed}
          confirmImages={confirmImages} onAddConfirmImages={handleAddConfirmImages} onRemoveConfirmImage={handleRemoveConfirmImage}
        />
      )}
      {tab==="dashboard" && <DashboardView index={index}/>}
      {tab==="admin" && <AdminView customRules={customRules} onSaveRules={handleSaveRules} onToast={toast$}/>}

      {toast && (
        <div style={{position:"fixed", bottom:16, left:"50%", transform:"translateX(-50%)", background:C.bg2, border:`1px solid ${C.grn}`, borderRadius:30, padding:"9px 20px", fontSize:11, fontWeight:600, color:C.grn, boxShadow:`0 4px 20px ${C.grn}33`, zIndex:9999, whiteSpace:"nowrap", maxWidth:"90vw", textAlign:"center", fontFamily:FONT}}>
          {toast}
        </div>
      )}
    </div>
  );
}