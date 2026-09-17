/**
 * Canvas 마스크 색상 합성
 * - 원본/마스크 픽셀은 최초 1회만 읽는다.
 * - 매 프레임은 requestAnimationFrame으로만 그린다 (드래그 중 과도한 렌더링 방지).
 * - renderMode === "preserve-lightness"(현재 유일하게 지원하는 모드)에서는 원본 픽셀의
 *   명도(L)에 선택한 색의 명도를 "중간값(50) 기준 오프셋"으로 더해 넣고, Hue는 선택한 색을 그대로
 *   입힌다. 채도(S)는 선택색 채도에 원본 픽셀의 채도 비율을 곱해서 정한다. 오프셋 방식이라 사진의
 *   하이라이트·그림자·질감(상대적 명암 차이)뿐 아니라 반사광처럼 원래 색이 옅던 부분의 "덜 물든"
 *   느낌까지 살아있는 채로, 피커에서 고른 밝기(어둡게/밝게)도 실제로 사진에 반영된다.
 */

import { hexToRgb, rgbToHex, rgbToHsl, hslToRgb, clamp } from "./color-convert.js";
import { loadImages } from "../utils/image-loader.js";
import { SUPPORTED_RENDER_MODES } from "../utils/validation.js";

const MAX_RENDER_SIZE = 640; // 성능을 위한 내부 렌더링 최대 변 길이
const DEFAULT_RENDER_MODE = "preserve-lightness";

/**
 * renderMode 문자열을 실제로 쓸 렌더 모드로 정규화한다. 지원하지 않거나 없는 값이면
 * 기존 문제 데이터와의 호환을 위해 preserve-lightness로 안전하게 대체한다.
 * @param {string} [renderMode]
 * @returns {string}
 */
export function resolveRenderMode(renderMode) {
  return SUPPORTED_RENDER_MODES.includes(renderMode) ? renderMode : DEFAULT_RENDER_MODE;
}

/**
 * 픽셀 하나에 preserve-lightness 합성을 적용한다. 렌더 루프(_paintPreserveLightness)와
 * 테스트가 같은 함수를 쓰도록 분리해뒀다 — 수식을 두 곳에 따로 베껴 적지 않기 위함이다.
 *
 * 명도(L)는 원본 픽셀 값을 그대로 쓰고, 채도(S)는 선택색의 채도에 "원본 픽셀이 원래
 * 얼마나 채도가 있었는지" 비율을 곱해서 정한다. 그래야 반사광처럼 원래 색이 거의 빠져
 * 하얗게 보이던 부분은 선택색을 입혀도 여전히 하얗게 남고, 원래 색이 진했던 부분(그림자
 * 등)은 선택색도 진하게 나와서 실제 사진의 질감/입체감이 살아난다.
 *
 * @param {number} origR 원본 R (0~255)
 * @param {number} origG 원본 G (0~255)
 * @param {number} origB 원본 B (0~255)
 * @param {number} selectedH 사용자가 고른 색의 Hue (0~360)
 * @param {number} selectedS 사용자가 고른 색의 Saturation (0~100)
 * @param {number} originalL 원본 픽셀의 명도 (0~100)
 * @param {number} originalS 원본 픽셀의 채도 (0~100). 선택색 채도에 곱해지는 비율로만 쓰인다.
 * @param {number} strength 마스크 합성 강도 (0~1). 원본과 결과색을 섞는 비율일 뿐, 명도 자체를 정하지 않는다.
 * @param {number} [selectedL=50] 사용자가 고른 색의 Lightness (0~100). 중간값(50) 기준 오프셋만큼
 *   원본 명도를 밀어서 반영한다 — 하이라이트/그림자 같은 사진의 상대적 명암(텍스처)은 그대로 유지하면서도
 *   피커에서 어둡게/밝게 고르면 실제로 사진도 어두워지고/밝아지게 만든다. 기본값 50은 오프셋 0, 즉
 *   기존 동작(원본 명도 그대로)과 동일하다.
 * @returns {{r:number, g:number, b:number}} 0~255 범위의 합성 결과
 */
export function composePreserveLightnessPixel(
  origR,
  origG,
  origB,
  selectedH,
  selectedS,
  originalL,
  originalS,
  strength,
  selectedL = 50
) {
  if (strength <= 0.004) {
    return { r: origR, g: origG, b: origB };
  }
  const lift = darkNeutralColorWeight(originalL, originalS);
  const effectiveS = clamp(selectedS * (originalS / 100 * (1 - lift) + lift), 0, 100);
  const effectiveL = clamp((originalL - 50) * (1 - lift) + selectedL, 0, 100);
  const recolored = hslToRgb({ h: selectedH, s: effectiveS, l: effectiveL });
  return {
    r: origR * (1 - strength) + recolored.r * strength,
    g: origG * (1 - strength) + recolored.g * strength,
    b: origB * (1 - strength) + recolored.b * strength,
  };
}

/**
 * 고른 색이 정답 색 영역에 실제로 칠해졌을 때 보이는 색.
 * 사진은 원본의 명도/채도를 살린 채 합성되므로, 같아 보이는데 원본 HEX끼리만 비교하면 오답이 되는 문제를 막는다.
 * @param {string} pickHex 사용자가 고른 색
 * @param {string} baseHex 칠해질 원본 색(정답 색)
 * @returns {string} #RRGGBB
 */
export function appliedColorHex(pickHex, baseHex) {
  const base = hexToRgb(baseHex);
  const baseHsl = rgbToHsl(base);
  const pick = rgbToHsl(hexToRgb(pickHex));
  const out = composePreserveLightnessPixel(base.r, base.g, base.b, pick.h, pick.s, baseHsl.l, baseHsl.s, 1, pick.l);
  return rgbToHex(out);
}

// Near-black neutral pixels need the picked color directly; fade the correction
// out smoothly so neighboring shades do not acquire a hard boundary.
function darkNeutralColorWeight(lightness, saturation) {
  const dark = clamp((25 - lightness) / 15, 0, 1);
  const neutral = clamp((30 - saturation) / 20, 0, 1);
  return dark * dark * (3 - 2 * dark) * neutral * neutral * (3 - 2 * neutral);
}

/** preserve-lightness 합성 루프. 실시간(축소) 렌더링과 제출 시 원본 해상도 스냅샷이 같은 코드를 쓴다. */
export function paintPreserveLightnessBuffer(orig, out, lightness, saturation, maskStrength, total, selH, selS, selL) {
  // Hue sector is shared by every pixel; compute it once per frame.
  const hue = hslToRgb({ h: selH, s: 100, l: 50 });
  const hr = hue.r / 255, hg = hue.g / 255, hb = hue.b / 255;
  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    const strength = maskStrength[i];
    if (strength <= 0.004) {
      out[idx] = orig[idx]; out[idx + 1] = orig[idx + 1]; out[idx + 2] = orig[idx + 2];
    } else {
      const lift = darkNeutralColorWeight(lightness[i], saturation[i]);
      const l = clamp((lightness[i] - 50) * (1 - lift) + selL, 0, 100) / 100;
      const s = clamp(selS * (saturation[i] / 100 * (1 - lift) + lift), 0, 100) / 100;
      const c = (1 - Math.abs(2 * l - 1)) * s;
      const m = l - c / 2;
      const keep = 1 - strength;
      out[idx] = orig[idx] * keep + (hr * c + m) * 255 * strength;
      out[idx + 1] = orig[idx + 1] * keep + (hg * c + m) * 255 * strength;
      out[idx + 2] = orig[idx + 2] * keep + (hb * c + m) * 255 * strength;
    }
    out[idx + 3] = orig[idx + 3];
  }
}

/** flat 합성 루프. 실시간(축소) 렌더링과 제출 시 원본 해상도 스냅샷이 같은 코드를 쓴다. */
function paintFlatBuffer(orig, out, maskStrength, total, r, g, b) {
  for (let i = 0; i < total; i++) {
    const strength = maskStrength[i];
    const idx = i * 4;
    if (strength <= 0.004) {
      out[idx] = orig[idx];
      out[idx + 1] = orig[idx + 1];
      out[idx + 2] = orig[idx + 2];
      out[idx + 3] = orig[idx + 3];
      continue;
    }
    out[idx] = orig[idx] * (1 - strength) + r * strength;
    out[idx + 1] = orig[idx + 1] * (1 - strength) + g * strength;
    out[idx + 2] = orig[idx + 2] * (1 - strength) + b * strength;
    out[idx + 3] = orig[idx + 3];
  }
}

/** 원본 이미지의 픽셀별 명도(L)/채도(S)를 뽑는다 (preserve-lightness 합성용). */
function extractLightnessSaturation(rgba, total) {
  const l = new Float32Array(total);
  const s = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    const hsl = rgbToHsl({ r: rgba[idx], g: rgba[idx + 1], b: rgba[idx + 2] });
    l[i] = hsl.l;
    s[i] = hsl.s;
  }
  return { l, s };
}

export class MaskRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { willReadFrequently: true });
    this.ready = false;
    this.hasMask = false;
    this.width = 0;
    this.height = 0;
    this.renderMode = DEFAULT_RENDER_MODE;
    this.originalL = null; // preserve-lightness용: 원본 픽셀별 명도(0~100) 캐시
    this.originalS = null; // preserve-lightness용: 원본 픽셀별 채도(0~100) 캐시
    this._rafId = null;
    this._pendingHex = null;
    this._currentHex = null; // snapshotDataURL()에서 원본 해상도로 다시 합성할 때 쓸 마지막 선택색
    this._originalImageEl = null; // 원본 해상도 스냅샷용으로 디코딩된 이미지 엘리먼트를 계속 들고 있는다
    this._maskImageEl = null;
    this._naturalW = 0;
    this._naturalH = 0;
  }

  /**
   * @param {string} [renderMode] "preserve-lightness"만 지원. 없거나 알 수 없는 값이면
   *   기존 문제 데이터와의 호환을 위해 preserve-lightness로 안전하게 대체한다.
   * @returns {Promise<{ ok: boolean, maskMissing?: boolean, sizeMismatch?: boolean }>}
   */
  async load(originalSrc, maskSrc, renderMode) {
    this.ready = false;
    this.hasMask = false;
    this.renderMode = resolveRenderMode(renderMode);
    this.originalL = null;
    this.originalS = null;

    const [originalResult, maskResult] = await loadImages([originalSrc, maskSrc]);

    if (!originalResult.ok) {
      console.error("[mask-renderer] 원본 이미지 로드 실패:", originalSrc);
      return { ok: false };
    }

    const naturalW = originalResult.image.naturalWidth;
    const naturalH = originalResult.image.naturalHeight;
    const scale = Math.min(1, MAX_RENDER_SIZE / Math.max(naturalW, naturalH));
    const w = Math.max(1, Math.round(naturalW * scale));
    const h = Math.max(1, Math.round(naturalH * scale));

    this._originalImageEl = originalResult.image;
    this._naturalW = naturalW;
    this._naturalH = naturalH;

    this.width = w;
    this.height = h;
    this.canvas.width = w;
    this.canvas.height = h;

    const offscreen = document.createElement("canvas");
    offscreen.width = w;
    offscreen.height = h;
    const offCtx = offscreen.getContext("2d");

    offCtx.drawImage(originalResult.image, 0, 0, w, h);
    const originalData = offCtx.getImageData(0, 0, w, h);

    this.imageData = this.ctx.createImageData(w, h);
    this.outputBuffer = this.imageData.data;
    this.outputBuffer.set(originalData.data);
    this.originalRGBA = originalData.data;

    if (this.renderMode === "preserve-lightness") {
      // 원본 픽셀별 명도(L)/채도(S)는 색을 바꿀 때마다 다시 계산할 필요가 없으므로 로딩 시 1회만 뽑아둔다.
      const { l, s } = extractLightnessSaturation(this.originalRGBA, w * h);
      this.originalL = l;
      this.originalS = s;
    }

    this.maskStrength = new Float32Array(w * h);
    this._maskImageEl = null;
    let sizeMismatch = false;

    if (maskResult.ok) {
      this.hasMask = true;
      this._maskImageEl = maskResult.image;
      sizeMismatch =
        maskResult.image.naturalWidth !== naturalW || maskResult.image.naturalHeight !== naturalH;
      if (sizeMismatch) {
        console.error(
          "[mask-renderer] 원본과 마스크의 해상도가 다릅니다. 강제로 늘려서 맞춥니다:",
          maskSrc
        );
      }
      offCtx.clearRect(0, 0, w, h);
      offCtx.drawImage(maskResult.image, 0, 0, w, h);
      const maskData = offCtx.getImageData(0, 0, w, h);
      for (let i = 0; i < w * h; i++) {
        const idx = i * 4;
        // 마스크는 흰색(밝기)과 알파값 둘 다로 강도를 표현할 수 있게 한다.
        const gray = maskData.data[idx] / 255;
        const alpha = maskData.data[idx + 3] / 255;
        this.maskStrength[i] = gray * alpha;
      }
    } else {
      console.error("[mask-renderer] 마스크 이미지 로드 실패, 색상 변경이 비활성화됩니다:", maskSrc);
    }

    this.ctx.putImageData(this.imageData, 0, 0);
    this.ready = true;
    return { ok: true, maskMissing: !this.hasMask, sizeMismatch };
  }

  /** 색상 변경을 요청한다. 실제 그리기는 requestAnimationFrame에 맞춰 한 번만 실행된다. */
  setColor(hex) {
    if (!this.ready || !this.hasMask) return;
    this._currentHex = hex;
    this._pendingHex = hex;
    if (this._rafId) return;
    this._rafId = requestAnimationFrame(() => {
      this._rafId = null;
      this._paint(this._pendingHex);
    });
  }

  _paint(hex) {
    if (this.renderMode === "preserve-lightness" && this.originalL) {
      this._paintPreserveLightness(hex);
    } else {
      this._paintFlat(hex);
    }
    this.ctx.putImageData(this.imageData, 0, 0);
  }

  /**
   * 원본 픽셀의 명도(L)에 선택한 색의 명도를 오프셋으로 더하고, 선택한 색의 Hue를 입힌다.
   * 채도(S)는 선택색 채도에 원본 픽셀의 채도 비율을 곱해서 정하므로, 하이라이트는 밝고 옅은
   * 버전, 그림자는 어둡고 진한 버전으로 자연스럽게 바뀐다. 오프셋 방식이라 상대적 명암(텍스처)은
   * 유지하면서도 피커에서 어둡게/밝게 고르면 실제로 사진도 어두워지고/밝아진다. 마스크 알파
   * (strength)는 "원본과 이 결과색을 얼마나 섞을지"에만 쓰인다 — 명도 자체를 strength로 결정하지 않는다.
   */
  _paintPreserveLightness(hex) {
    const { r, g, b } = hexToRgb(hex);
    const { h: selH, s: selS, l: selL } = rgbToHsl({ r, g, b }); // 프레임당 1회만 계산
    paintPreserveLightnessBuffer(
      this.originalRGBA,
      this.outputBuffer,
      this.originalL,
      this.originalS,
      this.maskStrength,
      this.width * this.height,
      selH,
      selS,
      selL
    );
  }

  /** 레거시/미지원 renderMode 대비용: 마스크 영역을 고른 색 단색으로 그대로 덮는다. */
  _paintFlat(hex) {
    const { r, g, b } = hexToRgb(hex);
    paintFlatBuffer(this.originalRGBA, this.outputBuffer, this.maskStrength, this.width * this.height, r, g, b);
  }

  /** 화면 전환 시 예약된 렌더링 프레임을 취소한다 */
  destroy() {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this.ready = false;
  }

  /**
   * 결과 화면에 쓸 정지 이미지 데이터 URL. 실시간 편집용 캔버스는 성능을 위해
   * MAX_RENDER_SIZE로 축소되어 있으므로, 여기서는 원본 이미지 해상도로 딱 한 번 다시
   * 합성해서 "Original"과 같은 픽셀 크기의 결과를 돌려준다 (제출 시 1회뿐이라 비용 문제 없음).
   */
  snapshotDataURL() {
    try {
      if (this._originalImageEl) {
        return this._renderFullResolution(this._currentHex);
      }
      return this.canvas.toDataURL("image/png");
    } catch (err) {
      console.error("[mask-renderer] 캔버스 스냅샷 실패", err);
      return null;
    }
  }

  /** 원본 이미지의 자연 해상도로 마스크 합성을 다시 실행해 데이터 URL을 만든다. */
  _renderFullResolution(hex) {
    const w = this._naturalW;
    const h = this._naturalH;
    const total = w * h;

    const offscreen = document.createElement("canvas");
    offscreen.width = w;
    offscreen.height = h;
    const offCtx = offscreen.getContext("2d");

    offCtx.drawImage(this._originalImageEl, 0, 0, w, h);
    const orig = offCtx.getImageData(0, 0, w, h).data;

    if (!this.hasMask || !hex) {
      return offscreen.toDataURL("image/png");
    }

    const maskStrength = new Float32Array(total);
    if (this._maskImageEl) {
      offCtx.clearRect(0, 0, w, h);
      offCtx.drawImage(this._maskImageEl, 0, 0, w, h);
      const maskData = offCtx.getImageData(0, 0, w, h).data;
      for (let i = 0; i < total; i++) {
        const idx = i * 4;
        maskStrength[i] = (maskData[idx] / 255) * (maskData[idx + 3] / 255);
      }
    }

    const out = new Uint8ClampedArray(orig);
    const { r, g, b } = hexToRgb(hex);

    if (this.renderMode === "preserve-lightness") {
      const { l: lightness, s: saturation } = extractLightnessSaturation(orig, total);
      const { h: selH, s: selS, l: selL } = rgbToHsl({ r, g, b });
      paintPreserveLightnessBuffer(orig, out, lightness, saturation, maskStrength, total, selH, selS, selL);
    } else {
      paintFlatBuffer(orig, out, maskStrength, total, r, g, b);
    }

    const outCanvas = document.createElement("canvas");
    outCanvas.width = w;
    outCanvas.height = h;
    outCanvas.getContext("2d").putImageData(new ImageData(out, w, h), 0, 0);
    return outCanvas.toDataURL("image/png");
  }
}
