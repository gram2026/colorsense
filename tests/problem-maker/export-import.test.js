/**
 * ZIP 내보내기 구조 + 실제 scripts/import-question.js 연동 테스트.
 * jszip으로 문제 제작기가 만드는 것과 같은 구조의 ZIP을 메모리에서 만든 뒤,
 * 실제 import-question.js를 자식 프로세스로 실행해서 게임에 정상적으로 반영되는지,
 * 중복 id/파일 누락은 제대로 거부되는지 확인한다.
 * 테스트가 끝나면 건드린 파일을 전부 원래 상태로 되돌린다.
 *
 * 실행: node tests/problem-maker/export-import.test.js
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "../../node_modules/jszip/dist/jszip.js";

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

const TEST_ID = "brand-logo-test-export-import-999";
const TEST_CATEGORY = "brand-logo";
const questionFilePath = join(ROOT, "src/data/questions/brand-logo.json");
const originalQuestionFileText = readFileSync(questionFilePath, "utf-8");
const destAssetDir = join(ROOT, "assets/questions", TEST_CATEGORY, TEST_ID);

function buildQuestionJson(overrides = {}) {
  return {
    schemaVersion: 1,
    id: TEST_ID,
    categoryId: TEST_CATEGORY,
    title: "내보내기 테스트",
    originalImage: "original.webp",
    maskImage: "mask.png",
    thumbnail: "thumbnail.webp",
    answerColor: "#4488CC",
    startColor: null,
    renderMode: "preserve-lightness",
    enabled: true,
    difficulty: 1,
    tags: ["test"],
    metadata: { createdAt: "2026-07-31", makerVersion: "1.0.0" },
    ...overrides,
  };
}

async function buildZipFolder(tmpDir, { includeMask = true, question = buildQuestionJson() } = {}) {
  const zip = new JSZip();
  const folder = zip.folder(question.id);
  folder.file("question.json", JSON.stringify(question, null, 2));
  folder.file("original.webp", Buffer.from([1, 2, 3, 4])); // 내용은 중요하지 않음 (import 스크립트는 복사만 함)
  if (includeMask) folder.file("mask.png", Buffer.from([5, 6, 7, 8]));
  folder.file("thumbnail.webp", Buffer.from([9, 10, 11, 12]));

  const buf = await zip.generateAsync({ type: "nodebuffer" });
  const zipPath = join(tmpDir, `${question.id}.zip`);
  writeFileSync(zipPath, buf);

  // import-question.js는 "폴더"를 인자로 받으므로 실제로 압축을 풀어 폴더로 만든다.
  const extracted = await zip.loadAsync(buf);
  const extractDir = join(tmpDir, "extracted");
  for (const [name, entry] of Object.entries(extracted.files)) {
    if (entry.dir) continue;
    const content = await entry.async("nodebuffer");
    const outPath = join(extractDir, name);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, content);
  }
  return join(extractDir, question.id);
}

function runImport(folderPath) {
  try {
    const output = execFileSync("node", ["scripts/import-question.js", folderPath], {
      cwd: ROOT,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, output };
  } catch (err) {
    return { ok: false, output: (err.stdout || "") + (err.stderr || ""), code: err.status };
  }
}

function cleanup() {
  rmSync(destAssetDir, { recursive: true, force: true });
  writeFileSync(questionFilePath, originalQuestionFileText, "utf-8");
}

let tmpDir;
try {
  tmpDir = mkdtempSync(join(tmpdir(), "cg-maker-test-"));

  console.log("1) 정상적인 export 폴더는 import-question.js가 그대로 받아들여야 함");
  {
    const folder = await buildZipFolder(tmpDir, { question: buildQuestionJson() });
    const result = runImport(folder);
    assert(result.ok, `가져오기 성공해야 함 (출력: ${result.output.slice(0, 300)})`);
    assert(existsSync(join(destAssetDir, "original.webp")), "original.webp가 assets 폴더에 복사되어야 함");
    assert(existsSync(join(destAssetDir, "mask.png")), "mask.png가 assets 폴더에 복사되어야 함");
    assert(existsSync(join(destAssetDir, "thumbnail.webp")), "thumbnail.webp가 assets 폴더에 복사되어야 함");

    const updatedDoc = JSON.parse(readFileSync(questionFilePath, "utf-8"));
    const added = updatedDoc.questions.find((q) => q.id === TEST_ID);
    assert(!!added, "카테고리 문제 JSON에 새 문제가 추가되어야 함");
    assert(
      added.originalImage === `assets/questions/${TEST_CATEGORY}/${TEST_ID}/original.webp`,
      `이미지 경로가 게임 규격대로 다시 씌어져야 함 (실제: ${added.originalImage})`
    );
  }

  console.log("\n2) 같은 id를 다시 가져오려 하면 거부되어야 함 (중복 방지)");
  {
    const folder = await buildZipFolder(tmpDir, { question: buildQuestionJson() });
    const result = runImport(folder);
    assert(!result.ok, "이미 존재하는 id는 실패해야 함");
    assert(result.output.includes("이미 존재하는"), "중복 id 관련 오류 메시지가 있어야 함");
  }

  cleanup(); // 다음 케이스를 위해 원상복구

  console.log("\n3) 필수 파일(mask.png)이 없으면 거부되어야 함 (게임 파일은 바뀌지 않아야 함)");
  {
    // 이전 케이스와 같은 id의 추출 폴더를 재사용하면 이전에 썼던 mask.png가 남아있을 수 있으니
    // (extractDir가 id별 경로라 파일이 개별 삭제되지 않음) 이 케이스만 별도 id를 쓴다.
    const noMaskId = `${TEST_ID}-nomask`;
    const noMaskAssetDir = join(ROOT, "assets/questions", TEST_CATEGORY, noMaskId);
    const beforeText = readFileSync(questionFilePath, "utf-8");
    const folder = await buildZipFolder(tmpDir, { includeMask: false, question: buildQuestionJson({ id: noMaskId }) });
    const result = runImport(folder);
    assert(!result.ok, "mask.png가 없으면 실패해야 함");
    assert(!existsSync(noMaskAssetDir), "실패 시 assets 폴더가 만들어지면 안 됨");
    assert(readFileSync(questionFilePath, "utf-8") === beforeText, "실패 시 카테고리 JSON은 전혀 바뀌지 않아야 함");
    rmSync(noMaskAssetDir, { recursive: true, force: true });
  }

  console.log("\n4) 잘못된 카테고리는 거부되어야 함");
  {
    const folder = await buildZipFolder(tmpDir, { question: buildQuestionJson({ categoryId: "no-such-category" }) });
    const result = runImport(folder);
    assert(!result.ok, "존재하지 않는 카테고리는 실패해야 함");
  }

  console.log("\n5) 잘못된 answerColor(HEX 아님)는 거부되어야 함");
  {
    const folder = await buildZipFolder(tmpDir, { question: buildQuestionJson({ answerColor: "notahex" }) });
    const result = runImport(folder);
    assert(!result.ok, "잘못된 HEX는 실패해야 함");
  }
} finally {
  cleanup();
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
}

console.log("\n----------------------------------------");
console.log(`테스트 완료: 통과 ${pass}개, 실패 ${fail}개`);
process.exit(fail > 0 ? 1 : 0);
