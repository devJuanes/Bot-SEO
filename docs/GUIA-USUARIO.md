# Guía de usuario — MatuByte Growth Factory

Esta guía explica cómo usar la aplicación desde el cockpit web (React).

## Acceso y sesión

1. Entra en `/acceso/iniciar-sesion` con tu email y contraseña.
2. Si es tu primera vez, completa el **setup** en `/setup` (marca, sector, fuentes de leads).
3. La sesión dura **7 días** (cookie `growth_token` + token en localStorage).
4. El **proyecto activo** se guarda en el header `X-Project-Id`; si tienes varios proyectos, cámbialo en el selector del header.

---

## Dashboard (`/dashboard`)

Vista general del proyecto:

- Estadísticas de leads y agentes
- Gráficos de actividad
- Logs recientes de agentes
- Accesos rápidos a módulos

Se actualiza automáticamente cada ~30 s con la pestaña visible.

---

## Agentes (`/agentes`)

Los **agentes** son automatizaciones IA que corren en segundo plano (cron) o manualmente.

| Agente | Función |
|--------|---------|
| **Lead Hunter** | Busca negocios en Google Maps por sector/ciudad |
| **Opportunity Scout** | Detecta oportunidades comerciales |
| **Content Radar** | Ideas de contenido SEO |
| **Blog Writer** | Borradores de artículos |
| **Social Creator** | Posts para redes |
| **Facebook Publisher** | Publica en tu página de Facebook |
| **Catalog Curator** | Curación del catálogo de productos |
| **Community Agent** | Respuestas en comunidades/foros |

**Cómo usarlos:**

1. Ve a **Agentes** y activa los que necesites (toggle por proyecto).
2. Configura fuentes de búsqueda en Ajustes o en el setup.
3. Revisa **insights** y logs en el detalle de cada agente.
4. Puedes crear **agentes personalizados** con prompt propio y chat integrado.

---

## Leads (`/leads`)

Prospectos detectados por Lead Hunter u otras fuentes.

### Lista de leads

- Filtros por estado, fuente y búsqueda por nombre/teléfono/ciudad.
- Badges: fuente (Google Maps), estado (Nuevo, Contactado…), “Necesita web”.

### Detalle del lead (`/leads/:id`)

- Ficha completa: teléfono, email, web, mapa, reputación Google.
- **Botón flotante WhatsApp** (verde): abre panel lateral para chatear con el prospecto.
  - Pestaña **Chat:** historial y envío de mensajes.
  - Pestaña **Propuestas IA:** mensajes sugeridos según sector/oportunidad; puedes editar o enviar directo.
- Requiere WhatsApp configurado en Ajustes.

---

## WhatsApp (`/whatsapp/mensajes`)

### Requisitos

Configura en **Ajustes → WhatsApp**:

- Access Token (System User permanente de Meta)
- Phone Number ID
- WABA ID (opcional; se auto-detecta en muchos casos)

Usa **Diagnóstico** en esa página para validar la conexión.

### Módulos

| Sección | Uso |
|---------|-----|
| **Mensajes** | Inbox de conversaciones; modo bot o humano |
| **Campañas** | Envío masivo con plantillas a leads |
| **Contactos** | Leads con teléfono para campañas |
| **Plantillas** | Plantillas aprobadas en Meta; prueba de envío |

**Importante:** Para iniciar conversación con alguien que no te ha escrito en 24 h, debes usar una **plantilla aprobada**.

---

## Facebook (`/facebook/queue`)

1. Configura **Page Access Token** en Ajustes → Facebook (token de página, no de usuario).
2. **Cola:** posts generados por agentes pendientes de aprobación.
3. **Publicados:** historial de lo enviado a Meta.
4. **Generar:** crea borradores con IA para la cola.

Puedes adjuntar imagen/video antes de publicar.

---

## Chat de empresa (`/chat`)

Asistente IA con conocimiento de tu marca (configurado en setup / Ajustes → Marca).

- Soporta **voz a texto** (micrófono) si el navegador lo permite.
- Las respuestas usan el LLM configurado en Ajustes → LLM.

---

## Contenido (`/content`)

Visible si el proyecto tiene `content_enabled`. Muestra briefs, oportunidades y borradores del pipeline editorial.

---

## Ajustes (`/settings`)

| Pestaña | Qué configurar |
|---------|----------------|
| **Proyecto** | Nombre, slug, features |
| **LLM / IA** | Proveedor, API key, modelo |
| **WhatsApp** | Token, Phone ID, WABA |
| **Facebook** | Page token, Page ID |
| **Marca** | Nombre, conocimiento de marca, tono |

Los secretos guardados muestran estado “configurado” con opción de editar (no se muestran en claro).

---

## Centro de ayuda (`/help`)

| Sección | Contenido |
|---------|-----------|
| **Inicio** | Resumen y accesos rápidos |
| **FAQ** | Preguntas frecuentes por categoría |
| **Mis tickets** | Solicitudes de soporte y su estado |
| **Contactar** | Formulario para abrir ticket |

---

## Flujos recomendados

### Prospección → contacto WhatsApp

1. Activa **Lead Hunter** con sector y ciudades objetivo.
2. Revisa leads en `/leads`.
3. Abre detalle → botón WhatsApp → genera propuesta IA → envía.
4. Cambia estado del lead a **Contactado** / **Calificado**.

### Publicar en Facebook

1. Configura token de página.
2. Ejecuta **Social Creator** o **Facebook Publisher** (o genera desde `/facebook/generate`).
3. Aprueba en cola → publica.

### Primera configuración

1. Registro → Setup wizard.
2. Ajustes → LLM (API key).
3. Ajustes → WhatsApp y/o Facebook según necesites.
4. Agentes → activar Lead Hunter.

---

## Atajos de teclado y UX

- **Escape:** cierra modales y el panel lateral de WhatsApp.
- **Enter** en el chat de lead: envía mensaje (Shift+Enter = nueva línea).
- Los botones muestran **spinner** mientras procesan (guardar, enviar, etc.).

---

## Más información

- [Referencia API](API.md) — integraciones y endpoints
- [Configuración técnica](CONFIGURACION.md) — tokens Meta, deploy, LLM
- [Índice de documentación](README.md)
