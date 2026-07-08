export const G = {
  pageBg: "#0d1520",
  navBg: "rgba(8,15,26,0.96)",
  navBorder: "rgba(255,255,255,0.06)",
  glass: "rgba(255,255,255,0.035)",
  glassHover: "rgba(255,255,255,0.06)",
  glassStrong: "rgba(255,255,255,0.06)",
  glassBorder: "rgba(255,255,255,0.08)",
  glassBorderStrong: "rgba(255,255,255,0.14)",
  text: "#f0f4ff",
  sub: "#a8b4cc",
  muted: "#5a6a80",
  gold: "#f0b040",
  goldGlass: "rgba(240,176,64,0.13)",
  goldBorder: "rgba(240,176,64,0.35)",
  green: "#34d97b",
  greenGlass: "rgba(52,217,123,0.1)",
  red: "#ff5c6c",
  redGlass: "rgba(255,92,108,0.1)",
  blue: "#60a5fa",
  blueGlass: "rgba(96,165,250,0.1)",
  purple: "#a78bfa",
  purpleGlass: "rgba(167,139,250,0.1)",
  active: "#60a5fa",
};

export const FLAVOUR_COLORS: Record<
  string,
  { bg: string; border: string; text: string; dot: string }
> = {
  strawberry: { bg: "#2a0d0d", border: "#791f1f", text: "#f09595", dot: "#e24b4a" },
  mango: { bg: "#271908", border: "#633806", text: "#fac775", dot: "#ef9f27" },
  blueberry: { bg: "#0e1230", border: "#26215c", text: "#afa9ec", dot: "#7f77dd" },
  kiwi: { bg: "#0e1e0e", border: "#173404", text: "#c0dd97", dot: "#639922" },
  lychee: { bg: "#280e1c", border: "#4b1528", text: "#ed93b1", dot: "#d4537e" },
  biscoff: { bg: "#271808", border: "#412402", text: "#fac775", dot: "#ba7517" },
  hazelnut: { bg: "#1e1006", border: "#412402", text: "#fac775", dot: "#854f0b" },
  chococrisp: { bg: "#150e06", border: "#2c1a06", text: "#d4a472", dot: "#85501e" },
  coffeecrisp: { bg: "#150e06", border: "#2c1a06", text: "#c9a06a", dot: "#7a4810" },
  kitkat: { bg: "#2a0a0a", border: "#6b1414", text: "#f09595", dot: "#c81e1e" },
  nutella: { bg: "#1e0e06", border: "#3c1e0a", text: "#d4a472", dot: "#784014" },
  passion: { bg: "#1e0a1e", border: "#4b0e4b", text: "#cc82cc", dot: "#b41eb4" },
  default: { bg: "#141e2e", border: "#2a3a50", text: "#a8b4cc", dot: "#6a7a90" },
};

export function getFlavourColor(name: string) {
  const n = name.toLowerCase();
  for (const [key, val] of Object.entries(FLAVOUR_COLORS)) {
    if (n.includes(key)) return val;
  }
  return FLAVOUR_COLORS.default;
}
