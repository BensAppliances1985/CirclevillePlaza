// Site-local coordinates, in meters.
// X runs along the storefronts: 0 = SW corner of the building (anchor), 124.5 = NE corner (end of unit 213).
// Z is perpendicular to the storefronts: 0 = curb at the front of the covered walk, +Z goes back into the building,
// -Z goes out across the parking lot toward Lancaster Pike (road centerline at Z = -78). Y is up; the lot is Y = 0.
//
// Facade measured 2026-10-06 from an on-site photo survey (39 straight-on + 32 angled shots, rectified into one
// facade mosaic) and tape measurements: curb to glass 9'11", 18' clear between 2' posts, sign board
// 10'2" to 16'8" above the sidewalk, anchor door 7'8", anchor window 8'8". Overall length (124.5 m) matches the
// aerial; the rear outline comes from the OpenStreetMap footprint (way 1148964810).

export const WALK = 0.15;      // sidewalk height above the lot
export const G = 3.02;         // storefront glass line (curb to glass 9'11")
export const WZ = G + 0.3;     // back face of the storefront wall

export const B = {
  length: 124.5,
  glassZ: G,
  wallZ: WZ,
  // end blocks without a canopy, both set back at the glass line
  tanBox: { x0: 0, x1: 13.1, top: 6.9 },                 // SW block of the anchor, plain CMU with a service door
  neEnd: { x0: 118.8, x1: 124.5, top: 6.0 },             // NE stone-faced block; old sign patch on its face
  fasciaZ: -0.12,
  // canopy sections: sign band (fascia), sloped standing-seam mansard, vertical ribbed parapet with cap
  anchor: { x0: 13.1, x1: 39.41, bottom: 3.25, fasciaTop: 5.39, mansardTop: 6.35, parapetTop: 7.0, run: 2.3, soffitPeak: 4.49 },
  inline: { x0: 39.41, x1: 118.8, bottom: 3.25, fasciaTop: 4.83, mansardTop: 5.8, parapetTop: 6.45, run: 2.3 },
  soffitBack: 3.34,     // inline soffit at the storefront (rises slightly from the sign band)
  post: 0.63,           // 2'1" square posts, front face ~0.15 m behind the curb
  postZ: 0.15 + 0.315,
  postBands: [0.37, 1.34, 2.25],
  posts: [13.43, 19.76, 26.28, 32.81, 39.41, 45.75, 50.6, 53.27, 55.96, 62.39, 68.58, 75.05, 81.48, 87.73, 93.44, 99.62, 105.82, 112.05, 118.49],
  // sign-band panel joints (the anchor/inline junction at 39.41 is an expansion joint)
  joints: { anchor: [13.1, 19.76, 26.28, 32.81, 39.41], inline: [39.41, 45.75, 50.7, 55.96, 62.39, 68.58, 75.05, 81.48, 87.73, 93.44, 99.62, 105.82, 112.05, 118.8] },
  // roof masses behind the storefronts (rear outline from the OSM footprint)
  masses: [
    { x0: 0, x1: 53.4, z1: 79.5, roof: 6.7, wall: 6.9 },
    { x0: 53.4, x1: 73.4, z1: 23.9, roof: 5.9, wall: 6.1 },
    { x0: 73.4, x1: 88.0, z1: 45.9, roof: 5.9, wall: 6.1 },
    { x0: 88.0, x1: 124.5, z1: 40.9, roof: 5.8, wall: 6.0 },
  ],
  // rooftop sign on three posts at the anchor's front wall line
  billboard: { cx: 26.12, w: 19.7, h: 4.0, bottom: 8.7, z: 3.45, depth: 0.45, posts: [21.52, 26.1, 30.68] },
};

// Storefront elements along the glass line, SW to NE. Heights are measured from the sidewalk.
// t: brick | stone | window | glass (full-height sidelight) | glassfull (storefront glass to the floor) |
//    column | mullion | auto (sliding entrance) | door | clerestory (stone wall with a glass band)
export const FACADE = [
  // anchor (former Big Lots, unit 201)
  { t: 'brick', x0: 13.1, x1: 16.36 },
  { t: 'window', x0: 16.36, x1: 19.52, sill: 0.43, panes: 2, knee: 'brick' },
  { t: 'brick', x0: 19.52, x1: 21.28 },
  { t: 'column', x0: 21.28, x1: 21.58 },
  { t: 'brick', x0: 21.58, x1: 22.37 },
  { t: 'auto', x0: 22.37, x1: 24.99 },
  { t: 'glass', x0: 24.99, x1: 25.95 },
  { t: 'column', x0: 25.95, x1: 26.26 },
  { t: 'auto', x0: 26.26, x1: 30.68, side: 0.98, label: '201', graphics: true },
  { t: 'mullion', x0: 30.68, x1: 30.99 },
  { t: 'window', x0: 30.99, x1: 33.69, sill: 0.47, panes: 2, knee: 'brick', dark: true },
  { t: 'mullion', x0: 33.69, x1: 33.95 },
  { t: 'window', x0: 33.95, x1: 35.84, sill: 0.47, panes: 1, knee: 'brick', dark: true },
  { t: 'brick', x0: 35.84, x1: 53.01 },
  { t: 'stone', x0: 53.01, x1: 53.85 },
  // Pumas Rest (203)
  { t: 'window', x0: 53.85, x1: 58.17, sill: 0.62, panes: 3 },
  { t: 'door', x0: 58.17, x1: 60.17, leaves: 2, label: '203' },
  { t: 'window', x0: 60.17, x1: 64.07, sill: 0.62, panes: 3 },
  { t: 'stone', x0: 64.07, x1: 64.81 },
  // 205 (used by Pumas Rest)
  { t: 'window', x0: 64.81, x1: 66.39, sill: 0.69, panes: 1 },
  { t: 'door', x0: 66.39, x1: 67.44, leaves: 1 },
  { t: 'window', x0: 67.44, x1: 68.7, sill: 0.69, panes: 1 },
  { t: 'stone', x0: 68.7, x1: 69.54 },
  // Domino's (207)
  { t: 'window', x0: 69.54, x1: 71.75, sill: 0.78, panes: 2 },
  { t: 'door', x0: 71.75, x1: 73.02, leaves: 1 },
  { t: 'window', x0: 73.02, x1: 75.02, sill: 0.78, panes: 2 },
  { t: 'stone', x0: 75.02, x1: 75.86 },
  // Rent-2-Own (209): glass to the floor; its door is at the back of the recess
  { t: 'glassfull', x0: 75.86, x1: 88.0, panes: 6 },
  // recess 88.0 - 92.6 (see RECESS)
  // 211
  { t: 'stone', x0: 92.6, x1: 92.93 },
  { t: 'window', x0: 92.93, x1: 103.66, sill: 0.93, panes: 5 },
  // 213
  { t: 'clerestory', x0: 103.66, x1: 109.14, stoneTop: 2.1, panes: 3 },
  { t: 'window', x0: 109.14, x1: 111.7, sill: 0.93, panes: 1 },
  { t: 'door', x0: 111.7, x1: 113.6, leaves: 2, label: '213' },
  { t: 'window', x0: 113.6, x1: 117.35, sill: 0.93, panes: 2 },
  { t: 'stone', x0: 117.35, x1: 118.8 },
];

// Shared entry recess between Rent-2-Own and 211: about 15' wide and 13' deep. Rent-2-Own's door (209) is at the
// back with sidelights; 211's entrance is in the NE side wall; the SW side wall is Rent-2-Own glass.
// A steel pipe column stands at the mouth. Measured from the 10/6 photos (ground-line depth and parallax).
export const RECESS = { x0: 88.0, x1: 92.6, depth: 4.0, pipeX: 91.0 };

// Tenant units along the front.
export const UNITS = [
  { id: 'bens', name: "Ben's Appliances", unit: '201', before: 'Big Lots (closed)', status: 'Anchor', x0: 0, x1: 53.4, view: 'bens', note: 'includes the SW end block and the blank wall up to Pumas Rest' },
  { id: 'pumas', name: 'Pumas Rest', unit: '203 & 205', sub: 'Your Local Game Store', before: 'Pumas Rest', status: 'Open', x0: 53.4, x1: 69.12, view: 'pumas' },
  { id: 'dominos', name: "Domino's", unit: '207', before: "Domino's", status: 'Open', x0: 69.12, x1: 75.44, view: 'dominos' },
  { id: 'rent2own', name: 'Rent-2-Own', unit: '209', before: 'Rent-2-Own', status: 'Open', x0: 75.44, x1: 88.0, sub: 'door at the back of the recess', view: 'rent2own' },
  { id: 'ace', name: 'ACE Hardware', unit: '211 & 213', before: '211 for lease, 213 vacant', status: 'Coming soon', x0: 88.0, x1: 124.5, sub: "211's door opens off the recess", view: 'ace' },
];

// Parking layout: two-way drive aisles run perpendicular to the storefronts (as in the existing lot),
// double rows of 90-degree stalls between them, a drive lane along the storefronts and a perimeter lane by the road.
export const LOT = {
  roadEdgeZ: -69.5,
  rowFront: -10,          // first stall line (drive lane along the storefronts is Z -10..0)
  stallW: 2.75,           // 9 ft
  stallsPerRow: 18,
  aisleW: 7.4,
  aisles: [-0.5, 18.58, 37.67, 56.75, 75.83, 94.92, 114],
  eastRowEnd: 129.38,
  crosswalks: [37.67, 75.83, 114],        // at Ben's, mid-center and ACE entrances
  entrances: [{ x: -28, w: 13 }, { x: 18.58, w: 9 }, { x: 94.92, w: 9 }],
};
LOT.rowBack = LOT.rowFront - LOT.stallW * LOT.stallsPerRow; // -59.5

export const ROAD = { z0: -72.5, z1: -83.5, center: -78 };
export const PYLON = { x: 62, z: -67.4 };

// Lancaster Pike runs 26.8 deg north of east; storefronts face NNW (azimuth ~333 deg).
// Unit vectors of true north / east expressed in site-local X,Z.
export const NORTH = { x: 0.451, z: -0.892 };
export const EAST = { x: 0.892, z: 0.451 };

// Facade color schemes. Codes are Sherwin-Williams colors; screen colors are approximate, so confirm against
// physical chips before ordering paint or metal coatings.
//
// Each look sets every repaintable surface:
//   mansard / ribbed  sloped standing-seam roof and the vertical ribbed parapet above it
//   frame             sign-band frame, panel joints, copings, billboard frame
//   panel             sign-band panels behind tenant signs; panelB-E = the blank panels (Color Block only)
//   backer            cabinet behind each tenant sign (shows only when it differs from the panel color)
//   pier / pierBand   canopy posts and their three bands
//   wall / endWall    painted block at the storefronts / the SW end block beside the anchor
//   soffit, stone, mullion, door, backWall, accent, pylon, pylonAccent
export const SCHEMES = {
  D: {
    name: 'Lancaster Teal',
    group: 'Bold',
    tag: 'Recommended',
    blurb: 'Teal roof, parapet and pylon with gold accents. Teal sits opposite red on the color wheel, so the red ACE, Ben\'s and Rent-2-Own signs jump off it, and nothing else on Lancaster Pike looks like it.',
    chips: [
      { role: 'Roof, parapet, pylon & SW end wall', name: 'Really Teal', code: 'SW 6489', hex: '#0B7480' },
      { role: 'Sign band frames & trim', name: 'Oceanside', code: 'SW 6496', hex: '#015063' },
      { role: 'Sign band, posts & soffit', name: 'Pure White', code: 'SW 7005', hex: '#EDECE6' },
      { role: 'Post bands, doors & pylon band', name: 'Gusto Gold', code: 'SW 6904', hex: '#F8AC1D' },
    ],
    look: {
      mansard: '#0B7480', ribbed: '#0A6B76', frame: '#015063', panel: '#EDECE6',
      pier: '#EDECE6', pierBand: '#F8AC1D', wall: '#E3E0D8', endWall: '#0B7480', accent: '#F8AC1D',
      soffit: '#EDECE6', stone: '#ECE8E0', mullion: '#22343A', door: '#F8AC1D', backWall: '#D5D2CA',
      pylon: '#0B7480', pylonAccent: '#F8AC1D',
    },
  },
  E: {
    name: 'Signal Red',
    group: 'Bold',
    tag: 'Brand match',
    blurb: 'Red roof, pylon and SW end wall with black trim. Ben\'s Appliances and ACE are both red brands, so the whole center reads as one from the road.',
    chips: [
      { role: 'Roof, parapet, pylon & SW end wall', name: 'Positive Red', code: 'SW 6871', hex: '#AD2C34' },
      { role: 'Frames, trim & post bands', name: 'Tricorn Black', code: 'SW 6258', hex: '#2F2F30' },
      { role: 'Sign band, posts & soffit', name: 'Extra White', code: 'SW 7006', hex: '#EEEFEA' },
      { role: 'Storefront walls', name: 'Repose Gray', code: 'SW 7015', hex: '#CCC9C0' },
    ],
    look: {
      mansard: '#AD2C34', ribbed: '#A3282F', frame: '#2F2F30', panel: '#EEEFEA',
      pier: '#EEEFEA', pierBand: '#2F2F30', wall: '#CCC9C0', endWall: '#AD2C34', accent: '#2F2F30',
      soffit: '#EEEFEA', stone: '#E8E6E1', mullion: '#262627', door: '#AD2C34', backWall: '#D2D0CA',
      pylon: '#AD2C34', pylonAccent: '#2F2F30',
    },
  },
  F: {
    name: 'Cobalt Band',
    group: 'Bold',
    tag: 'Boldest',
    blurb: 'The sign band itself turns cobalt, with every tenant sign on a white cabinet under a black roof. The strongest look from the road, especially at night with the cabinets lit.',
    chips: [
      { role: 'Sign band, post bands, pylon & SW end wall', name: 'Hyper Blue', code: 'SW 6965', hex: '#015F97' },
      { role: 'Sign cabinets, frames, posts & soffit', name: 'Extra White', code: 'SW 7006', hex: '#EEEFEA' },
      { role: 'Roof & parapet', name: 'Tricorn Black', code: 'SW 6258', hex: '#2F2F30' },
    ],
    look: {
      mansard: '#2F2F30', ribbed: '#2B2B2C', frame: '#F2F2EF', panel: '#015F97', backer: '#F4F4F1',
      pier: '#EEEFEA', pierBand: '#015F97', wall: '#DAD9D5', endWall: '#015F97', accent: '#015F97',
      soffit: '#EEEFEA', stone: '#E9E8E4', mullion: '#232425', door: '#015F97', backWall: '#D3D2CE',
      pylon: '#015F97', pylonAccent: '#F4F4F1',
    },
  },
  G: {
    name: 'Color Block',
    group: 'Bold',
    tag: 'Playful',
    blurb: 'Charcoal roof and white panels behind each tenant sign, with the blank panels between them in four bright colors. The most playful option, and it makes the center easy to describe: "the colorful one on Lancaster Pike."',
    chips: [
      { role: 'Roof, parapet & frames', name: 'Iron Ore', code: 'SW 7069', hex: '#434341' },
      { role: 'Tenant sign panels & posts', name: 'Extra White', code: 'SW 7006', hex: '#EEEFEA' },
      { role: 'Color blocks & doors', name: 'Positive Red', code: 'SW 6871', hex: '#AD2C34' },
      { role: 'Color blocks & SW end wall', name: 'Gusto Gold', code: 'SW 6904', hex: '#F8AC1D' },
      { role: 'Color blocks', name: 'Really Teal', code: 'SW 6489', hex: '#0B7480' },
      { role: 'Color blocks', name: 'Hyper Blue', code: 'SW 6965', hex: '#015F97' },
    ],
    look: {
      mansard: '#434341', ribbed: '#3E3E3C', frame: '#434341', panel: '#EEEFEA',
      panelB: '#AD2C34', panelC: '#F8AC1D', panelD: '#0B7480', panelE: '#015F97',
      pier: '#EEEFEA', pierBand: '#434341', wall: '#DCDAD5', endWall: '#F8AC1D', accent: '#AD2C34',
      soffit: '#EEEFEA', stone: '#E9E7E2', mullion: '#262627', door: '#AD2C34', backWall: '#D3D1CC',
      pylon: '#434341', pylonAccent: '#F8AC1D',
    },
  },
  A: {
    name: 'Iron Ore & Alabaster',
    group: 'Classic',
    tag: 'Neutral',
    blurb: 'Warm white sign band over charcoal metal. Neutral enough to let every tenant logo read from the road, and dark roofs hide weathering.',
    chips: [
      { role: 'Sign band & soffit', name: 'Alabaster', code: 'SW 7008', hex: '#EDEAE0' },
      { role: 'Piers & walls', name: 'Agreeable Gray', code: 'SW 7029', hex: '#D1CBC1' },
      { role: 'Mansard, parapet & trim', name: 'Iron Ore', code: 'SW 7069', hex: '#434341' },
      { role: 'Accent bands', name: 'Naval', code: 'SW 6244', hex: '#2F3D4C' },
    ],
    look: {
      mansard: '#4A4B4C', ribbed: '#454646', frame: '#434341', panel: '#EDEAE0',
      pier: '#D1CBC1', pierBand: '#2F3D4C', wall: '#D1CBC1', accent: '#2F3D4C',
      soffit: '#EDEAE0', stone: '#EEEAE2', mullion: '#3B3632', door: '#434341', backWall: '#CFC9BF',
    },
  },
  B: {
    name: 'Urbane Bronze Heritage',
    group: 'Classic',
    tag: 'Warm',
    blurb: 'Keeps the warm character of the original center with a deep bronze roof and a brick-red accent in place of the old red bands.',
    chips: [
      { role: 'Sign band & soffit', name: 'Pure White', code: 'SW 7005', hex: '#EDECE6' },
      { role: 'Piers & walls', name: 'Accessible Beige', code: 'SW 7036', hex: '#D1C7B8' },
      { role: 'Mansard, parapet & trim', name: 'Urbane Bronze', code: 'SW 7048', hex: '#54504A' },
      { role: 'Accent bands', name: 'Fireweed', code: 'SW 6328', hex: '#7B3730' },
    ],
    look: {
      mansard: '#5A554E', ribbed: '#57524C', frame: '#54504A', panel: '#EDECE6',
      pier: '#D1C7B8', pierBand: '#7B3730', wall: '#D1C7B8', accent: '#7B3730',
      soffit: '#EDECE6', stone: '#F0E8DA', mullion: '#3B3632', door: '#54504A', backWall: '#CFC5B6',
    },
  },
  C: {
    name: 'Tricorn & Cedar',
    group: 'Classic',
    tag: 'Modern',
    blurb: 'High-contrast black and white with a cedar-tone soffit under the canopy for warmth at the storefronts.',
    chips: [
      { role: 'Sign band', name: 'Pure White', code: 'SW 7005', hex: '#EDECE6' },
      { role: 'Piers & walls', name: 'Repose Gray', code: 'SW 7015', hex: '#CCC9C0' },
      { role: 'Mansard, parapet & trim', name: 'Tricorn Black', code: 'SW 6258', hex: '#2F2F30' },
      { role: 'Soffit & accents', name: 'Cedar-tone aluminum', code: 'wood-grain finish', hex: '#9A6A43' },
    ],
    look: {
      mansard: '#343536', ribbed: '#313132', frame: '#2F2F30', panel: '#EDECE6',
      pier: '#CCC9C0', pierBand: '#2F2F30', wall: '#CCC9C0', accent: '#9A6A43',
      soffit: '#FFFFFF', soffitTexture: 'wood', stone: '#E6E3DD', mullion: '#232323', door: '#2F2F30', backWall: '#C9C6BE',
    },
  },
};
export const DEFAULT_SCHEME = 'D';

// Existing condition, sampled from the site photos.
export const EXISTING_LOOK = {
  panel: '#E4D8C6', frame: '#A3624B', mansard: '#DCD4C4', ribbed: '#E0D8C8', pier: '#D8CBB6', pierBand: '#B8473D',
  wall: '#C9BFAC', accent: '#A3624B', soffit: '#CDBEA6', stone: '#ECE4D6', mullion: '#A7ABAE', door: '#EEEDE8', backWall: '#BDB29D',
};

// Fill in the optional slots so every material always gets a color.
export function resolveLook(look) {
  const L = { ...look };
  L.endWall ??= L.wall;
  L.backer ??= L.panel;
  for (const k of ['panelB', 'panelC', 'panelD', 'panelE']) L[k] ??= L.panel;
  L.pylon ??= L.frame;
  L.pylonAccent ??= L.accent;
  return L;
}

// Camera viewpoints (site-local). eye=true means a standing, walkable viewpoint.
export const VIEWS = {
  overview: { label: 'Overview', pos: [148, 62, -128], target: [58, 2, -8] },
  pike: { label: 'Lancaster Pike approach', pos: [-46, 1.7, -70.9], target: [60, 5, -40], eye: true },
  pylon: { label: 'Pylon sign', pos: [50, 1.7, -64.2], target: [62, 3.4, -67.4], eye: true },
  bens: { label: "Ben's Appliances", pos: [21.5, 1.7, -31], target: [26.3, 6.2, 3], eye: true },
  ace: { label: 'ACE Hardware', pos: [107, 1.7, -24], target: [106.5, 3.9, 3], eye: true },
  recess: { label: 'Shared entry recess', pos: [90.4, 1.65, 0.6], target: [90.1, 1.55, 7.0], eye: true },
  walkway: { label: 'Covered walk', pos: [117.6, 1.75, 1.6], target: [60, 1.75, 1.6], eye: true },
  lot: { label: 'Parking lot', pos: [60, 30, -84], target: [60, 0, -32] },
  station: { label: 'From the gas station', pos: [136.5, 1.7, -33], target: [104, 3.5, 2], eye: true },
  pumas: { label: 'Pumas Rest', pos: [61, 1.7, -9], target: [61, 3.3, 3], eye: true },
  dominos: { label: "Domino's", pos: [72.3, 1.7, -8], target: [72.3, 3.3, 3], eye: true },
  rent2own: { label: 'Rent-2-Own', pos: [83, 1.7, -9], target: [84, 3.3, 3], eye: true },
  anchorside: { label: 'Blank wall by Pumas Rest', pos: [46, 1.7, -9], target: [46, 3.3, 3], eye: true },
};
export const VIEW_MENU = ['overview', 'pike', 'pylon', 'lot', 'bens', 'pumas', 'recess', 'ace', 'walkway', 'station'];
export const TOUR = ['overview', 'pike', 'pylon', 'lot', 'bens', 'walkway', 'ace', 'station'];

export const SCOPE = [
  { title: 'Sealcoat the entire lot', detail: 'Crack sealing and patch repair, full sealcoat, then new white stall striping, ADA stalls and crosswalks.', view: 'lot' },
  { title: 'Renew the pylon sign', detail: 'Repaint posts and cabinets, new CIRCLEVILLE CENTER lettering, new tenant panels.', view: 'pylon' },
  { title: "Ben's Appliances replaces Big Lots", detail: 'New banner on the rooftop billboard, the anchor sign band and the top pylon panel.', view: 'bens' },
  { title: 'ACE Hardware on the pylon', detail: "Second panel, directly below Ben's Appliances.", view: 'pylon' },
  { title: 'Repaint and renovate the facade', detail: 'Sign band, mansard, parapet, piers and walls in the selected palette. Faux-stone knee walls cleaned and sealed.', view: 'overview' },
  { title: 'Replace damaged signage', detail: 'Worn FOR LEASE and Big Lots signs removed, Big Lots door graphics taken down, leaning ADA signs and rusted cart corrals replaced, tenant signs refreshed.', view: 'bens' },
  { title: 'ACE Hardware opens in 211 and 213', detail: "The FOR LEASE unit (211) and the end unit (213) become ACE Hardware, with one continuous sign band across four bays and a wall sign on the stone end block where an old sign was removed. 211's door stays in the shared recess beside Rent-2-Own's 209 door.", view: 'ace' },
];
