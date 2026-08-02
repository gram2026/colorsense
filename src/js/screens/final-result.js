/** 최종 결과 화면 */

import { qs, iconSvg, formatNumber } from "../utils/dom.js";
import { getState, setState, resetGame } from "../state.js";
import { navigate } from "../router.js";
import { submitBestScore } from "../storage.js";
import { getGrade } from "../color/scoring.js";
import { shareResult } from "../share.js";
import { showToast } from "../toast.js";
import { loadCategories, loadQuestionsForCategory } from "../data-loader.js";

export async function mount(container) {
  const root = qs(".screen-inner", container);
  const state = getState();
  const { roundScores, totalScore, selectedCategoryId } = state;

  if (roundScores.length === 0) {
    navigate("categories");
    return;
  }

  const average = Math.round(totalScore / roundScores.length);
  const grade = getGrade(average);
  const { isNewBest } = submitBestScore(selectedCategoryId, totalScore);

  const categories = await loadCategories();
  const category = categories.find((c) => c.id === selectedCategoryId);
  const categoryName = category?.name || "";

  root.innerHTML = `
    <div class="final-result">
      <h1 class="top-bar__title">${categoryName} 결과</h1>
      <div class="grade-badge">${grade.label}</div>
      <div>
        <div class="final-result__total">${formatNumber(totalScore)}점</div>
        ${isNewBest ? `<div class="final-result__new-best">최고 기록 갱신!</div>` : ""}
        <div style="color:var(--text-secondary); font-size:var(--font-size-sm); margin-top:4px;">
          평균 ${formatNumber(average)}점 · ${grade.desc}
        </div>
      </div>

      <div class="final-result__list">
        ${roundScores
          .map(
            (r) => `
          <div class="final-result__row">
            <img class="final-result__row-thumb" src="${r.thumbnail}" alt="" />
            <div class="final-result__row-title">${escapeHtml(r.title || "")}</div>
            <div class="final-result__row-score">${formatNumber(r.score)}</div>
          </div>`
          )
          .join("")}
      </div>

      <div class="final-result__actions">
        <button type="button" class="btn btn--primary btn--block" data-action="share">
          ${iconSvg("share", 18)} 결과 공유
        </button>
        <button type="button" class="btn btn--secondary btn--block" data-action="replay">
          ${iconSvg("replay", 18)} 다시 하기
        </button>
        <div class="row" style="justify-content:center; gap: var(--space-3)">
          <button type="button" class="btn btn--ghost" data-action="categories">카테고리로</button>
          <button type="button" class="btn btn--ghost" data-action="home">${iconSvg("home", 16)} 메인으로</button>
        </div>
      </div>
    </div>
  `;

  root.querySelector('[data-action="share"]').addEventListener("click", async () => {
    const result = await shareResult({ categoryName, totalScore });
    if (result.cancelled) return;
    if (result.method === "share") showToast("공유했어요");
    else if (result.method === "clipboard") showToast("결과 문구를 클립보드에 복사했어요");
    else showToast("공유에 실패했어요. 직접 캡처해서 공유해보세요");
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
