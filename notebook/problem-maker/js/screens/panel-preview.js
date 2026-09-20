/**
 * 오른쪽 패널 - "미리보기" 탭.
 * 실제 색상 합성은 preview-renderer.js(게임의 MaskRenderer)가 전담하고,
 * 여기서는 "어떤 색을 보여줄지"만 고른다.
 */

import { qs, iconSvg } from "../utils/dom-utils.js";
import { hexToHsv, hsvToHex } from "../utils/color-utils.js";
import { loadGameConfig } from "../project-loader.js";

export function renderPreviewPanel(root, { view, color, onSetPreviewHex, onToggleCompare }) {
  const answerHex = color.answerColor || "#808080";

  root.innerHTML = `
    <p class="field__hint">
      아래 미리보기는 게임 본체의 색상 합성 코드(MaskRenderer)를 그대로 사용합니다.
      상단 캔버스 툴바에서 "색상 결과" 보기를 선택하면 여기서 고른 색이 반영됩니다.
    </p>

    <div class="field">
      <label class="field__label">미리볼 색상</label>
      <div class="maker-checkbox-row">
        <label><input type="radio" name="preview-source" value="answer" ${!view.previewHex || view.previewHex === answerHex ? "checked" : ""} /> 정답 색상</label>
      </div>
      <div class="maker-checkbox-row">
        <label><input type="radio" name="preview-source" value="random" /> 임의 시작 색상</label>
        <button type="button" class="btn btn--secondary btn--sm" data-action="reroll">${iconSvg("refresh", 14)}다시 뽑기</button>
      </div>
      <div class="maker-checkbox-row">
        <label><input type="radio" name="preview-source" value="custom" ${view.previewHex && view.previewHex !== answerHex ? "checked" : ""} /> 직접 지정</label>
        <input type="color" data-role="custom-color" value="${view.previewHex || "#808080"}" />
      </div>
    </div>

    <label class="maker-checkbox-row">
      <input type="checkbox" data-role="compare-toggle" ${view.compareMode ? "checked" : ""} />
      전후 비교 슬라이더로 보기
    </label>
  `;

  root.querySelectorAll('input[name="preview-source"]').forEach((radio) => {
    radio.addEventListener("change", async () => {
      if (!radio.checked) return;
      if (radio.value === "answer") onSetPreviewHex(answerHex);
      else if (radio.value === "custom") onSetPreviewHex(qs('[data-role="custom-color"]', root).value);
      else if (radio.value === "random") onSetPreviewHex(await randomStartColor(answerHex));
    });
  });

  qs('[data-action="reroll"]', root).addEventListener("click", async () => {
    root.querySelector('input[name="preview-source"][value="random"]').checked = true;
    onSetPreviewHex(await randomStartColor(answerHex));
  });

  qs('[data-role="custom-color"]', root).addEventListener("input", (e) => {
    root.querySelector('input[name="preview-source"][value="custom"]').checked = true;
    onSetPreviewHex(e.target.value);
  });

  qs('[data-role="compare-toggle"]', root).addEventListener("change", (e) => onToggleCompare(e.target.checked));
}

/** 게임 game.js의 generateStartColor()와 같은 방식(HSV 기준 색상/채도 오프셋 + 고정 밝기)으로 임의 시작색을 만든다 */
async function randomStartColor(answerHex) {
  const config = await loadGameConfig().catch(() => null);
  const cfg = config?.startColor || {};
  const minHue = cfg.minHueOffsetDeg ?? 35;
  const maxHue = cfg.maxHueOffsetDeg ?? 65;
  const minSat = cfg.minSaturationOffset ?? 16;
  const maxSat = cfg.maxSaturationOffset ?? 30;
  const startValue = cfg.startValue ?? 93;

  const { h, s } = hexToHsv(answerHex);
  const hueOffset = randomBetween(minHue, maxHue) * (Math.random() < 0.5 ? -1 : 1);
  const satMagnitude = randomBetween(minSat, maxSat);
  // 패널 가장자리에 걸려 잘리면 정답 쪽으로 도로 붙으므로, 그럴 때는 반대 방향으로 뺀다.
  let satOffset = satMagnitude * (Math.random() < 0.5 ? -1 : 1);
  if (s + satOffset > 100 || s + satOffset < 15) satOffset = -satOffset;

  const newHue = (h + hueOffset + 360) % 360;
  const newSat = clamp(s + satOffset, 15, 100);

  return hsvToHex({ h: newHue, s: newSat, v: startValue });
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}
function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}
