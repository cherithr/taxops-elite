import { auth } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import AuthScreen from "./Auth";
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { db, COLS, subscribe, createDoc, updateDocById, deleteDocById, seedCollection } from "./db";
import { collection, query, where, getDocs, writeBatch } from "firebase/firestore";
import CopilotView from "./copilotview";

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────
const T = {
  bg0:"#080A0F", bg1:"#0D1117", bg2:"#161B26", bg3:"#1E2638", bg4:"#252D3D",
  border:"rgba(99,120,170,0.15)", borderHover:"rgba(99,120,170,0.35)",
  blue:"#3B82F6", blueDim:"#1D4ED8", blueGlow:"rgba(59,130,246,0.18)",
  emerald:"#10B981", emeraldGlow:"rgba(16,185,129,0.15)",
  amber:"#F59E0B", amberGlow:"rgba(245,158,11,0.15)",
  crimson:"#EF4444", crimsonGlow:"rgba(239,68,68,0.15)",
  violet:"#8B5CF6", violetGlow:"rgba(139,92,246,0.15)",
  cyan:"#06B6D4",
  text0:"#F8FAFC", text1:"#CBD5E1", text2:"#94A3B8", text3:"#64748B",
  glass:"rgba(255,255,255,0.03)", glassBorder:"rgba(255,255,255,0.07)",
};

// ─── SEED DATA ───────────────────────────────────────────────────────────────
const SEED_PROJECTS = [
  { client:"Meridian Energy Corp", engagement:"SUT Reverse Audit FY2023", type:"Reverse Audit", tax:"Sales & Use Tax", states:["TX","LA","OK","NM"], exposure:2840000, refund:1120000, risk:"High", priority:"Critical", status:"In Progress", health:72, leadStaff:"Sarah Chen", assignedTeam:["Sarah Chen","Alex Torres"], due:"2026-12-15", tasks:24, open:9, billingType:"Fixed Fee", period:"2020-2023" },
  { client:"StellarNet Logistics", engagement:"Multi-State Nexus Study", type:"Nexus Study", tax:"Sales & Use Tax", states:["CA","WA","OR","NV","AZ"], exposure:4200000, refund:0, risk:"Critical", priority:"Critical", status:"Review Phase", health:88, leadStaff:"James Park", assignedTeam:["James Park","Priya Nair"], due:"2026-09-28", tasks:18, open:3, billingType:"Hourly", period:"2021-2024" },
  { client:"Ozark Resources LLC", engagement:"Severance Tax Refund 2019-2022", type:"Refund Review", tax:"Severance Tax", states:["AR","OK","TX"], exposure:890000, refund:670000, risk:"Medium", priority:"High", status:"Waiting for Client", health:45, leadStaff:"Laura Kim", assignedTeam:["Laura Kim","Marcus Lee"], due:"2026-10-10", tasks:15, open:11, billingType:"Contingency", period:"2019-2022" },
  { client:"BlueRidge Manufacturing", engagement:"TX Audit Defense 2021", type:"Audit Defense", tax:"Sales & Use Tax", states:["TX"], exposure:3100000, refund:0, risk:"Critical", priority:"Critical", status:"Escalated", health:31, leadStaff:"Sarah Chen", assignedTeam:["Sarah Chen","Alex Torres","Marcus Lee"], due:"2026-06-10", tasks:32, open:18, billingType:"Fixed Fee", period:"2021" },
  { client:"Pinnacle Retail Group", engagement:"Taxability Research — SaaS", type:"Taxability Research", tax:"Sales & Use Tax", states:["NY","NJ","CT","MA","PA"], exposure:560000, refund:0, risk:"Low", priority:"Medium", status:"Planning", health:95, leadStaff:"James Park", assignedTeam:["James Park","Priya Nair"], due:"2026-11-20", tasks:12, open:10, billingType:"Hourly", period:"2023-2024" },
  { client:"Cascade Oil & Gas", engagement:"Severance Audit Defense WY", type:"Audit Defense", tax:"Severance Tax", states:["WY","ND"], exposure:7800000, refund:0, risk:"Critical", priority:"Critical", status:"In Progress", health:58, leadStaff:"Laura Kim", assignedTeam:["Laura Kim","Alex Torres"], due:"2026-07-01", tasks:40, open:14, billingType:"Fixed Fee", period:"2018-2022" },
];
const SEED_TASKS = [
  { title:"Prepare TX Audit IDR Response — Batch 3", project:"BlueRidge Manufacturing", priority:"Critical", status:"In Progress", due:"2026-06-08", assignee:"Alex Torres", hours:8, estimate:12 },
  { title:"Review Nexus Footprint — CA Economic Nexus", project:"StellarNet Logistics", priority:"High", status:"Review Phase", due:"2026-06-12", assignee:"Priya Nair", hours:5, estimate:6 },
  { title:"Compile Refund Schedules — AR Severance 2019", project:"Ozark Resources LLC", priority:"High", status:"Waiting for Client", due:"2026-06-20", assignee:"Marcus Lee", hours:3, estimate:10 },
  { title:"SaaS Taxability Matrix — 5-State Analysis", project:"Pinnacle Retail Group", priority:"Medium", status:"Planning", due:"2026-07-05", assignee:"Priya Nair", hours:0, estimate:16 },
  { title:"WY Audit — Computational Errors Expert Review", project:"Cascade Oil & Gas", priority:"Critical", status:"In Progress", due:"2026-06-15", assignee:"Alex Torres", hours:14, estimate:20 },
  { title:"Meridian — Overpayment Schedule Finalization", project:"Meridian Energy Corp", priority:"High", status:"In Progress", due:"2026-06-25", assignee:"Marcus Lee", hours:6, estimate:8 },
];
const SEED_TEAM = [
  { name:"Sarah Chen", role:"Manager", avatar:"SC", color:T.blue, projects:3, utilization:92, expertise:["TX","LA","OK"], status:"active" },
  { name:"James Park", role:"Senior Manager", avatar:"JP", color:T.violet, projects:2, utilization:78, expertise:["CA","WA","NY"], status:"active" },
  { name:"Laura Kim", role:"Manager", avatar:"LK", color:T.emerald, projects:2, utilization:88, expertise:["AR","WY","ND"], status:"active" },
  { name:"Alex Torres", role:"Senior", avatar:"AT", color:T.cyan, projects:4, utilization:97, expertise:["TX","NY","CA"], status:"at-risk" },
  { name:"Priya Nair", role:"Senior", avatar:"PN", color:T.amber, projects:2, utilization:65, expertise:["CA","NY","NJ"], status:"active" },
  { name:"Marcus Lee", role:"Staff", avatar:"ML", color:"#E879F9", projects:3, utilization:82, expertise:["TX","AR","OK"], status:"active" },
];


// ─── STATIC CONFIG ────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id:"dashboard", icon:"⬡", label:"Command Center" },
  { id:"projects", icon:"◈", label:"Projects" },
  { id:"tasks", icon:"◻", label:"Task Board" },
  { id:"states", icon:"◉", label:"State Tracker" },
  { id:"audits", icon:"⚑", label:"Audit Management" },
  { id:"refunds", icon:"◆", label:"Refund Tracker" },
  { id:"team", icon:"◈", label:"Team & Workload" },
  { id:"research", icon:"⊕", label:"Research Hub" },
  { id:"reports", icon:"▤", label:"Reports" },
  { id:"copilot", icon:"✦", label:"Tax Copilot AI" },
];
const PROJECT_TYPES = [
  "Reverse Audit","Nexus Study","Refund Review","Audit Defense",
  "Taxability Research","Compliance Review","VDA / Voluntary Disclosure",
  "Tax Planning","Due Diligence","Other",
];
const TAX_TYPES = [
  "Sales & Use Tax","Severance Tax","Excise Tax","Property Tax",
  "Payroll Tax","Corporate Income Tax","Franchise Tax",
  "Gross Receipts Tax","Cannabis Tax","Other",
];
const PROJECT_STATUSES = [
  "Planning","In Progress","Review Phase","Waiting for Client",
  "Escalated","On Hold","Filed","Responded","Closed",
];
const TEAM_POSITIONS = [
  "Partner","Senior Manager","Manager","Senior","Staff","Intern","Contractor",
];
const TEAM_COLORS = [
  "#3B82F6","#8B5CF6","#10B981","#06B6D4","#F59E0B","#EF4444","#E879F9","#F97316",
];
const TASK_COLS = ["Planning","In Progress","Review Phase","Waiting for Client","Filed"];
const RISK_COLORS = { Critical:T.crimson, High:T.amber, Medium:T.blue, Low:T.emerald };
const STATUS_COLS = {
  "Planning":T.cyan, "In Progress":T.blue, "Review Phase":T.violet,
  "Waiting for Client":T.amber, "Escalated":T.crimson, "On Hold":T.text3,
  "Filed":T.emerald, "Responded":T.emerald, "Closed":T.text3,
};
const RESEARCH_TYPE_COLOR = {
  "Official Ruling":T.emerald, "Internal Memo":T.blue,
  "Research Note":T.violet, "Taxability Matrix":T.amber, "State Guidance":T.cyan,
};
const RESEARCH_ARTICLES = [
  { title:"TX Comptroller — Manufacturing Exemption Guidance 2023", state:"TX", type:"Official Ruling", date:"2023-11", tags:["Manufacturing","Exemption","SUT"] },
  { title:"Wayfair Economic Nexus Thresholds — All 50 States", state:"Multi", type:"Internal Memo", date:"2024-01", tags:["Nexus","Economic","Multi-State"] },
  { title:"WY Severance Tax — Oil & Gas Valuation Methods", state:"WY", type:"Research Note", date:"2023-09", tags:["Severance","O&G","Valuation"] },
  { title:"SaaS Taxability Matrix — NY, NJ, CT, PA, MA", state:"Multi", type:"Taxability Matrix", date:"2024-01", tags:["SaaS","Digital","Taxability"] },
  { title:"AR Severance Tax Refund Procedures — Rev Ruling 2022-04", state:"AR", type:"Official Ruling", date:"2022-04", tags:["Severance","Refund","AR"] },
  { title:"CA Economic Nexus — Remote Seller Guidance Update", state:"CA", type:"State Guidance", date:"2023-11", tags:["Nexus","CA","Remote Seller"] },
];
const REPORT_LIST = [
  { title:"State Exposure Summary", desc:"Total exposure by state across all engagements", icon:"◉", color:T.crimson },
  { title:"Team Utilization Report", desc:"Billable hours, capacity, workload by role", icon:"◈", color:T.blue },
  { title:"Refund Recovery Dashboard", desc:"Pipeline, filed, recovered, and recovery rates", icon:"◆", color:T.emerald },
  { title:"Audit Resolution Metrics", desc:"Open audits, response times, resolution rates", icon:"⚑", color:T.amber },
  { title:"Project Profitability", desc:"Revenue, write-offs, realization by engagement", icon:"⬡", color:T.violet },
  { title:"SLA Compliance Report", desc:"Deadline adherence and turnaround analysis", icon:"⏱", color:T.cyan },
];

const QUICK_PROMPTS = [
  "Analyze my nexus risk exposure","What's my most critical audit?",
  "Show refund opportunities","Portfolio risk summary",
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const fmt$ = n => n>=1000000?`$${(n/1000000).toFixed(1)}M`:n>=1000?`$${(n/1000).toFixed(0)}K`:`$${n}`;
const riskColor = r => RISK_COLORS[r] || T.text2;
const priorityColor = p => RISK_COLORS[p] || T.text2;
const statusColor = s => STATUS_COLS[s] || T.text2;

const daysLeft = due => {
  if (!due) return null;
  const t = new Date(due + "T00:00:00");
  const now = new Date();
  const d1 = Date.UTC(t.getFullYear(), t.getMonth(), t.getDate());
  const d2 = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.ceil((d1 - d2) / 86400000);
};

const daysLabel = due => {
  const d = daysLeft(due);
  if (d === null) return "—";
  if (d < 0) return `${Math.abs(d)}d overdue`;
  if (d === 0) return "Due today";
  return `${d}d left`;
};

const daysColor = due => {
  const d = daysLeft(due);
  if (d === null) return T.text3;
  if (d < 0 || d < 10) return T.crimson;
  if (d < 30) return T.amber;
  return T.emerald;
};

const inputStyle = (extra={}) => ({
  padding:"8px 12px", width:"100%", borderRadius:8,
  background:T.bg3, border:`1px solid ${T.border}`, color:T.text0,
  fontSize:13, outline:"none", fontFamily:"inherit", ...extra,
});

// ─── SEARCHABLE DROPDOWN ─────────────────────────────────────────────────────
const SearchableSelect = ({ options, value, onChange, placeholder = "Search…", renderOption, getLabel }) => {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const ref = React.useRef(null);

  React.useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const getL = opt => getLabel ? getLabel(opt) : (typeof opt === "string" ? opt : opt.name || "");
  const filtered = options.filter(o => getL(o).toLowerCase().includes(query.toLowerCase()));
  const selected = options.find(o => getL(o) === value);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button"
        onClick={() => { setOpen(o => !o); setQuery(""); }}
        style={{
          width: "100%", padding: "8px 12px", borderRadius: 8, cursor: "pointer",
          background: T.bg3, border: `1px solid ${open ? T.blue : T.border}`,
          color: value ? T.text0 : T.text3, fontSize: 13, fontFamily: "inherit",
          textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between",
          boxShadow: open ? `0 0 0 3px ${T.blueGlow}` : "none", transition: "all 0.15s",
        }}>
        <span>{selected ? (renderOption ? renderOption(selected, true) : getL(selected)) : placeholder}</span>
        <span style={{ color: T.text3, fontSize: 10 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 9999,
          background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 10,
          boxShadow: "0 16px 48px rgba(0,0,0,0.6)", overflow: "hidden",
        }}>
          <div style={{ padding: "8px 8px 4px" }}>
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Type to filter…"
              style={{
                width: "100%", padding: "6px 10px", borderRadius: 6, fontSize: 12,
                background: T.bg3, border: `1px solid ${T.border}`, color: T.text0,
                outline: "none", fontFamily: "inherit",
              }} />
          </div>
          <div style={{ maxHeight: 200, overflowY: "auto" }}>
            {filtered.length === 0 && (
              <div style={{ padding: "10px 12px", fontSize: 12, color: T.text3 }}>No results</div>
            )}
            {filtered.map((opt, i) => {
              const label = getL(opt);
              const isSelected = label === value;
              return (
                <button key={i} type="button"
                  onClick={() => { onChange(label); setOpen(false); setQuery(""); }}
                  style={{
                    display: "block", width: "100%", padding: "8px 12px",
                    background: isSelected ? `${T.blue}22` : "transparent",
                    color: isSelected ? T.blue : T.text1, fontSize: 12,
                    fontFamily: "inherit", border: "none", cursor: "pointer",
                    textAlign: "left", transition: "background 0.1s",
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = T.bg3; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}>
                  {renderOption ? renderOption(opt, false) : label}
                  {isSelected && <span style={{ float: "right", color: T.blue }}>✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── SEARCHABLE MULTI-SELECT ─────────────────────────────────────────────────
const SearchableMultiSelect = ({ options, value = [], onChange, placeholder = "Search…", getLabel, renderOption }) => {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const ref = React.useRef(null);

  React.useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const getL = opt => getLabel ? getLabel(opt) : (typeof opt === "string" ? opt : opt.name || "");
  const filtered = options.filter(o => getL(o).toLowerCase().includes(query.toLowerCase()));
  const toggle = label => {
    const next = value.includes(label) ? value.filter(v => v !== label) : [...value, label];
    onChange(next);
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button"
        onClick={() => { setOpen(o => !o); setQuery(""); }}
        style={{
          width: "100%", padding: "8px 12px", borderRadius: 8, cursor: "pointer",
          background: T.bg3, border: `1px solid ${open ? T.blue : T.border}`,
          color: value.length ? T.text0 : T.text3, fontSize: 13, fontFamily: "inherit",
          textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between",
          boxShadow: open ? `0 0 0 3px ${T.blueGlow}` : "none", transition: "all 0.15s", minHeight: 38,
        }}>
        <span style={{ flex: 1, overflow: "hidden" }}>
          {value.length === 0
            ? placeholder
            : (
              <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {value.map(v => (
                  <span key={v} style={{
                    background: `${T.blue}22`, color: T.blue, border: `1px solid ${T.blue}44`,
                    borderRadius: 5, padding: "1px 7px", fontSize: 11, fontWeight: 600,
                    display: "inline-flex", alignItems: "center", gap: 4,
                  }}>
                    {v}
                    <span
                      onMouseDown={e => { e.stopPropagation(); toggle(v); }}
                      style={{ cursor: "pointer", opacity: 0.7, fontSize: 10, lineHeight: 1 }}>✕</span>
                  </span>
                ))}
              </span>
            )
          }
        </span>
        <span style={{ color: T.text3, fontSize: 10, flexShrink: 0, marginLeft: 6 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 9999,
          background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 10,
          boxShadow: "0 16px 48px rgba(0,0,0,0.6)", overflow: "hidden",
        }}>
          <div style={{ padding: "8px 8px 4px", borderBottom: `1px solid ${T.border}` }}>
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Type to filter…"
              style={{
                width: "100%", padding: "6px 10px", borderRadius: 6, fontSize: 12,
                background: T.bg3, border: `1px solid ${T.border}`, color: T.text0,
                outline: "none", fontFamily: "inherit",
              }} />
          </div>
          {value.length > 0 && (
            <div style={{ padding: "6px 12px", fontSize: 11, color: T.blue, borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between" }}>
              <span>{value.length} selected</span>
              <button type="button" onClick={() => onChange([])} style={{ background: "none", border: "none", color: T.text3, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>Clear all</button>
            </div>
          )}
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            {filtered.length === 0 && (
              <div style={{ padding: "12px 14px", fontSize: 12, color: T.text3 }}>No results</div>
            )}
            {filtered.map((opt, i) => {
              const label = getL(opt);
              const selected = value.includes(label);
              return (
                <button key={i} type="button"
                  onClick={() => toggle(label)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    width: "100%", padding: "9px 12px",
                    background: selected ? `${T.blue}18` : "transparent",
                    color: selected ? T.blue : T.text1, fontSize: 12,
                    fontFamily: "inherit", border: "none", cursor: "pointer", textAlign: "left",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={e => { if (!selected) e.currentTarget.style.background = T.bg3; }}
                  onMouseLeave={e => { if (!selected) e.currentTarget.style.background = "transparent"; }}>
                  <span style={{
                    width: 16, height: 16, borderRadius: 4, flexShrink: 0, display: "inline-flex",
                    alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700,
                    background: selected ? T.blue : "transparent",
                    border: `2px solid ${selected ? T.blue : T.border}`,
                    color: "#fff", transition: "all 0.1s",
                  }}>{selected ? "✓" : ""}</span>
                  {renderOption ? renderOption(opt, false) : label}
                </button>
              );
            })}
          </div>
          <div style={{ padding: "8px 12px", borderTop: `1px solid ${T.border}`, textAlign: "right" }}>
            <button type="button" onClick={() => setOpen(false)} style={{ background: T.blue, color: "#fff", border: "none", borderRadius: 7, padding: "6px 18px", fontSize: 12, fontFamily: "inherit", cursor: "pointer", fontWeight: 600 }}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── GLOBAL STYLES ────────────────────────────────────────────────────────────
const GlobalStyles = () => (
  <style>{`
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    html,body{height:100%;background:${T.bg0};color:${T.text0};
      font-family:-apple-system,'SF Pro Display','Inter',system-ui,sans-serif;overflow:hidden}
    ::-webkit-scrollbar{width:4px;height:4px}
    ::-webkit-scrollbar-track{background:transparent}
    ::-webkit-scrollbar-thumb{background:${T.bg4};border-radius:4px}
    ::-webkit-scrollbar-thumb:hover{background:${T.text3}}
    *{scrollbar-width:thin;scrollbar-color:${T.bg4} transparent}
    .fadeUp{animation:fadeUp 0.38s ease forwards}
    .hover-lift{transition:transform 0.2s ease,box-shadow 0.2s ease}
    .hover-lift:hover{transform:translateY(-2px);box-shadow:0 12px 40px rgba(0,0,0,0.45)}
    .btn-primary{background:linear-gradient(135deg,${T.blue},${T.blueDim});color:#fff;border:none;
      cursor:pointer;font-weight:600;letter-spacing:0.01em;transition:all 0.2s;font-family:inherit}
    .btn-primary:hover{filter:brightness(1.15);transform:translateY(-1px);box-shadow:0 8px 24px ${T.blueGlow}}
    .btn-ghost{background:transparent;color:${T.text1};border:1px solid ${T.border};
      cursor:pointer;transition:all 0.2s;font-family:inherit}
    .btn-ghost:hover{border-color:${T.borderHover};background:${T.glass};color:${T.text0}}
    .card{background:${T.bg2};border:1px solid ${T.border};border-radius:14px;transition:border-color 0.2s}
    .card:hover{border-color:${T.borderHover}}
    .glass-card{background:rgba(22,27,38,0.72);backdrop-filter:blur(20px);border:1px solid ${T.glassBorder}}
    .progress-bar{height:4px;border-radius:99px;background:${T.bg4};overflow:hidden}
    .progress-fill{height:100%;border-radius:99px;transition:width 0.6s ease}
    .tag{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;
      border-radius:6px;font-size:11px;font-weight:600;letter-spacing:0.04em}
    .nav-item{display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:10px;
      cursor:pointer;transition:all 0.15s;color:${T.text2};font-size:13px;font-weight:500;
      border:none;background:transparent;width:100%;text-align:left}
    .nav-item:hover{background:${T.bg3};color:${T.text0}}
    .nav-item.active{background:linear-gradient(135deg,rgba(59,130,246,0.18),rgba(59,130,246,0.06));
      color:${T.blue};border-left:2px solid ${T.blue}}
    .metric-card{background:${T.bg2};border:1px solid ${T.border};border-radius:16px;
      padding:20px;position:relative;overflow:hidden}
    input,textarea,select{background:${T.bg3};border:1px solid ${T.border};color:${T.text0};
      border-radius:8px;font-size:13px;outline:none;font-family:inherit}
    input:focus,textarea:focus,select:focus{border-color:${T.blue};box-shadow:0 0 0 3px ${T.blueGlow}}
    .skeleton{background:linear-gradient(90deg,${T.bg3} 25%,${T.bg4} 50%,${T.bg3} 75%);
      background-size:200% 100%;animation:shimmer 1.5s infinite;border-radius:6px}
  `}</style>
);

// ─── SHARED PRIMITIVES ────────────────────────────────────────────────────────
const Badge = ({ label, color }) => (
  <span className="tag" style={{ background:`${color}18`, color, border:`1px solid ${color}30` }}>{label}</span>
);
const HealthBar = ({ value }) => {
  const color = value>=80?T.emerald:value>=50?T.amber:T.crimson;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
      <div className="progress-bar" style={{ flex:1 }}>
        <div className="progress-fill" style={{ width:`${value}%`, background:`linear-gradient(90deg,${color},${color}88)` }} />
      </div>
      <span style={{ fontSize:11, fontWeight:700, color, minWidth:26, textAlign:"right" }}>{value}%</span>
    </div>
  );
};
const Avatar = ({ initials, color, size=28 }) => (
  <div style={{
    width:size, height:size, borderRadius:"50%",
    background:`linear-gradient(135deg,${color},${color}88)`,
    display:"flex", alignItems:"center", justifyContent:"center",
    fontSize:size*0.35, fontWeight:700, color:"#fff",
    flexShrink:0, border:`2px solid ${T.bg2}`,
  }}>{initials}</div>
);
const SectionHeader = ({ title, sub, action, onAction }) => (
  <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", marginBottom:20 }}>
    <div>
      <h2 style={{ fontSize:20, fontWeight:700, color:T.text0, letterSpacing:"-0.02em" }}>{title}</h2>
      {sub && <p style={{ fontSize:13, color:T.text3, marginTop:2 }}>{sub}</p>}
    </div>
    {action && (
      <button className="btn-ghost" style={{ fontSize:12, padding:"6px 14px", borderRadius:8 }}
        onClick={onAction}>{action}</button>
    )}
  </div>
);
const MetricCard = ({ label, value, sub, color, icon, delay=0 }) => {
  const numVal = useMemo(()=>(typeof value==="number"?value:null),[value]);
  const [displayed, setDisplayed] = useState(0);
  useEffect(()=>{
    if(numVal===null)return;
    let current=0;
    const step=(numVal/800)*16;
    const timer=setInterval(()=>{
      current=Math.min(current+step,numVal);
      setDisplayed(Math.round(current));
      if(current>=numVal)clearInterval(timer);
    },16);
    return()=>clearInterval(timer);
  },[numVal]);
  const displayValue = numVal!==null
    ?(label.includes("Exposure")||label.includes("Refund")||label.includes("Pipeline")||
      label.includes("Filed")||label.includes("Recovered")||label.includes("Audit Exposure")||
      label.includes("Claims")
      ?fmt$(displayed):displayed)
    :value;
  return (
    <div className="metric-card hover-lift fadeUp"
      style={{ animationDelay:`${delay}ms`, borderTop:`2px solid ${color}22` }}>
      <div style={{ position:"absolute",top:0,right:0,width:80,height:80,borderRadius:"50%",
        background:color,filter:"blur(30px)",opacity:0.12 }} />
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12 }}>
        <div style={{ fontSize:11,color:T.text3,fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase" }}>{label}</div>
        <div style={{ fontSize:18,opacity:0.7 }}>{icon}</div>
      </div>
      <div style={{ fontSize:28,fontWeight:700,color:T.text0,letterSpacing:"-0.02em",marginBottom:4 }}>{displayValue}</div>
      <div style={{ fontSize:12,color:T.text3 }}>{sub}</div>
    </div>
  );
};

// ─── MODAL SHELL ─────────────────────────────────────────────────────────────
const Modal = ({ title, onClose, onSave, saving, children }) => (
  <div onClick={onClose} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.72)",
    zIndex:9998,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(8px)" }}>
    <div onClick={e=>e.stopPropagation()} className="glass-card fadeUp"
      style={{ width:"100%",maxWidth:520,borderRadius:16,overflow:"hidden",
        boxShadow:"0 40px 100px rgba(0,0,0,0.7)" }}>
      <div style={{ padding:"18px 22px",borderBottom:`1px solid ${T.border}`,
        display:"flex",justifyContent:"space-between",alignItems:"center" }}>
        <h3 style={{ fontSize:15,fontWeight:700,color:T.text0 }}>{title}</h3>
        <button onClick={onClose} className="btn-ghost"
          style={{ width:28,height:28,borderRadius:8,fontSize:14,padding:0,
            display:"flex",alignItems:"center",justifyContent:"center" }}>✕</button>
      </div>
      <div style={{ padding:"20px 22px",display:"flex",flexDirection:"column",gap:14 }}>
        {children}
      </div>
      <div style={{ padding:"14px 22px",borderTop:`1px solid ${T.border}`,display:"flex",gap:8,justifyContent:"flex-end" }}>
        <button className="btn-ghost" style={{ fontSize:13,padding:"8px 18px",borderRadius:8 }}
          onClick={onClose}>Cancel</button>
        <button className="btn-primary" style={{ fontSize:13,padding:"8px 18px",borderRadius:8 }}
          onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  </div>
);

const Field = ({ label, children }) => (
  <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
    <label style={{ fontSize:11,fontWeight:700,color:T.text3,letterSpacing:"0.06em",textTransform:"uppercase" }}>
      {label}
    </label>
    {children}
  </div>
);

// ─── PROJECT MODAL ────────────────────────────────────────────────────────────
const PROJECT_DEFAULTS = {
  client:"", engagement:"", type:"Reverse Audit", tax:"Sales & Use Tax",
  states:[], exposure:0, refund:0, risk:"Medium", priority:"Medium",
  status:"Planning", health:50, nexus:"Economic",
  leadStaff:"",
  assignedTeam:[],
  due:"",
  tasks:0, open:0, billingType:"Fixed Fee", period:"",
};
const ProjectModal = ({ initial, onClose, teamMembers }) => {
  const [form, setForm] = useState({
    ...PROJECT_DEFAULTS,
    ...initial,
    assignedTeam: initial?.assignedTeam || [],
  });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(p=>({...p,[k]:v}));

  const save = async () => {
    if (!form.client.trim()) return;
    setSaving(true);
    const data = { ...form,
      exposure: Number(form.exposure)||0,
      refund: Number(form.refund)||0,
      health: Number(form.health)||50,
      states: typeof form.states==="string"
        ? form.states.split(",").map(s=>s.trim()).filter(Boolean) : form.states,
      assignedTeam: form.assignedTeam,
    };
    
if (form.id) {
      await updateDocById(COLS.projects, form.id, data);

      // ── CASCADE STATUS & DUE DATE TO UNDERLYING KANBAN TASKS ──
      // Runs on EDIT (form.id exists). Synchronizes macro-changes down to task level.
      try {
        const qTasks = query(collection(db, COLS.tasks), where("project", "==", form.client));
        const querySnap = await getDocs(qTasks);
        
        if (!querySnap.empty) {
          const batch = writeBatch(db);
          const taskUpdates = {};
          
          // 1. Cascade Status (only if the project status matches a Kanban lane)
          if (TASK_COLS.includes(form.status)) {
            taskUpdates.status = form.status;
          }
          
          // 2. Cascade Due Date
          if (form.due) {
            taskUpdates.due = form.due;
          }

          // If there's anything to update, push it to all linked tasks
          if (Object.keys(taskUpdates).length > 0) {
            taskUpdates.updatedAt = new Date(); // Using native Date for batch compatibility
            querySnap.docs.forEach(taskDoc => {
              batch.update(taskDoc.ref, taskUpdates);
            });
            await batch.commit();
          }
        }
      } catch (err) {
        console.error("Failed to cascade changes to individual tasks:", err);
      }
    } else {
      await createDoc(COLS.projects, data);
    }
    setSaving(false);
    onClose();
  };

  return (
    <Modal title={form.id?"Edit Project":"New Project"} onClose={onClose} onSave={save} saving={saving}>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14 }}>
        <Field label="Client Name">
          <input style={inputStyle()} value={form.client} onChange={e=>set("client",e.target.value)} placeholder="e.g. Acme Corp" disabled={!!form.id} />
        </Field>
        <Field label="Billing Type">
          <select style={inputStyle()} value={form.billingType} onChange={e=>set("billingType",e.target.value)}>
            {["Fixed Fee","Hourly","Contingency"].map(o=><option key={o}>{o}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Engagement Name">
        <input style={inputStyle()} value={form.engagement} onChange={e=>set("engagement",e.target.value)} placeholder="e.g. TX Audit Defense 2023" />
      </Field>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14 }}>
        <Field label="Project Type">
          <select style={inputStyle()} value={form.type} onChange={e=>set("type",e.target.value)}>
            {PROJECT_TYPES.map(o=><option key={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Tax Type">
          <select style={inputStyle()} value={form.tax} onChange={e=>set("tax",e.target.value)}>
            {TAX_TYPES.map(o=><option key={o}>{o}</option>)}
          </select>
        </Field>
        
        {/* 🟢 NEW CODE: Expanded Categorized Nexus Types */}
        {form.type === "Nexus Study" && (
          <Field label="Nexus Focus">
            <select style={inputStyle({ borderColor: T.violet })} value={form.nexus || "TBD"} onChange={e=>set("nexus",e.target.value)}>
              <option value="TBD">Select trigger or TBD...</option>
              
              <optgroup label="Physical Nexus">
                <option value="Physical - Office">Office</option>
                <option value="Physical - Warehouse">Warehouse</option>
                <option value="Physical - Inventory">Inventory</option>
                <option value="Physical - Employees">Employees</option>
                <option value="Physical - Property">Property</option>
                <option value="Physical - Vehicles">Vehicles</option>
              </optgroup>
              
              <optgroup label="Economic Nexus">
                <option value="Economic - Revenue Threshold">Revenue Threshold</option>
                <option value="Economic - Transaction Threshold">Transaction Threshold</option>
              </optgroup>
              
              <optgroup label="Attributional Nexus">
                <option value="Attributional - Affiliate">Affiliate</option>
                <option value="Attributional - Click-Through">Click-Through</option>
                <option value="Attributional - Agency">Agency</option>
              </optgroup>
              
              <optgroup label="Operational Nexus">
                <option value="Operational - Services">Services</option>
                <option value="Operational - Installation">Installation</option>
                <option value="Operational - Repair">Repair</option>
                <option value="Operational - Training">Training</option>
              </optgroup>
              
              <optgroup label="Intangible Nexus">
                <option value="Intangible - Royalties">Royalties</option>
                <option value="Intangible - Licensing">Licensing</option>
                <option value="Intangible - Intellectual Property">Intellectual Property</option>
              </optgroup>
            </select>
          </Field>
        )}
        
        <Field label="Risk">
          <select style={inputStyle()} value={form.risk} onChange={e=>set("risk",e.target.value)}>
            {["Critical","High","Medium","Low"].map(o=><option key={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Priority">
          <select style={inputStyle()} value={form.priority} onChange={e=>set("priority",e.target.value)}>
            {["Critical","High","Medium","Low"].map(o=><option key={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Status (Cascades to Kanban Board)">
          <select style={inputStyle({ border:`1px solid ${T.blue}88` })} value={form.status} onChange={e=>set("status",e.target.value)}>
            {PROJECT_STATUSES.map(o=><option key={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Health (0–100)">
          <input style={inputStyle()} type="number" min="0" max="100" value={form.health} onChange={e=>set("health",e.target.value)} />
        </Field>
        <Field label="Exposure ($)">
          <input style={inputStyle()} type="number" value={form.exposure} onChange={e=>set("exposure",e.target.value)} />
        </Field>
        <Field label="Refund ($)">
          <input style={inputStyle()} type="number" value={form.refund} onChange={e=>set("refund",e.target.value)} />
        </Field>
        <Field label="Due Date">
          <input style={inputStyle()} type="date" value={form.due} onChange={e=>set("due",e.target.value)} />
        </Field>
        <Field label="Period">
          <input style={inputStyle()} value={form.period} onChange={e=>set("period",e.target.value)} placeholder="e.g. 2021-2023" />
        </Field>
      </div>

      <Field label="Lead Staff">
        <SearchableSelect
          options={teamMembers}
          value={form.leadStaff}
          onChange={v => set("leadStaff", v)}
          placeholder="Search team member…"
          getLabel={m => m.name}
          renderOption={(m, compact) => (
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                background: `linear-gradient(135deg,${m.color||T.blue},${m.color||T.blue}88)`,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: 9, fontWeight: 700, color: "#fff",
              }}>{(m.avatar || m.name?.slice(0,2) || "?").toUpperCase()}</span>
              <span>{m.name}</span>
              {!compact && <span style={{ color: T.text3, marginLeft: 4 }}>— {m.role}</span>}
            </span>
          )} />
      </Field>

      <Field label="Assigned Team">
        {teamMembers.length === 0
          ? <div style={{ fontSize:12,color:T.text3,padding:"10px 12px", background:T.bg3,borderRadius:8,border:`1px solid ${T.border}` }}>
              No team members yet — add staff first under Team &amp; Workload
            </div>
          : <SearchableMultiSelect
              options={teamMembers}
              value={form.assignedTeam}
              onChange={v => set("assignedTeam", v)}
              placeholder="Search and select team members…"
              getLabel={m => m.name}
              renderOption={(m) => (
                <span style={{ display:"flex",alignItems:"center",gap:8 }}>
                  <span style={{ width:22,height:22,borderRadius:"50%",flexShrink:0, background:m.color||T.blue, display:"inline-flex",alignItems:"center",justifyContent:"center", fontSize:9,fontWeight:700,color:"#fff" }}>{(m.avatar||m.name?.slice(0,2)||"?").toUpperCase()}</span>
                  <span>{m.name}</span>
                  <span style={{ color:T.text3,marginLeft:2 }}>— {m.role}</span>
                </span>
              )} />
        }
      </Field>

      <Field label="States (comma-separated)">
        <input style={inputStyle()} value={Array.isArray(form.states)?form.states.join(", "):form.states}
          onChange={e=>set("states",e.target.value)} placeholder="TX, CA, NY" />
      </Field>
    </Modal>
  );
};

// ─── TASK MODAL ───────────────────────────────────────────────────────────────
const TASK_DEFAULTS = { title:"", project:"", priority:"Medium", status:"Planning", due:"", assignee:"", hours:0, estimate:8 };
const TaskModal = ({ initial, onClose, projects, teamMembers }) => {
  const [form, setForm] = useState({ ...TASK_DEFAULTS, ...initial });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(p=>({...p,[k]:v}));
  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const data = { ...form, hours:Number(form.hours)||0, estimate:Number(form.estimate)||0 };
    if (form.id) await updateDocById(COLS.tasks, form.id, data);
    else await createDoc(COLS.tasks, data);
    setSaving(false);
    onClose();
  };
  return (
    <Modal title={form.id?"Edit Task":"New Task"} onClose={onClose} onSave={save} saving={saving}>
      <Field label="Task Title">
        <input style={inputStyle()} value={form.title} onChange={e=>set("title",e.target.value)} placeholder="e.g. Review IDR Batch 3" />
      </Field>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14 }}>
        <Field label="Project">
          <SearchableSelect
            options={projects}
            value={form.project}
            onChange={v => {
              const p = projects.find(px => px.client === v);
              set("project", v);
              if (p?.due && !form.due) set("due", p.due);
              // Auto-sync task column on NEW tasks only — never overwrite status on edit
              if (!form.id && p?.status && TASK_COLS.includes(p.status)) set("status", p.status);
            }}
            placeholder="Search project…"
            getLabel={p => p.client}
            renderOption={(p, compact) => (
              <span style={{ display:"flex",alignItems:"center",gap:6 }}>
                <span style={{ color:statusColor(p.status),fontSize:10 }}>●</span>
                <span>{p.client}</span>
                {!compact && <span style={{ color:T.text3 }}>— Status: {p.status}</span>}
              </span>
            )} />
        </Field>
        <Field label="Assignee">
          <SearchableSelect
            options={teamMembers}
            value={form.assignee}
            onChange={v => set("assignee", v)}
            placeholder="Search team member…"
            getLabel={m => m.name}
            renderOption={(m, compact) => (
              <span style={{ display:"flex",alignItems:"center",gap:6 }}>
                <span style={{ width:18,height:18,borderRadius:"50%",flexShrink:0, background:m.color||T.blue,display:"inline-flex",alignItems:"center", justifyContent:"center",fontSize:8,fontWeight:700,color:"#fff" }}>
                  {(m.avatar||m.name?.slice(0,2)||"?").toUpperCase()}
                </span>
                <span>{m.name}</span>
                {!compact && <span style={{ color:T.text3 }}>— {m.role}</span>}
              </span>
            )} />
        </Field>
        <Field label="Priority">
          <select style={inputStyle()} value={form.priority} onChange={e=>set("priority",e.target.value)}>
            {["Critical","High","Medium","Low"].map(o=><option key={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Status (Kanban Lane)">
          <select style={inputStyle()} value={form.status} onChange={e=>set("status",e.target.value)}>
            {TASK_COLS.map(o=><option key={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Due Date">
          <input style={inputStyle()} type="date" value={form.due} onChange={e=>set("due",e.target.value)} />
        </Field>
        <Field label="Estimate (hrs)">
          <input style={inputStyle()} type="number" value={form.estimate} onChange={e=>set("estimate",e.target.value)} />
        </Field>
        <Field label="Hours Logged">
          <input style={inputStyle()} type="number" value={form.hours} onChange={e=>set("hours",e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
};

// ─── AUDIT MODAL ──────────────────────────────────────────────────────────────
const AUDIT_DEFAULTS = { client:"", state:"", agency:"", period:"", type:"Full Audit", exposure:0, deadline:"", status:"Active" };
const AuditModal = ({ initial, onClose, projects }) => {
  const [form, setForm] = useState({ ...AUDIT_DEFAULTS, ...initial });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(p=>({...p,[k]:v}));
  const save = async () => {
    if (!form.client.trim()) return;
    setSaving(true);
    const data = { ...form, exposure:Number(form.exposure)||0 };
    if (form.id) await updateDocById(COLS.audits, form.id, data);
    else await createDoc(COLS.audits, data);
    setSaving(false);
    onClose();
  };
  return (
    <Modal title={form.id?"Edit Audit Notice":"New Audit Notice"} onClose={onClose} onSave={save} saving={saving}>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14 }}>
        <Field label="Client">
          <SearchableSelect
            options={projects}
            value={form.client}
            onChange={v => {
              const p = projects.find(px => px.client === v);
              set("client", v);
              if (p?.due && !form.deadline) set("deadline", p.due);
              if (p?.states?.length && !form.state) set("state", p.states[0]);
              if (p?.exposure && !form.exposure) set("exposure", p.exposure);
            }}
            placeholder="Search client…"
            getLabel={p => p.client}
            renderOption={(p, compact) => (
              <span style={{ display:"flex",alignItems:"center",gap:6 }}>
                <span style={{ color:riskColor(p.risk),fontSize:10 }}>●</span>
                <span>{p.client}</span>
                {!compact && <span style={{ color:T.text3 }}>— {p.type}</span>}
              </span>
            )} />
        </Field>
        <Field label="State">
          <select style={inputStyle()} value={form.state} onChange={e=>set("state",e.target.value)}>
            <option value="">Select state…</option>
            {(projects.find(p=>p.client===form.client)?.states || []).map(s=>(
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Agency">
          <input style={inputStyle()} value={form.agency} onChange={e=>set("agency",e.target.value)} placeholder="Texas Comptroller" />
        </Field>
        <Field label="Audit Type">
          <select style={inputStyle()} value={form.type} onChange={e=>set("type",e.target.value)}>
            {["Full Audit","Desk Audit","Severance Audit","Sales Tax Desk Audit"].map(o=><option key={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Period">
          <input style={inputStyle()} value={form.period} onChange={e=>set("period",e.target.value)} placeholder="2021-2023" />
        </Field>
        <Field label="Exposure ($)">
          <input style={inputStyle()} type="number" value={form.exposure} onChange={e=>set("exposure",e.target.value)} />
        </Field>
        <Field label="Deadline">
          <input style={inputStyle()} type="date" value={form.deadline} onChange={e=>set("deadline",e.target.value)} />
        </Field>
        <Field label="Status">
          <select style={inputStyle()} value={form.status} onChange={e=>set("status",e.target.value)}>
            {["Active","Responded","Closed"].map(o=><option key={o}>{o}</option>)}
          </select>
        </Field>
      </div>
    </Modal>
  );
};

// ─── STATE MODAL ──────────────────────────────────────────────────────────────
const STATE_DEFAULTS = { state:"", nexus:"Physical", status:"Registered", exposure:0, filings:"Monthly", risk:"Medium" };
const StateModal = ({ initial, onClose }) => {
  const [form, setForm] = useState({ ...STATE_DEFAULTS, ...initial });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(p=>({...p,[k]:v}));

  const save = async () => {
    if (!form.state.trim()) return;
    setSaving(true);
    const data = { ...form, exposure: Number(form.exposure)||0 };
    if (form.id) await updateDocById(COLS.states, form.id, data);
    else await createDoc(COLS.states, data);
    setSaving(false);
    onClose();
  };
  return (
    <Modal title={form.id?"Edit State":"Add State"} onClose={onClose} onSave={save} saving={saving}>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14 }}>
        <Field label="State Code">
          <input style={inputStyle()} value={form.state} onChange={e=>set("state",e.target.value)} placeholder="TX" maxLength={2} />
        </Field>
        <Field label="Nexus Type">
          <select style={inputStyle()} value={form.nexus} onChange={e=>set("nexus",e.target.value)}>
            {["Physical","Economic","Physical+Economic"].map(o=><option key={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select style={inputStyle()} value={form.status} onChange={e=>set("status",e.target.value)}>
            {["Registered","Under Audit","Refund Pending","Not Registered"].map(o=><option key={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Risk">
          <select style={inputStyle()} value={form.risk} onChange={e=>set("risk",e.target.value)}>
            {["Critical","High","Medium","Low"].map(o=><option key={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Exposure ($)">
          <input style={inputStyle()} type="number" value={form.exposure} onChange={e=>set("exposure",e.target.value)} />
        </Field>
        <Field label="Filing Frequency">
          <select style={inputStyle()} value={form.filings} onChange={e=>set("filings",e.target.value)}>
            {["Monthly","Quarterly","Annually"].map(o=><option key={o}>{o}</option>)}
          </select>
        </Field>
      </div>
    </Modal>
  );
};

// ─── REFUND MODAL ─────────────────────────────────────────────────────────────
const REFUND_DEFAULTS = { client:"", state:"", type:"Sales & Use Tax", estimated:0, filed:0, recovered:0, status:"Filed — Pending Approval", pct:0 };
const RefundModal = ({ initial, onClose, projects }) => {
  const [form, setForm] = useState({ ...REFUND_DEFAULTS, ...initial });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(p=>({...p,[k]:v}));
  const save = async () => {
    if (!form.client.trim()) return;
    setSaving(true);
    const data = {
      ...form,
      estimated: Number(form.estimated)||0,
      filed: Number(form.filed)||0,
      recovered: Number(form.recovered)||0,
      pct: Number(form.pct)||0,
    };
    if (form.id) await updateDocById(COLS.refunds, form.id, data);
    else await createDoc(COLS.refunds, data);
    setSaving(false);
    onClose();
  };
  return (
    <Modal title={form.id?"Edit Refund Claim":"New Refund Claim"} onClose={onClose} onSave={save} saving={saving}>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14 }}>
        <Field label="Client">
          <SearchableSelect
            options={projects}
            value={form.client}
            onChange={v => {
              const p = projects.find(px => px.client === v);
              set("client", v);
              if (p?.due && !form.deadline) set("deadline", p.due);
              if (p?.states?.length && !form.state) set("state", p.states[0]);
              if (p?.exposure && !form.exposure) set("exposure", p.exposure);
            }}
            placeholder="Search client…"
            getLabel={p => p.client}
            renderOption={(p, compact) => (
              <span style={{ display:"flex",alignItems:"center",gap:6 }}>
                <span style={{ color:riskColor(p.risk),fontSize:10 }}>●</span>
                <span>{p.client}</span>
                {!compact && <span style={{ color:T.text3 }}>— {p.type}</span>}
              </span>
            )} />
        </Field>
        <Field label="State">
          <select style={inputStyle()} value={form.state} onChange={e=>set("state",e.target.value)}>
            <option value="">Select state…</option>
            {(projects.find(p=>p.client===form.client)?.states || []).map(s=>(
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Tax Type">
          <select style={inputStyle()} value={form.type} onChange={e=>set("type",e.target.value)}>
            {TAX_TYPES.map(o=><option key={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select style={inputStyle()} value={form.status} onChange={e=>set("status",e.target.value)}>
            {["Filed — Pending Approval","Partial Recovery","Fully Recovered","In Preparation"].map(o=><option key={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Estimated ($)">
          <input style={inputStyle()} type="number" value={form.estimated} onChange={e=>set("estimated",e.target.value)} />
        </Field>
        <Field label="Filed ($)">
          <input style={inputStyle()} type="number" value={form.filed} onChange={e=>set("filed",e.target.value)} />
        </Field>
        <Field label="Recovered ($)">
          <input style={inputStyle()} type="number" value={form.recovered} onChange={e=>set("recovered",e.target.value)} />
        </Field>
        <Field label="Recovery % (0-100)">
          <input style={inputStyle()} type="number" min="0" max="100" value={form.pct} onChange={e=>set("pct",e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
};

// ─── SIMPLE MARKDOWN BOLD RENDERER ──────────────────────────────────────────
const renderMarkdown = (text) => {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} style={{ color: "inherit", fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
};
const CommandPalette = ({ open, onClose, onNavigate }) => {
  const [query, setQuery] = useState("");
  const inputRef = useRef();
  const commands = useMemo(() => [
    { label:"Command Center", icon:"⬡", action:()=>onNavigate("dashboard") },
    { label:"All Projects", icon:"◈", action:()=>onNavigate("projects") },
    { label:"Task Board", icon:"◻", action:()=>onNavigate("tasks") },
    { label:"State Tracker", icon:"◉", action:()=>onNavigate("states") },
    { label:"Audit Management", icon:"⚑", action:()=>onNavigate("audits") },
    { label:"Refund Tracker", icon:"◆", action:()=>onNavigate("refunds") },
    { label:"Team & Workload", icon:"◈", action:()=>onNavigate("team") },
    { label:"Research Hub", icon:"⊕", action:()=>onNavigate("research") },
    { label:"Reports", icon:"▤", action:()=>onNavigate("reports") },
    { label:"Tax Copilot AI", icon:"✦", action:()=>onNavigate("copilot") },
  ], [onNavigate]);
  const filtered = useMemo(() =>
    query ? commands.filter(c=>c.label.toLowerCase().includes(query.toLowerCase())) : commands,
  [query, commands]);
  useEffect(() => { if (open) { setQuery(""); inputRef.current?.focus(); } }, [open]);
  if (!open) return null;
  const handleKeyDown = (e) => {
    if (e.key==="Escape") onClose();
    if (e.key==="Enter" && filtered[0]) { filtered[0].action(); onClose(); }
  };
  return (
    <div onClick={onClose} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.72)",
      zIndex:9999,display:"flex",alignItems:"flex-start",justifyContent:"center",
      paddingTop:"15vh",backdropFilter:"blur(8px)" }}>
      <div onClick={e=>e.stopPropagation()} className="glass-card fadeUp"
        style={{ width:"100%",maxWidth:580,borderRadius:16,overflow:"hidden",
          boxShadow:"0 40px 100px rgba(0,0,0,0.7)" }}>
        <div style={{ display:"flex",alignItems:"center",gap:12,
          padding:"14px 18px",borderBottom:`1px solid ${T.border}` }}>
          <span style={{ color:T.text3,fontSize:16 }}>⌘</span>
          <input ref={inputRef} value={query} onChange={e=>setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search projects, clients, states… or type a command"
            style={{ flex:1,background:"transparent",border:"none",fontSize:14,color:T.text0,padding:0 }} />
          <kbd style={{ background:T.bg4,padding:"2px 6px",borderRadius:4,
            fontSize:11,color:T.text3,border:`1px solid ${T.border}` }}>ESC</kbd>
        </div>
        <div style={{ maxHeight:380,overflowY:"auto",padding:8 }}>
          {filtered.length===0
            ? <div style={{ padding:"24px",textAlign:"center",color:T.text3,fontSize:13 }}>No results found</div>
            : filtered.map((c,i) => (
              <div key={i} onClick={()=>{ c.action(); onClose(); }}
                style={{ display:"flex",alignItems:"center",gap:12,padding:"10px 12px",
                  borderRadius:8,cursor:"pointer",transition:"background 0.15s" }}
                onMouseEnter={e=>e.currentTarget.style.background=T.bg3}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <span style={{ fontSize:14,width:20,textAlign:"center",color:T.text3 }}>{c.icon}</span>
                <span style={{ fontSize:13,color:T.text1 }}>{c.label}</span>
                {query && <span style={{ marginLeft:"auto",fontSize:11,color:T.text3 }}>↵ Enter</span>}
              </div>
            ))
          }
        </div>
        <div style={{ padding:"8px 18px",borderTop:`1px solid ${T.border}`,display:"flex",gap:16,alignItems:"center" }}>
          {[["↑↓","Navigate"],["↵","Select"],["ESC","Close"]].map(([k,v]) => (
            <div key={k} style={{ display:"flex",gap:6,alignItems:"center" }}>
              <kbd style={{ background:T.bg4,padding:"1px 6px",borderRadius:4,
                fontSize:10,color:T.text2,border:`1px solid ${T.border}` }}>{k}</kbd>
              <span style={{ fontSize:11,color:T.text3 }}>{v}</span>
            </div>
          ))}
          <div style={{ marginLeft:"auto",fontSize:11,color:T.text3 }}>TaxOps Elite</div>
        </div>
      </div>
    </div>
  );
};

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
const Sidebar = ({ active, onNav, collapsed, onToggle, profile }) => (
  <aside style={{ width:collapsed?60:224,background:T.bg1,
    borderRight:`1px solid ${T.border}`,height:"100vh",display:"flex",
    flexDirection:"column",transition:"width 0.25s cubic-bezier(.4,0,.2,1)",
    flexShrink:0,overflow:"hidden" }}>
    <div style={{ padding:collapsed?"18px 12px":"18px 16px",
      borderBottom:`1px solid ${T.border}`,display:"flex",
      alignItems:"center",gap:10,minHeight:61 }}>
      <div style={{ width:32,height:32,borderRadius:8,flexShrink:0,
        background:`linear-gradient(135deg,${T.blue},${T.violet})`,
        display:"flex",alignItems:"center",justifyContent:"center",
        fontSize:14,boxShadow:`0 4px 14px ${T.blueGlow}`,
        animation:"glow 3s ease-in-out infinite" }}>⬡</div>
      {!collapsed && (
        <div>
          <div style={{ fontSize:13,fontWeight:700,letterSpacing:"0.02em",color:T.text0 }}>TaxOps Elite</div>
          <div style={{ fontSize:10,color:T.text3,letterSpacing:"0.08em" }}>INDIRECT TAX OS</div>
        </div>
      )}
      <button onClick={onToggle} style={{ marginLeft:"auto",background:"transparent",
        border:"none",color:T.text3,cursor:"pointer",fontSize:14,flexShrink:0,padding:2 }}>
        {collapsed?"›":"‹"}
      </button>
    </div>
    <div style={{ flex:1,overflowY:"auto",padding:"10px 8px" }}>
      {!collapsed && (
        <div style={{ fontSize:10,fontWeight:700,letterSpacing:"0.1em",
          color:T.text3,padding:"8px 8px 4px",textTransform:"uppercase" }}>Workspace</div>
      )}
      <div style={{ display:"flex",flexDirection:"column",gap:1 }}>
        {NAV_ITEMS.map(item => (
          <button key={item.id} onClick={()=>onNav(item.id)}
            title={collapsed?item.label:""}
            className={`nav-item${active===item.id?" active":""}`}
            style={{ borderLeft:active===item.id?`2px solid ${T.blue}`:"2px solid transparent",
              justifyContent:collapsed?"center":"flex-start" }}>
            <span style={{ fontSize:15,flexShrink:0 }}>{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}
      </div>
    </div>
    <div style={{ padding:collapsed?"12px 8px":"12px 12px",borderTop:`1px solid ${T.border}` }}>
      <div style={{ display:"flex",alignItems:"center",gap:10 }}>
        <div style={{ width:30,height:30,borderRadius:"50%",flexShrink:0,
          background:`linear-gradient(135deg,${T.violet},${T.blue})`,
          display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:11,fontWeight:700 }}>{profile?.initials || "YA"}</div>
        {!collapsed && (
          <div>
            <div style={{ fontSize:12,fontWeight:600,color:T.text0 }}>{profile?.name || "Your Account"}</div>
            <div style={{ fontSize:10,color:T.text3 }}>{profile?.role || "Senior Manager"}</div>
          </div>
        )}
      </div>
    </div>
  </aside>
);

// ─── TOPBAR ───────────────────────────────────────────────────────────────────
const NotifButton = ({ icon, tip, badge, onClick }) => {
  const [hov, setHov] = useState(false);
  return (
    <div style={{ position:"relative" }} title={tip}>
      <button onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
        onClick={onClick}
        style={{ width:34,height:34,borderRadius:8,cursor:"pointer",fontSize:15,
          background:hov?T.bg4:T.bg3,color:hov?T.text0:T.text2,
          border:`1px solid ${T.border}`,transition:"all 0.15s",
          display:"flex",alignItems:"center",justifyContent:"center" }}>{icon}</button>
      {badge && (
        <div style={{ position:"absolute",top:3,right:3,width:14,height:14,
          borderRadius:"50%",background:T.crimson,fontSize:9,fontWeight:700,
          color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",
          border:`2px solid ${T.bg1}` }}>{badge}</div>
      )}
    </div>
  );
};

const TopBar = ({ onCommand, activeView, onSignOut, profile, onEditProfile }) => {
  const [hovered, setHovered] = useState(false);
  const [soHov, setSoHov] = useState(false);
  const label = NAV_ITEMS.find(n=>n.id===activeView)?.label || "TaxOps Elite";
  return (
    <div style={{ height:52,background:T.bg1,borderBottom:`1px solid ${T.border}`,
      display:"flex",alignItems:"center",paddingInline:24,gap:16,flexShrink:0 }}>
      <div style={{ fontSize:13,fontWeight:600,color:T.text0,flex:1 }}>{label}</div>
      <button onClick={onCommand}
        onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}
        style={{ display:"flex",alignItems:"center",gap:8,background:T.bg3,
          border:`1px solid ${hovered?T.borderHover:T.border}`,borderRadius:8,
          padding:"6px 12px",cursor:"pointer",
          color:hovered?T.text1:T.text3,fontSize:12,transition:"all 0.15s" }}>
        <span>⌘</span>
        <span>Search or jump to...</span>
        <kbd style={{ background:T.bg4,padding:"1px 5px",borderRadius:4,
          fontSize:10,border:`1px solid ${T.border}`,marginLeft:4 }}>⌘K</kbd>
      </button>
      <div style={{ display:"flex",gap:6,alignItems:"center" }}>
        <NotifButton icon="🔔" tip="Notifications" badge={5} />
        <NotifButton icon="⚙" tip="Settings" onClick={onEditProfile} />
        <div onClick={onEditProfile} style={{ width:34,height:34,borderRadius:"50%",
          background:`linear-gradient(135deg,${T.violet},${T.blue})`,
          display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:12,fontWeight:700,cursor:"pointer" }}>{profile.initials}</div>
        <button
          onClick={onSignOut}
          onMouseEnter={()=>setSoHov(true)}
          onMouseLeave={()=>setSoHov(false)}
          title="Sign out"
          style={{ background:"none",border:`1px solid ${soHov?T.borderHover:T.border}`,
            borderRadius:8,padding:"5px 10px",cursor:"pointer",
            color:soHov?T.crimson:T.text3,fontSize:11,fontFamily:"inherit",
            transition:"all 0.15s",letterSpacing:"0.02em" }}>
          Sign Out
        </button>
      </div>
    </div>
  );
};

// ─── ALERT BANNER ─────────────────────────────────────────────────────────────
const AlertBanner = ({ color, icon, badge, text, cta, onClick }) => (
  <div style={{ background:`${color}15`,border:`1px solid ${color}30`,borderRadius:10,
    padding:"10px 16px",display:"flex",alignItems:"center",gap:10,flex:1 }}>
    <span style={{ fontSize:18 }}>{icon}</span>
    <div>
      <div style={{ fontSize:11,color,fontWeight:700,letterSpacing:"0.06em" }}>{badge}</div>
      <div style={{ fontSize:12,color:T.text1 }}>{text}</div>
    </div>
    <button className="btn-ghost" onClick={onClick}
      style={{ marginLeft:"auto",fontSize:11,padding:"4px 10px",
        borderRadius:6,borderColor:`${color}30`,color }}>{cta}</button>
  </div>
);

// ─── DASHBOARD VIEW ───────────────────────────────────────────────────────────
const DashboardView = ({ onNavigate, projects, audits, team }) => {
  const totalExposure = useMemo(()=>projects.reduce((s,p)=>s+(p.exposure||0),0),[projects]);
  const totalRefund = useMemo(()=>projects.reduce((s,p)=>s+(p.refund||0),0),[projects]);
  const criticalCount = useMemo(()=>projects.filter(p=>p.risk==="Critical").length,[projects]);
  const overdueAudits = useMemo(()=>audits.filter(a=>{ const d=daysLeft(a.deadline); return d!==null&&d<10; }).length,[audits]);
  const urgentAudit = audits.find(a=>{ const d=daysLeft(a.deadline); return d!==null&&d<10; });
  const overloadedMember = team.find(m=>(m.utilization||0)>90);
  return (
    <div style={{ padding:"28px 32px",overflowY:"auto",height:"100%",
      display:"flex",flexDirection:"column",gap:28 }}>
      <div className="fadeUp">
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <div>
            <h1 style={{ fontSize:24,fontWeight:700,letterSpacing:"-0.03em",color:T.text0 }}>
              Command Center{" "}
              <span style={{ fontSize:13,fontWeight:400,color:T.text3 }}>— Good morning</span>
            </h1>
            <p style={{ fontSize:13,color:T.text3,marginTop:3 }}>
              Indirect Tax Operations · {new Date().toLocaleDateString("en-US",
                { weekday:"long",month:"long",day:"numeric" })}
            </p>
          </div>
          <div style={{ display:"flex",gap:10 }}>
            <button className="btn-ghost"
              style={{ fontSize:12,padding:"8px 16px",borderRadius:10 }}
              onClick={()=>onNavigate("projects")}>⊕ New Project</button>
            <button className="btn-primary"
              style={{ fontSize:12,padding:"8px 16px",borderRadius:10 }}
              onClick={()=>onNavigate("tasks")}>⬡ Quick Add</button>
          </div>
        </div>
        {(urgentAudit || overloadedMember) && (
          <div style={{ display:"flex",gap:8,marginTop:14 }}>
            {urgentAudit && (
              <AlertBanner color={T.crimson} icon="⚑" badge="URGENT"
                text={<>
                  {urgentAudit.client} audit deadline in{" "}
                  <strong style={{color:T.crimson}}>{daysLeft(urgentAudit.deadline)} days</strong>
                </>}
                cta="View →" onClick={()=>onNavigate("audits")} />
            )}
            {overloadedMember && (
              <AlertBanner color={T.amber} icon="◉" badge="OVERLOADED"
                text={<>
                  {overloadedMember.name} at{" "}
                  <strong style={{color:T.amber}}>{overloadedMember.utilization}% utilization</strong>
                  {" "}— rebalance needed
                </>}
                cta="Rebalance →" onClick={()=>onNavigate("team")} />
            )}
          </div>
        )}
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:14 }}>
        <MetricCard label="Active Projects" value={projects.length} sub="across portfolio" color={T.blue} icon="◈" delay={0} />
        <MetricCard label="Total Exposure" value={totalExposure} sub="across all states" color={T.crimson} icon="⚠" delay={60} />
        <MetricCard label="Refund Pipeline" value={totalRefund} sub="estimated recovery" color={T.emerald} icon="◆" delay={120} />
        <MetricCard label="Critical Risk" value={criticalCount} sub="require escalation" color={T.amber} icon="⚑" delay={180} />
        <MetricCard label="Audit Deadlines" value={overdueAudits} sub="due within 10 days" color={T.violet} icon="⏱" delay={240} />
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"1.6fr 1fr",gap:18 }}>
        <div>
          <SectionHeader title="Active Engagements"
            sub={`${projects.filter(p=>p.status!=="Closed").length} live projects`}
            action="View All" onAction={()=>onNavigate("projects")} />
          <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
            {projects.slice(0,4).map((p,i) => (
              <div key={p.id} className="card hover-lift fadeUp"
                style={{ padding:"16px 18px",animationDelay:`${i*55}ms`,cursor:"pointer" }}>
                <div style={{ display:"flex",alignItems:"flex-start",
                  justifyContent:"space-between",marginBottom:10 }}>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:3 }}>
                      <span style={{ fontSize:12,fontWeight:700,color:T.text0,
                        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                        {p.client}
                      </span>
                      <Badge label={p.priority} color={priorityColor(p.priority)} />
                      <Badge label={`${p.risk} Risk`} color={riskColor(p.risk)} />
                    </div>
                    <div style={{ fontSize:11,color:T.text3,overflow:"hidden",
                      textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{p.engagement}</div>
                  </div>
                  <div style={{ textAlign:"right",flexShrink:0,marginLeft:12 }}>
                    <div style={{ fontSize:13,fontWeight:700,color:T.text0 }}>{fmt$(p.exposure||0)}</div>
                    <div style={{ fontSize:10,color:T.text3 }}>exposure</div>
                  </div>
                </div>
                <div style={{ display:"flex",alignItems:"center",
                  justifyContent:"space-between",marginBottom:10 }}>
                  <div style={{ display:"flex",gap:4,flexWrap:"wrap" }}>
                    {(p.states||[]).slice(0,4).map(s=>(
                      <span key={s} className="tag"
                        style={{ background:T.bg4,color:T.text2,border:`1px solid ${T.border}`,fontSize:10 }}>{s}</span>
                    ))}
                    {(p.states||[]).length>4 && (
                      <span className="tag"
                        style={{ background:T.bg4,color:T.text3,border:`1px solid ${T.border}`,fontSize:10 }}>
                        +{p.states.length-4}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize:11,color:statusColor(p.status),fontWeight:600 }}>● {p.status}</span>
                </div>
                <HealthBar value={p.health||0} />
              </div>
            ))}
          </div>
        </div>
        <div style={{ display:"flex",flexDirection:"column",gap:18 }}>
          <div>
            <SectionHeader title="Audit Deadlines" action="View All" onAction={()=>onNavigate("audits")} />
            <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
              {audits.map((a,i) => {
                const dl = daysLeft(a.deadline);
                const urgColor = dl===null?T.emerald:dl<0?T.crimson:dl<10?T.crimson:dl<30?T.amber:T.emerald;
                return (
                <div key={a.id||i} className="card fadeUp"
                  style={{ padding:"12px 14px",animationDelay:`${i*50}ms`,
                    borderLeft:`3px solid ${urgColor}` }}>
                  <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                    <span style={{ fontSize:12,fontWeight:600,color:T.text0 }}>{a.client}</span>
                    <span style={{ fontSize:11,fontWeight:700,color:urgColor }}>
                      {dl===null?"—":dl<0?`${Math.abs(dl)}d overdue`:dl===0?"Today":`${dl}d left`}
                    </span>
                  </div>
                  <div style={{ fontSize:11,color:T.text3 }}>{a.state} · {a.type} · {fmt$(a.exposure||0)}</div>
                </div>
                );
              })}
            </div>
          </div>
          <div>
            <SectionHeader title="Team Utilization" action="View All" onAction={()=>onNavigate("team")} />
            <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
              {team.slice(0,5).map((m,i) => (
                <div key={m.id||i} className="fadeUp" style={{ animationDelay:`${i*40}ms` }}>
                  <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:4 }}>
                    <Avatar initials={m.avatar} color={m.color||T.blue} size={26} />
                    <span style={{ fontSize:12,color:T.text1,flex:1 }}>{m.name}</span>
                    <span style={{ fontSize:11,fontWeight:700,
                      color:(m.utilization||0)>90?T.crimson:(m.utilization||0)>75?T.amber:T.emerald }}>
                      {m.utilization}%
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{
                      width:`${m.utilization||0}%`,
                      background:(m.utilization||0)>90?T.crimson:(m.utilization||0)>75?T.amber:T.emerald }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── PROJECTS VIEW ────────────────────────────────────────────────────────────
const ProjectsView = ({ projects, team, onEdit, onDelete }) => {
  const [filterVal, setFilterVal] = useState("All");
  const [searchVal, setSearchVal] = useState("");
  const FILTERS = ["All","Critical","In Progress","Review Phase","Escalated","Waiting for Client"];
  const visible = useMemo(()=>projects.filter(p=>{
    const matchF = filterVal==="All"||p.status===filterVal||p.priority===filterVal||p.risk===filterVal;
    const q = searchVal.toLowerCase();
    const matchS = !q||p.client.toLowerCase().includes(q)||p.engagement.toLowerCase().includes(q);
    return matchF && matchS;
  }),[filterVal,searchVal,projects]);
  return (
    <div style={{ padding:"28px 32px",overflowY:"auto",height:"100%",
      display:"flex",flexDirection:"column",gap:20 }}>
      <SectionHeader title="Projects"
        sub={`${projects.length} total engagements · ${projects.filter(p=>p.risk==="Critical").length} critical`} />
      <div style={{ display:"flex",gap:10,alignItems:"center",flexWrap:"wrap" }}>
        <input value={searchVal} onChange={e=>setSearchVal(e.target.value)}
          placeholder="Search clients, engagements..."
          style={{ padding:"8px 14px",width:280,height:36 }} />
        <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
          {FILTERS.map(f=>(
            <button key={f} onClick={()=>setFilterVal(f)}
              style={{ padding:"6px 12px",borderRadius:8,fontSize:12,fontWeight:600,
                cursor:"pointer",transition:"all 0.15s",fontFamily:"inherit",
                background:filterVal===f?T.blue:"transparent",
                color:filterVal===f?"#fff":T.text2,
                border:filterVal===f?`1px solid ${T.blue}`:`1px solid ${T.border}` }}>{f}</button>
          ))}
        </div>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(360px,1fr))",gap:14 }}>
        {visible.map((p,i) => (
          <div key={p.id} className="card hover-lift fadeUp"
            style={{ padding:"20px",animationDelay:`${i*40}ms`,
              borderTop:`2px solid ${riskColor(p.risk)}22` }}>
            <div style={{ display:"flex",justifyContent:"space-between",
              alignItems:"flex-start",marginBottom:14 }}>
              <div>
                <div style={{ fontSize:14,fontWeight:700,color:T.text0,marginBottom:3 }}>{p.client}</div>
                <div style={{ fontSize:11,color:T.text3,lineHeight:1.4,maxWidth:220 }}>{p.engagement}</div>
              </div>
              <div style={{ textAlign:"right",flexShrink:0,marginLeft:12 }}>
                <div style={{ fontSize:16,fontWeight:700,color:T.text0 }}>{fmt$(p.exposure||0)}</div>
                <div style={{ fontSize:10,color:T.text3 }}>exposure</div>
                {(p.refund||0)>0 && (
                  <div style={{ fontSize:12,fontWeight:600,color:T.emerald }}>{fmt$(p.refund)} refund</div>
                )}
              </div>
            </div>
            <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:12 }}>
              <Badge label={p.type} color={T.blue} />
              <Badge label={p.tax} color={T.violet} />
              <Badge label={p.priority} color={priorityColor(p.priority)} />
            </div>
            <div style={{ display:"flex",gap:4,flexWrap:"wrap",marginBottom:14 }}>
              {(p.states||[]).map(s=>(
                <span key={s} className="tag"
                  style={{ background:T.bg4,color:T.text2,border:`1px solid ${T.border}`,fontSize:10 }}>{s}</span>
              ))}
            </div>
            <div style={{ display:"flex",justifyContent:"space-between",marginBottom:10 }}>
              <span style={{ fontSize:11,color:statusColor(p.status),fontWeight:600 }}>● {p.status}</span>
              <span style={{ fontSize:11,color:daysColor(p.due),fontWeight:600 }}>
                {p.due ? `📅 ${daysLabel(p.due)}` : "No due date"}
              </span>
            </div>
            <HealthBar value={p.health||0} />
            <div style={{ display:"flex",justifyContent:"space-between",
              marginTop:12,paddingTop:12,borderTop:`1px solid ${T.border}` }}>
              <div style={{ display:"flex",gap:14,alignItems:"center" }}>
                <span style={{ fontSize:11,color:T.text3,display:"flex",alignItems:"center",gap:4 }}>
                  👤 {p.leadStaff || p.manager || "—"}
                  {(p.assignedTeam||[]).length > 0 &&
                    <span style={{ background:T.blue,color:"#fff",borderRadius:10,
                      padding:"0 5px",fontSize:10,fontWeight:700 }}>
                      +{(p.assignedTeam||[]).length}
                    </span>}
                </span>
                <span style={{ fontSize:11,color:T.text3 }}>{p.tasks||0} tasks</span>
                <span style={{ fontSize:11,color:(p.open||0)>10?T.amber:T.text3 }}>{p.open||0} open</span>
              </div>
              <div style={{ display:"flex",gap:6 }}>
                <button className="btn-primary"
                  style={{ fontSize:11,padding:"3px 12px",borderRadius:6 }}
                  onClick={()=>onEdit(p)}>Modify Status</button>
                <button className="btn-ghost"
                  style={{ fontSize:11,padding:"3px 10px",borderRadius:6,
                    borderColor:`${T.crimson}40`,color:T.crimson }}
                  onClick={()=>onDelete(p.id)}>✕</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── TASKS VIEW ───────────────────────────────────────────────────────────────
const TasksView = ({ tasks, projects, team, onEdit, onDelete }) => {
  const tasksByCol = useMemo(()=>{
    const map = {};
    TASK_COLS.forEach(c=>{ map[c] = tasks.filter(t=>t.status===c); });
    return map;
  },[tasks]);
  const moveTask = useCallback(async (task, newStatus) => {
    await updateDocById(COLS.tasks, task.id, { status: newStatus });
  },[]);
  return (
    <div style={{ padding:"28px 32px",height:"100%",display:"flex",
      flexDirection:"column",gap:20,overflow:"hidden" }}>
      <SectionHeader title="Task Board" sub={`${tasks.length} active tasks · Kanban board responds dynamically to Project updates`} />
      <div style={{ display:"flex",gap:12,overflowX:"auto",flex:1,paddingBottom:8 }}>
        {TASK_COLS.map(col=>(
          <div key={col} style={{ minWidth:280,display:"flex",flexDirection:"column" }}>
            <div style={{ padding:"10px 12px",background:T.bg2,
              borderRadius:"12px 12px 0 0",border:`1px solid ${T.border}`,borderBottom:"none",
              display:"flex",justifyContent:"space-between",alignItems:"center" }}>
              <span style={{ fontSize:12,fontWeight:700,color:T.text1,letterSpacing:"0.02em" }}>{col}</span>
              <span style={{ fontSize:11,background:T.bg4,color:T.text3,padding:"2px 8px",borderRadius:20 }}>
                {tasksByCol[col]?.length||0}
              </span>
            </div>
            <div style={{ flex:1,background:`${T.bg2}44`,border:`1px solid ${T.border}`,
              borderTop:"none",borderRadius:"0 0 12px 12px",padding:8,
              display:"flex",flexDirection:"column",gap:8,minHeight:400,overflowY:"auto" }}>
              {(tasksByCol[col]||[]).map((t,i)=>(
                <div key={t.id} className="card hover-lift fadeUp"
                  style={{ padding:"14px",cursor:"grab",animationDelay:`${i*50}ms` }}>
                  <div style={{ display:"flex",justifyContent:"space-between",
                    alignItems:"flex-start",marginBottom:8 }}>
                    <span style={{ fontSize:12,fontWeight:600,color:T.text0,
                      lineHeight:1.4,flex:1,paddingRight:8 }}>{t.title}</span>
                    <Badge label={t.priority} color={priorityColor(t.priority)} />
                  </div>
                  <div style={{ fontSize:11,color:T.text2,marginBottom:10,fontWeight:600 }}>💼 {t.project}</div>
                  <div style={{ display:"flex",justifyContent:"space-between",
                    alignItems:"center",marginBottom:10 }}>
                    <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                      <Avatar
                        initials={(t.assignee||"?").split(" ").map(n=>n[0]).join("")}
                        color={team.find(m=>m.name===t.assignee)?.color||T.blue}
                        size={22} />
                      <span style={{ fontSize:11,color:T.text2 }}>{(t.assignee||"").split(" ")[0]}</span>
                    </div>
                    <span style={{ fontSize:11,fontWeight:600,color:daysColor(t.due) }}>📅 {t.due ? daysLabel(t.due) : "No date"}</span>
                  </div>
                  <div>
                    <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                      <span style={{ fontSize:10,color:T.text3 }}>{t.hours}h / {t.estimate}h logged</span>
                      <span style={{ fontSize:10,color:T.text3 }}>
                        {t.estimate>0?Math.round((t.hours/t.estimate)*100):0}%
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{
                        width:t.estimate>0?`${Math.min((t.hours/t.estimate)*100,100)}%`:"0%",
                        background:T.blue }} />
                    </div>
                  </div>
                  <div style={{ display:"flex",gap:6,marginTop:10,flexWrap:"wrap" }}>
                    {TASK_COLS.filter(c=>c!==col).map(c=>(
                      <button key={c} className="btn-ghost"
                        style={{ fontSize:10,padding:"2px 7px",borderRadius:5 }}
                        onClick={()=>moveTask(t,c)}>→ {c}</button>
                    ))}
                    <button className="btn-ghost"
                      style={{ fontSize:10,padding:"2px 7px",borderRadius:5 }}
                      onClick={()=>onEdit(t)}>✏</button>
                    <button className="btn-ghost"
                      style={{ fontSize:10,padding:"2px 7px",borderRadius:5,
                        borderColor:`${T.crimson}40`,color:T.crimson }}
                      onClick={()=>onDelete(t.id)}>✕</button>
                  </div>
                </div>
              ))}
              {(tasksByCol[col]||[]).length===0 && (
                <div style={{ flex:1,display:"flex",alignItems:"center",
                  justifyContent:"center",color:T.text3,fontSize:12,
                  flexDirection:"column",gap:8,padding:24,opacity:0.6 }}>
                  <span style={{ fontSize:24 }}>◻</span>
                  <span>No tasks</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── STATES VIEW ──────────────────────────────────────────────────────────────
const deriveStatesFromProjects = (projects) => {
  const map = {};
  projects.forEach(p => {
    (p.states || []).forEach(abbr => {
      if (!map[abbr]) {
        map[abbr] = {
          state: abbr,
          exposure: 0,
          risk: "Low",
          projects: [],
          taxTypes: new Set(),
          statuses: new Set(),
          dueDate: null,
          projectNexus: new Set(), // 🟢 NEW: Collects nexus triggers from projects
        };
      }
      const entry = map[abbr];
      entry.exposure += p.exposure || 0;
      if(!entry.projects.includes(p.client)) entry.projects.push(p.client);
      entry.taxTypes.add(p.tax || "");
      entry.statuses.add(p.status || "");
      
      // 🟢 NEW: Pull the Nexus Focus directly from the project
      if (p.nexus && p.nexus !== "TBD") {
        entry.projectNexus.add(p.nexus);
      }

      const RISK_RANK = { Critical: 4, High: 3, Medium: 2, Low: 1 };
      if ((RISK_RANK[p.risk] || 0) > (RISK_RANK[entry.risk] || 0)) entry.risk = p.risk;
      if (p.due && (!entry.dueDate || p.due < entry.dueDate)) entry.dueDate = p.due;
    });
  });
  return Object.values(map).map(e => ({
    ...e,
    taxTypes: [...e.taxTypes].filter(Boolean).join(", "),
    activeProjects: e.projects.length,
    hasEscalated: [...e.statuses].some(s => s === "Escalated" || s === "Under Audit" || s === "Audit Defense"),
    hasPending: [...e.statuses].some(s => s.includes("Waiting") || s.includes("Review") || s === "In Progress"),
    allStatuses: [...e.statuses],
    derivedNexus: e.projectNexus.size > 0 ? Array.from(e.projectNexus).join(", ") : null, // 🟢 NEW: Pass to tracker
  })).sort((a, b) => (b.exposure - a.exposure));
};

const StatesView = ({ states: _dbStates, projects, onEdit, onDelete }) => {
  const derived = useMemo(() => deriveStatesFromProjects(projects), [projects]);
  const dbMap = useMemo(() => {
    const m = {};
    _dbStates.forEach(s => { m[s.state] = s; });
    return m;
  }, [_dbStates]);

const rows = useMemo(() => {
    // 1. Process states that come from active Projects
    const derivedRows = derived.map(d => {
      const dbState = dbMap[d.state];
      return {
        ...d,
        // 🟢 NEW: Prioritize the Project's nexus. If none exists, fallback to State DB, then "—"
        nexus: d.derivedNexus || dbState?.nexus || "—",
        filings: dbState?.filings || "—",
        status: dbState?.status || (
          d.hasEscalated ? "Under Audit" :
          d.hasPending ? "In Progress" :
          d.allStatuses?.includes("Planning") ? "Planning" :
          d.allStatuses?.includes("Filed") ? "Filed" :
          d.allStatuses?.includes("Closed") ? "Closed" : "Active"
        ),
        // Allow manual DB edits to override the derived totals
        exposure: (dbState?.exposure && dbState.exposure > 0) ? dbState.exposure : d.exposure,
        risk: dbState?.risk && dbState.risk !== "Medium" ? dbState.risk : d.risk, 
        dbId: dbState?.id,
      };
    });

    // 2. Process states manually added to the DB that don't have any projects yet
    const derivedKeys = new Set(derived.map(d => d.state));
    const standaloneRows = _dbStates
      .filter(s => !derivedKeys.has(s.state))
      .map(s => ({
        state: s.state,
        exposure: s.exposure || 0,
        risk: s.risk || "Low",
        projects: [],
        taxTypes: "—",
        activeProjects: 0,
        dueDate: null,
        nexus: s.nexus || "—",
        filings: s.filings || "—",
        status: s.status || "Registered",
        dbId: s.id,
      }));

    // Combine both lists and sort by highest exposure
    return [...derivedRows, ...standaloneRows].sort((a, b) => (b.exposure || 0) - (a.exposure || 0));
  }, [derived, dbMap, _dbStates]);

  const totalExp = useMemo(() => rows.reduce((a, r) => a + (r.exposure || 0), 0), [rows]);
  const underAudit = useMemo(() => rows.filter(r => r.hasEscalated).length, [rows]);
  const highRisk = useMemo(() => rows.filter(r => r.risk === "Critical" || r.risk === "High").length, [rows]);

  const [search, setSearch] = useState("");
  const visible = useMemo(() =>
    rows.filter(r => !search || r.state.toLowerCase().includes(search.toLowerCase())
      || r.taxTypes.toLowerCase().includes(search.toLowerCase())
      || r.projects.some(p => p.toLowerCase().includes(search.toLowerCase()))
    ), [rows, search]);

  return (
    <div style={{ padding:"28px 32px",overflowY:"auto",height:"100%",
      display:"flex",flexDirection:"column",gap:20 }}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
        <SectionHeader title="State Tracker" sub="Auto-derived from Projects · Nexus footprint · Audit exposure" />
        <div style={{ display:"flex",alignItems:"center",gap:8 }}>
          <span style={{ fontSize:11,color:T.text3 }}>🔄 Live from Projects</span>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Filter by state, tax, client…"
            style={{ padding:"6px 12px",width:220,borderRadius:8,fontSize:12 }} />
        </div>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:4 }}>
        <MetricCard label="States Active" value={rows.length} sub="across portfolio" color={T.blue} icon="◉" delay={0} />
        <MetricCard label="Under Audit" value={underAudit} sub="escalated states" color={T.crimson} icon="⚑" delay={50} />
        <MetricCard label="High Risk" value={highRisk} sub="need attention" color={T.amber} icon="⚠" delay={100} />
        <MetricCard label="Total Exposure" value={totalExp} sub="across all states" color={T.emerald} icon="⬡" delay={150} />
      </div>
      <div className="card" style={{ overflow:"hidden" }}>
        <table style={{ width:"100%",borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ borderBottom:`1px solid ${T.border}`,background:T.bg3 }}>
              {["State","Nexus","Status","Exposure","Tax Type","Projects","Risk","Earliest Due","Actions"].map(h=>(
                <th key={h} style={{ padding:"10px 14px",textAlign:"left",fontSize:10,
                  fontWeight:700,color:T.text3,letterSpacing:"0.06em",textTransform:"uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr><td colSpan={9} style={{ padding:"32px",textAlign:"center",color:T.text3,fontSize:13 }}>
                No states yet — add projects with states to see them here
              </td></tr>
            )}
            {visible.map((s,i)=>(
              <tr key={s.state} className="fadeUp"
                style={{ borderBottom:`1px solid ${T.border}`,animationDelay:`${i*30}ms`,
                  transition:"background 0.15s",cursor:"pointer" }}
                onMouseEnter={e=>e.currentTarget.style.background=T.bg3}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <td style={{ padding:"12px 14px" }}>
                  <div style={{ width:34,height:22,borderRadius:4,background:T.bg4,
                    border:`1px solid ${T.border}`,display:"flex",alignItems:"center",
                    justifyContent:"center",fontSize:11,fontWeight:800,
                    color:T.text0,letterSpacing:"0.04em" }}>{s.state}</div>
                </td>
                <td style={{ padding:"12px 14px" }}>
                  <Badge label={s.nexus} color={s.nexus.includes("+")?T.violet:T.blue} />
                </td>
                <td style={{ padding:"12px 14px" }}>
                  <span style={{ fontSize:11,color:statusColor(s.status),fontWeight:600 }}>● {s.status}</span>
                </td>
                <td style={{ padding:"12px 14px" }}>
                  <span style={{ fontSize:13,fontWeight:700,color:T.text0 }}>{fmt$(s.exposure||0)}</span>
                </td>
                <td style={{ padding:"12px 14px",maxWidth:160 }}>
                  <span style={{ fontSize:11,color:T.text2 }}>{s.taxTypes || "—"}</span>
                </td>
                <td style={{ padding:"12px 14px" }}>
                  <div style={{ display:"flex",flexWrap:"wrap",gap:3 }}>
                    {s.projects.slice(0,2).map(p=>(
                      <span key={p} style={{ fontSize:10,color:T.text3,background:T.bg4,
                        padding:"1px 5px",borderRadius:4,border:`1px solid ${T.border}` }}>
                        {p.split(" ")[0]}
                      </span>
                    ))}
                    {s.projects.length > 2 && (
                      <span style={{ fontSize:10,color:T.blue }}>+{s.projects.length-2}</span>
                    )}
                  </div>
                </td>
                <td style={{ padding:"12px 14px" }}>
                  <Badge label={s.risk} color={riskColor(s.risk)} />
                </td>
                <td style={{ padding:"12px 14px" }}>
                  <span style={{ fontSize:11,fontWeight:600,color:daysColor(s.dueDate) }}>
                    {s.dueDate ? daysLabel(s.dueDate) : "—"}
                  </span>
                </td>
                <td style={{ padding:"12px 14px" }}>
                  <div style={{ display:"flex",gap:6 }}>
                    {s.dbId ? (
                      <>
                        <button className="btn-ghost"
                          style={{ fontSize:10,padding:"3px 8px",borderRadius:6 }}
                          onClick={()=>onEdit(dbMap[s.state])}>Edit</button>
                        <button className="btn-ghost"
                          style={{ fontSize:10,padding:"3px 8px",borderRadius:6,
                            borderColor:`${T.crimson}40`,color:T.crimson }}
                          onClick={()=>onDelete(s.dbId)}>✕</button>
                      </>
                    ) : (
                      <span style={{ fontSize:10,color:T.text3 }}>Auto</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── AUDITS VIEW ──────────────────────────────────────────────────────────────
const AUDIT_PROJECT_TYPES = ["Audit Defense"];
const AUDIT_PROJECT_STATUSES = ["Escalated", "Under Audit"];
const deriveAuditsFromProjects = (projects) =>
  projects
    .filter(p =>
      AUDIT_PROJECT_TYPES.includes(p.type) ||
      AUDIT_PROJECT_STATUSES.includes(p.status)
    )
    .flatMap(p =>
      (p.states && p.states.length > 0 ? p.states : ["—"]).map(st => ({
        _derived: true,
        _projectId: p.id,
        client: p.client,
        state: st,
        agency: st !== "—" ? `${st} Dept of Revenue` : "Unknown Agency",
        period: p.period || "—",
        type: p.type === "Audit Defense" ? "Audit Defense" : "Full Audit",
        exposure: Math.round((p.exposure || 0) / Math.max(1, (p.states || []).length)),
        deadline: p.due || null,
        status: p.status === "Escalated" ? "Active"
                 : p.status === "Responded" ? "Responded"
                 : p.status === "Closed" ? "Closed" : "Active",
        tax: p.tax || "",
        leadStaff: p.leadStaff || "",
        assignedTeam: p.assignedTeam || [],
      }))
    );

const AuditsView = ({ audits, projects, onEdit, onDelete }) => {
  const derived = useMemo(() => deriveAuditsFromProjects(projects), [projects]);
  const dbKeys = useMemo(() => new Set(audits.map(a => `${a.client}|${a.state}`)), [audits]);
  const merged = useMemo(() => [
    ...audits,
    ...derived.filter(d => !dbKeys.has(`${d.client}|${d.state}`)),
  ], [audits, derived, dbKeys]);

  const rows = useMemo(() => merged.map(a => ({
    ...a,
    daysLeft: daysLeft(a.deadline),
  })), [merged]);

  const totalAuditExp = useMemo(()=>rows.reduce((s,a)=>s+(a.exposure||0),0),[rows]);
  const urgent = useMemo(()=>rows.filter(a=>a.daysLeft!==null&&a.daysLeft<10).length,[rows]);
  const responded = useMemo(()=>rows.filter(a=>a.status==="Responded").length,[rows]);

  return (
    <div style={{ padding:"28px 32px",overflowY:"auto",height:"100%",
      display:"flex",flexDirection:"column",gap:20 }}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
        <SectionHeader title="Audit Management" sub="Active audit notices · IDR tracking · Response deadlines · Auto-derived from Projects" />
        <span style={{ fontSize:11,color:T.text3 }}>🔄 Live from Projects</span>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12 }}>
        <MetricCard label="Active Audits" value={rows.length} sub="across states" color={T.crimson} icon="⚑" delay={0} />
        <MetricCard label="Total Audit Exposure" value={totalAuditExp} sub="combined estimate" color={T.amber} icon="⚠" delay={50} />
        <MetricCard label="Urgent Deadlines" value={urgent} sub="due within 10 days" color={T.crimson} icon="⏱" delay={100} />
        <MetricCard label="Responded" value={responded} sub="IDRs submitted" color={T.emerald} icon="✓" delay={150} />
      </div>
      <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
        {rows.length === 0 && (
          <div style={{ textAlign:"center",padding:"60px 0",color:T.text3 }}>
            <div style={{ fontSize:32,marginBottom:12 }}>⚑</div>
            <div>No audits yet — mark a project as Escalated or Audit Defense to see it here</div>
          </div>
        )}
        {rows.map((a,i)=>{
          const dl = a.daysLeft;
          const urgentColor = dl===null?T.emerald:dl<0?T.crimson:dl<10?T.crimson:dl<30?T.amber:T.emerald;
          return (
          <div key={a.id||`${a.client}-${a.state}-${i}`} className="card hover-lift fadeUp"
            style={{ padding:"22px 24px",animationDelay:`${i*60}ms`, borderLeft:`4px solid ${urgentColor}` }}>
            <div style={{ display:"flex",alignItems:"flex-start", justifyContent:"space-between",marginBottom:14 }}>
              <div>
                <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:4 }}>
                  <span style={{ fontSize:15,fontWeight:700,color:T.text0 }}>{a.client}</span>
                  <Badge label={a.type} color={T.blue} />
                  <Badge label={a.status} color={a.status==="Active"?T.crimson:a.status==="Responded"?T.emerald:T.amber} />
                  {a._derived && <span style={{ fontSize:10,color:T.text3,background:T.bg4, padding:"2px 6px",borderRadius:4,border:`1px solid ${T.border}` }}>auto</span>}
                </div>
                <div style={{ fontSize:12,color:T.text3 }}>
                  {a.agency} · Audit Period: {a.period} {a.leadStaff && <span> · Lead: {a.leadStaff}</span>}
                </div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:20,fontWeight:700,color:T.text0 }}>{fmt$(a.exposure||0)}</div>
                <div style={{ fontSize:11,color:T.text3 }}>exposure estimate</div>
              </div>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16, padding:"14px 16px",background:T.bg3,borderRadius:10,marginBottom:14 }}>
              {[
                { label:"State", value: a.state },
                { label:"Deadline", value: a.deadline || "—" },
                { label:"Days Remaining", value:(
                  <span style={{ color:urgentColor,fontWeight:700 }}>
                    {dl===null?"—":dl<0?`${Math.abs(dl)}d overdue`:dl===0?"Today":`${dl} days`}
                  </span>
                )},
                { label:"Status", value:( <span style={{ color:statusColor(a.status) }}>● {a.status}</span> )},
              ].map(({ label, value })=>(
                <div key={label}>
                  <div style={{ fontSize:10,color:T.text3,fontWeight:700,letterSpacing:"0.06em", textTransform:"uppercase",marginBottom:4 }}>{label}</div>
                  <div style={{ fontSize:13,fontWeight:600,color:T.text0 }}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{ display:"flex",gap:8 }}>
              <button className="btn-primary" style={{ fontSize:12,padding:"8px 16px",borderRadius:8 }}>View IDR Log</button>
              <button className="btn-ghost" style={{ fontSize:12,padding:"8px 16px",borderRadius:8 }}>Upload Document</button>
              <button className="btn-ghost" style={{ fontSize:12,padding:"8px 16px",borderRadius:8 }}>Draft Response</button>
              {!a._derived && <button className="btn-ghost" style={{ fontSize:12,padding:"8px 16px",borderRadius:8 }} onClick={()=>onEdit(a)}>Edit</button>}
              {!a._derived && (
                <button className="btn-ghost" style={{ fontSize:12,padding:"8px 16px",borderRadius:8, borderColor:`${T.crimson}40`,color:T.crimson, marginLeft:"auto" }} onClick={()=>onDelete(a.id)}>✕ Remove</button>
              )}
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── REFUNDS VIEW ─────────────────────────────────────────────────────────────
const deriveRefundsFromProjects = (projects) =>
  projects
    .filter(p => (p.refund || 0) > 0)
    .flatMap(p =>
      (p.states && p.states.length > 0 ? p.states : ["—"]).map((st, si) => ({
        _derived: true,
        _projectId: p.id,
        client: p.client,
        state: st,
        type: p.tax || "Sales & Use Tax",
        estimated: si === 0 ? (p.refund || 0) : 0,
        filed: 0,
        recovered: 0,
        pct: 0,
        status: p.status === "Filed" ? "Filed — Pending Approval"
                 : p.status === "Closed" ? "Fully Recovered"
                 : p.status === "Responded" ? "Partial Recovery"
                 : p.status === "In Progress" ? "In Preparation"
                 : p.status === "Review Phase" ? "Under Review" : "Identified — Not Yet Filed",
        leadStaff: p.leadStaff || "",
        due: p.due || null,
      }))
    );

const RefundsView = ({ refunds, projects, onNavigate, onEdit, onDelete }) => {
  const derived = useMemo(() => deriveRefundsFromProjects(projects), [projects]);
  
  // 1. Create a map of database edits
  const dbMap = useMemo(() => {
    const m = {};
    refunds.forEach(r => { m[`${r.client}|${r.state}`] = r; });
    return m;
  }, [refunds]);

  // 2. Strictly use live project estimates, but merge in your manual progress edits
  const merged = useMemo(() => {
    const derivedRows = derived.map(d => {
      const dbRef = dbMap[`${d.client}|${d.state}`];
      return {
        ...d,
        filed: dbRef?.filed || 0,
        recovered: dbRef?.recovered || 0,
        pct: dbRef?.pct || 0,
        status: dbRef?.status || d.status,
        id: dbRef?.id, // Keeps the link to the DB so edits save correctly
        _derived: true 
      };
    });

    // We no longer allow standalone manual rows. All refunds MUST come from Projects.
    return derivedRows.sort((a, b) => (b.estimated || 0) - (a.estimated || 0));
  }, [derived, dbMap]);



  const totalEst = useMemo(()=>merged.reduce((a,r)=>a+(r.estimated||0),0),[merged]);
  const totalFiled = useMemo(()=>merged.reduce((a,r)=>a+(r.filed||0),0),[merged]);
  const totalRec = useMemo(()=>merged.reduce((a,r)=>a+(r.recovered||0),0),[merged]);

  return (
    <div style={{ padding:"28px 32px",overflowY:"auto",height:"100%", display:"flex",flexDirection:"column",gap:20 }}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
        <SectionHeader title="Refund Tracker" sub="Recovery pipeline · Auto-derived from Projects · Filing status · Estimated vs. actual savings" />
        <span style={{ fontSize:11,color:T.text3 }}>🔄 Live from Projects</span>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12 }}>
        <MetricCard label="Refund Pipeline" value={totalEst} sub="total estimated" color={T.emerald} icon="◆" delay={0} />
        <MetricCard label="Filed Claims" value={totalFiled} sub="submitted to states" color={T.blue} icon="◈" delay={50} />
        <MetricCard label="Recovered" value={totalRec} sub="cash in hand" color={T.cyan} icon="✓" delay={100} />
        <MetricCard label="Recovery Rate" value={totalFiled>0?`${Math.round((totalRec/totalFiled)*100)}%`:"0%"} sub="overall effectiveness" color={T.violet} icon="⬡" delay={150} />
      </div>
      <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
        {merged.length === 0 && (
          <div style={{ textAlign:"center",padding:"60px 0",color:T.text3 }}>
            <div style={{ fontSize:32,marginBottom:12 }}>◆</div>
            <div>No refunds yet — add a project with a Refund amount to see it here</div>
          </div>
        )}
        {merged.map((r,i)=>(
          <div key={r.id||`${r.client}-${r.state}-${i}`} className="card hover-lift fadeUp" style={{ padding:"22px 24px",animationDelay:`${i*60}ms` }}>
            <div style={{ display:"flex",alignItems:"flex-start", justifyContent:"space-between",marginBottom:16 }}>
              <div>
                <div style={{ display:"flex",gap:8,alignItems:"center",marginBottom:4 }}>
                  <span style={{ fontSize:14,fontWeight:700,color:T.text0 }}>{r.client}</span>
                  <Badge label={r.state} color={T.blue} />
                  <Badge label={r.type} color={T.violet} />
                  {r._derived && <span style={{ fontSize:10,color:T.text3,background:T.bg4, padding:"2px 6px",borderRadius:4,border:`1px solid ${T.border}` }}>auto</span>}
                </div>
                <div style={{ fontSize:12,color:T.text3 }}>
                  Status: <span style={{ color:r.pct===100?T.emerald:r.pct>0?T.amber:T.blue,fontWeight:600 }}>{r.status}</span>
                  {r.leadStaff && <span style={{ color:T.text3 }}> · Lead: {r.leadStaff}</span>}
                  {r.due && <span style={{ color:daysColor(r.due),marginLeft:8,fontWeight:600 }}>{daysLabel(r.due)}</span>}
                </div>
              </div>
              <div style={{ display:"flex",gap:28,textAlign:"right" }}>
                {[
                  { label:"Estimated", value:fmt$(r.estimated||0), color:T.text0 },
                  { label:"Filed", value:fmt$(r.filed||0), color:T.blue },
                  { label:"Recovered", value:fmt$(r.recovered||0), color:T.emerald },
                ].map(({ label,value,color })=>(
                  <div key={label}>
                    <div style={{ fontSize:10,color:T.text3,letterSpacing:"0.06em", textTransform:"uppercase",marginBottom:2 }}>{label}</div>
                    <div style={{ fontSize:16,fontWeight:700,color }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ marginBottom:8 }}>
              <div style={{ display:"flex",justifyContent:"space-between",marginBottom:6 }}>
                <span style={{ fontSize:12,color:T.text3 }}>Recovery Progress</span>
                <span style={{ fontSize:12,fontWeight:700, color:r.pct===100?T.emerald:r.pct>0?T.amber:T.blue }}>{r.pct||0}%</span>
              </div>
              <div className="progress-bar" style={{ height:8 }}>
                <div className="progress-fill" style={{ width:`${r.pct||0}%`, background:r.pct===100 ?`linear-gradient(90deg,${T.emerald},${T.cyan})` :r.pct>0 ?`linear-gradient(90deg,${T.amber},${T.blue})` :T.blue }} />
              </div>
            </div>
            <div style={{ display:"flex",gap:8,marginTop:14 }}>
              {/* 🟢 FIXED: The Edit button now shows for ALL refunds so you can log progress */}
              <button className="btn-ghost" style={{ fontSize:12,padding:"7px 14px",borderRadius:8 }} onClick={()=>onNavigate("projects")}>✏ Edit Progress</button>
              
              <button className="btn-ghost" style={{ fontSize:12,padding:"7px 14px",borderRadius:8 }}>Upload Correspondence</button>
              
              {/* We still hide the Delete button for auto-projects. You must delete the refund from the Project card instead. */}
              {!r._derived && (
                <button className="btn-ghost" style={{ fontSize:12,padding:"7px 14px",borderRadius:8, borderColor:`${T.crimson}40`,color:T.crimson }} onClick={()=>onDelete(r.id)}>✕</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
// ─── TEAM MODAL ──────────────────────────────────────────────────────────────
const TEAM_DEFAULTS = { name:"", role:"Staff", avatar:"", color:TEAM_COLORS[0], projects:0, utilization:0, expertise:[], status:"active" };
const TeamModal = ({ initial, onClose }) => {
  const [form, setForm] = useState({ ...TEAM_DEFAULTS, ...initial, expertise: initial?.expertise || [] });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(p=>({...p,[k]:v}));

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const initials = form.name.split(" ").map(w=>w[0]||"").join("").toUpperCase().slice(0,2);
    const data = {
      ...form,
      avatar: initials,
      projects: Number(form.projects)||0,
      utilization:Number(form.utilization)||0,
      expertise: typeof form.expertise==="string"
        ? form.expertise.split(",").map(s=>s.trim()).filter(Boolean) : form.expertise,
    };
    if (form.id) await updateDocById(COLS.team, form.id, data);
    else await createDoc(COLS.team, data);
    setSaving(false);
    onClose();
  };

  return (
    <Modal title={form.id?"Edit Team Member":"Add Team Member"} onClose={onClose} onSave={save} saving={saving}>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14 }}>
        <Field label="Full Name">
          <input style={inputStyle()} value={form.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. Jane Smith" />
        </Field>
        <Field label="Position / Role">
          <select style={inputStyle()} value={form.role} onChange={e=>set("role",e.target.value)}>
            {TEAM_POSITIONS.map(p=><option key={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Utilization (%)">
          <input style={inputStyle()} type="number" min="0" max="100" value={form.utilization} onChange={e=>set("utilization",e.target.value)} />
        </Field>
        <Field label="Active Projects">
          <input style={inputStyle()} type="number" min="0" value={form.projects} onChange={e=>set("projects",e.target.value)} />
        </Field>
        <Field label="Status">
          <select style={inputStyle()} value={form.status} onChange={e=>set("status",e.target.value)}>
            <option value="active">Active</option>
            <option value="at-risk">Overloaded / At-Risk</option>
            <option value="inactive">Inactive</option>
          </select>
        </Field>
        <Field label="Avatar Color">
          <div style={{ display:"flex",gap:6,flexWrap:"wrap",paddingTop:4 }}>
            {TEAM_COLORS.map(c=>(
              <button key={c} type="button" onClick={()=>set("color",c)} style={{ width:26,height:26,borderRadius:"50%",background:c,border:`3px solid ${form.color===c?"#fff":"transparent"}`,cursor:"pointer"} } />
            ))}
          </div>
        </Field>
      </div>
      <Field label="State Expertise (comma-separated)">
        <input style={inputStyle()} value={Array.isArray(form.expertise)?form.expertise.join(", "):form.expertise} onChange={e=>set("expertise",e.target.value)} placeholder="TX, CA, NY" />
      </Field>
    </Modal>
  );
};

const TeamView = ({ team, projects, onAdd, onEdit, onDelete }) => {
  const memberStats = useMemo(() => {
    const map = {};
    team.forEach(m => { map[m.name] = { projects: 0, states: new Set() }; });
    projects.forEach(p => {
      const members = [p.leadStaff, ...(p.assignedTeam||[])].filter(Boolean);
      members.forEach(name => {
        if (!map[name]) map[name] = { projects: 0, states: new Set() };
        if (p.status !== "Closed" && p.status !== "Filed") map[name].projects += 1;
        (p.states||[]).forEach(s => map[name].states.add(s));
      });
    });
    return map;
  }, [team, projects]);
  return (
  <div style={{ padding:"28px 32px",overflowY:"auto",height:"100%", display:"flex",flexDirection:"column",gap:20 }}>
    <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
      <SectionHeader title="Team & Workload" sub="Utilization · Assignment matrix · Capacity planning" />
      <button className="btn-primary" onClick={onAdd} style={{ padding:"8px 16px",borderRadius:8,fontSize:12,display:"flex",alignItems:"center",gap:6 }}>⊕ Add Member</button>
    </div>
    <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14 }}>
      {team.map((m,i)=>(
        <div key={m.id||i} className="card hover-lift fadeUp" style={{ padding:"20px",animationDelay:`${i*50}ms`, borderTop:`2px solid ${(m.color||T.blue)}33` }}>
          <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:16 }}>
            <Avatar initials={m.avatar||"?"} color={m.color||T.blue} size={44} />
            <div>
              <div style={{ fontSize:14,fontWeight:700,color:T.text0 }}>{m.name}</div>
              <div style={{ fontSize:11,color:T.text3 }}>{m.role}</div>
              <div style={{ marginTop:4 }}>
                <span className="tag" style={{ background:m.status==="at-risk"?`${T.crimson}18`:m.status==="inactive"?`${T.text3}18`:`${T.emerald}18`, color:m.status==="at-risk"?T.crimson:m.status==="inactive"?T.text3:T.emerald, border:`1px solid ${m.status==="at-risk"?T.crimson:m.status==="inactive"?T.text3:T.emerald}30`, fontSize:10 }}>
                  {m.status==="at-risk"?"⚠ Overloaded":m.status==="inactive"?"◌ Inactive":"● Active"}
                </span>
              </div>
            </div>
            <div style={{ marginLeft:"auto",textAlign:"right" }}>
              <div style={{ fontSize:22,fontWeight:700, color:(m.utilization||0)>90?T.crimson:(m.utilization||0)>75?T.amber:T.emerald }}>{m.utilization}%</div>
              <div style={{ fontSize:10,color:T.text3 }}>utilization</div>
            </div>
          </div>
          <div className="progress-bar" style={{ marginBottom:14,height:6 }}>
            <div className="progress-fill" style={{ width:`${m.utilization||0}%`, background:(m.utilization||0)>90?T.crimson:(m.utilization||0)>75?T.amber:T.emerald }} />
          </div>
          <div style={{ fontSize:12,color:T.text2,marginBottom:12 }}>
            {(memberStats[m.name]?.projects ?? m.projects)} active project{((memberStats[m.name]?.projects ?? m.projects)!==1?"s":"")}
            {(memberStats[m.name]?.states?.size||0)>0 && (
              <span style={{ color:T.text3,marginLeft:6 }}>
                · {[...(memberStats[m.name]?.states||[])].slice(0,3).join(", ")}
                {(memberStats[m.name]?.states?.size||0)>3 ? ` +${(memberStats[m.name]?.states?.size||0)-3}` : ""}
              </span>
            )}
          </div>
          <div>
            <div style={{ fontSize:10,color:T.text3,marginBottom:6, textTransform:"uppercase",letterSpacing:"0.06em" }}>State Expertise</div>
            <div style={{ display:"flex",gap:4,flexWrap:"wrap" }}>
              {(m.expertise||[]).map(s=>(
                <span key={s} className="tag" style={{ background:T.bg4,color:T.text2,border:`1px solid ${T.border}`,fontSize:10 }}>{s}</span>
              ))}
            </div>
          </div>
          <div style={{ marginTop:14,paddingTop:14,borderTop:`1px solid ${T.border}`,display:"flex",gap:8 }}>
            <button className="btn-ghost" style={{ flex:1,fontSize:11,padding:"6px",borderRadius:7 }} onClick={()=>onEdit(m)}>✎ Edit</button>
            <button className="btn-ghost" style={{ flex:1,fontSize:11,padding:"6px",borderRadius:7, borderColor:`${T.crimson}40`,color:T.crimson }} onClick={()=>onDelete(m.id)}>✕ Remove</button>
          </div>
        </div>
      ))}
    </div>
  </div>
  );
};

// ─── RESEARCH VIEW ────────────────────────────────────────────────────────────
const ResearchView = () => {
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchQ, setSearchQ] = useState("");
  const FILTER_OPTIONS = ["All","Official Ruling","Internal Memo","Taxability Matrix","Research Note","State Guidance"];
  const visible = useMemo(()=>
    RESEARCH_ARTICLES.filter(a=>{
      const matchType = activeFilter==="All"||a.type===activeFilter;
      const q = searchQ.toLowerCase();
      return matchType && (!q || a.title.toLowerCase().includes(q) || a.state.toLowerCase().includes(q) || a.tags.some(t=>t.toLowerCase().includes(q)));
    }), [activeFilter,searchQ]);
  return (
    <div style={{ padding:"28px 32px",overflowY:"auto",height:"100%", display:"flex",flexDirection:"column",gap:20 }}>
      <SectionHeader title="Research Hub" sub="Rulings · Internal memos · Taxability matrices · State guidance" />
      <div style={{ display:"flex",gap:10,flexWrap:"wrap",alignItems:"center" }}>
        <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Search research, rulings, states..." style={{ padding:"8px 14px",width:300,height:36 }} />
        {FILTER_OPTIONS.map(f=>(
          <button key={f} onClick={()=>setActiveFilter(f)} style={{ fontSize:12,padding:"6px 12px",borderRadius:8, cursor:"pointer",transition:"all 0.15s",fontFamily:"inherit", background:activeFilter===f?T.blue:"transparent", color:activeFilter===f?"#fff":T.text2, border:activeFilter===f?`1px solid ${T.blue}`:`1px solid ${T.border}` }}>{f}</button>
        ))}
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12 }}>
        {visible.map((a,i)=>(
          <div key={i} className="card hover-lift fadeUp" style={{ padding:"18px 20px",cursor:"pointer",animationDelay:`${i*40}ms`, borderLeft:`3px solid ${RESEARCH_TYPE_COLOR[a.type]||T.blue}` }}>
            <div style={{ display:"flex",justifyContent:"space-between", alignItems:"flex-start",marginBottom:8 }}>
              <span style={{ fontSize:13,fontWeight:600,color:T.text0, lineHeight:1.4,flex:1,paddingRight:12 }}>{a.title}</span>
              <span className="tag" style={{ background:`${RESEARCH_TYPE_COLOR[a.type]||T.blue}15`, color:RESEARCH_TYPE_COLOR[a.type]||T.blue, border:`1px solid ${RESEARCH_TYPE_COLOR[a.type]||T.blue}30`, flexShrink:0,fontSize:10 }}>{a.type}</span>
            </div>
            <div style={{ fontSize:11,color:T.text3,marginBottom:10 }}>{a.state} · Updated {a.date}</div>
            <div style={{ display:"flex",gap:4,flexWrap:"wrap" }}>
              {a.tags.map(tag=>(
                <span key={tag} className="tag" style={{ background:T.bg4,color:T.text2,border:`1px solid ${T.border}`,fontSize:10 }}>{tag}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── REPORTS VIEW ─────────────────────────────────────────────────────────────
const ReportsView = ({ projects, team, audits, refunds }) => {
  
  const handleExport = (title, format) => {
    // 1. Only process CSVs for now
    if (format !== "CSV") {
      alert(`The ${format} format requires a backend plugin. Please use the CSV button for now!`);
      return;
    }

    // 2. Gather the correct data based on which report was clicked
    let data = [];
    if (title === "State Exposure Summary") {
      data = (projects || []).map(p => ({ Client: p.client, States: (p.states||[]).join(", "), Exposure: p.exposure || 0, Status: p.status }));
    } else if (title === "Team Utilization Report") {
      data = (team || []).map(t => ({ Name: t.name, Role: t.role, Utilization: t.utilization + "%", ActiveProjects: t.projects }));
    } else if (title === "Refund Recovery Dashboard") {
      data = (refunds || []).map(r => ({ Client: r.client, State: r.state, Estimated: r.estimated, Recovered: r.recovered, Status: r.status }));
    } else if (title === "Audit Resolution Metrics") {
      data = (audits || []).map(a => ({ Client: a.client, State: a.state, Deadline: a.deadline, Status: a.status, Exposure: a.exposure }));
    } else {
      data = [{ Note: "Report data structure not defined yet." }];
    }

    if (data.length === 0) {
      alert("No data available to export for this report.");
      return;
    }

    // 3. Convert the JSON data into a CSV string format
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(","), // Header row
      ...data.map(row => headers.map(fieldName => `"${String(row[fieldName] || "").replace(/"/g, '""')}"`).join(",")) // Data rows
    ];
    const csvString = csvRows.join("\n");

    // 4. Create a hidden file link and trigger the browser download
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${title.replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link); // Clean up
  };

  return (
    <div style={{ padding:"28px 32px",overflowY:"auto",height:"100%", display:"flex",flexDirection:"column",gap:20 }}>
      <SectionHeader title="Executive Reports" sub="Export-ready analytics · PDF · Excel · CSV" />
      <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14 }}>
        {REPORT_LIST.map((r,i)=>(
          <div key={i} className="card hover-lift fadeUp" style={{ padding:"24px",cursor:"pointer", animationDelay:`${i*50}ms`,borderTop:`2px solid ${r.color}33` }}>
            <div style={{ fontSize:28,marginBottom:14,opacity:0.85 }}>{r.icon}</div>
            <div style={{ fontSize:14,fontWeight:700,color:T.text0,marginBottom:6 }}>{r.title}</div>
            <div style={{ fontSize:12,color:T.text3,marginBottom:18,lineHeight:1.55 }}>{r.desc}</div>
            <div style={{ display:"flex",gap:6 }}>
              {["PDF","Excel","CSV"].map(fmt=>(
                <button 
                  key={fmt} 
                  onClick={(e) => { e.stopPropagation(); handleExport(r.title, fmt); }} 
                  className="btn-ghost" 
                  style={{ fontSize:11,padding:"5px 10px",borderRadius:6,flex:1 }}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── PROFILE MODAL ───────────────────────────────────────────────────────────
const ProfileModal = ({ initial, onClose, onSave }) => {
  const [form, setForm] = useState(initial);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const save = () => {
    if (!form.name.trim()) return;
    // Auto-generate initials from the new name (e.g., "John Doe" -> "JD")
    const initials = form.name.split(" ").map(w => w[0] || "").join("").toUpperCase().slice(0, 2);
    onSave({ ...form, initials });
    onClose();
  };

  return (
    <Modal title="Edit Your Profile" onClose={onClose} onSave={save} saving={false}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="Full Name">
          <input style={inputStyle()} value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. John Doe" />
        </Field>
        <Field label="Role / Title">
          <select style={inputStyle()} value={form.role} onChange={e => set("role", e.target.value)}>
            {TEAM_POSITIONS.map(p => <option key={p}>{p}</option>)}
          </select>
        </Field>
      </div>
    </Modal>
  );
};

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [authUser, setAuthUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [team, setTeam] = useState([]);
  const [states, setStates] = useState([]);
  const [audits, setAudits] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [seeded, setSeeded] = useState(false);
  const [activeView, setActiveView] = useState("dashboard");
  const [cmdOpen, setCmdOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [projectModal, setProjectModal] = useState(null);
  const [taskModal, setTaskModal] = useState(null);
  const [auditModal,   setAuditModal] = useState(null);
  const [stateModal,   setStateModal] = useState(null);
  const [refundModal, setRefundModal] = useState(null);
  const [teamModal, setTeamModal] = useState(null);
  const [userProfile, setUserProfile] = useState(() => {
    const saved = localStorage.getItem("taxops_profile");
    return saved ? JSON.parse(saved) : { name: "Your Account", role: "Senior Manager", initials: "YA" };
  });
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthChecked(true);
      if (!user) { setSeeded(false); return; }
(async () => {
  try {
    await Promise.all([
      seedCollection(COLS.projects, SEED_PROJECTS),
      seedCollection(COLS.tasks, SEED_TASKS),
      seedCollection(COLS.team, SEED_TEAM),
    ]);
  } catch (error) {
    console.error("🔥 Failed to seed Firebase data:", error);
  } finally {
    // This ensures the app always loads past "Initializing...", 
    // even if the database write failed.
    setSeeded(true); 
  }
})();
    });
    return () => unsubAuth();
  }, []);

  useEffect(()=>{
    if(!seeded) return;
    const unsubs = [
      subscribe(COLS.projects, setProjects),
      subscribe(COLS.tasks, setTasks),
      subscribe(COLS.team, setTeam),
      subscribe(COLS.states, setStates),
      subscribe(COLS.audits, setAudits),
      subscribe(COLS.refunds, setRefunds),
    ];
    return ()=>unsubs.forEach(u=>u());
  },[seeded]);

  const navigate = useCallback((view)=>{ setActiveView(view); setCmdOpen(false); },[]);
  useEffect(()=>{
    const handler=(e)=>{
      if((e.metaKey||e.ctrlKey)&&e.key==="k"){ e.preventDefault(); setCmdOpen(o=>!o); }
    };
    window.addEventListener("keydown",handler);
    return ()=>window.removeEventListener("keydown",handler);
  },[]);

  const deleteProject = useCallback((id)=>{ if(window.confirm("Delete project?")) deleteDocById(COLS.projects,id); },[]);
  const deleteTask = useCallback((id)=>{ if(window.confirm("Delete task?")) deleteDocById(COLS.tasks,id); },[]);
  const deleteState = useCallback((id)=>{ if(window.confirm("Delete state?")) deleteDocById(COLS.states,id); },[]);
  const deleteAudit = useCallback((id)=>{ if(window.confirm("Delete audit?")) deleteDocById(COLS.audits,id); },[]);
  const deleteRefund = useCallback((id)=>{ if(window.confirm("Delete refund?")) deleteDocById(COLS.refunds,id); },[]);
  const deleteTeam = useCallback((id)=>{ if(window.confirm("Remove member?")) deleteDocById(COLS.team,id); },[]);

  const handleNew = useCallback(()=>{
    const map = { projects: ()=>setProjectModal({}), tasks: ()=>setTaskModal({}), states: ()=>setStateModal({}), audits: ()=>setAuditModal({}), refunds: ()=>setRefundModal({}), team: ()=>setTeamModal({}) };
    (map[activeView]??map.projects)();
  },[activeView]);

  if (!authChecked) return <><GlobalStyles /><div style={{ height:"100vh",background:T.bg0 }} /></>;
  if (!authUser) return <><GlobalStyles /><AuthScreen /></>;
  if (!seeded) return <><GlobalStyles /><div style={{ height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:T.bg0,color:T.text3 }}>Initializing…</div></>;

  return (
    <>
      <GlobalStyles />
      {profileModalOpen && <ProfileModal initial={userProfile} onClose={()=>setProfileModalOpen(false)} onSave={setUserProfile} />}
      {projectModal !== null && <ProjectModal initial={projectModal} teamMembers={team} onClose={()=>setProjectModal(null)} />}
      {taskModal !== null && <TaskModal initial={taskModal} projects={projects} teamMembers={team} onClose={()=>setTaskModal(null)} />}
      {auditModal !== null && <AuditModal initial={auditModal} projects={projects} onClose={()=>setAuditModal(null)} />}
      {stateModal !== null && <StateModal initial={stateModal} onClose={()=>setStateModal(null)} />}
      {refundModal !== null && <RefundModal initial={refundModal} projects={projects} onClose={()=>setRefundModal(null)} />}
      {teamModal !== null && <TeamModal initial={teamModal} onClose={()=>setTeamModal(null)} />}
      <CommandPalette open={cmdOpen} onClose={()=>setCmdOpen(false)} onNavigate={navigate} />
      <div style={{ display:"flex",height:"100vh",position:"relative",zIndex:1 }}>
        <Sidebar active={{id: activeView, profile: userProfile}} onNav={navigate} collapsed={sidebarCollapsed} onToggle={()=>setSidebarCollapsed(c=>!c)} />
        <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:T.bg0 }}>
          <TopBar onCommand={()=>setCmdOpen(true)} activeView={activeView} onSignOut={()=>signOut(auth)} profile={userProfile} onEditProfile={() => setProfileModalOpen(true)} />
          <main style={{ flex:1,overflow:"hidden" }}>
            {activeView === "dashboard" && <DashboardView onNavigate={navigate} projects={projects} audits={audits} team={team} />}
            {activeView === "projects" && <ProjectsView projects={projects} team={team} onEdit={setProjectModal} onDelete={deleteProject} />}
            {activeView === "tasks" && <TasksView tasks={tasks} projects={projects} team={team} onEdit={setTaskModal} onDelete={deleteTask} />}
            {activeView === "states" && <StatesView states={states} projects={projects} onEdit={setStateModal} onDelete={deleteState} />}
            {activeView === "audits" && <AuditsView audits={audits} projects={projects} onEdit={setAuditModal} onDelete={deleteAudit} />}
            {activeView === "refunds" && <RefundsView refunds={refunds} projects={projects} onNavigate={navigate} onEdit={setRefundModal} onDelete={deleteRefund} />}
            {activeView === "team" && <TeamView team={team} projects={projects} onAdd={()=>setTeamModal({})} onEdit={setTeamModal} onDelete={deleteTeam} />}
            {activeView === "research" && <ResearchView />}
            {activeView === "reports" && <ReportsView projects={projects} team={team} audits={audits} refunds={refunds} />}
            {activeView === "copilot" && <CopilotView />}
          </main>
        </div>
      </div>
      {/* Hide the Quick Add button if we are on the states OR refunds tab */}
      {(activeView !== "states" && activeView !== "refunds") && (
        <button className="btn-primary" title="Quick Add" onClick={handleNew} style={{ position:"fixed",bottom:28,right:28,width:52,height:52,borderRadius:"50%",fontSize:22,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 8px 32px ${T.blueGlow}`,zIndex:100,border:"none" }}>⊕</button>
      )}
    </>
  );
}
