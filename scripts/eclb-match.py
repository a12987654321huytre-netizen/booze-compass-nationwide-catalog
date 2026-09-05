#!/usr/bin/env python3
"""
Match ECLB off-consumption licences against the existing Booze Compass catalog.

Non-destructive: existing POIs are never deleted, renamed, or replaced.
Licence-holder names are backend enrichment, not public store names.
"""

from __future__ import annotations

import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
XLSX = Path("/workspace/attachments/BoozeCompass_EC_OffConsumption_v2.xlsx")
CATALOG = ROOT / "src/data/googlePlacesPois.json"
OUT_DIR = ROOT / "artifacts"
DATA_DIR = ROOT / "src/data"

STOP = {
    "the", "of", "and", "at", "to", "for", "in", "on", "a", "an",
    "street", "str", "st", "road", "rd", "avenue", "ave", "drive", "dr",
    "lane", "ln", "way", "close", "crescent", "cres", "boulevard", "blvd",
    "corner", "cnr", "erfnr", "erf", "shop", "no", "number", "unit",
    "pty", "ltd", "limited", "cc", "trust", "south", "africa", "eastern",
    "cape", "off", "sales", "consumption", "registered", "person",
    "complex", "centre", "center", "mall", "plaza", "extension", "ext",
    "township", "location", "admin", "area", "village", "administrative",
}

GENERIC_TOKS = {
    "main", "church", "high", "market", "beach", "park", "shopping",
    "north", "south", "east", "west", "new", "old",
}

TOWN_ALIASES = {
    "gqeberha": {
        "gqeberha", "gqebera", "port elizabeth", "port elizabet", "pe",
        "ibhayi", "walmer", "newton park", "summerstrand", "humewood",
        "central", "north end", "sidwell", "korsten", "gelvandale",
        "new brighton", "kwazakhele", "zwide", "motherwell", "bethelsdorp",
        "cotswold", "fernglen", "linton grange", "mount pleasant",
        "hunters retreat", "kwadwesi",
        # kwanobuhle is Kariega/Uitenhage, not Gqeberha — do not alias here
    },
    "kariega": {"kariega", "uitenhage", "despatch", "kwanobuhle"},
    "qonce": {
        "qonce", "king williams town", "king william's town",
        "king williams", "kwt", "bhisho", "bisho",
    },
    "komani": {"komani", "queenstown", "ezibeleni"},
    "maletswai": {"maletswai", "aliwal north", "aliwal"},
    "east london": {
        "east london", "kugompo", "kugompo city", "buffalo city",
        "beacon bay", "gonubie", "mdantsane", "amalinda",
        "quigney", "beaconhurst",
    },
    "mthatha": {"mthatha", "umtata", "mhatha"},
    "makhanda": {"makhanda", "grahamstown"},
    "jeffreys bay": {
        "jeffreys bay", "jefferey's bay", "jeffereys bay", "jbay",
        "jefferey s bay",
    },
    "cradock": {"cradock", "nxuba"},
    "port alfred": {"port alfred"},
    "somerset east": {"somerset east"},
    "graaff-reinet": {"graaff-reinet", "graaff reinet", "graaf-reneit", "graff - reinet"},
    "lusikisiki": {"lusikisiki"},
    "port st johns": {"port st johns", "port st. johns"},
    "st francis bay": {"st francis bay", "st. francis bay", "cape st francis", "sea vista"},
    "humansdorp": {"humansdorp"},
    "mdantsane": {"mdantsane"},
    "mqanduli": {"mqanduli"},
    "ngcobo": {"ngcobo", "engcobo"},
    "middledrift": {"middledrift"},
    "peddie": {"peddie"},
    "stutterheim": {"stutterheim"},
    "zwelitsha": {"zwelitsha"},
    "barkly east": {"barkly east", "barkley east"},
    "aberdeen": {"aberdeen"},
    "addo": {"addo"},
    "adelaide": {"adelaide"},
    "cofimvaba": {"cofimvaba", "cofimvava"},
    "libode": {"libode"},
    "dimbaza": {"dimbaza"},
    "fort beaufort": {"fort beaufort"},
    "jamestown": {"jamestown"},
    "tsomo": {"tsomo"},
    "butterworth": {"butterworth", "gcuwa"},
    "kenton on sea": {"kenton on sea", "kenton-on-sea"},
}

TOWN_WORDS = set(GENERIC_TOKS)
for _canon, _aliases in TOWN_ALIASES.items():
    TOWN_WORDS.update(_canon.split())
    for _a in _aliases:
        TOWN_WORDS.update(_a.split())
TOWN_WORDS.update({"city", "central", "cbd"})

CHAIN_EQUIV = {
    frozenset({"robinson", "ultra"}),
    frozenset({"shoprite-checkers", "shoprite"}),
    frozenset({"shoprite-checkers", "checkers"}),
}

CHAIN_PATTERNS = [
    (r"\bboxer\b", "boxer"),
    (r"shoprite\s*checkers|checkers\s*liquor|shoprite\s*liquor", "shoprite-checkers"),
    (r"\bwoolworths\b|\bw cellar\b|woolworths\s*cellar", "woolworths"),
    (r"pick\s*n['’]?\s*pay|picknpay|\bpnp\b", "picknpay"),
    (r"tops\s*(at\s*)?spar|nicks\s+liquors\s+at\s+tops|the\s+spar\s+group", "tops"),
    (r"\bprestons\b", "prestons"),
    (r"c\.?\s*j\.?\s*robinson|robinson\s+liquors", "robinson"),
    (r"\bultra\s+liquors\b", "ultra"),
    (r"kaap\s*agri", "kaap-agri"),
    (r"alliance\s+wholesalers", "alliance"),
]

# Independently verified same-premises pairs the scorer under-calls
# (adjacent street numbers, Robinson trading as Ultra). Keyed by ECLB id.
CURATED_CONFIRM = {
    373: "Ultra Liquors Oxford",
    516: "Ultra Liquors - Newton Park",
    918: "Ultra Liquors Express",
    705: "Showground Liquor Store",
    509: "Port Elizabeth Boxer Liquors",
    # ECLB address is 7 Aalwyn; public/Google listing is 3 Aalwyn. Same store.
    875: "Prestons Liquor Stores Fairbridge",
    1191: "Prestons Liquor Stores Port Alfred",
}


def chains_match(a: str | None, b: str | None) -> bool:
    if not a or not b:
        return False
    if a == b:
        return True
    return frozenset({a, b}) in CHAIN_EQUIV


def norm(text: str | None) -> str:
    if not text:
        return ""
    t = str(text).lower()
    t = t.replace("&", " and ").replace("’", "'")
    t = re.sub(r"[^a-z0-9\s]", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def street_words_after_number(text: str | None, num: str) -> set[str]:
    parts = norm(text).split()
    out: set[str] = set()
    for i, tok in enumerate(parts):
        digits = re.sub(r"[a-z]", "", tok)
        if digits != num:
            continue
        for nxt in parts[i + 1 : i + 4]:
            if nxt in STOP or nxt in TOWN_WORDS or nxt.isdigit():
                continue
            if len(nxt) >= 4:
                out.add(nxt)
                break
    return out


def tokens(text: str | None) -> set[str]:
    return {
        tok for tok in norm(text).split()
        if len(tok) > 2 and tok not in STOP and not tok.isdigit()
    }


def numbers(text: str | None) -> set[str]:
    """House numbers, not erf/shop/stand/extension/zone/unit ids."""
    raw = str(text or "")
    n = norm(raw)
    found: set[str] = set()
    skip_prev = {
        "erf", "erfnr", "shop", "unit", "units", "stand", "ext", "extension",
        "zone", "lot", "lots", "portion", "erven", "section", "nr", "no",
        "and",
    }
    parts = n.split()
    for i, tok in enumerate(parts):
        if not re.fullmatch(r"\d{1,4}[a-z]?", tok):
            continue
        prev = parts[i - 1] if i else ""
        nxt = parts[i + 1] if i + 1 < len(parts) else ""
        if prev in skip_prev:
            continue
        # "Shop 9A" already skipped; allow "21 Somerset" or "Oxford 250"
        if nxt in STOP or nxt in skip_prev:
            # number then street-type ("10 Main Street") is a house number
            if nxt in {"street", "str", "st", "road", "rd", "avenue", "ave", "drive", "dr", "lane"}:
                found.add(re.sub(r"[a-z]", "", tok) or tok)
            continue
        if nxt or prev:
            found.add(re.sub(r"[a-z]", "", tok) or tok)
    return found


def town_keys(text: str | None) -> set[str]:
    n = norm(text)
    keys = set()
    if n:
        keys.add(n)
    for canonical, aliases in TOWN_ALIASES.items():
        if n == canonical or n in aliases:
            keys.add(canonical)
            keys |= aliases
            continue
        # Word-boundary alias match, but only against short locality strings
        # (not full street addresses — "Mthatha Street, Butterworth" is not Mthatha).
        if len(n) > 48:
            continue
        for alias in aliases:
            if len(alias) > 4 and re.search(rf"\b{re.escape(alias)}\b", n):
                keys.add(canonical)
                keys |= aliases
                break
    return keys


def locality_keys(town: str | None, address: str | None) -> set[str]:
    """Town field plus comma-tails of the address (never the street line)."""
    keys = town_keys(town)
    parts = [p.strip() for p in str(address or "").split(",") if p and str(p).strip()]
    tails = parts[1:] if len(parts) > 1 else []
    for part in tails:
        if re.fullmatch(r"\d{4,}", part):
            continue
        if re.match(r"(?i)erf\b|shop\b|unit\b|stand\b", part):
            continue
        keys |= town_keys(part)
    return keys


def chain_of(*parts: str | None) -> str | None:
    blob = " ".join(norm(p) for p in parts if p)
    for pat, key in CHAIN_PATTERNS:
        if re.search(pat, blob):
            return key
    return None


def name_sim(a: str, b: str) -> float:
    na, nb = norm(a), norm(b)
    if not na or not nb:
        return 0.0
    if na == nb:
        return 1.0
    if na in nb or nb in na:
        return 0.88 if min(len(na), len(nb)) >= 6 else 0.7
    ta, tb = tokens(a), tokens(b)
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def load_eclb() -> list[dict]:
    wb = openpyxl.load_workbook(XLSX, data_only=True)
    ws = wb["All off-sales pins"]
    rows = []
    header = None
    for i, raw in enumerate(ws.iter_rows(min_row=1, max_col=12, values_only=True), 1):
        if raw[0] == "id":
            header = [str(c) for c in raw]
            continue
        if header is None or raw[0] is None:
            continue
        rec = {header[j]: raw[j] for j in range(len(header))}
        rec["id"] = int(rec["id"])
        rec["postal_code"] = str(rec.get("postal_code") or "").replace(".0", "")
        rec["reg_no"] = str(rec.get("reg_no") or "")
        rec["display_name"] = str(rec.get("display_name") or "")
        rec["licence_holder"] = str(rec.get("licence_holder") or "")
        rec["address"] = str(rec.get("address") or "")
        rec["town"] = str(rec.get("town") or "")
        rec["holder_type"] = str(rec.get("holder_type") or "")
        rec["chain"] = chain_of(rec["licence_holder"], rec["display_name"], rec["address"])
        rows.append(rec)
    return rows


def load_catalog_ec() -> list[dict]:
    data = json.loads(CATALOG.read_text())
    out = []
    for poi in data["pois"]:
        if poi.get("province") != "Eastern Cape":
            continue
        poi = dict(poi)
        poi["chain"] = chain_of(poi.get("name"), poi.get("brand"), poi.get("address"), poi.get("city"))
        poi["town_blob"] = " ".join(
            str(poi.get(k) or "") for k in ("city", "address", "name")
        )
        out.append(poi)
    return out


def close_numbers(a: set[str], b: set[str], max_delta: int = 2) -> list[str]:
    out = []
    for x in a:
        try:
            xi = int(x)
        except ValueError:
            continue
        for y in b:
            try:
                yi = int(y)
            except ValueError:
                continue
            if xi != yi and abs(xi - yi) <= max_delta:
                out.append(f"{xi}~{yi}")
    return sorted(set(out))


def prepare_licence(rec: dict) -> dict:
    rec = dict(rec)
    rec["_addr_tokens"] = tokens(rec["address"]) | tokens(rec["town"])
    rec["_nums"] = numbers(rec["address"])
    rec["_loc_keys"] = locality_keys(rec.get("town"), rec.get("address"))
    rec["_town_norm"] = norm(rec.get("town"))
    rec["_holder_norm"] = rec["licence_holder"]
    rec["_display_norm"] = rec["display_name"]
    return rec


def prepare_poi(poi: dict) -> dict:
    poi = dict(poi)
    poi["_addr_tokens"] = tokens(poi.get("address")) | tokens(poi.get("city")) | tokens(poi.get("name"))
    poi["_nums"] = numbers(poi.get("address") or "")
    poi["_loc_keys"] = locality_keys(poi.get("city"), poi.get("address"))
    poi["_city_norm"] = norm(poi.get("city"))
    poi["_blob_norm"] = norm(poi.get("town_blob"))
    return poi


def towns_overlap(licence: dict, poi: dict) -> bool:
    if licence["_loc_keys"] & poi["_loc_keys"]:
        return True
    town = licence["_town_norm"]
    if town and len(town) >= 5 and re.search(rf"\b{re.escape(town)}\b", poi["_blob_norm"]):
        return True
    city = poi["_city_norm"]
    if city and len(city) >= 5:
        lic_blob = norm((licence.get("town") or "") + " " + (licence.get("address") or ""))
        if re.search(rf"\b{re.escape(city)}\b", lic_blob):
            return True
    return False


def score_pair(licence: dict, poi: dict) -> tuple[float, dict]:
    reasons = []
    town = towns_overlap(licence, poi)
    if town:
        reasons.append("town")
    overlap = licence["_addr_tokens"] & poi["_addr_tokens"]
    town_norm = licence["_town_norm"]
    strong_overlap = {
        t for t in overlap
        if t not in {town_norm, "gqeberha", "kariega", "qonce", "komani"}
    }
    postal = str(licence.get("postal_code") or "")
    nums = {n for n in (licence["_nums"] & poi["_nums"]) if n != postal and not (len(n) == 4 and n[0] in "456")}
    near = close_numbers(
        {n for n in licence["_nums"] if n != postal},
        {n for n in poi["_nums"] if n != postal},
    ) if not nums else []

    street_name_hit = False
    if nums:
        for n in nums:
            lic_sw = street_words_after_number(licence.get("address"), n)
            poi_sw = street_words_after_number(poi.get("address"), n)
            if lic_sw & poi_sw:
                street_name_hit = True
                reasons.append(f"street_name:{sorted(lic_sw & poi_sw)[:3]}")
                break

    brand = chains_match(licence.get("chain"), poi.get("chain"))
    sim = max(
        name_sim(licence["_display_norm"], poi.get("name") or ""),
        name_sim(licence["_holder_norm"], poi.get("name") or ""),
    )
    if licence["holder_type"] == "person":
        sim = min(sim, 0.15)

    score = 0.0
    if town:
        score += 2.0
    if brand:
        score += 2.2
        reasons.append(f"chain:{licence['chain']}")
    if nums and strong_overlap:
        score += 2.5
        reasons.append(f"street_no:{sorted(nums)[:3]}")
    elif near and strong_overlap and brand:
        score += 1.8
        reasons.append(f"street_no_near:{near[:3]}")
    elif nums and brand:
        score += 0.8
        reasons.append(f"street_no_weak:{sorted(nums)[:3]}")
    if strong_overlap:
        score += min(2.4, 0.7 * len(strong_overlap))
        reasons.append(f"addr_tokens:{sorted(strong_overlap)[:6]}")
    if sim >= 0.7:
        score += sim * 2.0
        reasons.append(f"name_sim:{sim:.2f}")
    elif sim >= 0.45 and licence["holder_type"] in {"store_brand", "company"}:
        score += sim
        reasons.append(f"name_sim:{sim:.2f}")

    return score, {
        "score": round(score, 3),
        "town": town,
        "brand": bool(brand),
        "street_numbers": sorted(nums),
        "street_numbers_near": near,
        "addr_tokens": sorted(strong_overlap),
        "street_name_hit": street_name_hit,
        "name_sim": round(sim, 3),
        "reasons": reasons,
        "poi_id": poi["id"],
        "poi_name": poi.get("name"),
        "poi_address": poi.get("address"),
        "poi_city": poi.get("city"),
    }



def distinctive_tokens(toks: list[str] | set[str]) -> list[str]:
    return [t for t in toks if t not in TOWN_WORDS and not str(t).isdigit()]


def classify(score: float, evidence: dict, unique_brand_in_town: bool) -> str:
    town = evidence["town"]
    brand = evidence["brand"]
    nums = evidence["street_numbers"]
    near = evidence.get("street_numbers_near") or []
    toks = evidence["addr_tokens"]
    dist = distinctive_tokens(toks)
    street_hit = bool(evidence.get("street_name_hit"))
    sim = evidence["name_sim"]
    if not town:
        return "unmatched"
    # Same house number on the same named street in the same town.
    if nums and street_hit and score >= 4.5:
        return "MATCH_CONFIRMED"
    if nums and dist and street_hit and score >= 4.5:
        return "MATCH_CONFIRMED"
    if (nums or near) and toks and (brand or sim >= 0.7) and score >= 5.0:
        return "MATCH_CONFIRMED"
    if brand and near and dist and score >= 4.8:
        return "MATCH_CONFIRMED"
    if brand and len(toks) >= 2 and score >= 5.0:
        return "MATCH_CONFIRMED"
    if sim >= 0.88 and (nums or len(toks) >= 1) and score >= 4.8:
        return "MATCH_CONFIRMED"
    if brand and unique_brand_in_town and len(toks) >= 1 and score >= 4.5:
        return "MATCH_CONFIRMED"
    if brand and len(toks) >= 1 and score >= 4.5:
        return "MATCH_LIKELY"
    if (brand or sim >= 0.75) and (nums or toks) and score >= 4.0:
        return "MATCH_LIKELY"
    if sim >= 0.8 and town and score >= 3.5:
        return "MATCH_LIKELY"
    if brand and town:
        return "POSSIBLE_MATCH"
    if sim >= 0.6 and town:
        return "POSSIBLE_MATCH"
    if len(toks) >= 2 and town and score >= 3.2:
        return "POSSIBLE_MATCH"
    return "unmatched"


def public_display_name(licence: dict) -> str:
    """Map-facing name. Never a personal licence-holder name."""
    if licence["holder_type"] == "person":
        town = licence["town"] or "Eastern Cape"
        return f"Off-sales liquor store, {town}"
    if licence["holder_type"] == "unclear":
        town = licence["town"] or "Eastern Cape"
        return f"Off-sales liquor store, {town}"
    chain = licence.get("chain")
    chain_public = {
        "boxer": "Boxer Liquors",
        "shoprite-checkers": None,
        "woolworths": "Woolworths Cellar",
        "picknpay": "Pick n Pay Liquor",
        "tops": "TOPS at SPAR",
        "prestons": "Prestons Liquor Stores",
        "ultra": "Ultra Liquors",
    }
    if chain == "robinson":
        return licence["display_name"] if licence["holder_type"] == "store_brand" else f"Off-sales liquor store, {licence['town'] or 'Eastern Cape'}"
    if chain in chain_public and chain_public[chain]:
        town = licence["town"]
        return f"{chain_public[chain]} {town}".strip() if town else chain_public[chain]
    if licence["holder_type"] == "store_brand":
        return licence["display_name"]
    holder = licence["licence_holder"]
    if re.search(r"bottle store|liquor|drankwinkel|cellar|booze|off-sales|off sales", holder, re.I):
        return licence["display_name"]
    town = licence["town"] or "Eastern Cape"
    return f"Off-sales liquor store, {town}"


def main() -> int:
    licences = [prepare_licence(r) for r in load_eclb()]
    catalog = [prepare_poi(p) for p in load_catalog_ec()]
    print(f"eclb {len(licences)} catalog_ec {len(catalog)}", flush=True)

    chain_town_counts: dict[tuple[str, str], int] = Counter()
    for poi in catalog:
        if poi.get("chain"):
            chain_town_counts[(poi["chain"], norm(poi.get("city")))] += 1

    results = []
    for lic in licences:
        scored = []
        for poi in catalog:
            if not (lic["_loc_keys"] & poi["_loc_keys"]):
                # Cheap reject: no shared locality. towns_overlap has a
                # couple of extra paths; only run those if the cheap test
                # is close (same metro aliases already live in _loc_keys).
                continue
            s, ev = score_pair(lic, poi)
            if s <= 0:
                continue
            scored.append((s, ev, poi))
        scored.sort(key=lambda x: -x[0])
        top = scored[:5]
        unique = False
        if lic.get("chain") and top:
            city = norm(top[0][2].get("city"))
            unique = chain_town_counts.get((lic["chain"], city), 0) == 1

        match_class = "unmatched"
        chosen = None
        if top:
            s, ev, poi = top[0]
            gap = s - (top[1][0] if len(top) > 1 else 0)
            klass = classify(s, ev, unique)
            want = CURATED_CONFIRM.get(lic["id"])
            if want and want.lower() in (poi.get("name") or "").lower():
                klass = "MATCH_CONFIRMED"
                ev = dict(ev)
                ev["reasons"] = list(ev.get("reasons") or []) + ["curated_confirm"]
            if klass == "MATCH_CONFIRMED" and gap < 0.8 and len(top) > 1 and top[1][0] >= 4.5:
                if not want:
                    klass = "POSSIBLE_MATCH"
            match_class = klass
            chosen = {
                "class": klass,
                "score": s,
                **{k: ev[k] for k in ev if k != "score"},
            }

        rec = {
            "eclb_id": lic["id"],
            "reg_no": lic["reg_no"],
            "licence_holder": lic["licence_holder"],
            "holder_type": lic["holder_type"],
            "display_name_source": lic["display_name"],
            "public_display_name": public_display_name(lic),
            "address": lic["address"],
            "town": lic["town"],
            "postal_code": lic["postal_code"],
            "chain": lic.get("chain"),
            "licence_type": lic.get("licence_type"),
            "match_class": match_class,
            "existing_poi_id": chosen["poi_id"] if chosen and match_class in {"MATCH_CONFIRMED", "MATCH_LIKELY"} else None,
            "existing_poi_name": chosen["poi_name"] if chosen and match_class in {"MATCH_CONFIRMED", "MATCH_LIKELY"} else None,
            "action": None,
            "match": chosen,
            "alt_candidates": [
                {"poi_id": ev["poi_id"], "poi_name": ev["poi_name"], "score": s, "reasons": ev["reasons"]}
                for s, ev, _ in top[:3]
            ],
        }
        if match_class == "MATCH_CONFIRMED":
            rec["action"] = "enrich_existing"
        elif match_class == "MATCH_LIKELY":
            rec["action"] = "review_likely"
        elif match_class == "POSSIBLE_MATCH":
            rec["action"] = "review_possible"
        else:
            rec["action"] = "no_existing_match"
        results.append(rec)

    counts = Counter(r["match_class"] for r in results)
    actions = Counter(r["action"] for r in results)
    print("classes", dict(counts))
    print("actions", dict(actions))
    print("holder types unmatched", Counter(r["holder_type"] for r in results if r["match_class"] == "unmatched"))

    enrichment = []
    used_existing = set()
    for r in results:
        if r["match_class"] != "MATCH_CONFIRMED" or not r["existing_poi_id"]:
            continue
        if r["existing_poi_id"] in used_existing:
            r["match_class"] = "POSSIBLE_MATCH"
            r["action"] = "review_possible_duplicate_licence"
            continue
        used_existing.add(r["existing_poi_id"])
        enrichment.append({
            "existingId": r["existing_poi_id"],
            "eclbId": r["eclb_id"],
            "eclbRegNo": r["reg_no"],
            "eclbLicenceHolder": r["licence_holder"],
            "eclbHolderType": r["holder_type"],
            "address": r["address"] or None,
            "matchClass": "MATCH_CONFIRMED",
        })

    counts = Counter(r["match_class"] for r in results)

    report = {
        "source": "ECLB Register of Registered Liquor Traders 2025-2026",
        "scope": "Eastern Cape off-consumption only",
        "existingEasternCapeCatalog": len(catalog),
        "eclbOffConsumption": len(licences),
        "matchClasses": dict(counts),
        "actions": dict(Counter(r["action"] for r in results)),
        "holderTypes": dict(Counter(r["holder_type"] for r in results)),
        "confirmedEnrichment": len(enrichment),
        "notes": [
            "Existing Booze Compass names are retained on every confirmed match.",
            "Personal licence-holder names are never used as map-facing store names.",
            "Absence from the ECLB register does not delete an existing catalog POI.",
            "New pins are not created from unmatched person/unclear rows without independent public-name + coordinate verification.",
            "Form 18 (ECLB) has separate BUSINESS NAME and LICENCE HOLDER FULL NAME; the published register only lists the registered person.",
        ],
    }

    OUT_DIR.mkdir(exist_ok=True)
    DATA_DIR.mkdir(exist_ok=True)
    (OUT_DIR / "eclb-match-results.json").write_text(json.dumps(results, indent=2))
    (OUT_DIR / "eclb-match-report.json").write_text(json.dumps(report, indent=2))
    (DATA_DIR / "eclbEnrichment.json").write_text(json.dumps({
        "version": 1,
        "generatedFrom": "ECLB 2025-2026 off-consumption register",
        "rule": "fill empty fields only; never rename existing POIs",
        "enrichment": enrichment,
    }, indent=2))

    compact = []
    for lic, rec in zip(licences, results):
        compact.append({
            "id": lic["id"],
            "regNo": lic["reg_no"],
            "licenceHolder": lic["licence_holder"],
            "holderType": lic["holder_type"],
            "publicDisplayName": rec["public_display_name"],
            "address": lic["address"],
            "town": lic["town"],
            "postalCode": lic["postal_code"],
            "licenceType": "Off Consumption",
            "chain": lic.get("chain"),
            "matchClass": rec["match_class"],
            "existingPoiId": rec["existing_poi_id"],
        })
    (DATA_DIR / "eclbLicences.json").write_text(json.dumps({
        "version": 1,
        "province": "Eastern Cape",
        "licenceType": "Off Consumption",
        "count": len(compact),
        "licences": compact,
    }, separators=(",", ":")))

    print("wrote", OUT_DIR / "eclb-match-report.json")
    print(json.dumps(report, indent=2))

    print("\n--- Anton / St Francis ---")
    for r in results:
        blob = (r["licence_holder"] + r["address"] + r["town"]).lower()
        if "viljoen" in blob or ("st francis" in blob and "bay" in blob):
            print(r["eclb_id"], r["licence_holder"][:50], r["address"][:60], r["match_class"], r["existing_poi_name"])

    print("\n--- Boxer ---")
    for r in results:
        if r.get("chain") == "boxer":
            print(r["eclb_id"], r["town"], r["address"][:50], "=>", r["match_class"], r["existing_poi_name"])

    print("\n--- Robinson ---")
    for r in results:
        if r.get("chain") == "robinson":
            print(r["eclb_id"], r["town"], r["address"][:55], "=>", r["match_class"], r["existing_poi_name"])

    print("\n--- Prestons ---")
    for r in results:
        if r.get("chain") == "prestons":
            print(r["eclb_id"], r["town"], r["address"][:55], "=>", r["match_class"], r["existing_poi_name"])

    print("\n--- Protea / Showground ---")
    for r in results:
        if r["eclb_id"] in {935, 705}:
            print(r["eclb_id"], r["licence_holder"], r["address"][:55], "=>", r["match_class"], r["existing_poi_name"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
