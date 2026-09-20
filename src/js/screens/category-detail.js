/** 카테고리 상세 화면 (히어로 이미지 + 글래스 카드 스타일) */

import { qs, iconSvg, formatScore } from "../utils/dom.js";
import { loadCategories, loadQuestionsForCategory, getCategoryName } from "../data-loader.js";
import { getBestScore } from "../storage.js";
import { getState, setState } from "../state.js";
import { navigate } from "../router.js";
import { showToast } from "../toast.js";
import { t, getLang, setLang } from "../i18n.js";
import { mountLeaderboard } from '../leaderboard.js';
let disposeRanking = null;

export async function mount(container) {
  const root = qs(".screen-inner", container);
  const categoryId = getState().selectedCategoryId;

  root.innerHTML = `
    <div class="top-bar">
      <button type="button" class="back-link" data-action="home" aria-label="${t("nav.home")}">
        <span class="logo-mark" aria-hidden="true"></span><span class="brand-wordmark" aria-label="ColorsGuesser">Color<span class="brand-wordmark__s">S</span> Guesser</span>
      </button>
      <button type="button" class="icon-btn lang-btn" data-action="lang" aria-label="${t("nav.langButton")}">${
        getLang() === "en" ? "EN" : "KO"
      }</button>
    </div>
    <div data-role="content" style="flex:1; display:flex; align-items:center; justify-content:center;">
      <div class="spinner" role="status" aria-label="${t("game.loading")}"></div>
    </div>
  `;

  root.querySelector('[data-action="home"]').addEventListener("click", () => navigate("home"));
  root.querySelector('[data-action="lang"]').addEventListener("click", () => {
    setLang(getLang() === "ko" ? "en" : "ko");
  });

  const contentEl = root.querySelector('[data-role="content"]');

  try {
    const categories = await loadCategories();
    const category = categories.find((c) => c.id === categoryId);
    if (!category) {
      contentEl.innerHTML = `<p class="empty-state">${t("categoryDetail.notFound")}</p>`;
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
          <div class="category-hero__eyebrow">${t("categoryDetail.eyebrow")}</div>
          <h1 class="category-hero__title">${escapeHtml(getCategoryName(category))}</h1>
          <div class="category-hero__tags">
            ${isEmpty ? `<span class="badge">${t("category.badge.comingSoon")}</span>` : ""}
            ${best > 0 ? `<span class="badge badge--primary">${t("category.badge.bestAverage", { score: formatScore(best) })}</span>` : ""}
          </div>
          ${
            isEmpty
              ? `<p class="text-muted" style="color:var(--text-muted); font-size:var(--font-size-sm);">${t("categoryDetail.empty")}</p>`
              : `<button type="button" class="btn btn--primary" data-action="start" aria-label="${t("categoryDetail.startAria")}">
                   ${iconSvg("play", 18)}<span>${t("categoryDetail.start")}</span>
                 </button>`
          }
        </div>
        <section class="sketch-ranking category-ranking" data-role="category-ranking"></section>
      </section>
    `;

    if (!isEmpty) {
      contentEl.querySelector('[data-action="start"]').addEventListener("click", () => {
        try {
        setState(
          { selectedCategoryId: categoryId, questions, currentQuestionIndex: 0, roundScores: [], totalScore: 0 },
          { persist: false }
        );
        navigate("game");
        } catch (err) {
          console.error('[category-detail] 게임 시작 실패', err);
          showToast(getLang() === 'en' ? 'Unable to start. Please reload and try again.' : '게임 시작에 실패했습니다. 새로고침 후 다시 시도해 주세요.');
        }
      });
    }
    try {
      disposeRanking = mountLeaderboard(contentEl.querySelector('[data-role="category-ranking"]'), { categoryId, readOnly: true });
    } catch (err) {
      console.error('[category-detail] 랭킹 초기화 실패', err);
      contentEl.querySelector('[data-role="category-ranking"]').textContent = getLang() === 'en' ? 'Ranking unavailable' : '랭킹을 불러오지 못했습니다';
    }
  } catch (err) {
    console.error("[category-detail] 로드 실패", err);
    contentEl.innerHTML = `<p class="empty-state">${t("categoryDetail.loadErrorInline")}</p>`;
    showToast(t("categoryDetail.loadErrorToast"));
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

export function unmount() { disposeRanking?.(); }
