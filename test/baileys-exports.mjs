import * as baileys from '@whiskeysockets/baileys';

const required = ['Browsers', 'makeCacheableSignalKeyStore', 'isJidBroadcast', 'isJidNewsletter'];
for (const name of required) {
  if (!baileys[name]) throw new Error(`Falta exportación de Baileys: ${name}`);
}
console.log('Exportaciones de Baileys verificadas:', required.join(', '));
