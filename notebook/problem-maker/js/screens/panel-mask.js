/**
 * 오른쪽 패널 - "마스크" 탭: 브러시/스마트선택 설정.
 * 전체선택/해제/반전/확장/축소/페더/구멍채우기/고립픽셀제거 버튼은 왼쪽 도구 모음으로 옮겼고,
 * 여기서는 확장/축소/페더/구멍채우기/고립픽셀제거에 쓸 수치만 미리 조절해둔다
 * (왼쪽 버튼과 단축키 모두 이 수치를 그대로 읽어서 실행한다).
 */

import { qs } from "../utils/dom-utils.js";

export function renderMaskPanel(root, { tool, view, onToolPatch, onViewPatch }) {
  root.innerHTML = `
    <div class="field">
      <label class="field__label">브러시 / 지우개 크기</label>
      <div class="field__range-row">
        <input type="range" class="maker-range" min="2" max="400" step="1" value="${tool.brushSize}" data-field="brushSize" />
        <span class="field__range-value" data-role="brushSize-value">${tool.brushSize}</span>
      </div>
    </div>
    <div class="field">
      <label class="field__label">경도(가장자리 부드러움)</label>
      <div class="field__range-row">
        <input type="range" class="maker-range" min="0" max="100" step="1" value="${Math.round(tool.brushHardness * 100)}" data-field="brushHardness" />
        <span class="field__range-value" data-role="brushHardness-value">${Math.round(tool.brushHardness * 100)}%</span>
      </div>
    </div>

    <hr style="border:0;border-top:var(--border-width) solid var(--border-color);margin:var(--space-2) 0;" />

    <div class="field">
      <label class="field__label">스마트 선택 허용 오차</label>
      <div class="field__range-row">
        <input type="range" class="maker-range" min="1" max="100" step="1" value="${tool.smartTolerance}" data-field="smartTolerance" />
        <span class="field__range-value" data-role="smartTolerance-value">${tool.smartTolerance}</span>
      </div>
      <span class="field__hint">LAB 색상 거리(deltaE) 기준. 값이 클수록 더 넓게 선택됩니다.</span>
    </div>
    <div class="field">
      <label class="field__label">스마트 선택 범위</label>
      <div class="maker-checkbox-row">
        <label><input type="radio" name="smart-mode" value="contiguous" ${tool.smartMode !== "global" ? "checked" : ""} /> 인접 픽셀만</label>
      </div>
      <div class="maker-checkbox-row">
        <label><input type="radio" name="smart-mode" value="global" ${tool.smartMode === "global" ? "checked" : ""} /> 이미지 전체에서</label>
      </div>
    </div>
    <div class="field">
      <label class="field__label">확정 시 반영 방식</label>
      <div class="maker-checkbox-row">
        <label><input type="radio" name="tool-op" value="add" ${tool.op !== "subtract" ? "checked" : ""} /> 마스크에 추가</label>
      </div>
      <div class="maker-checkbox-row">
        <label><input type="radio" name="tool-op" value="subtract" ${tool.op === "subtract" ? "checked" : ""} /> 마스크에서 제거</label>
      </div>
      <span class="field__hint">다각형 선택과 스마트 선택 확정 모두 이 설정을 따릅니다.</span>
    </div>

    <hr style="border:0;border-top:var(--border-width) solid var(--border-color);margin:var(--space-2) 0;" />

    <div class="field">
      <label class="field__label">마스크 오버레이</label>
      <div class="field-row">
        <input type="color" data-field="maskOverlayColor" value="${view.maskOverlayColor}" />
        <div class="field__range-row" style="flex:1">
          <input type="range" class="maker-range" min="10" max="100" step="1" value="${Math.round(view.maskOverlayOpacity * 100)}" data-field="maskOverlayOpacity" />
          <span class="field__range-value" data-role="overlayOpacity-value">${Math.round(view.maskOverlayOpacity * 100)}%</span>
        </div>
      </div>
    </div>

    <hr style="border:0;border-top:var(--border-width) solid var(--border-color);margin:var(--space-2) 0;" />

    <label class="field__label">선택 도구 수치 (왼쪽 도구 모음에서 실행)</label>
    ${maskOpAmountField("expand", "선택 영역 확장 (Shift+])", 6)}
    ${maskOpAmountField("contract", "선택 영역 축소 (Shift+[)", 6)}
    ${maskOpAmountField("feather", "가장자리 부드럽게 (F)", 4)}
    ${maskOpAmountField("fillHoles", "작은 구멍 채우기 (H)", 6)}
    ${maskOpAmountField("despeckle", "고립 픽셀 제거 최소 픽셀 수 (X)", 24, 1, 500)}
  `;

  root.querySelectorAll("[data-field]").forEach((fieldEl) => {
    const field = fieldEl.dataset.field;
    fieldEl.addEventListener("input", () => {
      let value = fieldEl.value;
      if (field === "brushSize") {
        value = Number(value);
        qs('[data-role="brushSize-value"]', root).textContent = value;
        onToolPatch({ brushSize: value });
      } else if (field === "brushHardness") {
        const pct = Number(value);
        qs('[data-role="brushHardness-value"]', root).textContent = `${pct}%`;
        onToolPatch({ brushHardness: pct / 100 });
      } else if (field === "smartTolerance") {
        value = Number(value);
        qs('[data-role="smartTolerance-value"]', root).textContent = value;
        onToolPatch({ smartTolerance: value });
      } else if (field === "maskOverlayColor") {
        onViewPatch({ maskOverlayColor: value });
      } else if (field === "maskOverlayOpacity") {
        const pct = Number(value);
        qs('[data-role="overlayOpacity-value"]', root).textContent = `${pct}%`;
        onViewPatch({ maskOverlayOpacity: pct / 100 });
      }
    });
  });

  root.querySelectorAll('input[name="smart-mode"]').forEach((radio) => {
    radio.addEventListener("change", () => radio.checked && onToolPatch({ smartMode: radio.value }));
  });
  root.querySelectorAll('input[name="tool-op"]').forEach((radio) => {
    radio.addEventListener("change", () => radio.checked && onToolPatch({ op: radio.value }));
  });
}

function maskOpAmountField(op, label, defaultValue, min = 1, max = 60) {
  return `
    <div class="field">
      <label class="field__label" for="mk-maskop-${op}">${label}</label>
      <input id="mk-maskop-${op}" type="number" class="maker-input" min="${min}" max="${max}" value="${defaultValue}" data-mask-op-value="${op}" />
    </div>
  `;
}
