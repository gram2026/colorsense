/**
 * 색상 변환 유틸리티
 * HEX / RGB / HSL / LAB 사이의 변환을 담당한다.
 * 점수 계산(LAB)과 UI 표시(HSL, HEX) 양쪽에서 공통으로 사용한다.
 */

// ---------- 공통 헬퍼 ----------

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** HEX 문자열이 유효한 #RRGGBB 형식인지 검사 */
export function isValidHex(hex) {
  return typeof hex === "string" && /^#([0-9a-fA-F]{6})$/.test(hex.trim());
}

// ---------- HEX <-> RGB ----------

export function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const value = parseInt(clean, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

export function rgbToHex({ r, g, b }) {
  const toHex = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

// ---------- RGB <-> HSL (UI 표시/조작용) ----------

export function rgbToHsl({ r, g, b }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const delta = max - min;

  let h = 0;
  let s = 0;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case rn:
        h = ((gn - bn) / delta) % 6;
        break;
      case gn:
        h = (bn - rn) / delta + 2;
        break;
      default:
        h = (rn - gn) / delta + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }

  return { h, s: s * 100, l: l * 100 };
}

export function hslToRgb({ h, s, l }) {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;

  let rp = 0;
  let gp = 0;
  let bp = 0;

  if (h < 60) [rp, gp, bp] = [c, x, 0];
  else if (h < 120) [rp, gp, bp] = [x, c, 0];
  else if (h < 180) [rp, gp, bp] = [0, c, x];
  else if (h < 240) [rp, gp, bp] = [0, x, c];
  else if (h < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];

  return {
    r: (rp + m) * 255,
    g: (gp + m) * 255,
    b: (bp + m) * 255,
  };
}

export function hexToHsl(hex) {
  return rgbToHsl(hexToRgb(hex));
}

export function hslToHex(hsl) {
  return rgbToHex(hslToRgb(hsl));
}

// ---------- sRGB -> LAB (점수 계산용) ----------

function srgbChannelToLinear(value) {
  const v = value / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

// D65 기준 백색점
const REF_X = 95.047;
const REF_Y = 100.0;
const REF_Z = 108.883;

function rgbToXyz({ r, g, b }) {
  const rl = srgbChannelToLinear(r) * 100;
  const gl = srgbChannelToLinear(g) * 100;
  const bl = srgbChannelToLinear(b) * 100;

  return {
    x: rl * 0.4124 + gl * 0.3576 + bl * 0.1805,
    y: rl * 0.2126 + gl * 0.7152 + bl * 0.0722,
    z: rl * 0.0193 + gl * 0.1192 + bl * 0.9505,
  };
}

function xyzChannelToLab(value) {
  return value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116;
}

export function xyzToLab({ x, y, z }) {
  const fx = xyzChannelToLab(x / REF_X);
  const fy = xyzChannelToLab(y / REF_Y);
  const fz = xyzChannelToLab(z / REF_Z);

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

export function rgbToLab(rgb) {
  return xyzToLab(rgbToXyz(rgb));
}

export function hexToLab(hex) {
  return rgbToLab(hexToRgb(hex));
}
