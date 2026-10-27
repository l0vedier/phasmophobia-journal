# -*- coding: utf-8 -*-
"""Scan Phasmophobia Unity assets for journal-related textures, fonts and text.

Read-only: never writes into the game directory.
"""
import json
import os
import re
import sys
import time
import traceback

import UnityPy

ROOT = r"D:\Steam\steamapps\common\Phasmophobia\Phasmophobia_Data"
OUT_DIR = r"E:\Claude code\phasmophobia-journal\extracted"
TEXTURE_DIR = os.path.join(OUT_DIR, "textures")
os.makedirs(TEXTURE_DIR, exist_ok=True)

NAME_KEY = re.compile(
    r"journal|evidence|ghost|book|page|paper|parch|note|handwrit|handwriting|"
    r"font|local|lang|string|ink|check|tick|dossier|notebook|ledger",
    re.I,
)
TEXT_KEY = re.compile(
    r"根据我们找到的证据|证据|鬼魂|通灵盒|点阵|刺骨|寒温|灵球|紫外线|笔迹|EMF",
    re.I,
)

files = ["resources.assets", "globalgamemanagers.assets"]
shared = sorted(
    (f for f in os.listdir(ROOT) if re.fullmatch(r"sharedassets\d+\.assets", f)),
    key=lambda f: os.path.getsize(os.path.join(ROOT, f)),
    reverse=True,
)
files += shared

results = {
    "name_matches": [],
    "fonts": [],
    "text_assets": [],
    "text_hits": [],
    "textures_exported": [],
    "errors": [],
}

t0 = time.time()
for idx, name in enumerate(files, 1):
    path = os.path.join(ROOT, name)
    size = os.path.getsize(path)
    print(f"[{idx}/{len(files)}] {name} ({size/1e6:.0f} MB) ...", flush=True)
    try:
        env = UnityPy.load(path)
    except Exception as exc:
        results["errors"].append({"file": name, "error": f"load: {exc}"})
        print("  LOAD ERROR:", exc, flush=True)
        continue

    try:
        for obj in env.objects:
            try:
                typ = obj.type.name
            except Exception:
                continue
            try:
                nm = obj.peek_name() or ""
            except Exception:
                nm = ""

            if typ in ("Font", "MonoBehaviour") and (typ == "Font" or NAME_KEY.search(nm)):
                if typ == "Font" or re.search(r"font|sdf|hand|script", nm, re.I):
                    item = {"file": name, "type": typ, "name": nm, "path_id": obj.path_id}
                    results["fonts"].append(item)
                    print("  FONT:", item, flush=True)

            if nm and NAME_KEY.search(nm):
                item = {"file": name, "type": typ, "name": nm, "path_id": obj.path_id}
                results["name_matches"].append(item)
                print("  NAME:", typ, nm, flush=True)

            if typ == "TextAsset":
                try:
                    data = obj.read()
                    script = getattr(data, "m_Script", "")
                    if isinstance(script, bytes):
                        script = script.decode("utf-8", "ignore")
                    results["text_assets"].append(
                        {"file": name, "name": nm, "chars": len(script)}
                    )
                    for m in TEXT_KEY.finditer(script):
                        start = max(0, m.start() - 80)
                        end = min(len(script), m.end() + 120)
                        snippet = script[start:end].replace("\n", " ")
                        results["text_hits"].append(
                            {"file": name, "name": nm, "snippet": snippet}
                        )
                        print("  TEXT HIT:", nm, "|", snippet[:160], flush=True)
                        break
                except Exception as exc:
                    results["errors"].append(
                        {"file": name, "object": nm, "error": f"textasset: {exc}"}
                    )

            if typ in ("Texture2D", "Sprite") and nm and NAME_KEY.search(nm):
                try:
                    data = obj.read()
                    img = getattr(data, "image", None)
                    if img is not None:
                        safe = re.sub(r"[^0-9A-Za-z_.-]+", "_", nm)[:80]
                        out = os.path.join(TEXTURE_DIR, f"{safe}_{obj.path_id}.png")
                        img.save(out)
                        results["textures_exported"].append(
                            {
                                "file": name,
                                "type": typ,
                                "name": nm,
                                "path_id": obj.path_id,
                                "width": getattr(data, "m_Width", None),
                                "height": getattr(data, "m_Height", None),
                                "png": out,
                            }
                        )
                        print("  TEX:", nm, out, flush=True)
                except Exception as exc:
                    results["errors"].append(
                        {"file": name, "object": nm, "error": f"texture: {exc}"}
                    )
    finally:
        try:
            del env
        except Exception:
            pass
    print(f"  done, {time.time()-t0:.1f}s elapsed", flush=True)

with open(os.path.join(OUT_DIR, "scan_results.json"), "w", encoding="utf-8") as fh:
    json.dump(results, fh, ensure_ascii=False, indent=2)

print("\n=== SUMMARY ===")
for k, v in results.items():
    print(k, len(v))
print("elapsed", round(time.time() - t0, 1), "s")
