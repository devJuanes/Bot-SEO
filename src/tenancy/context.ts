import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantContext {
  userId?: string;
  organizationId: string;
  projectId: string;
}

const storage = new AsyncLocalStorage<TenantContext>();

export function runWithTenant<T>(ctx: TenantContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export async function runWithTenantAsync<T>(
  ctx: TenantContext,
  fn: () => Promise<T>,
): Promise<T> {
  return storage.run(ctx, fn);
}

/** Bind tenant for the rest of the current async chain (Fastify preHandler). */
export function enterTenant(ctx: TenantContext): void {
  storage.enterWith(ctx);
}

/** Prefer this in route handlers — reliable across Fastify async boundaries. */
export async function withRequestTenant<T>(
  tenant: TenantContext | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  if (!tenant?.organizationId || !tenant?.projectId) {
    throw new Error('Tenant context required (organizationId + projectId)');
  }
  return runWithTenantAsync(tenant, fn);
}

export function getTenant(): TenantContext | undefined {
  return storage.getStore();
}

export function requireTenant(): TenantContext {
  const ctx = storage.getStore();
  if (!ctx?.organizationId || !ctx?.projectId) {
    throw new Error('Tenant context required (organizationId + projectId)');
  }
  return ctx;
}

export function requireProjectId(): string {
  return requireTenant().projectId;
}

export function requireOrganizationId(): string {
  return requireTenant().organizationId;
}

/** Fields to inject on every business-row insert. */
export function tenantInsertFields(): {
  organization_id: string;
  project_id: string;
} {
  const ctx = requireTenant();
  return {
    organization_id: ctx.organizationId,
    project_id: ctx.projectId,
  };
}

export function tryTenantInsertFields():
  | { organization_id: string; project_id: string }
  | Record<string, never> {
  const ctx = getTenant();
  if (!ctx?.organizationId || !ctx?.projectId) return {};
  return {
    organization_id: ctx.organizationId,
    project_id: ctx.projectId,
  };
}
