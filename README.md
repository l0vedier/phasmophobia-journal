# 恐鬼症笔记 · Phasmophobia Journal

一个给《恐鬼症》（Phasmophobia）用的桌面置顶笔记小窗：半透明地浮在游戏画面上，随手勾证据、查鬼魂、翻诅咒之物。

**Phasmophobia Journal** is a frameless, always-on-top desktop note app for *Phasmophobia* on Windows. Tick the evidence you have, see which ghosts are still possible, and browse cursed possessions without alt-tabbing out of the game. Press `Ctrl+J` to hide it or bring it back. Built with Python and pywebview (WebView2).

> 关键词 / Keywords：恐鬼症、恐鬼症笔记、恐鬼症攻略笔记、Phasmophobia、phasmophobia journal、Phasmophobia note、evidence tracker、desktop note、always-on-top、Windows 桌面笔记

![界面截图](docs/screenshot.png)

## 功能

- **证据勾选 / 圈选**：左侧勾选证据，右侧实时筛出符合的鬼魂
- **鬼魂名录 → 详情页**：3D 翻页动画，详情里带鬼魂属性、猎杀条件等资料
- **诅咒之物**：名录 + 详情，翻到下一页即可查看
- **无边框圆角窗**：书页外区域全透明，不挡视线；`Ctrl+J` 显示 / 隐藏
- **不跟游戏抢显卡**：界面用核显渲染（`--force_low_power_gpu`），独显留给游戏
- **配置随用户走**：浏览器式布局设置存在 `%APPDATA%\PhasmophobiaJournal\config.json`，更新程序不丢设置

## 运行

需要 Windows 10/11，以及 WebView2 运行时（Win11 自带）。

```bat
pip install -r requirements.txt
python main.py
```

## 打包

```bat
python tools/build_share.py
```

产物在 `dist\恐鬼症笔记 vX.Y\`（onefolder）和 `dist\vX.Y-分享.zip`。

## 素材与版权

- **界面素材**（书页纸纹、皮面书壳、图标）不是游戏资源，而是由 `tools/gen_assets.py` 用噪声和几何形状程序化生成的，随本仓库一起以 MIT 发布。想换风格可以直接改这个脚本重新生成。
- **字体**：龙藏体（Long Cang），SIL Open Font License 1.1，许可证全文见 `app/assets/OFL.txt`。
- **鬼魂 / 诅咒之物数据**：整理自 Phasmophobia 社区 Wiki（Fandom，CC BY-SA 3.0），属于资料性整理，具体数值以游戏内实测为准。
- 本项目与 Kinetic Games 无关，《恐鬼症》的名称与游戏内素材版权归 Kinetic Games 所有。

## 许可

代码以 MIT 许可证发布，详见 [LICENSE](LICENSE)。数据文件（`app/ghost_info.js`）内容源自 CC BY-SA 3.0 的社区 Wiki。
