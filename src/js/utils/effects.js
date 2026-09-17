/** 결과 화면용 가벼운 DOM 이펙트 (캔버스/라이브러리 없이 CSS 애니메이션만 사용) */

export const TIER_COLORS = {
  perfect: ["#f2b705", "#ffd84d", "#ff8a3d", "#ffffff"],
  great: ["#2e9e4f", "#7ad37f", "#f2b705", "#ffffff"],
  good: ["#2f6fd6", "#6fa4ff", "#7ad37f"],
  okay: ["#e07b1a", "#ffb35c"],
  low: ["#d64545"],
};

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/** anchor 요소 중심에서 색종이 조각을 사방으로 터뜨린다. */
export function burstConfetti(anchor, { colors = TIER_COLORS.great, count = 36, spread = 220 } = {}) {
  if (!anchor || prefersReducedMotion()) return;

  const layer = document.createElement("div");
  layer.className = "fx-burst";
  anchor.appendChild(layer);

  for (let i = 0; i < count; i++) {
    const piece = document.createElement("span");
    piece.className = "fx-burst__piece";
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const distance = spread * (0.45 + Math.random() * 0.55);
    piece.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
    piece.style.setProperty("--dy", `${Math.sin(angle) * distance - 40}px`);
    piece.style.setProperty("--rot", `${Math.round(Math.random() * 720 - 360)}deg`);
    piece.style.setProperty("--delay", `${Math.round(Math.random() * 120)}ms`);
    piece.style.background = colors[i % colors.length];
    if (i % 3 === 0) piece.classList.add("fx-burst__piece--round");
    layer.appendChild(piece);
  }

  setTimeout(() => layer.remove(), 1600);
}
