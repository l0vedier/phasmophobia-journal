// 翻页动画专项测试：必须跑普通 URL，不能用 ?noflip=1。
// 用法：node tools/test_flip.mjs
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9335;
const PROFILE = "C:\\Users\\Lenovo\\AppData\\Local\\Temp\\edge-journal-flip-test";
const URL = "file:///E:/Claude%20code/phasmophobia-journal/app/index.html";

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

const snapshotExpr = `
  const q = s => document.querySelector(s);
  const r = el => {
    const b = el.getBoundingClientRect();
    return {x:+b.x.toFixed(2), y:+b.y.toFixed(2), w:+b.width.toFixed(2), h:+b.height.toFixed(2),
            rt:+b.right.toFixed(2), b:+b.bottom.toFixed(2)};
  };
  const sheet = q('.page-flip');
  const page = q('#pageRight');
  const left = q('#pageLeft');
  const front = sheet && sheet.querySelector('.flip-face.front');
  const back = sheet && sheet.querySelector('.flip-face.back');
  const cs = sheet ? getComputedStyle(sheet) : null;
  const display = (root, sel) => {
    const el = root && root.querySelector(sel);
    return el ? getComputedStyle(el).display : null;
  };
  const text = (root, sel) => {
    const el = root && root.querySelector(sel);
    return el ? el.textContent : null;
  };
  const scrollTop = (root, sel) => {
    const el = root && root.querySelector(sel);
    return el ? el.scrollTop : null;
  };
  return {
    sheetCount: document.querySelectorAll('.page-flip').length,
    direction: sheet ? [...sheet.classList].find(c => c === 'forward' || c === 'backward') || null : null,
    go: !!(sheet && sheet.classList.contains('go')),
    transform: cs ? cs.transform : null,
    width: cs ? parseFloat(cs.width) : null,
    leftStyle: cs ? cs.left : null,
    sheetRect: sheet ? r(sheet) : null,
    frontPageRect: front ? r(front.querySelector('.page')) : null,
    frontSnapWidth: front ? front.querySelector('.page').offsetWidth : null,
    backPageRect: back ? r(back.querySelector('.page')) : null,
    pageRect: r(page),
    leftRect: r(left),
    z: cs ? cs.zIndex : null,
    pointer: cs ? cs.pointerEvents : null,
    overlayIds: sheet ? sheet.querySelectorAll('[id]').length : -1,
    rightOpen: page.classList.contains('detail-open'),
    leftOpen: left.classList.contains('detail-open'),
    detailDisplay: getComputedStyle(q('#ghostDetail')).display,
    commonDisplay: getComputedStyle(q('#commonPanel')).display,
    evidenceDisplay: getComputedStyle(q('#evidenceList')).display,
    frontGhosts: front ? front.querySelectorAll('.ghost').length : -1,
    frontSelected: front ? [...front.querySelectorAll('.ghost.selected')].map(e => e.dataset.name) : [],
    frontCirclePaths: front ? front.querySelectorAll('.circle-layer path').length : -1,
    frontDetailDisplay: display(front, '.ghost-detail'),
    frontTitle: text(front, '.page-title'),
    frontCommonTitle: text(front, '.common-panel .page-title'),
    frontCommon: front ? front.querySelectorAll('.common-panel .common-body p').length : -1,
    frontCommonDisplay: display(front, '.common-panel'),
    frontEvidenceDisplay: display(front, '.evidence-list'),
    frontCommonTop: scrollTop(front, '.common-panel .common-body'),
    frontBackface: front ? getComputedStyle(front).backfaceVisibility : null,
    backGhosts: back ? back.querySelectorAll('.ghost').length : -1,
    backSelected: back ? [...back.querySelectorAll('.ghost.selected')].map(e => e.dataset.name) : [],
    backCirclePaths: back ? back.querySelectorAll('.circle-layer path').length : -1,
    backAreaDisplay: display(back, '.ghost-area'),
    backCommon: back ? back.querySelectorAll('.common-panel .common-body p').length : -1,
    backCommonDisplay: display(back, '.common-panel'),
    backEvidenceDisplay: display(back, '.evidence-list'),
    backDetailDisplay: display(back, '.ghost-detail'),
    backCommonTitle: text(back, '.common-panel .page-title'),
    backCommonTop: scrollTop(back, '.common-panel .common-body'),
    backTitle: text(back, '.page-title'),
    idCounts: {
      grid: document.querySelectorAll('#ghostGrid').length,
      detail: document.querySelectorAll('#detailBody').length,
      common: document.querySelectorAll('#commonBody').length
    }
  };
`;

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
  await setSize(1120, 895);
  const commonCount = await evaluate(`return window.GHOST_INFO_FALLBACK.common.length;`);

  console.log("\n[1] forward flip: ghost names -> ghost detail + left common rules");
  await evaluate(`
    document.querySelector('.ghost[data-name="女妖"]').click();
    return true;
  `);
  await sleep(620);

  const F0 = await evaluate(`
    document.querySelector('.ghost[data-name="加鲁"]')
      .dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }));
    ${snapshotExpr}
  `);
  check("forward sheet is created", F0.sheetCount === 1 && F0.direction === "forward",
    JSON.stringify({ count: F0.sheetCount, dir: F0.direction }));
  check("sheet starts un-rotated and above the pages",
    !F0.go && F0.z === "90" && F0.pointer === "none",
    JSON.stringify({ go: F0.go, z: F0.z, pointer: F0.pointer }));
  // 纸页容器现在固定铺 51%（宽的那页），窄页由正面快照自己定宽 49%；
  // 多出来的 2% 是透明的、落在书壳外被裁掉，所以要对齐的是快照本身。
  check("forward snapshot starts exactly on the right page",
    F0.frontPageRect && near(F0.frontPageRect.x, F0.pageRect.x, 1.5) &&
    near(F0.frontPageRect.w, F0.pageRect.w, 1.5) &&
    near(F0.frontPageRect.y, F0.pageRect.y, 1.5) &&
    near(F0.frontPageRect.h, F0.pageRect.h, 1.5),
    JSON.stringify({ snapshot: F0.frontPageRect, page: F0.pageRect }));
  check("front face is the old ghost-name page",
    F0.frontGhosts === 30 && sameSet(F0.frontSelected, ["女妖"]) &&
    F0.frontCirclePaths === 1 && F0.frontDetailDisplay === "none" && F0.frontTitle === "证据",
    JSON.stringify({ ghosts: F0.frontGhosts, selected: F0.frontSelected,
      paths: F0.frontCirclePaths, detail: F0.frontDetailDisplay, title: F0.frontTitle }));
  check("back face is the left common-rules page",
    F0.backCommon === commonCount && F0.backCommonDisplay === "flex" &&
    F0.backEvidenceDisplay === "none" && F0.backCommonTitle === "通用规则" &&
    F0.backCommonTop === 0,
    JSON.stringify({ common: F0.backCommon, display: F0.backCommonDisplay,
      evidence: F0.backEvidenceDisplay, title: F0.backCommonTitle, top: F0.backCommonTop }));
  check("faces hide their back side",
    F0.frontBackface === "hidden", String(F0.frontBackface));
  check("clone snapshot has no duplicate ids",
    F0.overlayIds === 0 &&
    F0.idCounts.grid === 1 && F0.idCounts.detail === 1 && F0.idCounts.common === 1,
    JSON.stringify({ overlay: F0.overlayIds, ids: F0.idCounts }));
  check("right page is detail while left is still evidence during the flip",
    F0.rightOpen && !F0.leftOpen && F0.detailDisplay === "flex" &&
    F0.commonDisplay === "none" && F0.evidenceDisplay !== "none",
    JSON.stringify({ right: F0.rightOpen, left: F0.leftOpen,
      detail: F0.detailDisplay, common: F0.commonDisplay, evidence: F0.evidenceDisplay }));

  await sleep(150);
  const F1 = await evaluate(snapshotExpr);
  // 只动 transform：宽度不再随动画变化（改宽度会让两整页文字每帧重排）。
  check("forward sheet is rotating without re-laying out the pages",
    F1.sheetCount === 1 && F1.direction === "forward" && F1.go &&
    F1.transform !== F0.transform && F1.width === F0.width &&
    F1.frontSnapWidth === F0.frontSnapWidth,
    JSON.stringify({ go: F1.go, from: F0.transform, to: F1.transform,
      widthFrom: F0.width, widthTo: F1.width,
      snapFrom: F0.frontSnapWidth, snapTo: F1.frontSnapWidth }));
  check("forward flip keeps the real left page unchanged mid-way",
    F1.rightOpen && !F1.leftOpen && F1.commonDisplay === "none" &&
    F1.evidenceDisplay !== "none",
    JSON.stringify({ right: F1.rightOpen, left: F1.leftOpen,
      common: F1.commonDisplay, evidence: F1.evidenceDisplay }));

  await evaluate(`document.querySelector('.ev[data-key="UV"]').click(); return true;`);
  const F1b = await evaluate(`return {
    checked: [...document.querySelectorAll('.ev.checked')].map(e => e.dataset.key),
    crossed: [...document.querySelectorAll('.ev.crossed')].map(e => e.dataset.key)
  };`);
  check("evidence click during forward flip is ignored",
    F1b.checked.length === 0 && F1b.crossed.length === 0,
    JSON.stringify(F1b));

  // 翻页途中点返回应被忽略；真正返回要等纸页落定。
  await evaluate(`document.getElementById('detailBack').click(); return true;`);
  await sleep(80);
  const G = await evaluate(snapshotExpr);
  check("back click during forward flip is ignored",
    G.sheetCount === 1 && G.direction === "forward" &&
    G.rightOpen && !G.leftOpen && G.detailDisplay === "flex",
    JSON.stringify({ count: G.sheetCount, dir: G.direction,
      right: G.rightOpen, left: G.leftOpen }));

  await sleep(1050);
  const F2 = await evaluate(`
    return {
      sheetCount: document.querySelectorAll('.page-flip').length,
      leftOpen: document.getElementById('pageLeft').classList.contains('detail-open'),
      rightOpen: document.getElementById('pageRight').classList.contains('detail-open'),
      detailDisplay: getComputedStyle(document.getElementById('ghostDetail')).display,
      commonDisplay: getComputedStyle(document.getElementById('commonPanel')).display,
      evidenceDisplay: getComputedStyle(document.getElementById('evidenceList')).display,
      commonCount: document.querySelectorAll('#commonBody p').length,
      commonTop: document.getElementById('commonBody').scrollTop,
      ghosts: document.querySelectorAll('.ghost').length,
      evs: document.querySelectorAll('.ev').length,
      ids: {
        grid: document.querySelectorAll('#ghostGrid').length,
        detail: document.querySelectorAll('#detailBody').length,
        common: document.querySelectorAll('#commonBody').length
      }
    };
  `);
  check("forward flip ends with common rules on the left and detail on the right",
    F2.sheetCount === 0 && F2.leftOpen && F2.rightOpen &&
    F2.detailDisplay === "flex" && F2.commonDisplay === "flex" &&
    F2.evidenceDisplay === "none" && F2.commonCount === commonCount &&
    F2.commonTop < 5,
    JSON.stringify(F2));
  check("forward flip leaves one real grid and no clone leftovers",
    F2.ghosts === 30 && F2.evs === 7 &&
    F2.ids.grid === 1 && F2.ids.detail === 1 && F2.ids.common === 1,
    JSON.stringify({ ghosts: F2.ghosts, evs: F2.evs, ids: F2.ids }));

  console.log("\n[2] backward flip: ghost detail -> ghost names");
  const pre = await evaluate(`
    const c = document.getElementById('commonBody');
    c.scrollTop = Math.min(80, c.scrollHeight - c.clientHeight);
    document.querySelector('.ev[data-key="UV"]').click();
    return {
      commonTop: c.scrollTop,
      maxTop: c.scrollHeight - c.clientHeight,
      checked: [...document.querySelectorAll('.ev.checked')].map(e => e.dataset.key)
    };
  `);
  check("set up scrolled common rules and a checked evidence",
    pre.maxTop > 20 && pre.commonTop > 20 && sameSet(pre.checked, ["UV"]),
    JSON.stringify(pre));

  const B0 = await evaluate(`
    document.getElementById('detailBack').click();
    ${snapshotExpr}
  `);
  check("backward sheet is created",
    B0.sheetCount === 1 && B0.direction === "backward",
    JSON.stringify({ count: B0.sheetCount, dir: B0.direction }));
  check("backward sheet starts exactly on the left page",
    B0.sheetRect && near(B0.sheetRect.x, B0.leftRect.x, 1.5) &&
    near(B0.sheetRect.w, B0.leftRect.w, 1.5) &&
    near(B0.sheetRect.y, B0.leftRect.y, 1.5) &&
    near(B0.sheetRect.h, B0.leftRect.h, 1.5),
    JSON.stringify({ sheet: B0.sheetRect, left: B0.leftRect }));
  check("backward front face is the old common-rules page",
    B0.frontCommonTitle === "通用规则" && B0.frontCommonDisplay === "flex" &&
    B0.frontEvidenceDisplay === "none" && B0.frontCommon === commonCount &&
    B0.frontGhosts === 0,
    JSON.stringify({ title: B0.frontCommonTitle, display: B0.frontCommonDisplay,
      evidence: B0.frontEvidenceDisplay, common: B0.frontCommon, ghosts: B0.frontGhosts }));
  check("front common face keeps the scroll position",
    B0.frontCommonTop === pre.commonTop,
    JSON.stringify({ frontTop: B0.frontCommonTop, want: pre.commonTop }));
  check("backward back face is the old ghost-name page",
    B0.backTitle === "证据" && B0.backGhosts === 30 &&
    B0.backDetailDisplay === "none" && B0.backAreaDisplay !== "none",
    JSON.stringify({ title: B0.backTitle, ghosts: B0.backGhosts,
      detail: B0.backDetailDisplay, area: B0.backAreaDisplay }));
  check("backward back face preserves the selected ghost and circle",
    sameSet(B0.backSelected, ["女妖"]) && B0.backCirclePaths === 1,
    JSON.stringify({ selected: B0.backSelected, paths: B0.backCirclePaths }));
  check("real left page is back to evidence while right stays detail",
    B0.rightOpen && !B0.leftOpen && B0.detailDisplay === "flex" &&
    B0.commonDisplay === "none" && B0.evidenceDisplay !== "none",
    JSON.stringify({ right: B0.rightOpen, left: B0.leftOpen,
      detail: B0.detailDisplay, common: B0.commonDisplay, evidence: B0.evidenceDisplay }));
  check("backward clone snapshot has no duplicate ids",
    B0.overlayIds === 0 &&
    B0.idCounts.grid === 1 && B0.idCounts.detail === 1 && B0.idCounts.common === 1,
    JSON.stringify({ overlay: B0.overlayIds, ids: B0.idCounts }));

  await sleep(150);
  const B1 = await evaluate(snapshotExpr);
  check("backward sheet is rotating",
    B1.sheetCount === 1 && B1.direction === "backward" && B1.go &&
    B1.transform !== B0.transform,
    JSON.stringify({ go: B1.go, from: B0.transform, to: B1.transform }));
  check("backward flip keeps the real right page in detail mid-way",
    B1.rightOpen && !B1.leftOpen && B1.detailDisplay === "flex" &&
    B1.commonDisplay === "none" && B1.evidenceDisplay !== "none",
    JSON.stringify({ right: B1.rightOpen, left: B1.leftOpen,
      detail: B1.detailDisplay, common: B1.commonDisplay, evidence: B1.evidenceDisplay }));

  // 后翻途中 Esc 应被忽略，不能在后景重置证据/圈选。
  await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return true;`);
  await sleep(80);
  const GE = await evaluate(snapshotExpr);
  check("Esc during backward flip is ignored",
    GE.sheetCount === 1 && GE.direction === "backward",
    JSON.stringify({ count: GE.sheetCount, dir: GE.direction }));

  await sleep(1050);
  const B2 = await evaluate(`
    return {
      sheetCount: document.querySelectorAll('.page-flip').length,
      leftOpen: document.getElementById('pageLeft').classList.contains('detail-open'),
      rightOpen: document.getElementById('pageRight').classList.contains('detail-open'),
      detailDisplay: getComputedStyle(document.getElementById('ghostDetail')).display,
      commonDisplay: getComputedStyle(document.getElementById('commonPanel')).display,
      evidenceDisplay: getComputedStyle(document.getElementById('evidenceList')).display,
      ghosts: document.querySelectorAll('.ghost').length,
      evs: document.querySelectorAll('.ev').length,
      checked: [...document.querySelectorAll('.ev.checked')].map(e => e.dataset.key),
      selected: [...document.querySelectorAll('.ghost.selected')].map(e => e.dataset.name),
      paths: document.querySelectorAll('#circleLayer path').length,
      ids: {
        grid: document.querySelectorAll('#ghostGrid').length,
        detail: document.querySelectorAll('#detailBody').length,
        common: document.querySelectorAll('#commonBody').length
      }
    };
  `);
  check("backward flip ends on the ghost-name list",
    B2.sheetCount === 0 && !B2.leftOpen && !B2.rightOpen &&
    B2.detailDisplay === "none" && B2.commonDisplay === "none" &&
    B2.evidenceDisplay !== "none" && B2.ghosts === 30,
    JSON.stringify(B2));
  check("Esc during the flip did not reset evidence or selection",
    sameSet(B2.checked, ["UV"]) && sameSet(B2.selected, ["女妖"]) &&
    B2.paths === 1,
    JSON.stringify({ checked: B2.checked, selected: B2.selected, paths: B2.paths }));
  check("backward flip leaves one real grid and no clone leftovers",
    B2.evs === 7 && B2.ids.grid === 1 && B2.ids.detail === 1 && B2.ids.common === 1,
    JSON.stringify({ evs: B2.evs, ids: B2.ids }));

  console.log("\n[3] reopening details resets the common-rules scroll");
  await evaluate(`
    document.querySelector('.ghost[data-name="女妖"]')
      .dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }));
    return true;
  `);
  await sleep(620);
  const commonScroll = await evaluate(`
    const c = document.getElementById('commonBody');
    c.scrollTop = 120;
    return { top: c.scrollTop, max: c.scrollHeight - c.clientHeight };
  `);
  check("common rules can be scrolled before closing",
    commonScroll.top > 20 && commonScroll.max > 20, JSON.stringify(commonScroll));
  await evaluate(`document.getElementById('detailBack').click(); return true;`);
  await sleep(620);
  await evaluate(`
    document.querySelector('.ghost[data-name="女妖"]')
      .dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }));
    return true;
  `);
  await sleep(620);
  const commonReopenTop = await evaluate(`return document.getElementById('commonBody').scrollTop;`);
  check("reopened common rules start at the top", commonReopenTop <= 1, String(commonReopenTop));

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
