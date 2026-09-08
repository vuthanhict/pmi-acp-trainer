import { useState, useMemo } from "react";
import { useAppCtx } from "../../context/AppContext.jsx";
import { useIsDesktop } from "../../hooks/useViewport.js";
import { MINDSET_DOMAINS, MINDSET_SECTIONS } from "../../lib/mindsetGuide.js";
import { Card, Icon } from "../../components/ui/primitives.jsx";

/* ---------- Mở/thu theo nhu cầu ---------- */
/* Cẩm nang này dài: riêng 4 domain đã là 23 task với hơn 70 gạch đầu dòng, cộng 12 nguyên tắc kèm
   diễn giải. Đọc một lượt từ trên xuống thì không thấy được bố cục, mà bố cục mới là thứ cần nhớ
   khi đi thi. Nên chia làm hai tầng:
     - Chế độ GỌN (mặc định): mỗi mục chỉ hiện phần "xương sống" — tên task, nguyên văn giá trị /
       nguyên tắc. Phần diễn giải nằm sau nút "Giải thích", mở khi thật sự cần.
     - Chế độ ĐẦY ĐỦ: mở sẵn mọi thứ, dùng khi đọc kỹ một domain.
   Cộng thêm tầng thu gọn cả thẻ section để lướt qua tiêu đề.
   Đang tìm kiếm thì mọi thứ luôn mở — giấu đi thì không thấy được vì sao một mục khớp từ khóa. */
function Detail({ dense, children }) {
  const { t } = useAppCtx();
  const [open, setOpen] = useState(false);
  if (!dense) return children;
  return (
    <>
      {open && children}
      <button
        onClick={() => setOpen((v) => !v)}
        className="pmi-focusable pmi-mono text-[10px] mt-1.5 flex items-center gap-1"
        style={{ color: "var(--ink-soft)" }}
      >
        <Icon name={open ? "chevronUp" : "chevronDown"} size={11} />
        {open ? t("mindsetHideBtn") : t("mindsetExplainBtn")}
      </button>
    </>
  );
}

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

function DomainSection({ s, dense }) {
  return (
    <>
      <p className="text-sm mb-3 leading-relaxed" style={{ color: "var(--ink-mid)" }}>{s.summary}</p>
      <div className="space-y-3">
        {s.tasks.map((task, i) => (
          <div key={i} className="pl-3" style={{ borderLeft: "2px solid var(--line-strong)" }}>
            <p className="text-sm font-medium">{task.name}</p>
            <Detail dense={dense}>
              <ul className="space-y-1 mt-1">
                {task.points.map((pt, j) => (
                  <li key={j} className="flex gap-2 text-xs" style={{ color: "var(--ink-mid)" }}>
                    <span className="shrink-0" style={{ color: "var(--ink-soft)" }}>–</span>
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </Detail>
          </div>
        ))}
      </div>
    </>
  );
}

/* Song ngữ: nguyên văn tiếng Anh đứng trước và được đánh dấu rõ là bản gốc, bản dịch tiếng Việt
   ngay dưới. Đặt như vậy vì mục đích của khối này là ĐỐI CHIẾU — người học phải kiểm được bản dịch
   với agilemanifesto.org, nên bản gốc không được lép vế về mặt thị giác. */
function BilingualPair({ en, vi }) {
  return (
    <>
      <p className="text-sm leading-relaxed" style={{ color: "var(--ink)" }} lang="en">{en}</p>
      <p className="text-sm leading-relaxed mt-1" style={{ color: "var(--ink-mid)" }} lang="vi">{vi}</p>
    </>
  );
}

function PmiNote({ label, text, tone = "default" }) {
  const color = tone === "trap" ? "var(--seal-fg)" : "var(--ink-mid)";
  const bg = tone === "trap" ? "var(--seal-tint)" : "var(--paper)";
  return (
    <div className="rounded-lg p-2.5 mt-2" style={{ background: bg, border: tone === "trap" ? "none" : "1px solid var(--line)" }}>
      <p className="pmi-eyebrow mb-1" style={{ color: tone === "trap" ? "var(--seal-fg)" : "var(--ink-soft)" }}>{label}</p>
      <p className="text-xs leading-relaxed" style={{ color }}>{text}</p>
    </div>
  );
}

function ValuesSection({ s, dense }) {
  return (
    <>
      {s.intro && <p className="text-xs mb-3 leading-relaxed" style={{ color: "var(--ink-soft)" }}>{s.intro}</p>}
      {s.preamble && (
        <div className="mb-3 pb-3" style={{ borderBottom: "1px dashed var(--line-strong)" }}>
          <BilingualPair en={s.preamble.en} vi={s.preamble.vi} />
        </div>
      )}
      <div className="space-y-3">
        {s.values.map((v, i) => (
          <div key={i} className="pl-3" style={{ borderLeft: "2px solid var(--line-strong)" }}>
            <p className="text-sm leading-relaxed" style={{ color: "var(--ink)" }} lang="en">
              <span className="font-semibold">{v.left.en}</span>
              <span style={{ color: "var(--ink-soft)" }}> over </span>
              <span>{v.right.en}</span>
            </p>
            <p className="text-sm leading-relaxed mt-1" style={{ color: "var(--ink-mid)" }} lang="vi">
              <span className="font-semibold">{v.left.vi}</span>
              <span style={{ color: "var(--ink-soft)" }}> hơn là </span>
              <span>{v.right.vi}</span>
            </p>
            <Detail dense={dense}>
              {v.pmi && <PmiNote label="Trong đề thi" text={v.pmi} />}
              {v.trap && <PmiNote label="Bẫy" text={v.trap} tone="trap" />}
            </Detail>
          </div>
        ))}
      </div>
      {s.closing && (
        <div className="mt-3 pt-3" style={{ borderTop: "1px dashed var(--line-strong)" }}>
          <BilingualPair en={s.closing.en} vi={s.closing.vi} />
          {s.closingNote && <PmiNote label="Trong đề thi" text={s.closingNote} tone="trap" />}
        </div>
      )}
    </>
  );
}

function PrinciplesSection({ s, dense }) {
  return (
    <>
      {s.intro && <p className="text-xs mb-3 leading-relaxed" style={{ color: "var(--ink-soft)" }}>{s.intro}</p>}
      <div className="space-y-3">
        {s.principles.map((p) => (
          <div key={p.n} className="flex gap-2.5">
            <span className="pmi-mono shrink-0 text-[11px] font-semibold w-5 h-5 rounded-full flex items-center justify-center mt-0.5" style={{ background: "var(--line)", color: "var(--ink-mid)" }}>
              {p.n}
            </span>
            <div className="min-w-0 flex-1">
              <BilingualPair en={p.en} vi={p.vi} />
              {p.maps && (
                <p className="pmi-mono text-[10px] mt-1.5" style={{ color: "var(--ink-soft)" }}>→ {p.maps}</p>
              )}
              {p.pmi && <Detail dense={dense}><PmiNote label="Trong đề thi" text={p.pmi} /></Detail>}
            </div>
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

function LadderSection({ s, dense }) {
  return (
    <>
      {s.intro && <p className="text-xs mb-3" style={{ color: "var(--ink-soft)" }}>{s.intro}</p>}
      <div className="space-y-2.5 mb-3">
        {s.steps.map((step, i) => (
          <div key={i} className="flex gap-2.5">
            <span className="pmi-mono shrink-0 text-[11px] font-semibold w-5 h-5 rounded-full flex items-center justify-center mt-0.5" style={{ background: "var(--line)", color: "var(--ink-mid)" }}>
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{step.title}</p>
              <Detail dense={dense}>
                <p className="text-xs mt-0.5" style={{ color: "var(--ink-mid)" }}>{step.detail}</p>
              </Detail>
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
  values: ValuesSection,
  principles: PrinciplesSection,
  keywordTable: KeywordTableSection,
  ladder: LadderSection,
  modesTable: ModesTableSection,
  tips: TipsSection,
  references: ReferencesSection,
};

/** Số mục con của một section — hiện ngay cạnh tiêu đề khi thẻ đang thu gọn, để lướt qua vẫn
    biết bên trong nặng nhẹ ra sao mà không phải mở. */
function sectionItemCount(s) {
  return (s.tasks?.length || 0) + (s.values?.length || 0) + (s.principles?.length || 0)
    + (s.rows?.length || 0) + (s.steps?.length || 0) + (s.items?.length || 0) + (s.bullets?.length || 0);
}

function sectionSearchBlob(s) {
  const parts = [s.title, s.summary, s.intro];
  if (s.paragraphs) parts.push(...s.paragraphs);
  if (s.bullets) parts.push(...s.bullets);
  if (s.tasks) for (const task of s.tasks) { parts.push(task.name, ...task.points); }
  if (s.rows) for (const r of s.rows) { parts.push(r.trigger, r.action, r.mode, r.when, r.note); }
  if (s.steps) for (const st of s.steps) { parts.push(st.title, st.detail); }
  if (s.notes) parts.push(...s.notes);
  if (s.items) for (const it of s.items) { parts.push(typeof it === "string" ? it : it.label); }
  // Song ngữ: tìm được bằng cả từ tiếng Anh lẫn tiếng Việt.
  if (s.preamble) parts.push(s.preamble.en, s.preamble.vi);
  if (s.closing) parts.push(s.closing.en, s.closing.vi, s.closingNote);
  if (s.values) for (const v of s.values) { parts.push(v.left.en, v.left.vi, v.right.en, v.right.vi, v.pmi, v.trap); }
  if (s.principles) for (const pr of s.principles) { parts.push(pr.en, pr.vi, pr.maps, pr.pmi); }
  return parts.filter(Boolean).join(" ").toLowerCase();
}

/* ===================== Cẩm nang ACP Mindset ===================== */
const DENSE_KEY = "pmi_acp_mindset_dense";

export function MindsetGuideScreen() {
  const { t } = useAppCtx();
  const isDesktop = useIsDesktop();
  const [domain, setDomain] = useState("overview");
  const [query, setQuery] = useState("");
  // Mặc định GỌN: mở cẩm nang ra là thấy bố cục trước, chi tiết mở sau. Nhớ lựa chọn qua
  // localStorage — đây là thói quen đọc của riêng máy này, không phải dữ liệu học cần đồng bộ.
  const [dense, setDense] = useState(() => {
    try { return localStorage.getItem(DENSE_KEY) !== "0"; } catch { return true; }
  });
  const [collapsed, setCollapsed] = useState(() => new Set());

  const toggleDense = () => setDense((v) => {
    const next = !v;
    try { localStorage.setItem(DENSE_KEY, next ? "1" : "0"); } catch { /* chế độ riêng tư */ }
    return next;
  });
  const toggleSection = (id) => setCollapsed((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MINDSET_SECTIONS.filter((s) => {
      if (!q && s.domain !== domain) return false;
      if (q && !sectionSearchBlob(s).includes(q)) return false;
      return true;
    });
  }, [domain, query]);

  const allCollapsed = filtered.length > 0 && filtered.every((s) => collapsed.has(s.id));

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
        <div className={`flex gap-1.5 overflow-x-auto pb-2 ${isDesktop ? "flex-wrap" : "-mx-4 px-4"}`}>
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

      {/* Hai tầng điều khiển: đổi mật độ chi tiết bên trong mọi mục, và thu/mở toàn bộ thẻ. Ẩn khi
          đang tìm kiếm vì lúc đó mọi thứ buộc phải mở. */}
      {!query && filtered.length > 0 && (
        <div className="flex items-center gap-2 pb-3">
          <button
            onClick={toggleDense}
            className="pmi-focusable pmi-mono text-[10px] px-2.5 py-1 rounded-full flex items-center gap-1"
            style={{ background: "var(--paper)", border: "1px solid var(--line-strong)", color: "var(--ink-mid)" }}
            aria-pressed={!dense}
          >
            <Icon name={dense ? "chevronDown" : "chevronUp"} size={11} />
            {dense ? t("mindsetFull") : t("mindsetDense")}
          </button>
          <button
            onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(filtered.map((x) => x.id)))}
            className="pmi-focusable pmi-mono text-[10px] px-2.5 py-1 rounded-full"
            style={{ background: "var(--paper)", border: "1px solid var(--line-strong)", color: "var(--ink-mid)" }}
          >
            {allCollapsed ? t("mindsetExpandAll") : t("mindsetCollapseAll")}
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm py-6 text-center" style={{ color: "var(--ink-soft)" }}>{t("mindsetNoResults")}</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => {
            const Renderer = SECTION_RENDERERS[s.type];
            const isOpen = !!query || !collapsed.has(s.id);
            const count = sectionItemCount(s);
            return (
              <Card key={s.id}>
                <button
                  onClick={() => toggleSection(s.id)}
                  className="pmi-focusable w-full flex items-center justify-between gap-2 text-left"
                  aria-expanded={isOpen}
                  style={{ background: "transparent" }}
                >
                  <span className="pmi-display font-semibold text-sm">{s.title}</span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    {!isOpen && count > 0 && (
                      <span className="pmi-mono text-[10px]" style={{ color: "var(--ink-soft)" }}>{t("mindsetSectionMeta", { n: count })}</span>
                    )}
                    <Icon name={isOpen ? "chevronUp" : "chevronDown"} size={14} />
                  </span>
                </button>
                {isOpen && (
                  <div className="mt-2.5">
                    {Renderer ? <Renderer s={s} dense={!query && dense} /> : null}
                    {s.source && <p className="text-[10px] mt-3 pt-2" style={{ color: "var(--ink-soft)", borderTop: "1px dashed var(--line-strong)" }}>{s.source}</p>}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
