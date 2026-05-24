import { prisma } from "@/lib/prisma";

type HandlerResult = { status: number; body: unknown };

/**
 * Wraps an API handler with idempotency logic.
 *
 * If idempotencyKey is null, the handler runs normally (no idempotency).
 * If a record with that key already exists, the stored response is returned.
 * Otherwise, the handler runs and its result is persisted before returning.
 */
export async function withIdempotency(
  idempotencyKey: string | null,
  handler: () => Promise<HandlerResult>
): Promise<HandlerResult> {
  if (!idempotencyKey) {
    return handler();
  }

  // Check for an existing record
  const existing = await prisma.idempotencyRecord.findUnique({
    where: { key: idempotencyKey },
  });

  if (existing) {
    return {
      status: existing.statusCode,
      body: JSON.parse(existing.responseBody),
    };
  }

  // Run the handler
  const result = await handler();

  // Persist — use upsert to handle the (unlikely) race where two identical
  // requests arrive before either has written the record.
  await prisma.idempotencyRecord.upsert({
    where: { key: idempotencyKey },
    create: {
      key: idempotencyKey,
      statusCode: result.status,
      responseBody: JSON.stringify(result.body),
    },
    update: {}, // If it somehow already exists, keep the first write
  });

  return result;
}
