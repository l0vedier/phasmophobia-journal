// 诅咒之物第二页专项测试：翻页、名字淡入介绍、返回、无重置入口、Esc。
// 用法：node tools/test_cursed.mjs
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9337;
const PROFILE = "C:\\Users\\Lenovo\\AppData\\Local\\Temp\\edge-journal-cursed-test";
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

const stateExpr = `
  const q = s => document.querySelector(s);
  const r = el => {
    const b = el.getBoundingClientRect();
    return {x:+b.x.toFixed(2), y:+b.y.toFixed(2), w:+b.width.toFixed(2),
            h:+b.height.toFixed(2), rt:+b.right.toFixed(2), b:+b.bottom.toFixed(2)};
  };
  const page = q('#pageRight'), left = q('#pageLeft');
  const text = (root, sel) => {
    const el = root && root.querySelector(sel);
    return el ? el.textContent.trim() : null;
  };
  const count = (root, sel) => root ? root.querySelectorAll(sel).length : -1;
  const subCount = label => {
    const h = [...document.querySelectorAll('#cursedDetailBody h3')]
      .find(el => el.textContent.trim() === label);
    if (!h) return -1;
    const block = h.closest('.detail-field');
    return block ? block.querySelectorAll('.detail-sublist li').length : -1;
  };
  const sheet = q('.page-flip');
  const front = sheet && sheet.querySelector('.flip-face.front');
  const back = sheet && sheet.querySelector('.flip-face.back');
  return {
    sheetCount: document.querySelectorAll('.page-flip').length,
    direction: sheet ? [...sheet.classList].find(c => c === 'forward' || c === 'backward') || null : null,
    sheetGo: !!(sheet && sheet.classList.contains('go')),
    frontGhosts: front ? front.querySelectorAll('.ghost').length : -1,
    frontCursed: front ? front.querySelectorAll('.cursed-name').length : -1,
    frontCursedDisplay: front && front.querySelector('.cursed-list')
      ? getComputedStyle(front.querySelector('.cursed-list')).display
      : null,
    backGhosts: back ? back.querySelectorAll('.ghost').length : -1,
    backCursed: back ? back.querySelectorAll('.cursed-name').length : -1,
    backCursedRules: back ? back.querySelectorAll('.cursed-body p').length : -1,
    backCursedDisplay: back && back.querySelector('.cursed-panel')
      ? getComputedStyle(back.querySelector('.cursed-panel')).display
      : null,
    backCursedListDisplay: back && back.querySelector('.cursed-list')
      ? getComputedStyle(back.querySelector('.cursed-list')).display
      : null,
    backTitle: text(back, '.cursed-list .page-title'),
    leftCursedOpen: left.classList.contains('cursed-open'),
    rightListOpen: page.classList.contains('cursed-list-open'),
    rightDetailOpen: page.classList.contains('cursed-detail-open'),
    rightDetailClass: page.classList.contains('detail-open'),
    rightFading: page.classList.contains('is-fading'),
    rightOpacity: getComputedStyle(page).opacity,
    evidenceDisplay: getComputedStyle(q('#evidenceList')).display,
    cursedPanelDisplay: getComputedStyle(q('#cursedPanel')).display,
    ghostAreaDisplay: getComputedStyle(q('#ghostArea')).display,
    cursedListDisplay: getComputedStyle(q('#cursedList')).display,
    cursedDetailDisplay: getComputedStyle(q('#cursedDetail')).display,
    cursedRules: count(q('#cursedBody'), 'p'),
    cursedNames: count(q('#cursedNames'), '.cursed-name'),
    leftTitle: text(q('#cursedPanel'), '.page-title'),
    leftSub: text(q('#cursedPanel'), '.panel-sub'),
    rightTitle: text(q('#cursedList'), '.page-title'),
    rightHint: text(q('#cursedList'), '.hint'),
    detailTitle: text(q('#cursedDetail'), '.detail-title'),
    detailSub: text(q('#cursedDetail'), '.detail-sub'),
    ouijaQuestions: subCount('问题与代价'),
    ouijaPhrases: subCount('常用问法（语音/文本）'),
    tarotCards: subCount('卡牌'),
    monkeyWishes: subCount('愿望'),
    reset: r(q('#resetBtn')),
    next: r(q('#ghostNextBtn')),
    leftPage: r(left),
    rightPage: r(page),
    checks: [...document.querySelectorAll('.ev.checked')].map(e => e.dataset.key),
    selected: [...document.querySelectorAll('.ghost.selected')].map(e => e.dataset.name),
    ids: {
      grid: document.querySelectorAll('#ghostGrid').length,
      detail: document.querySelectorAll('#detailBody').length,
      common: document.querySelectorAll('#commonBody').length,
      cursed: document.querySelectorAll('#cursedBody').length,
      cursedDetail: document.querySelectorAll('#cursedDetailBody').length
    }
  };
`;

async function clickNext() {
  await evaluate(`document.getElementById('ghostNextBtn').click(); return true;`);
}
async function clickCursed(name) {
  await evaluate(`
    [...document.querySelectorAll('.cursed-name')]
      .find(b => b.dataset.name === ${JSON.stringify(name)}).click();
    return true;
  `);
}
async function pressEsc() {
  await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return true;`);
}

try {
  await connect();
  await send("Runtime.enable");

  for (let i = 0; i < 100; i++) {
    const s = await evaluate(`
      return {
        ghosts: document.querySelectorAll('.ghost').length,
        cursed: document.querySelectorAll('.cursed-name').length,
        ready: document.getElementById('circleLayer').classList.contains('ready'),
        paths: document.querySelectorAll('#circleLayer path').length
      };
    `);
    if (s.ghosts === 30 && s.cursed === 7 && s.ready && s.paths === 1) break;
    await sleep(100);
  }
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1120, height: 895, deviceScaleFactor: 1, mobile: false,
  });
  await sleep(400);

  console.log("\n[1] ghost list: reset left, page-turn footer right");
  const L = await evaluate(stateExpr);
  check("ghost list still has 30 names and 7 evidence",
    L.cursedNames === 7 && L.ids.grid === 1,
    JSON.stringify({ cursed: L.cursedNames, ids: L.ids }));
  check("reset sits at the bottom-left of the right page",
    L.reset.x < L.rightPage.x + L.rightPage.w / 2 &&
    L.reset.b <= L.rightPage.b + 1 &&
    L.reset.b > L.rightPage.b - 80,
    JSON.stringify({ reset: L.reset, page: L.rightPage }));
  check("next-page footer sits at the bottom-right",
    L.next.rt > L.rightPage.x + L.rightPage.w / 2 &&
    L.next.b <= L.rightPage.b + 1 &&
    L.next.b > L.rightPage.b - 80 &&
    L.next.x > L.reset.x,
    JSON.stringify({ next: L.next, reset: L.reset, page: L.rightPage }));
  check("ghost list footer text points to cursed items",
    await evaluate(`return document.getElementById('ghostNextBtn').textContent.trim();`) === "下一页：诅咒之物 →");

  console.log("\n[2] forward flip: ghost names -> cursed rules + cursed names");
  await clickNext();
  const F0 = await evaluate(stateExpr);
  check("forward sheet is created",
    F0.sheetCount === 1 && F0.direction === "forward",
    JSON.stringify({ count: F0.sheetCount, dir: F0.direction }));
  check("front face is the ghost-name page",
    F0.frontGhosts === 30 && F0.frontCursedDisplay === "none" &&
    F0.frontCursed === 7,
    JSON.stringify({ ghosts: F0.frontGhosts, cursed: F0.frontCursed,
      display: F0.frontCursedDisplay }));
  check("back face is the cursed rules page",
    F0.backCursedDisplay === "flex" && F0.backCursedRules === 10 &&
    F0.backCursed === 0 && F0.backGhosts === 0,
    JSON.stringify({ display: F0.backCursedDisplay, rules: F0.backCursedRules,
      cursed: F0.backCursed, ghosts: F0.backGhosts }));
  check("real right page switches to cursed names during the flip",
    F0.rightListOpen && !F0.leftCursedOpen &&
    F0.evidenceDisplay !== "none" && F0.cursedPanelDisplay === "none",
    JSON.stringify({ right: F0.rightListOpen, left: F0.leftCursedOpen,
      evidence: F0.evidenceDisplay, panel: F0.cursedPanelDisplay }));

  await sleep(1100);
  const F1 = await evaluate(stateExpr);
  check("forward flip ends on the cursed spread",
    F1.sheetCount === 0 && F1.leftCursedOpen && F1.rightListOpen &&
    !F1.rightDetailOpen && F1.evidenceDisplay === "none" &&
    F1.cursedPanelDisplay === "flex" && F1.ghostAreaDisplay === "none",
    JSON.stringify(F1));
  check("left page shows 10 cursed rules with the right title",
    F1.cursedRules === 10 && F1.leftTitle === "诅咒之物" && F1.leftSub === "通用规则",
    JSON.stringify({ rules: F1.cursedRules, title: F1.leftTitle, sub: F1.leftSub }));
  check("right page lists all 7 cursed names",
    F1.cursedNames === 7 && F1.rightTitle === "诅咒之物" &&
    F1.rightHint === "每局随机一件，选择名字查看介绍",
    JSON.stringify({ names: F1.cursedNames, title: F1.rightTitle, hint: F1.rightHint }));
  check("no duplicate ids after the cursed flip",
    F1.ids.grid === 1 && F1.ids.detail === 1 && F1.ids.common === 1 &&
    F1.ids.cursed === 1 && F1.ids.cursedDetail === 1,
    JSON.stringify(F1.ids));

  console.log("\n[3] cursed name -> introduction fades out and in");
  await clickCursed("通灵板");
  const D0 = await evaluate(stateExpr);
  check("right page starts fading out", D0.rightFading,
    JSON.stringify({ fading: D0.rightFading, opacity: D0.rightOpacity }));
  await sleep(300);
  const D1 = await evaluate(stateExpr);
  check("right page becomes the Ouija introduction",
    D1.rightDetailOpen && !D1.rightListOpen &&
    D1.cursedDetailDisplay === "flex" && D1.cursedListDisplay === "none" &&
    D1.detailTitle === "通灵板" && D1.detailSub === "Ouija Board",
    JSON.stringify(D1));
  check("Ouija nested question and phrase lists render",
    D1.ouijaQuestions === 13 && D1.ouijaPhrases === 12,
    JSON.stringify({ questions: D1.ouijaQuestions, phrases: D1.ouijaPhrases }));
  check("left page stays on cursed rules in the introduction",
    D1.leftCursedOpen && D1.cursedPanelDisplay === "flex" &&
    D1.evidenceDisplay === "none",
    JSON.stringify({ left: D1.leftCursedOpen, panel: D1.cursedPanelDisplay,
      evidence: D1.evidenceDisplay }));
  await sleep(420);
  const D2 = await evaluate(stateExpr);
  check("fade-in completes at full opacity",
    !D2.rightFading && near(parseFloat(D2.rightOpacity), 1, 0.01),
    JSON.stringify({ fading: D2.rightFading, opacity: D2.rightOpacity }));

  console.log("\n[4] back button fades introduction back to the name list");
  await evaluate(`document.getElementById('cursedDetailBack').click(); return true;`);
  const B0 = await evaluate(stateExpr);
  check("back starts fading out", B0.rightFading, JSON.stringify(B0.rightFading));
  await sleep(300);
  const B1 = await evaluate(stateExpr);
  check("cursed name list is restored",
    B1.rightListOpen && !B1.rightDetailOpen &&
    B1.cursedListDisplay === "flex" && B1.cursedNames === 7 &&
    B1.leftCursedOpen,
    JSON.stringify({ list: B1.rightListOpen, detail: B1.rightDetailOpen,
      names: B1.cursedNames, left: B1.leftCursedOpen }));

  console.log("\n[5] left footer returns to the ghost list (even from an introduction)");
  await clickCursed("猴爪");
  await sleep(300);
  const M = await evaluate(stateExpr);
  check("Monkey Paw introduction renders all 10 wishes",
    M.rightDetailOpen && M.detailTitle === "猴爪" && M.monkeyWishes === 10,
    JSON.stringify({ title: M.detailTitle, wishes: M.monkeyWishes }));
  await evaluate(`document.getElementById('cursedBack').click(); return true;`);
  const C0 = await evaluate(stateExpr);
  check("backward sheet is created from the introduction page",
    C0.sheetCount === 1 && C0.direction === "backward" &&
    C0.rightDetailOpen && !C0.leftCursedOpen,
    JSON.stringify({ count: C0.sheetCount, dir: C0.direction,
      right: C0.rightDetailOpen, left: C0.leftCursedOpen }));
  check("backward back face is the ghost-name page",
    C0.backGhosts === 30 && C0.backCursedListDisplay === "none" &&
    C0.backCursedDisplay === null,
    JSON.stringify({ ghosts: C0.backGhosts, cursed: C0.backCursed,
      list: C0.backCursedListDisplay, panel: C0.backCursedDisplay }));
  await sleep(1100);
  const C1 = await evaluate(stateExpr);
  check("cursed spread closes and the ghost list is back",
    C1.sheetCount === 0 && !C1.leftCursedOpen && !C1.rightListOpen &&
    !C1.rightDetailOpen && C1.cursedPanelDisplay === "none" &&
    C1.ghostAreaDisplay !== "none" && C1.cursedNames === 7,
    JSON.stringify(C1));
  check("no duplicate ids after returning",
    C1.ids.grid === 1 && C1.ids.detail === 1 && C1.ids.common === 1 &&
    C1.ids.cursed === 1 && C1.ids.cursedDetail === 1,
    JSON.stringify(C1.ids));

  console.log("\n[6] the cursed spread has no reset control");
  await clickNext();
  await sleep(1100);
  const resetVisibleExpr = `(() => {
    const b = document.getElementById('resetBtn');
    const box = b ? b.getBoundingClientRect() : null;
    return {
      cursedReset: !!document.getElementById('cursedResetBtn'),
      resetButtons: document.querySelectorAll('.reset-btn').length,
      resetVisible: !!(b && box.width > 0 && box.height > 0)
    };
  })()`;
  const R0 = await evaluate(`return ${resetVisibleExpr};`);
  check("cursed name page has no reset button",
    !R0.cursedReset && R0.resetButtons === 1 && !R0.resetVisible,
    JSON.stringify(R0));
  await clickCursed("八音盒");
  await sleep(400);
  const R1 = await evaluate(`return ${resetVisibleExpr};`);
  check("cursed introduction has no reset button",
    !R1.cursedReset && R1.resetButtons === 1 && !R1.resetVisible,
    JSON.stringify(R1));
  await evaluate(`document.getElementById('cursedDetailBack').click(); return true;`);
  await sleep(400);
  await pressEsc();
  await sleep(1100);

  console.log("\n[7] Esc steps back one level at a time");
  await clickNext();
  await sleep(1100);
  await pressEsc();
  await sleep(1100);
  const E0 = await evaluate(stateExpr);
  check("Esc on the cursed list returns to the ghost list",
    !E0.leftCursedOpen && !E0.rightListOpen && E0.ghostAreaDisplay !== "none",
    JSON.stringify({ left: E0.leftCursedOpen, right: E0.rightListOpen }));
  await clickNext();
  await sleep(1100);
  await clickCursed("塔罗牌");
  await sleep(300);
  await pressEsc();
  await sleep(350);
  const E1 = await evaluate(stateExpr);
  check("Esc in a cursed introduction returns to the name list",
    E1.rightListOpen && !E1.rightDetailOpen && E1.leftCursedOpen &&
    E1.cursedNames === 7,
    JSON.stringify({ list: E1.rightListOpen, detail: E1.rightDetailOpen,
      left: E1.leftCursedOpen, names: E1.cursedNames }));
  await pressEsc();
  await sleep(1100);
  const E2 = await evaluate(stateExpr);
  check("second Esc leaves the cursed spread",
    !E2.leftCursedOpen && !E2.rightListOpen && E2.ghostAreaDisplay !== "none",
    JSON.stringify({ left: E2.leftCursedOpen, right: E2.rightListOpen }));

  console.log("\n[8] reduced motion: no flip sheet and no fade");
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  await clickNext();
  const N0 = await evaluate(stateExpr);
  check("cursed spread opens without a flip sheet",
    N0.sheetCount === 0 && N0.leftCursedOpen && N0.rightListOpen &&
    N0.cursedPanelDisplay === "flex",
    JSON.stringify({ sheets: N0.sheetCount, left: N0.leftCursedOpen,
      right: N0.rightListOpen }));
  await clickCursed("八音盒");
  const N1 = await evaluate(stateExpr);
  check("cursed introduction opens without fading",
    !N1.rightFading && N1.rightDetailOpen && N1.detailTitle === "八音盒",
    JSON.stringify({ fading: N1.rightFading, detail: N1.rightDetailOpen,
      title: N1.detailTitle }));
  await evaluate(`document.getElementById('cursedDetailBack').click(); return true;`);
  const N2 = await evaluate(stateExpr);
  check("returning to the name list is immediate",
    !N2.rightFading && N2.rightListOpen && N2.cursedNames === 7,
    JSON.stringify({ fading: N2.rightFading, list: N2.rightListOpen,
      names: N2.cursedNames }));
  await evaluate(`document.getElementById('cursedBack').click(); return true;`);
  const N3 = await evaluate(stateExpr);
  check("leaving the cursed spread is immediate",
    N3.sheetCount === 0 && !N3.leftCursedOpen && !N3.rightListOpen &&
    N3.ghostAreaDisplay !== "none",
    JSON.stringify({ sheets: N3.sheetCount, left: N3.leftCursedOpen,
      right: N3.rightListOpen }));
  await send("Emulation.setEmulatedMedia", { features: [] });

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
