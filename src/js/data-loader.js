/**
 * JSON 데이터 로딩 + 검증
 * config.json / categories.json / questions/*.json 을 읽어오고,
 * 잘못된 문제는 전체를 중단시키지 않고 콘솔에 오류를 남긴 뒤 제외한다.
 */

import { validateQuestionShape, findDuplicateIds, validateCategoryShape } from "./utils/validation.js";
import { getLang } from "./i18n.js";

let configCache = null;
let categoriesCache = null;
const questionFileCache = new Map(); // questionFile -> questions[]

async function fetchJson(path) {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`JSON 로드 실패 (${res.status}): ${path}`);
  }
  return res.json();
}

export async function loadConfig() {
  if (configCache) return configCache;
  try {
    configCache = await fetchJson("src/data/config.json");
  } catch (err) {
    console.error("[data-loader] config.json 로드 실패, 기본값을 사용합니다.", err);
    configCache = {
      scoring: {
        maxScore: 100,
        method: "ciede2000",
        perfectThreshold: 1,
        zeroScoreThreshold: 80,
        curveExponent: 1.1,
        hardTopFrom: 96,
        hardTopExponent: 3,
      },
      startColor: {
        minHueOffsetDeg: 35,
        maxHueOffsetDeg: 65,
        minSaturationOffset: 16,
        maxSaturationOffset: 30,
        startValue: 93,
      },
      randomCategory: { id: "random", maxQuestions: 6 },
      app: { defaultSoundEnabled: true, tutorialSteps: { ko: [], en: [] } },
    };
  }
  return configCache;
}

async function loadQuestionFile(questionFile) {
  if (questionFileCache.has(questionFile)) {
    return questionFileCache.get(questionFile);
  }

  let raw;
  try {
    raw = await fetchJson(questionFile);
  } catch (err) {
    console.error(`[data-loader] 문제 파일 로드 실패: ${questionFile}`, err);
    questionFileCache.set(questionFile, []);
    return [];
  }

  const rawQuestions = Array.isArray(raw.questions) ? raw.questions : [];
  const duplicates = findDuplicateIds(rawQuestions);
  if (duplicates.size > 0) {
    console.error(`[data-loader] ${questionFile} 에 중복된 문제 id가 있습니다:`, [...duplicates.keys()]);
  }

  const seenIds = new Set();
  const valid = [];

  for (const question of rawQuestions) {
    const errors = validateQuestionShape(question);
    if (errors.length > 0) {
      console.error(`[data-loader] 문제 "${question?.id ?? "(id 없음)"}" 검증 실패:`, errors);
      continue;
    }
    if (question.enabled === false) continue;
    if (seenIds.has(question.id)) {
      console.error(`[data-loader] 중복 id로 제외됨: ${question.id}`);
      continue;
    }
    seenIds.add(question.id);
    valid.push({ ...question, categoryId: raw.categoryId, categoryName: raw.categoryName });
  }

  questionFileCache.set(questionFile, valid);
  return valid;
}

export async function loadCategories() {
  if (categoriesCache) return categoriesCache;

  let raw;
  try {
    raw = await fetchJson("src/data/categories.json");
  } catch (err) {
    console.error("[data-loader] categories.json 로드 실패", err);
    categoriesCache = [];
    return categoriesCache;
  }

  const list = Array.isArray(raw.categories) ? raw.categories : [];
  const result = [];

  for (const category of list) {
    const errors = validateCategoryShape(category);
    if (errors.length > 0) {
      console.error(`[data-loader] 카테고리 "${category?.id ?? "(id 없음)"}" 검증 실패:`, errors);
      continue;
    }
    if (category.enabled === false) continue;
    result.push(category);
  }

  result.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  categoriesCache = result;
  return result;
}

/** 카테고리의 화면 표시용 이름. 영어 번역(nameEn)이 있으면 언어에 맞춰 골라 쓴다. */
export function getCategoryName(category) {
  if (getLang() === "en" && category.nameEn) return category.nameEn;
  return category.name;
}

/** 카테고리의 화면 표시용 설명. 영어 번역(descriptionEn)이 있으면 언어에 맞춰 골라 쓴다. */
export function getCategoryDescription(category) {
  if (getLang() === "en" && category.descriptionEn) return category.descriptionEn;
  return category.description || "";
}

/** 카테고리 하나의 (검증 통과한) 문제 목록. "random" 믹스 카테고리는 별도 처리. */
export async function loadQuestionsForCategory(categoryId) {
  const categories = await loadCategories();
  const category = categories.find((c) => c.id === categoryId);
  if (!category) {
    console.error(`[data-loader] 존재하지 않는 카테고리: ${categoryId}`);
    return [];
  }

  if (category.isRandomMix) {
    return loadRandomMixQuestions(categories, category);
  }

  if (!category.questionFile) {
    console.error(`[data-loader] 카테고리 ${categoryId}에 questionFile이 없습니다.`);
    return [];
  }

  const questions = await loadQuestionFile(category.questionFile);
  return shuffle(questions);
}

async function loadRandomMixQuestions(categories, randomCategory) {
  const config = await loadConfig();
  const maxQuestions = config.randomCategory?.maxQuestions ?? 6;

  const pools = await Promise.all(
    categories
      .filter((c) => !c.isRandomMix && c.questionFile)
      .map((c) => loadQuestionFile(c.questionFile))
  );

  const all = pools.flat();
  const shuffled = shuffle(all);
  return shuffled.slice(0, maxQuestions);
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** 카테고리 화면 카드에 표시할 문제 수 등 부가 정보를 미리 계산 */
export async function loadCategoriesWithMeta() {
  const categories = await loadCategories();
  const withMeta = await Promise.all(
    categories.map(async (category) => {
      const questions = await loadQuestionsForCategory(category.id);
      return { ...category, questionCount: questions.length };
    })
  );
  return withMeta;
}
