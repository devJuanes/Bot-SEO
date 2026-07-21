# Referencia API — MatuByte Growth Factory

Base URL:

| Entorno | URL |
|---------|-----|
| Local API | `http://localhost:4100` |
| Local UI (proxy) | `http://localhost:5173` → proxy `/api` |
| Producción | `https://growth.matubyte.com` |

## Autenticación

La mayoría de endpoints requieren:

```http
Authorization: Bearer <token>
X-Project-Id: <uuid-del-proyecto>
Content-Type: application/json
```

El token se obtiene en login y también se guarda en cookie `growth_token` (HttpOnly en producción).

### Públicos (sin auth)

- `GET /health`
- `POST /api/auth/register`, `POST /api/auth/login`
- `GET /api/auth/me` (con cookie o Bearer)
- `POST /webhooks/whatsapp`, `POST /webhooks/facebook`
- Archivos estáticos / SPA

### Errores comunes

| Código | Significado |
|--------|-------------|
| `401` | Sin token o sesión inválida |
| `400` | Falta `X-Project-Id` |
| `403` | Sin acceso al proyecto/org |
| `404` | Recurso no encontrado |
| `409` | Conflicto (ej. WhatsApp no configurado) |

---

## Auth

### `POST /api/auth/register`

```json
{
  "email": "user@empresa.com",
  "password": "********",
  "name": "Juan Pérez",
  "organizationName": "Mi Empresa",
  "projectName": "Proyecto principal"
}
```

### `POST /api/auth/login`

```json
{ "email": "user@empresa.com", "password": "********" }
```

Respuesta: `{ "token", "user", "organization", "project", "organizations", "projectsByOrg" }`

### `GET /api/auth/me`

Usuario actual + organizaciones y proyectos.

### `POST /api/auth/logout`

Invalida sesión (cookie + token).

---

## Organizaciones y proyectos

### `GET /api/organizations`

Lista organizaciones del usuario.

### `POST /api/organizations`

```json
{ "name": "Nueva Org" }
```

### `GET /api/organizations/:orgId/projects`

Proyectos de una organización.

### `POST /api/organizations/:orgId/projects`

```json
{ "name": "Proyecto", "type": "company", "brandName": "Marca" }
```

### `GET /api/projects/:projectId`

Detalle del proyecto.

### `PATCH /api/projects/:projectId`

Actualizar nombre, brand_name, etc.

### `GET /api/projects/:projectId/settings`

Todas las settings del proyecto (sin secretos).

### `PUT /api/projects/:projectId/settings`

```json
{ "brand_name": "...", "features": { "content_enabled": true } }
```

### `PUT /api/projects/:projectId/settings/:key`

Una setting individual.

### `PUT /api/projects/:projectId/secrets/:key`

Guardar secreto cifrado (`whatsapp_access_token`, `fb_page_access_token`, `llm_api_key`, etc.).

---

## Dashboard y eventos

### `GET /api/dashboard`

Stats, agentes, logs recientes del proyecto.

### `GET /api/events`

Server-Sent Events / stream de actividad (si está habilitado).

### `GET /health`

```json
{
  "status": "ok",
  "service": "matubyte-growth-factory",
  "checks": { "db": "ok", "llm": "configured" }
}
```

---

## Leads

Requiere `X-Project-Id`.

### `GET /api/leads`

Query: `limit`, `offset`, `search`, `status`, `source`

### `GET /api/leads/stats`

Totales por estado, fuente, `needsWebsite`.

### `GET /api/leads/:id`

Detalle de un lead.

### `PATCH /api/leads/:id`

```json
{ "status": "contacted" }
```

Estados: `new`, `contacted`, `qualified`, `won`, `lost`.

### `GET /api/leads/:id/whatsapp`

Conversación WhatsApp vinculada + mensajes + flags `configured`, `hasPhone`.

### `POST /api/leads/:id/whatsapp/reply`

```json
{ "text": "Hola, somos MatuByte…" }
```

Envía mensaje humano; crea/vincula conversación; marca lead como contactado si estaba `new`.

### `POST /api/leads/:id/whatsapp/proposals`

Genera propuestas IA personalizadas:

```json
{
  "proposals": [
    { "id": "greeting", "label": "Saludo inicial", "tone": "brand", "text": "…" }
  ]
}
```

---

## WhatsApp

### `GET /api/whatsapp/status`

`{ "configured": true }`

### `GET /api/whatsapp/diagnostics`

Valida token y Phone Number ID contra Graph API.

### `GET /api/whatsapp/conversations`

Lista conversaciones del proyecto.

### `GET /api/whatsapp/conversations/:id/messages`

Mensajes de una conversación.

### `POST /api/whatsapp/conversations/:id/reply`

```json
{ "text": "Respuesta manual" }
```

### `POST /api/whatsapp/conversations/:id/mode`

```json
{ "mode": "bot" }
```

o `"human"`.

### `GET /api/whatsapp/templates`

Plantillas aprobadas en la WABA.

### `POST /api/whatsapp/templates/test`

```json
{
  "to": "573001112233",
  "templateName": "hello_world",
  "templateLanguage": "es",
  "bodyParams": ["Juan"]
}
```

### `GET /api/whatsapp/campaigns`

Campañas del proyecto.

### `POST /api/whatsapp/campaigns`

```json
{
  "name": "Campaña laboratorios",
  "templateName": "mi_plantilla",
  "templateLanguage": "es",
  "leadFilter": { "status": "new" },
  "bodyParamsTemplate": ["{{name}}", "{{city}}"]
}
```

Modo prueba: añade `"testTo": "573001112233"`.

### `POST /api/whatsapp/campaigns/:id/resume`

Reanuda campaña pausada.

### `POST /api/whatsapp/campaigns/:id/cancel`

Cancela campaña.

### Webhook `POST /webhooks/whatsapp`

Recibe eventos de Meta (verificación GET en el mismo path si está configurado).

---

## Facebook

### `GET /api/facebook/config`

Configuración pública (sin token).

### `GET /api/facebook/diagnostics`

Valida Page Access Token.

### `GET /api/facebook/pending`

Posts en cola de aprobación.

### `GET /api/facebook/failed`

Posts fallidos recientes.

### `POST /api/facebook/generate`

Genera borradores con IA para la cola.

### `POST /api/facebook/posts/:id/approve`

Aprueba y publica un post pendiente.

### `PATCH /api/facebook/posts/:id`

Edita borrador (texto, media URL, tipo imagen/video).

### `POST /api/facebook/posts/:id/reject`

Rechaza borrador.

### Webhook `POST /webhooks/facebook`

Eventos de Meta para la página.

---

## Agentes (runtime)

### `GET /agents`

Lista agentes del registry (lead-hunter, blog-writer, …).

### `POST /agents/:id/run`

Ejecuta agente manualmente.

```json
{ "city": "Cali", "sector": "restaurantes" }
```

Body opcional según agente.

### `GET /api/agents`

Agentes con estado en DB (legacy/growth API).

### `GET /api/projects/:projectId/agents/full`

Agentes del proyecto + config + últimas corridas.

### `POST /api/projects/:projectId/agents/activate`

```json
{ "agentIds": ["lead-hunter", "content-radar"] }
```

### `GET /api/projects/:projectId/agents/:agentId/insights`

Métricas e historial del agente.

---

## Agentes personalizados

### `GET /api/projects/:projectId/custom-agents`

### `POST /api/projects/:projectId/custom-agents`

```json
{
  "name": "Asistente ventas",
  "systemPrompt": "Eres un SDR…",
  "model": "MiniMax-M3"
}
```

### `PATCH /api/projects/:projectId/custom-agents/:id`

### `DELETE /api/projects/:projectId/custom-agents/:id`

### `GET /api/projects/:projectId/custom-agents/:id/chat`

Historial de chat.

### `POST /api/projects/:projectId/custom-agents/:id/chat/stream`

Mensaje con respuesta en streaming.

### `POST /api/projects/:projectId/custom-agents/:id/run`

Ejecuta el agente custom.

---

## Setup y marca

### `GET /api/projects/:projectId/setup/status`

Estado del wizard de configuración inicial.

### `POST /api/projects/:projectId/setup/brand/manual`

Marca y conocimiento manual.

### `POST /api/projects/:projectId/setup/brand/auto`

Auto-detecta marca desde URL.

### `PUT /api/projects/:projectId/hunt-sources`

Fuentes para Lead Hunter (sectores, ciudades).

---

## Chat de empresa

### `GET /api/projects/:projectId/company-chat?sessionId=default`

Historial de mensajes.

### `POST /api/projects/:projectId/company-chat`

```json
{ "message": "¿Qué servicios ofrecemos?", "sessionId": "default" }
```

### `POST /api/projects/:projectId/company-chat/transcribe`

Sube audio (multipart) para transcribir y opcionalmente enviar al chat.

---

## Notificaciones

### `GET /api/projects/:projectId/notifications`

### `POST /api/projects/:projectId/notifications/:id/read`

### `POST /api/projects/:projectId/notifications/read-all`

### `POST /api/projects/:projectId/notifications`

Crear notificación (interno/admin).

---

## Soporte (Centro de ayuda)

### `GET /api/support/tickets`

```json
{ "tickets": [...], "openCount": 2 }
```

### `GET /api/support/tickets/:id`

### `POST /api/support/tickets`

```json
{
  "category": "technical",
  "subject": "Error al cargar WhatsApp",
  "message": "Descripción detallada…"
}
```

Categorías: `general`, `technical`, `whatsapp`, `facebook`, `billing`, `feature`.

---

## Contenido y knowledge (Growth API)

### `GET /api/content`

Briefs, blogs, scripts del proyecto.

### `GET /api/opportunities`

Oportunidades detectadas.

### `GET /api/knowledge`

Entradas de `site_knowledge`.

### `POST /api/knowledge`

```json
{
  "key": "company_overview",
  "title": "Qué hace la empresa",
  "content": "…"
}
```

### `GET /api/apps`

Apps/productos conectados (CMR, etc.).

### `POST /api/apps`

Registrar app para que agentes sociales la promocionen.

---

## Admin / realtime

### `GET /api/admin/push/status`

Estado del WebSocket admin.

### `POST /api/admin/push/test`

Envía notificación de prueba.

### WebSocket `ws://host/socket.io`

Eventos: `admin:hello`, `admin:notify` (leads, facebook, whatsapp, system).

---

## Ejemplo con curl

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:4100/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@matubyte.com","password":"***"}' \
  | jq -r '.token')

PROJECT_ID="tu-project-uuid"

# Listar leads
curl -s "http://localhost:4100/api/leads?limit=10" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Project-Id: $PROJECT_ID"

# Health (sin auth)
curl -s http://localhost:4100/health
```

---

## Variables de entorno relevantes

Ver `.env.example` y [CONFIGURACION.md](CONFIGURACION.md).

| Variable | Uso |
|----------|-----|
| `PORT` | Puerto API (4100 local; 4101 en VPS compartido) |
| `MATUDB_URL`, `MATUDB_API_KEY` | Base de datos |
| `AUTH_JWT_SECRET` | Sesiones |
| `SECRETS_MASTER_KEY` | Cifrado de secretos por proyecto |
| `LLM_API_KEY`, `LLM_MODEL` | Fallback global LLM |
| `WHATSAPP_*` | Fallback global WhatsApp |
| `FB_PAGE_ACCESS_TOKEN` | Fallback global Facebook |

Los secretos por proyecto en Ajustes **tienen prioridad** sobre `.env`.

---

## Más documentación

- [Guía de usuario](GUIA-USUARIO.md)
- [Configuración](CONFIGURACION.md)
- [Índice](README.md)
