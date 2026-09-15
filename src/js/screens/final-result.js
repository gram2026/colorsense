/** 최종 결과 화면 */

import { qs, iconSvg, formatScore } from "../utils/dom.js";
import { getState, setState, resetGame } from "../state.js";
import { navigate } from "../router.js";
import { submitBestScore } from "../storage.js";
import { getGrade } from "../color/scoring.js";
import { shareResult } from "../share.js";
import { showToast } from "../toast.js";
import { loadCategories, loadQuestionsForCategory, getCategoryName } from "../data-loader.js";
import { t } from "../i18n.js";

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
    <div class="final-result">
      <h1 class="top-bar__title">${t("finalResult.title", { categoryName })}</h1>
      <div class="grade-badge">${grade.label}</div>
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
            (r) => `
          <div class="final-result__row">
            <img class="final-result__row-thumb" src="${r.thumbnail}" alt="" />
            <div class="final-result__row-title">${escapeHtml(r.title || "")}</div>
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
