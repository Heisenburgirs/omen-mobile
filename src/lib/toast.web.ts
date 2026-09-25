// ToastAndroid does not exist in a browser: the same two calls put a short
// message above the bottom edge, one at a time, and take it away again.
let node: HTMLDivElement | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
function show(message: string, ms: number) {
  if (typeof document === "undefined") return;
  if (!node) {
    node = document.createElement("div");
    node.id = "omen-toast";
    node.setAttribute("role", "status");
    Object.assign(node.style, {
      position: "fixed",
      left: "50%",
      bottom: "calc(96px + env(safe-area-inset-bottom))",
      transform: "translateX(-50%)",
      maxWidth: "min(88vw, 420px)",
      padding: "10px 16px",
      borderRadius: "999px",
      background: "#1C1C1E",
      color: "#FFFFFF",
      font: "500 14px/20px OmenUI_500Medium, system-ui, sans-serif",
      textAlign: "center",
      zIndex: "2147483000",
      pointerEvents: "none",
      transition: "opacity 160ms ease",
    } satisfies Partial<CSSStyleDeclaration>);
    document.body.appendChild(node);
  }
  node.textContent = message;
  node.style.opacity = "1";
  clearTimeout(timer);
  timer = setTimeout(() => {
    if (node) node.style.opacity = "0";
  }, ms);
}
export function showErrorToast(message: string) {
  show(message, 3500);
}
/** A short confirmation that an action happened, e.g. a watchlist change. */
export function showToast(message: string) {
  show(message, 2000);
}
