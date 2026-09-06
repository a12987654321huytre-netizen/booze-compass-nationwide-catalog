# KwaZulu-Natal saturation — match-and-add

Catalogue before this pass: **6739**. Deleted: **0**.

## Official KZNERA / KZNLA data

**NO usable live bulk off-consumption register.**

- `kznlqa.co.za` returns HTTP 502
- `kznera.org.za` / `kzngbb.org.za` timed out
- 2023/24 issued-licence PDF exists in Wayback but is truncated at 1 MB (`Invalid object in /Pages`)
- KZNERA liquor portal was advertised as going live 1 June 2026
- NLA national register is manufacturers / distributors only — not retail bottle stores

Off-consumption types on the truncated PDF legend are Liquor Store (L) and Grocers’ Wine (GW). That permission is discovery evidence only; it is not a compass destination by itself.

## Discovery

| Source | Count |
| --- | --- |
| Google Places queries | 590 (0 capped, 0 failed) |
| Google raw results | 9182 |
| Unique Google places | 1231 |
| OSM shop=alcohol/wine in KZN bbox | 76 |
| SPAR gift-card TOPS / liquor names (KZN accordion) | 193 |
| Gazette candidates checked | 0 (no usable recent KZN liquor-store gazette dump) |
| Shoprite / Checkers / Ultra locators | unavailable (CloudFront 403 / SSL 404) |

## Match outcomes

| State | Count |
| --- | --- |
| MATCH_CONFIRMED (already in catalogue or same premises) | 806 |
| NEW_POI_CONFIRMED added | 315 |
| REVIEW_REQUIRED (held, not added) | 93 |
| REJECTED_FOR_COMPASS | 133 |
| SPAR TOPS matched to a pin | 156 |
| SPAR TOPS still unmatched (no defensible Google pin) | 23 |
| SPAR TOPS out of province (EC/MP bleed) | 14 |
| SPAR follow-up Google pins newly added | 7 |
| DELETED | 0 |

Catalogue after: **7054**  
Original IDs preserved: **6739 / 6739**

## Added by district

eThekwini 53 · Ugu 55 · King Cetshwayo 39 · Umkhanyakude 33 · iLembe 22 · Harry Gwala 22 · uMgungundlovu 21 · Zululand 19 · uThukela 18 · Amajuba 17 · Umzinyathi 16

## What was added (examples)

- TOPS at SPAR 1000 Hills, Knowles, Mega Pinetown, Mega Hammarsdale, Camperdown, Howick CBD, Wartburg, Eshowe, Esikhawini, Melmoth, Mtunzini, Ging, Tiffany, Renckens, Maphumulo, Hibberdene, Shelly Beach, MEGA Harding, Bergville, Winterton, Uncle Deli (Utrecht), Ulundi Supatrade, Nongoma, Pongola, Paulpietersburg, Mkuze, Jozini, Kosi Bay, St Lucia, Mega Ixopo, Mega Umzimkhulu, Nquthu, Glencoe, Cornubia, Louwsburg, Highflats, Umkomaas, Craigieburn, Nottingham Road
- Woolworths WCellar Hillcrest
- Checkers LiquorShop Hillcrest (The Colony), Westown, Othongathi, Mount Richmore, Scottburgh
- Shoprite LiquorShop Tongaat, Richards Bay, Hammarsdale-area, Osizweni, Nqutu, Pomeroy, Kosi Bay
- Independents: Charlies Dop Shop, Chiefs Liquor Store (Wentworth), Deen's Liquor Store (Shallcross), Tongaat Liquor City, Purple Pig Liquors, Grassmere Liquors, Illovo Liquor Store

## Kept separate on purpose (distance is not identity)

- PicardiRebel Davenport vs Checkers LiquorShop Davenport (~61 m)
- Checkers LiquorShop Hillcrest Corner vs Checkers LiquorShop Hillcrest (The Colony) vs WCellar Hillcrest — three fascias
- Liberty Liquors Denis Hurley vs Liberty Liquors Sandile Thusi — same brand, different streets
- Newport Liquors vs nearby Blue Bottle listings only merged when house+street proved the same premises

## Official chain locators Google missed, then added

SPAR gift-card names with no existing pin, confirmed via Google Places: Cornubia, Louwsburg, Highflats, Keates Drift, Nottingham Road, Umkomaas, Craigieburn.

Shoprite / Checkers / Ultra official locators were not reachable this pass.

## Licence / gazette independents Google missed

None auto-added. No usable KZNERA bulk file. OSM-only dedicated names without a Google pin were left in REVIEW.

## Rejected correctly

- Audacia Wines / Exclusive Wines (producer / winery shops)
- Crown Eating House and super liquor
- Cha-Cha's Lodge, taverns, pubs, shisanyama
- Cambridge Food grocery banners
- Kwa Mashu Power Spar (SPAR without TOPS)
- ATM pins named after liquor stores
- Volksrust / Harrismith / Piet Retief town / EC SPAR bleed (Bizana, Lusikisiki, Mthatha, Matatiele, Mt Frere, …)
- Closed places (not deleted from the existing catalogue if already present)

## Still REVIEW_REQUIRED

Bar-typed bottle-store names without `liquor_store`, generic “BOTTLE STORE”, settlement-only addresses, mixed supermarket/liquor names, trailer-hire combos, OSM-only pins (Cash & Carry Liquors Vryheid, Induna, Wembezi, eLiquor), and 23 SPAR TOPS labels that still have no defensible geocode (Blair Atholl, Dunbars, HarbourView, Jimmy's, Mondlo, Viedges, …).
