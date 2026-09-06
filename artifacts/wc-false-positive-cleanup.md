# Western Cape false-positive cleanup

Targeted review of current WC POIs in the confirmed Stellenbosch error classes. The WC pipeline was not rerun.

| Metric | Count |
| --- | ---: |
| FALSE POSITIVES REVIEWED | 44 |
| WINE FARM / TASTING ROOM REMOVED FROM COMPASS | 13 |
| NON-RETAIL BUSINESSES REMOVED | 25 |
| RESIDENTIAL UNVERIFIED MOVED TO REVIEW | 4 |
| DUPLICATES COLLAPSED | 1 |
| INFERRED WCELLAR REMOVED | 1 |
| VALID BOTTLE STORES LEFT UNCHANGED | all other WC pins |

Classifiers now refuse to infer WCellar from a bare Woolworths, and reject associations, events, cork/packaging suppliers, B2B warehouses, online-only listings, and producer cellar-door addresses.

Stellenbosch Square WCellar (`wcla-044152`) is matched onto existing OSM `W Cellar` (`osm-seed-node-13452712711`). One physical store.

Binta's Liquors at 62 Cedile Road is in WCLA review — liquor-sounding name on a residence is not a storefront.

Picardi Rebel, Parade Liquor Store, Pick n Pay Liquor Andringa, Liquor King Kayamandi, TOPS at SPAR (Stone Square / Paradyskloof / Paul Roos), Ferry Fine Wine, and Caroline's Fine Wine Cellar were left untouched.
