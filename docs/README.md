# Documentación — MatuByte Growth Factory

Fábrica de Growth: agentes autónomos de prospección, leads, WhatsApp, Facebook y contenido.

## Índice

| Documento | Para quién | Contenido |
|-----------|------------|-----------|
| **[Guía de usuario](GUIA-USUARIO.md)** | Usuarios del cockpit | Cómo usar cada módulo de la app (dashboard, leads, agentes, WhatsApp, etc.) |
| **[Referencia API](API.md)** | Desarrolladores / integraciones | Endpoints REST, autenticación, ejemplos |
| **[Configuración](CONFIGURACION.md)** | DevOps / setup | WhatsApp, Facebook, LLM, knowledge base, producción |
| **[MatuByte (marca)](MATUBYTE.md)** | Agentes IA | Identidad, productos, tono de voz |

## Inicio rápido

```bash
# 1. Variables de entorno
cp .env.example .env
# Editar .env (MatuDB, LLM, tokens…)

# 2. Instalar y migrar
npm ci
npm run migrate

# 3. Desarrollo (API :4100 + UI :5173)
npm run dev

# 4. Producción
npm run build && npm run build:ui
npm start
```

- **Login local:** http://localhost:5173/acceso/iniciar-sesion  
- **API health:** http://localhost:4100/health  
- **Producción:** https://growth.matubyte.com  

## Arquitectura (resumen)

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│ React SPA   │────▶│ Fastify API      │────▶│ MatuDB      │
│ frontend/   │     │ src/             │     │ (Postgres)  │
└─────────────┘     └────────┬─────────┘     └─────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
         Agentes IA    WhatsApp API    Facebook Graph
         (cron/manual)  (Meta)          (Meta)
```

- **Multi-tenant:** cada request autenticado lleva `X-Project-Id` (proyecto activo).
- **Secretos:** tokens WhatsApp/Facebook/LLM por proyecto en `project_secrets` (cifrados).
- **Agentes:** jobs programados (`node-cron`) + ejecución manual vía `POST /agents/:id/run`.

## Scripts útiles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | API + Vite en paralelo |
| `npm run migrate` | Aplica `sql/schema.sql` + `sql/tenancy.sql` |
| `npm run typecheck` | TypeScript backend + frontend |
| `./deploy.sh` | Deploy en servidor (ver CONFIGURACION.md) |
| `npx tsx scripts/smoke-llm.ts` | Prueba conexión LLM |

## Soporte

- **Centro de ayuda en la app:** `/help` (FAQ, tickets)
- **Email:** soporte@matubyte.com
