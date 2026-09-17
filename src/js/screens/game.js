/** 게임 화면: 사진 + 마스크 색상 합성 + 컬러 피커 */

import { qs, iconSvg } from "../utils/dom.js";
import { getState, setState } from "../state.js";
import { navigate } from "../router.js";
import { loadConfig } from "../data-loader.js";
import { MaskRenderer } from "../color/mask-renderer.js";
import { ColorPicker } from "../color/color-picker.js";
import { hexToHsl, hslToHex } from "../color/color-convert.js";
import { calculateScore } from "../color/scoring.js";
import { showToast } from "../toast.js";
import { t, getLang, setLang } from "../i18n.js";

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

  root.innerHTML = `
    <div class="game-header">
      <div class="top-bar">
        <button type="button" class="back-link" data-action="exit" aria-label="${t("game.exitAria")}">
          <span class="logo-mark" aria-hidden="true"></span><span>ColorsGuesser</span>
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

    <div class="game-layout">
      <div class="game-photo-pane">
        <div class="game-photo-frame" data-role="photo-frame">
          <canvas data-role="canvas" aria-label="${t("game.canvasAria")}"></canvas>
          <div class="game-photo-frame__loading" data-role="loading">
            <div class="spinner" role="status" aria-label="${t("game.loading")}"></div>
            <span>${t("game.loading")}</span>
          </div>
        </div>
      </div>
      <div class="game-control-pane">
        <div class="color-picker" data-role="color-picker"></div>
      </div>
    </div>
  `;

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

function generateStartColor(answerHex, cfg) {
  const { h, s, l } = hexToHsl(answerHex);
  const minHue = cfg.minHueOffsetDeg ?? 50;
  const maxHue = cfg.maxHueOffsetDeg ?? 170;
  const minLight = cfg.minLightnessOffset ?? 8;
  const maxLight = cfg.maxLightnessOffset ?? 26;

  const hueOffset = randomBetween(minHue, maxHue) * (Math.random() < 0.5 ? -1 : 1);
  const lightOffset = randomBetween(minLight, maxLight) * (Math.random() < 0.5 ? -1 : 1);

  const newHue = (h + hueOffset + 360) % 360;
  const newLight = clamp(l + lightOffset, 15, 85);
  const newSat = clamp(s + randomBetween(-20, 20), 20, 90);

  return hslToHex({ h: newHue, s: newSat, l: newLight });
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
  const { score, deltaE } = calculateScore(userHex, question.answerColor, config.scoring);

  const entry = {
    questionId: question.id,
    title: question.title,
    titleEn: question.titleEn,
    thumbnail: question.thumbnail,
    originalImage: question.originalImage,
    score,
    deltaE,
    userColor: userHex,
    answerColor: question.answerColor,
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
