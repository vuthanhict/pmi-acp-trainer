import { useState, useMemo } from "react";
import { useAppCtx } from "../../context/AppContext.jsx";
import { useIsDesktop } from "../../hooks/useViewport.js";
import { MINDSET_DOMAINS, MINDSET_SECTIONS } from "../../lib/mindsetGuide.js";
import { Card, Icon } from "../../components/ui/primitives.jsx";

/* ---------- Từng loại section render khác nhau ---------- */
function IntroSection({ s }) {
  return (
    <>
      {s.paragraphs?.map((p, i) => (
        <p key={i} className="text-sm mb-2.5 leading-relaxed" style={{ color: "var(--ink-mid)" }}>{p}</p>
      ))}
      {s.bullets?.length > 0 && (
        <ul className="space-y-1.5 mt-2">
          {s.bullets.map((b, i) => (
            <li key={i} className="flex gap-2 text-sm" style={{ color: "var(--ink-mid)" }}>
              <span className="shrink-0" style={{ color: "var(--ink-soft)" }}>•</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function DomainSection({ s }) {
  return (
    <>
      <p className="text-sm mb-3 leading-relaxed" style={{ color: "var(--ink-mid)" }}>{s.summary}</p>
      <div className="space-y-3">
        {s.tasks.map((task, i) => (
          <div key={i} className="pl-3" style={{ borderLeft: "2px solid var(--line-strong)" }}>
            <p className="text-sm font-medium mb-1">{task.name}</p>
            <ul className="space-y-1">
              {task.points.map((pt, j) => (
                <li key={j} className="flex gap-2 text-xs" style={{ color: "var(--ink-mid)" }}>
                  <span className="shrink-0" style={{ color: "var(--ink-soft)" }}>–</span>
                  <span>{pt}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}

function KeywordTableSection({ s }) {
  return (
    <>
      {s.intro && <p className="text-xs mb-3" style={{ color: "var(--ink-soft)" }}>{s.intro}</p>}
      <div className="space-y-2.5">
        {s.rows.map((r, i) => (
          <div key={i} className="rounded-lg p-2.5" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
            <p className="text-xs font-semibold mb-1" style={{ color: "var(--ink)" }}>{r.trigger}</p>
            <p className="text-xs flex gap-1.5" style={{ color: "var(--ink-mid)" }}>
              <Icon name="right" size={12} className="shrink-0 mt-0.5" style={{ color: "var(--sage)" }} />
              <span>{r.action}</span>
            </p>
          </div>
        ))}
      </div>
    </>
  );
}

function LadderSection({ s }) {
  return (
    <>
      {s.intro && <p className="text-xs mb-3" style={{ color: "var(--ink-soft)" }}>{s.intro}</p>}
      <div className="space-y-2.5 mb-3">
        {s.steps.map((step, i) => (
          <div key={i} className="flex gap-2.5">
            <span className="pmi-mono shrink-0 text-[11px] font-semibold w-5 h-5 rounded-full flex items-center justify-center mt-0.5" style={{ background: "var(--line)", color: "var(--ink-mid)" }}>
              {i + 1}
            </span>
            <div>
              <p className="text-sm font-medium">{step.title}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--ink-mid)" }}>{step.detail}</p>
            </div>
          </div>
        ))}
      </div>
      {s.notes?.length > 0 && (
        <div className="rounded-lg p-3 mt-3" style={{ background: "var(--seal-tint)" }}>
          <p className="pmi-eyebrow mb-1.5" style={{ color: "var(--seal-fg)" }}>Lưu ý theo tình huống</p>
          <ul className="space-y-1">
            {s.notes.map((n, i) => (
              <li key={i} className="text-xs" style={{ color: "var(--seal-fg)" }}>• {n}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function ModesTableSection({ s }) {
  return (
    <div className="space-y-2">
      {s.rows.map((r, i) => (
        <div key={i} className="rounded-lg p-2.5" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
          <p className="text-xs font-semibold mb-0.5">{r.mode}</p>
          <p className="text-xs" style={{ color: "var(--ink-mid)" }}>{r.when}</p>
          <p className="text-[11px] mt-1 italic" style={{ color: "var(--ink-soft)" }}>{r.note}</p>
        </div>
      ))}
    </div>
  );
}

function TipsSection({ s }) {
  return (
    <ul className="space-y-2">
      {s.items.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm" style={{ color: "var(--ink-mid)" }}>
          <span className="pmi-mono shrink-0 text-[11px] mt-0.5" style={{ color: "var(--ink-soft)" }}>{i + 1}.</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function ReferencesSection({ s }) {
  return (
    <ul className="space-y-1.5">
      {s.items.map((r, i) => (
        <li key={i}>
          <a href={r.url} target="_blank" rel="noopener noreferrer" className="pmi-focusable text-xs underline flex items-start gap-1.5" style={{ color: "var(--ink-mid)" }}>
            <Icon name="link" size={12} className="shrink-0 mt-0.5" />
            <span>{r.label}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

const SECTION_RENDERERS = {
  intro: IntroSection,
  domain: DomainSection,
  keywordTable: KeywordTableSection,
  ladder: LadderSection,
  modesTable: ModesTableSection,
  tips: TipsSection,
  references: ReferencesSection,
};

function sectionSearchBlob(s) {
  const parts = [s.title, s.summary, s.intro];
  if (s.paragraphs) parts.push(...s.paragraphs);
  if (s.bullets) parts.push(...s.bullets);
  if (s.tasks) for (const task of s.tasks) { parts.push(task.name, ...task.points); }
  if (s.rows) for (const r of s.rows) { parts.push(r.trigger, r.action, r.mode, r.when, r.note); }
  if (s.steps) for (const st of s.steps) { parts.push(st.title, st.detail); }
  if (s.notes) parts.push(...s.notes);
  if (s.items) for (const it of s.items) { parts.push(typeof it === "string" ? it : it.label); }
  return parts.filter(Boolean).join(" ").toLowerCase();
}

/* ===================== Cẩm nang ACP Mindset ===================== */
export function MindsetGuideScreen() {
  const { t } = useAppCtx();
  const isDesktop = useIsDesktop();
  const [domain, setDomain] = useState("overview");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MINDSET_SECTIONS.filter((s) => {
      if (!q && s.domain !== domain) return false;
      if (q && !sectionSearchBlob(s).includes(q)) return false;
      return true;
    });
  }, [domain, query]);

  return (
    <div className="pt-1 pb-4">
      <div className="mb-3">
        <p className="pmi-eyebrow mb-1">{t("mindsetGuideHeader")}</p>
        <p className="text-xs" style={{ color: "var(--ink-soft)" }}>{t("mindsetGuideSubtitle")}</p>
      </div>

      <div className="relative mb-3">
        <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-soft)" }} />
        <input
          value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder={t("mindsetSearchPlaceholder")}
          className="pmi-input w-full pl-9 pr-3 py-2.5 text-sm"
        />
      </div>

      {!query && (
        <div className={`flex gap-1.5 overflow-x-auto pb-3 ${isDesktop ? "flex-wrap" : "-mx-4 px-4"}`}>
          {MINDSET_DOMAINS.map((d) => (
            <button
              key={d.key} onClick={() => setDomain(d.key)}
              className="pmi-focusable pmi-mono shrink-0 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap"
              style={domain === d.key ? { background: "var(--accent)", color: "var(--accent-fg)" } : { background: "var(--paper)", color: "var(--ink-mid)", border: "1px solid var(--line-strong)" }}
            >
              {d.labelVi}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm py-6 text-center" style={{ color: "var(--ink-soft)" }}>{t("mindsetNoResults")}</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => {
            const Renderer = SECTION_RENDERERS[s.type];
            return (
              <Card key={s.id}>
                <p className="pmi-display font-semibold text-sm mb-2.5">{s.title}</p>
                {Renderer ? <Renderer s={s} /> : null}
                {s.source && <p className="text-[10px] mt-3 pt-2" style={{ color: "var(--ink-soft)", borderTop: "1px dashed var(--line-strong)" }}>{s.source}</p>}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
