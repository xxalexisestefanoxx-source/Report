import makeWASocket, {
  Browsers,
  DisconnectReason,
  isJidBroadcast,
  isJidNewsletter,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import NodeCache from '@cacheable/node-cache';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { config, jidToNumber } from './config.js';
import { createCommandHandler } from './commands.js';
import { Store } from './store.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const store = new Store(config.dataFile);
const msgRetryCounterCache = new NodeCache({ stdTTL: 600, useClones: false });
const groupCache = new NodeCache({ stdTTL: 300, useClones: false });
const messageStore = new Map();
const MAX_STORED_MESSAGES = 1000;
let storeInitialized = false;
let reconnectTimer;
let stopping = false;
let activeSocket;

function rememberMessage(message) {
  const key = message?.key;
  if (!key?.remoteJid || !key?.id || !message.message) return;
  messageStore.set(`${key.remoteJid}:${key.id}`, message.message);
  while (messageStore.size > MAX_STORED_MESSAGES) {
    messageStore.delete(messageStore.keys().next().value);
  }
}

function unwrapMessageContent(content) {
  return content?.ephemeralMessage?.message
    || content?.viewOnceMessage?.message
    || content?.viewOnceMessageV2?.message
    || content?.documentWithCaptionMessage?.message
    || content;
}

function extractText(message) {
  const content = unwrapMessageContent(message?.message);
  return content?.conversation
    || content?.extendedTextMessage?.text
    || content?.imageMessage?.caption
    || content?.videoMessage?.caption
    || '';
}

function scheduleReconnect(reason) {
  if (stopping || reconnectTimer) return;
  logger.warn({ reason }, 'Programando reconexión');
  reconnectTimer = setTimeout(() => {
    reconnectTimer = undefined;
    startBot().catch((error) => {
      logger.error({ err: error }, 'Fallo al reconectar');
      scheduleReconnect('fallo durante la reconexión');
    });
  }, 5000);
}

async function startBot() {
  if (stopping) return;
  if (!storeInitialized) {
    await store.init();
    storeInitialized = true;
  }
  const { state, saveCreds } = await useMultiFileAuthState('./.baileys_auth');
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    logger,
    browser: Browsers.macOS('Chrome'),
    markOnlineOnConnect: false,
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
    connectTimeoutMs: 60_000,
    defaultQueryTimeoutMs: 60_000,
    keepAliveIntervalMs: 30_000,
    retryRequestDelayMs: 5_000,
    msgRetryCounterCache,
    maxMsgRetryCount: 5,
    shouldIgnoreJid: (jid) => isJidBroadcast(jid) || isJidNewsletter(jid),
    getMessage: async (key) => messageStore.get(`${key.remoteJid}:${key.id}`),
    cachedGroupMetadata: async (jid) => groupCache.get(jid),
  });
  activeSocket = sock;

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) qrcode.generate(qr, { small: true });
    if (connection === 'open') logger.info('Bot conectado a WhatsApp');
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = !stopping && code !== DisconnectReason.loggedOut;
      logger.warn({ code, shouldReconnect }, 'Conexión cerrada');
      if (shouldReconnect) scheduleReconnect(`cierre de conexión ${code || 'desconocido'}`);
    }
  });

  sock.ev.on('groups.update', async (events) => {
    for (const event of events) {
      try {
        if (event.id) groupCache.set(event.id, await sock.groupMetadata(event.id));
      } catch (error) {
        logger.debug({ err: error, group: event.id }, 'No se pudo actualizar caché de grupo');
      }
    }
  });

  sock.ev.on('group-participants.update', async ({ id }) => {
    try {
      if (id) groupCache.set(id, await sock.groupMetadata(id));
    } catch (error) {
      logger.debug({ err: error, group: id }, 'No se pudo actualizar caché de participantes');
    }
  });

  const handleCommand = createCommandHandler({ store, sock, logger });
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    for (const message of messages) rememberMessage(message);
    if (type !== 'notify') return;
    for (const message of messages) {
      try {
        if (!message.message) continue;
        if (message.key.fromMe) {
          logger.debug({ messageId: message.key.id }, 'Mensaje propio ignorado');
          continue;
        }
        const sourceJid = message.key.remoteJid;
        if (!sourceJid || sourceJid === 'status@broadcast' || sourceJid.endsWith('@broadcast')) continue;
        const senderJid = message.key.participantAlt
          || message.key.participant
          || message.key.remoteJidAlt
          || sourceJid;
        const text = extractText(message);
        if (!text.startsWith(config.prefix)) continue;
        logger.info({ command: text.split(/\s+/)[0], sourceJid }, 'Comando recibido');
        await handleCommand({
          message,
          text: text.slice(config.prefix.length),
          senderJid,
          sourceJid,
          pushName: message.pushName || jidToNumber(senderJid),
        });
      } catch (error) {
        logger.error({ err: error, messageId: message.key?.id }, 'Error procesando mensaje');
      }
    }
  });
}

async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  logger.info({ signal }, 'Apagando bot');
  activeSocket?.end?.(new Error(`Shutdown: ${signal}`));
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

startBot().catch((error) => {
  logger.error({ err: error }, 'No fue posible iniciar el bot');
  scheduleReconnect('fallo durante el arranque');
});
