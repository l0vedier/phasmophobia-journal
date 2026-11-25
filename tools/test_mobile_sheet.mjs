// 手机版浮层滚动回归测试：诅咒物 / 鬼魂详情在几种手机视口下都必须能滚到真正的最后一行。
// 2026-11-25 加：真机反馈「通灵板能拖但内容不全」，根因是正文区只靠百分比高度撑，
// 老 WebView 上会伸出屏幕下面。现在正文区由 fitSheet() 定 max-height，这个测试守住它。
// 用法：node tools/test_mobile_sheet.mjs
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9351;
const PROFILE = "C:\\Users\\Lenovo\\AppData\\Local\\Temp\\edge-mobile-sheet-test";
const URL = "file:///E:/Claude%20code/phasmophobia-journal/mobile/index.html";
const SIZES = [[390, 844], [360, 640], [320, 568], [412, 915]];

let failures = 0;
function check(name, ok, extra = "") {
  if (ok) console.log(`  PASS  ${name}`);
  else { failures++; console.log(`  FAIL  ${name}${extra ? "  -> " + extra : ""}`); }
}

rmSync(PROFILE, { recursive: true, force: true });
const edge = spawn(EDGE, [
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  "--allow-file-access-from-files", "--force-device-scale-factor=1",
  "--window-size=390,844", `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, URL,
], { stdio: "ignore" });

let ws, nextId = 1;
const pending = new Map();
async function connect() {
  let target = null;
  for (let i = 0; i < 80; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      target = list.find(t => t.type === "page" && t.url.includes("mobile/index.html"));
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
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
    }
  });
}
function send(method, params = {}) {
  const id = nextId++;
  return new Promise((res, rej) => { pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
}
async function ev(expr) {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}
async function touch(type, x, y) {
  await send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
}

async function swipeUp(x, y0, y1, steps = 8) {
  await touch("touchStart", x, y0);
  for (let i = 1; i <= steps; i++) {
    await touch("touchMove", x, y0 + (y1 - y0) * i / steps);
    await sleep(14);
  }
  await touch("touchEnd", x, y1);
  await sleep(200);
}

await connect();
await send("Runtime.enable"); await send("Page.enable");
await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });

for (const [w, h] of SIZES) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 3, mobile: true });
  await send("Page.reload");
  await sleep(900);
  console.log(`\n=== 视口 ${w}x${h}`);

  const names = await ev(`Array.from(document.querySelectorAll('#cursedNames button')).map(b=>b.textContent)`);
  for (const name of names) {
    const info = await ev(`(async () => {
      const btn = Array.from(document.querySelectorAll('#cursedNames button')).find(b=>b.textContent===${JSON.stringify(name)});
      btn.click();
      await new Promise(r=>setTimeout(r, 360));
      const body = document.getElementById('cursedSheetBody');
      const br = body.getBoundingClientRect();
      return { vh: innerHeight, top: Math.round(br.top), bottom: Math.round(br.bottom),
               x: Math.round(br.left + br.width/2), y0: Math.round(br.top + br.height*0.7),
               y1: Math.round(br.top + br.height*0.3),
               need: body.scrollHeight - body.clientHeight };
    })()`);
    check(`${name} 正文区在屏幕内`, info.bottom <= info.vh + 1,
      `bottom=${info.bottom} vh=${info.vh}`);
    const SUB_EXPECT = { "通灵板": 29, "塔罗牌": 10, "猴爪": 10 };
    if (SUB_EXPECT[name]) {
      const got = await ev(`document.querySelectorAll('#cursedSheetBody .sub-list li').length`);
      check(`${name} 子项全部渲染（${SUB_EXPECT[name]} 条）`, got === SUB_EXPECT[name], `得到 ${got}`);
    }
    for (let k = 0; k < 6; k++) await swipeUp(info.x, Math.round(info.vh*0.85), Math.round(info.vh*0.18));
    const end = await ev(`(() => {
      const body = document.getElementById('cursedSheetBody');
      const last = body.lastElementChild;
      const lr = last.getBoundingClientRect();
      return { atEnd: body.scrollTop + body.clientHeight >= body.scrollHeight - 2,
               lastBottom: Math.round(lr.bottom), vh: innerHeight,
               scrollTop: Math.round(body.scrollTop), max: body.scrollHeight - body.clientHeight };
    })()`);
    check(`${name} 触摸能滚到真底`, end.atEnd && end.lastBottom <= end.vh + 1,
      `scrollTop=${end.scrollTop}/${end.max} lastBottom=${end.lastBottom} vh=${end.vh}`);
    await ev(`document.getElementById('cursedSheetBack').click()`);
    await sleep(200);
  }

  // 鬼魂详情：翻到第 2 页，长按第一个鬼名（480 ms）打开浮层，套一样的约束
  await touch("touchStart", Math.round(w * 0.85), Math.round(h * 0.5));
  for (let i = 1; i <= 8; i++) {
    await touch("touchMove", Math.round(w * (0.85 - 0.7 * i / 8)), Math.round(h * 0.5));
    await sleep(14);
  }
  await touch("touchEnd", Math.round(w * 0.15), Math.round(h * 0.5));
  await sleep(420);
  const ghostPos = await ev(`(() => {
    const g = document.querySelector('.ghost');
    if (!g) return null;
    const r = g.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  })()`);
  if (ghostPos) {
    await touch("touchStart", ghostPos.x, ghostPos.y);
    await sleep(620);                     // 长按 480 ms 才弹资料
    await touch("touchEnd", ghostPos.x, ghostPos.y);
    await sleep(420);
  }
  const ghost = await ev(`(() => {
    const open = document.getElementById('ghostSheet').classList.contains('open');
    if (!open) return null;
    const body = document.getElementById('sheetBody');
    const br = body.getBoundingClientRect();
    return { bottom: Math.round(br.bottom), vh: innerHeight,
             x: Math.round(br.left + br.width/2), y0: Math.round(br.top + br.height*0.7),
             y1: Math.round(br.top + br.height*0.3) };
  })()`);
  if (ghost) {
    check(`鬼魂浮层正文区在屏幕内`, ghost.bottom <= ghost.vh + 1, `bottom=${ghost.bottom} vh=${ghost.vh}`);
    for (let k = 0; k < 6; k++) await swipeUp(ghost.x, Math.round(ghost.vh*0.85), Math.round(ghost.vh*0.18));
    const end = await ev(`(() => {
      const body = document.getElementById('sheetBody');
      const last = body.lastElementChild;
      const lr = last.getBoundingClientRect();
      return { atEnd: body.scrollTop + body.clientHeight >= body.scrollHeight - 2,
               lastBottom: Math.round(lr.bottom), vh: innerHeight };
    })()`);
    check(`鬼魂浮层能滚到真底`, end.atEnd && end.lastBottom <= end.vh + 1,
      `lastBottom=${end.lastBottom} vh=${end.vh}`);
    await ev(`document.getElementById('sheetBack').click()`);
  } else {
    console.log("  SKIP  鬼魂浮层（当前页没有 .ghost 元素）");
  }
}

ws.close();
edge.kill();
console.log(failures ? `\n${failures} 项失败` : "\n全部通过");
process.exit(failures ? 1 : 0);
