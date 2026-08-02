/**
 * 게임 데이터 로더 (카테고리 / 기존 문제 / 스키마)
 * 문제 제작기는 http://localhost:5173/problem-maker/ 아래에서 열리므로,
 * 게임 루트 기준 상대경로("src/data/...")를 그대로 fetch하면 problem-maker/ 밑을 찾아 404가 난다.
 * 그래서 항상 절대경로("/src/data/...")로 불러온다.
 */

let categoriesCache = null;
const questionFileCache = new Map(); // questionFile(절대경로) -> 문서 전체
let schemaCache = null;
let configCache = null;

async function fetchJson(absolutePath) {
  const res = await fetch(absolutePath);
  if (!res.ok) {
    throw new Error(`JSON 로드 실패 (HTTP ${res.status}): ${absolutePath}`);
  }
  return res.json();
}

export async function loadCategories({ force = false } = {}) {
  if (categoriesCache && !force) return categoriesCache;
  const doc = await fetchJson("/src/data/categories.json");
  categoriesCache = Array.isArray(doc.categories) ? doc.categories : [];
  return categoriesCache;
}

/** 문제 제작에 쓸 수 있는 카테고리만 (questionFile이 있고 활성화되어 있으며, 아직 준비 중이 아닌 카테고리) */
export async function loadUsableCategories() {
  const categories = await loadCategories();
  return categories.filter((c) => c.enabled !== false && !c.isRandomMix && !c.comingSoon && c.questionFile);
}

function toAbsoluteQuestionFilePath(questionFile) {
  return questionFile.startsWith("/") ? questionFile : `/${questionFile}`;
}

/** 카테고리의 기존 문제 파일 전체 문서({schemaVersion, categoryId, categoryName, questions}) */
export async function loadQuestionFileDoc(category, { force = false } = {}) {
  if (!category?.questionFile) return { schemaVersion: 1, categoryId: category?.id, categoryName: category?.name, questions: [] };
  const absPath = toAbsoluteQuestionFilePath(category.questionFile);
  if (questionFileCache.has(absPath) && !force) return questionFileCache.get(absPath);
  try {
    const doc = await fetchJson(absPath);
    questionFileCache.set(absPath, doc);
    return doc;
  } catch (err) {
    console.error("[project-loader] 문제 파일 로드 실패:", absPath, err);
    throw err;
  }
}

export async function loadExistingQuestions(category) {
  const doc = await loadQuestionFileDoc(category);
  return Array.isArray(doc.questions) ? doc.questions : [];
}

export async function loadQuestionSchema({ force = false } = {}) {
  if (schemaCache && !force) return schemaCache;
  schemaCache = await fetchJson("/problem-maker/shared/question-schema.json");
  return schemaCache;
}

/** 특정 카테고리 안에서 id가 이미 쓰이고 있는지 */
export async function isIdTaken(categoryId, id, { excludeId = null } = {}) {
  const categories = await loadCategories();
  const category = categories.find((c) => c.id === categoryId);
  if (!category) return false;
  const questions = await loadExistingQuestions(category);
  return questions.some((q) => q.id === id && q.id !== excludeId);
}

export function isValidQuestionId(id) {
  return typeof id === "string" && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id);
}

/** "objects-20260730-001" 형태의 안전한 기본 id를 제안한다 (사용자가 자유롭게 고칠 수 있음) */
export async function suggestQuestionId(categoryId) {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const datePart = `${yyyy}${mm}${dd}`;
  const safeCategoryId = (categoryId || "question").toLowerCase().replace(/[^a-z0-9-]/g, "-");

  const categories = await loadCategories();
  const category = categories.find((c) => c.id === categoryId);
  const existing = category ? await loadExistingQuestions(category) : [];
  const existingIds = new Set(existing.map((q) => q.id));

  let seq = 1;
  let candidate = `${safeCategoryId}-${datePart}-${String(seq).padStart(3, "0")}`;
  while (existingIds.has(candidate)) {
    seq += 1;
    candidate = `${safeCategoryId}-${datePart}-${String(seq).padStart(3, "0")}`;
  }
  return candidate;
}

/** 게임의 config.json (시작색 랜덤 범위 등) — 미리보기에서 "임의 시작색"을 게임과 같은 방식으로 만들 때 쓴다 */
export async function loadGameConfig({ force = false } = {}) {
  if (configCache && !force) return configCache;
  configCache = await fetchJson("/src/data/config.json");
  return configCache;
}

export function clearCaches() {
  categoriesCache = null;
  questionFileCache.clear();
  schemaCache = null;
}
