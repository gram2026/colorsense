/**
 * 다국어(i18n) 지원
 * - 저장된 언어 선택이 있으면 그걸 쓰고, 없으면 Geo-IP(functions/api/geo.js)로 국가를 감지해
 *   한국(KR)이면 한국어, 그 외에는 영어를 기본값으로 쓴다.
 * - 사용자가 언어를 직접 바꾸면 그 선택만 localStorage에 저장한다 (자동 감지 결과는 저장하지 않음
 *   -> 다음 방문에서도 계속 Geo-IP로 다시 판단할 수 있게).
 * - 카테고리/문제 데이터(JSON)의 실제 콘텐츠(제목, 설명 등)는 번역 대상이 아니다.
 *   여기서 다루는 건 화면에 고정으로 박혀있는 UI 문구뿐이다.
 */

const STORAGE_KEY = "colorguesser_lang";
export const SUPPORTED_LANGS = ["ko", "en"];
const DEFAULT_LANG = "ko";

const dict = {
  ko: {
    "meta.title": "ColorsGuesser",
    "meta.description": "사진 속 색을 직접 맞춰보는 캐주얼 컬러 게임",

    "screen.home": "메인 화면",
    "screen.categories": "카테고리 선택 화면",
    "screen.categoryDetail": "카테고리 상세 화면",
    "screen.game": "게임 화면",
    "screen.roundResult": "문제 결과 화면",
    "screen.finalResult": "최종 결과 화면",

    "app.name": "ColorsGuesser",
    "nav.home": "홈으로",
    "nav.backToMain": "메인으로",
    "nav.langButton": "언어 변경",
    "nav.sound.on": "소리 끄기",
    "nav.sound.off": "소리 켜기",
    "nav.settings": "설정 열기",

    "home.tagline": "색을 맞혀보세요 · 최고 평균 {score}점",
    "home.play": "PLAY",
    "home.categoriesTitle": "카테고리",
    "home.categoriesLoadError": "카테고리를 불러올 수 없어요",
    "home.footer": "© {year} ColorsGuesser",

    "tutorial.next": "다음",
    "tutorial.start": "시작하기",

    "settings.title": "설정",
    "settings.sound": "소리",
    "settings.on": "켜짐",
    "settings.off": "꺼짐",
    "settings.close": "닫기",
    "settings.language": "언어",

    "category.badge.comingSoon": "준비 중",
    "category.badge.questionCount": "문제 {count}개",
    "category.badge.bestAverage": "최고 평균 {score}점",
    "category.toast.comingSoon": "아직 준비 중인 카테고리예요",

    "categories.title": "카테고리",
    "categories.empty": "불러올 수 있는 카테고리가 없어요.",
    "categories.loadErrorInline": "카테고리를 불러오지 못했어요. 새로고침해보세요.",
    "categories.loadErrorToast": "카테고리를 불러오지 못했어요",

    "categoryDetail.notFound": "카테고리를 찾을 수 없어요.",
    "categoryDetail.eyebrow": "CATEGORY",
    "categoryDetail.empty": "이 카테고리는 아직 문제가 없어요.",
    "categoryDetail.start": "시작하기",
    "categoryDetail.startAria": "게임 시작",
    "categoryDetail.loadErrorInline": "문제를 불러오지 못했어요.",
    "categoryDetail.loadErrorToast": "문제를 불러오지 못했어요",

    "game.exitAria": "게임 나가기",
    "game.canvasAria": "색을 바꿀 수 있는 사진",
    "game.exitConfirm": "게임을 나가면 지금까지의 진행 상황이 사라져요. 나가시겠어요?",
    "game.loading": "사진을 불러오는 중...",
    "game.loadErrorText": "사진을 불러오지 못했어요.",
    "game.loadErrorSkip": "다음 문제로",
    "game.maskMissingToast": "이 문제는 색상 미리보기를 사용할 수 없어요",

    "colorPicker.svAria": "색상과 채도 선택",
    "colorPicker.hueAria": "색상(Hue) 선택",
    "colorPicker.lightnessAria": "밝기 선택",
    "colorPicker.submit": "제출",
    "colorPicker.submitAria": "색상 제출",
    "colorPicker.svValueText": "색상 {h}, 채도 {s}",

    "roundResult.scoreLabel": "획득 점수",
    "roundResult.myPick": "내 선택",
    "roundResult.answer": "정답",
    "roundResult.original": "원본",
    "roundResult.myVersion": "내가 만든 색",
    "roundResult.next": "다음 문제",
    "roundResult.viewFinal": "결과 보기",

    "scoreComment.perfect": "완벽해요",
    "scoreComment.great": "거의 같아요",
    "scoreComment.good": "꽤 비슷해요",
    "scoreComment.okay": "조금만 더",
    "scoreComment.different": "색감이 꽤 달라요",

    "grade.S": "색채 감각 최고",
    "grade.A": "훌륭해요",
    "grade.B": "좋아요",
    "grade.C": "괜찮아요",
    "grade.D": "다시 도전해봐요",

    "finalResult.title": "{categoryName} 결과",
    "finalResult.totalScore": "{score}점",
    "finalResult.averageBadge": "평균 점수",
    "finalResult.roundBadge": "{count} Round",
    "finalResult.newBest": "최고 기록 갱신!",
    "finalResult.share": "결과 공유",
    "finalResult.replay": "다시 하기",
    "finalResult.toCategories": "카테고리로",
    "finalResult.toHome": "메인으로",
    "finalResult.shareSuccess": "공유했어요",
    "finalResult.shareClipboard": "결과 문구를 클립보드에 복사했어요",
    "finalResult.shareFail": "공유에 실패했어요. 직접 캡처해서 공유해보세요",

    "share.text": "ColorsGuesser {categoryName} 카테고리에서 {roundCount} Round 평균 {averageScore}점을 기록했어요! 당신의 색감은 몇 점인가요?",
  },

  en: {
    "meta.title": "ColorsGuesser",
    "meta.description": "A casual color game where you match the color hidden in a photo",

    "screen.home": "Home screen",
    "screen.categories": "Category selection screen",
    "screen.categoryDetail": "Category detail screen",
    "screen.game": "Game screen",
    "screen.roundResult": "Round result screen",
    "screen.finalResult": "Final result screen",

    "app.name": "ColorsGuesser",
    "nav.home": "Home",
    "nav.backToMain": "Back to home",
    "nav.langButton": "Change language",
    "nav.sound.on": "Mute sound",
    "nav.sound.off": "Unmute sound",
    "nav.settings": "Open settings",

    "home.tagline": "Guess the color · Best average {score}",
    "home.play": "PLAY",
    "home.categoriesTitle": "Categories",
    "home.categoriesLoadError": "Couldn't load categories",
    "home.footer": "© {year} ColorsGuesser",

    "tutorial.next": "Next",
    "tutorial.start": "Start",

    "settings.title": "Settings",
    "settings.sound": "Sound",
    "settings.on": "On",
    "settings.off": "Off",
    "settings.close": "Close",
    "settings.language": "Language",

    "category.badge.comingSoon": "Coming soon",
    "category.badge.questionCount": "{count} questions",
    "category.badge.bestAverage": "Best avg {score}",
    "category.toast.comingSoon": "This category isn't ready yet",

    "categories.title": "Categories",
    "categories.empty": "No categories available.",
    "categories.loadErrorInline": "Couldn't load categories. Try refreshing.",
    "categories.loadErrorToast": "Couldn't load categories",

    "categoryDetail.notFound": "Category not found.",
    "categoryDetail.eyebrow": "CATEGORY",
    "categoryDetail.empty": "This category doesn't have any questions yet.",
    "categoryDetail.start": "Start",
    "categoryDetail.startAria": "Start game",
    "categoryDetail.loadErrorInline": "Couldn't load questions.",
    "categoryDetail.loadErrorToast": "Couldn't load questions",

    "game.exitAria": "Exit game",
    "game.canvasAria": "Photo you can recolor",
    "game.exitConfirm": "Leaving now will lose your progress. Exit anyway?",
    "game.loading": "Loading photo...",
    "game.loadErrorText": "Couldn't load the photo.",
    "game.loadErrorSkip": "Next question",
    "game.maskMissingToast": "Color preview isn't available for this question",

    "colorPicker.svAria": "Choose hue and saturation",
    "colorPicker.hueAria": "Choose hue",
    "colorPicker.lightnessAria": "Choose brightness",
    "colorPicker.submit": "Submit",
    "colorPicker.submitAria": "Submit color",
    "colorPicker.svValueText": "Hue {h}, Saturation {s}",

    "roundResult.scoreLabel": "Score",
    "roundResult.myPick": "My pick",
    "roundResult.answer": "Answer",
    "roundResult.original": "Original",
    "roundResult.myVersion": "My version",
    "roundResult.next": "Next question",
    "roundResult.viewFinal": "View results",

    "scoreComment.perfect": "Perfect!",
    "scoreComment.great": "Almost identical",
    "scoreComment.good": "Pretty close",
    "scoreComment.okay": "So close",
    "scoreComment.different": "Quite different",

    "grade.S": "Amazing color sense",
    "grade.A": "Excellent",
    "grade.B": "Good job",
    "grade.C": "Not bad",
    "grade.D": "Give it another try",

    "finalResult.title": "{categoryName} results",
    "finalResult.totalScore": "{score}",
    "finalResult.averageBadge": "Average score",
    "finalResult.roundBadge": "{count} Round",
    "finalResult.newBest": "New best record!",
    "finalResult.share": "Share results",
    "finalResult.replay": "Play again",
    "finalResult.toCategories": "Categories",
    "finalResult.toHome": "Home",
    "finalResult.shareSuccess": "Shared!",
    "finalResult.shareClipboard": "Copied your result to the clipboard",
    "finalResult.shareFail": "Couldn't share. Try taking a screenshot instead",

    "share.text": "I scored an average of {averageScore} over {roundCount} rounds in ColorsGuesser's {categoryName} category! How good is your color sense?",
  },
};

let currentLang = DEFAULT_LANG;
const listeners = new Set();

function getStoredLang() {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** 화면 문구 하나를 번역한다. {name} 형태의 자리표시자는 vars로 채운다. */
export function t(key, vars) {
  const table = dict[currentLang] || dict[DEFAULT_LANG];
  let str = table[key] ?? dict[DEFAULT_LANG][key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      str = str.replaceAll(`{${name}}`, String(value));
    }
  }
  return str;
}

export function getLang() {
  return currentLang;
}

/** @param {{ persist?: boolean }} options persist:true면 사용자의 명시적 선택으로 저장한다. */
export function setLang(lang, { persist = true } = {}) {
  if (!SUPPORTED_LANGS.includes(lang)) return;
  currentLang = lang;
  document.documentElement.lang = lang;
  document.title = t("meta.title");
  const screenKeys = {
    home: "screen.home", categories: "screen.categories",
    "category-detail": "screen.categoryDetail", game: "screen.game",
    "round-result": "screen.roundResult", "final-result": "screen.finalResult",
  };
  for (const [id, key] of Object.entries(screenKeys)) {
    document.querySelector(`[data-screen-id="${id}"]`)?.setAttribute("aria-label", t(key));
  }
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute("content", t("meta.description"));
  if (persist) {
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch (err) {
      console.error("[i18n] 언어 선택 저장 실패", err);
    }
  }
  for (const listener of listeners) listener(lang);
}

/** 언어가 바뀔 때마다 호출된다 (현재 화면을 다시 그리는 용도). */
export function onLangChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function detectLangByGeo() {
  try {
    const res = await fetch("/api/geo", { cache: "no-store" });
    if (!res.ok) return DEFAULT_LANG;
    const data = await res.json();
    return data.country === "KR" ? "ko" : "en";
  } catch {
    return DEFAULT_LANG;
  }
}

/**
 * 앱 시작 시 1회 호출.
 * 저장된 선택이 있으면 그대로 쓰고, 없으면 Geo-IP로 감지한 값을 (저장하지 않고) 적용한다.
 */
export async function initI18n() {
  const stored = getStoredLang();
  if (stored && SUPPORTED_LANGS.includes(stored)) {
    setLang(stored, { persist: false });
    return;
  }
  const detected = await detectLangByGeo();
  setLang(detected, { persist: false });
}
