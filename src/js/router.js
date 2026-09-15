/**
 * 아주 단순한 해시 기반 라우터
 * 화면 이름(#home, #categories ...)만 URL에 남기고, 실제 데이터(선택한 카테고리 등)는
 * state.js가 들고 있는다. 그래야 새로고침/뒤로가기에도 안전하게 대응할 수 있다.
 */

import { qs, qsa } from "./utils/dom.js";
import { getState, setState } from "./state.js";
import { t } from "./i18n.js";

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

const screenModules = new Map(); // screenId -> { mount, unmount }
let currentModule = null;
let currentScreenId = null;

export function registerScreen(screenId, module) {
  screenModules.set(screenId, module);
}

function screenIdFromHash() {
  const raw = (location.hash || "").replace(/^#\/?/, "").trim();
  return VALID_SCREENS.includes(raw) ? raw : null;
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
  const target = `#${screenId}`;
  if (replace) {
    history.replaceState(null, "", target);
  } else if (location.hash !== target) {
    location.hash = target;
    return; // hashchange 이벤트가 실제 렌더링을 담당한다
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

export function initRouter() {
  window.addEventListener("hashchange", () => {
    renderScreen(screenIdFromHash());
  });

  const initialScreen = screenIdFromHash() || getState().currentScreen || "home";
  navigate(initialScreen, { replace: true });
}

export function getCurrentScreenId() {
  return currentScreenId;
}
