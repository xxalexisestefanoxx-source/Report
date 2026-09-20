# BRANDON VENTAS

Bot profesional de ventas y entrega automática de Keys digitales por WhatsApp usando Baileys y Node.js. Está preparado para ejecutarse directamente en **Termux para Android**.

## Qué incluye

El proyecto incluye bienvenida, menú, catálogo por Android/iOS/PC, precios por producto y duración, pedidos, carga de stock desde WhatsApp, entrega única después de aprobación de pago, panel administrativo, logs, rate limiting, persistencia atómica, reconexión automática y una integración HWID preparada sin inventar una API inexistente.

La base de datos local es un archivo JSON transaccional protegido con permisos `0600`. Para cargas muy grandes o varios procesos simultáneos conviene migrar la capa `src/store.js` a SQLite/PostgreSQL; el bot está aislado detrás de esa clase para facilitar la migración.

## Requisitos

- Termux actualizado.
- Node.js 20 o superior.
- Un número de WhatsApp dedicado para el bot.
- Un número de administrador en formato internacional, sin `+`.

## Instalación en Termux

```bash
pkg update -y && pkg upgrade -y
pkg install -y nodejs-lts git
termux-setup-storage
git clone https://github.com/xxalexisestefanoxx-source/Report.git brandon-ventas
cd brandon-ventas
npm install
cp .env.example .env
nano .env
npm test
npm start
```

Al iniciar por primera vez aparecerá un QR en Termux. En WhatsApp del teléfono administrador abre **Dispositivos vinculados → Vincular dispositivo** y escanea el QR. La sesión queda en `.baileys_auth/`; no la compartas ni la subas a Git.

## Configuración obligatoria

Edita `.env` y configura al menos `ADMIN_NUMBERS`, `SUPPORT_NUMBER`, `OWNER_NUMBER` y los precios mediante el panel admin. `PAYMENT_MODE=manual` es deliberado: sin proveedor de pagos no se entrega ninguna Key automáticamente. `HWID_MODE=disabled` también es deliberado hasta recibir del proveedor la URL, credenciales, endpoint de estado y endpoint de reset reales.

Nunca escribas tokens, API Keys, credenciales ni Keys de stock directamente en el código. El `.gitignore` excluye `.env`, datos, logs y la sesión de WhatsApp.

## Flujo de cliente

- `.start`, `.menu` o un mensaje inicial: bienvenida.
- `.catalogo`: productos, precios configurados y stock disponible.
- `.comprar`: muestra el formato de compra.
- `.comprar Android | BR Mods — Root | 1 Día`: crea pedido pendiente.
- `.confirmar BV-...`: muestra las instrucciones de pago y el ID del pedido.
- `.pedido`: pedidos propios, estado, Key si fue entregada y fechas.
- `.keys`: Keys propias entregadas.
- `.reset KEY`: solicita reset de HWID, máximo dos por día.
- `.soporte`: contacto de soporte.

Los nombres deben copiarse exactamente desde `.catalogo`. Las duraciones válidas son `1 Día`, `3 Días`, `7 Días`, `15 Días`, `30 Días` y `Permanente`.

## Panel administrativo

El número debe estar en `ADMIN_NUMBERS` o coincidir con `OWNER_NUMBER`.

```text
.admin
.admin precio Android | BR Mods — Root | 1 Día | 4.70
.admin stock Android | BR Mods — Root | 1 Día
KEY-001
KEY-002
KEY-003
.admin precios
.admin ventas
.admin pedidos
.admin aprobar BV-... TRANSACCION-REAL
.admin usuarios
.admin logs
.admin hwid
.admin reset KEY-001
```

La carga de stock detecta Keys vacías y duplicadas, asocia plataforma/producto/duración, registra el administrador y actualiza el stock. Las Keys nunca se muestran en el catálogo público. `.admin aprobar` es idempotente: una confirmación repetida no genera una segunda entrega y el stock se consume dentro de una transacción.

## Pagos y HWID

El proyecto no inventa APIs. El modo actual registra pedidos y permite aprobación administrativa con `.admin aprobar PEDIDO TRANSACCION`. Para automatizar un proveedor real hay que implementar su webhook o SDK en `src/services/payments.js`, validando firma, pedido, importe, moneda, estado e idempotencia.

Para HWID configure el proveedor real en `.env` y revise `src/services/hwid.js`. La integración envía Bearer token al endpoint de reset y rechaza silenciosamente cualquier intento de usarla mientras falten los datos. Faltan, si el proveedor no los entrega: documentación del API, URL base, método HTTP, formato de autenticación, endpoint de estado, endpoint de reset, identificador de producto y esquema de respuesta.

## Inicio y detención

```bash
npm start
# detener con Ctrl+C
```

Para dejarlo ejecutándose mientras Termux está activo, puede usarse `tmux`:

```bash
pkg install -y tmux
tmux new -s brandon
npm start
# separar: Ctrl+B y luego D
# volver: tmux attach -t brandon
```

En Android, desactiva la optimización de batería para Termux y considera `termux-wake-lock` si necesitas mantener la conexión activa. La disponibilidad 24/7 depende de que el teléfono y la red permanezcan activos.

## Verificación

```bash
npm run check
npm test
```

Las pruebas verifican persistencia atómica, serialización, rate limiting, rechazo de duplicados, no doble entrega y consumo exclusivo de stock. Antes de producción, prueba también el QR, compra de prueba, aprobación con transacción real de sandbox, reinicio de Termux y recuperación de conexión.
