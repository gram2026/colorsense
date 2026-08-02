/**
 * 앱 진입점
 * 화면 모듈을 라우터에 등록하고, 세션 복구를 시도한 뒤 라우터를 시작한다.
 */

import { initRouter, registerScreen } from "./router.js";
import { tryRestoreSession } from "./state.js";

import * as home from "./screens/home.js";
import * as categories from "./screens/categories.js";
import * as categoryDetail from "./screens/category-detail.js";
import * as game from "./screens/game.js";
import * as roundResult from "./screens/round-result.js";
import * as finalResult from "./screens/final-result.js";

// 콘솔에는 자세한 원인을 남기되, 화면 전체가 멈추지 않게 한다.
window.addEventListener("error", (e) => {
  console.error("[app] 처리되지 않은 오류:", e.error || e.message);
});
window.addEventListener("unhandledrejection", (e) => {
  console.error("[app] 처리되지 않은 Promise 거부:", e.reason);
});

registerScreen("home", home);
registerScreen("categories", categories);
registerScreen("category-detail", categoryDetail);
registerScreen("game", game);
registerScreen("round-result", roundResult);
registerScreen("final-result", finalResult);

tryRestoreSession();
initRouter();
