# Bot de Reportes de WhatsApp

Bot modular para WhatsApp basado en **Node.js 20+** y **Baileys**. Su objetivo es registrar reportes individuales, preservar trazabilidad y reenviar cada caso a un canal de moderación para revisión humana.

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

## Instalación en Termux

El siguiente bloque instala dependencias críticas del entorno, descarga el proyecto, crea la configuración local y ejecuta la validación:

```bash
pkg update -y && pkg upgrade -y && pkg install -y git nodejs-lts ffmpeg libwebp && git clone https://github.com/xxalexisestefanoxx-source/Report.git && cd Report && cp .env.example .env && npm install && npm run check && mkdir -p data && npm start
```

Antes de iniciar en producción, edita `.env` y define `MODERATION_JID`, `ADMIN_NUMBERS`, `SUPPORT_URL` y `SUPPORT_EMAIL`. El primer arranque mostrará un QR; vincula el dispositivo desde WhatsApp > Dispositivos vinculados.

## Configuración de seguridad

El bot aplica validación internacional de números, cooldown por emisor, almacenamiento de folios, límite de cinco iteraciones para la simulación administrativa y separación del canal de moderación. No debe utilizarse para enviar spam, acosar, coordinar reportes falsos ni contactar repetidamente a terceros. Las decisiones sobre un reporte pertenecen al equipo de moderación y deben basarse en evidencia y políticas aplicables.

Para un despliegue 24/7, usa un proceso supervisado en un servidor administrado o un servicio Node.js con reinicio automático. No compartas `.env`, la carpeta `.baileys_auth` ni `data/bot-data.json`.
