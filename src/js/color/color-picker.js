/**
 * 커스텀 색상 선택기
 * - 2D 패널: 가로 = 색상(Hue), 세로 = 채도(Saturation)
 * - 밝기 슬라이더: 세로 바
 * - 마우스, 터치(Pointer Events로 통합), 키보드(화살표) 모두 지원
 */

import { hexToRgb, rgbToHex } from "./color-convert.js";
import { iconSvg } from "../utils/dom.js";
import { t } from "../i18n.js";

const HS_RES = 96;

export class ColorPicker {
  constructor(root, { initialHex = "#808080", onChange } = {}) {
    this.root = root;
    this.onChange = onChange;
    this.hsv = rgbToHsv(hexToRgb(initialHex));
    this._rafId = null;

    this._buildDom();
    this._bindEvents();
    this._drawHsPanel();
    this._updateThumbs();
    this._updatePreview();
  }

  _buildDom() {
    this.root.innerHTML = `
      <div class="color-picker__controls">
        <div class="hs-panel" tabindex="0" role="slider" aria-label="${t("colorPicker.svAria")}"
             aria-valuemin="0" aria-valuemax="360">
          <canvas></canvas>
          <div class="hs-panel__thumb"></div>
        </div>
        <div class="value-slider" tabindex="0" role="slider" aria-label="${t("colorPicker.lightnessAria")}"
             aria-orientation="vertical" aria-valuemin="0" aria-valuemax="100">
          <svg class="value-slider__track" viewBox="0 0 64 320" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="value-track-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop class="value-slider__bright-stop" offset="0%" />
                <stop offset="100%" stop-color="#000000" />
              </linearGradient>
            </defs>
            <path d="M35 0 C33 9 22 17 25 26 S39 36 34 47 S25 62 31 72 S41 85 34 97 S27 113 31 126 S26 144 29 155 S40 168 34 180 S26 194 30 207 S26 222 31 233 S33 250 30 261 S33 281 32 291 S34 309 34 320"
                  fill="none" stroke="url(#value-track-gradient)" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <div class="value-slider__thumb"></div>
        </div>
      </div>
      <div class="color-picker__preview">
        <div class="color-swatch color-swatch--lg" aria-hidden="true"></div>
        <div>
          <div class="color-picker__hex-label">HEX</div>
          <div class="color-picker__hex"></div>
        </div>
        <div class="spacer"></div>
        <button type="button" class="btn btn--primary submit-color-btn" aria-label="${t("colorPicker.submitAria")}">
          ${t("colorPicker.submit")} ${iconSvg("check", 18)}
        </button>
      </div>
    `;

    this.hsPanel = this.root.querySelector(".hs-panel");
    this.hsCanvas = this.root.querySelector(".hs-panel canvas");
    this.hsCtx = this.hsCanvas.getContext("2d");
    this.hsThumb = this.root.querySelector(".hs-panel__thumb");
    this.valueSlider = this.root.querySelector(".value-slider");
    this.valueThumb = this.root.querySelector(".value-slider__thumb");
    this.valueBrightStop = this.root.querySelector(".value-slider__bright-stop");
    this.swatchEl = this.root.querySelector(".color-swatch--lg");
    this.hexEl = this.root.querySelector(".color-picker__hex");
    this.submitBtn = this.root.querySelector(".submit-color-btn");

    this.hsCanvas.width = HS_RES;
    this.hsCanvas.height = HS_RES;
  }

  onSubmit(handler) {
    this.submitBtn.addEventListener("click", handler);
  }

  _bindEvents() {
    this._bindDrag(this.hsPanel, (x, y, rect) => {
      const h = clamp01(x / rect.width) * 360;
      const s = 100 - clamp01(y / rect.height) * 100;
      this._setHsv({ h, s });
    });

    this._bindDrag(this.valueSlider, (_x, y, rect) => {
      const v = 100 - clamp01((y / rect.height - 0.08) / 0.84) * 100;
      this._setHsv({ v });
    });

    this.hsPanel.addEventListener("keydown", (e) => {
      const hueStep = e.shiftKey ? 20 : 5;
      const saturationStep = e.shiftKey ? 10 : 3;
      if (e.key === "ArrowRight") this._setHsv({ h: (this.hsv.h + hueStep) % 360 });
      else if (e.key === "ArrowLeft") this._setHsv({ h: (this.hsv.h - hueStep + 360) % 360 });
      else if (e.key === "ArrowUp") this._setHsv({ s: clamp(this.hsv.s + saturationStep, 0, 100) });
      else if (e.key === "ArrowDown") this._setHsv({ s: clamp(this.hsv.s - saturationStep, 0, 100) });
      else return;
      e.preventDefault();
    });

    this.valueSlider.addEventListener("keydown", (e) => {
      const step = e.shiftKey ? 10 : 3;
      if (e.key === "ArrowRight" || e.key === "ArrowUp") this._setHsv({ v: clamp(this.hsv.v + step, 0, 100) });
      else if (e.key === "ArrowLeft" || e.key === "ArrowDown") this._setHsv({ v: clamp(this.hsv.v - step, 0, 100) });
      else return;
      e.preventDefault();
    });

  }

  _bindDrag(element, onMove) {
    let dragging = false;

    const handleMove = (clientX, clientY) => {
      const rect = element.getBoundingClientRect();
      const x = clamp(clientX - rect.left, 0, rect.width);
      const y = clamp(clientY - rect.top, 0, rect.height);
      onMove(x, y, rect);
    };

    element.addEventListener("pointerdown", (e) => {
      dragging = true;
      element.setPointerCapture(e.pointerId);
      document.body.classList.add("is-dragging");
      element.focus();
      handleMove(e.clientX, e.clientY);
    });

    element.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      handleMove(e.clientX, e.clientY);
    });

    const stop = (e) => {
      if (!dragging) return;
      dragging = false;
      document.body.classList.remove("is-dragging");
      try {
        element.releasePointerCapture(e.pointerId);
      } catch {
        // 이미 해제된 경우 무시
      }
    };

    element.addEventListener("pointerup", stop);
    element.addEventListener("pointercancel", stop);
  }

  _setHsv(partial) {
    this.hsv = { ...this.hsv, ...partial };
    if (this._rafId !== null) return;
    this._rafId = requestAnimationFrame(() => {
      this._rafId = null;
      this._updateThumbs();
      this._updatePreview();
      this.onChange?.(this.getHex());
    });
  }

  destroy() {
    if (this._rafId !== null) cancelAnimationFrame(this._rafId);
    this._rafId = null;
    document.body.classList.remove("is-dragging");
  }

  setColorHex(hex, { silent = false } = {}) {
    if (this._rafId !== null) cancelAnimationFrame(this._rafId);
    this._rafId = null;
    this.hsv = rgbToHsv(hexToRgb(hex));
    this._drawHsPanel();
    this._updateThumbs();
    this._updatePreview();
    if (!silent) this.onChange?.(this.getHex());
  }

  getHex() {
    return rgbToHex(hsvToRgb(this.hsv));
  }

  _drawHsPanel() {
    const imageData = this.hsCtx.createImageData(HS_RES, HS_RES);
    for (let y = 0; y < HS_RES; y++) {
      const s = 100 - (y / (HS_RES - 1)) * 100;
      for (let x = 0; x < HS_RES; x++) {
        const h = (x / (HS_RES - 1)) * 360;
        const { r, g, b } = hsvToRgb({ h, s, v: 100 });
        const i = (y * HS_RES + x) * 4;
        imageData.data[i] = Math.round(r);
        imageData.data[i + 1] = Math.round(g);
        imageData.data[i + 2] = Math.round(b);
        imageData.data[i + 3] = 255;
      }
    }
    this.hsCtx.putImageData(imageData, 0, 0);
  }

  _updateThumbs() {
    const { h, s, v } = this.hsv;
    this.hsThumb.style.left = `${(h / 360) * 100}%`;
    this.hsThumb.style.top = `${100 - s}%`;
    this.valueThumb.style.top = `${8 + (100 - v) * 0.84}%`;

    this.hsPanel.setAttribute("aria-valuenow", Math.round(h));
    this.hsPanel.setAttribute(
      "aria-valuetext",
      t("colorPicker.svValueText", { h: Math.round(h), s: Math.round(s) })
    );
    this.valueSlider.setAttribute("aria-valuenow", Math.round(v));
    this.valueBrightStop.setAttribute("stop-color", rgbToHex(hsvToRgb({ h, s, v: 100 })));
  }

  _updatePreview() {
    const hex = this.getHex();
    this.swatchEl.style.background = hex;
    this.hexEl.textContent = hex;
  }
}

function rgbToHsv({ r, g, b }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;

  if (delta !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / delta) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / delta + 2);
    else h = 60 * ((rn - gn) / delta + 4);
  }

  if (h < 0) h += 360;
  return { h, s: max === 0 ? 0 : (delta / max) * 100, v: max * 100 };
}

function hsvToRgb({ h, s, v }) {
  const hue = ((h % 360) + 360) % 360;
  const sn = s / 100;
  const vn = v / 100;
  const c = vn * sn;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = vn - c;
  let rgb = [0, 0, 0];

  if (hue < 60) rgb = [c, x, 0];
  else if (hue < 120) rgb = [x, c, 0];
  else if (hue < 180) rgb = [0, c, x];
  else if (hue < 240) rgb = [0, x, c];
  else if (hue < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];

  return { r: (rgb[0] + m) * 255, g: (rgb[1] + m) * 255, b: (rgb[2] + m) * 255 };
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}
function clamp01(v) {
  return clamp(v, 0, 1);
}
