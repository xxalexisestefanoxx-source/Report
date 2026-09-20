export const DURATIONS = ['1 Día', '3 Días', '7 Días', '15 Días', '30 Días', 'Permanente'];

export const CATALOG = Object.freeze({
  Android: ['BR Mods — Root', 'Cuban Proxy — Android', 'Drip Client — No Root', 'Drip Client — Root', 'Drip Proxy — Android', 'Drip Wire — Android', 'HG Cheats — Android', 'HG Proxy — Android', 'Holo VIP — Android', 'Pato Team — Android'],
  iOS: ['Certificado Xbox — iOS', 'Cuban External — iOS', 'Cuban Proxy — iOS', 'Drip Wire — iOS', 'Flourite — iOS', 'Monite Cheats — iOS'],
  PC: ['BR Mods — PC', 'Cuban Deluxe — PC', 'Cuban Rage — PC'],
});

export function allProducts() {
  return Object.entries(CATALOG).flatMap(([platform, products]) => products.map((product) => ({ platform, product })));
}

export function isValidSelection(platform, product, duration) {
  return Boolean(CATALOG[platform]?.includes(product) && DURATIONS.includes(duration));
}

export function selectionKey(platform, product, duration) {
  return `${platform}::${product}::${duration}`;
}
