/**
 * question-validator.js의 스키마 대조 로직 + 게임 본체 validation.js 재사용 여부를 검증한다.
 * shared/question-schema.json을 실제 파일에서 읽어와 검사하므로, 스키마 파일이 바뀌면
 * 이 테스트도 그 변경을 그대로 반영해서 검사한다 (하드코딩된 사본이 아님).
 * 실행: node tests/problem-maker/question-validator.test.js
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateAgainstSchemaSubset } from "../../problem-maker/js/question-validator.js";
import { validateQuestionShape, findDuplicateIds } from "../../src/js/utils/validation.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");

let pass = 0;
let fail = 0;
function assert(condition, message) {
  if (condition) {
    pass += 1;
    console.log("  ✓", message);
  } else {
    fail += 1;
    console.error("  ✗", message);
  }
}

const schema = JSON.parse(readFileSync(join(ROOT, "problem-maker/shared/question-schema.json"), "utf-8"));

const validQuestion = {
  schemaVersion: 1,
  id: "objects-20260731-001",
  categoryId: "objects",
  title: "테스트",
  originalImage: "original.webp",
  maskImage: "mask.png",
  thumbnail: "thumbnail.webp",
  answerColor: "#AABBCC",
  startColor: null,
  renderMode: "preserve-lightness",
  enabled: true,
  difficulty: 1,
  tags: ["a", "b"],
  metadata: { createdAt: "2026-07-31", makerVersion: "1.0.0" },
};

console.log("1) 정상적인 문제는 실제 question-schema.json을 통과해야 함");
{
  const errors = validateAgainstSchemaSubset(schema, validQuestion);
  assert(errors.length === 0, `오류 없음 (실제: ${JSON.stringify(errors)})`);
}

console.log("2) 정상적인 문제는 게임 본체 validateQuestionShape도 통과해야 함");
{
  const errors = validateQuestionShape(validQuestion);
  assert(errors.length === 0, `게임 검증도 오류 없음 (실제: ${JSON.stringify(errors)})`);
}

console.log("\n3) 필수 필드 누락은 거부되어야 함");
{
  const { title, ...missingTitle } = validQuestion;
  const schemaErrors = validateAgainstSchemaSubset(schema, missingTitle);
  const gameErrors = validateQuestionShape(missingTitle);
  assert(schemaErrors.length > 0, "제목이 없으면 스키마 검증 오류가 있어야 함");
  assert(gameErrors.length > 0, "제목이 없으면 게임 검증도 오류가 있어야 함");
}

console.log("\n4) 잘못된 HEX는 거부되어야 함");
{
  const bad = { ...validQuestion, answerColor: "red" };
  const schemaErrors = validateAgainstSchemaSubset(schema, bad);
  const gameErrors = validateQuestionShape(bad);
  assert(schemaErrors.some((e) => e.includes("answerColor")), "answerColor 패턴 위반이 스키마 오류에 잡혀야 함");
  assert(gameErrors.some((e) => e.includes("answerColor") || e.includes("HEX")), "게임 검증에서도 HEX 오류로 잡혀야 함");
}

console.log("\n5) 잘못된 id 형식은 거부되어야 함");
{
  for (const badId of ["Objects_001", "objects 001", "../etc", "OBJECTS-001", ""]) {
    const bad = { ...validQuestion, id: badId };
    const schemaErrors = validateAgainstSchemaSubset(schema, bad);
    const gameErrors = validateQuestionShape(bad);
    assert(schemaErrors.length > 0 || gameErrors.length > 0, `잘못된 id "${badId}"는 거부되어야 함`);
  }
}

console.log("\n6) 지원하지 않는 renderMode는 거부되어야 함");
{
  const bad = { ...validQuestion, renderMode: "some-fancy-mode" };
  const schemaErrors = validateAgainstSchemaSubset(schema, bad);
  const gameErrors = validateQuestionShape(bad);
  assert(schemaErrors.some((e) => e.includes("renderMode")), "스키마가 renderMode enum 위반을 잡아야 함");
  assert(gameErrors.some((e) => e.includes("renderMode")), "게임 검증도 renderMode를 거부해야 함");
}

console.log("\n7) 중복 id 발견");
{
  const list = [validQuestion, { ...validQuestion, id: validQuestion.id }, { ...validQuestion, id: "other-id" }];
  const dup = findDuplicateIds(list);
  assert(dup.get(validQuestion.id) === 2, "같은 id가 2번 등장하면 중복으로 잡혀야 함");
  assert(!dup.has("other-id"), "고유한 id는 중복 목록에 없어야 함");
}

console.log("\n8) additionalProperties:false — 스키마에 없는 필드는 거부");
{
  const withExtra = { ...validQuestion, someRandomField: 123 };
  const schemaErrors = validateAgainstSchemaSubset(schema, withExtra);
  assert(schemaErrors.some((e) => e.includes("someRandomField")), "스키마에 없는 필드는 오류로 잡혀야 함");
}

console.log("\n----------------------------------------");
console.log(`테스트 완료: 통과 ${pass}개, 실패 ${fail}개`);
process.exit(fail > 0 ? 1 : 0);
