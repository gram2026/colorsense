/** 오른쪽 패널 - "정답 색상" 탭: 자동 추출 후보 + 수동 보정(HEX/RGB/HSL/스포이드) */

import { qs, iconSvg } from "../utils/dom-utils.js";
import { hexToRgb, rgbToHex, hexToHsl, hslToHex, isValidHex } from "../utils/color-utils.js";

export function renderColorPanel(root, { color, tool, onExtract, onSetColor, onEyedropperToggle }) {
  const hex = color.answerColor || "#808080";
  const rgb = hexToRgb(hex);
  const hsl = hexToHsl(hex);
  const consistencyPct = Math.round((color.consistency ?? 0) * 100);

  root.innerHTML = `
    <button type="button" class="btn btn--primary btn--block" data-action="extract">
      ${iconSvg("wand", 18)}<span>마스크에서 정답 색상 추출</span>
    </button>

    ${
      color.empty
        ? `<p class="empty-state">마스크가 비어 있어 추출할 수 없습니다. 먼저 색을 바꿀 영역을 선택하세요.</p>`
        : ""
    }

    <div class="color-preview-lg">
      <div class="color-preview-lg__swatch" data-role="preview-swatch" style="background:${hex}"></div>
      <div class="color-preview-lg__meta">
        <div class="color-preview-lg__hex" data-role="preview-hex">${hex}</div>
        <div class="color-preview-lg__sub" data-role="preview-rgb">RGB ${rgb.r}, ${rgb.g}, ${rgb.b}</div>
        <div class="color-preview-lg__sub" data-role="preview-hsl">HSL ${Math.round(hsl.h)}, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%</div>
        <div class="color-preview-lg__sub" data-role="preview-source">${color.source === "manual" ? "수동 수정됨" : "자동 추출"}</div>
      </div>
    </div>

    ${
      color.candidates && color.candidates.length > 0
        ? `
      <div class="field">
        <label class="field__label">색상 분포 일관성 (참고용)</label>
        <div class="consistency-bar"><div class="consistency-bar__fill" style="width:${consistencyPct}%"></div></div>
        <span class="field__hint">마스크 안 색상이 얼마나 고르게 모여 있는지 참고하는 값입니다. 정확도를 보장하지는 않습니다.</span>
      </div>

      <div class="field">
        <label class="field__label">후보 색상</label>
        <div class="color-candidates" data-role="candidates">
          ${color.candidates
            .map(
              (c) => `
            <button type="button" class="color-candidate${c.hex === hex ? " is-selected" : ""}" data-hex="${c.hex}" title="${c.label}: ${c.hex}">
              <span class="color-candidate__swatch" style="background:${c.hex}"></span>
              <span class="color-candidate__label">${c.label}</span>
            </button>`
            )
            .join("")}
        </div>
      </div>
    `
        : ""
    }

    <div class="field">
      <label class="field__label" for="mk-hex">HEX 직접 입력</label>
      <input id="mk-hex" class="maker-input" type="text" data-role="hex-input" value="${hex}" maxlength="7" />
      <span class="field__error" data-role="hex-error" hidden>올바른 #RRGGBB 형식이 아닙니다.</span>
    </div>

    <div class="field">
      <label class="field__label">RGB</label>
      ${rgbSlider("r", "R", rgb.r)}
      ${rgbSlider("g", "G", rgb.g)}
      ${rgbSlider("b", "B", rgb.b)}
    </div>

    <div class="field">
      <label class="field__label">HSL</label>
      ${hslSlider("h", "H", hsl.h, 360)}
      ${hslSlider("s", "S", hsl.s, 100)}
      ${hslSlider("l", "L", hsl.l, 100)}
    </div>

    <div class="field">
      <button type="button" class="btn btn--secondary btn--block${tool.current === "eyedropper" ? " is-active" : ""}" data-action="eyedropper">
        ${iconSvg("eyedropper", 18)}<span>스포이드로 원본에서 찍기 (I)</span>
      </button>
      <div class="maker-checkbox-row" style="margin-top:8px;">
        <label class="field__label" style="margin:0;">평균 범위</label>
        <select class="maker-select" style="width:auto;" data-role="eyedropper-sample">
          <option value="1" ${tool.eyedropperSample === 1 ? "selected" : ""}>1×1</option>
          <option value="5" ${!tool.eyedropperSample || tool.eyedropperSample === 5 ? "selected" : ""}>5×5</option>
          <option value="7" ${tool.eyedropperSample === 7 ? "selected" : ""}>7×7</option>
        </select>
      </div>
    </div>

    <button type="button" class="btn btn--ghost btn--block" data-action="revert-auto" ${!color.autoHex ? "disabled" : ""}>
      ${iconSvg("refresh", 16)}<span>자동 추천색으로 되돌리기</span>
    </button>

    ${
      color.recent && color.recent.length > 0
        ? `
      <div class="field">
        <label class="field__label">최근 선택 색상</label>
        <div class="recent-colors" data-role="recent-colors">
          ${color.recent.map((h) => `<button type="button" class="recent-color-swatch" style="background:${h}" data-hex="${h}" title="${h}"></button>`).join("")}
        </div>
      </div>
    `
        : ""
    }
  `;

  qs('[data-action="extract"]', root).addEventListener("click", () => onExtract());

  root.querySelectorAll("[data-hex]").forEach((swatchEl) => {
    swatchEl.addEventListener("click", () => onSetColor(swatchEl.dataset.hex, "auto"));
  });

  const hexInput = qs('[data-role="hex-input"]', root);
  hexInput.addEventListener("change", () => {
    const value = hexInput.value.startsWith("#") ? hexInput.value : `#${hexInput.value}`;
    const errorEl = qs('[data-role="hex-error"]', root);
    if (!isValidHex(value)) {
      errorEl.hidden = false;
      return;
    }
    errorEl.hidden = true;
    onSetColor(value.toUpperCase(), "manual");
  });

  root.querySelectorAll("[data-rgb]").forEach((input) => {
    input.addEventListener("input", () => {
      const channel = input.dataset.rgb;
      const next = { ...hexToRgb(hex), [channel]: Number(input.value) };
      onSetColor(rgbToHex(next), "manual");
    });
  });

  root.querySelectorAll("[data-hsl]").forEach((input) => {
    input.addEventListener("input", () => {
      const channel = input.dataset.hsl;
      const next = { ...hexToHsl(hex), [channel]: Number(input.value) };
      onSetColor(hslToHex(next), "manual");
    });
  });

  qs('[data-action="eyedropper"]', root).addEventListener("click", () => onEyedropperToggle());
  qs('[data-role="eyedropper-sample"]', root).addEventListener("change", (e) => {
    onEyedropperToggle({ sampleOnly: true, sample: Number(e.target.value) });
  });

  qs('[data-action="revert-auto"]', root).addEventListener("click", () => {
    if (color.autoHex) onSetColor(color.autoHex, "auto");
  });
}

function rgbSlider(channel, label, value) {
  return `
    <div class="field__range-row">
      <span style="width:16px;font-size:11px;font-weight:700;">${label}</span>
      <input type="range" class="maker-range" min="0" max="255" value="${Math.round(value)}" data-rgb="${channel}" />
      <span class="field__range-value">${Math.round(value)}</span>
    </div>
  `;
}

function hslSlider(channel, label, value, max) {
  return `
    <div class="field__range-row">
      <span style="width:16px;font-size:11px;font-weight:700;">${label}</span>
      <input type="range" class="maker-range" min="0" max="${max}" value="${Math.round(value)}" data-hsl="${channel}" />
      <span class="field__range-value">${Math.round(value)}</span>
    </div>
  `;
}
