export {};

declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: string;
    user?: {
      id: string;
      email: string;
      name: string;
    };
    tenant?: {
      userId?: string;
      organizationId: string;
      projectId: string;
    };
  }
}
