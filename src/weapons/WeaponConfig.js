const shared = {
  range: 120,
  reloadTime: 2.35,
  reserve: 90,
  spread: 0.004,
  movementSpread: 0.018,
  airborneSpread: 0.055,
  crouchMultiplier: 0.72,
  aimMultiplier: 0.66,
  recoilRecovery: 8.5,
  recoilCameraScale: 0.72,
  recoilWeaponScale: 1,
  viewPosition: [0.34, -0.31, -0.58],
  aimPosition: [0.02, -0.22, -0.48],
  viewRotation: [0, 0, 0],
  family: 'rifle'
};

export const WEAPON_CONFIG = Object.freeze({
  ak47: { ...shared, id: 'ak47', name: 'AK-47', type: 'ASSAULT RIFLE / 7.62', fireMode: 'auto', fireRate: 600, damage: 36, magazine: 30, reserve: 90, spread: 0.0045, movementSpread: 0.022, reloadTime: 2.45, recoilPattern: [[0.028, 0.005], [0.034, -0.006], [0.04, 0.009], [0.045, -0.012], [0.05, 0.014]], family: 'ak', bodyLength: 0.72, barrelLength: 0.78, magazineStyle: 'curved', stock: 'wood', suppressor: false },
  m4a4: { ...shared, id: 'm4a4', name: 'M4A4', type: 'ASSAULT RIFLE / 5.56', fireMode: 'auto', fireRate: 666, damage: 33, magazine: 30, reserve: 90, recoilPattern: [[0.025, -0.004], [0.031, 0.006], [0.035, -0.008], [0.041, 0.01]], family: 'rifle', bodyLength: 0.72, barrelLength: 0.78, magazineStyle: 'straight', stock: 'polymer' },
  m4a1s: { ...shared, id: 'm4a1s', name: 'M4A1-S', type: 'SUPPRESSED RIFLE / 5.56', fireMode: 'auto', fireRate: 600, damage: 35, magazine: 20, reserve: 80, recoilPattern: [[0.023, 0.003], [0.028, -0.004], [0.032, 0.006]], family: 'rifle', bodyLength: 0.7, barrelLength: 0.98, magazineStyle: 'straight', stock: 'polymer', suppressor: true },
  awp: { ...shared, id: 'awp', name: 'AWP', type: 'BOLT-ACTION SNIPER / .338', fireMode: 'semi', fireRate: 42, damage: 115, magazine: 5, reserve: 30, spread: 0.0008, movementSpread: 0.045, airborneSpread: 0.09, reloadTime: 3.4, aimMultiplier: 0.08, recoilPattern: [[0.12, 0.012]], family: 'sniper', bodyLength: 0.9, barrelLength: 1.05, magazineStyle: 'box', stock: 'polymer', scope: true, aimFov: 28 },
  ssg08: { ...shared, id: 'ssg08', name: 'SSG 08', type: 'SCOUT RIFLE / 7.62', fireMode: 'semi', fireRate: 75, damage: 88, magazine: 10, reserve: 60, spread: 0.0012, movementSpread: 0.038, reloadTime: 2.8, aimMultiplier: 0.12, recoilPattern: [[0.085, -0.008]], family: 'sniper', bodyLength: 0.82, barrelLength: 0.92, magazineStyle: 'straight', stock: 'polymer', scope: true, aimFov: 35 },
  glock18: { ...shared, id: 'glock18', name: 'GLOCK-18', type: 'PISTOL / 9MM', fireMode: 'auto', fireRate: 400, damage: 28, magazine: 20, reserve: 120, spread: 0.007, movementSpread: 0.025, reloadTime: 2.1, viewPosition: [0.32, -0.34, -0.48], aimPosition: [0.02, -0.26, -0.42], family: 'pistol', bodyLength: 0.34, barrelLength: 0.31, magazineStyle: 'pistol', stock: 'polymer' },
  usps: { ...shared, id: 'usps', name: 'USP-S', type: 'SUPPRESSED PISTOL / .45', fireMode: 'semi', fireRate: 240, damage: 34, magazine: 12, reserve: 72, spread: 0.004, movementSpread: 0.02, reloadTime: 2.15, viewPosition: [0.32, -0.34, -0.48], aimPosition: [0.02, -0.26, -0.42], family: 'pistol', bodyLength: 0.36, barrelLength: 0.49, magazineStyle: 'pistol', stock: 'polymer', suppressor: true },
  deagle: { ...shared, id: 'deagle', name: 'DESERT EAGLE', type: 'HEAVY PISTOL / .50 AE', fireMode: 'semi', fireRate: 180, damage: 62, magazine: 7, reserve: 35, spread: 0.0055, movementSpread: 0.032, reloadTime: 2.4, recoilPattern: [[0.115, 0.01]], viewPosition: [0.32, -0.34, -0.48], aimPosition: [0.02, -0.26, -0.42], family: 'heavyPistol', bodyLength: 0.39, barrelLength: 0.4, magazineStyle: 'pistol', stock: 'metal' },
  mp5sd: { ...shared, id: 'mp5sd', name: 'MP5-SD', type: 'SUPPRESSED SMG / 9MM', fireMode: 'auto', fireRate: 800, damage: 27, magazine: 30, reserve: 120, recoilPattern: [[0.018, 0.003], [0.022, -0.004], [0.025, 0.005]], family: 'smg', bodyLength: 0.58, barrelLength: 0.78, magazineStyle: 'straight', stock: 'polymer', suppressor: true },
  mac10: { ...shared, id: 'mac10', name: 'MAC-10', type: 'SMG / .45 ACP', fireMode: 'auto', fireRate: 1000, damage: 25, magazine: 30, reserve: 120, spread: 0.007, movementSpread: 0.03, recoilPattern: [[0.026, -0.009], [0.033, 0.013], [0.038, -0.014]], family: 'smg', bodyLength: 0.46, barrelLength: 0.38, magazineStyle: 'box', stock: 'metal' },
  nova: { ...shared, id: 'nova', name: 'NOVA', type: 'PUMP SHOTGUN / 12 GA', fireMode: 'semi', fireRate: 75, damage: 19, magazine: 8, reserve: 32, pellets: 9, spread: 0.045, movementSpread: 0.025, reloadTime: 0.58, reloadStyle: 'shell', recoilPattern: [[0.105, 0.012]], family: 'shotgun', bodyLength: 0.75, barrelLength: 0.68, magazineStyle: 'tube', stock: 'wood' },
  xm1014: { ...shared, id: 'xm1014', name: 'XM1014', type: 'AUTO SHOTGUN / 12 GA', fireMode: 'auto', fireRate: 150, damage: 16, magazine: 7, reserve: 32, pellets: 8, spread: 0.05, movementSpread: 0.03, reloadTime: 0.62, reloadStyle: 'shell', recoilPattern: [[0.09, -0.012], [0.1, 0.01]], family: 'shotgun', bodyLength: 0.8, barrelLength: 0.7, magazineStyle: 'tube', stock: 'polymer' },
  knife: { ...shared, id: 'knife', name: 'COMBAT KNIFE', type: 'MELEE / FIELD TOOL', fireMode: 'melee', fireRate: 75, damage: 55, magazine: 0, reserve: 0, range: 2.2, spread: 0, movementSpread: 0, reloadTime: 0, viewPosition: [0.3, -0.32, -0.5], aimPosition: [0.3, -0.32, -0.5], family: 'knife', bodyLength: 0.42, barrelLength: 0, magazineStyle: 'none', stock: 'metal' }
});

export const WEAPON_SLOTS = Object.freeze(['ak47', 'glock18', 'knife']);
