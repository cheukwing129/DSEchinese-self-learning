/* 「選擇中文」外部練習入口。
 * 「文脈」首頁是由 SPA 動態生成，因此入口卡在首頁渲染後才插入。
 * 不修改原有課程資料、答題機制或學習紀錄。 */
(() => {
  "use strict";

  const destination = "https://everydaychinese.pages.dev/";
  const main = document.getElementById("app-main");
  if (!main) return;

  function enhanceHome() {
    const route = window.location.hash;
    if (route && route !== "#/" && route !== "#") return;

    const grid = main.querySelector(".home-action-grid");
    if (!grid || grid.querySelector("[data-choice-chinese-entry]")) return;

    const link = document.createElement("a");
    link.className = "home-action-card home-choice-chinese-card";
    link.dataset.choiceChineseEntry = "true";
    link.href = destination;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", "前往選擇中文：16 篇文言選擇題無限練習（在新分頁開啟）");
    link.innerHTML = `
      <span class="home-choice-chinese-symbol" aria-hidden="true">
        <svg viewBox="0 0 72 72" focusable="false">
          <rect x="3" y="3" width="66" height="66" rx="19" fill="#137563"/>
          <circle cx="23" cy="21" r="5.5" fill="none" stroke="#f6fffa" stroke-width="3"/>
          <path d="M36 21H52" stroke="#f6fffa" stroke-width="4" stroke-linecap="round"/>
          <circle cx="23" cy="37" r="8" fill="#ffcf78"/>
          <path d="m19 37 4 4 6-8" fill="none" stroke="#136552" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M38 37H52" stroke="#ffcf78" stroke-width="4" stroke-linecap="round"/>
          <circle cx="23" cy="53" r="5.5" fill="none" stroke="#f6fffa" stroke-width="3"/>
          <path d="M36 53H52" stroke="#f6fffa" stroke-width="4" stroke-linecap="round"/>
        </svg>
      </span>
      <span class="home-choice-chinese-copy">
        <span class="home-choice-chinese-kicker">延伸練習 · 獨立學習網站</span>
        <strong class="home-choice-chinese-title">選擇中文</strong>
        <span class="home-choice-chinese-desc">16 篇指定文言，隨時選篇練習；即時解析、錯題重溫，按自己的節奏一直練下去。</span>
      </span>
      <span class="home-choice-chinese-action" aria-hidden="true">前往練習 <span>↗</span></span>
    `;

    // 保持原有快速溫習／今日待溫習卡的邏輯不變。
    const quickPanel = grid.querySelector("[data-quick-study-panel]");
    if (quickPanel) grid.insertBefore(link, quickPanel);
    else grid.appendChild(link);
  }

  let pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    window.requestAnimationFrame(() => {
      pending = false;
      enhanceHome();
    });
  }

  new MutationObserver(schedule).observe(main, {childList: true, subtree: true});
  window.addEventListener("hashchange", schedule);
  schedule();
})();
