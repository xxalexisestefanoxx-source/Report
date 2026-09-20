import 'dotenv/config';

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const csv = (value) => (value ?? '')
  .split(',')
  .map((item) => item.trim().replace(/[^0-9]/g, ''))
  .filter(Boolean);

const asJid = (value) => {
  const jid = (value ?? '').trim();
  return /^(?:\d{6,20}-\d{6,20}|\d{6,20})@(g\.us|s\.whatsapp\.net)$/.test(jid) ? jid : '';
};

export const config = Object.freeze({
  botName: process.env.BOT_NAME || 'Bot de Reportes',
  prefix: process.env.BOT_PREFIX || '.',
  moderationJid: asJid(process.env.MODERATION_JID),
  adminNumbers: csv(process.env.ADMIN_NUMBERS),
  supportUrl: process.env.SUPPORT_URL || 'https://example.com/soporte',
  supportEmail: process.env.SUPPORT_EMAIL || 'soporte@example.com',
  reportCooldownMs: toPositiveInt(process.env.REPORT_COOLDOWN_SECONDS, 60) * 1000,
  maxLoopIterations: Math.min(toPositiveInt(process.env.MAX_LOOP_ITERATIONS, 5), 5),
  loopCooldownMs: toPositiveInt(process.env.LOOP_COOLDOWN_SECONDS, 300) * 1000,
  dataFile: process.env.DATA_FILE?.trim() || './data/bot-data.json',
});

export function normalizeNumber(value = '') {
  return String(value).replace(/[^0-9]/g, '');
}

export function jidToNumber(jid = '') {
  return normalizeNumber(jid.split('@')[0].split(':')[0]);
}
