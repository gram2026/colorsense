/**
 * 데이터 검증 규칙 (게임 본체와 scripts/validate-data.js가 함께 사용하는 순수 함수 모음)
 * DOM이나 파일시스템에 의존하지 않아서 브라우저/Node 양쪽에서 그대로 쓸 수 있다.
 */

export const SUPPORTED_RENDER_MODES = ["preserve-lightness"];

export function isValidHexColor(value) {
  return typeof value === "string" && /^#([0-9a-fA-F]{6})$/.test(value.trim());
}

const REQUIRED_QUESTION_FIELDS = [
  "id",
  "title",
  "originalImage",
  "maskImage",
  "thumbnail",
  "answerColor",
  "renderMode",
  "enabled",
];

/**
 * 문제 객체 하나의 구조적 유효성을 검사한다 (파일 존재 여부는 검사하지 않음).
 * @returns {string[]} 오류 메시지 목록 (비어있으면 유효)
 */
export function validateQuestionShape(question) {
  const errors = [];
  if (!question || typeof question !== "object") {
    return ["문제 데이터가 객체가 아닙니다."];
  }

  for (const field of REQUIRED_QUESTION_FIELDS) {
    if (question[field] === undefined || question[field] === null) {
      if (field === "enabled" && question[field] === false) continue;
      errors.push(`필수 필드 누락: ${field}`);
    }
  }

  if (question.id && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(question.id)) {
    errors.push(`id 형식이 올바르지 않습니다: ${question.id}`);
  }

  if (question.answerColor && !isValidHexColor(question.answerColor)) {
    errors.push(`answerColor가 올바른 HEX가 아닙니다: ${question.answerColor}`);
  }

  if (
    question.startColor !== null &&
    question.startColor !== undefined &&
    !isValidHexColor(question.startColor)
  ) {
    errors.push(`startColor가 올바른 HEX가 아닙니다: ${question.startColor}`);
  }

  if (question.renderMode && !SUPPORTED_RENDER_MODES.includes(question.renderMode)) {
    errors.push(`지원하지 않는 renderMode: ${question.renderMode}`);
  }

  return errors;
}

/**
 * 문제 목록 전체에서 중복 id를 찾는다.
 * @returns {Map<string, number>} id별 등장 횟수 (2 이상이면 중복)
 */
export function findDuplicateIds(questions) {
  const counts = new Map();
  for (const q of questions) {
    if (!q?.id) continue;
    counts.set(q.id, (counts.get(q.id) || 0) + 1);
  }
  const duplicates = new Map();
  for (const [id, count] of counts) {
    if (count > 1) duplicates.set(id, count);
  }
  return duplicates;
}

export function validateCategoryShape(category) {
  const errors = [];
  if (!category.id) errors.push("카테고리 id 누락");
  if (!category.name) errors.push("카테고리 name 누락");
  if (category.enabled === undefined) errors.push("카테고리 enabled 누락");
  if (!category.isRandomMix && !category.questionFile) {
    errors.push("questionFile 누락 (isRandomMix 카테고리가 아닌 경우 필수)");
  }
  return errors;
}
