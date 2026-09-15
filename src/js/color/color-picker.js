/**
 * 커스텀 색상 선택기
 * - 2D 패널: 가로 = 채도(Saturation), 세로 = 명도(Lightness)
 * - Hue 슬라이더: 가로 바
 * - 마우스, 터치(Pointer Events로 통합), 키보드(화살표) 모두 지원
 */

import { hslToHex, hexToHsl } from "./color-convert.js";
import { iconSvg } from "../utils/dom.js";
import { t } from "../i18n.js";

const SV_RES = 64; // 채도/명도 패널 내부 렌더링 해상도 (Hue가 바뀔 때만 다시 그림)

export class ColorPicker {
  constructor(root, { initialHex = "#808080", onChange } = {}) {
    this.root = root;
    this.onChange = onChange;
    this.hsl = hexToHsl(initialHex);

    this._buildDom();
    this._bindEvents();
    this._drawSvPanel();
    this._updateThumbs();
    this._updatePreview();
  }

  _buildDom() {
    this.root.innerHTML = `
      <div class="sv-panel" tabindex="0" role="slider" aria-label="${t("colorPicker.svAria")}"
           aria-valuemin="0" aria-valuemax="100">
        <canvas></canvas>
        <div class="sv-panel__thumb"></div>
      </div>
      <div class="hue-slider" tabindex="0" role="slider" aria-label="${t("colorPicker.hueAria")}"
           aria-orientation="horizontal" aria-valuemin="0" aria-valuemax="360"
           style="background: linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000);">
        <div class="hue-slider__thumb"></div>
      </div>
      <div class="lightness-slider" tabindex="0" role="slider" aria-label="${t("colorPicker.lightnessAria")}"
           aria-orientation="horizontal" aria-valuemin="0" aria-valuemax="100">
        <div class="lightness-slider__thumb"></div>
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

    this.svPanel = this.root.querySelector(".sv-panel");
    this.svCanvas = this.root.querySelector(".sv-panel canvas");
    this.svCtx = this.svCanvas.getContext("2d");
    this.svThumb = this.root.querySelector(".sv-panel__thumb");
    this.hueSlider = this.root.querySelector(".hue-slider");
    this.hueThumb = this.root.querySelector(".hue-slider__thumb");
    this.lightnessSlider = this.root.querySelector(".lightness-slider");
    this.lightnessThumb = this.root.querySelector(".lightness-slider__thumb");
    this.swatchEl = this.root.querySelector(".color-swatch--lg");
    this.hexEl = this.root.querySelector(".color-picker__hex");
    this.submitBtn = this.root.querySelector(".submit-color-btn");

    this.svCanvas.width = SV_RES;
    this.svCanvas.height = SV_RES;
  }

  onSubmit(handler) {
    this.submitBtn.addEventListener("click", handler);
  }

  _bindEvents() {
    this._bindDrag(this.svPanel, (x, y, rect) => {
      const s = clamp01(x / rect.width) * 100;
      const l = 100 - clamp01(y / rect.height) * 100;
      this._setHsl({ s, l });
    });

    this._bindDrag(this.hueSlider, (x, _y, rect) => {
      const h = clamp01(x / rect.width) * 360;
      this._setHsl({ h });
    });

    this._bindDrag(this.lightnessSlider, (x, _y, rect) => {
      const l = clamp01(x / rect.width) * 100;
      this._setHsl({ l });
    });

    this.svPanel.addEventListener("keydown", (e) => {
      const step = e.shiftKey ? 10 : 3;
      if (e.key === "ArrowRight") this._setHsl({ s: clamp(this.hsl.s + step, 0, 100) });
      else if (e.key === "ArrowLeft") this._setHsl({ s: clamp(this.hsl.s - step, 0, 100) });
      else if (e.key === "ArrowUp") this._setHsl({ l: clamp(this.hsl.l + step, 0, 100) });
      else if (e.key === "ArrowDown") this._setHsl({ l: clamp(this.hsl.l - step, 0, 100) });
      else return;
      e.preventDefault();
    });

    this.hueSlider.addEventListener("keydown", (e) => {
      const step = e.shiftKey ? 20 : 5;
      if (e.key === "ArrowRight" || e.key === "ArrowUp") this._setHsl({ h: (this.hsl.h + step) % 360 });
      else if (e.key === "ArrowLeft" || e.key === "ArrowDown")
        this._setHsl({ h: (this.hsl.h - step + 360) % 360 });
      else return;
      e.preventDefault();
    });

    this.lightnessSlider.addEventListener("keydown", (e) => {
      const step = e.shiftKey ? 20 : 5;
      if (e.key === "ArrowRight" || e.key === "ArrowUp") this._setHsl({ l: clamp(this.hsl.l + step, 0, 100) });
      else if (e.key === "ArrowLeft" || e.key === "ArrowDown")
        this._setHsl({ l: clamp(this.hsl.l - step, 0, 100) });
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

  _setHsl(partial) {
    this.hsl = { ...this.hsl, ...partial };
    if (partial.h !== undefined) this._drawSvPanel();
    this._updateThumbs();
    this._updatePreview();
    this.onChange?.(this.getHex());
  }

  setColorHex(hex, { silent = false } = {}) {
    this.hsl = hexToHsl(hex);
    this._drawSvPanel();
    this._updateThumbs();
    this._updatePreview();
    if (!silent) this.onChange?.(this.getHex());
  }

  getHex() {
    return hslToHex(this.hsl);
  }

  _drawSvPanel() {
    const imageData = this.svCtx.createImageData(SV_RES, SV_RES);
    const { h } = this.hsl;
    for (let y = 0; y < SV_RES; y++) {
      const l = 100 - (y / (SV_RES - 1)) * 100;
      for (let x = 0; x < SV_RES; x++) {
        const s = (x / (SV_RES - 1)) * 100;
        const hex = hslToHex({ h, s, l });
        const i = (y * SV_RES + x) * 4;
        imageData.data[i] = parseInt(hex.slice(1, 3), 16);
        imageData.data[i + 1] = parseInt(hex.slice(3, 5), 16);
        imageData.data[i + 2] = parseInt(hex.slice(5, 7), 16);
        imageData.data[i + 3] = 255;
      }
    }
    this.svCtx.putImageData(imageData, 0, 0);
  }

  _updateThumbs() {
    const { h, s, l } = this.hsl;
    this.svThumb.style.left = `${s}%`;
    this.svThumb.style.top = `${100 - l}%`;
    this.hueThumb.style.left = `${(h / 360) * 100}%`;
    this.lightnessThumb.style.left = `${l}%`;
    this.lightnessSlider.style.background = `linear-gradient(to right, #000000, ${hslToHex({
      h,
      s,
      l: 50,
    })}, #ffffff)`;

    this.svPanel.setAttribute("aria-valuenow", Math.round(s));
    this.svPanel.setAttribute(
      "aria-valuetext",
      t("colorPicker.svValueText", { s: Math.round(s), l: Math.round(l) })
    );
    this.hueSlider.setAttribute("aria-valuenow", Math.round(h));
    this.lightnessSlider.setAttribute("aria-valuenow", Math.round(l));
  }

  _updatePreview() {
    const hex = this.getHex();
    this.swatchEl.style.background = hex;
    this.hexEl.textContent = hex;
  }
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}
function clamp01(v) {
  return clamp(v, 0, 1);
}
