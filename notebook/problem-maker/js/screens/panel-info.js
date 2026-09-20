/** 오른쪽 패널 - "문제 정보" 탭 */

import { qs, el } from "../utils/dom-utils.js";
import {
  loadUsableCategories,
  suggestQuestionId,
  isValidQuestionId,
  isIdTaken,
} from "../project-loader.js";
import { SUPPORTED_RENDER_MODES } from "../../../src/js/utils/validation.js";

let categoriesCache = null;

export async function renderInfoPanel(root, { project, sourceFileName, color, onPatch, onExtract, onDirectAdd }) {
  if (!categoriesCache) categoriesCache = await loadUsableCategories();
  const categories = categoriesCache;

  root.innerHTML = `
    <div class="field">
      <span class="field__label" id="mk-category-label">카테고리</span>
      <input type="hidden" id="mk-category" value="${escapeAttr(project.categoryId)}" />
      <div class="maker-category-buttons" role="group" aria-labelledby="mk-category-label">
        ${categories
          .map(
            (c) =>
              `<button type="button" class="btn btn--sm ${c.id === project.categoryId ? "btn--primary" : "btn--secondary"}" data-category="${escapeAttr(c.id)}" aria-pressed="${c.id === project.categoryId}">${escapeHtml(c.name)}</button>`
          )
          .join("")}
      </div>
      <span class="field__hint">게임의 categories.json에서 자동으로 불러온 목록입니다.</span>
    </div>

    <div class="field">
      <label class="field__label" for="mk-id">문제 ID</label>
      <div class="field-row">
        <input id="mk-id" class="maker-input" type="text" data-field="id" value="${escapeAttr(project.id)}" placeholder="objects-20260730-001" />
        <button type="button" class="btn btn--secondary btn--sm" data-action="suggest-id">자동 생성</button>
      </div>
      <span class="field__hint">영문 소문자/숫자/하이픈만, 카테고리 안에서 고유해야 합니다.</span>
      <span class="field__error" data-role="id-error" hidden></span>
    </div>

    <div class="field">
      <label class="field__label" for="mk-title">문제 제목</label>
      <input id="mk-title" class="maker-input" type="text" data-field="title" value="${escapeAttr(project.title)}" placeholder="예: 신호등" />
    </div>

    <div class="maker-answer-row">
      <button type="button" class="btn btn--secondary btn--sm" data-action="extract-answer">마스크에서 정답 추출</button>
      <span class="maker-answer-swatch" data-role="answer-swatch" role="img"></span>
    </div>
    <button type="button" class="btn btn--primary btn--block" data-action="direct-add">게임 프로젝트에 바로 추가</button>

    <div class="field-row">
      <div class="field">
        <label class="field__label" for="mk-difficulty">난이도</label>
        <select id="mk-difficulty" class="maker-select" data-field="difficulty">
          ${[1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${Number(project.difficulty) === n ? "selected" : ""}>${n}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label class="field__label" for="mk-rendermode">렌더링 방식</label>
        <select id="mk-rendermode" class="maker-select" data-field="renderMode">
          ${SUPPORTED_RENDER_MODES.map((m) => `<option value="${m}" ${project.renderMode === m ? "selected" : ""}>${m}</option>`).join("")}
        </select>
      </div>
    </div>

    <div class="field">
      <label class="field__label">태그</label>
      <div class="tag-list" data-role="tag-list"></div>
      <input class="maker-input" type="text" data-role="tag-input" placeholder="태그 입력 후 Enter" />
    </div>

    <div class="field">
      <label class="field__label">시작 색상</label>
      <div class="maker-checkbox-row">
        <label><input type="radio" name="start-color-mode" value="auto" ${project.startColorMode !== "fixed" ? "checked" : ""} /> 게임에서 자동 생성</label>
      </div>
      <div class="maker-checkbox-row">
        <label><input type="radio" name="start-color-mode" value="fixed" ${project.startColorMode === "fixed" ? "checked" : ""} /> 고정 시작 색상</label>
        <input type="color" data-field="startColorFixed" value="${project.startColorFixed || "#808080"}" ${project.startColorMode !== "fixed" ? "disabled" : ""} />
      </div>
    </div>

    <label class="maker-checkbox-row">
      <input type="checkbox" data-field="enabled" ${project.enabled !== false ? "checked" : ""} />
      게임에서 바로 활성화 (체크 해제 시 등록만 되고 노출되지 않음)
    </label>

    <div class="field">
      <label class="field__label" for="mk-author-note">제작자 메모</label>
      <textarea id="mk-author-note" class="maker-textarea" data-field="authorNote" placeholder="내부 참고용 메모 (게임에는 노출되지 않음)">${escapeHtml(project.authorNote || "")}</textarea>
    </div>

    <div class="field">
      <label class="field__label" for="mk-source-note">원본 출처 메모</label>
      <textarea id="mk-source-note" class="maker-textarea" data-field="sourceNote" placeholder="사진 출처, 촬영/구매 정보 등">${escapeHtml(project.sourceNote || "")}</textarea>
    </div>

    <label class="maker-checkbox-row">
      <input type="checkbox" data-field="copyrightConfirmed" ${project.copyrightConfirmed ? "checked" : ""} />
      이 이미지를 게임에 사용할 저작권/사용 권한을 확인했습니다.
    </label>
  `;

  renderTags(root, project.tags || [], onPatch);
  updateAnswerSwatch(root, color?.answerColor);
  qs('[data-action="extract-answer"]', root).addEventListener("click", onExtract);
  qs('[data-action="direct-add"]', root).addEventListener("click", onDirectAdd);
  root.querySelectorAll('[data-category]').forEach((button) => {
    button.addEventListener("click", () => {
      const categoryId = button.dataset.category;
      qs("#mk-category", root).value = categoryId;
      root.querySelectorAll('[data-category]').forEach((option) => {
        const selected = option === button;
        option.setAttribute("aria-pressed", String(selected));
        option.classList.toggle("btn--primary", selected);
        option.classList.toggle("btn--secondary", !selected);
      });
      onPatch({ categoryId });
      validateIdField(root, { ...project, categoryId, id: qs("#mk-id", root).value });
    });
  });

  root.querySelectorAll("[data-field]").forEach((fieldEl) => {
    const field = fieldEl.dataset.field;
    const eventName = fieldEl.tagName === "SELECT" || fieldEl.type === "color" ? "change" : "input";
    fieldEl.addEventListener(eventName, () => {
      let value = fieldEl.value;
      if (fieldEl.type === "checkbox") value = fieldEl.checked;
      if (field === "difficulty") value = Number(value);
      onPatch({ [field]: value });
      if (field === "id") validateIdField(root, { ...project, categoryId: qs("#mk-category", root).value, id: value });
    });
  });

  root.querySelectorAll('input[name="start-color-mode"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      onPatch({ startColorMode: radio.value });
      const colorInput = qs('[data-field="startColorFixed"]', root);
      colorInput.disabled = radio.value !== "fixed";
    });
  });

  qs('[data-action="suggest-id"]', root).addEventListener("click", async () => {
    const categoryId = qs("#mk-category", root).value;
    const suggestion = await suggestQuestionId(categoryId, sourceFileName || "", { excludeId: project.editingOriginalId });
    const title = sourceFileName ? sourceFileName.replace(/\.[^.]+$/, "") : qs("#mk-title", root).value;
    qs("#mk-id", root).value = suggestion;
    qs("#mk-title", root).value = title;
    onPatch({ id: suggestion, title });
    validateIdField(root, { ...project, categoryId, id: suggestion });
  });

  const tagInput = qs('[data-role="tag-input"]', root);
  tagInput.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const value = tagInput.value.trim();
    if (!value) return;
    const nextTags = [...(project.tags || []), value];
    onPatch({ tags: nextTags });
    tagInput.value = "";
    renderTags(root, nextTags, onPatch);
  });

  await validateIdField(root, project);
}

export function updateAnswerSwatch(root, hex) {
  const swatch = qs('[data-role="answer-swatch"]', root);
  if (!swatch) return;
  const valid = /^#[0-9a-f]{6}$/i.test(hex || "");
  swatch.style.backgroundColor = valid ? hex : "transparent";
  swatch.textContent = valid ? "" : "—";
  swatch.title = valid ? `정답 색상 ${hex}` : "아직 정답 색상이 없습니다";
  swatch.setAttribute("aria-label", swatch.title);
}

function renderTags(root, tags, onPatch) {
  const listEl = qs('[data-role="tag-list"]', root);
  listEl.innerHTML = "";
  tags.forEach((tag, idx) => {
    const chip = el("span", { class: "tag-chip" }, [
      tag,
      el("span", { class: "tag-chip__remove", role: "button", tabindex: "0", "aria-label": `${tag} 태그 제거` }, "×"),
    ]);
    chip.querySelector(".tag-chip__remove").addEventListener("click", () => {
      const next = tags.filter((_, i) => i !== idx);
      onPatch({ tags: next });
      renderTags(root, next, onPatch);
    });
    listEl.appendChild(chip);
  });
}

async function validateIdField(root, project) {
  const errorEl = qs('[data-role="id-error"]', root);
  if (!project.id) {
    errorEl.hidden = true;
    return;
  }
  if (!isValidQuestionId(project.id)) {
    errorEl.hidden = false;
    errorEl.textContent = "영문 소문자/숫자/하이픈만 사용할 수 있습니다.";
    return;
  }
  if (!project.categoryId) {
    errorEl.hidden = true;
    return;
  }
  const taken = await isIdTaken(project.categoryId, project.id, { excludeId: project.editingOriginalId || null });
  if (taken) {
    errorEl.hidden = false;
    errorEl.textContent = "이미 사용 중인 ID입니다. 프로젝트에 추가할 때 확인 후 덮어쓸 수 있습니다.";
  } else {
    errorEl.hidden = true;
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}
