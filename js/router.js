/* ============================================================
   router.js — 簡單 hash-based 路由
   路由表由 app.js 註冊；每條路由對應一個 render(params) 函式。
   ============================================================ */

const Router = (() => {
  const routes = []; // { pattern: RegExp, keys: [string], handler: fn }

  function compile(pattern) {
    // pattern e.g. "/unit/:unitId/challenge/question/:qid"
    const keys = [];
    const regexStr = pattern
      .split("/")
      .map((seg) => {
        if (seg.startsWith(":")) {
          keys.push(seg.slice(1));
          return "([^/]+)";
        }
        return seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      })
      .join("/");
    return { regex: new RegExp("^" + regexStr + "$"), keys };
  }

  function register(pattern, handler) {
    const { regex, keys } = compile(pattern);
    routes.push({ regex, keys, handler });
  }

  function currentPath() {
    const hash = window.location.hash || "#/";
    return hash.slice(1).split("?")[0] || "/";
  }

  function currentQuery() {
    const hash = window.location.hash || "#/";
    const qIndex = hash.indexOf("?");
    const params = {};
    if (qIndex >= 0) {
      new URLSearchParams(hash.slice(qIndex + 1)).forEach((v, k) => (params[k] = v));
    }
    return params;
  }

  function navigate(path) {
    if (window.location.hash.slice(1) === path) {
      // 相同路徑，手動觸發一次
      resolve();
    } else {
      window.location.hash = path;
    }
  }

  function resolve() {
    const path = currentPath();
    for (const route of routes) {
      const match = path.match(route.regex);
      if (match) {
        const params = {};
        route.keys.forEach((key, i) => (params[key] = decodeURIComponent(match[i + 1])));
        params.__query = currentQuery();
        try {
          route.handler(params);
        } catch (err) {
          console.error("Router: 頁面渲染錯誤", err);
          App.renderFatalError("頁面渲染時發生錯誤：" + err.message);
        }
        window.scrollTo(0, 0);
        return;
      }
    }
    App.renderNotFound(path);
  }

  function start() {
    window.addEventListener("hashchange", resolve);
    if (!window.location.hash) window.location.hash = "#/";
    resolve();
  }

  return { register, navigate, start, currentPath, currentQuery };
})();
