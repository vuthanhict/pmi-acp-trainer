import { useAppCtx } from "../../context/AppContext.jsx";
import { useIsDesktop } from "../../hooks/useViewport.js";
import { STATUS_LABEL, TIER_LABEL } from "../../i18n/text.js";
import { clamp } from "../../lib/utils.js";

/* ===================== Domain mastery (Domain Ring — chữ ký thị giác) ===================== */
/* 4 domain PMI-ACP có trọng số thi cố định (DOMAIN_WEIGHTS) — vòng tròn mastery không phải  */
/* trang trí, nó thể hiện đúng 4 con số app đã tính, đúng thứ tự trọng số đề thi thật.        */
export const DOMAIN_ABBR = { Mindset: "M", Leadership: "L", Product: "P", Delivery: "D" };
export function domainStatus(mastery) {
  if (mastery === null) return "insufficient_data";
  if (mastery < 0.55) return "critical";
  if (mastery < 0.7) return "needs_work";
  if (mastery < 0.8) return "developing";
  return "ready";
}
export const STATUS_RING_VAR = {
  insufficient_data: "var(--line-strong)",
  critical: "var(--flag)",
  needs_work: "var(--seal)",
  developing: "var(--sky)",
  ready: "var(--sage)",
};
export function DomainRing({ domain, mastery, weight, size = 68, onClick }) {
  const { t, lang } = useAppCtx();
  const stroke = 5;
  const r = size / 2 - stroke;
  const c = 2 * Math.PI * r;
  const pct = mastery === null ? 0 : clamp(mastery);
  const status = domainStatus(mastery);
  const color = STATUS_RING_VAR[status];
  const key = domain === "Mindset" ? "domainMindset" : domain === "Leadership" ? "domainLeadership" : domain === "Product" ? "domainProduct" : "domainDelivery";
  return (
    <button onClick={onClick} className="pmi-focusable flex flex-col items-center gap-1.5" style={{ background: "transparent" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset .4s ease" }}
        />
        <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central" className="pmi-display" style={{ fill: "var(--ink)", fontSize: 16, fontWeight: 600 }}>
          {DOMAIN_ABBR[domain]}
        </text>
      </svg>
      <span className="pmi-mono text-[10px]" style={{ color: "var(--ink-mid)" }}>{mastery === null ? "—" : `${Math.round(pct * 100)}%`}</span>
      <span className="text-[10px] text-center leading-tight" style={{ color: "var(--ink-soft)", maxWidth: size + 8 }}>{t(key)}</span>
    </button>
  );
}

/* ===================== Icons (inline SVG, no deps) ===================== */
export function Icon({ name, size = 18, className = "" }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", className };
  const paths = {
    home: <path d="M3 11l9-8 9 8M5 10v10h14V10" />,
    book: <path d="M4 4h11a3 3 0 013 3v13H7a3 3 0 01-3-3V4z" />,
    target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
    database: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5" /><path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" /></>,
    play: <path d="M6 4l14 8-14 8V4z" />,
    flag: <><path d="M5 3v18" /><path d="M5 4h13l-3 4 3 4H5" /></>,
    left: <path d="M15 18l-6-6 6-6" />,
    right: <path d="M9 18l6-6-6-6" />,
    check: <path d="M20 6L9 17l-5-5" />,
    x: <path d="M18 6L6 18M6 6l12 12" />,
    moon: <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
    download: <><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M4 21h16" /></>,
    upload: <><path d="M12 21V9" /><path d="M7 14l5-5 5 5" /><path d="M4 3h16" /></>,
    reset: <><path d="M3 12a9 9 0 109-9" /><path d="M3 3v6h6" /></>,
    warn: <><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L14.71 3.86a2 2 0 00-3.42 0z" /></>,
    chevronDown: <path d="M6 9l6 6 6-6" />,
    chevronUp: <path d="M18 15l-6-6-6 6" />,
    globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a15 15 0 010 18 15 15 0 010-18z" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
    languages: <><path d="M4 5h7" /><path d="M9 3v2c0 4.5-2 8-6 10" /><path d="M5 10c1.5 2 3 3 5 4" /><path d="M13 21l4-9 4 9" /><path d="M14.5 18h5" /></>,
    seal: <><circle cx="12" cy="9" r="6" /><path d="M9 14.5L7 22l5-3 5 3-2-7.5" /></>,
    sidebar: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></>,
    cloud: <path d="M7 18a4.5 4.5 0 01-.5-8.98A5.5 5.5 0 0117 8.5a4 4 0 01-1 7.5H7z" />,
    flame: <path d="M12 22a6 6 0 006-6c0-4-3-5-3-9 0 0-3 1.5-3 5 0-1.5-1-3-2-3.5C8 10 6 12 6 16a6 6 0 006 6z" />,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
    trend: <><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
    gauge: <><path d="M12 21a9 9 0 100-18 9 9 0 000 18z" /><path d="M12 12l4-4" /></>,
    volume: <><path d="M11 5L6 9H3v6h3l5 4V5z" /><path d="M16 9a4 4 0 010 6" /></>,
    // Thêm một vòng sóng nữa khi đang phát — phân biệt bằng hình, không chỉ bằng màu.
    volumeOn: <><path d="M11 5L6 9H3v6h3l5 4V5z" /><path d="M16 9a4 4 0 010 6" /><path d="M19 6a8 8 0 010 12" /></>,
    star: <path d="M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.9l1.1-6.5L2.6 9.8l6.5-.9L12 3z" />,
    // Bản tô đặc — dùng khi thẻ đã được lưu, để phân biệt bằng cả hình khối chứ không chỉ bằng màu.
    starFilled: <path d="M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.9l1.1-6.5L2.6 9.8l6.5-.9L12 3z" fill="currentColor" />,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

/* ===================== Small UI atoms ===================== */
export function StatusChip({ status }) {
  const { lang } = useAppCtx();
  return <span className={`pmi-chip pmi-status-${status}`}>{STATUS_LABEL[lang][status] || status}</span>;
}
export function DeltaChip({ delta }) {
  const d = Math.round(delta);
  if (d === 0) return <span className="pmi-chip pmi-status-insufficient_data">±0</span>;
  const up = d > 0;
  return (
    <span className="pmi-chip" style={{ background: up ? "var(--sage-tint)" : "var(--flag-tint)", color: up ? "var(--sage)" : "var(--flag)" }}>
      {up ? "▲" : "▼"} {up ? "+" : ""}{d}
    </span>
  );
}
export function TierChip({ tier }) {
  const { lang } = useAppCtx();
  const cls = tier === "required" ? "pmi-status-critical" : tier === "recommended" ? "pmi-status-developing" : "pmi-status-insufficient_data";
  return <span className={`pmi-chip ${cls}`}>{TIER_LABEL[lang][tier]}</span>;
}
export function ProgressBar({ value, className = "" }) {
  const pct = Math.round(clamp(value) * 100);
  return (
    <div className={`pmi-track w-full h-1.5 ${className}`}>
      <div className="h-full" style={{ width: `${pct}%` }} />
    </div>
  );
}
export function Card({ children, className = "", onClick, id, style }) {
  return (
    <div id={id} onClick={onClick} style={style} className={`pmi-card ${onClick ? "pmi-card-interactive" : ""} p-4 ${className}`}>
      {children}
    </div>
  );
}
export function Button({ children, onClick, variant = "primary", className = "", disabled, title }) {
  const cls = { primary: "pmi-btn-primary", secondary: "pmi-btn-secondary", danger: "pmi-btn-danger", ghost: "pmi-btn-ghost" }[variant];
  return (
    <button title={title} onClick={onClick} disabled={disabled} className={`pmi-btn pmi-focusable ${cls} px-4 py-2.5 ${className}`}>
      {children}
    </button>
  );
}
export function Toast({ text }) {
  const isDesktop = useIsDesktop();
  if (!text) return null;
  return (
    <div className={`pmi-mono fixed ${isDesktop ? "bottom-6" : "bottom-20"} left-1/2 -translate-x-1/2 z-50 text-[11px] px-3 py-1.5 rounded-md shadow-lg pointer-events-none`} style={{ background: "var(--accent)", color: "var(--accent-fg)" }}>
      {text}
    </div>
  );
}
