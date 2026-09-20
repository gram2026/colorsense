/**
 * 전역 게임 상태 (아주 단순한 pub/sub 스토어)
 * 화면들은 setState로 상태를 바꾸고, subscribe로 변경을 감지한다.
 */

import { saveSessionGame, loadSessionGame, clearSessionGame, getSoundEnabled } from "./storage.js";
import { dailyKey } from './quiz-session.js';

function createInitialState() {
  return {
    currentScreen: "home",
    selectedCategoryId: null,
    questions: [],
    currentQuestionIndex: 0,
    currentColor: "#808080",
    roundScores: [], // [{ questionId, score, deltaE, userColor, appliedColor, answerColor }]
    totalScore: 0,
    soundEnabled: getSoundEnabled(),
  };
}

let state = createInitialState();
const listeners = new Set();

// 새로고침 복구에 필요한 최소 정보만 세션에 저장한다 (이미지 등 무거운 데이터는 저장하지 않음).
const PERSISTED_KEYS = [
  "currentScreen",
  "selectedCategoryId",
  "questions",
  "currentQuestionIndex",
  "roundScores",
  "totalScore",
  "runId",
  "quizDay",
];

export function getState() {
  return state;
}

export function setState(partial, { persist = true } = {}) {
  if (partial.questions?.length && partial.currentQuestionIndex === 0 && partial.roundScores?.length === 0) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    const runId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    partial = { ...partial, runId, quizDay: (partial.selectedCategoryId || state.selectedCategoryId) === 'daily' ? dailyKey() : null };
  }
  state = { ...state, ...partial };
  for (const listener of listeners) listener(state);
  if (persist) persistSnapshot();
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function persistSnapshot() {
  // 게임 진행 중일 때만 복구용 스냅샷을 남긴다.
  if (state.currentScreen === "home" || state.currentScreen === "categories") {
    clearSessionGame();
    return;
  }
  const snapshot = {};
  for (const key of PERSISTED_KEYS) snapshot[key] = state[key];
  saveSessionGame(snapshot);
}

/** 앱 시작 시 1회 호출. 이전 세션에 진행 중이던 게임이 있으면 복구한다. */
export function tryRestoreSession() {
  const saved = loadSessionGame();
  if (!saved || !saved.selectedCategoryId) return false;
  state = { ...state, ...saved };
  return true;
}

export function resetGame() {
  setState(
    {
      selectedCategoryId: null,
      questions: [],
      currentQuestionIndex: 0,
      currentColor: "#808080",
      roundScores: [],
      totalScore: 0,
    },
    { persist: false }
  );
  clearSessionGame();
}
