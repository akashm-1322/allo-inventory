import { prisma } from "@/lib/prisma";

/**
 * Finds all PENDING reservations past their expiresAt, marks them EXPIRED,
 * and releases their reservedUnits back to available stock.
 *
 * Returns the count of reservations expired.
 *
 * Called by:
 *  1. The /api/cron/expire-reservations endpoint (every minute in production)
 *  2. Individual reservation reads (lazy cleanup fallback)
 */
export async function expireStaleReservations(): Promise<number> {
  const now = new Date();

  // Find expired reservations
  const stale = await prisma.reservation.findMany({
    where: { status: "PENDING", expiresAt: { lt: now } },
    select: { id: true, productId: true, warehouseId: true, quantity: true },
  });

  if (stale.length === 0) return 0;

  // Process in a transaction to keep stock counts consistent
  await prisma.$transaction(async (tx) => {
    // Mark as EXPIRED
    await tx.reservation.updateMany({
      where: { id: { in: stale.map((r) => r.id) } },
      data: { status: "EXPIRED" },
    });

    // Release reservedUnits for each unique stock row
    // Group by productId+warehouseId to batch the updates
    const grouped = stale.reduce<Record<string, { productId: string; warehouseId: string; qty: number }>>(
      (acc, r) => {
        const k = `${r.productId}:${r.warehouseId}`;
        if (!acc[k]) acc[k] = { productId: r.productId, warehouseId: r.warehouseId, qty: 0 };
        acc[k].qty += r.quantity;
        return acc;
      },
      {}
    );

    for (const { productId, warehouseId, qty } of Object.values(grouped)) {
      await tx.$executeRaw`
        UPDATE "Stock"
        SET "reservedUnits" = GREATEST(0, "reservedUnits" - ${qty})
        WHERE "productId" = ${productId} AND "warehouseId" = ${warehouseId}
      `;
    }
  });

  return stale.length;
}

/**
 * Lazily expire a single reservation if it's past its expiry time.
 * Used by GET /api/reservations/[id] and POST .../confirm as a fallback
 * in case the cron hasn't run yet.
 *
 * Returns true if the reservation was expired by this call.
 */
export async function lazyExpireReservation(id: string): Promise<boolean> {
  const reservation = await prisma.reservation.findUnique({
    where: { id },
    select: { status: true, expiresAt: true, productId: true, warehouseId: true, quantity: true },
  });

  if (!reservation || reservation.status !== "PENDING") return false;
  if (reservation.expiresAt > new Date()) return false;

  await prisma.$transaction(async (tx) => {
    await tx.reservation.update({
      where: { id },
      data: { status: "EXPIRED" },
    });
    await tx.$executeRaw`
      UPDATE "Stock"
      SET "reservedUnits" = GREATEST(0, "reservedUnits" - ${reservation.quantity})
      WHERE "productId" = ${reservation.productId} AND "warehouseId" = ${reservation.warehouseId}
    `;
  });

  return true;
}
