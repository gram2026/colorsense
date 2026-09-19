/**
 * 화면 라우터
 * 일반 화면은 기존 해시 주소를 유지하고, 게임 화면은 선택한 카테고리명을
 * 경로로 표시한다. 예: 국가 게임 -> /contryflag
 */

import { qs, qsa } from "./utils/dom.js";
import { getState, setState } from "./state.js";
import { t } from "./i18n.js";
import { loadQuestionsForCategory } from "./data-loader.js";

const VALID_SCREENS = [
  "home",
  "categories",
  "category-detail",
  "game",
  "round-result",
  "final-result",
];

const SCREEN_ARIA_KEYS = {
  home: "screen.home",
  categories: "screen.categories",
  "category-detail": "screen.categoryDetail",
  game: "screen.game",
  "round-result": "screen.roundResult",
  "final-result": "screen.finalResult",
};

const CATEGORY_PATHS = {
  "brand-logo": "brandlogo",
  sports: "sports",
  country: "contryflag",
  animation: "animation",
  meme: "meme",
  pokemon: "pokemon",
};

const PATH_CATEGORIES = new Map(
  Object.entries(CATEGORY_PATHS).map(([categoryId, pathname]) => [pathname, categoryId])
);
// 올바른 영문 철자로 들어와도 요청한 주소로 정규화한다.
PATH_CATEGORIES.set("countryflag", "country");

const screenModules = new Map(); // screenId -> { mount, unmount }
let currentModule = null;
let currentScreenId = null;

export function registerScreen(screenId, module) {
  screenModules.set(screenId, module);
}

function screenIdFromLocation() {
  const raw = (location.hash || "").replace(/^#\/?/, "").trim();
  if (VALID_SCREENS.includes(raw)) return raw;
  return categoryIdFromPath() ? "game" : null;
}

function categoryIdFromPath() {
  const pathname = location.pathname.replace(/^\/+|\/+$/g, "").toLowerCase();
  return PATH_CATEGORIES.get(pathname) || null;
}

function urlForScreen(screenId) {
  if (screenId === "game") {
    const categoryPath = CATEGORY_PATHS[getState().selectedCategoryId];
    if (categoryPath) return `/${categoryPath}`;
  }
  return `/#${screenId}`;
}

/** 잘못된 경로(존재하지 않는 화면, 데이터 없이 진입 등)를 안전한 화면으로 보정한다. */
function resolveSafeScreen(requestedId) {
  const state = getState();

  if (!requestedId) return "home";

  const needsCategory = requestedId === "category-detail" || requestedId === "game";
  if (needsCategory && !state.selectedCategoryId) return "categories";

  const needsQuestions =
    requestedId === "game" || requestedId === "round-result" || requestedId === "final-result";
  if (needsQuestions && (!state.questions || state.questions.length === 0)) {
    return state.selectedCategoryId ? "category-detail" : "categories";
  }

  return requestedId;
}

export function navigate(screenId, { replace = false } = {}) {
  const target = urlForScreen(screenId);
  const current = `${location.pathname}${location.hash}`;
  if (replace) {
    history.replaceState({ screenId }, "", target);
  } else if (current !== target) {
    history.pushState({ screenId }, "", target);
  }
  renderScreen(screenId);
}

function renderScreen(screenId) {
  const safeId = resolveSafeScreen(screenId);
  if (safeId !== screenId) {
    navigate(safeId, { replace: true });
    return;
  }

  if (currentModule && typeof currentModule.unmount === "function") {
    try {
      currentModule.unmount();
    } catch (err) {
      console.error("[router] 이전 화면 정리 중 오류", err);
    }
  }

  for (const section of qsa(".screen")) {
    section.classList.toggle("is-active", section.dataset.screenId === safeId);
    const ariaKey = SCREEN_ARIA_KEYS[section.dataset.screenId];
    if (ariaKey) section.setAttribute("aria-label", t(ariaKey));
  }

  currentScreenId = safeId;
  setState({ currentScreen: safeId });

  const module = screenModules.get(safeId);
  currentModule = module || null;
  const container = qs(`.screen[data-screen-id="${safeId}"]`);
  if (module && container) {
    try {
      module.mount(container);
    } catch (err) {
      console.error(`[router] "${safeId}" 화면 mount 중 오류`, err);
    }
  }

  window.scrollTo(0, 0);
}

export async function initRouter() {
  window.addEventListener("popstate", () => {
    renderScreen(screenIdFromLocation());
  });

  const pathCategoryId = categoryIdFromPath();
  if (pathCategoryId) {
    const state = getState();
    if (state.selectedCategoryId !== pathCategoryId || !state.questions?.length) {
      try {
        const questions = await loadQuestionsForCategory(pathCategoryId);
        setState(
          {
            selectedCategoryId: pathCategoryId,
            questions,
            currentQuestionIndex: 0,
            roundScores: [],
            totalScore: 0,
          },
          { persist: false }
        );
      } catch (err) {
        console.error(`[router] "${pathCategoryId}" 카테고리 로드 실패`, err);
      }
    }
  }

  const initialScreen = screenIdFromLocation() || getState().currentScreen || "home";
  navigate(initialScreen, { replace: true });
}

export function getCurrentScreenId() {
  return currentScreenId;
}
