/**
 * tests/problem-maker/ 아래의 모든 *.test.js를 순서대로 실행하고 결과를 모아 보여준다.
 * 실행: npm run test:problem-maker
 */
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const TEST_DIR = join(ROOT, "tests/problem-maker");

const files = readdirSync(TEST_DIR)
  .filter((f) => f.endsWith(".test.js"))
  .sort();

let failedFiles = 0;

for (const file of files) {
  console.log(`\n========== ${file} ==========`);
  try {
    const output = execFileSync("node", [join(TEST_DIR, file)], { cwd: ROOT, encoding: "utf-8" });
    process.stdout.write(output);
  } catch (err) {
    failedFiles += 1;
    process.stdout.write(err.stdout || "");
    process.stderr.write(err.stderr || "");
    console.error(`\n"${file}" 실패 (종료 코드 ${err.status})`);
  }
}

console.log("\n==================================================");
console.log(
  failedFiles === 0
    ? `모든 문제 제작기 테스트 파일 통과 (${files.length}개 파일)`
    : `${failedFiles}/${files.length}개 파일에서 실패한 테스트가 있습니다.`
);
process.exit(failedFiles > 0 ? 1 : 0);
