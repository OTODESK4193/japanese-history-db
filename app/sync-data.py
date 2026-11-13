#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
日本史学習アプリ（静的PWA版）データ同期スクリプト。

正本データ（~/workspace/japanese-history-db/ 配下）から app/data/ の JSON を生成する。
正本が更新されたら、このスクリプトを再実行すれば静的版データも追随する。

生成物:
  data/questions_hs.json  高校問題538問（画像参照を正規化）
  data/questions_jhs.json 中学問題200問
  data/texts.json         単元テキスト14本（verification_notes は内部用につき除外）
  data/glossary.json      辞書（補完v1〜v8 ∪ 問題キーターム ∪ テキストキーターム = ホスト型と同規則）
  data/years.json         年号DB 247件
  data/world.json         世界年表 127件
  data/trivia.json        豆知識 60件
  data/commentaries.json  模範解答の解説31件＋分析レコード
  data/cloze.json         穴埋め問題（同期時に決定的に自動生成）
  data/svg_texts.json     図解D01〜D19のSVGテキスト（埋め込み描画用）
  data/places.json        地名シート用データ（辞書に実在する著名な遺跡・建造物のみ）
  data/meta.json          件数メタ（検証用）
"""
import json
import glob
import hashlib
import os
import re
import sys
from urllib.parse import unquote

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # japanese-history-db/
HS_DIR = os.path.join(BASE, "high_school")
APP_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(APP_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def dump(name, obj):
    path = os.path.join(DATA_DIR, name)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  {name}: {os.path.getsize(path)/1024:.0f} KB")


def sha8(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:8].upper()


# ---------------------------------------------------------------- questions
def normalize_image(q):
    """image_data を静的版の表示形式に正規化する。"""
    qd = q.get("question") or {}
    idata = qd.get("image_data")
    if not qd.get("has_image") or not idata:
        return
    url = idata.get("url") or ""
    if "media/diagrams/" in url:
        qd["image_data"] = {
            "kind": "diagram",
            "file": os.path.basename(url),
            "title": idata.get("title", ""),
            "license": idata.get("license", ""),
            "source_org": idata.get("source_org", ""),
        }
    elif "commons.wikimedia.org/wiki/File:" in url:
        fname = unquote(url.split("/wiki/File:", 1)[1].split("?")[0].split("#")[0])
        qd["image_data"] = {
            "kind": "photo",
            "file": fname,
            "title": idata.get("title", ""),
            "license": idata.get("license", ""),
            "source_org": idata.get("source_org", ""),
        }
    else:
        qd["image_data"] = {
            "kind": "link",
            "url": url,
            "title": idata.get("title", ""),
            "license": idata.get("license", ""),
            "source_org": idata.get("source_org", ""),
        }


def sync_questions():
    hs = load(os.path.join(HS_DIR, "japanese_history_hs_db.json"))
    jhs = load(os.path.join(BASE, "japanese_history_db.json"))
    for q in hs + jhs:
        normalize_image(q)
    dump("questions_hs.json", hs)
    dump("questions_jhs.json", jhs)
    return hs, jhs


# ---------------------------------------------------------------- texts
TRV_RE = re.compile(r"TRV-\d{4}")


def material_display(m):
    """資料の表示方法を事前に決める（アプリ側を単純にするため）。"""
    kind = m.get("kind")
    ref = m.get("ref_url") or ""
    if m.get("diagram_file"):
        return {"type": "diagram", "file": m["diagram_file"]}
    if kind in ("photo", "painting", "map") and "commons.wikimedia.org/wiki/File:" in ref:
        fname = unquote(ref.split("/wiki/File:", 1)[1].split("?")[0].split("#")[0])
        return {"type": "photo", "file": fname}
    if kind == "trivia":
        ids = TRV_RE.findall((m.get("catalog_ref") or "") + " " + (m.get("usage") or ""))
        if m.get("material_id", "").startswith("TRV-"):
            ids = [m["material_id"]] + [i for i in ids if i != m["material_id"]]
        return {"type": "trivia", "ids": list(dict.fromkeys(ids))}
    if ref:
        return {"type": "link", "url": ref}
    if kind == "trivia":
        return {"type": "trivia", "ids": TRV_RE.findall(m.get("usage") or "")}
    return {"type": "none"}


def sync_texts():
    texts = []
    for path in sorted(glob.glob(os.path.join(HS_DIR, "texts", "*.json"))):
        t = load(path)
        t.pop("verification_notes", None)
        for m in t.get("materials", []):
            m["display"] = material_display(m)
        texts.append(t)
    texts.sort(key=lambda t: t["unit_id"])
    dump("texts.json", texts)
    return texts


# ---------------------------------------------------------------- glossary
def sync_glossary(hs, jhs, texts):
    terms = {}  # term -> record

    def ensure(term):
        if term not in terms:
            terms[term] = {
                "term": term, "reading": "", "gloss": "", "definition": "",
                "category": "", "status": "derived", "sources": [],
                "questions": [], "sections": [],
            }
        return terms[term]

    # 1) 補完 v1〜v8（後発が欠けを埋め、appears_in は統合）
    for i in range(1, 9):
        path = os.path.join(HS_DIR, "glossary", f"glossary_supplement_v{i}.json")
        if not os.path.exists(path):
            continue
        d = load(path)
        recs = d["records"] if isinstance(d, dict) and "records" in d else d
        for r in recs:
            rec = ensure(r["term"])
            for field, key in (("reading", "reading"), ("gloss", "gloss_short"),
                               ("definition", "definition"), ("category", "category")):
                if r.get(key):
                    rec[field] = r[key]
            if r.get("status"):
                rec["status"] = r["status"]
            for s in r.get("sources") or []:
                if s not in rec["sources"]:
                    rec["sources"].append(s)
            for ref in r.get("appears_in") or []:
                if re.fullmatch(r"(HS|JHS)-HIST-\d{4}", ref):
                    if ref not in rec["questions"]:
                        rec["questions"].append(ref)
                elif re.fullmatch(r"U\d{2}-S\d+", ref):
                    if ref not in rec["sections"]:
                        rec["sections"].append(ref)

    # 2) 問題キーターム（関連問題の紐付け＋未収録語の受け皿）
    for q in hs + jhs:
        for term in (q["explanation"].get("key_terms") or []):
            rec = ensure(term)
            if q["id"] not in rec["questions"]:
                rec["questions"].append(q["id"])
            if not rec["definition"]:
                rec["definition"] = q["explanation"].get("summary") or ""
                rec["derived_from"] = q["id"]

    # 3) テキストのキーターム（セクションへの紐付け）
    for t in texts:
        for s in t["sections"]:
            ref = f'{t["unit_id"]}-{s["id"]}'
            for k in s.get("key_terms", []):
                term = k["term"] if isinstance(k, dict) else str(k)
                rec = ensure(term)
                if ref not in rec["sections"]:
                    rec["sections"].append(ref)

    out = []
    for term, rec in terms.items():
        rec["id"] = "TERM-" + sha8(term)
        rec["questions"].sort()
        rec["sections"].sort()
        out.append(rec)
    out.sort(key=lambda r: (r["reading"] or r["term"], r["term"]))
    dump("glossary.json", out)
    return out


# ---------------------------------------------------------------- simple copies
def sync_simple():
    years = load(os.path.join(HS_DIR, "years", "years_db_v4.json"))
    dump("years.json", years)
    world = load(os.path.join(HS_DIR, "years", "world_events_db_v1.json"))
    dump("world.json", world["records"])
    trivia = load(os.path.join(HS_DIR, "trivia", "trivia_db_v1.json"))
    dump("trivia.json", trivia)
    return years, world["records"], trivia


def sync_commentaries():
    d = load(os.path.join(HS_DIR, "descriptive", "descriptive_full_v1.json"))
    units = []
    total = 0
    for u in d["units"]:
        comms = []
        for c in u.get("commentaries", []):
            total += 1
            g = c.get("grounding")
            if isinstance(g, dict):
                grounding = {
                    "evidence_level": g.get("evidence_level"),
                    "analysis_records": g.get("analysis_records"),
                }
            else:
                grounding = {"evidence_level": g, "analysis_records": None}
            comms.append({
                "theme": c.get("theme"),
                "answer_type": c.get("answer_type"),
                "prompt_style": c.get("prompt_style"),
                "model_answer": c.get("model_answer"),
                "elements": c.get("elements"),
                "commentary": c.get("commentary"),
                "links": c.get("links"),
                "grounding": grounding,
            })
        analysis = []
        for r in (u.get("analysis") or {}).get("records", []):
            analysis.append({
                "university": r.get("university"), "year": r.get("year"),
                "exam_part": r.get("exam_part"), "theme": r.get("theme"),
                "answer_type": r.get("answer_type"),
                "format": r.get("format"),
                "elements_required": r.get("elements_required"),
                "insufficiency_patterns": r.get("insufficiency_patterns"),
                "evidence_level": r.get("evidence_level"),
            })
        units.append({
            "unit": u["unit"], "unit_title": u.get("unit_title"),
            "commentaries": comms, "analysis": analysis,
        })
    dump("commentaries.json", units)
    return total


# ---------------------------------------------------------------- cloze
NUM_RE = re.compile(r"[0-9０-９]")


def blankable(term):
    return bool(term) and len(term) >= 2 and not NUM_RE.search(term)


def sync_cloze(hs, jhs, texts, glossary):
    verified = set()
    for i in range(1, 9):
        path = os.path.join(HS_DIR, "glossary", f"glossary_supplement_v{i}.json")
        if not os.path.exists(path):
            continue
        d = load(path)
        recs = d["records"] if isinstance(d, dict) and "records" in d else d
        for r in recs:
            verified.add(r["term"])
    for q in hs + jhs:
        verified.update(q["explanation"].get("key_terms") or [])

    cloze = []
    for t in texts:
        uid = t["unit_id"]
        unit_terms = set()
        for s in t["sections"]:
            for k in s.get("key_terms", []):
                unit_terms.add(k["term"] if isinstance(k, dict) else str(k))
        pool = sorted(x for x in unit_terms if x in verified and blankable(x))
        if len(pool) < 4:
            continue
        for s in t["sections"]:
            for point in s.get("points", []):
                hits = [x for x in pool if x in point]
                if not hits:
                    continue
                # 最長一致を正解語にする（決定的）
                hits.sort(key=lambda x: (-len(x), point.find(x), x))
                answer = hits[0]
                seed = int(sha8(uid + "|" + s["id"] + "|" + point), 16)
                # 誤答: 同じ単元のプールから、長さの近いものを決定的に選ぶ
                cands = [x for x in pool if x != answer]
                cands.sort(key=lambda x: (abs(len(x) - len(answer)),
                                          int(sha8(answer + "|" + x), 16)))
                distractors = cands[:3]
                if len(distractors) < 3:
                    continue
                choices = [{"text": answer, "is_correct": True}] + \
                          [{"text": d, "is_correct": False} for d in distractors]
                # 決定的シャッフル
                choices.sort(key=lambda c: int(sha8(point + "|" + c["text"]), 16))
                blanked = point.replace(answer, "（　）", 1)
                cloze.append({
                    "id": f"CLOZE-{uid}-{sha8(uid + '|' + s['id'] + '|' + point)}",
                    "unit": uid,
                    "section_ref": f"{uid}-{s['id']}",
                    "text": blanked,
                    "source_point": point,
                    "answer": answer,
                    "choices": choices,
                    "auto_generated": True,
                })
    dump("cloze.json", cloze)
    return cloze


# ---------------------------------------------------------------- diagrams / places
def sync_diagrams():
    man = load(os.path.join(HS_DIR, "media", "diagrams", "diagrams_manifest.json"))
    svgs = {}
    for d in man["diagrams"]:
        fname = d.get("file") or d.get("filename") or d.get("svg") or ""
        path = os.path.join(HS_DIR, "media", "diagrams", fname)
        if fname and os.path.exists(path):
            with open(path, encoding="utf-8") as f:
                svgs[fname] = f.read()
    # 台帳に無いファイルも拾う（D01〜D19 の実ファイル優先）
    for path in sorted(glob.glob(os.path.join(HS_DIR, "media", "diagrams", "D*.svg"))):
        fname = os.path.basename(path)
        if fname not in svgs:
            with open(path, encoding="utf-8") as f:
                svgs[fname] = f.read()
    dump("svg_texts.json", svgs)
    return svgs


# 地名シート用：辞書に実在する著名な遺跡・史跡・建造物だけを対象にする（座標は持たず、
# Google Maps 検索リンクで開く）。同期時に辞書への実在を検証し、無いものは落とす。
PLACE_CANDIDATES = [
    "岩宿遺跡", "三内丸山遺跡", "吉野ヶ里遺跡", "登呂遺跡", "大仙陵古墳", "大仙古墳",
    "箸墓古墳", "石舞台古墳", "高松塚古墳", "キトラ古墳", "法隆寺", "唐招提寺",
    "東大寺", "薬師寺", "興福寺", "平等院", "中尊寺", "厳島神社", "春日大社",
    "日光東照宮", "姫路城", "松本城", "熊本城", "二条城", "安土城", "大坂城",
    "大阪城", "首里城", "龍安寺", "金閣寺", "銀閣寺", "清水寺", "広隆寺",
    "正倉院", "平城京", "平安京", "出島", "五稜郭", "松山城", "犬山城",
    "彦根城", "丸岡城", "松江城", "備中松山城", "弘前城", "会津若松城",
]


def sync_places(glossary):
    terms = {g["term"] for g in glossary}
    places = [{"name": name} for name in PLACE_CANDIDATES if name in terms]
    dump("places.json", places)
    return places


def main():
    print("sync-data: 正本から app/data/ を生成します")
    hs, jhs = sync_questions()
    texts = sync_texts()
    glossary = sync_glossary(hs, jhs, texts)
    years, world, trivia = sync_simple()
    ncomm = sync_commentaries()
    cloze = sync_cloze(hs, jhs, texts, glossary)
    svgs = sync_diagrams()
    places = sync_places(glossary)
    meta = {
        "questions_hs": len(hs), "questions_jhs": len(jhs),
        "terms": len(glossary), "years": len(years), "world": len(world),
        "trivia": len(trivia), "commentaries": ncomm, "cloze": len(cloze),
        "diagrams": len(svgs), "places": len(places), "texts": len(texts),
    }
    dump("meta.json", meta)
    print("件数:", json.dumps(meta, ensure_ascii=False))


if __name__ == "__main__":
    main()
