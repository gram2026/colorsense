/**
 * 문제 결과 화면의 점수 공개 연출:
 * 대포가 병아리를 쏘고, 병아리가 포물선을 그리며 무지개 점수 바의 점수 위치에 착지한다.
 */

import { formatScore } from "./dom.js";
import { burstConfetti, TIER_COLORS } from "./effects.js";

const FLIGHT_MS = 1150;
const FIRE_DELAY_MS = 260;

export function scoreLaunchMarkup() {
  return `
    <div class="score-launch" data-role="launch" aria-hidden="true">
      <svg class="score-launch__trail" data-role="trail"><path d="" /></svg>
      <svg class="score-launch__cannon" data-role="cannon" viewBox="0 0 100 100">
        <g class="score-launch__barrel">
          <g transform="rotate(-40 40 62)">
            <rect x="16" y="48" width="70" height="28" rx="7" />
            <rect x="82" y="43" width="11" height="38" rx="3" />
            <path d="M28 56 q10 -3 20 0" class="score-launch__sketch" />
          </g>
        </g>
        <circle cx="40" cy="75" r="16" />
        <ellipse cx="41" cy="75" rx="6" ry="4.5" class="score-launch__hub" />
        <g class="score-launch__smoke" data-role="smoke">
          <circle cx="80" cy="27" r="7" />
          <circle cx="90" cy="20" r="5" />
          <circle cx="74" cy="17" r="5" />
        </g>
      </svg>
      <div class="score-launch__bar">
        <span class="score-launch__tick score-launch__tick--start">0</span>
        <span class="score-launch__tick score-launch__tick--end">100</span>
      </div>
      <div class="score-launch__chick" data-role="chick">
        <svg viewBox="0 0 44 40">
          <path d="M31 19 L43 22 L31 26 Z" class="score-launch__beak" />
          <circle cx="21" cy="22" r="15" class="score-launch__body" />
          <path d="M9 23 q6 8 13 2" class="score-launch__wing" />
          <circle cx="26" cy="17" r="2.2" class="score-launch__eye" />
          <path d="M17 8 q2 -6 5 -1" class="score-launch__tuft" />
        </svg>
      </div>
      <div class="score-launch__tag" data-role="tag"></div>
    </div>
  `;
}

/**
 * @param {HTMLElement} root  scoreLaunchMarkup()이 들어있는 요소
 * @param {{ score: number, tier: string, onProgress?: (value:number)=>void, onLand?: ()=>void }} opts
 */
export function playScoreLaunch(root, { score, tier, onProgress, onLand }) {
  const stage = root.querySelector('[data-role="launch"]');
  if (!stage) return;
  const cannon = stage.querySelector('[data-role="cannon"]');
  const chick = stage.querySelector('[data-role="chick"]');
  const tag = stage.querySelector('[data-role="tag"]');
  const trailPath = stage.querySelector('[data-role="trail"] path');
  const bar = stage.querySelector(".score-launch__bar");

  const ratio = Math.max(0, Math.min(1, score / 100));
  const land = () => {
    const stageRect = stage.getBoundingClientRect();
    const barRect = bar.getBoundingClientRect();
    return {
      x: barRect.left - stageRect.left + barRect.width * ratio,
      y: barRect.top - stageRect.top,
    };
  };

  const placeAt = (el, x, y, stageRect) => {
    el.style.left = `${(x / stageRect.width) * 100}%`;
    el.style.top = `${(y / stageRect.height) * 100}%`;
  };

  const finish = () => {
    const stageRect = stage.getBoundingClientRect();
    const end = land();
    placeAt(chick, end.x, end.y, stageRect);
    chick.style.transform = "";
    chick.classList.add("is-flying", "is-landed");
    tag.textContent = formatScore(score);
    const halfTag = tag.offsetWidth / 2;
    const tagX = Math.min(Math.max(end.x, halfTag), stageRect.width - halfTag);
    placeAt(tag, tagX, end.y, stageRect);
    tag.classList.add("is-visible");
    onProgress?.(score);

    if (tier === "perfect" || tier === "great") {
      burstConfetti(tag, { colors: TIER_COLORS[tier], count: tier === "perfect" ? 44 : 28, spread: 150 });
    }
    onLand?.();
  };

  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    finish();
    return;
  }

  setTimeout(() => {
    if (!stage.isConnected) return;
    const stageRect = stage.getBoundingClientRect();
    const cannonRect = cannon.getBoundingClientRect();
    const start = {
      x: cannonRect.left - stageRect.left + cannonRect.width * 0.8,
      y: cannonRect.top - stageRect.top + cannonRect.height * 0.28,
    };
    const end = land();
    const apexY = 14;
    const control = {
      x: (start.x + end.x) / 2,
      y: 2 * apexY - (start.y + end.y) / 2,
    };

    const pointAt = (t) => {
      const mt = 1 - t;
      return {
        x: mt * mt * start.x + 2 * mt * t * control.x + t * t * end.x,
        y: mt * mt * start.y + 2 * mt * t * control.y + t * t * end.y,
      };
    };
    const trailUpTo = (t) => {
      const steps = Math.max(2, Math.ceil(t * 40));
      let d = "";
      for (let i = 0; i <= steps; i++) {
        const p = pointAt((t * i) / steps);
        d += `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
      }
      return d;
    };
    stage.querySelector('[data-role="trail"]').setAttribute("viewBox", `0 0 ${stageRect.width} ${stageRect.height}`);

    cannon.classList.add("is-firing");
    chick.classList.add("is-flying");

    let startedAt = null;
    function frame(now) {
      if (!stage.isConnected) return;
      startedAt ??= now;
      const t = Math.min(1, (now - startedAt) / FLIGHT_MS);
      const { x, y } = pointAt(t);

      placeAt(chick, x, y, stageRect);
      chick.style.transform = `translate(-50%, -100%) rotate(${Math.round(t * 540)}deg)`;
      trailPath.setAttribute("d", trailUpTo(t));
      onProgress?.(score * t);

      if (t < 1) requestAnimationFrame(frame);
      else finish();
    }
    requestAnimationFrame(frame);
  }, FIRE_DELAY_MS);
}
