# ECLB 2025–2026 off-consumption: legal reading, spot-check, public vs backend

Scope: Eastern Cape **off-consumption only** (1,339 rows). Matched against the existing Booze Compass catalog (382 Eastern Cape Google POIs, plus seed/curated). Not a national scrape. Existing pins are never deleted, renamed, or replaced.

## 1. Holder vs trading name — legal conclusion

The published register **is a list of licence holders at licensed premises, not a list of shop fascias.**

| Source | What it actually names |
|---|---|
| [Eastern Cape Liquor Act 10 of 2003](https://www.saps.gov.za/services/flash/liquor/ec_liquor_act.pdf) s.1 | **registered person** = person who holds a certificate of registration. **registered premises** = the premises that certificate is issued for. These are distinct. |
| Act 10 of 2003 s.20 / s.35 | Certificate is issued **in the applicant’s name** and records the premises. The Board keeps a **register of registered persons**. |
| ECLB Form 18 (Reg. 16) — *Form to update / confirmation of registration details* | Separate fields: **BUSINESS NAME** and **LICENCE HOLDER FULL NAME**, plus **ADDRESS OF PREMISES**. The published spreadsheet does not include Business name. |
| ECLB Form 20 (Reg. 20) — *Register of registered persons* | Column heading: **Name and address of registered person**. That is the same heading as the 2025–2026 spreadsheet. |

So:

> “Anton Viljoen, Erf 3083 Shop 7, St Francis Bay”

means a natural person holds an off-consumption registration at that premises. It does **not** mean the shop is called Anton Viljoen Bottle Store. Form 18’s unpublished Business name is the field that would have held the fascia.

Company / CC / trust names are also holder names. They sometimes coincide with the fascia (Bay Liquor, Barkly East Bottle Store) and often do not (C.J. Robinson Liquors trading as Ultra; Prestons Pe Liquor Trust at a premises Google lists as Big Daddy’s).

## 2. Public vs backend fields

**Map-facing / public**

- Existing Booze Compass store name (always wins on a match)
- Independently verified trading name on a new pin
- Generic `Off-sales liquor store, {town}` only if we were to pin an unmatched person/unclear row (we did **not** bulk-pin those)
- Address, coordinates, category (`standalone` / `attached-counter`), brand/parent when known

**Backend only (never copied onto `LiquorStore.name`)**

- `eclbLicenceHolder` — raw registered-person name, including personal names
- `eclbHolderType` — person / company / store_brand / unclear
- `eclbRegNo`, `eclbId`
- Match class, matcher notes, source-row text
- `eclbLicences.json` — full off-consumption snapshot for review; not imported by the UI

Personal names are stored on the catalog record so a later licence lookup is possible. They are not painted on the compass.

## 3. Spot-check (18 records)

Cross-checked against the existing catalog, chain naming, and previously verified public listings (TOPS Village Square, Ultra Oxford, Prestons Aalwyn / Walmer, Barkly East 22 De Villiers, Big Daddy’s 2 Archie Place).

| # | ECLB holder | ECLB address | Existing Booze Compass | Public fascia | Real off-sales? | Holder = fascia? | Decision |
|---|---|---|---|---|---|---|---|
| 1 | Anton Viljoen (person) | Erf 3083 Shop 7, St Francis Bay | none | TOPS at SPAR Village Square | yes | **no** | **New pin** `eclb-7` named TOPS at SPAR St Francis Bay. Holder stays backend. Rushtail 55 at the same centre is **not** a second pin. |
| 2 | Boxer Superliquors (Pty) Limited | Spondo / Koyana / Qeqe, Zwide | Zwide Boxer Liquors | Zwide Boxer Liquors | yes | chain yes, legal name ≠ fascia | **Enrich existing**. Keep Zwide Boxer Liquors. |
| 3 | Boxer Superstore (Pty) Ltd | 112–120 Commercial Road, Korsten | Port Elizabeth Boxer Liquors | Port Elizabeth Boxer Liquors | yes | chain yes | **Enrich existing**. |
| 4 | C.J. Robinson Liquors (Pty) Limited | 250 Oxford Street, East London | Ultra Liquors Oxford (248 Oxford) | Ultra Liquors | yes | **no** (Robinson owns Ultra) | **Enrich existing**. Keep Ultra. Adjacent street numbers, curated confirm. |
| 5 | C.J. Robinson Liquors (Pty) Limited | Hurd & Belfast, Gqeberha | Ultra Liquors - Newton Park | Ultra Liquors | yes | **no** | **Enrich existing**. Keep Ultra. |
| 6 | C.J. Robinson Liquors (Pty) Limited | Bowker & Robinson, Komani | Ultra Liquors Express | Ultra Liquors Express | yes | **no** | **Enrich existing**. |
| 7 | Prestons Pe Liquor Trust | 121 Main Road, Walmer | Prestons Liquor Stores Main Road | Prestons | yes | yes (trading as Prestons) | **Enrich existing**. |
| 8 | Prestons Pe Liquor Trust | 2 Archie Place, Young Park | Big Daddy's Liquor Stores Young Park | Big Daddy’s | yes | **no** | **Enrich existing**. Keep Big Daddy’s. Same street address; licence holder is Prestons. |
| 9 | Prestons Pe Liquor Trust | Fairbridge Heights, 7 Aalwyn Drive | Prestons Liquor Stores Fairbridge Heights (3 Aalwyn) | Prestons Fairbridge Heights | yes | yes as fascia | **Enrich existing**. Not a new pin. ECLB house number disagrees with public listings; Google pin already exists. |
| 10 | Prestons Liquors Pe Trust | 36B Main & Biscay, Port Alfred | Prestons Liquor Stores Port Alfred | Prestons | yes | yes as fascia | **Enrich existing**. |
| 11 | Barkly East Bottle Store Cc | 22 De Villiers Street, Barkly East | none | Barkly East Bottle Store | yes | yes | **New pin** `eclb-239`. Catalog had no Barkly East off-sales pin. |
| 12 | Bay Liquor | Mytelene Court, Batting Road, Beacon Bay | Bay Liquor | Bay Liquor | yes | yes | **Enrich existing**. |
| 13 | Pellsrus Liquor Trust | 1 Harder Street, Jeffreys Bay | Big Daddy's Liquor Stores Jeffrey's Bay | Big Daddy’s | yes | **no** | **Enrich existing**. Keep Big Daddy’s. |
| 14 | Antonio Martinus Stander (person) | 2 Gavin Street, Scheepershoogte (town field wrongly says Bizana) | First Stop Liquors | First Stop Liquors | yes | **no** | **Enrich existing**. Keep First Stop. Person name is backend-only. |
| 15 | Frederick Johannes Stewart (person) | Erf 1621 Voortrekker Square, Aberdeen | none | unknown | likely a licensed premises, no public fascia found | n/a | **No pin**. Person row, no independent trading name, no geocode. |
| 16 | Amathole Liquors Cc | 24 Worcester Street, Somerset East | none | reported as Liquor Majestic / Blue Bottle; not in catalog | yes (unverified coords) | **no** if Majestic | **Unresolved**. Not bulk-added. Needs a geocoded public name before a pin. |
| 17 | Schwitter Family Trust | 162 St Francis Drive, St Francis Bay | none | St Francis Bay Blue Bottle (independent listing) | yes | **no** | **Unresolved**. Long-road geocode only; not added. |
| 18 | Shoprite Checkers (Pty) Limited | Shop 9A Fingoland Mall, Butterworth | Shoprite LiquorShop Butterworth | Shoprite LiquorShop | yes | legal name ≠ fascia | **Enrich existing**. Keep Shoprite LiquorShop. |

Showground Liquor Store (60 Kariega Road) also confirmed to the existing same-named pin — holder equals fascia.

## 4. What the sample shows

- **Premises are usually real off-sales** when the address is an urban street / mall shop. Rural person rows are often a homestead or trading site with no published shop name.
- **Holder = public name** mainly on `store_brand` rows (Bay Liquor, Showground, Barkly East Bottle Store, some Prestons).
- **Holder ≠ public name** is common: Robinson→Ultra, person→TOPS / First Stop, trust→Big Daddy’s, Shoprite Checkers (Pty) Ltd→Shoprite LiquorShop.
- **No reliable public trading name** is the default for unmatched `person` rows (539 of 988 unmatched). Those stay in `eclbLicences.json` only.
- **Duplicate risk is high** if the register is ingested as a shop list. Fairbridge Prestons was the near-miss this pass (ECLB 7 Aalwyn vs catalog 3 Aalwyn). Archie Place and Harder Street would have created a second pin next to Big Daddy’s. Match-first avoided that.

## 5. Matcher outcome (this pass)

| Class | Count | Action |
|---|---|---|
| MATCH_CONFIRMED | 79 | Enrich existing pin. Keep public name. |
| MATCH_LIKELY | 17 | Review only. Not written onto the catalog. |
| POSSIBLE_MATCH | 255 + 1 duplicate-licence | Review only. |
| unmatched | 988 (539 person / 314 company / 98 unclear / 37 store_brand) | No bulk pins. |

New map pins created: **2**.

- `eclb-7` TOPS at SPAR St Francis Bay (locality geocode, Village Square / Sea Vista)
- `eclb-239` Barkly East Bottle Store, 22 De Villiers Street

Catalog size: **5732 + 2 = 5734**. Every previous id survives.

Left unmatched on purpose (examples): Anton Viljoen (new pin uses the TOPS name, not a second “Anton” pin), Njoli Boxer (catalog Boxer at Njoli/Meke did not share locality keys — flagged POSSIBLE, not forced), Robinson 17 Calderwood / 51 Beaufort (likely Ultra, town field empty or no catalog Ultra in Makhanda), Woolworths Baywest, Somerset East Amathole.

## 6. Rules encoded in code

- `applyEclbEnrichment` never assigns `name` from the register.
- `publicEclbDisplayName` / `looksLikePersonName` reject personal names as fascias.
- `discoverLocal` and `discoverRefresh` include the two ECLB gap pins additively with seed / curated / Google.
- Absence from the ECLB file is not deletion.
