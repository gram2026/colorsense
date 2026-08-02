/** 시작 화면: 새 문제 만들기 / 이미지 불러오기 / 드래그앤드롭 / 기존 문제 열기 / 최근 임시 작업 */

import { qs, iconSvg, el } from "../utils/dom-utils.js";
import { validateImageFile } from "../utils/image-utils.js";
import { listDrafts, deleteDraft, isSupported as draftStorageSupported } from "../draft-storage.js";

/**
 * @param {HTMLElement} root  data-role="start-root"
 * @param {{onImageFile:(file:File)=>void, onOpenExisting:()=>void, onOpenDraft:(id:string)=>void}} handlers
 */
export async function renderStartScreen(root, handlers) {
  root.innerHTML = `
    <div class="maker-start__logo">
      <span class="logo-mark" aria-hidden="true"></span>
      <h1 class="maker-start__title">퀴즈 메이커</h1>
    </div>

    <div class="maker-start__grid">
      <button type="button" class="card start-card" data-action="new">
        <span class="start-card__icon">${iconSvg("plus", 22)}</span>
        <span class="start-card__title">새 문제 만들기</span>
        <span class="start-card__desc">사진을 불러와 바로 편집을 시작합니다.</span>
      </button>
      <button type="button" class="card start-card" data-action="upload">
        <span class="start-card__icon">${iconSvg("upload", 22)}</span>
        <span class="start-card__title">이미지 불러오기</span>
        <span class="start-card__desc">PNG / JPG / WebP 파일을 선택합니다.</span>
      </button>
      <button type="button" class="card start-card" data-action="open">
        <span class="start-card__icon">${iconSvg("folderOpen", 22)}</span>
        <span class="start-card__title">기존 문제 열기</span>
        <span class="start-card__desc">이미 만든 문제 ZIP이나 파일을 불러와 수정합니다.</span>
      </button>
    </div>

    <div class="dropzone" data-role="dropzone">
      ${iconSvg("image", 28)}
      <p>여기로 이미지를 끌어다 놓아도 됩니다.</p>
    </div>

    <div class="maker-start__steps">
      <div class="maker-start__step"><span class="maker-start__step-num">1</span>원본 사진을 불러옵니다.</div>
      <div class="maker-start__step"><span class="maker-start__step-num">2</span>브러시·다각형·스마트 선택으로 색을 바꿀 영역을 지정합니다.</div>
      <div class="maker-start__step"><span class="maker-start__step-num">3</span>정답 색상을 자동 추출하고 필요하면 보정합니다.</div>
      <div class="maker-start__step"><span class="maker-start__step-num">4</span>썸네일을 정하고 검증한 뒤 ZIP으로 내보내거나 게임 프로젝트에 바로 추가합니다.</div>
    </div>

    <h2 class="top-bar__title" style="align-self:flex-start; margin-bottom: var(--space-3);">최근 임시 작업</h2>
    <div class="draft-list" data-role="draft-list">
      <p class="empty-state">불러오는 중...</p>
    </div>

    <input type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" data-role="file-input" class="visually-hidden" />
  `;

  const fileInput = qs('[data-role="file-input"]', root);
  const dropzone = qs('[data-role="dropzone"]', root);

  const triggerFilePick = () => fileInput.click();

  qs('[data-action="new"]', root).addEventListener("click", triggerFilePick);
  qs('[data-action="upload"]', root).addEventListener("click", triggerFilePick);
  qs('[data-action="open"]', root).addEventListener("click", () => handlers.onOpenExisting());

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    fileInput.value = "";
    if (file) handleFile(file, handlers);
  });

  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("is-dragover");
  });
  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("is-dragover"));
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("is-dragover");
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file, handlers);
  });

  await renderDraftList(root, handlers);
}

function handleFile(file, handlers) {
  const check = validateImageFile(file);
  if (!check.ok) {
    handlers.onError?.(check.reason);
    return;
  }
  handlers.onImageFile(file);
}

async function renderDraftList(root, handlers) {
  const listEl = qs('[data-role="draft-list"]', root);
  if (!draftStorageSupported()) {
    listEl.innerHTML = `<p class="empty-state">이 브라우저는 임시 저장(IndexedDB)을 지원하지 않아 최근 작업 목록을 사용할 수 없습니다.</p>`;
    return;
  }
  try {
    const drafts = await listDrafts();
    if (drafts.length === 0) {
      listEl.innerHTML = `<p class="empty-state">아직 임시 저장된 작업이 없습니다.</p>`;
      return;
    }
    listEl.innerHTML = "";
    for (const draft of drafts) {
      const thumbUrl = draft.thumbnailBlob ? URL.createObjectURL(draft.thumbnailBlob) : null;
      const card = el("button", { type: "button", class: "card draft-card", "data-id": draft.id }, [
        thumbUrl
          ? el("img", { class: "draft-card__thumb", src: thumbUrl, alt: "" })
          : el("div", { class: "draft-card__thumb" }),
        el("div", { class: "draft-card__body" }, [
          el("div", { class: "draft-card__title" }, draft.title),
          el("div", { class: "draft-card__meta" }, formatRelativeTime(draft.updatedAt)),
        ]),
      ]);
      card.addEventListener("click", (e) => {
        if (e.target.closest("[data-delete]")) return;
        handlers.onOpenDraft(draft.id);
      });
      const delBtn = el("span", { class: "draft-card__delete", "data-delete": "true", role: "button", tabindex: "0", "aria-label": "임시 작업 삭제" }, "삭제");
      delBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await deleteDraft(draft.id);
        renderDraftList(root, handlers);
      });
      card.querySelector(".draft-card__body").appendChild(delBtn);
      listEl.appendChild(card);
    }
  } catch (err) {
    console.error("[start-screen] 임시 작업 목록 로드 실패", err);
    listEl.innerHTML = `<p class="empty-state">임시 작업 목록을 불러오지 못했습니다.</p>`;
  }
}

function formatRelativeTime(ts) {
  const diffMin = Math.round((Date.now() - ts) / 60000);
  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.round(diffHour / 24);
  return `${diffDay}일 전`;
}
