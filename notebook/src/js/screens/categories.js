/** 카테고리 목록 화면 */

import { qs, iconSvg } from "../utils/dom.js";
import { loadCategoriesWithMeta, getCategoryName } from "../data-loader.js";
import { setState, resetGame } from "../state.js";
import { navigate } from "../router.js";
import { showToast } from "../toast.js";
import { t } from "../i18n.js";

export async function mount(container) {
  const root = qs(".screen-inner", container);
  root.innerHTML = `
    <div class="top-bar">
      <button type="button" class="back-link" data-action="back" aria-label="${t("nav.backToMain")}">${iconSvg("back")}<span class="logo-mark" aria-hidden="true"></span><span class="brand-wordmark" aria-label="ColorsGuesser">Color<span class="brand-wordmark__s">S</span> Guesser</span></button>
      <span class="top-bar__title">${t("categories.title")}</span>
    </div>
    <div data-role="content">
      <div class="row" style="justify-content:center; padding: var(--space-8) 0">
        <div class="spinner" role="status" aria-label="${t("game.loading")}"></div>
      </div>
    </div>
  `;

  root.querySelector('[data-action="back"]').addEventListener("click", () => navigate("home"));

  const contentEl = root.querySelector('[data-role="content"]');

  try {
    const categories = await loadCategoriesWithMeta();

    if (categories.length === 0) {
      contentEl.innerHTML = `<p class="empty-state">${t("categories.empty")}</p>`;
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
          showToast(t("category.toast.comingSoon"));
          return;
        }
        resetGame();
        setState({ selectedCategoryId: categoryId }, { persist: false });
        navigate("category-detail");
      });
    }
  } catch (err) {
    console.error("[categories] 로드 실패", err);
    contentEl.innerHTML = `<p class="empty-state">${t("categories.loadErrorInline")}</p>`;
    showToast(t("categories.loadErrorToast"));
  }
}

function renderCard(category) {
  const empty = category.questionCount === 0;
  const name = getCategoryName(category);
  return `
    <button type="button" class="category-card${empty ? " category-card--disabled" : ""}" data-category-id="${category.id}"
      aria-label="${name}${empty ? ", " + t("category.badge.comingSoon") : ""}">
      <img class="category-card__thumb" src="${category.thumbnail}" alt="${name}" loading="lazy"
           onerror="this.style.background='var(--bg-page-alt)'; this.removeAttribute('src');" />
      ${empty ? `<span class="category-card__badge">${t("category.badge.comingSoon")}</span>` : ""}
    </button>
  `;
}

export function unmount() {}
