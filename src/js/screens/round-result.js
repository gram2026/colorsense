/** 문제 결과 화면 */

import { qs, formatScore } from "../utils/dom.js";
import { getState, setState, resetGame } from "../state.js";
import { navigate } from "../router.js";
import { getScoreComment, getScoreTier } from "../color/scoring.js";
import { scoreLaunchMarkup, playScoreLaunch } from "../utils/score-launch.js";
import { t, getLang, setLang } from "../i18n.js";

export function mount(container) {
  const root = qs(".screen-inner", container);
  const state = getState();
  const entry = state.roundScores[state.roundScores.length - 1];

  if (!entry) {
    navigate("categories");
    return;
  }

  const isLast = state.currentQuestionIndex >= state.questions.length - 1;
  const comment = t(getScoreComment(entry.score));
  const tier = getScoreTier(entry.score);

  root.innerHTML = `
    <header class="result-header">
      <button type="button" class="topbar-brand result-header__brand" data-action="home" aria-label="${t("nav.home")}">
        <span class="logo-mark" aria-hidden="true"></span>
        <span class="topbar-brand__name">ColorsGuesser</span>
      </button>
      <button type="button" class="icon-btn lang-btn" data-action="lang" aria-label="${t("nav.langButton")}">
        ${getLang() === "en" ? "EN" : "KO"}
      </button>
    </header>

    <div class="round-result score-tier--${tier}">
      <div class="round-result__score-label">${t("roundResult.scoreLabel")}</div>
      <div class="score-pop" data-role="score">0</div>
      ${scoreLaunchMarkup()}
      <div class="round-result__comment">${comment}</div>

      <div class="round-result__colors">
        <div class="round-result__color-block">
          <div class="color-swatch color-swatch--lg" style="background:${entry.answerColor}"></div>
          <div class="round-result__color-name">${t("roundResult.answer")} · ${entry.answerColor}</div>
        </div>
        <div class="round-result__color-block">
          <div class="color-swatch color-swatch--lg" style="background:${entry.userColor}"></div>
          <div class="round-result__color-name">${t("roundResult.myPick")} · ${entry.userColor}</div>
        </div>
      </div>

      <div class="round-result__compare">
        <div>
          <div class="round-result__photo">
            <img src="${entry.originalImage}" alt="${t("roundResult.original")}" />
          </div>
          <div class="round-result__photo-label">${t("roundResult.original")}</div>
        </div>
        <div>
          <div class="round-result__photo">
            <img src="${entry.userSnapshot || entry.originalImage}" alt="${t("roundResult.myVersion")}" />
          </div>
          <div class="round-result__photo-label">${t("roundResult.myVersion")}</div>
        </div>
      </div>

      <button type="button" class="btn btn--primary btn--block btn--lg" data-action="next">
        ${isLast ? t("roundResult.viewFinal") : t("roundResult.next")}
      </button>
    </div>
  `;

  const scoreEl = root.querySelector('[data-role="score"]');
  const resultEl = root.querySelector(".round-result");
  resultEl.classList.add("is-launching");
  playScoreLaunch(root, {
    score: entry.score,
    tier,
    onProgress: (value) => {
      scoreEl.textContent = formatScore(value);
    },
    onLand: () => {
      scoreEl.classList.add("is-landed");
      resultEl.classList.remove("is-launching");
    },
  });

  root.querySelector('[data-action="lang"]').addEventListener("click", () => {
    setLang(getLang() === "ko" ? "en" : "ko");
  });

  root.querySelector('[data-action="home"]').addEventListener("click", () => {
    resetGame();
    navigate("home");
  });

  root.querySelector('[data-action="next"]').addEventListener("click", () => {
    if (isLast) {
      navigate("final-result");
    } else {
      setState({ currentQuestionIndex: state.currentQuestionIndex + 1 });
      navigate("game");
    }
  });
}

export function unmount() {}
