/** 카테고리 목록 화면 */

import { qs, iconSvg } from "../utils/dom.js";
import { loadCategoriesWithMeta } from "../data-loader.js";
import { setState, resetGame } from "../state.js";
import { navigate } from "../router.js";
import { showToast } from "../toast.js";

export async function mount(container) {
  const root = qs(".screen-inner", container);
  root.innerHTML = `
    <div class="top-bar">
      <button type="button" class="back-link" data-action="back" aria-label="메인으로">${iconSvg("back")}<span class="logo-mark" aria-hidden="true"></span><span>ColorGuesser</span></button>
      <span class="top-bar__title">카테고리</span>
    </div>
    <div data-role="content">
      <div class="row" style="justify-content:center; padding: var(--space-8) 0">
        <div class="spinner" role="status" aria-label="불러오는 중"></div>
      </div>
    </div>
  `;

  root.querySelector('[data-action="back"]').addEventListener("click", () => navigate("home"));

  const contentEl = root.querySelector('[data-role="content"]');

  try {
    const categories = await loadCategoriesWithMeta();

    if (categories.length === 0) {
      contentEl.innerHTML = `<p class="empty-state">불러올 수 있는 카테고리가 없어요.</p>`;
      return;
    }

    contentEl.innerHTML = `
      <div class="grid-categories">
        ${categories.map((c) => renderCard(c)).join("")}
      </div>
    `;

    for (const card of contentEl.querySelectorAll("[data-category-id]")) {
      card.addEventListener("click", () => {
        const categoryId = card.dataset.categoryId;
        const category = categories.find((c) => c.id === categoryId);
        if (category.questionCount === 0) {
          showToast("아직 준비 중인 카테고리예요");
          return;
        }
        resetGame();
        setState({ selectedCategoryId: categoryId }, { persist: false });
        navigate("category-detail");
      });
    }
  } catch (err) {
    console.error("[categories] 로드 실패", err);
    contentEl.innerHTML = `<p class="empty-state">카테고리를 불러오지 못했어요. 새로고침해보세요.</p>`;
    showToast("카테고리를 불러오지 못했어요");
  }
}

function renderCard(category) {
  const empty = category.questionCount === 0;
  return `
    <button type="button" class="category-card${empty ? " category-card--disabled" : ""}" data-category-id="${category.id}"
      aria-label="${category.name}${empty ? ", 준비 중" : ""}">
      <img class="category-card__thumb" src="${category.thumbnail}" alt="${category.name}" loading="lazy"
           onerror="this.style.background='var(--bg-page-alt)'; this.removeAttribute('src');" />
      ${empty ? `<span class="category-card__badge">준비 중</span>` : ""}
    </button>
  `;
}

export function unmount() {}
