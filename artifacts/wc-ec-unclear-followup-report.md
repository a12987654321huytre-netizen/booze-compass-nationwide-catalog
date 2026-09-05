# WC 1146 unclear-name + EC Google follow-up

Targeted passes only. No nationwide rediscovery. No restart of completed WC LIKELY / EC confirmed work. No deletions.

## Counts

```
WC UNCLEAR ROWS PROCESSED: 1146
WC CONFIRMED BOTTLE STORES: 35
WC MATCHED EXISTING: 21
WC NEW POIS ADDED: 14
WC CONFIRMED NOT BOTTLE STORES: 623
WC STILL AMBIGUOUS: 488
EC REVIEW ROWS CHECKED WITH GOOGLE: 37
EC CONFIRMED EXISTING MATCHES: 6
EC NEW POIS ADDED: 1
EC STILL UNRESOLVED: 30
CATALOGUE BEFORE: 6502
CATALOGUE AFTER: 6517
ORIGINAL IDS PRESERVED: 6502 / 6502
DELETED: 0
```

1146 = 21 matched + 14 new + 623 not + 488 still ambiguous.
Integrity: `all_before_ids ⊆ all_after_ids`. Vitest 199 passed.

## 1. Newly added WC stores

| ID | Name | Town | Address | Precision |
|---|---|---|---|---|
| wcla-038573 | Small Boy's Liquors | Robinvale | 6 Coly Lane, ROBINVALE, Atlantis, 7349 | building |
| wcla-038947 | Milton's Liquors | Delft | 111 Mono Crescent, Leiden, DELFT, 7102 | building |
| wcla-043684 | Boxer Superliquors Ilitha Mall | Ilitha Park | 15 Khwezi Crescent, ILITHA PARK, Khayelitsha, 7784 | street |
| wcla-008194 | Liquorland Express Esperanza | Heidelberg | Swartstraat, HEIDELBERG, 6665 | building |
| wcla-038606 | Crazy Liquors | Oudtshoorn | Randstraat 02, OUDTSHOORN, 6625 | building |
| wcla-039218 | Norman Goodfellows - Plett | Plettenberg Bay | Plett Airport Business Park, Shops 5-8, Airport Road, Roodefontein, PLETTENBERG BAY, 6600 | street |
| wcla-037915 | Panorama Bottelstoor | Riversdale | Corner Versveld and Petersen Street, RIVERSDALE, 6670 | street |
| wcla-030942 | Oasis Blue Bottle Liquors | Bredasdorp | 31-33 Kerk Street, BREDASDORP, 7280 | street |
| wcla-011100 | Hangklip Bottle Store | Pringle Bay | 14 Central Road, PRINGLE BAY, Kleinmond, 7196 | street |
| wcla-029520 | Captain's Corner Bottelstoor | Klawer | 1 Alpha Street, KLAWER, 8145 | building |
| wcla-011426 | Cove Bottle Store | St Helena Bay | Main Street, Steenberg's Cove, ST HELENA BAY, Vredenburg, 7390 | street |
| wcla-042342 | Boxer Superliquors Mbekweni | Mbekweni | Corner of Wamkelekile and Elonwabo Streets, MBEKWENI, Paarl, 7655 | building |
| wcla-020675 | Sunrise Blue Bottle Liquors | Somerset West | Shop F, 157 Main Road, SOMERSET WEST, 7130 | building |
| wcla-037082 | Riverview Bottle Store | Worcester | 151 Pieterse Street, WORCESTER, 6850 | building |

## 2. Newly added EC stores

| ID | Name | Town | Address | Precision |
|---|---|---|---|---|
| eclb-1211 | ECR Liquor Store | Qonce | 15 Wodehouse Street, Qonce, 5600 | building |

## 3. WC rows that looked ambiguous but were confirmed not to be bottle stores

Cheap text already rejected wine farms, SuperSPAR / Food Lover's / OK Mini / Sentra, taverns, hotels, Yuppiechef, padstal, Agrimark, Makro-without-liquor, Meridian offices, airport duty-free, etc. (617). This pass additionally rejected:

- **WCP/031718 Route 62 Wynwinkel** — Google: Route 62 Wine Shop and Camping Grounds — estate wine shop / camping, not a dedicated bottle store
- **WCP/036355 Dopshop @ Breede River Trading Post** — Google types grocery_or_supermarket / supermarket (Breede River Trading Post)
- **WCP/043938 Cellar X** — Franschhoek agricultural estate / cellar door, not a high-street bottle store
- **WCP/028780 Zetlers Food & Wine Shop** — Lynedoch R310 petrol / food & wine shop, not a dedicated bottle store
- **WCP/034615 Oak Barrel Wine Shop** — farm wine shop, George
- **WCP/045314 The Darling Wine Shop** — urban wine boutique at 5 Main Street; not Checkin Liquor Darling; not added as a bottle-store pin
- **WCP/032033 Cape Gate Superspar** — ordinary supermarket
- **WCP/043836 Food Lover's Market - Bothasig** — ordinary supermarket
- **WCP/039662 Makro Cape Gate** — warehouse, not dedicated bottle store (Makro Liquor already in catalogue separately)
- **WCP/037708 Twelve Apostles Winery** — wine farm / winery
- **WCP/042563 Constantia Uitsig Wine Shop** — estate wine shop
- **WCP/041987 The Cellar Southern Sun Waterfront** — hotel cellar / Southern Sun, not a bottle store
- **WCP/034307 Table Mountain Wine Shop** — Google: Table Mountain Cafe
- **WCP/042071 Yuppiechef (Willow Bridge)** — kitchen retailer
- **WCP/034927 Tesselaarsdal Bottlestore** — Google hospitality/winery at Farm 811, Tesselaarsdal

## 4. Genuinely unresolved rows still needing human review

### Western Cape (488 remaining)

Most leftover names are Consumption Off licences that do not prove a dedicated bottle store (`Generations`, `Margaret's`, `Frank's Place`, couriers, Seven Eleven, offices). Plausible leftovers that still lack a defensible pin:

- **WCP/008282 Picardi Rebel** — 546 Inner Ring Road, ATLANTIS. Second Atlantis Picardi licence (Picardi Hotelle). Places cannot produce a distinct coordinate from the existing Wesfleur Circle Picardi Liquors pin; distance is not identity so it was not merged or invented.
- **WCP/008234 Kensington Liqour Store** — 170 Bunney Street, KENSINGTON. Places only returns TOPS at SPAR Kensington (27 12th Avenue). Different street, different fascia — not merged, no independent 170 Bunney geocode.
- **WCP/039406 Rooirok Offsales** — 234 Keurtjie Street, GRAAFWATER. Places snapped to Graafwater Hotel / Agrimark, not a bottle-store coordinate.
- **WCP/032938 Liquormait** — 311 Voortrekker Road, Maitland. Name does not independently prove a dedicated bottle store; not geocoded this pass.
- **WCP/036187 Generations** — 19 Bunting Crescent, Robinvale, ATLANTIS. Consumption Off only; premises name does not prove a dedicated bottle store.
- **WCP/038439 Margaret's** — 46 COURSER AVENUE, ROBINVALE, ATLANTIS. Premises name does not prove a dedicated bottle store.

### Eastern Cape (30 of 37 Google-checked rows not matched and not added)

Dedicated names still without a safe pin:

- **eclb-240 Fairview Bottle Store** (Barkly East) — 2007 Church Street, Fairview, Barkly East. dedicated name, no defensible Google geocode
- **eclb-790 Kavalier Drankwinkel Cc** (Jamestown) — 7 Hill Street, Jamestown. dedicated name, no defensible Google geocode
- **eclb-1305 Shaz Bottle Store Magwatyuzeni Location** (Tsomo) — Mfula Administrative Area, Tsomo. dedicated name, no defensible Google geocode
- **eclb-1332 Amahlathi Bottle Store (Pty) Limited** (Zwelitsha) — 275 Tyhusha Admin Area, Zwelitsha. dedicated name, no defensible Google geocode
- **eclb-9 Balmoral Bottle Store (Pty) Ltd** () — Corner Hunt And Somerset Streets. dedicated name, no town / no defensible geocode
- **eclb-1043 Mg Liquors (Pty) Limted 10102** (Mdantsane) — Zone 2, Highway Taxi Rank, Mdantsane. Places suggested King Liquors Qumza Highway — different fascia, not merged
- **eclb-528 Daku Liquors Cc** (Gqeberha) — Corner Dambisa Road And Mbilini Street, Kwazakhele. not proven to be Shoprite LiquorShop Daku Road (different name/streets)
- **eclb-1215 King Beta Cc** (Qonce) — 29 Downing Street. existing KING BETA pin is Buffalo Road — same-name different address stays unresolved, not merged
- **eclb-1135 Akl Liquor** (Ngcobo) — 76 High Street. not TOPS Spargs Engcobo; no independent pin (tests forbid eclb-1135)
- **eclb-968 Lusikisiki Liquor Store Partnership** (Lusikisiki) — 42 Main Street. not Shoprite Lusikisiki; no independent geocode this pass
- **eclb-43 Hennie & Yvonne** (Cookhouse) — 6B Main Street. Places snapped to NOORSVELD DRANKWINKEL Jansenville (wrong town); not added
- **eclb-487 Sparks Liquor** (Fort Beaufort) — 16 Church Street. 16 Church is Prestons; TOPS Georgiou is a different street; not added
- **eclb-1250 Amathole Liquors Cc** (Somerset East) — Erf 5453, 1 New Street. Places snapped to a guesthouse
- **eclb-438 Shoprite Checkers (Pty) Limited** (East London) — 74 Buffalo Street. Google is Shoprite supermarket, not LiquorShop
- **eclb-646 Pick 'N Pay Retailers (Pty) Limited** (Gqeberha) — 3456 Second Avenue, Summerstrand. Google is Pick n Pay supermarket, not PnP Liquor

Google-confirmed generic supermarkets among the 37 (Shoprite Buffalo St EL, PnP Summerstrand, SPAR Heath Park, SUPERSPAR Gelvandale, SUPERSPAR Sutherland Ridge) were not added. SPAR/Shoprite/PnP supermarket ≠ LiquorShop/TOPS/PnP Liquor.

## Method notes

- Batch-classified all 1,146 first. Google Places only on plausible leftovers (dedicated fascia / bottle-store tokens).
- Coordinate bar: shop → building → shopping centre → street / erf. No town centroids. No invented pins.
- Distance is never duplicate evidence. Same brand at different addresses stays two pins. Two fascias in one centre stay two pins.
- Personal licence-holder names are never map names (`Riverview Bottle Store` not James van Heerden; `Small Boy's Liquors` / `Milton's Liquors` from premises names).
- False Google snaps that landed on the wrong town or fascia were dropped or re-geocoded to the official address.
