/** 카테고리 상세 화면 (히어로 이미지 + 글래스 카드 스타일) */

import { qs, iconSvg, formatNumber } from "../utils/dom.js";
import { loadCategories, loadQuestionsForCategory } from "../data-loader.js";
import { getBestScore } from "../storage.js";
import { getState, setState } from "../state.js";
import { navigate } from "../router.js";
import { showToast } from "../toast.js";

export async function mount(container) {
  const root = qs(".screen-inner", container);
  const categoryId = getState().selectedCategoryId;

  root.innerHTML = `
    <div class="top-bar">
      <button type="button" class="back-link" data-action="home" aria-label="홈으로">
        <span class="logo-mark" aria-hidden="true"></span><span>ColorGuesser</span>
      </button>
    </div>
    <div data-role="content" style="flex:1; display:flex; align-items:center; justify-content:center;">
      <div class="spinner" role="status" aria-label="불러오는 중"></div>
    </div>
  `;

  root.querySelector('[data-action="home"]').addEventListener("click", () => navigate("home"));

  const contentEl = root.querySelector('[data-role="content"]');

  try {
    const categories = await loadCategories();
    const category = categories.find((c) => c.id === categoryId);
    if (!category) {
      contentEl.innerHTML = `<p class="empty-state">카테고리를 찾을 수 없어요.</p>`;
      return;
    }

    const questions = await loadQuestionsForCategory(categoryId);
    const best = getBestScore(categoryId);
    const heroSrc = category.heroImage || category.thumbnail;
    const isEmpty = questions.length === 0;

    contentEl.style.display = "block";
    contentEl.style.width = "100%";
    contentEl.innerHTML = `
      <section class="category-hero">
        <img class="category-hero__bg" src="${heroSrc}" alt=""
             onerror="this.style.background='var(--bg-page-alt)'; this.removeAttribute('src');" />
        <div class="category-hero__scrim" aria-hidden="true"></div>
        <div class="category-hero__card">
          <div class="category-hero__eyebrow">CATEGORY</div>
          <h1 class="category-hero__title">${escapeHtml(category.name)}</h1>
          <p class="category-hero__desc">${escapeHtml(category.description || "")}</p>
          <div class="category-hero__tags">
            <span class="badge">${isEmpty ? "준비 중" : `문제 ${questions.length}개`}</span>
            ${best > 0 ? `<span class="badge badge--primary">최고 ${formatNumber(best)}점</span>` : ""}
          </div>
          ${
            isEmpty
              ? `<p class="text-muted" style="color:var(--text-muted); font-size:var(--font-size-sm);">이 카테고리는 아직 문제가 없어요.</p>`
              : `<button type="button" class="btn btn--primary" data-action="start" aria-label="게임 시작">
                   ${iconSvg("play", 18)}<span>시작하기</span>
                 </button>`
          }
        </div>
      </section>
    `;

    if (!isEmpty) {
      contentEl.querySelector('[data-action="start"]').addEventListener("click", () => {
        setState(
          { questions, currentQuestionIndex: 0, roundScores: [], totalScore: 0 },
          { persist: false }
        );
        navigate("game");
      });
    }
  } catch (err) {
    console.error("[category-detail] 로드 실패", err);
    contentEl.innerHTML = `<p class="empty-state">문제를 불러오지 못했어요.</p>`;
    showToast("문제를 불러오지 못했어요");
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

export function unmount() {}
