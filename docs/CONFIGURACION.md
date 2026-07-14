# Cómo configurar MatuByte para blogs y contenido

## 1. Knowledge base (obligatorio)
Edita y mantén actualizado:

- `docs/MATUBYTE.md` → identidad, ICP, productos, tono, CTA

Los agentes (chat, blog, radar, social) leen este archivo en cada corrida.

## 2. Knowledge en base de datos (recomendado)
Tabla `site_knowledge` (editable vía API):

```http
POST /api/knowledge
{
  "key": "company_overview",
  "title": "Qué hace MatuByte",
  "content": "Texto largo...",
  "source_url": "https://matubyte.com"
}
```

```http
GET /api/knowledge
```

Usa keys sugeridas:
- `company_overview`
- `products`
- `services`
- `tone_of_voice`
- `cta_whatsapp`
- `seo_cities` (Cali, Bogotá, LatAm…)

## 3. LLM (blogs / chat / social) — MiniMax
En `.env` ([docs OpenAI SDK](https://platform.minimax.io/docs/api-reference/text-openai-api)):

```env
LLM_PROVIDER=api
LLM_BASE_URL=https://api.minimax.io/v1
LLM_API_KEY=sk-cp-tu-key
LLM_MODEL=MiniMax-M3
WHATSAPP_CTA_URL=https://wa.me/57XXXXXXXXXX
```

Modelos útiles: `MiniMax-M3` (flagship), `MiniMax-M2.5-highspeed` (más rápido).
Smoke test: `npx tsx scripts/smoke-llm.ts`

## 4. Tokens de aplicaciones (creador de contenido)
Conecta cada producto Matu* para que el robot social sepa qué promocionar:

```http
POST /api/apps
{
  "name": "MatuCRM",
  "slug": "matucrm",
  "platform": "web_app",
  "app_url": "https://crm.matubyte.com",
  "access_token": "token-opcional",
  "description": "CRM para PYMES…",
  "features": ["pipeline", "cotizaciones", "leads web"],
  "brand_voice": "cercano, técnico, Cali"
}
```

Luego dispara:

```http
POST /agents/social-creator/run
{ "appSlug": "matucrm", "platform": "instagram" }
```

## 5. Fuentes de oportunidades (empleos / gov / foros)
El agente `opportunity-scout` busca señales de demanda (empleo TI, contrataciones, foros).
Resultados en tabla `opportunities` y visibles en el cockpit.

## 6. Chat por agente
UI: entra a un robot → panel detalle + chat.
API:

```http
POST /api/agents/:id/chat
{ "sessionId": "ui-1", "message": "¿Qué nichos estás cazando?" }
```

Historial en `agent_chat_messages`.

## 7. WhatsApp Business (Meta Cloud API)

Cockpit: **http://localhost:4100/whatsapp.html**

### 7.1 Crear la app en Meta

1. Ve a [developers.facebook.com/apps](https://developers.facebook.com/apps) → **Crear app** → tipo **"Empresa"**.
2. Añade el producto **WhatsApp** a la app.
3. En **WhatsApp → Configuración de la API**, copia:
   - `Phone number ID` → `WHATSAPP_PHONE_NUMBER_ID`
   - `WhatsApp Business Account ID` → `WHATSAPP_BUSINESS_ACCOUNT_ID`
   - Genera un **token permanente** (System User, en Business Manager → Usuarios del sistema) → `WHATSAPP_ACCESS_TOKEN`. El token temporal de prueba expira en 24h.
4. En **Configuración de la app → Básica**, copia el **App Secret** → `META_APP_SECRET`.

### 7.2 Configurar el Webhook

En **WhatsApp → Configuración → Webhooks**:

- **URL de retorno de llamada:** `https://TU-DOMINIO-O-NGROK/webhooks/whatsapp`
- **Verify token:** el mismo valor que pongas en `WHATSAPP_VERIFY_TOKEN`
- Suscríbete al campo **`messages`**

Para probar en tu PC antes de tener dominio público:

```bash
npx ngrok http 4100
```

Usa la URL `https://xxxx.ngrok-free.app/webhooks/whatsapp` como callback.

### 7.3 `.env`

```env
WHATSAPP_ENABLED=true
WHATSAPP_ACCESS_TOKEN=EAAxxxxx...   # System User PERMANENTE (no token de prueba 24h)
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_BUSINESS_ACCOUNT_ID=123456789012345
WHATSAPP_VERIFY_TOKEN=elige-un-string-secreto
META_APP_SECRET=xxxxxxxxxxxxxxxx
WHATSAPP_HANDOFF_KEYWORDS=hablar con alguien,agente humano,asesor
```

**Si ves `WhatsApp API error (401): Authentication Error`:**
1. El token expiró o no es de WhatsApp (no uses el de Página Facebook).
2. Meta Business Manager → Usuarios del sistema → token con `whatsapp_business_messaging` + `whatsapp_business_management`.
3. Pega en `WHATSAPP_ACCESS_TOKEN` y **reinicia el bot**.
4. Comprueba: `GET http://localhost:4100/api/whatsapp/diagnostics` → `"ok": true`.

### 7.4 Cómo funciona

- **Entrante:** cliente escribe → webhook → el bot responde con IA (knowledge de MatuByte) en segundos.
- **Handoff a humano:** si el cliente pide "hablar con alguien" (o el bot falla), la conversación pasa a modo `human` y deja de responder sola. Se ve en el cockpit con badge magenta.
- **Tomar/devolver control:** desde `/whatsapp-thread.html?id=...`, botón **TOMAR CONTROL** / **DEVOLVER A IA**.
- **Escribir manualmente:** cualquier respuesta manual desde el cockpit pasa la conversación a modo humano automáticamente.

### 7.5 Campañas salientes (ofrecer productos/servicios)

**Importante — regla de Meta:** para escribirle primero a alguien (fuera de una conversación que el cliente inició en las últimas 24h) es **obligatorio usar una plantilla (template) pre-aprobada** por Meta. No se puede enviar texto libre en frío.

1. Crea la plantilla en **Meta Business Manager → WhatsApp Manager → Plantillas de mensajes** y espera la aprobación (minutos a 24h).
2. En el cockpit → **NUEVA CAMPAÑA**:
   - Nombre de la campaña
   - Nombre exacto de la plantilla aprobada
   - Idioma de la plantilla (ej. `es`)
   - Params del cuerpo con placeholders `{{name}}`, `{{sector}}`, `{{city}}` (se rellenan por lead)
   - Filtro opcional por sector/ciudad (usa los leads que ya capturó el Cazador)
3. La campaña envía con 1.2s de espera entre mensajes y queda registrada en `whatsapp_campaigns` / `whatsapp_campaign_targets`.
4. Cuando el lead responde, la conversación entra al inbox normal (ventana de 24h de mensajes libres).

API directa:

```http
POST /api/whatsapp/campaigns
{
  "name": "Oferta CRM peluquerías Cali",
  "templateName": "oferta_crm_pyme",
  "templateLanguage": "es",
  "appSlug": "matucrm",
  "bodyParamsTemplate": ["{{name}}", "{{sector}}"],
  "leadFilter": { "sector": "peluquerias", "city": "Cali" }
}
```

## 8. Facebook Publisher + cola de aprobación

Cockpit: **http://localhost:4100/facebook.html** (y prod: `https://growth.matubyte.com/facebook.html`)

SQL: `sql/facebook_approval.sql` (o `npm run migrate`).

```env
FB_PUBLISHER_ENABLED=true
FB_DRY_RUN=false         # false = publica de verdad
FB_AUTO_PUBLISH=false    # false = tú apruebas; true = auto
FB_PAGE_ID=106280654981120
FB_PAGE_ACCESS_TOKEN=EAAxxxxx   # token de PÁGINA (me/accounts), no el de WhatsApp
```

### Credenciales (si sale `#200 Permissions error`)

1. [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
2. App correcta → **Agregar permiso** y marca:
   - `pages_show_list`
   - `pages_read_engagement`
   - `pages_manage_posts` ← **obligatorio para publicar**
   - `pages_manage_metadata` (recomendado)
3. **Generar token de acceso** → en el diálogo elige la Página **MatuByte**
4. Endpoint `me/accounts` → Enviar
5. Copia el `access_token` del bloque `"name": "MatuByte"` → `FB_PAGE_ACCESS_TOKEN`
6. El `id` → `FB_PAGE_ID`
7. Actualiza `.env` en **local y en el VPS** (`growth.matubyte.com`) y reinicia el servicio

Flujo manual: agente genera → `pending_review` → apruebas en el panel → publica.
