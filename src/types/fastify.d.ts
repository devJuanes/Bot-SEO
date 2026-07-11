export {};

declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: string;
  }
}
