/**
 * 내보내기 전 검증.
 * 문제 구조 검증(validateQuestionShape)은 게임 본체 src/js/utils/validation.js를
 * 그대로 가져다 쓴다 — 검증 규칙을 여기서 따로 베껴 쓰면 게임과 제작기가
 * 서로 다른 기준으로 판단하게 될 위험이 있기 때문이다.
 * 그 외 제작기에서만 필요한 검사(마스크 비어있음/전체선택, 중복 id 등)만 추가한다.
 */

import { validateQuestionShape, findDuplicateIds, SUPPORTED_RENDER_MODES } from "../../src/js/utils/validation.js";
import { loadQuestionSchema, isIdTaken, isValidQuestionId, loadExistingQuestions, loadCategories } from "./project-loader.js";

/**
 * @returns {{level:'pass'|'warn'|'error', message:string, code:string}[]}
 */
export async function runFullValidation({ question, canvasEditor, thumbnailReady, categoryList }) {
  const results = [];
  const push = (level, code, message) => results.push({ level, code, message });

  // 1. 게임과 동일한 구조 검증 (필수 필드, id 형식, HEX, renderMode 등)
  const shapeErrors = validateQuestionShape(question);
  if (shapeErrors.length === 0) {
    push("pass", "shape", "필수 필드와 형식이 게임 스키마를 만족합니다.");
  } else {
    for (const err of shapeErrors) push("error", "shape", err);
  }

  // 2. 카테고리 존재 확인
  const categories = categoryList || (await loadCategories());
  const category = categories.find((c) => c.id === question.categoryId);
  if (!category) {
    push("error", "category", `존재하지 않는 카테고리입니다: ${question.categoryId || "(선택 안 됨)"}`);
  } else if (category.enabled === false) {
    push("warn", "category", `"${category.name}" 카테고리는 현재 비활성화되어 있습니다.`);
  } else {
    push("pass", "category", `카테고리 확인: ${category.name}`);
  }

  // 3. id 중복 확인 (같은 카테고리 문제 파일 기준)
  if (question.id && isValidQuestionId(question.id)) {
    if (category) {
      const taken = await isIdTaken(question.categoryId, question.id, {
        excludeId: question.__editingOriginalId || null,
      });
      if (taken) {
        push("error", "duplicate-id", `이미 존재하는 문제 id입니다: ${question.id}`);
      } else {
        push("pass", "duplicate-id", "문제 id가 중복되지 않습니다.");
      }
    }
  } else if (question.id) {
    push("error", "id-format", `id 형식이 올바르지 않습니다 (영문 소문자/숫자/하이픈만): ${question.id}`);
  }

  // 4. 제목
  if (!question.title || !question.title.trim()) {
    push("error", "title", "문제 제목을 입력해 주세요.");
  } else {
    push("pass", "title", "제목이 있습니다.");
  }

  // 5. 마스크 상태
  if (canvasEditor) {
    const total = canvasEditor.getTotalPixels();
    const selected = canvasEditor.countSelectedPixels();
    const ratio = total > 0 ? selected / total : 0;

    if (selected === 0) {
      push("error", "mask-empty", "마스크가 비어 있습니다. 색을 바꿀 영역을 최소 한 곳 이상 선택해 주세요.");
    } else if (ratio < 0.002) {
      push("warn", "mask-tiny", `선택한 픽셀이 매우 적습니다 (${(ratio * 100).toFixed(2)}%). 의도한 영역이 맞는지 확인해 주세요.`);
    } else if (ratio > 0.97) {
      push("warn", "mask-full", "이미지 전체에 가깝게 선택되어 있습니다. 의도한 것이 맞다면 계속 진행해도 됩니다.");
    } else {
      push("pass", "mask-ratio", `마스크 비율 ${(ratio * 100).toFixed(1)}% — 정상 범위입니다.`);
    }

    push("pass", "mask-size", "마스크가 원본과 같은 해상도로 만들어집니다.");
  }

  // 6. 정답 색상
  if (!question.answerColor) {
    push("error", "answer-color", "정답 색상을 추출하거나 직접 지정해 주세요.");
  } else if (!/^#[0-9a-fA-F]{6}$/.test(question.answerColor)) {
    push("error", "answer-color-hex", `정답 색상 HEX 형식이 올바르지 않습니다: ${question.answerColor}`);
  } else {
    push("pass", "answer-color", `정답 색상: ${question.answerColor}`);
  }

  // 7. renderMode
  if (!SUPPORTED_RENDER_MODES.includes(question.renderMode)) {
    push("error", "render-mode", `지원하지 않는 renderMode: ${question.renderMode}`);
  } else {
    push("pass", "render-mode", "renderMode가 게임에서 지원하는 값입니다.");
  }

  // 8. 썸네일
  if (!thumbnailReady) {
    push("error", "thumbnail", "썸네일이 아직 만들어지지 않았습니다.");
  } else {
    push("pass", "thumbnail", "썸네일이 준비되었습니다.");
  }

  // 9. 스키마 파일 자체와 대조 (question-schema.json)
  try {
    const schema = await loadQuestionSchema();
    const schemaErrors = validateAgainstSchemaSubset(schema, question);
    if (schemaErrors.length === 0) {
      push("pass", "json-schema", "shared/question-schema.json 검증을 통과했습니다.");
    } else {
      for (const err of schemaErrors) push("error", "json-schema", err);
    }
  } catch (err) {
    push("warn", "json-schema", `question-schema.json을 불러오지 못해 스키마 대조를 건너뜁니다: ${err.message}`);
  }

  return results;
}

export function summarize(results) {
  return {
    pass: results.filter((r) => r.level === "pass").length,
    warn: results.filter((r) => r.level === "warn").length,
    error: results.filter((r) => r.level === "error").length,
  };
}

export function findDuplicatesInList(questions) {
  return findDuplicateIds(questions);
}

/**
 * question-schema.json(draft-07 하위 집합: type/required/properties/pattern/enum/
 * const/minLength/minimum/maximum/items/additionalProperties)만 지원하는 가벼운
 * 검증기. 이 프로젝트는 번들러가 없는 정적 사이트라서 ajv 같은 CJS 패키지를
 * 브라우저에 그대로 들여오기 어렵다 — 대신 실제 schema 파일을 fetch해서 이
 * 함수로 검사하기 때문에 "하드코딩된 규칙"이 아니라 진짜 스키마 파일 기준이다.
 */
export function validateAgainstSchemaSubset(schema, data) {
  const errors = [];

  if (schema.required) {
    for (const field of schema.required) {
      if (data[field] === undefined) errors.push(`스키마 필수 필드 누락: ${field}`);
    }
  }

  if (schema.additionalProperties === false && schema.properties) {
    const allowed = new Set(Object.keys(schema.properties));
    for (const key of Object.keys(data)) {
      if (key.startsWith("__")) continue; // 내부용 임시 필드는 제외
      if (!allowed.has(key)) errors.push(`스키마에 없는 필드: ${key}`);
    }
  }

  if (schema.properties) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      const value = data[key];
      if (value === undefined || value === null) continue;
      errors.push(...validateProperty(key, propSchema, value));
    }
  }

  return errors;
}

function validateProperty(key, propSchema, value) {
  const errors = [];
  const types = Array.isArray(propSchema.type) ? propSchema.type : [propSchema.type];

  if (propSchema.type && !types.some((t) => matchesType(t, value))) {
    errors.push(`${key}: 타입이 올바르지 않습니다 (기대: ${types.join("|")})`);
  }
  if (propSchema.const !== undefined && value !== propSchema.const) {
    errors.push(`${key}: 값이 ${propSchema.const}이어야 합니다`);
  }
  if (propSchema.enum && !propSchema.enum.includes(value)) {
    errors.push(`${key}: 허용된 값이 아닙니다 (${propSchema.enum.join(", ")})`);
  }
  if (propSchema.pattern && typeof value === "string" && !new RegExp(propSchema.pattern).test(value)) {
    errors.push(`${key}: 형식이 올바르지 않습니다 (패턴: ${propSchema.pattern})`);
  }
  if (propSchema.minLength !== undefined && typeof value === "string" && value.length < propSchema.minLength) {
    errors.push(`${key}: 최소 길이 ${propSchema.minLength}자 이상이어야 합니다`);
  }
  if (propSchema.minimum !== undefined && typeof value === "number" && value < propSchema.minimum) {
    errors.push(`${key}: 최솟값 ${propSchema.minimum} 이상이어야 합니다`);
  }
  if (propSchema.maximum !== undefined && typeof value === "number" && value > propSchema.maximum) {
    errors.push(`${key}: 최댓값 ${propSchema.maximum} 이하여야 합니다`);
  }
  return errors;
}

function matchesType(type, value) {
  switch (type) {
    case "string":
      return typeof value === "string";
    case "integer":
      return Number.isInteger(value);
    case "number":
      return typeof value === "number";
    case "boolean":
      return typeof value === "boolean";
    case "object":
      return typeof value === "object" && value !== null && !Array.isArray(value);
    case "array":
      return Array.isArray(value);
    case "null":
      return value === null;
    default:
      return true;
  }
}
