# 恐鬼症证据笔记（桌面置顶小窗）

最后更新：2026-10-27
启动：双击 `启动笔记.bat`，或 `python main.py`；分享版双击 `dist\恐鬼症笔记 v1.3\恐鬼症笔记 v1.3.exe`
依赖：`pip install -r requirements.txt`（pywebview 6.2.1 / pythonnet 3.1.0 / Pillow 11.3.0）

## 目录

| 路径 | 作用 |
|---|---|
| `main.py` | pywebview 桌面窗口、贴合圆角皮面书壳的窗口区域、最大尺寸计算、配置读写、JS API；启动保护、单实例、退出时停热键线程；启动时给本程序的 WebView2 加 `--force_low_power_gpu`（走核显） |
| `version.py` | 名称与版本号的唯一来源：`APP_NAME_BASE` + `APP_VERSION`；窗口标题和打包名称都从这里取 |
| `applog.py` | 滚动日志：`%APPDATA%\PhasmophobiaJournal\journal.log`（512 KB × 2 份备份） |
| `layout.py` | 窗口/书壳几何常量，`main.py` 与真实窗口测试共用 |
| `hotkey.py` | 全局 Ctrl+J：最小化 / 唤回；动态置顶；补 `WS_MINIMIZEBOX` 让任务栏按钮能最小化；任务栏第一次点击直接隐藏置顶笔记；点窗口外面就收起（Deactivate 延迟 0.2s 复核）；保存并还原最小化前的窗口矩形 |
| `ghost_info.py` | 只读解析鬼魂资料 md：鬼魂、通用规则、诅咒之物（含 `###` 子项）；优先用程序/exe 旁的 `资料\恐鬼症_鬼魂数据_分鬼版.md`，找不到才回退 `D:\game_timer\资料\...` |
| `app/index.html` | 界面结构（HTML）：左页证据 + 鬼魂通用规则 + 诅咒之物规则，右页鬼名 + 鬼魂详情 + 诅咒之物名录/详情；样式和脚本拆到下面两个文件 |
| `app/styles.css` | 全部界面样式：cqh/vw 布局、皮面书壳、通用规则页、诅咒之物页、淡入淡出、翻页动画 |
| `app/app.js` | 交互状态机、30 只鬼的圈选/划除数据、证据筛选、详情渲染、左右页切换、诅咒之物翻页/淡入淡出、翻页动画、窗口 API 调用 |
| `app/ghost_info.js` | 自动生成：鬼魂资料的兜底数据（无 pywebview API 的无头测试用） |
| `app/assets/` | 素材：书页/纸纹/皮革/图标由 `tools/gen_assets.py` 生成，字体是 SIL OFL 1.1 的龙藏体（`OFL.txt` 同目录） |
| `tools/gen_assets.py` | 程序化生成四张素材（噪声+几何，不读游戏文件）；改风格直接改这里重跑 |
| `LICENSE` / `README.md` / `docs/screenshot-main.png` / `docs/screenshot-detail.png`（首页 / 详情页） | 开源仓库用：MIT 许可证、说明、界面截图 |
| `requirements.txt` | 运行依赖：pywebview 6.2.1、pythonnet 3.1.0、Pillow 11.3.0 |
| `启动笔记.bat` | 开发机启动器；纯 ASCII + CRLF，不进分享包 |
| `build_share.bat` | 打包分享版的入口；纯 ASCII + CRLF，双击调用 `tools/build_share.py` |
| `tools/build_share.py` | PyInstaller onedir 打包 → 复制资料 → 写使用说明 → 打 zip；名称和版本取自 `version.py` |
| `tools/smoke_packaged.mjs` | 打包版冒烟测试（CDP，11 项）：窗口、30 鬼、7 证据、资料源、右键详情、日志 |
| `dist/恐鬼症笔记 v1.3/` | 打包产物：exe + `_internal` + `资料` + 使用说明；整个文件夹发人 |
| `dist/恐鬼症笔记 v1.3-分享.zip` | 发给朋友的压缩包（解压后得到上面的文件夹）；**2026-10-29 已作为 v1.3 发布到 GitHub** |
| `build/` | PyInstaller 中间产物和 spec，可随时删，不要打进分享包 |
| `legacy/book_mask.py` | 历史文件：`book_spread.png` 每行可见跨度。已不再引用，从根目录移到 `legacy/` 备查 |
| `legacy/gen_book_mask.py` | 历史工具：重新生成 `book_mask.py`；已不再需要 |
| `legacy/assets/tick.png` | 历史素材：手写勾；方框已改为 CSS 手绘 ×，保留备查 |
| `tools/test_ui.mjs` | 无头 Edge 自动化布局/交互测试（CDP，无 npm 依赖，160 项；固定用 `?noflip=1`） |
| `tools/test_flip.mjs` | 无头 Edge 翻页动画专项测试（CDP，31 项）：正/反翻方向、快照内容、起止对齐、翻页中保护、最终状态 |
| `tools/test_cursed.mjs` | 诅咒之物专项测试（CDP，33 项）：第二页翻页、7 件物品、左右页布局、名字淡出/淡入介绍、返回、无重置入口、Esc、减少动态效果 |
| `tools/test_window_features.py` | 真实窗口测试：透明、点击穿透、圆角书壳区域、顶部拖动、Ctrl+J 最小化/唤回（25 项） |
| `tools/test_drag_scroll.mjs` | 针对性测试：长页面按住鼠标拖动滚动（6 项，headless Edge + CDP 真鼠标事件） |
| `tools/test_taskbar_hide.py` | 针对性任务栏测试：活动窗口点按钮隐藏 / 第一次点击隐藏 / 恢复不反弹 / 普通程序切前台 / 游戏前台 Ctrl+J / 快速连按不吞键（24 项） |
| `tools/test_ghost_info.py` | 鬼魂 + 诅咒之物资料解析 / `Api.get_ghost_info()` / 兜底数据一致性测试（23 项） |
| `tools/check_windows.ps1` | 诊断脚本：检查 pythonw 窗口是否响应 Windows 消息 |
| `tools/scan_assets.py` | 只读扫描游戏 Unity 资源（不写游戏目录） |
| `tools/gen_ghost_info.py` | 从鬼魂资料 md 重新生成 `app/ghost_info.js` |
| `tools/fix_book_left_edge.py` | 把 `book_spread.png` 的左边缘修直（读 `extracted/textures/Bookpages_696.png`） |
| `tools/diagnose_black_window.ps1` | 连续启动程序，检测每次是否正常渲染（UIA + 窗口中心亮度） |
| `extracted/` | 扫描产物：454 张贴图、字体、本地化文本、`scan_results.json`；482 个文件，约 820 MB，尚未清理 |

## 前端文件职责（2026-10-18 拆分，2026-10-21 加通用规则页/翻页）

- `app/index.html`：只放结构（head、书本图层、左页证据列表 + `#commonPanel`、右页鬼名网格、详情面板）。
- `app/styles.css`：全部样式，包括 cqh/vw 布局、皮面书壳、`.book` 的 `border-radius: 1.15%`。
  改圆角时必须同步 `layout.py` 的 `COVER_RADIUS`。
- `app/app.js`：30 只鬼的数据、证据三态状态机、筛选、手绘圈/线、详情渲染、左右页切换、
  翻页快照和动画、`pywebview.api` 调用。
- 加载顺序固定为 `ghost_info.js` → `app.js`；`ghost_info.js` 先提供 `window.GHOST_INFO_FALLBACK`。
- 无头测试仍直接打开 `app/index.html`，外部 CSS/JS 通过相对路径加载；不再有内联 `<style>` 或内联主脚本。
- **布局测试必须用 `app/index.html?noflip=1`**：翻页动画会克隆整页，克隆里的 `.ghost` / `.ev`
  会污染全局选择器；`NO_FLIP` 只跳过动画，不改变左右页最终布局。

## 素材来源

**2026-10-27 起全部换成自制素材**（要开源就不能带游戏贴图）。四张图由 `tools/gen_assets.py`
用噪声 + 几何程序化生成，不读任何游戏文件；尺寸、书脊位置、纸色都对齐原图，所以 CSS 的
mask、书脊阴影、圆角一个都不用改。

| 程序内文件 | 现在 | 原来是 |
|---|---|---|
| `book_spread.png` | 895×715 RGBA，奶油纸底 + 右页淡格线 + 中缝 + 撕纸边；同时当 alpha 遮罩用 | `Bookpages_696.png` |
| `parchment_tile.png` | 512×512 可无缝平铺的纸纤维 | `Book_BC_2291.png` 裁切 |
| `leather.png` | 1024 深棕粒面皮革（Worley 细胞噪声） | `Journal_Leather_..._2559.png` 缩到 1024 |
| `ghost.ico` | 深棕圆角底 + 奶油小幽灵，16/32/48/64/128/256 | `D:\game_timer\ghost_icon.ico` |
| `LongCang-Regular.ttf` | 不变，SIL OFL 1.1，许可证 `app/assets/OFL.txt` | 游戏内同名字体 |

调色记录：渲染后与旧素材比对，左右页平均色差 ≤2 个色阶（左 243.5/241.7/199.2 对 245.4/241.4/199.6）。
改图后建议用无头 Edge 截一张 `app/index.html` 比对，别只靠肉眼。

> 老版本（带游戏贴图）整树备份在 `E:\Claude code\phasmophobia-journal_原版素材备份_2026-10-27`
> （7.4 MB，不含 extracted/dist/build）。想找回原来的书页外观，把备份里的 `app/assets` 拷回来即可。
> 注意：那份**不能**上传到 GitHub。
>
> **两个版本必须同步更新（用户 2026-10-29 定的规矩）**：改了本目录的 `app/app.js`、
> `app/styles.css`、`app/index.html`、`hotkey.py` 等共用文件，就同步覆盖到那份备份里，
> 只保留备份自己的两处差异：`app/index.html` 的 UTF-8 BOM、`<title>`（`恐鬼症笔记 v1.2-原版素材`），
> 以及 `version.py` 的 `APP_VERSION`。之后重跑备份目录的 `python tools/build_share.py` 重打分享包。

游戏原始素材仍在 `extracted/`（820 MB，已 gitignore），导出流程和本地化键见下面的历史说明。
文字来自 `extracted/text/localisation.txt`（zh-CN 第 14 列）。

文字来自 `extracted/text/localisation.txt`（zh-CN 第 14 列），鬼名与证据文案按游戏日志校对。
关键本地化键：`Journal2_Evidence_Title`、`Journal2_believe`、`Journal2_EMF5`、`Journal2_Fingerprints`、
`Journal2_GhostWriting`、`Journal2_DOTS`、`Journal2_Freezing`、`Journal2_GhostOrbs`、`Journal2_SpiritBox`。

## 鬼魂资料（左页通用规则 + 右页详情，2026-10-21）

- **数据源（只读）**：优先读程序/exe 旁边的 `资料\恐鬼症_鬼魂数据_分鬼版.md`；开发机上没有时
  回退 `D:\game_timer\资料\恐鬼症_鬼魂数据_分鬼版.md`。由用户维护；程序不写这个文件，也不碰
  `资料` 目录里的其他东西。2026-10-21 解析结果：30 只鬼、244 个字段、13 条通用规则。
- `ghost_info.py::load_ghost_info()` 每次调用都现读 Markdown；`main.py::Api.get_ghost_info()`
  把它暴露给 JS。界面在 `pywebviewready`（以及首次右键）时取一次，成功后本次启动不再重读；
  **改完 md 要重启笔记**才能看到新内容。无 pywebview API 时（无头测试）用
  `app/ghost_info.js` 的兜底快照；改完 md 后跑 `python tools/gen_ghost_info.py` 让快照同步。
- **读取失败时有可见提示**：`loadGhostInfo()` 的接口错误和 Promise 异常都会在详情打开时
  重新渲染；若仍有兜底快照，先显示「资料读取失败，当前显示内置快照：…」，再列兜底内容；
  没有兜底时显示「读取鬼魂资料失败：…」。以前失败后详情会停在「正在读取…」或静默显示旧快照。
- **入口**：右键任一鬼名。左键仍是原来的圈住/划除；右键不改变圈/划状态。
- **布局（2026-10-21）**：详情打开时左页从证据切换为「通用规则」，右页显示该鬼介绍。
  证据列表、底部提示隐藏；返回后左页恢复证据，勾选/划除状态原样保留。
- **返回**：鬼名同一行右侧的「← 返回鬼名」，或 `Esc`。详情打开时第一次 `Esc` 只返回，
  再按一次才执行原来的「重置」。翻页动画进行中，返回按钮和 `Esc` 都会被忽略，等纸页落定。
- **内容**：右页按 md 原顺序显示该鬼的全部字段（证据、猎杀阈值、基础移速、视野加速、特殊加速、
  技能/猎杀属性、特征、注意、彩蛋、特例、如何辨认等），行内 `**粗体**` 会还原为加粗；
  内容超出右页高度时在页内滚动。通用规则不再折叠在详情末尾，而是完整铺在左页，单独滚动。
- **正文字号（2026-10-18 调大，2026-10-21 加左页）**：正文 `.detail-field p` 2.35cqh、
  字段标题 `h3` 2.75cqh、证据行 2.5cqh、英文名副标题 2.2cqh、资料路径 1.9cqh；
  左页通用规则正文 `.common-body p` 2.3cqh、左页标题仍用 6.8cqh。
  默认最大窗口（书页高 949）下正文约 22.3px 逻辑像素；改字号只动这些 cqh 值，不要动标题 5.6/6.8cqh。
- **正文对比度（2026-10-18，2026-10-21 同步左页）**：用户反馈“除粗体外看不清”。LongCang
  常规字重笔画细，右页正文改用主墨色 `--ink` 并加 `text-shadow: 0 .35px 0 rgba(30,15,4,.24)`；
  左页通用规则也用 `--ink` + 同样的轻微墨迹阴影，每段前是一条淡棕短横线。
  副标题仍是 `--ink-soft / .9`。**不要改回 `--ink-mid` / 浅棕 + 低透明度**，否则整段又会发虚。
- **名字映射**：游戏界面名 → md 章节名：`捣蛋鬼 → 骚灵`、`雷兽 → 雷魂`。其余 28 个同名。
  2026-10-19 用户把 md 章节名从 `达魇` 改成了 `达彦`，因此 `达彦` 的映射已删除；不要再擅自改回。
  标题仍显示界面名，只有章节名不同时副标题才注明「资料名：xxx」。
- **层级**：详情打开时 `.page-right` 抬到 `z-index:70`（顶部拖动区是 60），否则页内左上角的
  返回按钮会被拖动区挡住；翻页快照层是 90，关闭按钮 `.chrome` 是 100。左页顶部仍可拖动窗口。
  **不要删这个 z-index 规则。**
- 详情打开或翻页时 `ghostArea` 可能 `display:none`，`ResizeObserver` 会拿到 0 尺寸；
  `redrawCircle()` 在 `detailOpen || flipping` 时直接返回，关闭/落定后再用 `syncCircle(true)`
  重画圈（`app/app.js`）。

### 翻页动画（2026-10-21）

- **方向**：鬼名 → 介绍 = 右页快照绕书脊向左翻（`.page-flip.forward`，往后翻一页）；
  介绍 → 鬼名 = 左页快照绕书脊向右翻（`.page-flip.backward`，往前翻一页）。
- **快照**：`cloneNode(true)` 复制真实左右页作正反两面。正翻时正面是旧鬼名页、反面是左页
  “通用规则”；反翻时正面是旧通用规则页、反面是右页鬼名页。复制后必须去掉所有 `id`、
  可聚焦元素 `tabIndex=-1`、整页 `aria-hidden=true`，否则会和真实界面抢 `getElementById`
  和全局选择器。`pointer-events:none`，翻页中仍能拖动窗口/点关闭。
- **真实页面切换时机**：正翻时真实左页在动画结束前仍是证据（被快照盖住），右页立即换成详情；
  反翻时真实左页立即恢复证据，真实右页保持详情，等快照落定后再恢复鬼名。结束时才切真实页，
  避免快照和真实页同时消失的闪缝。
- **宽度补偿（2026-10-25 改为纯 transform）**：左右页是 51% / 49%，不是等宽。
  翻页层固定按宽页 51% 铺、只过渡 `transform`；窄页由 `.flip-face > .page-right { width: 49cqw }`
  自己定宽（`.page-left` 是 51cqw），所以快照排版和真实页一字不差，起点/终点仍然精确贴合。
  多出来的 2% 是透明的，正好落到书壳外被 `overflow: hidden` 裁掉。
  **不要改回同时过渡 `width` / `left`**：宽度每帧变化会让两个整页的文字重新排版，
  核显上每次翻页多出 ~3 倍长帧（实测 >33ms 帧 20 → 7 / 6 次翻页）。
- **纸面**：`.flip-face > .page::before` 只铺 `top/bottom:2.3cqh`、外侧 `2.3cqw` 的纸面区域，
  露出四周皮革包边；不要给整个 `.flip-face` 铺不透明底色。`::after` 是书脊侧阴影，压在文字下。
- **时长**：`transform .52s cubic-bezier(.22,.8,.18,1)`；`transitionend`
  移除快照，另有 900ms 定时器兜底。不要给翻页层加 `filter`，会把 `preserve-3d` 压平。
- **起翻前空等两帧**：`startFlip()` 里用双重 `requestAnimationFrame` 再加 `.go`，
  让快照先完成一次栅格化；否则动画头几帧要边转边画整页，核显上第一下明显一顿
  （冷启动首翻 60ms+ 才出快照）。
- **保护**：`flipping` 为真时忽略右键、证据/鬼名点击、返回按钮、`Esc` 和圈的重绘，
  防止在快照背后改状态；关闭窗口不受影响。
- **跳过动画**：`?noflip=1` 或系统 `prefers-reduced-motion: reduce` 时直接切左右页，不建快照。
- **通用规则滚动复位**：通用面板隐藏时给 `.common-body` 设 `scrollTop = 0` 不生效，浏览器会保留
  上一次的滚动位置；必须在左页加上 `detail-open` 真正显示后调用 `resetCommonScroll()`，
  并在下一帧再补一次。每次打开详情都从顶部开始；翻页时快照自己的滚动位置仍保留。
- 专项测试：`node tools/test_flip.mjs`（31 项）；主布局测试固定带 `?noflip=1`。

### 诅咒之物（2026-10-21）

- **数据源**：同一份 md 末尾的顶层 `# 诅咒之物`。`### 通用规则` 是左页 10 条规则，其余 7 个 `###` 是物品。鬼魂解析在顶层 `#` 处停止，诅咒解析只在这个分节内工作。
- **解析**：`ghost_info.py::parse_cursed_md()`。字段支持 `- **标签**：内容`、标签后带括号说明（如「常用问法（语音/文本）」）、缩进子项；子项放在 `field["sub"]`，保留通灵板问题表 13 条 / 问法 12 条 / 碎裂条件 4 条、塔罗牌 10 张、猴爪愿望 10 个。`load_ghost_info()` 返回 `cursed_common` / `cursed`；`app/ghost_info.js` 由 `python tools/gen_ghost_info.py` 同步。
- **入口**：鬼名页右下角页脚 `下一页：诅咒之物 →`，右页向左翻到第二页。第二页左页标题「诅咒之物」、副标题「通用规则」，右页标题「诅咒之物」+ 7 件物品名字。
- **返回**：第二页左页底部 `← 返回鬼魂名单`，左页向右翻回鬼名页；在任一件诅咒物介绍里点它也会直接回鬼名页。
- **名字 → 介绍**：右页整页 `.is-fading` 淡出（.22s），换内容后淡入；介绍 → 名录同样。淡出期间 `fading` 挡住点击，淡入开始后释放，连续点击不会被卡住半秒。
- **布局**：鬼名页右页最底 `.page-bottom` 一行，重置固定在左下角、翻页页脚在右下角；第二页不设页脚行，只有左页底部的返回按钮。`page-bottom` 在 `.page-right.detail-open` / `.cursed-list-open` 下随其它内容一起隐藏。
- **介绍内容**：标题 + 英文名 + 字段；嵌套子项渲染成 `.detail-sublist`，行内粗体保留。通灵板问题表、常用问法、塔罗牌、猴爪愿望都由 `sub` 渲染，不再压成一个长段落。
- **状态**：`cursedView = null | "list" | "detail"`；`detailOpen` 仍只管鬼魂详情。`syncCircle` / `redrawCircle` 在 `cursedView` 时跳过，回到鬼名页后用 `syncCircle(true)` 重画。
- **Esc**：鬼魂详情 → 返回鬼名；诅咒介绍 → 返回名录；诅咒名录 → 返回鬼名；鬼名页 → 重置。翻页/淡出中 Esc 被忽略。
- **重置**：只在鬼名页有；第二页名录和诅咒介绍都没有重置入口，需要先返回鬼名页。翻页/淡出中重置被忽略。
- **减少动态效果**：`?noflip=1` 或 `prefers-reduced-motion` 时不建翻页快照、不淡入淡出，直接切页。
- **专项测试**：`node tools/test_cursed.mjs`（33 项）。

## 交互状态机

### 左页证据

```
normal --左键--> checked（方框内出现手绘 ×）
checked --左键--> crossed（×消失，从方框左缘到名字一条手绘线）
crossed --左键--> normal
```

- **筛选规则**：`checked` = 必须有这条证据，`crossed` = 必须没有这条证据。
  - 鬼必须同时满足所有 `checked`，且不拥有任何 `crossed`；否则加 `.faded`（透明度 .18）。
  - 例：勾 EMF5 → 缺 EMF5 的 17 只淡出；再点成划除 → 拥有 EMF5 的 13 只淡出。
  - 划除和勾选可以同时存在，例如勾 UV + 划 EMF5：必须有 UV、且不能有 EMF5。
  - 划除只是筛选记号，不会改动鬼名页的手动圈/划除状态。
- `checked` 的方框里是两道 CSS 手绘线组成的 ×（`inset:8%`，2px，略不对称），不是游戏原版勾图；`.tick` 类名沿用。
- `crossed` 的线 2.2px、透明度 .92，从方框左缘起笔，穿过方框、列间距和证据名；线的起点用
  `calc(-1 * max(3.05cqh,18px) - 17.8px)` 对齐方框（`.ev` 字号固定 16px，列间距 1.05em=16.8px，另加 1px 起笔余量）。
- 悬浮鬼名：除这只鬼拥有的证据外，其他证据行加 `.dim`（透明度 .16）。
- 拟魂的证据只有 `BOX / UV / FREEZE`，**灵球不算证据**（悬浮时灵球会淡出，勾选灵球时拟魂也会淡出）。

### 右页鬼名

```
normal --左键--> selected（规整单笔手绘椭圆，同时只能有一个）
selected --左键--> crossed（圈消失，名字上一条线）
crossed --左键--> normal
```

- **鬼名三列居中（不要改成左对齐）**：每个鬼名在自己的单元格里水平居中。
  2026-10-18 试过 `justify-self: start` 左对齐到「证据」标题，用户反馈“鬼名不在中间，很别扭”，
  已恢复 `justify-self: center`；`tools/test_ui.mjs` 有 3 项检查锁住三列居中。
- **圈的样子（2026-10-18 改）**：一条规整的单笔椭圆，只在右上留一点回笔交叠，像用笔一圈画成；
  不再用随机抖动，也没有第二道淡回笔。形状在 `app/app.js::drawCircle()`，`.ink-echo` 样式已删除。
- 点另一只普通鬼：圈自动移过去（单圈）。
- 点一只已划除的鬼：只取消划除，不改变当前圈住的鬼。
- 初始状态：证据全空，**魂魄**被圈住。
- 鬼名操作不影响证据页；证据的 `checked` 会按筛选规则淡化鬼名，但不会改手动圈/划除状态。
- 被证据淡出的鬼：整个 `.ghost` 透明度 .18，名字、划除线一起淡；如果它正被圈住，`#circleLayer` 加 `.faded`，圈也同步淡到 .18。
- **圈 / 划 / 取消都不做描画动画**：圈不走 `stroke-dashoffset`，换圈、清圈瞬间完成；鬼名线和证据线直接出现/消失，
  方框 × 直接出现/消失。只有证据筛选造成的淡入淡出保留 .34s（圈和鬼名同步），换圈/按证据筛选以外的操作不受影响。
  `syncCircle()` 在换圈、清圈时用 `withoutCircleFade()` 临时关掉 `.circle-layer` 的过渡 60ms。

### 重置

点「重置」，或在鬼名列表状态下按 `Esc`：证据全部回到 `normal`，鬼名全部回到 `normal`，
魂魄重新圈住，清除悬浮淡出。详情页打开时第一次 `Esc` 只关闭详情，不重置。

## 窗口与配置

- **启动保护与日志（2026-10-18）**：`main.py` 把 `webview` / `ghost_info` / `hotkey` / `layout`
  的导入放在 `try` 块里；任何一个导入失败都会写日志并弹 MessageBox（pythonw 没有控制台，
  原来看不到任何错误）。所有运行日志在 `%APPDATA%\PhasmophobiaJournal\journal.log`，
  单文件 512 KB、保留 2 份备份；配置仍在同目录 `config.json`。后台线程未捕获异常也会进日志。
- **单实例（2026-10-18）**：命名互斥量 `Local\PhasmophobiaJournal`；第二个进程发现已有实例时
  不创建窗口，而是找到标题为「恐鬼症笔记」的窗口 `ShowWindow(SW_RESTORE)` +
  `SetForegroundWindow`，然后退出（实测约 0.3 秒）。测试用 `--allow-multi` 绕过，
  以免和正在使用的笔记互抢 Ctrl+J；日常启动不要加这个参数。
- **书壳外全部透明**：`transparent=True` + html/body `background: transparent`；整本书以外的
  窗口留白只剩桌面/游戏画面。
- **完整皮面书壳（2026-10-18）**：`.book` 本身是一整块 895/715 比例的皮面（`leather.png` +
  深棕渐变 + `cover-wear` 受光/磨白 + `cover-emboss` 压印线）；内页放在 `.page-surface`
  （inset 2.3%），其下是 `.page-block-frame`（inset 1.0%，奶油色页层 + 横向细线 + 内阴影），
  表现书壳与纸面之间的纸页厚度；`.page-surface` 用 `box-shadow` 在页层上落一圈阴影
  （2026-10-25 从 `filter: drop-shadow` 换过来：filter 会把整块纸面合成一层，鼠标划过证据行时整页重绘）。
  图层顺序：`.book` 皮革背景 → `cover-wear` / `cover-emboss`（z0）→ `page-block-frame`（z1）→
  `page-surface`（z2，内含 sprite + `paper-wash` / `paper-stains` / `book-depth` / `spine-shade` /
  `spine-light` / `page-block`）→ `.page` 文字（z4）→ `.book-drag`（60）→
  `.page-right.detail-open`（70）→ `.page-flip` 翻页快照（90）→ `.chrome`（100）。
  `.book` 用 `border-radius: 1.15%; overflow: hidden`；`layout.py` 的 `COVER_RADIUS = 0.0115`
  必须和它一致（`main.py` 从 `layout.py` 导入）。纸面图层都在 `.page-surface` 里，用
  `book_spread.png` 做 mask（100% 100%），
  对齐的是内缩后的纸面，不是整本书。
  **不要再给 `.book` 加外投影**：窗口区域只到书壳边缘，区域外的阴影会被裁掉（透明窗口不是
  逐像素 alpha，做不出桌面上的半透明阴影）。
- **书页内文字位置不变**：`.page-left` / `.page-right` 仍相对 `.book` 定位，留白约 6%；
  纸面内缩 2.3% 后文字离纸边约 3.7% 书宽，已在最大/最小尺寸验证不溢出。
- **窗口区域 = 圆角书壳**：`main.py::apply_book_region()` 用 `CreateRoundRectRgn`，矩形与 CSS
  一致：宽 `min(94vw, 91vh * 895/715)`、比例 `895/715`、居中；圆角半径按 `bw / bh * COVER_RADIUS`
  计算，最后两个参数是椭圆直径所以 ×2。几何常量统一在 `layout.py`（`BASE_W/H`、`MIN_W/H`、
  `SCREEN_MARGIN`、`BOOK_ASPECT`、`WINDOW_ASPECT`、`COVER_RADIUS`），真实窗口测试也从这里导入。
  书壳外（窗口四边留白 + 四角圆角外）点击穿透。
  **不要再引用 `legacy/book_mask.py` 的逐行轮廓**；素材重做也不再需要重新生成 mask（CSS 的 alpha
  蒙版仍直接用 `book_spread.png`）。**不要**在 Python 里用窗口比例 1120/895 去算书壳。
- **窗体底色必须是深皮革色 `#2E1A0E`**（`form.BackColor`，只在第一次应用区域时设）。pywebview
  的 `transparent=True` 只把 WebView 背景设为透明，窗体本身仍是 WinForms 底色；圆角处 CSS
  抗锯齿会透出一点窗体底色，深棕和封面边缘融合。**不要改回奶油色 `#F0D8A8`**，否则圆角外缘
  会出现亮边。**不要把圆角区域改成直角/内缩若干 px**：CSS `border-radius` 和 `COVER_RADIUS`
  是同一套几何，改一边必须同步另一边。
- **顶部拖动区**：`.book-drag.pywebview-drag-region`，高 14cqh，右侧留 96px 给按钮，z-index 60
  （在证据行上方）。拖动时窗口跟随鼠标。
- 右上角只剩**关闭**按钮：视觉上是右侧内页纸面右上角的一笔手写 ×，没有圆形底、边框或按钮底色；
  2026-10-18 按要求把可见字形定为约 35px、可点区域 35×35，并移到 `.page-surface` 内（`.chrome` 的
  `top: 3.2cqh; right: 3.2cqw`；SVG 的 path 必须铺满 viewBox，否则只放大画布、笔画仍很小）。
  **不要再放回皮面上的深色圆按钮或「合」**——用户已明确要内页右上角的 ×。**没有最小化按钮、
  没有置顶按钮**；最小化只走 Ctrl+J 键。
- **置顶是动态的**：只有恐鬼症或笔记自己在前台时才 `TopMost=True`；切到浏览器等其他程序后
  自动恢复普通窗口，不会一直盖住别的程序。后台线程每 40ms 检查前台进程，状态变化才改，
  并通过 `form.Invoke` 在 UI 线程执行。
- **Ctrl+J 切换显示/后台**（`hotkey.py`）：
  - 全局热键 `RegisterHotKey(None, id, MOD_CONTROL | MOD_NOREPEAT, 'J')`，后台线程每 40ms
    轮询，并用 `PeekMessageW(..., WM_HOTKEY, WM_HOTKEY, PM_REMOVE)` **只取**
    `WM_HOTKEY`（不再把线程队列里的其他消息一并吞掉）；每次按键都立即处理，不做去抖——快速连按不能被吞掉；
  - 只在三种情况注册，避免吞掉其他程序的 Ctrl+J：恐鬼症在前台、笔记在前台、笔记已最小化；
  - 最小化：保存窗口矩形后 `ShowWindow(SW_MINIMIZE)`（走 `HotkeyToggle.minimize()`；
    界面上的最小化按钮已删除，只剩这条路径）；
  - 唤回：`SetWindowPos` 放到最小化前的矩形（游戏/笔记在前台用 `HWND_TOPMOST`，否则
    `HWND_NOTOPMOST`）。**恢复时用 `game_foreground()` 只认游戏进程**；游戏在前台时用
    `SW_SHOWNOACTIVATE`，不抢游戏焦点。不能把“笔记自己还在前台”当成游戏在前台——最小化
    瞬间前台可能仍挂在笔记上，会误判。从浏览器/桌面唤回时用 `SW_RESTORE` + `SetForegroundWindow`
    把笔记带到前台——否则恢复后笔记没有焦点，热键会立刻注销，再按 Ctrl+J 就关不掉。
    **游戏在前台时 `main._after_restore()` 会跳过 `window.resize()`**：pywebview 的 resize 用
    `SetWindowPos(..., SWP_SHOWWINDOW)`，会把笔记重新激活、抢走游戏焦点；矩形已经由
    `SWP_NOACTIVATE` 放回，只需要 `apply_book_region()` 重裁区域；
  - 外部最小化（Win+D / 任务栏）也接住了：WinForms 后端的 `events.minimized` 保存
    `GetWindowPlacement().rcNormalPosition`，`events.restored` 时纠正矩形、尺寸和窗口区域；
  - 游戏里日志是 J 键；Ctrl+J 是组合键，不会触发日志，也只在恐鬼症/笔记前台时注册。
  - `run()` 的每次 `_step()` 都单独包 `try/except`：一次轮询异常只会记日志（同类错误 5 秒
    最多一次）并继续，不会再静默杀死整个热键线程。`RegisterHotKey` 失败也有限频日志，仍每
    2 秒重试。`hotkey.stop()` + `join()` 在 `webview.start()` 返回后执行。
  - **热键线程的停止事件叫 `_stop_event`，绝不能叫 `_stop`**：`threading.Thread` 自己有
    内部方法 `_stop()`，重名会让 `join()` 抛 `TypeError: 'Event' object is not callable`
    （2026-10-18 实际踩过，已修）。
- **点窗口外面就收起（2026-10-28）**：挂 WinForms 的 `Form.Activated` / `Form.Deactivate`
  （`_ensure_deactivate_hook`，只在 UI 线程挂一次）。**Deactivate 里只记时间戳
  `_hide_pending_at`，真正最小化交给轮询线程 `_maybe_hide_pending` 等 `HIDE_DELAY=0.20s`
  后复核**——一开始是当场 `SW_MINIMIZE`，结果点窗口自身时激活会在窗体和 WebView2 子控件
  之间抖一下，立刻收和紧接着的 Activate 打成来回，用户看到的是**窗口疯狂闪烁**。延迟复核
  顺手还挡掉了「刚收又被弹回来」的情况（另有 `_last_hide_at` 0.5s 冷却）。
  三个例外：**任务栏**（交给任务栏那套逻辑，否则按钮点不动）、**游戏在前台**
  （笔记是压在游戏上的悬浮层，收了就没法边玩边看）、**刚启动/刚被 Ctrl+J 叫回来的
  1.2s / 0.35s 宽限期**。复核时用轮询线程里的 `fg_self / fg_taskbar / game_foreground()`
  三个判据，都没命中才 `self._ui(self._minimize_on_ui)`。
  验证记录：切到别的程序 → 0.2s 后收起；Ctrl+J → 叫回且焦点在笔记上；再切走 → 再收起；
  点笔记正文（含书脊）不触发任何收起。
- **任务栏按钮能真正隐藏（根因）**：pywebview 的无边框窗口默认没有 `WS_MINIMIZEBOX`，
  点活动窗口的任务栏按钮时 Windows 发出的最小化命令会被直接忽略，看起来就是“点了没反应”。
  `hotkey.py` 每 40ms 检查窗口样式，缺了就补上（不改变外观，也没有标题栏按钮）；
  样式位被 pywebview 改回去时会自动恢复。2026-10-18 用户实测确认修复。
- **游戏置顶时第一次点击也隐藏**：Windows 对“未激活但可见”的窗口，第一次点任务栏按钮只激活、
  不最小化；笔记置顶时同样像没反应。`hotkey.py` 每 40ms 记录前台历史：如果窗口本来处于
  “游戏/笔记在前台”的置顶状态、可见且未最小化，因点击任务栏而激活，就主动 `SW_MINIMIZE`。
  从最小化状态点任务栏恢复时不补刀；从浏览器等普通程序点任务栏叫回笔记时仍保持正常的
  “切到前台”行为，不会误藏。
- 启动尺寸 = **程序最大尺寸**：屏幕边距 12px 内保持 1120×895 的窗口比例，高度顶满。
  本机逻辑尺寸 1305×1043（150% 缩放下实测物理外框 1957×1564）。尺寸固定：没有 A−/A+，
  `resizable=False`，也不能拖边缘缩放。
- `create_window(width, height)` 按外框算，会少掉一圈边框；`shown` 事件里再 `window.resize(w, h)`
  一次，实测能把内容区顶到计算出的最大值。别删这个补偿。
- 配置：`%APPDATA%\PhasmophobiaJournal\config.json`（日志在同目录 `journal.log`），字段 `x / y / width / height`
  （`on_top` 已随置顶按钮移除）。`width / height` 仍记录，但启动时尺寸固定为最大值，不读取。
- 启动位置沿用配置里的 `x / y`（逻辑像素，不可见则居中）；点关闭按钮或最小化时保存几何。
- 屏蔽 F5 / Ctrl+R 刷新和 Ctrl+滚轮缩放；全局屏蔽右键菜单，但**右键鬼名**会打开资料页。
- **按住鼠标拖动滚动（2026-10-29）**：`.common-body` / `.detail-body` / `#cursedBody` /
  `#cursedDetailBody` 四个滚动面板原来只能用滚轮，按住左键拖没反应。`app.js` 里的
  `enableDragScroll()` 补上了「抓着纸面拖」：记下 `mousedown` 时的 `clientY` 和 `scrollTop`，
  `mousemove` 时按 `startTop - dy` 设回去。三个必须保留的细节：
  **① 移动不到 4px 不算拖动**（否则会把正常点击吞掉）；**② 拖完之后那一次 `click`
  用 capture 阶段 `once` 监听吞掉**（否则在返回按钮上拖动，松手会误触发返回）；
  **③ 内容本来就没溢出（`scrollHeight <= clientHeight`）时不接管鼠标**。
  `body.drag-scrolling` 负责拖动时的 `grabbing` 光标和禁止选中文字。
  测试：`node tools/test_drag_scroll.mjs`（6 项，headless Edge + CDP 真鼠标事件）。
- **鬼魂详情页头（2026-10-29，定稿）**：标题行现在是 `女妖 Banshee … ← 返回鬼名` 一行：
  **英文名紧贴中文鬼名右侧**（同一基线，字号 2.35cqh），**返回鬼名顶到行尾**（`margin-left:
  auto`，正好落在下面分隔线右段上方），原来那行 `.detail-sub` 副标题整行删掉了。
  `#detailSubText`（资料名 / 别名，几乎总是空）也并进这一行，`:empty { display: none }`
  不留空位。**分隔线高度对齐**：`.detail-rule` 的 `margin-top` 从 `.25cqh` 改成 `.15cqh`、
  `height` 改成 `1.15cqh`，跟左页 `.title-rule` 完全一致——删掉副标题行之后鬼名行的底边
  正好等于左页大标题的底边（都是 133px），两条分隔线都落在 **y=134**。
  改高度对齐时别把副标题行加回来，一加就掉回 160px。
  诅咒之物详情（`#cursedDetail`）仍是「标题 + 副标题 + 线」的老结构，线在 158px，
  没动——要一起对齐的话把它的英文名也内联进标题行。

## 显卡与流畅度（2026-10-25）

- **走核显**：`main.py` 启动时给 `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` 追加
  `--force_low_power_gpu`，只作用于本程序的 WebView2 实例，不改系统「图形设置」，
  也不影响其他程序；调用方已经设好的参数（例如调试端口）会保留。
  本机屏幕接在核显上（NVIDIA 控制面板里 `display_active=Disabled`），核显画界面反而更顺：
  独显当时在跑别的负载，实测最大帧 283ms vs 核显 125ms。界面全是 2D 文字，
  核显绰绰有余，独显留给游戏。
  **排查显卡问题时**用 `set PHASMO_LOW_POWER_GPU=0` 启动即可临时改回默认（独显）。
  验证方法：CDP 的 `SystemInfo.getInfo` 看 `glRenderer`——核显是
  `ANGLE (Intel, Intel(R) Iris(R) Xe Graphics ...)`，独显是 NVIDIA RTX 2050。
- **证据行悬停高亮延迟（用户反馈的那一下）根因与修法**：
  1. `.page-surface` 的 `filter: drop-shadow(...)` 换成 `box-shadow`。filter 会把整块纸面
     合并成一个渲染层，鼠标一划过证据行就要重绘整页，核显上直接掉帧；
  2. `.ev` 的悬停底色**完全不做过渡**（`opacity .2s` / `transform .12s` 保留）。
     实测从「鼠标进入 → 90% 亮度」：`.15s` 112ms、`.08s` 57ms、**不设过渡 2~5ms（下一帧就亮）**。
     底色只有 5.5% 浓度，硬切不刺眼；`.cursed-name` 的悬停底色同样改成不加过渡；
  3. `.ghost` 加 `will-change: opacity`：勾证据会同时淡出多只鬼，提前分层后
     透明度变化走合成，不再逐帧重排文字。
  实测（核显、120Hz、CDP 采 rAF 帧间隔）：悬停最大帧 **75.2ms → 25.1ms**，
  >17ms 的帧 12 → 5，**>33ms 的帧 0**；点击证据同样从最大 75.2ms 降到 25ms。
- **翻页动画**：见上面「翻页动画」的宽度补偿/起翻前空等两帧两条。
  实测 6 次翻页合计 >33ms 的帧 20 → 7，最大帧 75 → 67ms。
- **测量方法**：`tools/gpu_latency_probe.mjs`（CDP 采样 rAF 帧间隔）。
  **窗口被挡住/最小化时 rAF 会暂停**，采样会拿到几万毫秒的假帧，量之前先把笔记摆在最前面。
  18~25ms 的帧在 120Hz 上就是掉帧，>33ms 肉眼能看出来。

## 分享打包（2026-10-21）

- 命令：`python tools/build_share.py`，或双击纯 ASCII + CRLF 的 `build_share.bat`。
- **版本号唯一来源**：`version.py` 的 `APP_NAME_BASE` / `APP_VERSION`。改版本只改这里；
  窗口标题（`main.py`）、exe / 文件夹 / zip 名称（`build_share.py`）、使用说明标题都会跟着变。
  `app/index.html` 的 `<title>` 仍是手写的，升版本时要同步改（冒烟测试会核对）。
- PyInstaller 6.19.0，`--onedir --windowed`；产物 `dist\恐鬼症笔记 v1.2\`，再打成
  `dist\恐鬼症笔记 v1.2-分享.zip`。**2026-10-27 v1.2：文件夹 32.0 MB，zip 17.8 MB**；
  **2026-10-29 v1.3（加了拖动滚动）：文件夹 32.0 MB，zip 17.8 MB**，
  内容 = v1.1 的全部 + 四张素材换成自制（可公开分发）。打包版冒烟测试 12/12 通过。
  （v1.1：32.4 MB / 18.0 MB，带游戏贴图，只在本机留档）
- `app\` 打进 `_internal\app`；鬼魂资料复制到 exe 同级的 `资料\`，程序优先读这一份，
  所以朋友可以直接改 md。`使用说明.txt` 由脚本生成在 exe 旁边。
- **必须排除 PyQt5/PyQt6/PySide2/PySide6**：Windows 下 pywebview 固定走
  edgechromium → WinForms，Qt 后端完全用不到；不排除会从 32 MB 涨到 112 MB。
- 分享包不含 `extracted/`、`.backup/`、`tools/`、`legacy/`、测试脚本、`启动笔记.bat`、
  `build/`、`__pycache__`。朋友不需要装 Python，但需要 Edge WebView2 Runtime
  （Windows 11 自带；Win10 没有就装微软官方运行时）。
- 单实例互斥照常生效。测试时如果用 `--allow-multi` 同时开开发版和打包版，
  两个 WebView2 会抢同一个用户数据目录，第二个会报 `E_ABORT`；这不是打包坏了，
  单独开打包版正常。冒烟测试前先关掉开发版。
- 冒烟测试：`node tools/smoke_packaged.mjs`（加 `--single` 则不加 `--allow-multi`，
  模拟朋友双击；脚本从 `version.py` 读出目录和 exe 名）。通过 WebView2 的 CDP 端口检查窗口标题、30 个鬼名、7 条证据、
  `get_ghost_info()` 的 `source` 确实指向 exe 旁的 `资料`、右键详情有内容、
  以及日志里没有 WebView2 初始化错误。

## 开源发布（2026-10-27 起）

- 仓库：`github.com/<账号>/phasmophobia-journal`，公开，**MIT**（`LICENSE`）。
  数据文件 `app/ghost_info.js` 内容源自社区 Wiki（CC BY-SA 3.0），README 里已标注。
- **进仓库**：`main.py` / `hotkey.py` / `ghost_info.py` / `applog.py` / `layout.py`、
  `version.py`、`app/`（含 `assets/` 与 `OFL.txt`）、`tools/`（含 `gen_assets.py`）、
  `README.md`、`LICENSE`、`docs/screenshot-main.png` / `docs/screenshot-detail.png`（首页 / 详情页）、`.gitignore`、`FILE_INDEX.md`。约 7.7 MB。
- **不进仓库**（`.gitignore`）：`extracted/`（820 MB 游戏解包）、`dist/`、`build/`、
  `.backup/`、`legacy/`、`__pycache__/`、`tools/_asset_preview/`。
- Release 附件：`dist\恐鬼症笔记 v1.2-分享.zip`。
- **2026-10-29 发了 v1.3**：附件 `phasmophobia-journal-v1.3-win64.zip`（18.6 MB，由
  `dist\恐鬼症笔记 v1.3-分享.zip` 复制改名）+ 两张截图 `screenshot-1.png`（首页）、
  `screenshot-2.png`（鬼魂详情），正文用绝对地址
  `https://github.com/l0vedier/phasmophobia-journal/releases/download/v1.3/screenshot-N.png` 嵌图。
  账号 2026-10-29 已开 2FA（KeePassXC），`gh auth login` 网页授权可用，**不再需要 PAT 文件**；
  推送命令见下。
- **推送（2026-10-29 起）**：凭证由 `gh auth login --hostname github.com --git-protocol https --web`
  写入 Windows 凭据管理器，然后
  `git -c credential.helper= -c credential.helper='!"C:/Program Files/GitHub CLI/gh.exe" auth git-credential' push`。
  只写 `-c credential.helper=` 会连 gh 的 URL 作用域 helper 一起清掉，报 "could not read Username"。
- `gh release create/upload` 的 `文件#改名` 语法对绝对路径**不生效**（资产名仍然是原文件名），
  想换名就先把文件复制成目标文件名再传。
- **gh 登录踩坑**：瓦特工具箱（Steam++）加速会把 `github.com` 等域名写进 hosts 指到 127.0.0.1，
  gh 的浏览器授权（OAuth device flow）经它一律 HTTP 502；`api.github.com` 和 git 推送倒是正常。
  解决：托盘里**关闭加速**（只退出程序不够，hosts 要还原），登录完再开回来。

## 测试

```bat
cd /d "E:\Claude code\phasmophobia-journal"
node tools/test_ui.mjs
node tools/test_flip.mjs
```

- 无头 Edge + Chrome DevTools Protocol，不装 npm 依赖。
- **2026-10-27 打包 v1.1：`smoke_packaged.mjs` 12/12 通过**（窗口标题 `恐鬼症笔记 v1.1`、
  30 鬼、7 证据、exe 旁资料源、右键详情、WebView2 无初始化错误、启动/退出日志干净）。
- **2026-10-25 流畅度改动后：`test_ui.mjs` 160/160、`test_flip.mjs` 31/31、
  `test_cursed.mjs` 33/33 全部通过**（只改样式和翻页几何，`test_ghost_info.py` 未动数据，未重跑）。
  同步改了 3 处断言：`test_ui` 的纸面阴影从 `filter` 改成查 `box-shadow`；
  `test_flip` 的「起点对齐」改成比快照自己的矩形（纸页容器现在固定 51%）；
  「正在旋转」改成比 `transform` 变化 + 宽度不变 + 快照 `offsetWidth` 不变。
  随后把证据行 / 诅咒之物的悬停底色改成不加过渡，`test_ui.mjs` 和 `test_cursed.mjs` 重跑仍全过。
- **2026-10-21 重新打包后冒烟测试：`smoke_packaged.mjs` 11/11 通过**（`恐鬼症笔记 v1.0`
  窗口标题、30 鬼、7 证据、资料从 exe 旁边的 `资料\` 读取、右键详情含达彦、
  日志无 WebView2 错误、正常启动和退出）。
- **2026-10-21 通用规则新增「理智被动掉落」+ 每分钟参考：`test_ghost_info.py` 23/23 通过**
  （通用规则 11→13 条，`app/ghost_info.js` 已重新生成，56529 字节）。新规则覆盖地图大小
  基础掉速、部署期掉速与 50% 下限、单人减半、难度/血月倍率、主灯 80%、火光减免、调查区外不扣；
  参考条按小/中/大列出业余、中级、专家·噩梦·疯狂的每分钟掉速及三档血月数值，单人减半。
- **2026-10-21 诅咒之物第二页：`test_ghost_info.py` 23/23、`test_ui.mjs` 160/160、
  `test_flip.mjs` 31/31、`test_cursed.mjs` 33/33 全部通过**。新增断言覆盖：右下角翻页页脚、
  名片翻到第二页、左页 10 条规则、右页 7 件物品、第二页无重置入口、名字淡出/淡入、
  通灵板问题表 13 条与问法 12 条、猴爪愿望 10 个、左页页脚直接回鬼名、
  Esc 逐级返回、减少动态效果不建翻页快照。
- **2026-10-21 左通用规则 / 右鬼魂介绍 + 翻页动画：`test_ui.mjs` 160/160、
  `test_flip.mjs` 31/31 全部通过**。主测试改用 `?noflip=1` 跳过动画；新增断言覆盖：
  打开详情后左页显示「通用规则」（13 条、可滚动、从顶部开始）、证据/页脚隐藏、右页不再含
  通用规则、返回后证据与鬼名单/圈恢复。`test_flip.mjs` 用正常 URL 覆盖：
  正反两向快照的正反面内容、起止位置与 51%/49% 页宽精确对齐、翻页中宽度补偿、
  实际页在动画结束才切换、翻页中点击证据 / 返回 / Esc 被忽略、快照无重复 id、
  通用规则滚动位置保留、动画结束无残留 `.page-flip`。
- **2026-10-21 通用规则 7→11 条后重跑：`test_ghost_info.py` 17/17、`test_ui.mjs` 160/160、
  `test_flip.mjs` 31/31 全部通过**。`test_flip.mjs` 的通用规则条数改为从
  `GHOST_INFO_FALLBACK.common.length` 读取，以后再加规则不用改硬编码；另加 4 项
  “通用规则滚动复位”断言（无动画 / 翻页两条路径各 2 项）。
- 以下 2026-10-18 ~ 10-19 的记录是**旧布局（详情只替换右页）**下的历史结果，保留备查。
- 2026-10-18 详情页正文字号调大后另用无头探针核对（未整套重跑）：1305×1043 下正文 22.3px、
  证据行 23.7px，880×700 下正文 15.9px；两档均无横向溢出、内容可滚动，标题/返回位置不变。
- **2026-10-18 拆分 `styles.css` / `app.js` 后重跑：153 项全部通过**（新增 2 项：接口失败时
  仍显示兜底详情、并出现「资料读取失败，当前显示内置快照」提示）。
- **2026-10-18 视觉微调后重跑：153 项全部通过**（右上角关闭去掉深色圆底，改成手写一笔 ×，
  可见字形定为约 35px、热区 35×35，并移到内页右上角；鬼名圈改成单笔规整椭圆，测试里
  “两道笔迹”的断言全部改为 1 条路径）。
- 2026-10-18 全部通过（**153 项**）：1120×895 / 880×700 / 1500×1000 / 默认最大 1305×1043 布局、
  初始圈魂魄、证据三态、单圈切换、悬浮淡出、圈/线随鬼同步淡出、拟魂灵球不算证据、重置；
  另验证 × 是两道 CSS 线、证据线起点对齐方框且穿过方框、线加粗到 2.2px、圈/线/× 均无描画动画、
  勾选正向筛选、划除反向筛选、勾选+划除组合、划除 ORB 时拟魂不受影响、A−/A+ 按钮已移除；
  以及透明背景、顶部拖动区、**只有关闭按钮（35×35，位于内页右上角，无最小化/置顶按钮）**。
  鬼魂详情页新增 34 项：右键打开、只替换右页、左页仍可操作、详情在右页范围内、返回按钮压过拖动区、
  返回按钮在鬼名右侧同一行（默认最大尺寸和 880×700 各查一次）、详情标题与「证据」字段左对齐、
  标题/英文名、加鲁全部字段、行内粗体、长内容滚动、重开回到顶部、通用规则、30 只鬼全部能解析到
  完整字段、三个名字映射、返回后重画圈、Esc 先返回再重置、880×700 下不横向溢出；
  接口 reject 时仍显示兜底详情并给出「内置快照」提示。
  布局另新增 3 项：鬼名三列居中，每列 10 个名字中心点一致、中列中心等于网格中心，
  1120×895 / 880×700 / 1305×1043 各查一次。2026-10-18 皮面书壳改动后新增 3 项：
  `.book` 有圆角皮革封面、`.page-surface` 内缩且有 drop-shadow、页层框架底色不透明；
  原来的“无皮革/无投影”两项已删除（方向反过来）。

- **2026-10-19 资料改名后同步**：md 章节 `达魇` → `达彦`，重新生成 `app/ghost_info.js`
  （43,057 B），`tools/test_ghost_info.py` 17/17、`tools/test_ui.mjs` 153/153 全部通过；
  `[12c]` 现在把 `达彦` 当作同名章节，不再期待「资料名：达魇」。
- 2026-10-19 打包版冒烟：11/11 通过（旧布局，32.1 MB 的版本）。
- **2026-10-21 重新打包后冒烟：11/11 通过**（`node tools/smoke_packaged.mjs --single`；
  窗口标题、30 鬼、7 证据、exe 旁资料源、右键详情、WebView2 初始化、
  启动/退出日志均正常，右键详情已带左通用规则 / 右鬼魂介绍的新结构）。

真实窗口测试（透明 / 穿透 / 拖动 / Ctrl+J）：

```bat
python tools\test_window_features.py
```

- **2026-10-18 结构整理后重跑：25 项全部通过**（几何常量改为从 `layout.py` 导入；测试启动参数
  加了 `--allow-multi`，避免和正在使用的笔记抢单实例/Ctrl+J）。书壳外透明、点击穿透、
  顶部拖动 60×36、Ctrl+J 最小化/唤回、从普通程序唤回后笔记获得前台焦点、尺寸/位置不变，
  外部最小化（模拟 Win+D / 任务栏）后按 Ctrl+J 也能原样唤回、两次唤回后透明与穿透都保留、
  关闭干净；动态置顶三项（笔记在焦点时置顶、切到另一个程序后取消置顶、再切回笔记恢复置顶）。
  书壳四角在 `SetWindowRgn` 区域外（真的被圆角裁掉）、左右直边仍在区域内。
- 书壳圆角由 `CreateRoundRectRgn` 与 CSS `border-radius: 1.15%` 同步；窗口测试在书壳外的
  左右取样点仍透明/穿透。四角圆角外的区域由系统区域裁掉；无头 Edge 截图里四角是白色，
  那是截图合成背景，不代表真实窗口。`legacy/book_mask.py` 不再参与边缘验证。
- 唤回后的“透明”像素采样依赖 Tk 垫块当时真的可见，偶发失败过（实测一次 `(18,19,20)`，重跑即过）。
  遇到先把 `GetWindowRgn + PtInRegion` 和点击穿透跑一遍：二者通过就说明区域没丢，不要急着改区域代码。
- 测试会在窗口左右两侧各垫一块 320×400 纯色块（**不要改成全屏**，2026-10-18 全屏洋红把用户屏幕
  染紫过），结束后立即销毁；色块必须置顶，再把笔记 `SetWindowPos(HWND_TOPMOST)` 抬到色块上方，
  否则最小化时切到前台的普通窗口会盖住色块造成假失败。每次采样前 `root.update()` 让 Tk 重绘。

任务栏点击隐藏测试（针对性，不重跑其他项）：

```bat
python tools\test_taskbar_hide.py
```

- **2026-10-18 24 项全部通过**（与窗口测试一样用 `--allow-multi` 启动；运行前仍会检查
  没有其他笔记实例，避免抢 Ctrl+J）。这次“快速连按不吞键”先是稳定失败（两次热键都处理了，但恢复后
  笔记抢走游戏焦点）；根因是 pywebview 的 `window.resize()` 带 `SWP_SHOWWINDOW`，会在恢复后
  重新激活笔记。修法：恢复时只认 `game_foreground()`，游戏在前台就跳过 `window.resize()`。
  测试自己启动一个假 `phasmophobia.exe`
  （复制 pythonw.exe 改名 + Tk 窗口）和一个普通 Tk 窗口。先确认新实例带 `WS_MINIMIZEBOX`；普通程序在前台时
  点笔记任务栏按钮只切前台、不隐藏；笔记在前台时再点一次任务栏按钮会真正最小化，并可恢复
  （对应“点了没反应”的根因）；假游戏在前台时笔记置顶且可见，第一次点任务栏按钮即最小化、
  焦点仍在游戏；再点一次恢复且不会马上又被收起、恢复后的矩形不变。假游戏前台时另外按两次
  Ctrl+J：第一次隐藏、第二次恢复且焦点仍在游戏；随后 100ms 内快速连按两次，两次都生效
  （隐藏后再显示），不会被吞键。测试会短暂移动鼠标到任务栏按钮，结束后恢复原位置。
- 改 `hotkey.py` 的前台 / 置顶 / 最小化代码后跑它，再跑 `test_window_features.py`。
- 单实例手工验证（2026-10-18）：起第一个实例 → 最小化 → 起第二个；第二个约 0.33 秒退出，
  第一个被唤回，按标题只找到 1 个窗口。第二个进程退出码 0。

鬼魂资料解析测试（不启动窗口）：

```bat
python tools\test_ghost_info.py
```

- **2026-10-21 全部通过（23 项）**：在原有 17 项上新增 7 件诅咒之物、10 条诅咒通用规则、
  45 个诅咒字段、7 个名字全部能解析、通灵板问题表 13 / 问法 12 / 碎裂条件 4、
  塔罗牌 10 张、猴爪愿望 10 个。兜底一致性检查覆盖整个返回对象（含 `cursed_common` / `cursed`）。
- 2026-10-18 全部通过（**17 项**）：md 存在且能解析、30 只鬼 / 244 字段 / 7 条通用规则、
  30 个界面名都能对上章节、三组别名、5 只样例鬼的英文名和关键字段、每只鬼至少有证据、
  拟魂的假灵球说明还在、`Api.get_ghost_info()` 能调用、`app/ghost_info.js` 与 md 同步。
  **改完 md 后**：先跑 `python tools/gen_ghost_info.py`，再跑这条测试，最后 `test_cursed.mjs` /
  `test_ui.mjs` / `test_flip.mjs`。

启动黑屏自检（可选）：

```bat
powershell -NoProfile -ExecutionPolicy Bypass -File tools\diagnose_black_window.ps1 -Runs 6
```

## 已知坑

- **`Api` 里的窗口引用必须叫 `self._window`，不能叫 `self.window`。** pywebview 会把 `js_api` 对象的公开成员
  暴露给 JS；公开的 `window` 属性会让窗口创建后假死（窗口看得见，但消息循环不响应，`Responding=False`）。
  2026-10-18 实际踩过：把属性改成 `_window` 后恢复正常。用 `tools/check_windows.ps1` 可看到主窗口
  `reply=1`（正常）或 `reply=0`（假死）。
- **不要在 `window.events.closing` 里读 `win.x / win.width` 保存配置。** 关闭瞬间这些属性会走
  WebView2/UI 线程，和关闭流程互相等，导致 Alt+F4 / 任务栏关闭假死（窗口不消失、`reply=0`）。
  2026-10-18 已移除该事件绑定，WM_CLOSE 实测干净退出；几何保存只走界面上的关闭按钮（`Api.close()`
  里先 `_save()` 再 `destroy()`）。
- **透明窗口的 `window.resize()` 是裸 `SetWindowPos`，不会更新 WinForms 的 `RestoreBounds`。**
  最小化后恢复会回到创建时的小尺寸。`HotkeyToggle` 在最小化前保存 `form.Left/Top/Width/Height`
  （物理像素），并用 `GetWindowPlacement().rcNormalPosition` 接住外部最小化；唤回时 `SetWindowPos`
  原样放回，再 `apply_book_region()`；游戏在前台时**跳过** `window.resize()`（见下一条）。
  最小化只走 Ctrl+J 键 → `HotkeyToggle.minimize()`，不要直接 `window.minimize()`
  （`Api.minimize()` 仍保留给 JS，但界面上已没有按钮调用它）。
- **`window.resize()` 会抢焦点**：pywebview 的实现是 `SetWindowPos(hwnd, None, x, y, w, h, 64)`，
  64 = `SWP_SHOWWINDOW`，没有 `SWP_NOACTIVATE`。游戏前台时恢复笔记如果还调它，会把游戏焦点
  抢回笔记；`main._after_restore()` 因此在 `hotkey.game_foreground()` 为真时只重裁区域。
  这是 2026-10-18 快速连按测试失败的根因，别再“顺手”把 resize 加回所有恢复路径。
- **`window.events.shown` 的处理器在单独线程执行**（`Event.set` 会新开线程），改 WinForms/窗口区域
  必须 `form.Invoke(Action(...))`；`apply_book_region()` 已做。`minimized` / `restored` 同样是新线程，
  处理器里只读 Win32 状态，UI 操作一律 `Invoke` 回主线程。
- **窗口区域随窗口尺寸变化**：`shown`、M 唤回、外部恢复后都要重新 `apply_book_region()`。
- **窗口区域和窗体底色是一套，别只改一边**：区域现在是圆角书壳：矩形/CSS 尺寸一致，
  圆角在 CSS 是 `border-radius: 1.15%`，在 Python 是 `layout.py::COVER_RADIUS = 0.0115`；
  改一边必须同步另一边。`form.BackColor` 必须是深皮革色 `#2E1A0E`
  （`Color.FromArgb(46,26,14)`）；改回奶油色会在圆角外缘出现亮边，改回默认 `#F0F0F0` 会白边。
  `legacy/book_mask.py` 已不参与窗口区域，换书页素材不用再重新生成；CSS 的 alpha 蒙版仍直接用 PNG。
- **拖动区必须由 WebView2 收到 mousedown**：窗口未聚焦时第一次按下会被系统用于激活窗口。
  真实鼠标测试要先点一下窗口取焦点再拖；实际使用时点一下拖动区再拖是正常操作。
- **不要从后台线程直接改 WinForms 的 `TopMost`。** pywebview 的 `window.on_top` setter
  直接写 `i.TopMost`，不 `Invoke`。动态置顶由 `HotkeyToggle._set_topmost()` 经
  `form.Invoke(Action(...))` 执行；以后再加置顶相关逻辑也照这个做。
- **测试垫色块的两个前提**：色块置顶 + 把笔记 `SetWindowPos(HWND_TOPMOST)` 抬到色块上面。
  否则要么被最小化时切到前台的普通窗口盖住（假失败），要么色块盖住笔记（透明测试失去意义）。
  采样前还要 `root.update()` 让 Tk 重绘。启动后约 0.5 秒内是深色背景属正常；`tools/diagnose_black_window.ps1`
  可区分「还没画」和「一直黑」。

## 已知限制 / 待做

- **诅咒之物第二页已实装**（2026-10-21）：鬼名页右下角翻到第二页，左页 10 条诅咒规则、
  右页 7 件物品；名字到介绍用整页淡出/淡入，不翻页。数据仍由用户维护同一份 md；
  改完 md 要重启笔记，并跑 `python tools/gen_ghost_info.py` 更新兜底快照。
- **`dist\` 已重新打包为 v1.1**（2026-10-27）：含诅咒之物第二页、13 条通用规则、
  核显切换（`--force_low_power_gpu`）和 10-25 的流畅度修复（悬停零延迟、翻页只动 transform）。
  升版本改 `version.py` 后跑 `python tools/build_share.py`；旧版本的 `dist` 文件夹和 zip 要手动删。
- **鬼魂详情页已改版**（2026-10-21）：右键鬼名，**左页显示通用规则，右页显示该鬼介绍**，
  两页同时切换。打开时右页向左翻（笔记往后翻一页），返回时左页向右翻（笔记往前翻一页），
  动画约 0.52 秒；动画进行中点击证据 / 鬼名 / 返回和 Esc 都会被忽略。
  `prefers-reduced-motion: reduce` 或 URL 加 `?noflip=1` 时直接切页。
  资料每次启动读一次，改完 md 要重启笔记；兜底快照 `app/ghost_info.js` 用
  `python tools/gen_ghost_info.py` 更新。暂无搜索框/章节跳转。
- **划除筛选已实装**：`applyEvidenceFilter()` 同时读取 `checked`（必须有）和 `crossed`（必须没有）；
  以后改筛选规则只动这里，别把划除又当成纯记号。
- 勾选框现在是 CSS 手绘 ×，`legacy/assets/tick.png` 保留但不再被引用；要改 × 的笔画看 `.tick::before/::after`。
- 窗口固定为最大尺寸，没有缩放按钮，也不能拖边缘缩放；换屏幕分辨率时重启程序会重新计算最大尺寸。
- 置顶是动态的：恐鬼症或笔记在前台时置顶，其他程序在前台时是普通窗口。如果以后游戏里看不到笔记，
  先确认 `HotkeyToggle._foreground_allowed()`（置顶）和 `game_foreground()`（恢复时是否抢焦点）
  都认得出游戏进程名 `phasmophobia.exe`。
- **Ctrl+J** 只在恐鬼症/笔记前台或笔记最小化时注册；其他程序在前台时故意不占用 Ctrl+J。
  若别的程序已经注册了全局 Ctrl+J，`RegisterHotKey` 会失败，热键线程每 2 秒重试一次，
  并最多每 10 秒写一条 warning 日志；不会再静默失败。
- 游戏文件全程只读，未写入游戏目录。

## 2026-11-02 v1.4：启动自检（按这个顺序改，别打乱）

起因：有人从 GitHub 下了**源码包**（Code → Download ZIP），双击 `启动笔记.bat`，
黑框一闪就没了 —— 那台电脑没装 Python。于是把"打不开"的各种情况都做成弹窗自解释。

- `main.py` 新增 **preflight()**，在 `main()` 里 `claim_single_instance()` 之后、建窗口之前调用，
  顺序不能变（先判断自己是不是在临时目录，再判断文件，再判断 WebView2，最后判断资料）：
  1. `_in_temp_dir()` —— exe 在 `%TEMP%` 下 = 在压缩包里直接双击，提示"先全部解压"
  2. `INDEX.is_file()` —— 缺 `app/index.html`（frozen 后就是 `_internal\app`），提示别只拿 exe
  3. `_webview2_version()` —— 查三处注册表 `EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}` 的 `pv`；
     缺失时 `_ask()` 弹「是/否」，点「是」用 `webbrowser` 打开微软官方下载页
  4. `_ghost_data_missing()` —— 用 `ghost_info.default_ghost_md()` 找 `资料\恐鬼症_鬼魂数据_分鬼版.md`
- `_ask()` 是 0x04|0x30（是/否 + 警告图标）的 MessageBoxW，返回 True = 用户点了「是」
- `__main__` 的兜底异常：不再甩英文堆栈，改成「错误：<最后一行>」+ 日志路径 + "把日志发给作者"
- `version.py` → `1.4`；`app/index.html` 的 `<title>` 同步改 `v1.4`（两处都要改）
- `README.md` 重写：顶部直接给 Releases 直链、贴文件夹结构、写明**不要点 Code → Download ZIP**、
  加"打不开怎么办"对照表。以后再有人问"打不开"，先让他看 README 那张表。
- Release 资产名必须 ASCII：`dist\恐鬼症笔记 v1.4-分享.zip` 要复制成
  `dist\phasmophobia-journal-v1.4-win64.zip` 再上传（中文名会被 GitHub 剥成 `v1.4-.zip`）
- **原版素材版要同步**：只改 `main.py` + `version.py`（→ `1.4-原版素材`）+ `index.html` 的 title，
  `app/` 其它素材不要覆盖，然后重跑那边的 `tools/build_share.py` 并重打分享 zip

## 2026-11-02 手机版（安卓 / 锁竖屏 / 一次只看一页）

- `mobile/` = 纯前端，直接双击 `mobile/index.html` 就能看；`android/` = 手工打包工程（**没有用 Gradle**）
- 四页横滑：**证据 → 鬼魂 → 诅咒之物 → 通用规则**。左右边缘各有一个半透明箭头 + 下一页名字，
  用 `writing-mode: vertical-rl` 竖排；第一页没有左箭头、最后一页没有右箭头（`.edge-hint.show` 控制）
- 交互和桌面版对齐：证据 normal → checked → crossed 三态，筛选规则仍是
  `checked.some(k => !g.ev.includes(k)) || crossed.some(k => g.ev.includes(k))`；
  鬼名点一下圈住、再点划除、划除再点取消
- **鬼魂资料在手机上是「长按鬼名」弹底部浮层**（桌面版是右键），长按 480ms，手指移动 >12px 就取消；
  长按后的那次 click 必须吞掉，否则会顺手把鬼名选中
- `window.__onBack()`：先关浮层 → 再退上一页 → 都没有才返回 `"exit"`；
  `MainActivity.onBackPressed()` 用 `evaluateJavascript` 读返回值决定要不要 `finish()`
- 打包装包：双击 `android\build.bat`（aapt2 compile → link → javac → d8 → python 追加 classes.dex →
  zipalign → apksigner）。产物 `android\恐鬼症笔记.apk`，约 4.9 MB，minSdk 21 / targetSdk 34
- **keystore 不能换**：`android\keystore\journal.keystore`，别名 `journal`，密码 `phasmo2026`。
  换 key 后新包不能覆盖安装，只能先卸载（笔记状态不落盘，卸载无损失）
- 坑：
  - `.page` **不能加左右 margin**，否则 `translateX(-100%)` 每页都会漂；现在是 `flex: 0 0 100%; margin: 0`
  - `aapt2 link -A ..\mobile` 会把整个 mobile 目录塞进 assets，所以 `android/` 必须放在 mobile **外面**，
    否则会把 build 产物自己打进 apk
  - d8 的 `classes.dex` 用 python `zipfile` 追加；**别用 `jar`**，这台机器 PATH 上的是 `D:\mcjava\bin` 的旧 jar
  - zipalign 报 "header mismatch" 是 png 对齐警告，可以忽略
- 改数据时两处要一起改：`mobile/mobile.js` 顶部的 `EVIDENCE` / `GHOSTS` 与 `app/app.js` 保持一致；
  鬼魂正文来自 `ghost_info.js`（复制自 `app/`，改完重跑 `python tools/gen_ghost_info.py` 再复制一次）
- 自测（Edge headless 注入脚本）：证据三态 + 筛选 17↔13、鬼名圈住/划除、长按浮层 8 段正文、
  滑动翻页与末页钳位、返回键逐级回退全部通过；**真机还没测**

### 2026-11-02 手机版补丁：鼠标拖动 + 提示放大

- 翻页拖拽抽成 `dragStart/dragMove/dragEnd`，触摸和鼠标共用一个判定；没有 `ontouchstart` 的环境
  （电脑浏览器预览）额外挂 `mousedown/mousemove/mouseup`，并给 `body` 加 `.no-touch` 出 `cursor: grab`
- 边缘提示从纯文字改成**竖排圆角卡片**：宽 46px、纸色 88% 不透明、箭头 30px、名字 16px，
  `.page` 左右内边距同步加到 30px，避免卡片压住正文
- **bat 坑**：调用别的 .bat（`d8.bat`、`apksigner.bat`）必须写 `call`，否则控制权转走不回来，
  后面的重命名和 `[DONE]` 永远不执行（症状：build 显示成功但没有最终中文名的 apk）

### 2026-11-02 手机版改成五页

- 页面顺序改为 **证据 → 鬼魂 → 鬼魂通用规则 → 诅咒之物 → 诅咒物通用规则**，
  对应 `mobile.js` 的 `PAGE_NAMES`；加了页面记得同步 `index.html` 的 `page-no`（x / 5）和 `aria-label`
- 「鬼魂通用规则」正文来自 `ghost_info.js` 的 `common`（13 条），「诅咒物通用规则」来自 `cursed_common`（10 条）
- 边缘提示卡片缩到 38px（箭头 24px、名字 14px），`.page` 左右内边距 32px，卡片不再压住勾选框
- **到头回弹 bug**：`goTo()` 原来在 `clamped === page` 时直接 return，导致在首页/末页拖出来的偏移留在原地；
  现在这种情况也要 `applyPage(true)` 弹回去

### 2026-11-02 通用规则改成向下滑

- 横滑只剩三页：**证据 → 鬼魂 → 诅咒之物**
- 「鬼魂通用规则」(ghost_info.common, 13 条) 和「诅咒物通用规则」(cursed_common, 10 条) 各自改成
  **在该页顶部继续向下拉 70px 打开底部浮层**；页内还有一个虚线按钮 `#ghostPull` / `#cursedPull`，
  点它也能打开（电脑上用鼠标拖不动时用这个）
- 下拉判定在 `bindPull()`：只在 `scrollTop <= 0` 时生效，向下位移 >70px 触发；向上滑不会误触
- 浮层是第三个 `.sheet`（`#rulesSheet`），标题和正文在 `openRulesSheet(kind)` 里按 kind 现场渲染
- 加页面/改顺序要同时改：`index.html` 的 `page-no`（x / 3）、`PAGE_NAMES`、`.page` 节点顺序

### 2026-11-02 通用规则改成「从顶部往下拉」

- 之前的底部浮层 + 顶部虚线按钮**已废弃**（用户：方向反了、没有滑动过程、不要写在最上面）
- 现在：在鬼魂页 / 诅咒之物页的**顶部继续往下拉**，浮层是 `#rulesSheet` 这个**顶部抽屉**，
  手指移动多少它露出多少（`drawerProgress(p)`，p = dy / 抽屉高度），松手超过 **30%** 才留下，
  否则弹回去；点遮罩、点「收起」、按返回键都能关
- 提示文字改成页面最底部的 `page-foot`（「向下滑看鬼魂通用规则」/「向下滑看诅咒物通用规则」），
  样式跟证据页的「点一下：勾选 → 划除 → 取消」一致，页顶不再有任何按钮
- 抽屉 `left/right: 8px`（跟纸页同宽，留出皮革封面）、`max-height: 86%`、底部圆角 14px
- 位置：`.drawer` 接在 `#cursedSheet` 后面，**不要**用 `.sheet` 的类；`.drawer.dragging` 关掉过渡才跟手
- 注意：absolute 子元素的包含块是 `.book` 的 padding box（含 padding），所以 `left: 0` 会顶到屏幕边，
  想跟纸页对齐要显式写 8px

### 2026-11-02 通用规则最终形态：底部升起 + 页脚标签

- 抽屉改成 **从底部升起**：`.drawer { bottom: 0; left/right: 8px; border-radius: 14px 14px 0 0;
  transform: translateY(100%) }`，`drawerProgress(p)` 用 `translateY(h * (1 - p))`，p=0 在屏幕下方、p=1 落位
- 入口是页脚居中的 **标签** `#ghostTab` / `#cursedTab`（`.page-tab`，跟左右边缘提示同一套纸色卡片样式），
  **页面上不再有任何「向下滑看…」的文字**
- 手势：按住标签**往上拉**，抽屉跟着升（过 30% 松手留下，否则缩回）；点标签则直接用 0.3s 过渡弹出
- 关闭：点遮罩 / 点「收起」/ 返回键 / 在顶部横杠 `.drawer-grip` 往下拖过 30%
- 拖完松手后 400ms 内的 click 会被吞掉（`dragged` 标志），避免回弹的同时又把抽屉弹开
- 前面的「页顶往下拉」「页脚文字提示」两种做法均已废弃；`bindPull()` 整段删除

### 2026-11-02 通用规则只认滑动，不认点击

- `#ghostTab` / `#cursedTab` 的 click 监听**已删除**，点标签没反应；只能**按住往上拉**
- 标签前加了一个 `︿`（`.tab-arrow`），内边距加到 `10px 22px`，更好抓
- 拖动过程、30% 阈值、松手判定不变；关闭方式不变（遮罩 / 收起 / 返回键 / 横杠下拖）
- 注意：以后要恢复点击打开，只需在 `bindTabDrag()` 里重新加 click，并处理「拖完松手后那次 click」
  （之前的做法是 `dragged` 标志 + 400ms 复位）

### 2026-11-02 手机真机「上拉没反应 / 还有点击效果」的修复

- 真机上拉不动的原因：`.pager` 上有 `touch-action: pan-y`，浏览器把竖向手势判成滚动并 **touchcancel**，
  页面里收得到 touchstart 收不到完整的 touchmove。修法两层：
  1. `.page-tab` / `.drawer-grip` 显式 `touch-action: none`（与祖先取交集后为 none）
  2. 它们的 touchmove 改成 `{ passive: false }`，一旦 `mode === 1` 就 `preventDefault()`
- 点击效果：`.page-tab:active` 的缩放已删，标签现在完全没有按下反馈，只有拖动
- 标签加大到 `12px 26px`（真机上约 44×182），并加 `-webkit-touch-callout: none` 防长按弹菜单
- 教训：**凡是 JS 自己接管竖向/横向拖拽的元素，都要写 touch-action，不然手机上会被浏览器抢走手势**

### 2026-11-02 资料修正：孪魂「互动间隔」不是 2 秒

- 用户核对分鬼版后问来源，查出 `D:\game_timer\资料\恐鬼症_鬼魂数据_分鬼版.md` 孪魂一节把两件事缝错了：
  wiki「指南_辨别鬼魂特征」第 76 行的原文是「孪魂偶尔会通过两种互动范围**几乎同时（1 秒之内）**进行互动」，
  而「所有鬼魂都能以**约 2 秒**的间隔与多个物品交互」说的是普通鬼的通用节奏
- 已改两处：特征栏「两次互动能在 **1 秒之内**完成（普通鬼约 2 秒一次互动）」；
  辨认①「1 秒之内完成……EMF 读取仪两个信号 1 秒内同时消失可佐证」
- 同一轮把 wiki 有、文件缺的**双互动半径**补进技能栏：普通 1.5 m（小图）/ 3 m（中、大图），
  远距离 8 m（小图）/ 16 m（中、大图），不做双互动时只用普通范围
- 改完 md 必须重跑 `python tools/gen_ghost_info.py`（`app/ghost_info.js` 是无头测试兜底），
  再把 `app/ghost_info.js` 原样复制成 `mobile/ghost_info.js`（两份必须 md5 一致，否则手机版是老数据）
- APK 已重打（2026-11-02 21:29，4.9 MB，签名不变）；**GitHub 上 mobile-v1.0 的资产还是旧数据**
- 用户 2026-11-02 决定**整段以中文 wiki 为准**，冲突的非 wiki 数据全部丢弃：孪魂改为
  「双互动几乎同时（1 秒之内）」，删掉 50/30/20 概率、延迟 1–2 秒、「两套速度交替出现」、
  「互动次数明显多于普通鬼」、「魔洛伊 1.915 对照」；辨认② 改写——一次回两个通灵盒、
  不同房间低温、同时触发两个运动传感器都是**所有鬼的默认机制**，不能当判据；副魂不能回通灵板也补上了
- 改完已重跑 `gen_ghost_info.py`、同步 `mobile/ghost_info.js`、重打 APK（包内已无旧说法）

### 2026-11-02 手机版发布到 GitHub

- 提交 `ce5ccc5`：`mobile/`（index.html / mobile.css / mobile.js / ghost_info.js / assets）与
  `android/`（Manifest、MainActivity、res、build.bat）入库；已推到 `l0vedier/phasmophobia-journal` main
- **不入库**（已写进 `.gitignore`）：`android/keystore/`（签名密钥 + `pass.txt` 口令）、
  `android/build/`、`android/*.apk`、`android/*.idsig`
- `build.bat` 不再写死签名口令，改成读 `android\keystore\pass.txt` 第一行；缺文件会报错退出
- APK 作为 **Release 资产**发布，不塞进仓库。Release 资产名必须 ASCII，中文名会被 GitHub 剥掉
- **手机版有独立发布页**：tag `mobile-v1.0`，标题「恐鬼症笔记 手机版 v1.0（安卓）」。
  创建时必须加 `--latest=false`，否则新 release 会顶掉 `releases/latest`，把桌面版下载页挤掉
  （`gh release create mobile-v1.0 <apk> --latest=false`）；桌面版 v1.4 的说明里只留一行指向它
- README 增加「手机版（安卓）」下载段和安卓打包说明；`mobile/assets/OFL.txt` 补上字体许可证
- 以后手机版更新：重新 `build.bat` → 改名成 ASCII（如 `phasmophobia-journal-mobile-v1.1.apk`）→
  `gh release create mobile-v1.1 <文件> --latest=false`，README 里的链接同步改版本号

### 2026-11-02 整页都能下滑收回通用规则

- 关闭手势从「只能抓顶部横杠」放开到**整页任意位置往下拖**：监听挂在 `#rulesSheet` 上，
  `canStart()` 用 `ev.target.closest(".sheet-body")` 判断落点——不在正文里随时可收，
  在正文里则要求 `scrollTop <= 2`（滚到顶才算），否则下滑仍然归正文滚动
- 判定与打开对称：横竖比 1.2 分方向、横向不算，下滑超过 `PULL_OPEN_PX = 110` 才收，
  不够就动画弹回原状
- `.drawer-grip` 从「唯一抓手」降级成纯装饰，不用再抓它
- 遮罩点击 / 收起按钮 / 返回键三种关闭方式都保留
- 验证（headless Edge）：正文顶部下拉 160 → 关；下拉 60 → 留在打开态；正文滚到 120 再下拉 → 不误关；
  横向滑 → 不关；标题区下拉 → 关；返回键 → "handled" 且关闭
- APK 已重打（4.9 MB，证书不变）

### 2026-11-02 通用规则改成「整页」+ 去掉翻页卡顿

- 抽屉从半页高的浮层改成 **整页**：`.drawer { top: 6px; bottom: 6px; left: 8px; right: 8px;
  border-radius: 14px }`，即盖住书本内框的整块纸面，不再只露一半；`drawerHeight = drawer.offsetHeight`
  自动跟着变（约等于视口高 - 12px），拖拽比例和 `PULL_OPEN_PX = 110` 阈值是按像素算的，不受影响
- 打开/关闭不再每帧写 `visibility`，改成 **class 驱动**：`drawerOpen()` 去掉内联 transform 加 `.open`
  （CSS `.drawer.open { transform: translateY(0) }`），`drawerClose()` 反向操作；拖动中才用内联
  `translateY` + `.dragging`（`transition: none`）
- 卡顿的三处处理：
  1. `drawerProgress()` 每帧只写 transform 和遮罩 opacity/pointer-events，别的都不碰
  2. 规则正文 **预先拼成 HTML 字符串缓存**（`rulesHTML` / `buildRules()`），打开时只做一次 innerHTML
  3. 启动后 60ms 跑 `warmDrawer()`，把鬼魂、诅咒物两套规则各排版一次，第一次上拉不用现场算布局
- 阴影从 `0 10px 30px` 收到 `0 4px 14px`（整页大小，大模糊阴影重绘更贵）
- 验证：headless Edge 里抽屉矩形 6→752（视口 758），拖 130px 打开、60px 回弹、收起按钮、
  返回键（返回 "handled" 并回到未打开态）、顶部横杠下拖关闭，全部通过；`warmParas` 13 段、诅咒物 10 段
- APK 已重打：`android\恐鬼症笔记.apk`，4.9 MB，签名证书不变（CN=Phasmo Journal）

### 2026-11-02 不必抓标签 + 箭头朝下 + 选中鬼名淡化证据

- 底部标签外面包了一层 `.page-tab-zone`（整条宽 ≈ 页面宽度、高约 50px、`touch-action: none`），
  **整条底部区域都能起手往上拉**，不再只认中间那颗标签；标签本身 `pointer-events: none`
- 另外 `.page-scroll` 上也有同样的上拉判定，但**只有滚到底**（`atBottom()`）才生效，
  否则上滑仍然归列表滚动
- 标签箭头从 `︿` 改成 `﹀`（朝下）
- 新增：**选中鬼名时，证据页里不属于它的证据变淡**（`.evidence.dim`，opacity .22）。
  逻辑在 `applyEvidenceDim()`，在 `clickGhost()` 末尾调用；取消选中/划除时自动恢复
- 手机版和电脑版这里行为对齐（电脑版是鼠标悬停触发，手机版是点选触发）

### 2026-11-02 全部更新：桌面 v1.5 + 手机 v1.1（孪魂修正）

- 提交 `1bc2b1a` 已推 main：孪魂按 wiki 重写 + `ghost_info.js` 重生成 + 版本号 1.5 / 安卓 1.1
- 桌面版：`gh release create v1.5 dist/phasmophobia-journal-v1.5-win64.zip`，现为 `releases/latest`
- 手机版：`gh release create mobile-v1.1 dist/phasmophobia-journal-mobile-v1.1.apk --latest=false`，
  README 手机版链接同步改到 `mobile-v1.1`
- **旧 release `mobile-v1.0` 已删**（`--cleanup-tag`，连 tag 一起），因为里面的 APK 是孪魂旧数据；
  以后手机版更新沿用「新建 mobile-vX.Y + 删掉上一版」，别在同一个 release 上换资产
- 私人「原版素材」版同步：`ghost_info.js` 覆盖、`version.py` → `1.5-原版素材`、
  重打 `dist\恐鬼症笔记 v1.5-原版素材-分享.zip`（18.2 MB），**不上传任何地方**
- 推送时 hosts 里 github.com 又失效：`curl` 走 140.82.113.4 能连上但 HTTP 请求卡住，
  而 `git ls-remote` / `git push` 加 `http.curloptResolve` 正常，`gh api` 也正常——照旧用 `-c http.curloptResolve`

### 2026-11-07 手机版：鬼名顺序对齐桌面版 + 证据页加重置

- **鬼名顺序**：桌面版 `.ghost-grid` 是 `grid-auto-flow: column`（3 列 × 10 行，先竖着填满一列），
  手机版原来是默认的横向填充，所以两边读起来顺序不一样。手机版 `.ghost-grid` 补上
  `grid-template-rows: repeat(10, auto); grid-auto-flow: column;`，DOM 顺序没动（30 只没变），只改排版方向
- **重置按钮**：证据页页脚改成一行（左边提示、右边「重置」），`#resetBtn` → `resetAll()`：
  七条证据全部回 normal、清 `crossedGhosts`、清 `selectedName`、清鬼名的 selected/crossed、重跑
  `applyFilter()` 与 `applyEvidenceDim()`。桌面版的重置逻辑在 `app/app.js` 的 `resetAll()`
- 验证（headless Edge 412×915）：`flow=column`、第 1 只与第 2 只同一列且纵向排列、第 10 只仍在第一列、
  第 11 只换到第二列顶；重置前 2 勾选/1 选中/4 变淡 → 重置后 0/0/0
- APK 重打：`android\恐鬼症笔记.apk`，versionCode **3** / versionName **1.2**（`aapt2 dump badging` 已确认）
- 已发布：提交 `aabbc5c` 推 main；`gh release create mobile-v1.2 ... --latest=false`，
  README 链接改到 v1.2；旧 `mobile-v1.1` 连 tag 一起删除。下载链接实测 200、4,912,461 字节，
  与本地 `android\恐鬼症笔记.apk` md5 一致（`db9b39c3…`）
