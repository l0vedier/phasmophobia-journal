# 恐鬼症笔记 · Phasmophobia Journal

一个给《恐鬼症》（Phasmophobia）用的桌面置顶笔记小窗：半透明地浮在游戏画面上，随手勾证据、查鬼魂、翻诅咒之物。

**Phasmophobia Journal** is a frameless, always-on-top desktop note app for *Phasmophobia* on Windows. Tick the evidence you have, see which ghosts are still possible, and browse cursed possessions without alt-tabbing out of the game. Press `Ctrl+J` to hide it or bring it back. Built with Python and pywebview (WebView2).

> 关键词 / Keywords：恐鬼症、恐鬼症笔记、恐鬼症攻略笔记、Phasmophobia、phasmophobia journal、Phasmophobia note、evidence tracker、desktop note、always-on-top、Windows 桌面笔记

## 下载安装（普通玩家看这里）

**👉 [点这里下载最新版](https://github.com/l0vedier/phasmophobia-journal/releases/latest)**

打开页面后在 **Assets** 里点 `phasmophobia-journal-vX.Y-win64.zip`（约 18 MB），然后：

1. **右键 zip → 全部解压**（不要直接双击压缩包里的 exe）
2. 进入解压出来的文件夹
3. 双击 `恐鬼症笔记 vX.Y.exe`

不用装 Python，不用装任何运行库，解压即用。第一次运行时如果 Windows 弹蓝色提示，点「更多信息」→「**仍要运行**」。

> ### ⚠️ 不要点绿色的 `Code` → `Download ZIP`
> 那是**源码**（约 9 MB），里面没有 exe。双击里面的 `启动笔记.bat` 只会闪一下黑框，然后什么都没有——它需要你自己装 Python 才能跑。
>
> 想直接玩，只认 **Releases** 里的 zip。

**解压后文件夹必须长这样，三个东西缺一不可：**

```
恐鬼症笔记 vX.Y\
├─ 恐鬼症笔记 vX.Y.exe
├─ _internal\          ← 不能删、不能只拿走 exe
└─ 资料\               ← 不能删
```

## 打不开怎么办

**v1.4 起，程序启动失败会自己弹中文窗口告诉你原因**，按提示做就行。常见情况对照：

| 现象 | 原因 | 怎么办 |
|---|---|---|
| 黑框一闪就没有，界面不出来 | ① 在压缩包里直接双击运行；② 下成了源码包 | 先把 zip 全部解压；确认下的是 Releases 里的 zip |
| 弹窗说缺少 WebView2 运行时 | 系统缺微软的浏览器内核组件 | 弹窗里点「是」打开官方下载页，装完重新打开 |
| 弹窗说找不到界面文件 / 鬼魂数据 | 只把 exe 单独拖出来了 | 重新解压整个文件夹，三个东西放同一层 |
| 双击完全没反应 | 程序其实已经在运行了 | 看任务栏右下角托盘，或按 `Ctrl+J` 唤出 |

还是打不开，把 `%APPDATA%\PhasmophobiaJournal\journal.log` 这个日志文件发给作者。

**系统要求**：Windows 10 / 11。Win11 自带 WebView2 运行时；Win10 只要装过 Edge 一般都有，没有的话程序会引导你装一次（免费，约 2 MB）。

![界面截图：勾证据后实时筛鬼](docs/screenshot-main.png)

![界面截图：鬼魂详情页](docs/screenshot-detail.png)

> 上图：左边勾证据，右边实时筛出还可能的鬼。下图：右键鬼名看详情，左页铺通用规则，正文按住鼠标就能拖着滚。

## 功能

- **证据勾选 / 圈选**：左侧勾选证据，右侧实时筛出符合的鬼魂
- **鬼魂名录 → 详情页**：3D 翻页动画，详情里带鬼魂属性、猎杀条件等资料
- **诅咒之物**：名录 + 详情，翻到下一页即可查看
- **无边框圆角窗**：书页外区域全透明，不挡视线；`Ctrl+J` 显示 / 隐藏
- **不跟游戏抢显卡**：界面用核显渲染（`--force_low_power_gpu`），独显留给游戏
- **配置随用户走**：浏览器式布局设置存在 `%APPDATA%\PhasmophobiaJournal\config.json`，更新程序不丢设置
- **启动自检**：缺 WebView2、没解压、只拿走 exe 等情况会弹中文提示说明怎么修（v1.4 起）

## 手机版（安卓）

**👉 [下载 APK](https://github.com/l0vedier/phasmophobia-journal/releases/download/mobile-v1.0/phasmophobia-journal-mobile-v1.0.apk)**（约 4.9 MB）　·　[发布页](https://github.com/l0vedier/phasmophobia-journal/releases/tag/mobile-v1.0)

下载后拷到手机上直接安装（第一次要允许「安装未知来源应用」）。竖屏使用：

- **左右滑动翻页**：证据 → 鬼魂 → 诅咒之物
- **点证据**：勾选 → 划除 → 取消，鬼名实时筛选
- **点鬼名**：圈住这只鬼，同时证据页里不属于它的证据会变淡；长按看资料
- **页面底部往上拉**：翻出「鬼魂通用规则」/「诅咒物通用规则」整页，往下拉或点「收起」/ 返回键回到原页

最低支持 Android 5.0（API 21）。手机版和桌面版用的是同一份 `ghost_info.js` 数据，改数据记得两边同步。

## 从源码运行（开发者）

需要 Windows 10/11、Python 3.10+，以及 WebView2 运行时。

```bat
pip install -r requirements.txt
python main.py
```

## 打包

```bat
python tools/build_share.py
```

产物在 `dist\恐鬼症笔记 vX.Y\`（onefolder）和 `dist\phasmophobia-journal-vX.Y-win64.zip`。

安卓版（不用 Gradle，直接调 aapt2 / javac / d8 / apksigner）：

```bat
cd android
build.bat
```

需要 Android SDK build-tools 34 和 JDK。签名密钥放 `android\keystore\journal.keystore`，口令写在同一目录的 `pass.txt` 一行——**这两个都不入库**，自己打包要先准备。

## 素材与版权

- **界面素材**（书页纸纹、皮面书壳、图标）不是游戏资源，而是由 `tools/gen_assets.py` 用噪声和几何形状程序化生成的，随本仓库一起以 MIT 发布。想换风格可以直接改这个脚本重新生成。
- **字体**：龙藏体（Long Cang），SIL Open Font License 1.1，许可证全文见 `app/assets/OFL.txt`。
- **鬼魂 / 诅咒之物数据**：整理自 Phasmophobia 社区 Wiki（Fandom，CC BY-SA 3.0），属于资料性整理，具体数值以游戏内实测为准。
- 本项目与 Kinetic Games 无关，《恐鬼症》的名称与游戏内素材版权归 Kinetic Games 所有。

## 许可

代码以 MIT 许可证发布，详见 [LICENSE](LICENSE)。数据文件（`app/ghost_info.js`）内容源自 CC BY-SA 3.0 的社区 Wiki。
