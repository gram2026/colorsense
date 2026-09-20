/**
 * localStorage / sessionStorage 접근을 한 곳에 모아둔다.
 * 저장 공간을 사용할 수 없는 환경(프라이빗 모드 등)에서도 앱이 죽지 않게
 * 모든 접근을 try/catch로 감싸고, 실패하면 메모리 안에서만 동작한다.
 */

const STORAGE_KEY = "colorguesser_data";
const SESSION_KEY = "colorguesser_session";
// v2: 점수 체계를 1000점 만점 합계 -> 100점 만점 평균으로 바꾸면서 척도가 달라져
// 예전에 저장된 bestScores/overallBest를 그대로 비교하면 항상 "최고 기록"에 못 미치게 된다.
// 버전을 올려서 예전 데이터는 안전하게 초기화한다.
const DATA_VERSION = 2;

function defaultData() {
  return {
    version: DATA_VERSION,
    bestScores: {}, // { [categoryId]: number }
    overallBest: 0,
    soundEnabled: true,
    tutorialSeen: false,
  };
}

let memoryFallback = defaultData();
let localStorageOk = true;

function readRaw() {
  if (!localStorageOk) return memoryFallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== DATA_VERSION) {
      // 구조가 바뀐 이전 버전 데이터는 안전하게 초기화한다.
      return defaultData();
    }
    return { ...defaultData(), ...parsed };
  } catch (err) {
    console.error("[storage] localStorage 읽기 실패, 메모리 저장으로 대체합니다.", err);
    localStorageOk = false;
    return memoryFallback;
  }
}

function writeRaw(data) {
  if (!localStorageOk) {
    memoryFallback = data;
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error("[storage] localStorage 쓰기 실패, 메모리 저장으로 대체합니다.", err);
    localStorageOk = false;
    memoryFallback = data;
  }
}

export function getBestScore(categoryId) {
  return readRaw().bestScores[categoryId] ?? 0;
}

export function getOverallBestScore() {
  return readRaw().overallBest ?? 0;
}

/** @returns {{ isNewBest: boolean, previousBest: number }} */
export function submitBestScore(categoryId, score) {
  const data = readRaw();
  const previousBest = data.bestScores[categoryId] ?? 0;
  const isNewBest = score > previousBest;
  if (isNewBest) {
    data.bestScores[categoryId] = score;
  }
  if (score > (data.overallBest ?? 0)) {
    data.overallBest = score;
  }
  writeRaw(data);
  return { isNewBest, previousBest };
}

export function getSoundEnabled() {
  return readRaw().soundEnabled !== false;
}

export function setSoundEnabled(enabled) {
  const data = readRaw();
  data.soundEnabled = !!enabled;
  writeRaw(data);
}

export function hasSeenTutorial() {
  return !!readRaw().tutorialSeen;
}

export function setTutorialSeen() {
  const data = readRaw();
  data.tutorialSeen = true;
  writeRaw(data);
}

// ---------- 세션 복구 (새로고침 시 진행 중이던 게임 복구) ----------

export function saveSessionGame(snapshot) {
  try {
    window.sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ version: DATA_VERSION, ...snapshot })
    );
  } catch (err) {
    console.error("[storage] sessionStorage 저장 실패", err);
  }
}

export function loadSessionGame() {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== DATA_VERSION) return null;
    return parsed;
  } catch (err) {
    console.error("[storage] sessionStorage 읽기 실패", err);
    return null;
  }
}

export function clearSessionGame() {
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // 접근 불가 시 무시
  }
}
