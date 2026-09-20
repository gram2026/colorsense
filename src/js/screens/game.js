/** 게임 화면: 사진 + 마스크 색상 합성 + 컬러 피커 */

import { qs, iconSvg } from "../utils/dom.js";
import { getState, setState, resetGame } from "../state.js";
import { navigate } from "../router.js";
import { loadConfig } from "../data-loader.js";
import { MaskRenderer } from "../color/mask-renderer.js";
import { ColorPicker } from "../color/color-picker.js";
import { hexToHsv, hsvToHex } from "../color/color-convert.js";
import { calculateScore } from "../color/scoring.js";
import { maskedAverages } from '../color/masked-average.js';
import { showToast } from "../toast.js";
import { t, getLang, setLang } from "../i18n.js";
import { COUNTRY_NAMES_KO } from "../data/country-names.js";

let renderer = null;
let colorPicker = null;
let submitting = false;
let preserveColorOnNextMount = false; // 언어 전환으로 인한 재렌더링일 때 지금까지 고른 색을 유지

export async function mount(container) {
  const root = qs(".screen-inner", container);
  const state = getState();
  const question = state.questions[state.currentQuestionIndex];

  if (!question) {
    navigate("final-result");
    return;
  }

  submitting = false;
  const isCountry = state.selectedCategoryId === "country";

  root.innerHTML = `
    <div class="game-header">
      <div class="top-bar">
        <button type="button" class="back-link" data-action="home" aria-label="${t("nav.home")}">
          <span class="logo-mark" aria-hidden="true"></span><span class="brand-wordmark" aria-label="ColorsGuesser">Color<span class="brand-wordmark__s">S</span> Guesser</span>
        </button>
      </div>

      <div class="game-topbar">
        <button type="button" class="icon-btn" data-action="exit" aria-label="${t("game.exitAria")}">${iconSvg(
          "back"
        )}</button>
        <button type="button" class="icon-btn lang-btn" data-action="lang" aria-label="${t("nav.langButton")}">${
          getLang() === "en" ? "EN" : "KO"
        }</button>
      </div>
    </div>

    <div class="game-layout${isCountry ? " game-layout--country" : ""}">
      <div class="game-photo-pane">
        <div class="game-photo-frame" data-role="photo-frame">
          <canvas data-role="canvas" aria-label="${t("game.canvasAria")}"></canvas>
          <div class="game-photo-frame__loading" data-role="loading">
            <div class="spinner" role="status" aria-label="${t("game.loading")}"></div>
            <span>${t("game.loading")}</span>
          </div>
        </div>
        ${isCountry ? `<div class="game-country-name">${escapeHtml(countryDisplayName(question))}</div>` : ""}
      </div>
      <div class="game-control-pane">
        <div class="color-picker" data-role="color-picker"></div>
      </div>
    </div>
  `;

  root.querySelector('[data-action="home"]').addEventListener("click", () => {
    resetGame();
    navigate("home");
  });

  root.querySelectorAll('[data-action="exit"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      if (window.confirm(t("game.exitConfirm"))) {
        navigate("category-detail");
      }
    });
  });

  root.querySelector('[data-action="lang"]').addEventListener("click", () => {
    preserveColorOnNextMount = true;
    setLang(getLang() === "ko" ? "en" : "ko");
  });

  const canvas = root.querySelector('[data-role="canvas"]');
  const frameEl = root.querySelector('[data-role="photo-frame"]');
  const loadingEl = root.querySelector('[data-role="loading"]');
  const pickerRoot = root.querySelector('[data-role="color-picker"]');

  if (renderer) renderer.destroy();
  renderer = new MaskRenderer(canvas);

  const config = await loadConfig();
  const shouldPreserveColor = preserveColorOnNextMount;
  preserveColorOnNextMount = false;
  const startHex = shouldPreserveColor && state.currentColor ? state.currentColor : resolveStartColor(question, config);

  colorPicker = new ColorPicker(pickerRoot, {
    initialHex: startHex,
    onChange: (hex) => {
      renderer?.setColor(hex);
      setState({ currentColor: hex }, { persist: false });
    },
  });
  colorPicker.onSubmit(() => handleSubmit(question, config));

  setState({ currentColor: startHex }, { persist: false });

  const result = await renderer.load(question.originalImage, question.maskImage, question.renderMode);
  loadingEl.remove();

  if (!result.ok) {
    frameEl.insertAdjacentHTML(
      "beforeend",
      `<div class="game-photo-frame__error" data-role="error">
         <span>${t("game.loadErrorText")}</span>
         <button type="button" class="btn btn--secondary" data-action="skip">${t("game.loadErrorSkip")}</button>
       </div>`
    );
    frameEl.querySelector('[data-action="skip"]').addEventListener("click", () => {
      handleSubmit(question, config, { imageFailed: true });
    });
    return;
  }

  if (result.maskMissing) {
    showToast(t("game.maskMissingToast"));
  }

  renderer.setColor(startHex);
}

function resolveStartColor(question, config) {
  if (question.startColor) return question.startColor;
  return generateStartColor(question.answerColor, config.startColor || {});
}

/**
 * 시작 색상은 컬러 피커와 같은 HSV 좌표계로 만든다.
 * 밝기(v)는 항상 같은 값이라 오른쪽 바가 매번 맨 위 살짝 아래에서 시작하고,
 * 색상/채도는 정답에서 조금만 떨어뜨려 왼쪽 패널이 정답 근처에서 시작한다.
 */
function generateStartColor(answerHex, cfg) {
  const { h, s } = hexToHsv(answerHex);
  const minHue = cfg.minHueOffsetDeg ?? 35;
  const maxHue = cfg.maxHueOffsetDeg ?? 65;
  const minSat = cfg.minSaturationOffset ?? 16;
  const maxSat = cfg.maxSaturationOffset ?? 30;
  const startValue = cfg.startValue ?? 93;

  const hueOffset = randomBetween(minHue, maxHue) * (Math.random() < 0.5 ? -1 : 1);
  const satMagnitude = randomBetween(minSat, maxSat);
  // 패널 가장자리에 걸려 잘리면 정답 쪽으로 도로 붙으므로, 그럴 때는 반대 방향으로 뺀다.
  let satOffset = satMagnitude * (Math.random() < 0.5 ? -1 : 1);
  if (s + satOffset > 100 || s + satOffset < 15) satOffset = -satOffset;

  const newHue = (h + hueOffset + 360) % 360;
  const newSat = clamp(s + satOffset, 15, 100);

  return hsvToHex({ h: newHue, s: newSat, v: startValue });
}

/** 국가 이름: 한국어 모드에서는 미리 번역해둔 이름, 영어 모드는 기존처럼 id */
function countryDisplayName(question) {
  if (getLang() === "ko" && COUNTRY_NAMES_KO[question.id]) return COUNTRY_NAMES_KO[question.id];
  return question.id;
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}
function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

async function handleSubmit(question, config, { imageFailed = false } = {}) {
  if (submitting) return; // 빠른 연속 제출 방지
  submitting = true;

  const state = getState();
  const userHex = imageFailed ? question.answerColor : colorPicker?.getHex() ?? "#808080";
  renderer?.setColor(userHex);
  // 사진에 실제로 보이는 색끼리 비교해야 "똑같아 보이는데 오답" 이 생기지 않는다.
  let averages;
  try {
    if (imageFailed) {
      averages = { applied: userHex, answer: question.answerColor };
    } else {
    const response = await fetch(`/assets/scoring/${question.categoryId}/${question.id}.json`);
    if (!response.ok) throw new Error('Scoring profile unavailable');
    averages = maskedAverages(await response.json(), userHex, question.renderMode);
    }
  } catch (err) {
    submitting = false;
    showToast(getLang() === 'en' ? 'Unable to load scoring data. Please reload.' : '채점 데이터를 불러오지 못했습니다. 새로고침해 주세요.');
    return;
  }
  const appliedHex = averages.applied;
  if (getState().questions !== state.questions) return;
  const { score, deltaE } = imageFailed ? { score: 0, deltaE: null } : calculateScore(appliedHex, averages.answer, config.scoring);

  const koCountryName = COUNTRY_NAMES_KO[question.id];
  const isCountry = question.categoryId === "country";
  const entry = {
    questionId: question.id,
    skipped: imageFailed,
    // 최종 결과 목록은 한국어면 title, 영어면 titleEn을 쓴다. 국가 문제는 영어 표시를 지금처럼 id로 유지한다.
    title: isCountry && koCountryName ? koCountryName : question.title,
    titleEn: question.titleEn ?? (isCountry ? question.id : undefined),
    thumbnail: question.thumbnail,
    originalImage: question.originalImage,
    score,
    deltaE,
    userColor: userHex,
    appliedColor: appliedHex,
    answerColor: averages.answer,
    userSnapshot: imageFailed ? null : renderer?.snapshotDataURL() ?? null,
  };

  const roundScores = [...state.roundScores, entry];
  const totalScore = roundScores.reduce((sum, r) => sum + r.score, 0);

  setState({ roundScores, totalScore });
  navigate("round-result");
}

export function unmount() {
  colorPicker?.destroy();
  renderer?.destroy();
  renderer = null;
  colorPicker = null;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
