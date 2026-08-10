/* ===================== App-wide context (theme + language) ===================== */
/* Cung cấp { lang, theme, t } cho toàn bộ cây component — mọi screen/widget đọc qua hook
   useAppCtx() thay vì nhận qua props, tránh phải truyền lang/theme/t qua nhiều tầng. */
import React from "react";

export const AppCtx = React.createContext({ lang: "vi", theme: "light", t: (k) => k });
export function useAppCtx() {
  return React.useContext(AppCtx);
}
