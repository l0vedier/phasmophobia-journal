(() => {
  "use strict";

  /* ---- 数据：证据顺序与游戏日志一致 ---- */
  const EVIDENCE = [
    { key: "EMF5",    name: "EMF 5级",    desc: "使用EMF读数器获得5级读数" },
    { key: "DOTS",    name: "点阵投影仪", desc: "在D.O.T.S投影灯光中目击幽灵干扰" },
    { key: "UV",      name: "紫外线",     desc: "使用紫外线灯发现指纹、手印或脚印" },
    { key: "FREEZE",  name: "刺骨寒温",   desc: "用温度计读取到低于0°C/32°F的温度" },
    { key: "ORB",     name: "灵球",       desc: "在视频中看到漂浮的灵球（通过摄像机、视频信号或头戴设备）" },
    { key: "WRITING", name: "鬼魂笔迹",   desc: "让幽灵在放置下来的灵写本上书写" },
    { key: "BOX",     name: "通灵盒",     desc: "在询问幽灵后，通过灵魂盒听到回应" }
  ];

  /* ---- 数据：30 只鬼，按日志右页的列优先顺序排列 ---- */
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

  /* ---- 资料里几个名字和游戏界面不同，按这张表找章节 ---- */
  const GHOST_MD_ALIASES = {
    "捣蛋鬼": "骚灵",
    "雷兽": "雷魂"
  };

  const evidenceList = document.getElementById("evidenceList");
  const ghostGrid = document.getElementById("ghostGrid");
  const ghostArea = document.getElementById("ghostArea");
  const circleLayer = document.getElementById("circleLayer");
  const resetBtn = document.getElementById("resetBtn");
  const book = document.getElementById("book");
  const pageLeft = document.getElementById("pageLeft");
  const pageRight = document.getElementById("pageRight");
  const commonBody = document.getElementById("commonBody");
  const ghostDetail = document.getElementById("ghostDetail");
  const detailBack = document.getElementById("detailBack");
  const detailTitle = document.getElementById("detailTitle");
  const detailSub = document.getElementById("detailSub");
  const detailSubText = document.getElementById("detailSubText");
  const detailEn = document.getElementById("detailEn");
  const detailBody = document.getElementById("detailBody");

  const ghostNextBtn = document.getElementById("ghostNextBtn");
  const cursedBody = document.getElementById("cursedBody");
  const cursedBack = document.getElementById("cursedBack");
  const cursedNames = document.getElementById("cursedNames");
  const cursedDetailBack = document.getElementById("cursedDetailBack");
  const cursedDetailTitle = document.getElementById("cursedDetailTitle");
  const cursedDetailSub = document.getElementById("cursedDetailSub");
  const cursedDetailBody = document.getElementById("cursedDetailBody");

  /* 无头布局测试用 ?noflip=1 跳过翻页动画，避免页面快照影响全局选择器。 */
  const NO_FLIP = (() => {
    try {
      return new URLSearchParams(window.location.search).has("noflip");
    } catch {
      return false;
    }
  })();

  const evState = new Map();        // 证据：key -> "normal" | "checked" | "crossed"
  const crossedGhosts = new Set();  // 手动划除的鬼名
  let selectedName = "魂魄";        // 圈住的鬼名，同时只能有一个
  let drawnName = null;             // 当前画着圈的鬼名，避免重复重画
  let hoverGhostEl = null;
  let fontsReady = false;
  let detailOpen = false;
  let detailName = null;
  let flipping = false;
  let cursedView = null;        // null | "list" | "detail"
  let cursedDetailName = null;
  let fading = false;           // 右页淡出/淡入期间挡住点击
  let ghostInfo = window.GHOST_INFO_FALLBACK || null;
  let ghostInfoFresh = false;
  let ghostInfoPromise = null;
  let ghostInfoError = null;

  /* ---------- 建界面 ---------- */
  EVIDENCE.forEach(item => {
    const li = document.createElement("li");
    li.className = "ev";
    li.dataset.key = item.key;
    li.setAttribute("role", "checkbox");
    li.setAttribute("aria-checked", "false");
    li.tabIndex = 0;

    const box = document.createElement("span");
    box.className = "box";
    box.setAttribute("aria-hidden", "true");
    const tick = document.createElement("span");
    tick.className = "tick";
    box.appendChild(tick);

    const copy = document.createElement("span");
    copy.className = "ev-copy";
    const name = document.createElement("span");
    name.className = "ev-name";
    name.textContent = item.name;
    const desc = document.createElement("span");
    desc.className = "ev-desc";
    desc.textContent = item.desc;
    copy.appendChild(name);
    copy.appendChild(desc);

    li.appendChild(box);
    li.appendChild(copy);

    li.addEventListener("click", () => clickEvidence(item.key));
    li.addEventListener("keydown", ev => {
      if (ev.key === " " || ev.key === "Enter") {
        ev.preventDefault();
        clickEvidence(item.key);
      }
    });

    evidenceList.appendChild(li);
    item.el = li;
    evState.set(item.key, "normal");
  });

  GHOSTS.forEach(g => {
    const span = document.createElement("span");
    span.className = "ghost";
    span.dataset.name = g.name;
    span.textContent = g.name;
    span.title = "左键圈选/划除 · 右键查看资料";
    span.addEventListener("click", () => clickGhost(g));
    ghostGrid.appendChild(span);
    g.el = span;
  });

  /* ---------- 证据：勾选 → 划除 → 取消划除 ---------- */
  function clickEvidence(key) {
    if (flipping) return;
    const item = EVIDENCE.find(x => x.key === key);
    if (!item) return;

    const state = evState.get(key) || "normal";
    const next = state === "normal" ? "checked" : (state === "checked" ? "crossed" : "normal");

    evState.set(key, next);
    item.el.classList.toggle("checked", next === "checked");
    item.el.classList.toggle("crossed", next === "crossed");
    item.el.setAttribute("aria-checked", next === "checked" ? "true" : "false");
    applyEvidenceFilter();
  }

  /* 勾选 = 必须有这条证据；划除 = 必须没有这条证据（拥有它的鬼淡出） */
  function applyEvidenceFilter() {
    const checkedKeys = [];
    const crossedKeys = [];
    evState.forEach((state, key) => {
      if (state === "checked") checkedKeys.push(key);
      else if (state === "crossed") crossedKeys.push(key);
    });

    GHOSTS.forEach(g => {
      const faded =
        checkedKeys.some(key => !g.ev.includes(key)) ||
        crossedKeys.some(key => g.ev.includes(key));
      g.el.classList.toggle("faded", faded);
    });
    updateCircleFade();
  }

  function updateCircleFade() {
    const g = selectedName ? GHOSTS.find(x => x.name === selectedName) : null;
    circleLayer.classList.toggle("faded", !!(g && g.el.classList.contains("faded")));
  }

  /* ---------- 鬼名：圈住（唯一）→ 划除 → 取消划除 ---------- */
  function clickGhost(g) {
    if (flipping) return;
    if (selectedName === g.name) {
      // 圈住的鬼再点：划除，圈消失
      selectedName = null;
      crossedGhosts.add(g.name);
    } else if (crossedGhosts.has(g.name)) {
      // 划除的鬼再点：取消划除，不影响当前圈
      crossedGhosts.delete(g.name);
    } else {
      // 普通鬼：圈住它，原来的圈自动消失（同时只能圈一个）
      selectedName = g.name;
    }
    applyGhostStates();
  }

  function applyGhostStates() {
    GHOSTS.forEach(g => {
      g.el.classList.toggle("selected", g.name === selectedName);
      g.el.classList.toggle("crossed", crossedGhosts.has(g.name));
    });
    syncCircle();
    updateCircleFade();
  }

  /* ---------- 悬浮鬼名：除它拥有的证据外全部淡出 ---------- */
  function applyEvidenceHover(g) {
    const owned = new Set(g.ev);
    EVIDENCE.forEach(item => {
      item.el.classList.toggle("dim", !owned.has(item.key));
    });
  }

  function clearEvidenceHover() {
    EVIDENCE.forEach(item => item.el.classList.remove("dim"));
  }

  ghostGrid.addEventListener("mouseover", ev => {
    const el = ev.target.closest ? ev.target.closest(".ghost") : null;
    if (!el || el === hoverGhostEl) return;
    hoverGhostEl = el;
    const g = GHOSTS.find(x => x.el === el);
    if (g) applyEvidenceHover(g);
  });

  ghostGrid.addEventListener("mouseout", ev => {
    const el = ev.target.closest ? ev.target.closest(".ghost") : null;
    if (!el) return;
    const to = ev.relatedTarget && ev.relatedTarget.closest
      ? ev.relatedTarget.closest(".ghost")
      : null;
    if (!to) {
      hoverGhostEl = null;
      clearEvidenceHover();
    }
  });

  window.addEventListener("blur", () => {
    hoverGhostEl = null;
    clearEvidenceHover();
  });

  /* ---------- 鬼魂资料：右键鬼名，只替换右页 ---------- */
  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, ch => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[ch]));
  }

  /* 资料里的行内 **粗体**：先转义，再还原 <strong> */
  function mdInline(text) {
    return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  }

  function resetCommonScroll() {
    // 通用规则面板隐藏时设置 scrollTop 不生效；等左页真正显示后再归零，
    // 并在下一帧补一次，避免浏览器恢复上一次的滚动位置。
    commonBody.scrollTop = 0;
    requestAnimationFrame(() => {
      if (detailOpen) commonBody.scrollTop = 0;
    });
  }

  /* 通用规则放在左页；鬼名详情只占右页。 */
  function renderCommonRules() {
    commonBody.innerHTML = "";
    const common = ghostInfo && Array.isArray(ghostInfo.common) ? ghostInfo.common : [];

    if (!common.length) {
      const p = document.createElement("p");
      p.className = "common-empty";
      if (!ghostInfo) {
        p.textContent = ghostInfoError
          ? "通用规则读取失败：" + ghostInfoError
          : "正在读取通用规则…";
      } else if (ghostInfoError) {
        p.textContent = "通用规则读取失败：" + ghostInfoError;
      } else {
        p.textContent = "资料里没有通用规则。";
      }
      commonBody.appendChild(p);
      return;
    }

    common.forEach(line => {
      const p = document.createElement("p");
      p.innerHTML = mdInline(line);
      commonBody.appendChild(p);
    });
  }

  /* 诅咒之物左页：通用规则（来自 md 的 `### 通用规则`） */
  function renderCursedRules() {
    cursedBody.innerHTML = "";
    const common = ghostInfo && Array.isArray(ghostInfo.cursed_common)
      ? ghostInfo.cursed_common
      : [];

    if (!common.length) {
      const p = document.createElement("p");
      p.className = "common-empty";
      if (!ghostInfo) {
        p.textContent = ghostInfoError
          ? "诅咒之物读取失败：" + ghostInfoError
          : "正在读取诅咒之物…";
      } else if (ghostInfoError) {
        p.textContent = "诅咒之物读取失败：" + ghostInfoError;
      } else {
        p.textContent = "资料里没有诅咒之物的通用规则。";
      }
      cursedBody.appendChild(p);
      return;
    }

    common.forEach(line => {
      const p = document.createElement("p");
      p.innerHTML = mdInline(line);
      cursedBody.appendChild(p);
    });
  }

  /* 诅咒之物右页：七件物品的名字，点击后淡出换成介绍 */
  function renderCursedNames() {
    cursedNames.innerHTML = "";
    const items = ghostInfo && Array.isArray(ghostInfo.cursed)
      ? ghostInfo.cursed
      : [];

    if (!items.length) {
      const p = document.createElement("p");
      p.className = "common-empty";
      if (!ghostInfo) {
        p.textContent = ghostInfoError
          ? "诅咒之物读取失败：" + ghostInfoError
          : "正在读取诅咒之物…";
      } else if (ghostInfoError) {
        p.textContent = "诅咒之物读取失败：" + ghostInfoError;
      } else {
        p.textContent = "资料里没有诅咒之物。";
      }
      cursedNames.appendChild(p);
      return;
    }

    items.forEach(item => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cursed-name";
      btn.dataset.name = item.name;
      btn.textContent = item.name;
      btn.title = item.english ? item.name + " " + item.english : "查看介绍";
      btn.addEventListener("click", () => openCursedDetail(item.name));
      cursedNames.appendChild(btn);
    });
  }

  function refreshLoadedInfo() {
    renderCommonRules();
    renderCursedRules();
    renderCursedNames();
    if (detailOpen && detailName) renderGhostDetail(detailName, true);
    if (cursedView === "detail" && cursedDetailName) {
      renderCursedDetail(cursedDetailName, true);
    }
  }

  function reducedMotion() {
    return !!(window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  /* 页面快照只用来翻页：去掉 id 和可聚焦属性，避免和真实界面抢选择器。 */
  function prepareFlipPage(page) {
    page.removeAttribute("id");
    page.querySelectorAll("[id]").forEach(el => el.removeAttribute("id"));
    page.querySelectorAll("[tabindex]").forEach(el => el.setAttribute("tabindex", "-1"));
    page.querySelectorAll("button, a, input, select, textarea").forEach(el => {
      el.tabIndex = -1;
    });
    page.setAttribute("aria-hidden", "true");
    page.classList.add("flip-page");
    return page;
  }

  function startFlip(direction, frontPage, backPage, scrollTop, onFinish,
                     scrollSelector = ".common-body") {
    const sheet = document.createElement("div");
    sheet.className = "page-flip " + direction;
    sheet.setAttribute("aria-hidden", "true");

    const front = document.createElement("div");
    front.className = "flip-face front";
    front.appendChild(frontPage);

    const back = document.createElement("div");
    back.className = "flip-face back";
    back.appendChild(backPage);

    sheet.appendChild(front);
    sheet.appendChild(back);
    book.appendChild(sheet);

    const panel = sheet.querySelector(
      ".flip-face." + (direction === "forward" ? "back" : "front") + " " + scrollSelector
    );
    if (panel) panel.scrollTop = scrollTop || 0;

    flipping = true;
    void sheet.offsetWidth;
    // 等快照先完成一次栅格化再开始旋转：否则动画前几帧要边转边画整页，
    // 核显上会明显卡一下。多等一帧，换整段翻页顺滑。
    requestAnimationFrame(() => {
      requestAnimationFrame(() => sheet.classList.add("go"));
    });

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      sheet.remove();
      flipping = false;
      if (onFinish) onFinish();
    };

    sheet.addEventListener("transitionend", ev => {
      if (ev.target === sheet && ev.propertyName === "transform") finish();
    });
    setTimeout(finish, 900);
  }

  function apiReady() {
    return !!(window.pywebview && window.pywebview.api &&
      typeof window.pywebview.api.get_ghost_info === "function");
  }

  /* 正式运行时从 Python 现读 Markdown；没有 API（无头测试）就用
     ghost_info.js 里由同一份 Markdown 生成的兜底数据。 */
  function loadGhostInfo() {
    if (ghostInfoFresh) return Promise.resolve(ghostInfo);
    if (ghostInfoPromise) return ghostInfoPromise;
    if (!apiReady()) return Promise.resolve(ghostInfo);

    ghostInfoPromise = Promise.resolve()
      .then(() => window.pywebview.api.get_ghost_info())
      .then(data => {
        if (data && data.ok && Array.isArray(data.ghosts) && data.ghosts.length) {
          ghostInfo = data;
          ghostInfoFresh = true;
          ghostInfoError = null;
        } else {
          ghostInfoError = (data && data.error) || "资料接口返回空数据";
        }
        return ghostInfo;
      })
      .catch(err => {
        ghostInfoError = String(err || "读取失败");
        return ghostInfo;
      })
      .then(result => {
        ghostInfoPromise = null;
        refreshLoadedInfo();
        return result;
      });
    return ghostInfoPromise;
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

  function renderGhostDetail(name, keepScroll) {
    const scroll = keepScroll ? detailBody.scrollTop : 0;

    detailTitle.textContent = name;
    detailSubText.textContent = "";
    detailEn.textContent = "";
    detailBody.innerHTML = "";

    const section = findGhostSection(name);
    if (!section) {
      const p = document.createElement("p");
      p.className = "detail-empty";
      if (ghostInfo) {
        p.textContent = "资料里没有找到这只鬼的章节。";
      } else if (ghostInfoError) {
        p.textContent = "读取鬼魂资料失败：" + ghostInfoError;
      } else {
        p.textContent = "正在读取鬼魂资料…";
      }
      detailBody.appendChild(p);

      const src = ghostInfo && ghostInfo.source;
      if (src) {
        const s = document.createElement("p");
        s.className = "detail-source";
        s.textContent = "资料文件：" + src;
        detailBody.appendChild(s);
      }
      detailBody.scrollTop = scroll;
      return;
    }

    if (ghostInfoError && !ghostInfoFresh) {
      const warn = document.createElement("p");
      warn.className = "detail-empty";
      warn.textContent = "资料读取失败，当前显示内置快照：" + ghostInfoError;
      detailBody.appendChild(warn);
    }

    const bits = [];
    if (section.name !== name) {
      bits.push("资料名：" + section.name);
    } else if (section.alias) {
      bits.push(section.alias);
    }
    detailSubText.textContent = bits.join(" · ");
    // 英文名单独靠右放，压在详情分隔线的右段上方（不再挤在标题下的左端）
    detailEn.textContent = section.english || "";

    section.fields.forEach(field => {
      const block = document.createElement("section");
      block.className = "detail-field";
      if (field.label === "证据") block.classList.add("detail-field-evidence");

      if (field.label) {
        const h = document.createElement("h3");
        h.textContent = field.label;
        block.appendChild(h);
      }
      if (field.text) {
        const p = document.createElement("p");
        p.innerHTML = mdInline(field.text);
        block.appendChild(p);
      }
      if (block.childNodes.length) detailBody.appendChild(block);
    });

    detailBody.scrollTop = scroll;
  }

  function findCursedSection(name) {
    if (!ghostInfo || !Array.isArray(ghostInfo.cursed)) return null;
    return ghostInfo.cursed.find(c => c.name === name) || null;
  }

  function renderCursedDetail(name, keepScroll) {
    const scroll = keepScroll ? cursedDetailBody.scrollTop : 0;

    cursedDetailTitle.textContent = name;
    cursedDetailSub.textContent = "";
    cursedDetailBody.innerHTML = "";

    const section = findCursedSection(name);
    if (!section) {
      const p = document.createElement("p");
      p.className = "detail-empty";
      if (ghostInfo) {
        p.textContent = "资料里没有找到这件诅咒之物。";
      } else if (ghostInfoError) {
        p.textContent = "读取诅咒之物失败：" + ghostInfoError;
      } else {
        p.textContent = "正在读取诅咒之物…";
      }
      cursedDetailBody.appendChild(p);

      const src = ghostInfo && ghostInfo.source;
      if (src) {
        const s = document.createElement("p");
        s.className = "detail-source";
        s.textContent = "资料文件：" + src;
        cursedDetailBody.appendChild(s);
      }
      cursedDetailBody.scrollTop = scroll;
      return;
    }

    cursedDetailSub.textContent = section.english || "";

    section.fields.forEach(field => {
      const block = document.createElement("section");
      block.className = "detail-field";

      if (field.label) {
        const h = document.createElement("h3");
        h.textContent = field.label;
        block.appendChild(h);
      }
      if (field.text) {
        const p = document.createElement("p");
        p.innerHTML = mdInline(field.text);
        block.appendChild(p);
      }

      const subs = Array.isArray(field.sub) ? field.sub : [];
      if (subs.length) {
        const ul = document.createElement("ul");
        ul.className = "detail-sublist";
        subs.forEach(sub => {
          const li = document.createElement("li");
          if (sub.label) {
            const strong = document.createElement("strong");
            strong.textContent = sub.label;
            li.appendChild(strong);
            li.appendChild(document.createTextNode("："));
          }
          if (sub.text) {
            const span = document.createElement("span");
            span.innerHTML = mdInline(sub.text);
            li.appendChild(span);
          }
          ul.appendChild(li);
        });
        block.appendChild(ul);
      }

      if (block.childNodes.length) cursedDetailBody.appendChild(block);
    });

    cursedDetailBody.scrollTop = scroll;
  }

  function openGhostDetail(name) {
    if (!name || flipping) return;
    if (detailOpen && detailName === name) return;

    detailOpen = true;
    detailName = name;
    hoverGhostEl = null;
    clearEvidenceHover();

    renderCommonRules();
    commonBody.scrollTop = 0;
    renderGhostDetail(name, false);

    if (!NO_FLIP && !reducedMotion()) {
      // 先拍下“鬼名页”和“证据页”，再让真实右页换成详情。
      const front = prepareFlipPage(pageRight.cloneNode(true));
      const back = prepareFlipPage(pageLeft.cloneNode(true));
      front.classList.remove("detail-open");
      back.classList.add("detail-open");

      pageRight.classList.add("detail-open");
      pageLeft.classList.remove("detail-open");
      startFlip("forward", front, back, 0, () => {
        pageLeft.classList.add("detail-open");
        resetCommonScroll();
      });
    } else {
      pageRight.classList.add("detail-open");
      pageLeft.classList.add("detail-open");
      resetCommonScroll();
    }

    loadGhostInfo();

    requestAnimationFrame(() => {
      if (!detailOpen || detailName !== name) return;
      detailBody.scrollTop = 0;
      try {
        detailBody.focus({ preventScroll: true });
      } catch {}
    });
  }

  function closeGhostDetail() {
    if (!detailOpen || flipping) return;

    detailOpen = false;
    detailName = null;
    try {
      detailBody.blur();
    } catch {}

    if (!NO_FLIP && !reducedMotion()) {
      const commonScroll = commonBody.scrollTop;
      // “通用规则页”在翻动时保持可见，真实左页先恢复证据页。
      const front = prepareFlipPage(pageLeft.cloneNode(true));
      const back = prepareFlipPage(pageRight.cloneNode(true));
      front.classList.add("detail-open");
      back.classList.remove("detail-open");

      pageLeft.classList.remove("detail-open");
      startFlip("backward", front, back, commonScroll, () => {
        pageRight.classList.remove("detail-open");
        // 右页从 display:none 恢复排版后再画圈
        requestAnimationFrame(() => syncCircle(true));
      });
    } else {
      pageLeft.classList.remove("detail-open");
      pageRight.classList.remove("detail-open");
      // 右页重新排版后再画圈（详情打开时鬼名区是 display:none）
      requestAnimationFrame(() => syncCircle(true));
    }
  }

  /* ---------- 诅咒之物：翻到第二页 ---------- */
  function resetCursedScroll() {
    cursedBody.scrollTop = 0;
    requestAnimationFrame(() => {
      if (cursedView) cursedBody.scrollTop = 0;
    });
  }

  function openCursedView() {
    if (flipping || fading || detailOpen || cursedView) return;

    renderCursedRules();
    renderCursedNames();
    cursedView = "list";
    hoverGhostEl = null;
    clearEvidenceHover();

    const animate = !NO_FLIP && !reducedMotion();
    let front = null;
    let back = null;
    if (animate) {
      front = prepareFlipPage(pageRight.cloneNode(true));
      back = prepareFlipPage(pageLeft.cloneNode(true));
      back.classList.add("cursed-open");
    }

    // 右页立即换成诅咒之物名录，翻页快照会在落定前盖住它。
    pageRight.classList.add("cursed-list-open");

    if (animate) {
      startFlip("forward", front, back, 0, () => {
        pageLeft.classList.add("cursed-open");
        resetCursedScroll();
      }, ".cursed-body");
    } else {
      pageLeft.classList.add("cursed-open");
      resetCursedScroll();
    }
  }

  function closeCursedView() {
    if (flipping || fading || !cursedView) return;

    try {
      cursedDetailBody.blur();
    } catch {}

    const cursedScroll = cursedBody.scrollTop;
    const animate = !NO_FLIP && !reducedMotion();
    let front = null;
    let back = null;
    if (animate) {
      front = prepareFlipPage(pageLeft.cloneNode(true));
      back = prepareFlipPage(pageRight.cloneNode(true));
      // 从介绍页直接返回鬼魂名单时，快照背面也要是鬼名页。
      back.classList.remove("cursed-list-open", "cursed-detail-open");
    }

    cursedView = null;
    cursedDetailName = null;
    pageLeft.classList.remove("cursed-open");

    if (animate) {
      startFlip("backward", front, back, cursedScroll, () => {
        pageRight.classList.remove("cursed-list-open", "cursed-detail-open");
        // 右页从 display:none 恢复排版后再画圈
        requestAnimationFrame(() => syncCircle(true));
      }, ".cursed-body");
    } else {
      pageRight.classList.remove("cursed-list-open", "cursed-detail-open");
      requestAnimationFrame(() => syncCircle(true));
    }
  }

  /* 右页整页淡出 → 换内容 → 淡入；名字到介绍、介绍回名字共用。 */
  function fadeRightPage(swap) {
    if (fading || flipping) return;
    if (reducedMotion()) {
      swap();
      return;
    }

    fading = true;
    pageRight.classList.add("is-fading");

    let done = false;
    const finishOut = () => {
      if (done) return;
      done = true;
      pageRight.removeEventListener("transitionend", onEnd);

      swap();
      void pageRight.offsetWidth;
      requestAnimationFrame(() => {
        pageRight.classList.remove("is-fading");
        // 内容已经换好，淡入可以继续，但不必再挡住下一次点击。
        fading = false;
      });
    };
    const onEnd = ev => {
      if (ev.target === pageRight && ev.propertyName === "opacity") finishOut();
    };

    pageRight.addEventListener("transitionend", onEnd);
    setTimeout(finishOut, 320);
  }

  function openCursedDetail(name) {
    if (!name || flipping || fading || cursedView !== "list") return;

    cursedDetailName = name;
    fadeRightPage(() => {
      cursedView = "detail";
      pageRight.classList.remove("cursed-list-open");
      pageRight.classList.add("cursed-detail-open");
      renderCursedDetail(name, false);
      requestAnimationFrame(() => {
        if (cursedView !== "detail" || cursedDetailName !== name) return;
        cursedDetailBody.scrollTop = 0;
        try {
          cursedDetailBody.focus({ preventScroll: true });
        } catch {}
      });
    });
  }

  function closeCursedDetail() {
    if (flipping || fading || cursedView !== "detail") return;

    cursedDetailName = null;
    try {
      cursedDetailBody.blur();
    } catch {}

    fadeRightPage(() => {
      cursedView = "list";
      pageRight.classList.remove("cursed-detail-open");
      pageRight.classList.add("cursed-list-open");
    });
  }

  ghostGrid.addEventListener("contextmenu", ev => {
    const el = ev.target.closest ? ev.target.closest(".ghost") : null;
    if (!el) return;
    ev.preventDefault();
    openGhostDetail(el.dataset.name);
  });

  detailBack.addEventListener("click", closeGhostDetail);
  ghostNextBtn.addEventListener("click", openCursedView);
  cursedBack.addEventListener("click", closeCursedView);
  cursedDetailBack.addEventListener("click", closeCursedDetail);

  window.addEventListener("pywebviewready", loadGhostInfo);

  /* ---------- 手绘圈 ---------- */
  const NS = "http://www.w3.org/2000/svg";

  function ellipsePoints(cx, cy, rx, ry, start, sweep, count, tilt) {
    const pts = [];
    for (let i = 0; i <= count; i++) {
      const t = start + sweep * (i / count);
      const dx0 = Math.cos(t) * rx;
      const dy0 = Math.sin(t) * ry;
      const x = cx + dx0 * Math.cos(tilt) - dy0 * Math.sin(tilt);
      const y = cy + dx0 * Math.sin(tilt) + dy0 * Math.cos(tilt);
      pts.push([x, y]);
    }
    return pts;
  }

  function smoothPath(points, closed) {
    const n = points.length;
    if (n < 2) return "";
    const get = i => {
      if (closed) return points[(i % n + n) % n];
      return points[Math.max(0, Math.min(n - 1, i))];
    };
    const fmt = v => v.toFixed(2);
    let d = "M " + fmt(points[0][0]) + " " + fmt(points[0][1]);
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const p0 = get(i - 1);
      const p1 = get(i);
      const p2 = get(i + 1);
      const p3 = get(i + 2);
      const c1x = p1[0] + (p2[0] - p0[0]) / 6;
      const c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6;
      const c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += " C " + fmt(c1x) + " " + fmt(c1y) + ", " + fmt(c2x) + " " + fmt(c2y) + ", " + fmt(p2[0]) + " " + fmt(p2[1]);
    }
    if (closed) d += " Z";
    return d;
  }

  function makeInkPath(d, cls) {
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", d);
    path.setAttribute("class", cls);
    circleLayer.appendChild(path);
    return path;
  }

  function drawCircle(g) {
    const areaRect = ghostArea.getBoundingClientRect();
    const nameRect = g.el.getBoundingClientRect();
    if (areaRect.width < 2 || areaRect.height < 2) return;

    const w = areaRect.width;
    const h = areaRect.height;

    circleLayer.setAttribute("viewBox", "0 0 " + w + " " + h);
    circleLayer.setAttribute("width", String(w));
    circleLayer.setAttribute("height", String(h));
    circleLayer.innerHTML = "";

    const cx = nameRect.left - areaRect.left + nameRect.width / 2;
    const cy = nameRect.top - areaRect.top + nameRect.height / 2;
    const rx = nameRect.width / 2 + Math.max(15, nameRect.height * 0.55);
    const ry = nameRect.height / 2 + Math.max(8, nameRect.height * 0.30);

    // 一个规整的椭圆，只在右上留一点回笔的交叠，像用笔一圈画成。
    const pts = ellipsePoints(cx, cy, rx, ry, -1.15, Math.PI * 2 + 0.26, 48, -0.03);
    makeInkPath(smoothPath(pts, false), "ink-main");
  }

  /* 圈/划/取消不做动画：换圈、清圈时临时关掉圈的淡入淡出；
     证据筛选造成的整体变淡仍保留 .34s，和鬼名同步。 */
  let circleFadeTimer = 0;
  function withoutCircleFade(fn) {
    circleLayer.style.transition = "none";
    fn();
    void circleLayer.offsetWidth;
    clearTimeout(circleFadeTimer);
    circleFadeTimer = setTimeout(() => { circleLayer.style.transition = ""; }, 60);
  }

  function syncCircle(force = false) {
    // 诅咒之物页上鬼名区是 display:none，别拿 0 尺寸去画圈
    if (cursedView && !force) return;

    const g = selectedName ? GHOSTS.find(x => x.name === selectedName) : null;

    if (!g) {
      if (drawnName !== null || circleLayer.children.length) {
        drawnName = null;
        circleLayer.innerHTML = "";
        withoutCircleFade(() => circleLayer.classList.remove("ready", "faded"));
      }
      return;
    }

    if (!force && drawnName === g.name) {
      if (fontsReady && !circleLayer.classList.contains("ready")) {
        withoutCircleFade(() => circleLayer.classList.add("ready"));
      }
      updateCircleFade();
      return;
    }

    drawnName = g.name;
    withoutCircleFade(() => {
      drawCircle(g);
      if (fontsReady) circleLayer.classList.add("ready");
      updateCircleFade();
    });
  }

  /* ---------- 重置 ---------- */
  function resetAll() {
    if (flipping || fading) return;

    EVIDENCE.forEach(item => {
      evState.set(item.key, "normal");
      item.el.classList.remove("checked", "crossed");
      item.el.setAttribute("aria-checked", "false");
    });
    crossedGhosts.clear();
    selectedName = "魂魄";
    hoverGhostEl = null;
    clearEvidenceHover();
    applyEvidenceFilter();
    applyGhostStates();

    // 在诅咒之物页重置时，翻回鬼魂名单，让重置结果能直接看到。
    if (cursedView === "list") closeCursedView();
  }

  resetBtn.addEventListener("click", resetAll);

  window.addEventListener("keydown", ev => {
    if (ev.key === "Escape") {
      // 翻页或淡出过程中先让动画走完，避免在快照后面改状态
      if (flipping || fading) {
        ev.preventDefault();
        return;
      }
      // 详情页开着时，Esc 先返回上一级；再按一次才重置
      if (detailOpen) {
        ev.preventDefault();
        closeGhostDetail();
      } else if (cursedView === "detail") {
        ev.preventDefault();
        closeCursedDetail();
      } else if (cursedView === "list") {
        ev.preventDefault();
        closeCursedView();
      } else {
        resetAll();
      }
    }
    if (ev.key === "F5" || ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "r")) {
      ev.preventDefault();
    }
  });

  document.addEventListener("contextmenu", ev => ev.preventDefault());
  window.addEventListener("wheel", ev => { if (ev.ctrlKey) ev.preventDefault(); }, { passive: false });

  /* ---------- 按住鼠标拖动滚动 ---------- */
  // 通用规则、鬼魂详情这些长页面原来只能用滚轮滚，按住左键拖是没反应的。
  // 这里补上「抓着纸面拖」的手感：按住左键上下拖，内容跟着走。
  // 拖过 4px 才算拖动，免得把正常点击吞掉；拖完那一次松手的 click 也丢掉，
  // 不然在按钮上拖动会在松手时误触发一次。
  function enableDragScroll(el) {
    if (!el) return;
    let startY = 0;
    let startTop = 0;
    let active = false;
    let moved = false;

    el.addEventListener("mousedown", ev => {
      if (ev.button !== 0) return;
      if (ev.target.closest("a, button, input, textarea, select, [data-no-drag]")) return;
      // 本来就没得滚就别接管鼠标
      if (el.scrollHeight <= el.clientHeight + 1) return;
      active = true;
      moved = false;
      startY = ev.clientY;
      startTop = el.scrollTop;
    });

    window.addEventListener("mousemove", ev => {
      if (!active) return;
      const dy = ev.clientY - startY;
      if (!moved && Math.abs(dy) < 4) return;
      if (!moved) {
        moved = true;
        document.body.classList.add("drag-scrolling");
      }
      el.scrollTop = startTop - dy;
      ev.preventDefault();
    }, { passive: false });

    const finish = () => {
      if (!active) return;
      active = false;
      if (!moved) return;
      document.body.classList.remove("drag-scrolling");
      el.addEventListener("click", ev => {
        ev.preventDefault();
        ev.stopPropagation();
      }, { capture: true, once: true });
    };
    window.addEventListener("mouseup", finish);
    window.addEventListener("blur", finish);
  }

  [commonBody, detailBody, cursedBody, cursedDetailBody].forEach(enableDragScroll);

  /* ---------- 窗口控制 ---------- */
  function callApi(name, ...args) {
    if (window.pywebview && window.pywebview.api && typeof window.pywebview.api[name] === "function") {
      return window.pywebview.api[name](...args);
    }
    return Promise.resolve(null);
  }

  document.getElementById("btnClose").addEventListener("click", () => callApi("close"));

  /* ---------- 字体 / 尺寸变化后重画圈 ---------- */
  function onFontsReady() {
    fontsReady = true;
    syncCircle(true);
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(onFontsReady);
  } else {
    onFontsReady();
  }

  let resizeTimer = 0;
  const redrawCircle = () => {
    // 详情打开、诅咒之物页或翻页时鬼名区可能不可见，别拿 0 尺寸去画圈
    if (detailOpen || cursedView || flipping) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => syncCircle(true), 90);
  };

  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(redrawCircle);
    ro.observe(ghostArea);
  } else {
    window.addEventListener("resize", redrawCircle);
  }

  /* ---------- 初始状态：证据全空，圈魂魄 ---------- */
  renderCommonRules();
  renderCursedRules();
  renderCursedNames();
  if (apiReady()) loadGhostInfo();
  applyEvidenceFilter();
  applyGhostStates();
})();
