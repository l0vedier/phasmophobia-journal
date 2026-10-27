// 翻页动画的帧间隔 / 响应延迟探针。
// 用法（先带调试端口启动笔记）：
//   set WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9335
//   pythonw main.py
//   node tools/gpu_latency_probe.mjs
// 输出每一轮「翻页快照出现」「详情页切换」的耗时，以及动画期间的帧间隔统计。
import { setTimeout as sleep } from "node:timers/promises";

const PORT = Number(process.env.CDP_PORT || 9335);
const ROUNDS = Number(process.env.PROBE_ROUNDS || 3);

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = targets.find(t => t.type === "page" && t.url.includes("index.html"));
if (!page) {
  console.error("找不到笔记页面，确认程序已用调试端口启动");
  process.exit(1);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  ws.addEventListener("open", res, { once: true });
  ws.addEventListener("error", rej, { once: true });
});

let id = 0;
const pending = new Map();
ws.addEventListener("message", ev => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});
const send = (method, params = {}) => new Promise(res => {
  const i = ++id;
  pending.set(i, res);
  ws.send(JSON.stringify({ id: i, method, params }));
});

const expression = `(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const rounds = [];
  const isOpen = () => document.getElementById('pageLeft').classList.contains('detail-open');
  const closeIfOpen = async () => {
    if (isOpen()) {
      document.getElementById('detailBack').click();
      await sleep(700);
    }
  };
  for (let i = 0; i < ${ROUNDS}; i++) {
    await closeIfOpen();
    await sleep(250);
    const ghost = [...document.querySelectorAll('.ghost')].find(e => e.dataset.name === '加鲁');
    const t0 = performance.now();
    let sheetAt = -1, openAt = -1;
    const frames = [];
    let last = performance.now();
    ghost.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
    await new Promise(res => {
      const tick = t => {
        frames.push(t - last);
        last = t;
        if (sheetAt < 0 && document.querySelector('.page-flip')) sheetAt = t - t0;
        if (openAt < 0 && isOpen()) openAt = t - t0;
        if (t - t0 < 900) requestAnimationFrame(tick);
        else res();
      };
      requestAnimationFrame(tick);
    });
    rounds.push({ sheetAt, openAt, frames });
  }
  await closeIfOpen();
  return JSON.stringify(rounds);
})()`;

const res = await send("Runtime.evaluate", {
  expression,
  awaitPromise: true,
  returnByValue: true,
});

if (res.result?.exceptionDetails) {
  console.error(res.result.exceptionDetails);
  process.exit(1);
}

const rounds = JSON.parse(res.result.result.value);
for (const [i, r] of rounds.entries()) {
  const f = r.frames.slice(1).sort((a, b) => a - b);
  const pct = p => f[Math.min(f.length - 1, Math.floor(f.length * p))];
  const over = ms => f.filter(x => x > ms).length;
  console.log(
    `[${i + 1}] 快照 ${r.sheetAt.toFixed(0)} ms · 切页 ${r.openAt.toFixed(0)} ms · ` +
    `帧 ${f.length} · 中位 ${pct(0.5).toFixed(1)} · p95 ${pct(0.95).toFixed(1)} · ` +
    `最大 ${f[f.length - 1].toFixed(1)} · >20ms ${over(20)} · >33ms ${over(33)}`
  );
}

ws.close();
