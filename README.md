# Color Guesser

사진 속 색이 지워진(엉뚱한 색으로 바뀐) 영역을 직접 색을 조절해서 정답 색에 최대한
가깝게 맞히는 캐주얼 웹 게임입니다. 빌드 과정이 없는 정적 웹사이트라서
`index.html`과 로컬 서버만 있으면 바로 실행할 수 있고, Cloudflare Pages 같은 곳에
그대로 배포할 수 있습니다.

## 목차

1. [프로젝트 구조](#프로젝트-구조)
2. [필요한 프로그램](#필요한-프로그램)
3. [설치 방법](#설치-방법)
4. [VS Code에서 열기](#vs-code에서-열기)
5. [로컬 서버 실행 / 종료](#로컬-서버-실행--종료)
6. [새 문제 추가하기](#새-문제-추가하기)
7. [새 카테고리 추가하기](#새-카테고리-추가하기)
8. [이미지·마스크 규격](#이미지마스크-규격)
9. [JSON 필드 설명](#json-필드-설명)
10. [문제 가져오기 명령](#문제-가져오기-명령)
11. [배포 방법](#배포-방법-cloudflare-pages)
12. [자주 생기는 오류](#자주-생기는-오류)
13. [문제 제작기 연결 예정 사항](#문제-제작기-연결-예정-사항)

---

## 프로젝트 구조

```text
C:\colorguesser
├─ index.html                  화면 컨테이너 6개 + app.js 로드
├─ package.json                 npm 스크립트 (dev/validate-data/import-question/test)
├─ src/
│  ├─ css/                      variables → reset → layout → components → screens → responsive
│  ├─ js/
│  │  ├─ app.js                 진입점 (화면 등록 + 라우터 시작)
│  │  ├─ router.js               해시 기반 화면 전환
│  │  ├─ state.js                 전역 상태 + 세션 복구
│  │  ├─ data-loader.js           categories.json / questions/*.json 로드 + 검증
│  │  ├─ storage.js               localStorage/sessionStorage 래퍼
│  │  ├─ share.js                 결과 공유 (Web Share API / 클립보드)
│  │  ├─ toast.js                 짧은 알림
│  │  ├─ screens/                 화면별 로직 (home, categories, category-detail, game, round-result, final-result)
│  │  ├─ color/                   color-convert, delta-e, scoring, mask-renderer, color-picker
│  │  └─ utils/                   dom, image-loader, validation
│  └─ data/
│     ├─ config.json              점수 곡선 / 시작색 랜덤 범위 설정
│     ├─ categories.json           카테고리 목록 (여기 추가하면 자동으로 화면에 나타남)
│     └─ questions/*.json          카테고리별 문제 목록
├─ assets/
│  ├─ categories/<id>/cover.png   카테고리 대표 이미지
│  └─ questions/<categoryId>/<questionId>/original.png, mask.png, thumbnail.png
├─ problem-maker/                 (미래에 만들 문제 제작기와 공유할 스키마/규격만 존재)
└─ scripts/
   ├─ start-local.js               의존성 없는 정적 서버
   ├─ validate-data.js              데이터 검증
   ├─ import-question.js            문제 제작기 출력물 가져오기
   ├─ test-color.js                 색상/점수 계산 고정 입력값 테스트
   └─ generate-sample-assets.js     샘플 이미지 생성 스크립트 (참고용, 실제 사진으로 교체 가능)
```

## 필요한 프로그램

- [Node.js](https://nodejs.org) 18 이상 (로컬 서버와 스크립트 실행용, 무거운 프레임워크는 사용하지 않습니다)
- [Visual Studio Code](https://code.visualstudio.com) (권장)
- 최신 브라우저 (Chrome, Edge 등)

## 설치 방법

```bash
cd /d C:\colorguesser
npm install
```

> 이 프로젝트는 외부 npm 패키지를 하나도 쓰지 않습니다. `npm install`은 사실상
> 아무것도 설치하지 않지만, 습관대로 실행해도 안전합니다.

## VS Code에서 열기

1. VS Code 실행
2. `파일 → 폴더 열기` → `C:\colorguesser` 선택
3. 상단 메뉴 `터미널 → 새 터미널`에서 아래 [로컬 서버 실행](#로컬-서버-실행--종료) 명령을 입력

## 로컬 서버 실행 / 종료

**절대 `index.html`을 더블클릭해서 `file://`로 열지 마세요.** 문제 데이터를 `fetch`로
불러오기 때문에 반드시 로컬 서버로 실행해야 합니다.

```bash
cd /d C:\colorguesser
npm run dev
```

터미널에 아래처럼 나오면 성공입니다.

```text
Color Guesser 로컬 서버 실행 중: http://localhost:5173
종료하려면 Ctrl + C 를 누르세요.
```

브라우저에서 `http://localhost:5173` 접속 → 종료할 때는 터미널에서 `Ctrl + C`.

포트를 바꾸고 싶다면:

```bash
set PORT=8080 && npm run dev
```

## 새 문제 추가하기

가장 쉬운 방법 (수동):

1. `assets/questions/<카테고리ID>/<문제ID>/` 폴더를 만들고 `original.png`(또는 webp),
   `mask.png`, `thumbnail.png`을 넣습니다.
2. `src/data/questions/<카테고리>.json`의 `questions` 배열에 항목을 하나 추가합니다
   ([JSON 필드 설명](#json-필드-설명) 참고).
3. 검증 스크립트를 실행합니다.

   ```bash
   npm run validate-data
   ```

4. 브라우저를 새로고침합니다.

문제 제작기(추후 별도 앱)를 쓴다면 [문제 가져오기 명령](#문제-가져오기-명령)을 그대로
쓰면 됩니다. **HTML/JS 코드는 전혀 수정할 필요가 없습니다.**

## 새 카테고리 추가하기

`src/data/categories.json`의 `categories` 배열에 항목을 추가하고,
`assets/categories/<id>/cover.png`와 `src/data/questions/<id>.json`(빈
`questions: []`로 시작해도 됨)을 만들면 끝입니다. 코드 수정이 필요 없습니다.

```json
{
  "id": "sports",
  "name": "스포츠",
  "thumbnail": "assets/categories/sports/cover.png",
  "questionFile": "src/data/questions/sports.json",
  "enabled": true,
  "order": 7
}
```

## 이미지·마스크 규격

| 항목 | 규격 |
|---|---|
| 원본 이미지 | PNG 또는 WebP, 정사각형에 가까운 비율 권장 |
| 마스크 이미지 | PNG (알파 채널 필수), **원본과 가로세로 해상도가 정확히 같아야 함** |
| 마스크 색 변경 영역 | 흰색(또는 밝은 회색) + 불투명(alpha 255) |
| 마스크 비변경 영역 | 검정 + 완전 투명(alpha 0) |
| 마스크 가장자리 | 안티앨리어싱된 반투명 픽셀 허용 (자연스러운 경계를 위해 권장) |

게임은 마스크의 **`(밝기채널/255) × (알파/255)`** 를 색상 변경 강도로 사용합니다.
즉 흰색이면서 불투명한 픽셀만 100% 강도로 바뀌고, 검은색이거나 투명한 픽셀은
전혀 바뀌지 않습니다. 그 사이 값은 자연스럽게 섞입니다.

색상 합성은 원본의 **명도(L)는 그대로 두고 Hue/Saturation만 사용자가 고른 색으로
교체**하는 방식(`preserve-lightness`)이라서, 하이라이트/그림자/질감이 그대로
유지됩니다.

> `scripts/generate-sample-assets.js`가 만든 샘플 이미지는 실제 사진이 아니라
> 빛/그림자가 있는 간단한 구 형태를 코드로 그린 것입니다. 실제 사진을 준비하면
> 같은 경로/같은 파일명으로 덮어쓰면 됩니다.

## JSON 필드 설명

`src/data/questions/<category>.json`의 `questions[]` 항목:

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | string | 카테고리 내에서 고유. 소문자/숫자/하이픈만 |
| `title` | string | 짧은 문제 제목 |
| `originalImage` / `maskImage` / `thumbnail` | string | 프로젝트 루트 기준 상대 경로 |
| `answerColor` | `#RRGGBB` | 정답 색 |
| `startColor` | `#RRGGBB` 또는 `null` | 고정 시작색. `null`이면 매 판 랜덤 생성 |
| `renderMode` | string | 현재 `"preserve-lightness"`만 지원 |
| `enabled` | boolean | `false`면 게임에서 제외 (콘솔에만 표시) |
| `difficulty` | 1~5 | 난이도 (현재는 표시용) |
| `tags` | string[] | 태그 |
| `metadata.createdAt` / `metadata.makerVersion` | string | 제작 정보 |

`src/data/config.json`의 `scoring`:

| 필드 | 설명 |
|---|---|
| `maxScore` | 문제당 만점 (기본 1000) |
| `method` | `"ciede2000"` 또는 `"deltaE76"` |
| `perfectThreshold` | 이 Delta E 이하면 만점 |
| `zeroScoreThreshold` | 이 Delta E 이상이면 0점 |
| `curveExponent` | 클수록 중간 점수가 더 박해짐 ((1-t)^curveExponent) |

`config.json`의 `startColor`는 문제 시작 시 랜덤 시작색을 만들 때 정답 색 기준
Hue/명도를 얼마나 어긋나게 할지의 범위입니다.

## 문제 가져오기 명령

문제 제작기(추후 개발 예정)가 아래 형식으로 폴더를 내보내면:

```text
export/
├─ question.json
├─ original.webp
├─ mask.png
└─ thumbnail.webp
```

다음 명령 한 줄로 게임에 등록할 수 있습니다.

```bash
npm run import-question -- "C:\경로\export"
```

이 명령은 `question.json`을 검증하고, 카테고리 존재 여부와 id 중복을 확인한 뒤,
이미지를 `assets/questions/<categoryId>/<id>/`로 복사하고, 해당 카테고리의
JSON 파일에 문제를 자동으로 추가합니다. 중간에 실패하면 복사한 파일까지
되돌리고 아무 것도 바꾸지 않습니다.

## 배포 방법 (Cloudflare Pages)

이 프로젝트는 빌드 과정이 없으므로 배포 설정이 매우 단순합니다.

1. Cloudflare Pages에서 새 프로젝트 생성 → 이 저장소(또는 폴더) 연결
2. **Build command**: 비워둠 (없음)
3. **Build output directory**: `/` (프로젝트 루트)
4. 배포 완료 후 발급되는 주소로 접속하면 바로 동작합니다.

다른 정적 호스팅(Netlify, GitHub Pages 등)도 동일하게 "빌드 없음, 루트 폴더
그대로 배포"로 설정하면 됩니다.

## 자주 생기는 오류

| 증상 | 원인 | 해결 |
|---|---|---|
| 화면이 하얗고 콘솔에 CORS/fetch 오류 | `index.html`을 더블클릭해서 `file://`로 열었음 | `npm run dev`로 실행한 로컬 서버 주소로 접속 |
| 카테고리 카드에 "준비 중"만 보임 | 해당 카테고리의 questions.json이 비어있음 | `src/data/questions/<id>.json`에 문제 추가 |
| 이미지가 깨져 보임 | 경로 오타 또는 파일 누락 | `npm run validate-data` 실행해서 정확한 위치 확인 |
| 새 문제가 안 보임 | JSON 문법 오류 또는 `enabled:false` | 콘솔 로그 확인 + `npm run validate-data` |
| 마스크를 적용해도 사진이 안 바뀜 | 마스크 파일이 없거나 로드 실패 | 콘솔 로그 확인, 마스크 경로/해상도 확인 |
| 공유 버튼을 눌러도 반응 없음 | Web Share API 미지원 브라우저 + 클립보드 권한 없음 | 화면의 토스트 메시지 확인 (수동 복사 안내로 대체됨) |

## 문제 제작기 연결 예정 사항

`problem-maker/README.md`와 `problem-maker/shared/question-schema.json`에
자세히 정리되어 있습니다. 핵심만 요약하면:

- 문제 제작기는 `question.json` + `original.*` + `mask.png` + `thumbnail.*` 형식의
  `export/` 폴더만 만들면 됩니다.
- 필드 이름/타입은 `problem-maker/shared/question-schema.json` 기준으로 절대
  바꾸지 않아야 합니다.
- 가져오기는 `npm run import-question -- "경로"` 한 줄이면 끝입니다.
