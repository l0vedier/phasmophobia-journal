// Headless UI test for the journal app. Requires Microsoft Edge; no npm packages.
// Usage: node tools/test_ui.mjs
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9333;
const PROFILE = "C:\\Users\\Lenovo\\AppData\\Local\\Temp\\edge-journal-test";
// noflip: 布局测试跳过翻页快照，避免克隆出来的 .ghost / .ev 干扰全局选择器。
const URL = "file:///E:/Claude%20code/phasmophobia-journal/app/index.html?noflip=1";

let failures = 0;
function check(name, ok, extra = "") {
  if (ok) {
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.log(`  FAIL  ${name}${extra ? "  -> " + extra : ""}`);
  }
}
function near(a, b, tol) { return Math.abs(a - b) <= tol; }
function sameSet(a, b) {
  if (a.length !== b.length) return false;
  const s = new Set(b);
  return a.every(x => s.has(x));
}

rmSync(PROFILE, { recursive: true, force: true });
const edge = spawn(EDGE, [
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--no-default-browser-check",
  "--allow-file-access-from-files",
  "--force-device-scale-factor=1",
  "--window-size=1120,895",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE}`,
  URL,
], { stdio: "ignore" });

let ws;
let nextId = 1;
const pending = new Map();

async function connect() {
  let target = null;
  for (let i = 0; i < 80; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      target = list.find(t => t.type === "page" && t.url.includes("index.html"));
      if (target) break;
    } catch {}
    await sleep(150);
  }
  if (!target) throw new Error("Edge debug target not found");
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener("open", res, { once: true });
    ws.addEventListener("error", rej, { once: true });
  });
  ws.addEventListener("message", ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) rej(new Error(JSON.stringify(msg.error)));
      else res(msg.result);
    }
  });
}

function send(method, params = {}) {
  const id = nextId++;
  return new Promise((res, rej) => {
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const r = await send("Runtime.evaluate", {
    expression: `(async () => { ${expression} })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  }
  return r.result.value;
}

async function setSize(width, height) {
  await send("Emulation.setDeviceMetricsOverride", {
    width, height, deviceScaleFactor: 1, mobile: false,
  });
  await evaluate(`await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); return true;`);
  await sleep(420);
}

async function clickEv(key) {
  await evaluate(`document.querySelector('.ev[data-key="${key}"]').click(); return true;`);
  await sleep(500);
}
async function clickGhost(name) {
  await evaluate(`document.querySelector('.ghost[data-name="${name}"]').click(); return true;`);
  await sleep(620);
}
async function hoverGhost(name) {
  await evaluate(`
    const el = document.querySelector('.ghost[data-name="${name}"]');
    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    return true;
  `);
  await sleep(280);
}
async function unhoverGhost(name) {
  await evaluate(`
    const el = document.querySelector('.ghost[data-name="${name}"]');
    el.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.querySelector('.book') }));
    return true;
  `);
  await sleep(280);
}
async function clickReset() {
  await evaluate(`document.getElementById('resetBtn').click(); return true;`);
  await sleep(620);
}
async function rightClickGhost(name) {
  await evaluate(`
    const el = document.querySelector('.ghost[data-name="${name}"]');
    el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }));
    return true;
  `);
  await sleep(360);
}
async function clickDetailBack() {
  await evaluate(`document.getElementById('detailBack').click(); return true;`);
  await sleep(420);
}

const layoutExpr = `
  const q = s => document.querySelector(s);
  const r = el => { const b = el.getBoundingClientRect(); return {x:b.x,y:b.y,w:b.width,h:b.height,b:b.bottom,rt:b.right}; };
  const book = r(q('.book'));
  const lp = r(q('.page-left')), rp = r(q('.page-right'));
  const items = [...document.querySelectorAll('.ev')];
  const lastItem = r(items[items.length-1]);
  const footEl = q('.page-foot');
  const foot = r(footEl);
  const hintEl = q('.hint');
  const grid = q('.ghost-grid');
  const gridRect = r(grid);
  const cellW = gridRect.w / 3;
  const ghosts = [...document.querySelectorAll('.ghost')];
  const maxGhostW = Math.max(...ghosts.map(g => r(g).w));
  const ghostCenterX = ghosts.map(g => {
    const b = g.getBoundingClientRect();
    return +(b.x + b.width / 2).toFixed(2);
  });
  const reset = r(q('.reset-btn'));
  const style = getComputedStyle(grid);
  const dragEl = q('.book-drag');
  const drag = dragEl ? r(dragEl) : null;
  const chromeEl = q('.chrome');
  const chrome = chromeEl ? r(chromeEl) : null;
  const firstEv = items.length ? r(items[0]) : null;
  return {
    vw: innerWidth, vh: innerHeight,
    book,
    leftPage: lp, rightPage: rp,
    lastItem, foot,
    footLine: { w: footEl.clientWidth, sw: footEl.scrollWidth },
    hint: {w: hintEl.clientWidth, sw: hintEl.scrollWidth, fs: getComputedStyle(hintEl).fontSize},
    grid: gridRect, cellW, maxGhostW, ghostCenterX,
    rows: style.gridTemplateRows.split(' ').length,
    cols: style.gridTemplateColumns.split(' ').length,
    reset,
    evCount: items.length,
    ghostCount: ghosts.length,
    font: getComputedStyle(q('.ev-name')).fontFamily,
    fontOk: document.fonts.check('20px LongCang'),
    bookAspect: book.w / book.h,
    drag,
    firstEv,
    chrome,
    dragHasClass: !!dragEl && dragEl.classList.contains('pywebview-drag-region'),
    dragCursor: dragEl ? getComputedStyle(dragEl).cursor : null,
    chromeButtons: [...document.querySelectorAll('.chrome button')].map(b => b.id),
    closeBtn: r(document.getElementById('btnClose')),
    hasPin: !!document.getElementById('btnPin'),
    bgHtml: getComputedStyle(document.documentElement).backgroundColor,
    bgBody: getComputedStyle(document.body).backgroundColor,
    coverBg: getComputedStyle(q('.book')).backgroundImage,
    coverRadius: parseFloat(getComputedStyle(q('.book')).borderTopLeftRadius),
    surface: r(q('.page-surface')),
    surfaceTop: parseFloat(getComputedStyle(q('.page-surface')).top),
    // 纸面落影用 box-shadow：filter: drop-shadow 会把整页合并成一层，悬停时整页重绘
    surfaceShadow: getComputedStyle(q('.page-surface')).boxShadow,
    blockBg: getComputedStyle(q('.page-block-frame')).backgroundColor,
  };
`;

const stateExpr = `
  const evs = [...document.querySelectorAll('.ev')];
  const ghosts = [...document.querySelectorAll('.ghost')];
  const layer = document.getElementById('circleLayer');
  const main = layer.querySelector('.ink-main');
  const selectedEl = document.querySelector('.ghost.selected');
  const names = cls => ghosts.filter(g => g.classList.contains(cls)).map(g => g.dataset.name);
  const evKeys = cls => evs.filter(e => e.classList.contains(cls)).map(e => e.dataset.key);
  const transformX = (el, pseudo) => {
    const tr = getComputedStyle(el, pseudo || null).transform;
    const m = tr.match(/matrix\\(([^,]+),/);
    return m ? parseFloat(m[1]) : 1;
  };
  const lineX = name => {
    const el = document.querySelector('.ghost[data-name="' + name + '"]');
    return el ? transformX(el, '::after') : null;
  };
  const evLineX = key => {
    const el = document.querySelector('.ev[data-key="' + key + '"] .ev-name');
    return el ? transformX(el, '::after') : null;
  };
  const tickOpacity = key => {
    const el = document.querySelector('.ev[data-key="' + key + '"] .tick');
    return el ? parseFloat(getComputedStyle(el).opacity) : null;
  };
  const evLineGeom = key => {
    const row = document.querySelector('.ev[data-key="' + key + '"]');
    const el = row && row.querySelector('.ev-name');
    const box = row && row.querySelector('.box');
    if (!el || !box) return null;
    const nb = el.getBoundingClientRect();
    const bb = box.getBoundingClientRect();
    const cs = getComputedStyle(el, '::after');
    return {
      lineLeft: nb.left + parseFloat(cs.left),
      lineTop: nb.top + parseFloat(cs.top),
      lineH: parseFloat(cs.height),
      boxLeft: bb.left,
      boxTop: bb.top,
      boxBottom: bb.bottom,
      transition: cs.transitionDuration,
    };
  };
  const tickTransition = key => {
    const el = document.querySelector('.ev[data-key="' + key + '"] .tick');
    return el ? getComputedStyle(el).transitionDuration : null;
  };
  const tickStrokes = (() => {
    const el = document.querySelector('.ev[data-key="EMF5"] .tick');
    if (!el) return false;
    const b = getComputedStyle(el, '::before');
    const a = getComputedStyle(el, '::after');
    return b.content !== 'none' && a.content !== 'none' &&
      parseFloat(b.height) >= 1.5 && parseFloat(a.height) >= 1.5 &&
      b.backgroundImage === 'none' && a.backgroundImage === 'none';
  })();
  const ghostLineTransition = name => {
    const el = document.querySelector('.ghost[data-name="' + name + '"]');
    return el ? getComputedStyle(el, '::after').transitionDuration : null;
  };
  let circle = null;
  if (main && selectedEl) {
    const pb = main.getBoundingClientRect();
    const nb = selectedEl.getBoundingClientRect();
    circle = {
      path: {x: pb.x, y: pb.y, w: pb.width, h: pb.height},
      name: {x: nb.x, y: nb.y, w: nb.width, h: nb.height},
    };
  }
  return {
    checked: evKeys('checked'),
    crossedEv: evKeys('crossed'),
    dim: evKeys('dim'),
    selected: names('selected'),
    faded: names('faded'),
    crossedGhosts: names('crossed'),
    pathCount: layer.querySelectorAll('path').length,
    ready: layer.classList.contains('ready'),
    layerFaded: layer.classList.contains('faded'),
    layerOpacity: parseFloat(getComputedStyle(layer).opacity),
    circle,
    evLineEMF5: evLineX('EMF5'),
    evLineGeomEMF5: evLineGeom('EMF5'),
    ghostLine女妖: lineX('女妖'),
    ghostLine魂魄: lineX('魂魄'),
    tickEMF5: tickOpacity('EMF5'),
    tickTransition: tickTransition('EMF5'),
    tickStrokes,
    ghostLineTransition: ghostLineTransition('女妖'),
    circleDash: main ? main.style.strokeDasharray : null,
    circlePathTransition: main ? main.style.transition : null,
    ghostOpacity魂魄: selectedEl && selectedEl.dataset.name === '魂魄'
      ? parseFloat(getComputedStyle(selectedEl).opacity)
      : parseFloat(getComputedStyle(document.querySelector('.ghost[data-name="魂魄"]')).opacity),
    ghostOpacity女妖: parseFloat(getComputedStyle(document.querySelector('.ghost[data-name="女妖"]')).opacity),
  };
`;

const surrounds = c => !!c &&
  c.path.x <= c.name.x + 2 &&
  c.path.y <= c.name.y + 2 &&
  c.path.x + c.path.w >= c.name.x + c.name.w - 2 &&
  c.path.y + c.path.h >= c.name.y + c.name.h - 2;

// 鬼名保持三列居中：每列 10 个名字中心点一致，且中列中心就是网格中心。
const ghostsCentered = L =>
  [0, 10, 20].every(i => L.ghostCenterX.slice(i, i + 10).every(x => near(x, L.ghostCenterX[i], 1.5))) &&
  near(L.ghostCenterX[10], L.grid.x + L.grid.w / 2, 2);

try {
  await connect();
  await send("Runtime.enable");

  // wait for app init + font + initial 魂魄 circle
  for (let i = 0; i < 100; i++) {
    const s = await evaluate(`
      return {
        ghosts: document.querySelectorAll('.ghost').length,
        ready: document.getElementById('circleLayer').classList.contains('ready'),
        paths: document.querySelectorAll('#circleLayer path').length
      };
    `);
    if (s.ghosts === 30 && s.ready && s.paths === 1) break;
    await sleep(100);
  }

  console.log("\n[1] 1120x895 layout");
  await setSize(1120, 895);
  let L = await evaluate(layoutExpr);
  check("7 evidence rows", L.evCount === 7, String(L.evCount));
  check("30 ghost names", L.ghostCount === 30, String(L.ghostCount));
  check("grid is 3 columns x 10 rows", L.cols === 3 && L.rows === 10, `${L.cols}x${L.rows}`);
  check("LongCang font loaded", L.fontOk && L.font.includes("LongCang"), L.font);
  check("book aspect ratio", near(L.bookAspect, 895 / 715, 0.02), String(L.bookAspect));
  check("book fits viewport", L.book.y >= 0 && L.book.b <= L.vh + 1 && L.book.x >= 0 && L.book.rt <= L.vw + 1,
    JSON.stringify(L.book));
  check("evidence list fits left page", L.lastItem.b <= L.leftPage.b + 1, `${L.lastItem.b} vs ${L.leftPage.b}`);
  check("footer below evidence", L.foot.y >= L.lastItem.b - 1, `${L.foot.y} vs ${L.lastItem.b}`);
  check("footer on one line", L.footLine.sw <= L.footLine.w + 1, `${L.footLine.sw}/${L.footLine.w}`);
  check("right hint on one line", L.hint.sw <= L.hint.w + 1, `${L.hint.sw}/${L.hint.w}`);
  check("ghost names fit cells", L.maxGhostW < L.cellW - 2, `${L.maxGhostW}/${L.cellW}`);
  check("ghost names stay centered in their columns", ghostsCentered(L),
    `${[...new Set(L.ghostCenterX)]}`);
  check("reset button inside page", L.reset.b <= L.rightPage.b + 1, `${L.reset.b} vs ${L.rightPage.b}`);
  const zoomButtons = await evaluate(`return {
    in: !!document.getElementById('btnZoomIn'),
    out: !!document.getElementById('btnZoomOut')
  };`);
  check("no resize buttons", !zoomButtons.in && !zoomButtons.out, JSON.stringify(zoomButtons));

  check("window background is transparent",
    L.bgHtml === "rgba(0, 0, 0, 0)" && L.bgBody === "rgba(0, 0, 0, 0)",
    `${L.bgHtml} / ${L.bgBody}`);
  check("book has a rounded leather cover",
    String(L.coverBg).includes("leather.png") && L.coverRadius > 0,
    `${String(L.coverBg).slice(0, 70)} / ${L.coverRadius}`);
  check("page surface is inset with a lip shadow",
    L.surfaceTop > 5 && L.surfaceShadow !== "none",
    `${L.surfaceTop} / ${L.surfaceShadow}`);
  check("page block thickness is visible",
    L.blockBg !== "rgba(0, 0, 0, 0)", L.blockBg);

  check("book top is a drag region", L.dragHasClass, String(L.dragHasClass));
  check("drag region stays above the first evidence row",
    !!L.drag && !!L.firstEv && L.drag.b <= L.firstEv.y + 1,
    L.drag && L.firstEv ? `${L.drag.b} vs ${L.firstEv.y}` : "missing");
  check("drag region covers 10-18% of the book height",
    !!L.drag && L.drag.h / L.book.h >= 0.10 && L.drag.h / L.book.h <= 0.18,
    L.drag ? (L.drag.h / L.book.h).toFixed(3) : "missing");
  check("drag region stops before the window buttons",
    !!L.drag && !!L.chrome && L.drag.rt <= L.chrome.x + 1,
    L.drag && L.chrome ? `${L.drag.rt} vs ${L.chrome.x}` : "missing");
  check("drag cursor is grab", L.dragCursor === "grab", String(L.dragCursor));

  check("only the close button remains",
    sameSet(L.chromeButtons, ["btnClose"]) && !L.hasPin,
    JSON.stringify(L.chromeButtons) + " pin=" + L.hasPin);
  check("close button is 35x35",
    Math.round(L.closeBtn.w) === 35 && Math.round(L.closeBtn.h) === 35,
    `${L.closeBtn.w}x${L.closeBtn.h}`);
  check("close button sits inside the inner page's top-right",
    !!L.surface &&
    L.closeBtn.x >= L.surface.x && L.closeBtn.y >= L.surface.y &&
    L.closeBtn.rt <= L.surface.rt && L.closeBtn.b <= L.surface.b &&
    L.closeBtn.x > L.book.x + L.book.w * 0.75 &&
    L.closeBtn.y < L.book.y + L.book.h * 0.15,
    JSON.stringify({ close: L.closeBtn, surface: L.surface }));

  console.log(`  info  book ${L.book.w.toFixed(1)}x${L.book.h.toFixed(1)}, foot ${L.footLine.sw}/${L.footLine.w}, cell ${L.cellW.toFixed(1)}`);

  console.log("\n[2] initial state");
  let S = await evaluate(stateExpr);
  check("all evidence normal", S.checked.length === 0 && S.crossedEv.length === 0, JSON.stringify(S));
  check("魂魄 circled by default", sameSet(S.selected, ["魂魄"]), JSON.stringify(S.selected));
  check("no ghost faded", S.faded.length === 0, JSON.stringify(S.faded));
  check("no ghost crossed", S.crossedGhosts.length === 0, JSON.stringify(S.crossedGhosts));
  check("circle is one clean ink path", S.pathCount === 1, String(S.pathCount));
  check("circle layer visible", S.ready && near(S.layerOpacity, 1, 0.03), `${S.ready}/${S.layerOpacity}`);
  check("circle surrounds 魂魄", surrounds(S.circle), JSON.stringify(S.circle));

  console.log("\n[3] evidence cycle: checked -> crossed -> normal");
  await clickEv("EMF5");
  S = await evaluate(stateExpr);
  check("EMF5 checked", sameSet(S.checked, ["EMF5"]), JSON.stringify(S.checked));
  check("× visible in the square", S.tickEMF5 > 0.8, String(S.tickEMF5));
  check("× is two hand-drawn strokes", S.tickStrokes, String(S.tickStrokes));
  check("× has no animation", S.tickTransition === "0s", String(S.tickTransition));
  check("17 ghosts faded (lack EMF5)", S.faded.length === 17, String(S.faded.length));
  check("女妖 faded", S.faded.includes("女妖"), JSON.stringify(S.faded));
  check("魂魄 not faded (has EMF5)", !S.faded.includes("魂魄"), JSON.stringify(S.faded));
  check("circle still on 魂魄", sameSet(S.selected, ["魂魄"]) && S.pathCount === 1, JSON.stringify(S.selected));
  check("circle not faded", !S.layerFaded && near(S.layerOpacity, 1, 0.03), `${S.layerFaded}/${S.layerOpacity}`);

  await clickEv("EMF5");
  S = await evaluate(stateExpr);
  check("EMF5 crossed out", sameSet(S.crossedEv, ["EMF5"]) && S.checked.length === 0,
    JSON.stringify({ checked: S.checked, crossed: S.crossedEv }));
  check("× hidden when crossed", S.tickEMF5 < 0.05, String(S.tickEMF5));
  check("evidence strike line visible", S.evLineEMF5 > 0.95, String(S.evLineEMF5));
  check("strike line reaches the checkbox", S.evLineGeomEMF5 &&
    near(S.evLineGeomEMF5.lineLeft, S.evLineGeomEMF5.boxLeft, 2.5) &&
    S.evLineGeomEMF5.lineTop >= S.evLineGeomEMF5.boxTop - 1 &&
    S.evLineGeomEMF5.lineTop <= S.evLineGeomEMF5.boxBottom,
    JSON.stringify(S.evLineGeomEMF5));
  check("strike line is thicker", S.evLineGeomEMF5 && S.evLineGeomEMF5.lineH >= 2.1,
    String(S.evLineGeomEMF5 && S.evLineGeomEMF5.lineH));
  check("evidence strike line has no animation", S.evLineGeomEMF5 && S.evLineGeomEMF5.transition === "0s",
    String(S.evLineGeomEMF5 && S.evLineGeomEMF5.transition));
  check("crossed EMF5 fades the 13 ghosts that have it", S.faded.length === 13, String(S.faded.length));
  check("女妖 unfaded (lacks EMF5)", !S.faded.includes("女妖"), JSON.stringify(S.faded));
  check("魂魄 faded (has EMF5)", S.faded.includes("魂魄"), JSON.stringify(S.faded));
  check("circle fades with crossed-evidence filtering", S.layerFaded && near(S.layerOpacity, 0.18, 0.02),
    `${S.layerFaded}/${S.layerOpacity}`);

  await clickEv("EMF5");
  S = await evaluate(stateExpr);
  check("EMF5 back to normal", S.checked.length === 0 && S.crossedEv.length === 0, JSON.stringify(S));
  check("normal EMF5 unfades all", S.faded.length === 0, JSON.stringify(S.faded));
  check("evidence strike line hidden", S.evLineEMF5 < 0.05, String(S.evLineEMF5));

  console.log("\n[3b] checked + crossed together");
  await clickEv("UV");   // checked: must have UV
  await clickEv("EMF5"); // checked
  await clickEv("EMF5"); // crossed: must not have EMF5
  S = await evaluate(stateExpr);
  check("checked UV + crossed EMF5 keeps 女妖 (UV, no EMF5)", !S.faded.includes("女妖"), JSON.stringify(S.faded));
  check("checked UV + crossed EMF5 fades 魂魄 (no UV, EMF5)", S.faded.includes("魂魄"), JSON.stringify(S.faded));
  check("checked UV + crossed EMF5 fades 加鲁 (has both)", S.faded.includes("加鲁"), JSON.stringify(S.faded));
  check("both mark states coexist", sameSet(S.checked, ["UV"]) && sameSet(S.crossedEv, ["EMF5"]),
    JSON.stringify({ checked: S.checked, crossed: S.crossedEv }));
  await clickReset();

  console.log("\n[4] ghost cycle: circle -> cross -> cancel, only one circle");
  await clickGhost("女妖");
  S = await evaluate(stateExpr);
  check("女妖 circled", sameSet(S.selected, ["女妖"]), JSON.stringify(S.selected));
  check("魂魄 no longer circled", !S.selected.includes("魂魄"), JSON.stringify(S.selected));
  check("circle surrounds 女妖", S.pathCount === 1 && surrounds(S.circle), JSON.stringify(S.circle));
  check("circle appears without draw animation", S.circleDash === "" && S.circlePathTransition === "",
    JSON.stringify({ dash: S.circleDash, transition: S.circlePathTransition }));

  await clickGhost("女妖");
  S = await evaluate(stateExpr);
  check("女妖 crossed, circle gone", S.selected.length === 0 && sameSet(S.crossedGhosts, ["女妖"]),
    JSON.stringify({ selected: S.selected, crossed: S.crossedGhosts }));
  check("circle cleared", S.pathCount === 0 && !S.ready && near(S.layerOpacity, 0, 0.03),
    `${S.pathCount}/${S.ready}/${S.layerOpacity}`);
  check("ghost strike line visible", S.ghostLine女妖 > 0.95, String(S.ghostLine女妖));
  check("ghost strike line has no animation", S.ghostLineTransition === "0s", String(S.ghostLineTransition));

  await clickGhost("女妖");
  S = await evaluate(stateExpr);
  check("女妖 back to normal", S.crossedGhosts.length === 0 && S.selected.length === 0, JSON.stringify(S));
  check("ghost strike line hidden", S.ghostLine女妖 < 0.05, String(S.ghostLine女妖));

  await clickGhost("女妖");
  await clickGhost("魂魄");
  S = await evaluate(stateExpr);
  check("clicking another ghost moves the single circle", sameSet(S.selected, ["魂魄"]) &&
    !S.selected.includes("女妖") && S.pathCount === 1, JSON.stringify(S.selected));
  check("circle surrounds 魂魄 again", surrounds(S.circle), JSON.stringify(S.circle));

  await clickGhost("女妖");
  await clickGhost("女妖"); // cross 女妖
  await clickGhost("魂魄"); // select 魂魄
  S = await evaluate(stateExpr);
  check("crossed 女妖 stays crossed while 魂魄 circled",
    sameSet(S.crossedGhosts, ["女妖"]) && sameSet(S.selected, ["魂魄"]),
    JSON.stringify({ selected: S.selected, crossed: S.crossedGhosts }));
  await clickGhost("女妖"); // uncross, selection unchanged
  S = await evaluate(stateExpr);
  check("cancelling a cross does not steal the circle",
    S.crossedGhosts.length === 0 && sameSet(S.selected, ["魂魄"]) && S.pathCount === 1,
    JSON.stringify({ selected: S.selected, crossed: S.crossedGhosts }));

  await clickGhost("魂魄"); // cross the selected ghost
  S = await evaluate(stateExpr);
  check("crossing the circled ghost removes the circle",
    S.selected.length === 0 && sameSet(S.crossedGhosts, ["魂魄"]) && S.pathCount === 0,
    JSON.stringify({ selected: S.selected, crossed: S.crossedGhosts, paths: S.pathCount }));

  await clickReset();
  S = await evaluate(stateExpr);
  check("reset restores 魂魄 circle", sameSet(S.selected, ["魂魄"]) && S.pathCount === 1, JSON.stringify(S.selected));
  check("reset clears all marks", S.checked.length === 0 && S.crossedEv.length === 0 &&
    S.crossedGhosts.length === 0 && S.faded.length === 0, JSON.stringify(S));

  console.log("\n[5] hover a ghost -> only its evidence stays lit");
  await hoverGhost("女妖");
  S = await evaluate(stateExpr);
  check("女妖 hover dims the other 4 evidence", S.dim.length === 4, JSON.stringify(S.dim));
  check("女妖's DOTS/UV/ORB stay lit", !S.dim.includes("DOTS") && !S.dim.includes("UV") && !S.dim.includes("ORB"),
    JSON.stringify(S.dim));
  check("hover does not change marks", S.checked.length === 0 && S.crossedEv.length === 0 &&
    sameSet(S.selected, ["魂魄"]), JSON.stringify(S));
  await unhoverGhost("女妖");
  S = await evaluate(stateExpr);
  check("hover dim clears", S.dim.length === 0, JSON.stringify(S.dim));

  await hoverGhost("拟魂");
  S = await evaluate(stateExpr);
  check("Mimic hover dims ORB (orb is not evidence)", S.dim.includes("ORB"), JSON.stringify(S.dim));
  check("Mimic keeps BOX/UV/FREEZE lit", !S.dim.includes("BOX") && !S.dim.includes("UV") && !S.dim.includes("FREEZE"),
    JSON.stringify(S.dim));
  await unhoverGhost("拟魂");

  console.log("\n[6] faded ghost fades together with circle / line");
  await clickEv("DOTS");
  S = await evaluate(stateExpr);
  check("DOTS checked fades 魂魄", S.faded.includes("魂魄"), JSON.stringify(S.faded));
  check("魂魄 still selected", sameSet(S.selected, ["魂魄"]), JSON.stringify(S.selected));
  check("circle fades with the name", S.layerFaded && near(S.layerOpacity, 0.18, 0.02),
    `${S.layerFaded}/${S.layerOpacity}`);
  check("ghost name opacity is faded", near(S.ghostOpacity魂魄, 0.18, 0.02), String(S.ghostOpacity魂魄));
  check("circle still drawn", S.pathCount === 1, String(S.pathCount));

  await clickGhost("魂魄"); // selected -> crossed, while faded
  S = await evaluate(stateExpr);
  check("crossed + faded ghost keeps both states", S.crossedGhosts.includes("魂魄") && S.faded.includes("魂魄"),
    JSON.stringify({ crossed: S.crossedGhosts, faded: S.faded }));
  check("line fades with the name", near(S.ghostOpacity魂魄, 0.18, 0.02) && S.ghostLine魂魄 > 0.95,
    `${S.ghostOpacity魂魄}/${S.ghostLine魂魄}`);

  await clickEv("DOTS"); // checked -> crossed: must not have DOTS
  S = await evaluate(stateExpr);
  check("crossed DOTS fades the 13 ghosts that have it", S.faded.length === 13, String(S.faded.length));
  check("魂魄 unfaded (lacks DOTS)", !S.faded.includes("魂魄"), JSON.stringify(S.faded));
  check("女妖 faded (has DOTS)", S.faded.includes("女妖"), JSON.stringify(S.faded));
  check("crossed 魂魄 line returns to full opacity", near(S.ghostOpacity魂魄, 1, 0.03), String(S.ghostOpacity魂魄));
  check("crossed evidence itself stays crossed", sameSet(S.crossedEv, ["DOTS"]), JSON.stringify(S.crossedEv));

  console.log("\n[7] Mimic orb in filtering");
  await clickReset();
  await clickEv("ORB");
  S = await evaluate(stateExpr);
  check("ORB checked fades 拟魂", S.faded.includes("拟魂"), JSON.stringify(S.faded));
  check("ORB checked keeps 女妖", !S.faded.includes("女妖"), JSON.stringify(S.faded));
  check("18 ghosts faded without ORB", S.faded.length === 18, String(S.faded.length));

  await clickEv("ORB"); // checked -> crossed: must not have ORB
  S = await evaluate(stateExpr);
  check("crossed ORB fades 女妖 (has ORB)", S.faded.includes("女妖"), JSON.stringify(S.faded));
  check("crossed ORB keeps 拟魂 (orb is not evidence)", !S.faded.includes("拟魂"), JSON.stringify(S.faded));
  check("12 ghosts faded with crossed ORB", S.faded.length === 12, String(S.faded.length));

  console.log("\n[8] evidence marks do not touch ghost marks");
  await clickReset();
  await clickGhost("女妖");
  S = await evaluate(stateExpr);
  const before = { selected: S.selected.slice(), paths: S.pathCount };
  await clickEv("BOX");
  S = await evaluate(stateExpr);
  check("evidence filter does not move the circle", sameSet(S.selected, before.selected) && S.pathCount === before.paths,
    JSON.stringify({ before, after: { selected: S.selected, paths: S.pathCount } }));
  check("evidence filter still fades ghosts", S.faded.length > 0, String(S.faded.length));

  console.log("\n[9] minimum 880x700 layout");
  await clickReset();
  await setSize(880, 700);
  L = await evaluate(layoutExpr);
  S = await evaluate(stateExpr);
  check("evidence fits at minimum", L.lastItem.b <= L.leftPage.b + 1, `${L.lastItem.b} vs ${L.leftPage.b}`);
  check("footer fits at minimum", L.footLine.sw <= L.footLine.w + 1, `${L.footLine.sw}/${L.footLine.w}`);
  check("ghost names fit at minimum", L.maxGhostW < L.cellW - 2, `${L.maxGhostW}/${L.cellW}`);
  check("ghost names centered at minimum", ghostsCentered(L),
    `${[...new Set(L.ghostCenterX)]}`);
  check("reset inside page at minimum", L.reset.b <= L.rightPage.b + 1, `${L.reset.b} vs ${L.rightPage.b}`);
  check("drag region clears evidence at minimum",
    !!L.drag && !!L.firstEv && L.drag.b <= L.firstEv.y + 1,
    L.drag && L.firstEv ? `${L.drag.b} vs ${L.firstEv.y}` : "missing");
  check("initial circle at minimum", sameSet(S.selected, ["魂魄"]) && S.pathCount === 1 && surrounds(S.circle),
    JSON.stringify({ selected: S.selected, paths: S.pathCount, circle: S.circle }));

  console.log("\n[10] large 1500x1000 layout");
  await setSize(1500, 1000);
  L = await evaluate(layoutExpr);
  S = await evaluate(stateExpr);
  check("evidence fits at large", L.lastItem.b <= L.leftPage.b + 1, `${L.lastItem.b} vs ${L.leftPage.b}`);
  check("footer fits at large", L.footLine.sw <= L.footLine.w + 1, `${L.footLine.sw}/${L.footLine.w}`);
  check("ghost names fit at large", L.maxGhostW < L.cellW - 2, `${L.maxGhostW}/${L.cellW}`);
  check("initial circle at large", sameSet(S.selected, ["魂魄"]) && S.pathCount === 1 && surrounds(S.circle),
    JSON.stringify({ selected: S.selected, paths: S.pathCount, circle: S.circle }));

  console.log("\n[11] default max 1305x1043 layout");
  await clickReset();
  await setSize(1305, 1043);
  L = await evaluate(layoutExpr);
  S = await evaluate(stateExpr);
  check("evidence fits at default max", L.lastItem.b <= L.leftPage.b + 1, `${L.lastItem.b} vs ${L.leftPage.b}`);
  check("footer fits at default max", L.footLine.sw <= L.footLine.w + 1, `${L.footLine.sw}/${L.footLine.w}`);
  check("ghost names fit at default max", L.maxGhostW < L.cellW - 2, `${L.maxGhostW}/${L.cellW}`);
  check("ghost names centered at default max", ghostsCentered(L),
    `${[...new Set(L.ghostCenterX)]}`);
  check("drag region clears evidence at default max",
    !!L.drag && !!L.firstEv && L.drag.b <= L.firstEv.y + 1,
    L.drag && L.firstEv ? `${L.drag.b} vs ${L.firstEv.y}` : "missing");
  check("initial circle at default max", sameSet(S.selected, ["魂魄"]) && S.pathCount === 1 && surrounds(S.circle),
    JSON.stringify({ selected: S.selected, paths: S.pathCount, circle: S.circle }));

  console.log("\n[12] ghost detail: common rules on the left, ghost data on the right");
  await clickReset();
  const D0 = await evaluate(`return {
    open: document.getElementById('pageRight').classList.contains('detail-open'),
    leftOpen: document.getElementById('pageLeft').classList.contains('detail-open'),
    display: getComputedStyle(document.getElementById('ghostDetail')).display,
    common: getComputedStyle(document.getElementById('commonPanel')).display
  };`);
  check("detail is hidden initially",
    !D0.open && !D0.leftOpen && D0.display === "none" && D0.common === "none",
    JSON.stringify(D0));
  await clickGhost("女妖");
  await rightClickGhost("加鲁");

  let D = await evaluate(`
    const q = s => document.querySelector(s);
    const r = el => { const b = el.getBoundingClientRect(); return {x:b.x,y:b.y,w:b.width,h:b.height,rt:b.right,b:b.bottom}; };
    const detail = q('#ghostDetail');
    const page = q('#pageRight');
    const area = q('#ghostArea');
    const body = q('#detailBody');
    const back = q('#detailBack');
    const common = q('#commonPanel');
    const commonBody = q('#commonBody');
    const bb = back.getBoundingClientRect();
    const hit = document.elementFromPoint(bb.left + bb.width / 2, bb.top + bb.height / 2);
    return {
      open: page.classList.contains('detail-open'),
      leftOpen: q('#pageLeft').classList.contains('detail-open'),
      detailDisplay: getComputedStyle(detail).display,
      areaDisplay: getComputedStyle(area).display,
      detailRect: r(detail),
      pageRect: r(page),
      left: r(q('#pageLeft')),
      leftDisplay: getComputedStyle(q('#pageLeft')).display,
      evidenceDisplay: getComputedStyle(q('#evidenceList')).display,
      footDisplay: getComputedStyle(q('.page-left > .page-foot')).display,
      commonDisplay: getComputedStyle(common).display,
      commonRect: r(common),
      commonTitle: q('#commonPanel .page-title').textContent,
      commonCount: commonBody.querySelectorAll('p').length,
      commonText: commonBody.innerText,
      commonScrollable: commonBody.scrollHeight > commonBody.clientHeight + 4,
      commonScrollTop: commonBody.scrollTop,
      commonInDetail: !!body.querySelector('.detail-common'),
      title: q('#detailTitle').textContent,
      titleRect: r(q('#detailTitle')),
      backRect: r(back),
      fieldRect: r(detail.querySelector('.detail-field h3')),
      sub: q('#detailSub').textContent,
      fields: [...detail.querySelectorAll('.detail-field h3')].map(e => e.textContent),
      strongCount: body.querySelectorAll('strong').length,
      text: body.innerText,
      scrollable: body.scrollHeight > body.clientHeight + 4,
      scrollTop: body.scrollTop,
      selected: [...document.querySelectorAll('.ghost.selected')].map(e => e.dataset.name),
      backHit: !!hit && (hit === back || back.contains(hit)),
      pageZ: getComputedStyle(page).zIndex,
    };
  `);
  check("right-click opens the detail view",
    D.open && D.leftOpen && D.detailDisplay === "flex" && D.commonDisplay === "flex",
    JSON.stringify({ right: D.open, left: D.leftOpen, detail: D.detailDisplay, common: D.commonDisplay }));
  check("common rules replace the left evidence page",
    D.evidenceDisplay === "none" && D.footDisplay === "none" && D.leftDisplay !== "none",
    JSON.stringify({ evidence: D.evidenceDisplay, foot: D.footDisplay, left: D.leftDisplay }));
  check("detail replaces only the right page",
    D.areaDisplay === "none" && D.left.w > 100 && D.left.h > 100,
    JSON.stringify({ area: D.areaDisplay, left: D.left }));
  check("detail stays inside the right page",
    D.detailRect.x >= D.pageRect.x - 1 && D.detailRect.rt <= D.pageRect.rt + 1 &&
    D.detailRect.y >= D.pageRect.y - 1 && D.detailRect.b <= D.pageRect.b + 1,
    JSON.stringify({ detail: D.detailRect, page: D.pageRect }));
  check("common panel stays inside the left page",
    D.commonRect.x >= D.left.x - 1 && D.commonRect.rt <= D.left.rt + 1 &&
    D.commonRect.y >= D.left.y - 1 && D.commonRect.b <= D.left.b + 1,
    JSON.stringify({ common: D.commonRect, left: D.left }));
  check("common title is 通用规则 on the left page",
    D.commonTitle === "通用规则" && D.commonRect.x < D.pageRect.x,
    JSON.stringify({ title: D.commonTitle, x: D.commonRect.x, pageX: D.pageRect.x }));
  check("back button is above the top drag region", D.backHit && D.pageZ === "70",
    `hit=${D.backHit} z=${D.pageZ}`);
  check("back button sits to the right of the ghost name on the same row",
    D.backRect.x >= D.titleRect.rt - 0.5 &&
    D.backRect.y >= D.titleRect.y && D.backRect.y < D.titleRect.y + D.titleRect.h,
    JSON.stringify({ title: D.titleRect, back: D.backRect }));
  check("detail title aligns with the 证据 field",
    near(D.titleRect.x, D.fieldRect.x, 1.5),
    `${D.titleRect.x} vs ${D.fieldRect.x}`);
  check("detail title is the clicked ghost", D.title === "加鲁" && D.sub.includes("Gallu"),
    JSON.stringify({ title: D.title, sub: D.sub }));
  const galluFields = await evaluate(`
    return window.GHOST_INFO_FALLBACK.ghosts.find(g => g.name === '加鲁').fields.map(f => f.label);
  `);
  check("all Gallu fields are rendered",
    sameSet(D.fields, galluFields) && D.fields.length === galluFields.length,
    JSON.stringify({ got: D.fields, want: galluFields }));
  check("markdown inline bold is rendered", D.strongCount > 0, String(D.strongCount));
  check("long entry scrolls", D.scrollable, String(D.scrollable));
  check("detail opens at the top", D.scrollTop < 5, String(D.scrollTop));
  const commonCount = await evaluate(`return window.GHOST_INFO_FALLBACK.common.length;`);
  check("all common rules are on the left",
    D.commonCount === commonCount && D.commonCount > 0 &&
    D.commonText.includes("玩家速度") && !D.commonInDetail,
    JSON.stringify({ got: D.commonCount, want: commonCount, inDetail: D.commonInDetail }));
  check("common rules start at the top and scroll",
    D.commonScrollTop < 5 && D.commonScrollable,
    JSON.stringify({ top: D.commonScrollTop, scrollable: D.commonScrollable }));
  check("right-click does not change the circle", sameSet(D.selected, ["女妖"]), JSON.stringify(D.selected));

  await evaluate(`document.getElementById('detailBody').scrollTop = 160; return true;`);
  await clickDetailBack();
  await rightClickGhost("加鲁");
  const reopenTop = await evaluate(`return document.getElementById('detailBody').scrollTop;`);
  check("reopening starts at the top", reopenTop <= 1, String(reopenTop));
  const commonScroll = await evaluate(`
    const c = document.getElementById('commonBody');
    c.scrollTop = 120;
    return { top: c.scrollTop, max: c.scrollHeight - c.clientHeight };
  `);
  check("common rules can be scrolled before closing",
    commonScroll.top > 20 && commonScroll.max > 20, JSON.stringify(commonScroll));
  await clickDetailBack();
  await rightClickGhost("加鲁");
  const commonReopenTop = await evaluate(`return document.getElementById('commonBody').scrollTop;`);
  check("common rules reopen at the top", commonReopenTop <= 1, String(commonReopenTop));
  await clickDetailBack();

  console.log("\n[12b] left common rules; back restores evidence and the list");
  await rightClickGhost("加鲁");
  const E = await evaluate(`return {
    rightOpen: document.getElementById('pageRight').classList.contains('detail-open'),
    leftOpen: document.getElementById('pageLeft').classList.contains('detail-open'),
    commonDisplay: getComputedStyle(document.getElementById('commonPanel')).display,
    commonCount: document.querySelectorAll('#commonBody p').length,
    checked: [...document.querySelectorAll('.ev.checked')].map(e => e.dataset.key)
  };`);
  check("left page keeps showing common rules while detail is open",
    E.rightOpen && E.leftOpen && E.commonDisplay === "flex" && E.commonCount > 0,
    JSON.stringify(E));
  check("evidence stays unchanged while common rules show",
    E.checked.length === 0, JSON.stringify(E.checked));
  await clickDetailBack();
  const B = await evaluate(`return {
    rightOpen: document.getElementById('pageRight').classList.contains('detail-open'),
    leftOpen: document.getElementById('pageLeft').classList.contains('detail-open'),
    detailDisplay: getComputedStyle(document.getElementById('ghostDetail')).display,
    commonDisplay: getComputedStyle(document.getElementById('commonPanel')).display,
    evidenceDisplay: getComputedStyle(document.getElementById('evidenceList')).display,
    areaDisplay: getComputedStyle(document.getElementById('ghostArea')).display,
    ghostCount: document.querySelectorAll('.ghost').length,
    checked: [...document.querySelectorAll('.ev.checked')].map(e => e.dataset.key)
  };`);
  check("back closes the detail and restores evidence + list",
    !B.rightOpen && !B.leftOpen && B.detailDisplay === "none" &&
    B.commonDisplay === "none" && B.evidenceDisplay !== "none" &&
    B.areaDisplay !== "none" && B.ghostCount === 30 && B.checked.length === 0,
    JSON.stringify(B));
  S = await evaluate(stateExpr);
  check("circle is redrawn after returning",
    sameSet(S.selected, ["女妖"]) && S.pathCount === 1 && surrounds(S.circle),
    JSON.stringify({ selected: S.selected, paths: S.pathCount, circle: S.circle }));

  console.log("\n[12c] journal names map to the data-file names");
  const aliasKeywords = { "达彦": "特殊加速", "捣蛋鬼": "成片抛掷", "雷兽": "电子设备" };
  for (const [display, expected] of [["达彦", "达彦"], ["捣蛋鬼", "骚灵"], ["雷兽", "雷魂"]]) {
    await rightClickGhost(display);
    const A = await evaluate(`return {
      title: document.getElementById('detailTitle').textContent,
      sub: document.getElementById('detailSub').textContent,
      text: document.getElementById('detailBody').innerText,
      fields: document.querySelectorAll('#detailBody .detail-field').length
    };`);
    const subOk = expected === display
      ? !A.sub.includes("资料名：")
      : A.sub.includes("资料名：" + expected);
    check(`${display} maps to ${expected}`,
      A.title === display && subOk && A.fields > 0,
      JSON.stringify({ title: A.title, sub: A.sub, fields: A.fields }));
    check(`${display} shows ${expected}'s data`,
      A.text.includes(aliasKeywords[display]),
      A.text.slice(0, 80));
  }
  await clickDetailBack();

  console.log("\n[12d] all 30 ghosts resolve to complete field lists");
  const coverage = await evaluate(`
    const fallback = window.GHOST_INFO_FALLBACK;
    const aliases = { "捣蛋鬼": "骚灵", "雷兽": "雷魂" };
    const expected = Object.fromEntries(fallback.ghosts.map(g => [g.name, g.fields.map(f => f.label)]));
    const names = [...document.querySelectorAll('.ghost')].map(g => g.dataset.name);
    const bad = [];
    for (const name of names) {
      document.querySelector('.ghost[data-name="' + name + '"]')
        .dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }));
      const title = document.getElementById('detailTitle').textContent;
      const labels = [...document.querySelectorAll('#detailBody .detail-field h3')].map(e => e.textContent);
      const want = expected[aliases[name] || name] || [];
      if (title !== name || labels.length !== want.length || !want.every(l => labels.includes(l))) {
        bad.push({ name, title, got: labels, want });
      }
    }
    document.getElementById('detailBack').click();
    return { count: names.length, bad };
  `);
  check("all 30 ghosts resolve with every md field",
    coverage.count === 30 && coverage.bad.length === 0,
    JSON.stringify(coverage.bad.slice(0, 3)));
  await sleep(200);

  console.log("\n[12e] Esc closes the detail first; a second Esc resets");
  await clickReset();
  await clickEv("BOX");
  await rightClickGhost("魂魄");
  await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return true;`);
  await sleep(300);
  let K = await evaluate(`return {
    open: document.getElementById('pageRight').classList.contains('detail-open'),
    checked: [...document.querySelectorAll('.ev.checked')].map(e => e.dataset.key)
  };`);
  check("Esc closes the detail page", !K.open, JSON.stringify(K));
  check("Esc while detail is open does not reset", sameSet(K.checked, ["BOX"]), JSON.stringify(K.checked));

  await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return true;`);
  await sleep(620);
  K = await evaluate(`return {
    open: document.getElementById('pageRight').classList.contains('detail-open'),
    checked: [...document.querySelectorAll('.ev.checked')].map(e => e.dataset.key),
    selected: [...document.querySelectorAll('.ghost.selected')].map(e => e.dataset.name),
    paths: document.querySelectorAll('#circleLayer path').length
  };`);
  check("second Esc resets the journal",
    !K.open && K.checked.length === 0 && sameSet(K.selected, ["魂魄"]) && K.paths === 1,
    JSON.stringify(K));

  console.log("\n[12f] detail at minimum 880x700");
  await setSize(880, 700);
  await rightClickGhost("加鲁");
  const M = await evaluate(`
    const q = s => document.querySelector(s);
    const r = el => { const b = el.getBoundingClientRect(); return {x:b.x,y:b.y,w:b.width,h:b.height,rt:b.right,b:b.bottom}; };
    const detail = q('#ghostDetail');
    const page = q('#pageRight');
    const body = q('#detailBody');
    const back = q('#detailBack');
    const bb = back.getBoundingClientRect();
    const hit = document.elementFromPoint(bb.left + bb.width / 2, bb.top + bb.height / 2);
    return {
      detail: r(detail),
      page: r(page),
      bodyH: body.clientHeight,
      scrollable: body.scrollHeight > body.clientHeight + 4,
      overflowX: body.scrollWidth - body.clientWidth,
      backHit: !!hit && (hit === back || back.contains(hit)),
      title: q('#detailTitle').textContent,
      titleRect: r(q('#detailTitle')),
      backRect: r(back),
      fieldRect: r(q('#detailBody .detail-field h3')),
    };
  `);
  check("detail fits the minimum window",
    M.detail.x >= M.page.x - 1 && M.detail.rt <= M.page.rt + 1 &&
    M.detail.y >= M.page.y - 1 && M.detail.b <= M.page.b + 1 && M.bodyH > 100,
    JSON.stringify({ detail: M.detail, page: M.page, bodyH: M.bodyH }));
  check("detail has no horizontal overflow", M.overflowX <= 1, String(M.overflowX));
  check("detail still scrolls and the back button works at minimum",
    M.scrollable && M.backHit && M.title === "加鲁",
    JSON.stringify({ scrollable: M.scrollable, back: M.backHit }));
  check("minimum: back text follows the ghost name, title aligns with 证据",
    M.backRect.x >= M.titleRect.rt - 0.5 &&
    M.backRect.y >= M.titleRect.y && M.backRect.y < M.titleRect.y + M.titleRect.h &&
    near(M.titleRect.x, M.fieldRect.x, 1.5),
    JSON.stringify({ title: M.titleRect, back: M.backRect, field: M.fieldRect }));
  await clickDetailBack();

  console.log("\n[12g] detail API failure falls back with a warning");
  const F = await evaluate(`
    window.pywebview = { api: { get_ghost_info: () => Promise.reject(new Error("测试失败")) } };
    const el = document.querySelector('.ghost[data-name="女妖"]');
    el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }));
    await new Promise(r => setTimeout(r, 450));
    return {
      open: document.getElementById('pageRight').classList.contains('detail-open'),
      text: document.getElementById('detailBody').textContent,
      fields: document.querySelectorAll('#detailBody .detail-field').length,
    };
  `);
  check("failed API still shows the fallback details",
    F.open && F.fields > 0, JSON.stringify({ open: F.open, fields: F.fields }));
  check("failed API shows the fallback warning",
    F.text.includes("资料读取失败") && F.text.includes("内置快照"),
    F.text.slice(0, 120));

  console.log(`\n${failures === 0 ? "ALL PASS" : failures + " FAILURE(S)"}`);
} catch (e) {
  failures++;
  console.error("TEST ERROR:", e);
} finally {
  try { if (ws) ws.close(); } catch {}
  edge.kill();
  await sleep(300);
  process.exitCode = failures ? 1 : 0;
}
