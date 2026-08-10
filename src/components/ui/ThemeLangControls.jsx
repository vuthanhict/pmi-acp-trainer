import { Icon } from "./primitives.jsx";

export function ThemeLangControls({ theme, lang, setTheme, setLang }) {
  return (
    <div className="pmi-toggle flex items-center p-1 pmi-mono text-xs font-semibold">
      <button onClick={() => setLang("vi")} className={`pmi-toggle-btn px-3 py-2 ${lang === "vi" ? "is-active" : ""}`}>VI</button>
      <button onClick={() => setLang("en")} className={`pmi-toggle-btn px-3 py-2 ${lang === "en" ? "is-active" : ""}`}>EN</button>
      <span style={{ width: 1, alignSelf: "stretch", background: "var(--line-strong)", margin: "3px 3px" }} />
      <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="pmi-toggle-btn px-2.5 py-2 flex items-center justify-center" style={{ color: "var(--ink-mid)" }}>
        <Icon name={theme === "dark" ? "sun" : "moon"} size={14} />
      </button>
    </div>
  );
}
