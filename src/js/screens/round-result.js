/** 문제 결과 화면 */

import { qs, formatNumber } from "../utils/dom.js";
import { getState, setState } from "../state.js";
import { navigate } from "../router.js";
import { getScoreComment } from "../color/scoring.js";

export function mount(container) {
  const root = qs(".screen-inner", container);
  const state = getState();
  const entry = state.roundScores[state.roundScores.length - 1];

  if (!entry) {
    navigate("categories");
    return;
  }

  const isLast = state.currentQuestionIndex >= state.questions.length - 1;
  const comment = getScoreComment(entry.score);

  root.innerHTML = `
    <div class="round-result">
      <div class="round-result__score-label">획득 점수</div>
      <div class="score-pop is-animating" data-role="score">0</div>
      <div class="round-result__comment">${comment}</div>

      <div class="round-result__colors">
        <div class="round-result__color-block">
          <div class="color-swatch color-swatch--lg" style="background:${entry.answerColor}"></div>
          <div class="round-result__color-name">정답 · ${entry.answerColor}</div>
        </div>
        <div class="round-result__color-block">
          <div class="color-swatch color-swatch--lg" style="background:${entry.userColor}"></div>
          <div class="round-result__color-name">내 선택 · ${entry.userColor}</div>
        </div>
      </div>

      <div class="round-result__compare">
        <div>
          <div class="round-result__photo">
            <img src="${entry.originalImage}" alt="원본 사진" />
          </div>
          <div class="round-result__photo-label">원본</div>
        </div>
        <div>
          <div class="round-result__photo">
            <img src="${entry.userSnapshot || entry.originalImage}" alt="내가 만든 사진" />
          </div>
          <div class="round-result__photo-label">내가 만든 색</div>
        </div>
      </div>

      <button type="button" class="btn btn--primary btn--block btn--lg" data-action="next">
        ${isLast ? "결과 보기" : "다음 문제"}
      </button>
    </div>
  `;

  animateScore(root.querySelector('[data-role="score"]'), entry.score);

  root.querySelector('[data-action="next"]').addEventListener("click", () => {
    if (isLast) {
      navigate("final-result");
    } else {
      setState({ currentQuestionIndex: state.currentQuestionIndex + 1 });
      navigate("game");
    }
  });
}

function animateScore(el, target) {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    el.textContent = formatNumber(target);
    return;
  }
  const duration = 500;
  const start = performance.now();
  function tick(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = formatNumber(target * eased);
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

export function unmount() {}
