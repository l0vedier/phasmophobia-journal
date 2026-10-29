// 针对性测试：长页面能不能用鼠标拖着滚。
// Usage: node tools/test_drag_scroll.mjs
// 只覆盖「拖动滚动」这一件事，别拿它当全量 UI 测试用。
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9336;
const PROFILE = "C:\\Users\\Lenovo\\AppData\\Local\\Temp\\edge-journal-dragscroll";
const URL = "file:///E:/Claude%20code/phasmophobia-journal/app/index.html?noflip=1";

let failures = 0;
function check(name, ok, extra = "") {
  if (ok) console.log(`  PASS  ${name}`);
  else {
    failures++;
    console.log(`  FAIL  ${name}${extra ? "  -> " + extra : ""}`);
  }
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

async function mouse(type, x, y, extra = {}) {
  await send("Input.dispatchMouseEvent", {
    type, x, y, button: "left", clickCount: 1, ...extra,
  });
}

// 按住左键从 (x, y) 竖向拖 dy 像素，分几步走，模拟真实拖动
async function dragVertical(x, y, dy, steps = 8) {
  await mouse("mouseMoved", x, y, { button: "none" });
  await mouse("mousePressed", x, y);
  for (let i = 1; i <= steps; i++) {
    await mouse("mouseMoved", x, Math.round(y + (dy * i) / steps), { buttons: 1 });
    await sleep(16);
  }
  await mouse("mouseReleased", x, Math.round(y + dy), { buttons: 0 });
  await sleep(120);
}

try {
  await connect();
  await send("Runtime.enable");
  await sleep(900);

  // 打开右侧鬼魂详情（没有 pywebview API 时走内置资料）
  await evaluate(`
    const el = document.querySelector('.ghost[data-name="女妖"]');
    el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }));
    await new Promise(r => setTimeout(r, 500));
    return true;
  `);

  const geom = await evaluate(`
    const el = document.getElementById('detailBody');
    const r = el.getBoundingClientRect();
    el.scrollTop = 0;
    return {
      x: Math.round(r.left + r.width / 2),
      y: Math.round(r.top + r.height / 2),
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      top: el.scrollTop,
    };
  `);
  check("详情页内容高于可视区（有得滚）",
    geom.scrollHeight > geom.clientHeight + 8,
    JSON.stringify(geom));

  // 1) 往上拖 120px：内容应该往上走，scrollTop 变大
  await dragVertical(geom.x, geom.y, -120);
  const afterUp = await evaluate(`
    const el = document.getElementById('detailBody');
    return { top: el.scrollTop, cls: document.body.className };
  `);
  check("按住往上拖，内容跟着滚下去", afterUp.top > 40, JSON.stringify(afterUp));
  check("拖完拿掉抓取光标状态", !afterUp.cls.includes("drag-scrolling"), afterUp.cls);

  // 2) 往下拖回去
  await dragVertical(geom.x, geom.y, 100);
  const afterDown = await evaluate(`return document.getElementById('detailBody').scrollTop;`);
  check("按住往下拖，内容滚回来", afterDown < afterUp.top, `${afterUp.top} -> ${afterDown}`);

  // 3) 只动 2px 不该被当成拖动（点击不能被吞）
  await evaluate(`
    document.getElementById('detailBody').scrollTop = 0;
    return true;
  `);
  await dragVertical(geom.x, geom.y, -2, 2);
  const tiny = await evaluate(`return document.getElementById('detailBody').scrollTop;`);
  check("拖不到 4px 不滚动", tiny === 0, String(tiny));

  // 4) 左页通用规则同样能拖
  const commonScrollable = await evaluate(`
    const el = document.getElementById('commonBody');
    return el ? el.scrollHeight > el.clientHeight + 8 : false;
  `);
  check("左页通用规则有可滚区域", commonScrollable === true, String(commonScrollable));

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
