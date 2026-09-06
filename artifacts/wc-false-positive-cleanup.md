# Western Cape false-positive cleanup

Targeted review of current WC POIs in the confirmed Stellenbosch error classes. The WC pipeline was not rerun.

| Metric | Count |
| --- | ---: |
| FALSE POSITIVES REVIEWED | 53 |
| WINE FARM / TASTING ROOM REMOVED FROM COMPASS | 20 |
| NON-RETAIL BUSINESSES REMOVED | 27 |
| RESIDENTIAL UNVERIFIED MOVED TO REVIEW | 4 |
| DUPLICATES COLLAPSED | 1 |
| INFERRED WCELLAR REMOVED | 1 |
| VALID BOTTLE STORES LEFT UNCHANGED | all other WC pins |

Classifiers now refuse to infer WCellar from a bare Woolworths, and reject associations, events, cork/packaging suppliers, B2B warehouses / liquor distributors, online-only listings, producer cellar-door addresses, private cellars, and names that are a wine *estate*.

Stellenbosch Square WCellar (`wcla-044152`) is matched onto existing OSM `W Cellar` (`osm-seed-node-13452712711`). One physical store.

Binta's Liquors at 62 Cedile Road is in WCLA review — liquor-sounding name on a residence is not a storefront.

OSM wine farms stay in the seed (no source deletion) but are excluded from compass ranking. Residual OSM exclusions include Bein Wine, Peter Falke wine tastery, Zorgvliet Wine tasting, the unnamed Paarl-area Tasting room, J.C. Le Roux, Bartinney, and Camberley Wines (OSM name Camber).

Restaurant & Hotel Liquor Distributors (Parow Industrial) and Agesi Liquor Distributors (Klapmuts) were removed from the Google catalog as B2B, not walk-in retail.

Picardi Rebel, Parade Liquor Store, Pick n Pay Liquor Andringa, Liquor King Kayamandi, TOPS at SPAR (Stone Square / Paradyskloof / Paul Roos / The Vineyard), Ferry Fine Wine, Caroline's Fine Wine Cellar, and the airport Wine Boutique were left untouched. Uncertain town wine shops (BOK WYN, VIN ARTISANAL, Gourmandium) were not deleted.
