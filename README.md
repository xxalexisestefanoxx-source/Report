# Bot de Reportes de WhatsApp

Bot modular para WhatsApp basado en **Node.js 20+** y **Baileys 7**. Su objetivo es registrar reportes individuales, preservar trazabilidad y reenviar cada caso a un canal de moderación para revisión humana.

## Funcionalidades

| Comando | Función |
|---|---|
| `.start` | Registra o actualiza al usuario y envía bienvenida. |
| `.cmds`, `.ayuda` | Muestra el menú de comandos. |
| `.soporte` | Entrega el canal y correo de soporte humano. |
| `.reportar <número>` | Valida el número, crea un folio, guarda el reporte y lo reenvía a `MODERATION_JID`. |
| `.bucle <número> <veces>` | Solo administradores; ejecuta una simulación interna limitada a cinco iteraciones, sin contactar ni reportar repetidamente al objetivo. |

## Diseño

- `src/index.js`: conexión Baileys, QR, eventos y reconexión.
- `src/commands.js`: parser y manejadores de comandos.
- `src/messages.js`: textos y formatos de salida.
- `src/store.js`: persistencia JSON atómica y cooldowns.
- `src/config.js`: configuración y normalización de números.
- `data/bot-data.json`: generado en ejecución y excluido de Git.
- `test/core.test.js` y `test/baileys-exports.mjs`: pruebas de persistencia, cooldowns y compatibilidad de exportaciones.

## Instalación en Termux

El siguiente bloque instala dependencias críticas del entorno, descarga el proyecto, crea la configuración local y ejecuta la validación:

```bash
pkg update -y && pkg upgrade -y && pkg install -y git nodejs-lts ffmpeg libwebp && git clone https://github.com/xxalexisestefanoxx-source/Report.git && cd Report && cp .env.example .env && npm install && npm run check && mkdir -p data && npm start
```

Antes de iniciar en producción, edita `.env` y define `MODERATION_JID`, `ADMIN_NUMBERS`, `SUPPORT_URL` y `SUPPORT_EMAIL`. El primer arranque mostrará un QR; vincula el dispositivo desde WhatsApp > Dispositivos vinculados.

Para validar el proyecto sin iniciar WhatsApp, ejecuta `npm run check && npm test`. Los mensajes `got history notification`, `no name present, ignoring presence update request` y algunos `Timed Out` durante la sincronización inicial son eventos o advertencias de Baileys; si después aparece `Bot conectado a WhatsApp`, la conexión se estableció. El programa usa timeouts ampliados, reconexión controlada y apagado limpio con `SIGINT`/`SIGTERM`.

### Inicio limpio en Termux

Si la sesión local quedó desincronizada, no es necesario borrar todo el proyecto. Detén las instancias, respalda `.baileys_auth`, actualiza el código y vuelve a vincular un único dispositivo con el QR:

```bash
cd ~/nuevo-bot/Report/Report && pkill -TERM -f 'node src/index.js' 2>/dev/null || true && sleep 4 && termux-wake-lock 2>/dev/null || true && if [ -d .baileys_auth ]; then mv .baileys_auth ".baileys_auth.backup.$(date +%Y%m%d-%H%M%S)"; fi && git pull --ff-only origin main && npm install --no-audit --no-fund && npm run check && npm test && npm start
```

El QR se genera escuchando `connection.update`; no se usa `printQRInTerminal`, que está obsoleto en versiones recientes. El proyecto fija `@whiskeysockets/baileys` en `7.0.0-rc14`, actualmente publicado como la etiqueta `latest`; la rama `6.7.24` aparece como `legacy`. El código acepta `participantAlt` y `remoteJidAlt` para que grupos y chats con LID no pierdan la identificación del remitente. Si el inicio limpio vuelve a fallar con `515` y `408`, prueba otra red y verifica que `curl -4 -I --max-time 20 https://web.whatsapp.com` funcione. No ejecutes dos instancias del proceso.

## Configuración de seguridad

El bot aplica validación internacional de números, cooldown por emisor, almacenamiento de folios, límite de cinco iteraciones para la simulación administrativa y separación del canal de moderación. No debe utilizarse para enviar spam, acosar, coordinar reportes falsos ni contactar repetidamente a terceros. Las decisiones sobre un reporte pertenecen al equipo de moderación y deben basarse en evidencia y políticas aplicables.

Para un despliegue 24/7, usa un proceso supervisado en un servidor administrado o un servicio Node.js con reinicio automático. No compartas `.env`, la carpeta `.baileys_auth` ni `data/bot-data.json`. El socket incorpora cachés de reintento, claves Signal y metadatos de grupos, además de un almacén limitado de mensajes para que WhatsApp pueda repetir entregas fallidas.
