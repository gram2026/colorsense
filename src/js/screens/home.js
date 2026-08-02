/** 메인 화면 (colorguesserdesign-referencemain-reference.html 레이아웃) */

import { qs, iconSvg, formatNumber } from "../utils/dom.js";
import { loadCategoriesWithMeta, loadConfig } from "../data-loader.js";
import {
  getOverallBestScore,
  getSoundEnabled,
  setSoundEnabled,
  hasSeenTutorial,
  setTutorialSeen,
} from "../storage.js";
import { setState, resetGame } from "../state.js";
import { navigate } from "../router.js";
import { showToast } from "../toast.js";

let onMouseMove = null;

export function mount(container) {
  const root = qs(".screen-inner", container);
  const bestScore = getOverallBestScore();
  const soundOn = getSoundEnabled();

  root.innerHTML = `
    <div class="home-topbar">
      <button type="button" class="topbar-brand" data-action="home" aria-label="홈으로">
        <span class="logo-mark" aria-hidden="true"></span>
        <span class="topbar-brand__name">ColorGuesser</span>
      </button>
      <div class="row" style="gap: var(--space-2)">
        <button type="button" class="icon-btn" data-action="sound" aria-label="${
          soundOn ? "소리 끄기" : "소리 켜기"
        }">${iconSvg(soundOn ? "soundOn" : "soundOff")}</button>
        <button type="button" class="icon-btn" data-action="settings" aria-label="설정 열기">${iconSvg(
          "settings"
        )}</button>
      </div>
    </div>

    <section class="home-hero">
      <div class="home-hero__content">
        <h1 class="home-logo">ColorGuesser</h1>
        <p class="home-hero__meta">색을 맞혀보세요 · 최고 기록 <strong>${formatNumber(bestScore)}점</strong></p>
        <button type="button" class="btn btn--play" data-action="play" aria-label="게임 시작">
          ${iconSvg("play", 18)}<span>PLAY</span>
        </button>
      </div>
      <div class="home-hero__visual" aria-hidden="true">
        <div class="home-hero__grid">
          <div class="home-hero__cell" style="background:#e4572e"></div>
          <div class="home-hero__cell home-hero__cell--offset" style="background:#3a6ea5"></div>
          <div class="home-hero__cell" style="background:#f3a712"></div>
          <div class="home-hero__cell home-hero__cell--offset" style="background:#4c9a2a"></div>
          <div class="home-hero__cell home-hero__cell--accent">${iconSvg("check", 26)}</div>
          <div class="home-hero__cell home-hero__cell--offset" style="background:#8e5b3c"></div>
          <div class="home-hero__cell" style="background:#d4c5a9"></div>
          <div class="home-hero__cell home-hero__cell--offset" style="background:#7a5aa3"></div>
          <div class="home-hero__cell" style="background:#2d6e6e"></div>
        </div>
      </div>
    </section>

    <hr class="home-divider" />

    <section class="home-categories-section" data-role="categories-section">
      <h2 class="home-categories-section__title">카테고리</h2>
      <div class="grid-categories" data-role="category-list">
        <div class="spinner" role="status" aria-label="불러오는 중"></div>
      </div>
    </section>

    <hr class="home-divider" />

    <footer class="home-footer">
      <span>© ${new Date().getFullYear()} ColorGuesser</span>
    </footer>

    <div class="overlay" data-role="tutorial-overlay" hidden>
      <div class="tutorial-card">
        <h2 data-role="tutorial-title"></h2>
        <p data-role="tutorial-desc"></p>
        <div class="tutorial-card__step-dots" data-role="tutorial-dots"></div>
        <div class="stack" style="margin-top: var(--space-5)">
          <button type="button" class="btn btn--primary btn--block" data-role="tutorial-next">다음</button>
        </div>
      </div>
    </div>

    <div class="overlay" data-role="settings-overlay" hidden>
      <div class="tutorial-card">
        <h2>설정</h2>
        <div class="row" style="justify-content: center; margin-top: var(--space-4)">
          <span>소리</span>
          <button type="button" class="btn btn--secondary" data-role="settings-sound-toggle"></button>
        </div>
        <div class="stack" style="margin-top: var(--space-5)">
          <button type="button" class="btn btn--ghost" data-role="settings-close">닫기</button>
        </div>
      </div>
    </div>
  `;

  root.querySelector('[data-action="home"]').addEventListener("click", () => navigate("home"));

  root.querySelector('[data-action="sound"]').addEventListener("click", () => {
    const next = !getSoundEnabled();
    setSoundEnabled(next);
    setState({ soundEnabled: next }, { persist: false });
    mount(container); // 아이콘 갱신을 위해 다시 렌더
  });

  root.querySelector('[data-action="settings"]').addEventListener("click", () => {
    openSettings(root);
  });

  root.querySelector('[data-action="play"]').addEventListener("click", async () => {
    resetGame();
    const config = await loadConfig();
    const steps = config.app?.tutorialSteps || [];
    if (!hasSeenTutorial() && steps.length > 0) {
      showTutorial(root, steps, () => scrollToCategories(root));
    } else {
      scrollToCategories(root);
    }
  });

  setupHeroGlow(container);
  loadHomeCategories(root);
}

/** 히어로 영역에서 마우스를 따라다니는 은은한 스포트라이트 (레퍼런스 디자인의 마우스 추적 글로우) */
function setupHeroGlow(container) {
  const heroEl = qs(".home-hero", container);
  if (!heroEl) return;

  onMouseMove = (e) => {
    const rect = heroEl.getBoundingClientRect();
    heroEl.style.setProperty("--mx", `${((e.clientX - rect.left) / rect.width) * 100}%`);
    heroEl.style.setProperty("--my", `${((e.clientY - rect.top) / rect.height) * 100}%`);
  };
  window.addEventListener("mousemove", onMouseMove);
}

/** 레퍼런스의 fast-slow-fast 이징으로 카테고리 섹션까지 부드럽게 스크롤 */
function scrollToCategories(root) {
  const target = root.querySelector('[data-role="categories-section"]');
  if (!target) return;

  const startY = window.scrollY;
  const targetY = target.getBoundingClientRect().top + startY - 24;
  const distance = targetY - startY;
  const duration = 700;
  const startTime = performance.now();
  const ease = (t) => t + (0.5 * Math.sin(2 * Math.PI * t)) / (2 * Math.PI);

  function step(now) {
    const elapsed = Math.min((now - startTime) / duration, 1);
    window.scrollTo(0, startY + distance * ease(elapsed));
    if (elapsed < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

async function loadHomeCategories(root) {
  const listEl = root.querySelector('[data-role="category-list"]');
  try {
    const categories = await loadCategoriesWithMeta();
    if (categories.length === 0) {
      listEl.innerHTML = `<p class="empty-state" style="padding: var(--space-2)">카테고리를 불러올 수 없어요</p>`;
      return;
    }
    listEl.innerHTML = categories.map((c) => renderCategoryCard(c)).join("");

    for (const card of listEl.querySelectorAll("[data-category-id]")) {
      card.addEventListener("click", () => {
        const categoryId = card.dataset.categoryId;
        const category = categories.find((c) => c.id === categoryId);
        if (category.questionCount === 0) {
          showToast("아직 준비 중인 카테고리예요");
          return;
        }
        resetGame();
        setState({ selectedCategoryId: categoryId }, { persist: false });
        navigate("category-detail");
      });
    }
  } catch (err) {
    console.error("[home] 카테고리 로드 실패", err);
    listEl.innerHTML = `<p class="empty-state" style="padding: var(--space-2)">카테고리를 불러올 수 없어요</p>`;
    showToast("카테고리를 불러오지 못했어요");
  }
}

function renderCategoryCard(category) {
  const empty = category.questionCount === 0;
  return `
    <button type="button" class="category-card${empty ? " category-card--disabled" : ""}" data-category-id="${category.id}"
      aria-label="${category.name}${empty ? ", 준비 중" : ""}">
      <img class="category-card__thumb" src="${category.thumbnail}" alt="${category.name}" loading="lazy"
           onerror="this.style.background='var(--bg-page-alt)'; this.removeAttribute('src');" />
      ${empty ? `<span class="category-card__badge">준비 중</span>` : ""}
    </button>
  `;
}

function showTutorial(root, steps, onDone) {
  const overlay = root.querySelector('[data-role="tutorial-overlay"]');
  const titleEl = root.querySelector('[data-role="tutorial-title"]');
  const descEl = root.querySelector('[data-role="tutorial-desc"]');
  const dotsEl = root.querySelector('[data-role="tutorial-dots"]');
  const nextBtn = root.querySelector('[data-role="tutorial-next"]');

  let index = 0;

  function render() {
    titleEl.textContent = steps[index].title;
    descEl.textContent = steps[index].desc;
    dotsEl.innerHTML = steps
      .map((_, i) => `<span class="tutorial-card__dot${i === index ? " is-active" : ""}"></span>`)
      .join("");
    nextBtn.textContent = index === steps.length - 1 ? "시작하기" : "다음";
  }

  nextBtn.onclick = () => {
    if (index < steps.length - 1) {
      index += 1;
      render();
    } else {
      overlay.hidden = true;
      setTutorialSeen();
      onDone();
    }
  };

  render();
  overlay.hidden = false;
}

function openSettings(root) {
  const overlay = root.querySelector('[data-role="settings-overlay"]');
  const toggleBtn = root.querySelector('[data-role="settings-sound-toggle"]');
  const closeBtn = root.querySelector('[data-role="settings-close"]');

  function renderToggle() {
    toggleBtn.textContent = getSoundEnabled() ? "켜짐" : "꺼짐";
  }

  toggleBtn.onclick = () => {
    setSoundEnabled(!getSoundEnabled());
    setState({ soundEnabled: getSoundEnabled() }, { persist: false });
    renderToggle();
  };
  closeBtn.onclick = () => {
    overlay.hidden = true;
  };

  renderToggle();
  overlay.hidden = false;
}

export function unmount() {
  if (onMouseMove) {
    window.removeEventListener("mousemove", onMouseMove);
    onMouseMove = null;
  }
}
