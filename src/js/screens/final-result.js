/** 최종 결과 화면 */

import { qs, iconSvg, formatScore } from "../utils/dom.js";
import { getState, setState, resetGame } from "../state.js";
import { navigate } from "../router.js";
import { submitBestScore } from "../storage.js";
import { getGrade, getScoreTier } from "../color/scoring.js";
import { burstConfetti, TIER_COLORS } from "../utils/effects.js";
import { scoreColorVars } from "../utils/score-colors.js";
import { shareResult } from "../share.js";
import { showToast } from "../toast.js";
import { loadCategories, loadQuestionsForCategory, getCategoryName } from "../data-loader.js";
import { t, getLang, setLang } from "../i18n.js";

export async function mount(container) {
  const root = qs(".screen-inner", container);
  const state = getState();
  const { roundScores, totalScore, selectedCategoryId } = state;

  if (roundScores.length === 0) {
    navigate("categories");
    return;
  }

  const average = Math.round((totalScore / roundScores.length) * 10) / 10;
  const grade = getGrade(average);
  const { isNewBest } = submitBestScore(selectedCategoryId, average);

  const categories = await loadCategories();
  const category = categories.find((c) => c.id === selectedCategoryId);
  const categoryName = category ? getCategoryName(category) : "";

  root.innerHTML = `
    <header class="result-header">
      <button type="button" class="topbar-brand result-header__brand" data-action="header-home" aria-label="${t("nav.home")}">
        <span class="logo-mark" aria-hidden="true"></span>
        <span class="topbar-brand__name">ColorsGuesser</span>
      </button>
      <button type="button" class="icon-btn lang-btn" data-action="lang" aria-label="${t("nav.langButton")}">
        ${getLang() === "en" ? "EN" : "KO"}
      </button>
    </header>

    <div class="final-result score-tier--${grade.tier}" style="${scoreColorVars(average)}">
      <h1 class="top-bar__title">${t("finalResult.title", { categoryName })}</h1>
      <div class="score-stage" data-role="grade-stage">
        <div class="grade-badge grade-badge--pop">${grade.label}</div>
      </div>
      <div>
        <div class="final-result__total">${t("finalResult.totalScore", { score: formatScore(average) })}</div>
        <div class="row" style="justify-content:center; gap: var(--space-2); margin-top: var(--space-2)">
          <span class="badge badge--primary">${t("finalResult.averageBadge")}</span>
          <span class="badge">${t("finalResult.roundBadge", { count: roundScores.length })}</span>
        </div>
        ${isNewBest ? `<div class="final-result__new-best">${t("finalResult.newBest")}</div>` : ""}
        <div style="color:var(--text-secondary); font-size:var(--font-size-sm); margin-top:4px;">
          ${t(grade.descKey)}
        </div>
      </div>

      <div class="final-result__list">
        ${roundScores
          .map(
            (r, index) => `
          <div class="final-result__row score-tier--${getScoreTier(r.score)}" style="--row-delay:${index * 70}ms;${scoreColorVars(r.score)}">
            <img class="final-result__row-thumb" src="${r.thumbnail}" alt="" />
            <div class="final-result__row-title">${escapeHtml(getLang() === "en" ? (r.titleEn || (/[^\x00-\x7F]/.test(r.title || "") ? `Round ${index + 1}` : r.title || `Round ${index + 1}`)) : r.title || "")}</div>
            <div class="final-result__row-score">${formatScore(r.score)}</div>
          </div>`
          )
          .join("")}
      </div>

      <div class="final-result__actions">
        <button type="button" class="btn btn--primary btn--block" data-action="share">
          ${iconSvg("share", 18)} ${t("finalResult.share")}
        </button>
        <button type="button" class="btn btn--secondary btn--block" data-action="replay">
          ${iconSvg("replay", 18)} ${t("finalResult.replay")}
        </button>
        <div class="row" style="justify-content:center; gap: var(--space-3)">
          <button type="button" class="btn btn--ghost" data-action="categories">${t("finalResult.toCategories")}</button>
          <button type="button" class="btn btn--ghost" data-action="home">${iconSvg("home", 16)} ${t("finalResult.toHome")}</button>
        </div>
      </div>
    </div>
  `;

  if (grade.tier === "perfect" || grade.tier === "great") {
    setTimeout(() => {
      burstConfetti(root.querySelector('[data-role="grade-stage"]'), {
        colors: TIER_COLORS[grade.tier],
        count: grade.tier === "perfect" ? 60 : 40,
        spread: 260,
      });
    }, 350);
  }

  root.querySelector('[data-action="lang"]').addEventListener("click", () => {
    setLang(getLang() === "ko" ? "en" : "ko");
  });

  root.querySelector('[data-action="header-home"]').addEventListener("click", () => {
    resetGame();
    navigate("home");
  });

  root.querySelector('[data-action="share"]').addEventListener("click", async () => {
    const result = await shareResult({ categoryName, averageScore: average, roundCount: roundScores.length });
    if (result.cancelled) return;
    if (result.method === "share") showToast(t("finalResult.shareSuccess"));
    else if (result.method === "clipboard") showToast(t("finalResult.shareClipboard"));
    else showToast(t("finalResult.shareFail"));
  });

  root.querySelector('[data-action="replay"]').addEventListener("click", async () => {
    const questions = await loadQuestionsForCategory(selectedCategoryId);
    setState(
      { questions, currentQuestionIndex: 0, roundScores: [], totalScore: 0 },
      { persist: false }
    );
    navigate("game");
  });

  root.querySelector('[data-action="categories"]').addEventListener("click", () => {
    resetGame();
    navigate("categories");
  });

  root.querySelector('[data-action="home"]').addEventListener("click", () => {
    resetGame();
    navigate("home");
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

export function unmount() {}
