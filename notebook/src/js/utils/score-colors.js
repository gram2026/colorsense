/** 점수 바(0=보라 → 100=빨강)와 점수 글자색이 항상 같은 색을 쓰도록 한 곳에서 정의한다. */

import { hexToRgb, rgbToHex } from "../color/color-convert.js";

export const SCORE_BAR_STOPS = ["#9c4fb0", "#4b52c9", "#1ea2e3", "#2aa84f", "#b5d52a", "#f5dc1f", "#f28a24", "#e53a2f"];

export function scoreBarGradient() {
  const last = SCORE_BAR_STOPS.length - 1;
  const stops = SCORE_BAR_STOPS.map((c, i) => `${c} ${((i / last) * 100).toFixed(2)}%`);
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}

/** 점수 바에서 해당 점수 위치의 색 */
export function scoreColor(score, maxScore = 100) {
  const ratio = Math.max(0, Math.min(1, score / maxScore));
  const scaled = ratio * (SCORE_BAR_STOPS.length - 1);
  const i = Math.min(Math.floor(scaled), SCORE_BAR_STOPS.length - 2);
  const t = scaled - i;
  const a = hexToRgb(SCORE_BAR_STOPS[i]);
  const b = hexToRgb(SCORE_BAR_STOPS[i + 1]);
  return rgbToHex({ r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t });
}

function luminance({ r, g, b }) {
  const lin = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * style 속성에 넣을 CSS 변수들.
 * 글자도 바와 똑같은 색을 쓰고, 노랑/연두처럼 밝은 구간은 밝은 배경에서 안 보이므로 진한 외곽선만 더한다.
 */
export function scoreColorVars(score, maxScore = 100) {
  const hex = scoreColor(score, maxScore);
  const rgb = hexToRgb(hex);
  const isLight = luminance(rgb) > 0.4;
  const stroke = isLight ? "1.2px #34332f" : "0.16px currentColor";
  const onColor = isLight ? "#34332f" : "#ffffff";
  return `--score-color:${hex};--score-stroke:${stroke};--score-on-color:${onColor};--score-glow:rgba(${rgb.r},${rgb.g},${rgb.b},0.35)`;
}

/** 애니메이션 중 점수 값이 바뀔 때 같은 변수들을 요소에 바로 반영한다. */
export function applyScoreColorVars(el, score, maxScore = 100) {
  for (const decl of scoreColorVars(score, maxScore).split(";")) {
    const idx = decl.indexOf(":");
    el.style.setProperty(decl.slice(0, idx), decl.slice(idx + 1));
  }
}
