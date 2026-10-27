// 打包版冒烟测试：启动 dist\<名称与版本>\<名称与版本>.exe，通过 WebView2 的
// CDP 端口确认界面和鬼魂资料都能正常加载，然后调用应用自己的关闭接口退出。
// 用法：node tools/smoke_packaged.mjs
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const ROOT = "E:\\Claude code\\phasmophobia-journal";
const VERSION_SRC = readFileSync(join(ROOT, "version.py"), "utf8");
const APP_NAME = `${VERSION_SRC.match(/APP_NAME_BASE\s*=\s*"([^"]+)"/)[1]} v${VERSION_SRC.match(/APP_VERSION\s*=\s*"([^"]+)"/)[1]}`;
const EXE = join(ROOT, "dist", APP_NAME, `${APP_NAME}.exe`);
const LOG = join(homedir(), "AppData", "Roaming", "PhasmophobiaJournal", "journal.log");
const PORT = 9334;

if (!existsSync(EXE)) {
  console.error("找不到打包后的 exe：", EXE);
  process.exit(1);
}

const logBefore = existsSync(LOG) ? readFileSync(LOG) : Buffer.alloc(0);
const logOffset = logBefore.length;

const exeArgs = process.argv.includes("--single") ? [] : ["--allow-multi"];
const child = spawn(EXE, exeArgs, {
  cwd: join(ROOT, "dist", APP_NAME),
  env: {
    ...process.env,
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}`,
  },
  stdio: "ignore",
});

let ws;
let nextId = 1;
const pending = new Map();

async function connect() {
  let target = null;
  for (let i = 0; i < 120; i++) {
    if (child.exitCode !== null) throw new Error("打包版在连接调试端口前退出了");
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      target = list.find(t => t.type === "page" && t.url.includes("index.html"));
      if (target) break;
    } catch {}
    await sleep(250);
  }
  if (!target) throw new Error("没有找到 WebView2 调试目标");
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

function killTree() {
  if (child.exitCode === null) {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  }
}

let failures = 0;
function check(name, ok, extra = "") {
  if (ok) console.log(`  PASS  ${name}`);
  else {
    failures++;
    console.log(`  FAIL  ${name}${extra ? "  -> " + extra : ""}`);
  }
}

function newLog() {
  if (!existsSync(LOG)) return "";
  return readFileSync(LOG).subarray(logOffset).toString("utf8");
}

try {
  console.log(`启动 ${EXE}`);
  await connect();

  let ready = null;
  for (let i = 0; i < 80; i++) {
    ready = await evaluate(`return {
      ready: !!(window.pywebview && window.pywebview.api),
      title: document.title,
      ghosts: document.querySelectorAll('.ghost').length,
      evidence: document.querySelectorAll('.ev').length,
      body: document.body.innerText.slice(0, 120)
    };`);
    if (ready.ready) break;
    await sleep(250);
  }
  if (!ready || !ready.ready) throw new Error("界面没有暴露 pywebview.api：" + JSON.stringify(ready));

  check("window title", ready.title === APP_NAME, ready.title);
  check("30 ghost names rendered", ready.ghosts === 30, String(ready.ghosts));
  check("7 evidence rows rendered", ready.evidence === 7, String(ready.evidence));

  const info = await evaluate(`return await window.pywebview.api.get_ghost_info();`);
  check("ghost data loads", !!info.ok, info.error || "");
  check("30 ghosts in data", (info.ghosts || []).length === 30, String((info.ghosts || []).length));
  check("data comes from the folder beside the exe",
    typeof info.source === "string" &&
    info.source.includes("恐鬼症笔记") &&
    info.source.includes("资料") &&
    !/^D:\\game_timer/i.test(info.source),
    info.source);

  const detail = await evaluate(`
    const el = document.querySelector('.ghost[data-name="达彦"]');
    el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }));
    await new Promise(r => setTimeout(r, 600));
    return {
      title: document.getElementById('detailTitle').textContent,
      fields: document.querySelectorAll('#detailBody .detail-field').length,
      text: document.getElementById('detailBody').innerText
    };
  `);
  check("right-click detail opens", detail.title === "达彦" && detail.fields > 0,
    JSON.stringify({ title: detail.title, fields: detail.fields }));
  check("detail contains 达彦 data", detail.text.includes("特殊加速"), detail.text.slice(0, 80));

  await evaluate(`setTimeout(() => window.pywebview.api.close(), 200); return true;`);
  for (let i = 0; i < 40 && child.exitCode === null; i++) await sleep(250);
} catch (err) {
  console.error("SMOKE ERROR:", err.message);
  failures++;
} finally {
  if (child.exitCode === null) killTree();
}

const log = newLog();
if (log) {
  console.log("--- 打包版新增日志 ---");
  console.log(log.slice(-4000));
}
check("no WebView2 initialization error",
  !/WebView2 initialization failed|fatal error|startup imports failed/i.test(log),
  log.slice(-600));
check("clean startup logged", /starting journal/.test(log), log.slice(-300));
check("clean shutdown logged", /journal stopped/.test(log), log.slice(-300));

if (failures) {
  console.error(`\n${failures} FAILURE(S)`);
  process.exit(1);
}
console.log("\nALL PASS");
