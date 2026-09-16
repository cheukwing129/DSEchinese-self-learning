(() => {
  const storageKey = "ccsl_progress_v1";
  const dayMs = 24 * 60 * 60 * 1000;
  const staleAfterDays = 3;

  function loadProgress() {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || "{}");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  function escapeHTML(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    }[char]));
  }

  function safePath(unitId, path, fallback) {
    if (typeof path !== "string") return fallback;
    const clean = path.startsWith("#") ? path.slice(1) : path;
    return clean.startsWith(`/unit/${unitId}/`) ? clean : fallback;
  }

  function activityAt(unit) {
    if (!unit || typeof unit !== "object") return 0;
    let latest = Math.max(Number(unit.lastActivityAt) || 0, Number(unit.navigation?.lastAt) || 0);
    Object.values(unit.answers || {}).forEach((record) => {
      latest = Math.max(
        latest,
        Number(record?.timestamp) || 0,
        Number(record?.lastWrongAt) || 0,
        Number(record?.lastCorrectAt) || 0
      );
    });
    Object.values(unit.openQuestionReviews || {}).forEach((review) => {
      latest = Math.max(latest, Number(review?.updatedAt) || 0);
    });
    const memo = unit.memorisation || {};
    latest = Math.max(latest, Number(memo.charsViewedAt) || 0);
    Object.values(memo.groups || {}).forEach((group) => {
      latest = Math.max(
        latest,
        Number(group?.cloze?.lastAt) || 0,
        Number(group?.reorder?.lastAt) || 0
      );
    });
    return latest;
  }

  function daysSince(timestamp, now) {
    if (!timestamp) return null;
    return Math.max(0, Math.floor((now - timestamp) / dayMs));
  }

  function memorisationWeakness(unit) {
    let count = 0;
    let latestAt = 0;
    Object.values(unit?.memorisation?.groups || {}).forEach((group) => {
      const cloze = group?.cloze;
      const reorder = group?.reorder;
      const clozeWeak = Number(cloze?.attempts) > 0 && Number.isFinite(Number(cloze?.lastRate)) && Number(cloze.lastRate) < 80;
      const reorderWeak = Number(reorder?.attempts) > 0 && reorder?.lastCorrect === false;
      if (clozeWeak || reorderWeak) {
        count += 1;
        latestAt = Math.max(latestAt, Number(cloze?.lastAt) || 0, Number(reorder?.lastAt) || 0);
      }
    });
    return { count, latestAt };
  }

  function candidateFor(card, progress, now) {
    const href = card.getAttribute("href") || "";
    const match = href.match(/^#\/unit\/([^/?]+)/);
    if (!match) return null;
    let unitId = match[1];
    try { unitId = decodeURIComponent(unitId); } catch { /* keep route id */ }

    const unit = progress[unitId];
    if (!unit || typeof unit !== "object") return null;
    const title = card.querySelector(".map-title")?.textContent?.trim() || unitId;
    const unresolvedWrong = Object.values(unit.answers || {})
      .filter((record) => record?.answered && record.isCorrect === false);
    const openRetry = Object.values(unit.openQuestionReviews || {})
      .filter((review) => review?.decision === "retry");
    const memoWeak = memorisationWeakness(unit);
    const lastAt = activityAt(unit);
    const ageDays = daysSince(lastAt, now);

    if (unresolvedWrong.length) {
      const latestWrongAt = unresolvedWrong.reduce((latest, record) => Math.max(latest, Number(record?.lastWrongAt) || Number(record?.timestamp) || 0), 0);
      return {
        unitId,
        title,
        kind: "wrong",
        priority: 0,
        weight: unresolvedWrong.length,
        at: latestWrongAt || lastAt,
        badge: "錯題未修正",
        label: `重練 ${unresolvedWrong.length} 題待修正錯題`,
        reason: `《${title}》有 ${unresolvedWrong.length} 題客觀題最後一次仍答錯；先把已知錯誤修正。`,
        path: `/unit/${unitId}/progress/retry-wrong`
      };
    }

    if (openRetry.length) {
      const latestRetryAt = openRetry.reduce((latest, review) => Math.max(latest, Number(review?.updatedAt) || 0), 0);
      return {
        unitId,
        title,
        kind: "open-retry",
        priority: 1,
        weight: openRetry.length,
        at: latestRetryAt || lastAt,
        badge: "開放題待重做",
        label: openRetry.length === 1 ? "重做標記的開放題" : `重做 ${openRetry.length} 題開放題`,
        reason: `你在《${title}》把 ${openRetry.length} 題開放題標記為「稍後重做」；現在可再作答一次。`,
        path: safePath(unitId, unit.navigation?.lastPath, `/unit/${unitId}/progress`)
      };
    }

    if (memoWeak.count) {
      return {
        unitId,
        title,
        kind: "memorisation",
        priority: 2,
        weight: memoWeak.count,
        at: memoWeak.latestAt || lastAt,
        badge: "背誦待鞏固",
        label: memoWeak.count === 1 ? "再練 1 組背誦" : `再練 ${memoWeak.count} 組背誦`,
        reason: `《${title}》有 ${memoWeak.count} 組最近的遮字正確率低於 80%，或句子重組最後一次未完成正確。`,
        path: `/unit/${unitId}/memorisation`
      };
    }

    if (lastAt && ageDays != null && ageDays >= staleAfterDays) {
      return {
        unitId,
        title,
        kind: "stale",
        priority: 3,
        weight: ageDays,
        at: lastAt,
        badge: "較久未回顧",
        label: "回顧最近學過的內容",
        reason: `《${title}》上一次留下學習紀錄是 ${ageDays} 天前；沒有未修正錯題時，可用它作一次短回顧。`,
        path: safePath(unitId, unit.navigation?.lastPath, `/unit/${unitId}/progress`)
      };
    }

    return null;
  }

  function todayReviewPlan(cards, progress, now = Date.now()) {
    return cards
      .map((card) => candidateFor(card, progress, now))
      .filter(Boolean)
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        if (a.weight !== b.weight) return b.weight - a.weight;
        if (a.priority === 3) return a.at - b.at;
        return b.at - a.at;
      })
      .slice(0, 3);
  }

  function renderTodayReview(panel, items) {
    const signature = items.map((item) => `${item.unitId}:${item.kind}:${item.weight}:${item.at}`).join("|");
    if (panel.dataset.todayReviewSignature === signature) return;
    panel.dataset.todayReviewSignature = signature;
    panel.dataset.todayReviewPanel = "true";
    panel.dataset.quickStudyMode = "today-review";
    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:18px;flex-wrap:wrap;margin-bottom:15px;">
        <div style="min-width:0;flex:1 1 420px;">
          <p class="section-kicker" style="margin:0 0 5px;">今日待溫習</p>
          <h2 style="margin:0;font-family:var(--font-display);font-size:25px;font-weight:650;line-height:1.25;">先處理這 ${items.length} 項</h2>
          <p style="margin:8px 0 0;color:var(--color-ink-soft);font-size:13px;line-height:1.75;">按這部裝置留下的錯題、開放題自評、背誦結果與最近學習時間排序；不是系統估算的掌握率。</p>
        </div>
        <span style="flex:none;padding:6px 10px;border-radius:999px;background:var(--color-accent-soft);color:var(--color-accent);font-size:11px;font-weight:800;">最多 3 項</span>
      </div>
      <div data-today-review-items style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;">
        ${items.map((item, index) => `
          <a data-today-review-item="${index + 1}" data-review-kind="${escapeHTML(item.kind)}" href="#${escapeHTML(item.path)}" style="display:block;min-width:0;padding:15px;border:1px solid rgba(23,73,64,.10);border-radius:14px;background:rgba(255,255,255,.76);">
            <span style="display:inline-block;margin-bottom:8px;padding:4px 7px;border-radius:999px;background:var(--color-accent-soft);color:var(--color-accent);font-size:9px;font-weight:850;letter-spacing:.04em;">${escapeHTML(item.badge)}</span>
            <strong style="display:block;color:var(--color-ink);font-size:14px;line-height:1.4;">${escapeHTML(item.label)}</strong>
            <span style="display:block;margin-top:3px;color:var(--color-ink);font-size:12px;font-weight:700;">《${escapeHTML(item.title)}》</span>
            <small style="display:block;margin-top:6px;color:var(--color-ink-soft);font-size:11px;line-height:1.6;">${escapeHTML(item.reason)}</small>
            <span style="display:block;margin-top:10px;color:var(--color-accent);font-size:11px;font-weight:800;">開始溫習 →</span>
          </a>`).join("")}
      </div>
      <p style="margin:12px 0 0;color:var(--color-ink-faint);font-size:10px;line-height:1.6;">完成後返回首頁，文脈會按最新紀錄重新排序；沒有待修正弱點時，才會以較久未回顧的篇章補位。</p>`;
  }

  function enhanceTodayReview() {
    if (window.location.hash && window.location.hash !== "#/" && window.location.hash !== "#") return;
    const cards = [...document.querySelectorAll('a.map-card[href^="#/unit/"]')];
    const panel = document.querySelector("[data-quick-study-panel]");
    if (!cards.length || !panel) return;
    const items = todayReviewPlan(cards, loadProgress());
    if (!items.length) {
      panel.removeAttribute("data-today-review-panel");
      panel.removeAttribute("data-today-review-signature");
      return;
    }
    renderTodayReview(panel, items);
  }

  const main = document.getElementById("app-main");
  if (!main) return;

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      enhanceTodayReview();
    });
  };

  new MutationObserver(schedule).observe(main, { childList: true, subtree: true });
  window.addEventListener("hashchange", schedule);
  window.addEventListener("storage", (event) => {
    if (event.key === storageKey) schedule();
  });
  schedule();
})();
