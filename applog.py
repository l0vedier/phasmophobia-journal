# -*- coding: utf-8 -*-
"""滚动日志。

pythonw 没有控制台，启动失败或后台线程出错时用户什么都看不到；
这里把所有异常落到 %APPDATA%\\PhasmophobiaJournal\\journal.log。
"""
from __future__ import annotations

import logging
import os
from logging.handlers import RotatingFileHandler
from pathlib import Path

CONFIG_DIR = Path(os.environ.get("APPDATA") or Path.home()) / "PhasmophobiaJournal"
LOG_PATH = CONFIG_DIR / "journal.log"

_configured = False


def setup() -> Path:
    """安装文件日志；失败时退回 NullHandler，绝不让日志拖垮程序。"""
    global _configured
    if _configured:
        return LOG_PATH
    _configured = True

    root = logging.getLogger()
    root.setLevel(logging.INFO)
    try:
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        handler = RotatingFileHandler(
            LOG_PATH,
            maxBytes=512 * 1024,
            backupCount=2,
            encoding="utf-8",
        )
        handler.setFormatter(logging.Formatter(
            "%(asctime)s %(levelname)s %(threadName)s %(name)s: %(message)s"
        ))
        root.addHandler(handler)
    except Exception:
        root.addHandler(logging.NullHandler())
    return LOG_PATH
