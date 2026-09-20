import 'dotenv/config';
const csv = (value) => String(value || '').split(',').map((x) => x.trim().replace(/[^0-9]/g, '')).filter(Boolean);
const positive = (value, fallback) => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback;
export const config = Object.freeze({
  botName: process.env.BOT_NAME || 'BRANDON VENTAS', prefix: process.env.BOT_PREFIX || '.',
  adminNumbers: csv(process.env.ADMIN_NUMBERS), ownerNumber: (process.env.OWNER_NUMBER || '').replace(/[^0-9]/g, ''), supportNumber: (process.env.SUPPORT_NUMBER || '').replace(/[^0-9]/g, ''),
  dataFile: process.env.DATA_FILE || './data/brandon-ventas.json', logLevel: process.env.LOG_LEVEL || 'info', rateLimitMs: positive(process.env.RATE_LIMIT_SECONDS, 2) * 1000, adminCooldownMs: positive(process.env.ADMIN_ACTION_COOLDOWN_SECONDS, 1) * 1000,
  paymentMode: process.env.PAYMENT_MODE || 'manual', paymentInstructions: process.env.PAYMENT_INSTRUCTIONS || '', paymentWebhookSecret: process.env.PAYMENT_WEBHOOK_SECRET || '', paymentApiUrl: process.env.PAYMENT_API_URL || '', paymentApiKey: process.env.PAYMENT_API_KEY || '',
  hwidMode: process.env.HWID_MODE || 'disabled', apiUrl: process.env.API_URL || '', apiKey: process.env.API_KEY || '', statusEndpoint: process.env.STATUS_ENDPOINT || '', resetEndpoint: process.env.RESET_ENDPOINT || '', productId: process.env.PRODUCT_ID || '',
});
export const normalizeNumber = (value = '') => String(value).replace(/[^0-9]/g, '');
export const jidToNumber = (jid = '') => normalizeNumber(String(jid).split('@')[0].split(':')[0]);
export const asJid = (number) => `${normalizeNumber(number)}@s.whatsapp.net`;
