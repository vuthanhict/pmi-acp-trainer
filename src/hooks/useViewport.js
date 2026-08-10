import { useState, useEffect } from "react";

/* ===================== Responsive: phát hiện viewport bằng JS ===================== */
/* QUAN TRỌNG: môi trường artifact build sẵn CSS Tailwind không qua compiler (JIT), nên   */
/* rất nhiều tổ hợp "sm:/md:/lg:" ít phổ biến (md:w-56, md:min-w-0, lg:max-w-3xl...) không */
/* chắc có sẵn trong bộ class đã biên dịch — khiến điều kiện responsive không kích hoạt,   */
/* giao diện luôn ở layout mobile bất kể độ rộng màn hình. Để đảm bảo đúng ở MỌI kích      */
/* thước, ta tự đo viewport bằng JS (resize listener) rồi chọn class/style cố định (không  */
/* tiền tố responsive) tương ứng — không phụ thuộc CSS media query của nền tảng.           */
const DESKTOP_BREAKPOINT = 768;
const WIDE_BREAKPOINT = 1280;
export function useViewportWidth() {
  const [w, setW] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 0));
  useEffect(() => {
    function onResize() {
      setW(window.innerWidth);
    }
    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return w;
}
export function useIsDesktop() {
  return useViewportWidth() >= DESKTOP_BREAKPOINT;
}
export function useIsWide() {
  return useViewportWidth() >= WIDE_BREAKPOINT;
}
