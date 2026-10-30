# Circleville Center Rehab: 3D concept

A walkable 3D model of Circleville Center, 201–213 Lancaster Pike, Circleville, OH 43113, showing the
exterior rehabilitation planned before leasing the vacant units. It runs in any modern browser, on
desktop or phone, from a single HTML file.

**What the model shows**

| Scope item | Where to look |
| --- | --- |
| Sealcoat the entire lot, crack sealing, new striping, ADA stalls, crosswalks | Parking lot view, Existing vs Proposed |
| Pylon sign repainted, new CIRCLEVILLE CENTER lettering and tenant panels | Pylon sign view |
| Ben's Appliances replaces Big Lots (rooftop billboard, sign band, top pylon panel) | Ben's Appliances view |
| ACE Hardware panel directly below Ben's Appliances on the pylon | Pylon sign view |
| Facade repaint: four bold palettes (Lancaster Teal recommended, Signal Red, Cobalt Band, Color Block) and three classic neutral ones | Palette tab |
| Damaged signage replaced (FOR LEASE, leaning ADA signs, rusted cart corrals) | Existing vs Proposed at Ben's |
| ACE Hardware in units 211 and 213 (211 is marked FOR LEASE today) | ACE Hardware view |
| Shared entry recess between Rent-2-Own and 211: the 209 door at the back, 211's door on the side wall | Shared entry recess view |

Use **Existing / Proposed** in the bottom bar to compare with the condition in the September 29, 2026 photos,
**Orbit / Walk** to switch between a drone-style view and walking, **Day / Evening / Dusk** for lighting
(signs, lot lights and storefronts light up at dusk), and **Tour** for an automatic walkthrough.

Deep links: add `#pylon`, `#bens`, `#ace`, `#recess`, `#walkway`, `#lot`, `#pike`, `#station` or `#overview`
to the URL to open at that view, or `#existing` to open on the current condition.

## Files

```
docs/index.html   The complete site (one file). This is what you host or share.
src/              Source modules (layout, materials, signs, lot, controls, UI).
assets/           Ben's Appliances banner (cropped from "Banner Ben's Appliances.png").
build.mjs         Rebuilds docs/index.html from src/ (node build.mjs).
```

The page loads three.js from cdn.jsdelivr.net and fonts from Google Fonts, so viewers need an internet
connection. Everything else, including the banner, is embedded in the file.

## Put it online

### GitHub Pages (free, recommended)
1. Create a new repository on GitHub, for example `circleville-center-3d`.
2. Upload this folder (or at minimum the `docs` folder) to the repository's `main` branch.
3. In the repository, open **Settings → Pages**, set **Source** to *Deploy from a branch*, choose
   `main` and the `/docs` folder, and save.
4. After a minute the site is live at `https://<your-username>.github.io/circleville-center-3d/`.

From a terminal in this folder:

```bash
git init
git add .
git commit -m "Circleville Center 3D concept"
git branch -M main
git remote add origin https://github.com/<your-username>/circleville-center-3d.git
git push -u origin main
```

### Google Cloud Storage
```bash
gcloud storage buckets create gs://circleville-center-3d --location=us-east1
gcloud storage cp docs/index.html gs://circleville-center-3d/index.html
gcloud storage buckets add-iam-policy-binding gs://circleville-center-3d --member=allUsers --role=roles/storage.objectViewer
```
The page is then at `https://storage.googleapis.com/circleville-center-3d/index.html`.

### Google Drive or email
Drive no longer hosts web pages, but you can share `docs/index.html` as a file. Recipients download it
and open it in Chrome, Edge, Safari or Firefox.

## Change the model

Most edits are in `src/config.js`:

* `SCHEMES`: facade palettes, paint codes and the color of every repaintable surface (`look`);
  `DEFAULT_SCHEME` picks the palette the page opens with
* `UNITS`: tenant names and unit boundaries
* `VIEWS`, `TOUR`: saved viewpoints and the tour order
* `LOT`: stall size, aisle positions, crosswalks, entrances

Then rebuild:

```bash
npm install
node build.mjs
```

## Sources and assumptions

* Facade (October 6, 2026 update): measured from an on-site photo survey (39 straight-on and
  32 angled shots) plus tape measurements. The straight-on photos were
  calibrated on the canopy posts (their red bands are a fixed 0.89 m apart), chained into one camera
  track and rectified into a single facade mosaic, which was then scaled to the measured 18 ft post gap
  and the 124.5 m building length from the aerial. Positions of posts, panel joints, doors, windows,
  stone sections and signs come from that mosaic and are good to roughly ±0.3 m.
* Tape measurements used directly: curb to glass 9'11", 18' between posts, sign board 10'2" to 16'8"
  above the sidewalk, door 7'8", window 8'8". The canopy underside (14'3") is the peak of the anchor's
  gabled soffit. The 10 ft pylon measurement is used as the height of the tenant-panel cabinet; the
  whole sign scales to about 19 ft in the 9/29 photo.
* Rear outline and road alignment: OpenStreetMap (© OpenStreetMap contributors, ODbL).
* The shared entry recess between Rent-2-Own and 211: about 15 ft wide and 13 ft deep, measured from
  the 10/6 photos. Rent-2-Own's 209 door is at the back; 211's door is in the NE side wall.
* Aerial imagery (Esri World Imagery) was used only for reference and is not included in the site.
* The sun position is chosen to light the storefronts for presentation. It is not a solar study.
* Paint colors are screen approximations of the listed Sherwin-Williams colors. Confirm with physical
  chips before ordering.
* Tenant names and logos belong to their owners. Signage for ACE Hardware and the other tenants is a
  simplified illustration for planning, not approved sign artwork.
