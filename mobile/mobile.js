/* 恐鬼症笔记 · 手机版
   四页横滑：证据 → 鬼魂 → 诅咒之物 → 通用规则
   EVIDENCE / GHOSTS 与桌面版 app.js 保持一致，改一边记得同步另一边。 */
(() => {
  "use strict";

  const EVIDENCE = [
    { key: "EMF5",    name: "EMF 5级",    desc: "使用EMF读数器获得5级读数" },
    { key: "DOTS",    name: "点阵投影仪", desc: "在D.O.T.S投影灯光中目击幽灵干扰" },
    { key: "UV",      name: "紫外线",     desc: "使用紫外线灯发现指纹、手印或脚印" },
    { key: "FREEZE",  name: "刺骨寒温",   desc: "用温度计读取到低于0°C/32°F的温度" },
    { key: "ORB",     name: "灵球",       desc: "在视频中看到漂浮的灵球" },
    { key: "WRITING", name: "鬼魂笔迹",   desc: "让幽灵在放置下来的灵写本上书写" },
    { key: "BOX",     name: "通灵盒",     desc: "在询问幽灵后，通过灵魂盒听到回应" }
  ];

  const GHOSTS = [
    { name: "阿斯旺", ev: ["DOTS", "FREEZE", "WRITING"] },
    { name: "界灵",   ev: ["EMF5", "WRITING", "DOTS"] },
    { name: "加鲁",   ev: ["EMF5", "UV", "BOX"] },
    { name: "巨灵",   ev: ["EMF5", "UV", "FREEZE"] },
    { name: "魔洛伊", ev: ["BOX", "WRITING", "FREEZE"] },
    { name: "奥班博", ev: ["WRITING", "UV", "DOTS"] },
    { name: "幻影",   ev: ["BOX", "UV", "DOTS"] },
    { name: "亡魂",   ev: ["ORB", "WRITING", "FREEZE"] },
    { name: "刹耶",   ev: ["ORB", "WRITING", "DOTS"] },
    { name: "魅影",   ev: ["EMF5", "BOX", "DOTS"] },
    { name: "女妖",   ev: ["DOTS", "UV", "ORB"] },
    { name: "恶魔",   ev: ["UV", "WRITING", "FREEZE"] },
    { name: "御灵",   ev: ["EMF5", "DOTS", "UV"] },
    { name: "盲灵",   ev: ["ORB", "BOX", "UV"] },
    { name: "鬼婴",   ev: ["EMF5", "UV", "WRITING"] },
    { name: "赤鬼",   ev: ["EMF5", "FREEZE", "DOTS"] },
    { name: "捣蛋鬼", ev: ["BOX", "UV", "WRITING"] },
    { name: "暗影",   ev: ["EMF5", "WRITING", "FREEZE"] },
    { name: "拟魂",   ev: ["BOX", "UV", "FREEZE"] },
    { name: "妖怪",   ev: ["BOX", "ORB", "DOTS"] },
    { name: "达彦",   ev: ["EMF5", "ORB", "BOX"] },
    { name: "雾影",   ev: ["BOX", "WRITING", "DOTS"] },
    { name: "寒魔",   ev: ["UV", "ORB", "FREEZE"] },
    { name: "梦魇",   ev: ["BOX", "ORB", "WRITING"] },
    { name: "幻妖",   ev: ["EMF5", "UV", "ORB"] },
    { name: "怨灵",   ev: ["BOX", "ORB", "FREEZE"] },
    { name: "雷兽",   ev: ["EMF5", "ORB", "DOTS"] },
    { name: "魂魄",   ev: ["EMF5", "WRITING", "BOX"] },
    { name: "孪魂",   ev: ["EMF5", "BOX", "FREEZE"] },
    { name: "幽灵",   ev: ["ORB", "FREEZE", "DOTS"] }
  ];

  const GHOST_MD_ALIASES = { "捣蛋鬼": "骚灵", "雷兽": "雷魂" };

  const PAGE_NAMES = ["证据", "鬼魂", "诅咒之物"];

  let ghostInfo = window.GHOST_INFO_FALLBACK || null;

  const $ = id => document.getElementById(id);
  const evidenceList = $("evidenceList");
  const ghostGrid = $("ghostGrid");
  const cursedNames = $("cursedNames");
  const pager = $("pager");
  const hintLeft = $("hintLeft");
  const hintRight = $("hintRight");
  const labelLeft = $("labelLeft");
  const labelRight = $("labelRight");

  const ghostSheet = $("ghostSheet");
  const sheetTitle = $("sheetTitle");
  const sheetEn = $("sheetEn");
  const sheetBody = $("sheetBody");
  const cursedSheet = $("cursedSheet");
  const cursedSheetTitle = $("cursedSheetTitle");
  const cursedSheetEn = $("cursedSheetEn");
  const cursedSheetBody = $("cursedSheetBody");

  /* ---------------- 建界面 ---------------- */
  const evState = new Map();
  EVIDENCE.forEach(item => {
    const li = document.createElement("li");
    li.className = "evidence";
    li.dataset.key = item.key;

    const box = document.createElement("span");
    box.className = "ev-box";
    const name = document.createElement("span");
    name.className = "ev-name";
    name.textContent = item.name;

    li.appendChild(box);
    li.appendChild(name);
    li.addEventListener("click", () => clickEvidence(item.key));
    item.el = li;
    evidenceList.appendChild(li);
  });

  GHOSTS.forEach(g => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ghost";
    btn.textContent = g.name;
    bindGhost(btn, g);
    g.el = btn;
    ghostGrid.appendChild(btn);
  });

  function bindGhost(btn, g) {
    let timer = null;
    let longPressed = false;
    let startX = 0, startY = 0;

    btn.addEventListener("touchstart", ev => {
      const t = ev.touches[0];
      startX = t.clientX; startY = t.clientY;
      longPressed = false;
      timer = setTimeout(() => {
        longPressed = true;
        openGhostSheet(g.name);
      }, 480);
    }, { passive: true });

    btn.addEventListener("touchmove", ev => {
      const t = ev.touches[0];
      if (Math.abs(t.clientX - startX) > 12 || Math.abs(t.clientY - startY) > 12) {
        clearTimeout(timer);
      }
    }, { passive: true });

    btn.addEventListener("touchend", () => {
      clearTimeout(timer);
    }, { passive: true });

    btn.addEventListener("click", () => {
      if (longPressed) { longPressed = false; return; }
      clickGhost(g);
    });
  }

  /* ---------------- 证据 ---------------- */
  function clickEvidence(key) {
    const state = evState.get(key) || "normal";
    const next = state === "normal" ? "checked" : (state === "checked" ? "crossed" : "normal");
    evState.set(key, next);
    const item = EVIDENCE.find(x => x.key === key);
    item.el.classList.toggle("checked", next === "checked");
    item.el.classList.toggle("crossed", next === "crossed");
    applyFilter();
  }

  function applyFilter() {
    const checked = [], crossed = [];
    evState.forEach((state, key) => {
      if (state === "checked") checked.push(key);
      else if (state === "crossed") crossed.push(key);
    });
    GHOSTS.forEach(g => {
      const faded =
        checked.some(key => !g.ev.includes(key)) ||
        crossed.some(key => g.ev.includes(key));
      g.el.classList.toggle("faded", faded);
    });
  }

  /* ---------------- 鬼名 ---------------- */
  let selectedName = null;
  const crossedGhosts = new Set();

  function clickGhost(g) {
    if (selectedName === g.name) {
      selectedName = null;
      crossedGhosts.add(g.name);
    } else if (crossedGhosts.has(g.name)) {
      crossedGhosts.delete(g.name);
    } else {
      selectedName = g.name;
    }
    GHOSTS.forEach(x => {
      x.el.classList.toggle("selected", x.name === selectedName);
      x.el.classList.toggle("crossed", crossedGhosts.has(x.name));
    });
    applyEvidenceDim();
  }

  /* ---------------- 重置（证据页右下角） ---------------- */
  function resetAll() {
    EVIDENCE.forEach(item => {
      evState.set(item.key, "normal");
      item.el.classList.remove("checked", "crossed");
    });
    crossedGhosts.clear();
    selectedName = null;
    GHOSTS.forEach(x => {
      x.el.classList.remove("selected", "crossed");
    });
    applyFilter();
    applyEvidenceDim();
  }

  $("resetBtn").addEventListener("click", resetAll);

  /* 选中某只鬼时，证据页里不属于它的那几条变淡 */
  function applyEvidenceDim() {
    const g = selectedName ? GHOSTS.find(x => x.name === selectedName) : null;
    const owned = g ? new Set(g.ev) : null;
    EVIDENCE.forEach(item => {
      item.el.classList.toggle("dim", !!owned && !owned.has(item.key));
    });
  }

  /* ---------------- 资料渲染 ---------------- */
  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
  }

  function mdInline(text) {
    return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  }

  function findGhostSection(name) {
    if (!ghostInfo || !Array.isArray(ghostInfo.ghosts)) return null;
    const targets = [GHOST_MD_ALIASES[name], name].filter(Boolean);
    for (const target of targets) {
      const hit = ghostInfo.ghosts.find(g => g.name === target);
      if (hit) return hit;
    }
    return ghostInfo.ghosts.find(g => g.alias && g.alias.includes(name)) || null;
  }

  function renderFields(container, section) {
    container.innerHTML = "";
    if (!section || !Array.isArray(section.fields) || !section.fields.length) {
      const p = document.createElement("p");
      p.className = "detail-empty";
      p.textContent = "资料里没有找到这一节的正文。";
      container.appendChild(p);
      return;
    }
    section.fields.forEach(field => {
      if (field.label) {
        const h = document.createElement("h3");
        h.textContent = field.label;
        container.appendChild(h);
      }
      if (field.text) {
        const p = document.createElement("p");
        p.innerHTML = mdInline(field.text);
        container.appendChild(p);
      }
    });
  }

  function openGhostSheet(name) {
    const section = findGhostSection(name);
    sheetTitle.textContent = name;
    sheetEn.textContent = section && section.english ? section.english : "";
    renderFields(sheetBody, section);
    sheetBody.scrollTop = 0;
    ghostSheet.classList.add("open");
    ghostSheet.setAttribute("aria-hidden", "false");
  }

  function closeGhostSheet() {
    ghostSheet.classList.remove("open");
    ghostSheet.setAttribute("aria-hidden", "true");
  }

  function openCursedSheet(name) {
    const item = ghostInfo && Array.isArray(ghostInfo.cursed)
      ? ghostInfo.cursed.find(c => c.name === name)
      : null;
    cursedSheetTitle.textContent = name;
    cursedSheetEn.textContent = item && item.english ? item.english : "";
    renderFields(cursedSheetBody, item);
    cursedSheetBody.scrollTop = 0;
    cursedSheet.classList.add("open");
    cursedSheet.setAttribute("aria-hidden", "false");
  }

  function closeCursedSheet() {
    cursedSheet.classList.remove("open");
    cursedSheet.setAttribute("aria-hidden", "true");
  }

  $("sheetBack").addEventListener("click", closeGhostSheet);
  $("cursedSheetBack").addEventListener("click", closeCursedSheet);
  ghostSheet.addEventListener("click", ev => { if (ev.target === ghostSheet) closeGhostSheet(); });
  cursedSheet.addEventListener("click", ev => { if (ev.target === cursedSheet) closeCursedSheet(); });

  /* ---------------- 诅咒之物 ---------------- */
  const cursedItems = ghostInfo && Array.isArray(ghostInfo.cursed) ? ghostInfo.cursed : [];
  cursedItems.forEach(item => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cursed-name";
    btn.textContent = item.name;
    btn.addEventListener("click", () => openCursedSheet(item.name));
    cursedNames.appendChild(btn);
  });

  /* ---------------- 通用规则：整页，从底部翻上来 ---------------- */
  const drawer = $("rulesSheet");
  const drawerBackdrop = $("rulesBackdrop");
  const drawerTitle = $("rulesSheetTitle");
  const drawerEn = $("rulesSheetEn");
  const drawerBody = $("rulesSheetBody");

  const PULL_OPEN_PX = 110;    // 拉过这么多就留下，否则弹回去

  let drawerKind = null;       // 当前装的是哪一套规则
  let drawerIsOpen = false;
  let drawerHeight = 1;        // 整页高度

  /* 规则正文先拼成字符串缓起来，翻页时只换一次 innerHTML，不再边动画边建节点 */
  const rulesHTML = {};

  function buildRules(kind) {
    if (rulesHTML[kind]) return rulesHTML[kind];
    const isGhost = kind === "ghost";
    const lines = ghostInfo && Array.isArray(isGhost ? ghostInfo.common : ghostInfo.cursed_common)
      ? (isGhost ? ghostInfo.common : ghostInfo.cursed_common)
      : [];
    rulesHTML[kind] = lines.length
      ? lines.map(line => "<p>" + mdInline(line) + "</p>").join("")
      : '<p class="detail-empty">资料里没有这一节的通用规则。</p>';
    return rulesHTML[kind];
  }

  function fillDrawer(kind) {
    if (drawerKind === kind) return;
    const isGhost = kind === "ghost";
    drawerTitle.textContent = isGhost ? "鬼魂通用规则" : "诅咒物通用规则";
    drawerEn.textContent = isGhost ? "Ghost Rules" : "Cursed Possessions";
    drawerBody.innerHTML = buildRules(kind);
    drawerBody.scrollTop = 0;
    drawerKind = kind;
  }

  /* 开局偷偷把两套规则都排版一次：第一次上拉时不再现场计算布局，避免起手卡一下 */
  function warmDrawer() {
    ["ghost", "cursed"].forEach(kind => {
      fillDrawer(kind);
      void drawer.offsetHeight;   // 强制排版
    });
    fillDrawer("ghost");
  }

  /* 拖动中用：p = 0 完全在屏幕下方，1 完全盖住 */
  function drawerProgress(p) {
    drawer.style.transform = `translateY(${drawerHeight * (1 - p)}px)`;
    drawerBackdrop.style.opacity = String(p);
    drawerBackdrop.style.pointerEvents = p > 0.02 ? "auto" : "none";
  }

  function drawerPrepare(kind) {
    fillDrawer(kind);
    drawer.classList.add("dragging");
    drawerHeight = drawer.offsetHeight || 600;
    drawerProgress(0);
    return drawerHeight;
  }

  function drawerOpen(kind) {
    fillDrawer(kind);
    drawer.classList.remove("dragging");
    drawer.classList.add("open");
    drawer.style.transform = "";          // 交给 .open 的 translateY(0)
    drawerBackdrop.classList.add("open");
    drawerBackdrop.style.opacity = "";
    drawerBackdrop.style.pointerEvents = "";
    drawerIsOpen = true;
    drawer.setAttribute("aria-hidden", "false");
  }

  function drawerClose() {
    drawer.classList.remove("dragging", "open");
    drawer.style.transform = "";          // 回到 CSS 的 translateY(100%)
    drawerBackdrop.classList.remove("open");
    drawerBackdrop.style.opacity = "0";
    drawerBackdrop.style.pointerEvents = "none";
    drawerIsOpen = false;
    drawer.setAttribute("aria-hidden", "true");
    drawerKind = null;
  }

  $("rulesSheetBack").addEventListener("click", drawerClose);
  drawerBackdrop.addEventListener("click", drawerClose);

  /* 往上拉就升起抽屉：底部整条区域随时可用，页面滚到底时整页也能起手 */
  function makePuller(el, kind, canStart) {
    let startX = 0;
    let startY = 0;
    let mode = 0;         // 0 待定，1 正在拉，-1 本次不管
    let progress = 0;

    function begin(x, y) {
      startX = x;
      startY = y;
      progress = 0;
      mode = canStart() ? 0 : -1;
    }

    function move(x, y) {
      if (mode === -1) return;
      const dx = x - startX;
      const dy = startY - y;            // 往上拉为正
      if (mode === 0) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if (dy <= 0 || Math.abs(dy) < Math.abs(dx) * 1.2) { mode = -1; return; }
        drawerPrepare(kind);
        mode = 1;
      }
      progress = Math.max(0, Math.min(1, dy / drawerHeight));
      drawerProgress(progress);
    }

    function end() {
      if (mode !== 1) { mode = 0; return; }
      mode = 0;
      if (progress * drawerHeight >= PULL_OPEN_PX) drawerOpen(kind);
      else drawerClose();
    }

    el.addEventListener("touchstart", ev => {
      if (ev.touches.length === 1) begin(ev.touches[0].clientX, ev.touches[0].clientY);
    }, { passive: true });
    el.addEventListener("touchmove", ev => {
      if (ev.touches.length !== 1) return;
      move(ev.touches[0].clientX, ev.touches[0].clientY);
      // 一旦开始上拉就吃掉事件，防止浏览器把它当成滚动而 touchcancel
      if (mode === 1 && ev.cancelable) ev.preventDefault();
    }, { passive: false });
    el.addEventListener("touchend", end, { passive: true });
    el.addEventListener("touchcancel", end, { passive: true });

    if (!("ontouchstart" in window)) {
      el.addEventListener("mousedown", ev => { if (ev.button === 0) begin(ev.clientX, ev.clientY); });
      el.addEventListener("mousemove", ev => move(ev.clientX, ev.clientY));
      window.addEventListener("mouseup", end);
    }
  }

  // 滚到底（或者本来就滚不动）才算「拉」，否则上滑要留给列表滚动
  function atBottom(el) {
    return el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
  }

  ["ghost", "cursed"].forEach(kind => {
    const zone = $(kind + "Zone");
    const scroll = $(kind + "Scroll");
    makePuller(zone, kind, () => true);
    makePuller(scroll, kind, () => atBottom(scroll));
  });

  /* 整页任何地方往下拖都能收回去；正文滚到顶时才算，否则下滑留给正文滚动 */
  (() => {
    let startX = 0;
    let startY = 0;
    let mode = 0;        // 0 待定，1 正在收，-1 本次不管
    let progress = 1;

    function canStart(ev) {
      if (!drawerIsOpen) return false;
      const body = ev.target && ev.target.closest ? ev.target.closest(".sheet-body") : null;
      return !body || body.scrollTop <= 2;
    }

    function begin(x, y, ev) {
      if (!canStart(ev)) { mode = -1; return; }
      startX = x;
      startY = y;
      mode = 0;
      progress = 1;
    }

    function move(x, y) {
      if (mode === -1) return;
      const dx = x - startX;
      const dy = y - startY;          // 往下拖为正
      if (mode === 0) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if (dy <= 0 || Math.abs(dy) < Math.abs(dx) * 1.2) { mode = -1; return; }
        drawerHeight = drawer.offsetHeight || drawerHeight;
        drawer.classList.add("dragging");
        mode = 1;
      }
      progress = Math.max(0, Math.min(1, 1 - dy / drawerHeight));
      drawerProgress(progress);
    }

    function end() {
      if (mode !== 1) { mode = 0; return; }
      mode = 0;
      drawer.classList.remove("dragging");
      if ((1 - progress) * drawerHeight >= PULL_OPEN_PX) drawerClose();
      else drawerOpen(drawerKind);
    }

    drawer.addEventListener("touchstart", ev => {
      if (ev.touches.length === 1) begin(ev.touches[0].clientX, ev.touches[0].clientY, ev);
    }, { passive: true });
    drawer.addEventListener("touchmove", ev => {
      if (ev.touches.length !== 1) return;
      move(ev.touches[0].clientX, ev.touches[0].clientY);
      if (mode === 1 && ev.cancelable) ev.preventDefault();
    }, { passive: false });
    drawer.addEventListener("touchend", end, { passive: true });
    drawer.addEventListener("touchcancel", end, { passive: true });

    if (!("ontouchstart" in window)) {
      drawer.addEventListener("mousedown", ev => {
        if (ev.button === 0) begin(ev.clientX, ev.clientY, ev);
      });
      drawer.addEventListener("mousemove", ev => move(ev.clientX, ev.clientY));
      window.addEventListener("mouseup", end);
    }
  })();

  /* ---------------- 翻页 ---------------- */
  let page = 0;
  const LAST = PAGE_NAMES.length - 1;

  function applyPage(animate = true) {
    pager.classList.toggle("dragging", !animate);
    pager.style.transform = `translateX(${-page * 100}%)`;
    if (!animate) {
      void pager.offsetWidth;
      pager.classList.remove("dragging");
    }

    labelLeft.textContent = page > 0 ? PAGE_NAMES[page - 1] : "";
    labelRight.textContent = page < LAST ? PAGE_NAMES[page + 1] : "";
    hintLeft.classList.toggle("show", page > 0);
    hintRight.classList.toggle("show", page < LAST);
  }

  function goTo(next) {
    const clamped = Math.max(0, Math.min(LAST, next));
    if (clamped === page) {
      applyPage(true);   // 已经在头/尾，把拖出来的偏移弹回去
      return;
    }
    page = clamped;
    applyPage(true);
  }

  hintLeft.addEventListener("click", () => goTo(page - 1));
  hintRight.addEventListener("click", () => goTo(page + 1));

  /* 横向滑动：触摸和鼠标共用一套判定（电脑上也能按住拖动） */
  let dragStartX = 0, dragStartY = 0, dragging = false, decided = false, active = false;
  const pagerWidth = () => pager.getBoundingClientRect().width;

  function dragStart(x, y) {
    dragStartX = x;
    dragStartY = y;
    active = true;
    dragging = false;
    decided = false;
  }

  function dragMove(x, y) {
    if (!active) return;
    let dx = x - dragStartX;
    const dy = y - dragStartY;

    if (!decided) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      decided = true;
      dragging = Math.abs(dx) > Math.abs(dy) * 1.2;
      pager.classList.toggle("dragging", dragging);
    }
    if (!dragging) return;

    // 到头了加阻尼
    if ((page === 0 && dx > 0) || (page === LAST && dx < 0)) dx *= 0.35;
    pager.style.transform = `translateX(calc(${-page * 100}% + ${dx}px))`;
  }

  function dragEnd(x) {
    if (!active) return;
    active = false;
    if (!dragging) {
      if (decided) applyPage(true);
      return;
    }
    const dx = x - dragStartX;
    pager.classList.remove("dragging");
    dragging = false;
    const threshold = Math.min(90, pagerWidth() * 0.22);
    if (dx <= -threshold) goTo(page + 1);
    else if (dx >= threshold) goTo(page - 1);
    else applyPage(true);
  }

  pager.addEventListener("touchstart", ev => {
    if (ev.touches.length !== 1) return;
    dragStart(ev.touches[0].clientX, ev.touches[0].clientY);
  }, { passive: true });

  pager.addEventListener("touchmove", ev => {
    if (ev.touches.length !== 1) return;
    dragMove(ev.touches[0].clientX, ev.touches[0].clientY);
  }, { passive: true });

  pager.addEventListener("touchend", ev => {
    dragEnd(ev.changedTouches[0].clientX);
  }, { passive: true });

  pager.addEventListener("touchcancel", () => {
    active = false;
    if (dragging) { dragging = false; applyPage(true); }
  }, { passive: true });

  // 没有触摸的电脑上，用鼠标按住拖也能翻页
  if (!("ontouchstart" in window)) {
    pager.addEventListener("mousedown", ev => {
      if (ev.button !== 0) return;
      dragStart(ev.clientX, ev.clientY);
    });
    window.addEventListener("mousemove", ev => dragMove(ev.clientX, ev.clientY));
    window.addEventListener("mouseup", ev => dragEnd(ev.clientX));
    document.body.classList.add("no-touch");
  }

  /* ---------------- 安卓返回键 ---------------- */
  window.__onBack = () => {
    if (drawerIsOpen) { drawerClose(); return "handled"; }
    if (ghostSheet.classList.contains("open")) { closeGhostSheet(); return "handled"; }
    if (cursedSheet.classList.contains("open")) { closeCursedSheet(); return "handled"; }
    if (page > 0) { goTo(page - 1); return "handled"; }
    return "exit";
  };

  applyPage(false);
  setTimeout(warmDrawer, 60);
})();
