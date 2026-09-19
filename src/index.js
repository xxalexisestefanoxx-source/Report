import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { config, jidToNumber } from './config.js';
import { createCommandHandler } from './commands.js';
import { Store } from './store.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const store = new Store(config.dataFile);
let reconnectTimer;

async function startBot() {
  await store.init();
  const { state, saveCreds } = await useMultiFileAuthState('./.baileys_auth');
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: false,
    browser: ['ReportBot', 'Chrome', '1.0.0'],
    markOnlineOnConnect: false,
    generateHighQualityLinkPreview: false,
  });

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) qrcode.generate(qr, { small: true });
    if (connection === 'open') logger.info('Bot conectado a WhatsApp');
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      logger.warn({ code, shouldReconnect }, 'Conexión cerrada');
      if (shouldReconnect && !reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = undefined;
          startBot().catch((error) => logger.error(error, 'Fallo al reconectar'));
        }, 5000);
      }
    }
  });

  const handleCommand = createCommandHandler({ store, sock, logger });
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const message of messages) {
      try {
        if (!message.message || message.key.fromMe) continue;
        const sourceJid = message.key.remoteJid;
        if (!sourceJid || sourceJid === 'status@broadcast') continue;
        const senderJid = message.key.participant || sourceJid;
        const text = message.message.conversation
          || message.message.extendedTextMessage?.text
          || '';
        if (!text.startsWith(config.prefix)) continue;
        await handleCommand({
          message,
          text: text.slice(config.prefix.length),
          senderJid,
          sourceJid,
          pushName: message.pushName || jidToNumber(senderJid),
        });
      } catch (error) {
        logger.error({ err: error }, 'Error procesando mensaje');
      }
    }
  });
}

startBot().catch((error) => {
  logger.fatal({ err: error }, 'No fue posible iniciar el bot');
  process.exitCode = 1;
});
