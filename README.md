# Agente WhatsApp Local

Bot de WhatsApp con IA y dashboard local. Conecta tu número vía QR, responde mensajes automáticamente con un LLM (OpenRouter) y gestiona conversaciones desde el navegador.

## Requisitos

- Node.js 22 LTS
- Cuenta en [OpenRouter](https://openrouter.ai) con API key

## Instalación

```bash
npm install
cp .env.example .env.local
# Editar .env.local con tu API key y modelo
```

## Configuración

Editá `.env.local`:

```
OPENROUTER_API_KEY=sk-or-tu-clave-aqui
OPENROUTER_MODEL=openai/gpt-4o-mini
BASIC_AUTH_USER=admin
BASIC_AUTH_PASSWORD=una-clave-larga-y-segura
```

> **Modelos recomendados:** `openai/gpt-4o-mini` ($0.15 por millón de tokens).
> Los modelos `:free` tienen límite de 50 requests/día sin créditos — van a fallar en uso real.

## Uso en desarrollo

En dos terminales separadas:

```bash
# Terminal 1 — bot de WhatsApp
npm run start:bot

# Terminal 2 — dashboard
npm run dev
```

O en una sola terminal:

```bash
npm run dev          # solo dashboard (útil si el bot ya corre)
```

Abrí [http://localhost:3000](http://localhost:3000). La primera vez verás la pantalla de QR — escaneala con WhatsApp → Dispositivos vinculados → Vincular dispositivo.

## Personalizar el system prompt

Editá `src/lib/system-prompt.ts`:

```typescript
export const SYSTEM_PROMPT = `
Sos el asistente virtual de [TU NEGOCIO].
Respondé solo preguntas sobre [TEMA].
...
`.trim();
```

## Estructura de la app

```
src/
├── app/                    # Next.js App Router
│   ├── api/                # API routes (REST)
│   │   ├── connection/     # status, disconnect
│   │   ├── conversations/  # lista, DELETE
│   │   ├── messages/       # GET mensajes, POST humano
│   │   └── mode/           # toggle AI/HUMAN
│   └── page.tsx            # raíz → ConnectionGate
├── components/             # componentes React
└── lib/
    ├── db.ts               # SQLite (better-sqlite3)
    ├── openrouter.ts       # cliente LLM
    ├── system-prompt.ts    # personalizar aquí
    └── baileys/            # cliente WhatsApp
scripts/
├── env-loader.ts           # carga .env.local en el proceso bot
└── start-bot.ts            # entry point del bot
data/                       # base de datos (gitignored)
auth/                       # sesión Baileys (gitignored)
```

## Deploy en EasyPanel / Railway

1. Pusheá el código a un repositorio GitHub
2. Conectá el repo en EasyPanel
3. Agregá las variables de entorno (`OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `BASIC_AUTH_USER`, `BASIC_AUTH_PASSWORD`)
4. Configurá volúmenes persistentes en `/app/data` y `/app/auth` — **son obligatorios**:
   - Sin `/app/data`: perdés todas las conversaciones en cada redespliegue
   - Sin `/app/auth`: tenés que re-escanear el QR en cada redespliegue

> El archivo `nixpacks.toml` configura Node 22 y las dependencias nativas automáticamente.

## ⚠️ Seguridad

El dashboard y sus APIs usan Basic Auth cuando configurás `BASIC_AUTH_USER` y `BASIC_AUTH_PASSWORD`.
En desarrollo, si esas variables faltan, la app sigue abriendo para no bloquear pruebas locales.
En producción, si faltan, la app responde `503` para evitar publicar conversaciones de WhatsApp sin protección.

## Solución de problemas

### El bot no conecta (código 440 en loop)
- Verificá que en WhatsApp (Configuración → Dispositivos vinculados) no haya dispositivos viejos de pruebas anteriores — borralos
- Si persiste, esperá 24h o probá desde otra IP

### Error 429 del LLM
- El modelo `:free` de OpenRouter saturó la cuota diaria
- Cambiá `OPENROUTER_MODEL=openai/gpt-4o-mini` en `.env.local`

### El QR no aparece en el dashboard
- Verificá que el proceso `npm run start:bot` esté corriendo
- Revisá la consola del bot en busca de errores

### Procesos zombies en Windows (Ctrl+C no mata el bot)
```cmd
tasklist | findstr node
taskkill /PID <PID> /F
```

## Mejoras pendientes (v2)

- Soporte de imágenes salientes (enviar PNG de productos)
- Function calling real con `tools` de OpenRouter
- Auto-toggle a HUMAN cuando el bot dice frase específica
- WebSocket en lugar de polling
- Soporte de grupos
