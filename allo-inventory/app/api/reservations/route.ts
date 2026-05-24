import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { acquireLock, releaseLock } from "@/lib/redis";
import { withIdempotency } from "@/lib/idempotency";
import { CreateReservationSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

const RESERVATION_TTL_MINUTES = 10;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = CreateReservationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { productId, warehouseId, quantity } = parsed.data;
  const idempotencyKey = req.headers.get("Idempotency-Key");

  const { status, body: responseBody } = await withIdempotency(
    idempotencyKey,
    async () => {
      // Layer 1: Redis distributed lock — fast rejection for concurrent requests
      const lockKey = `reserve:${productId}:${warehouseId}`;
      const lockAcquired = await acquireLock(lockKey, 15);

      if (!lockAcquired) {
        return {
          status: 409,
          body: { error: "Another reservation is in progress. Please retry in a moment." },
        };
      }

      try {
        // Layer 2: DB transaction with SELECT FOR UPDATE — authoritative ground truth
        const reservation = await prisma.$transaction(async (tx) => {
          // Row-level lock prevents concurrent reads from seeing stale reservedUnits
          const stocks = await tx.$queryRaw<
            { total_units: number; reserved_units: number }[]
          >`
            SELECT "totalUnits" as total_units, "reservedUnits" as reserved_units
            FROM "Stock"
            WHERE "productId" = ${productId} AND "warehouseId" = ${warehouseId}
            FOR UPDATE
          `;

          if (stocks.length === 0) {
            throw new Error("STOCK_NOT_FOUND");
          }

          const stock = stocks[0];
          const available = stock.total_units - stock.reserved_units;

          if (available < quantity) {
            throw new Error("INSUFFICIENT_STOCK");
          }

          // Atomically increment reservedUnits
          await tx.$executeRaw`
            UPDATE "Stock"
            SET "reservedUnits" = "reservedUnits" + ${quantity}
            WHERE "productId" = ${productId} AND "warehouseId" = ${warehouseId}
          `;

          const expiresAt = new Date(
            Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000
          );

          return await tx.reservation.create({
            data: { productId, warehouseId, quantity, expiresAt, status: "PENDING" },
            include: {
              product: { select: { id: true, name: true, price: true } },
              warehouse: { select: { id: true, name: true, location: true } },
            },
          });
        });

        return { status: 201, body: reservation };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "";
        if (message === "INSUFFICIENT_STOCK") {
          return {
            status: 409,
            body: { error: "Not enough stock available. Another customer may have just reserved these units." },
          };
        }
        if (message === "STOCK_NOT_FOUND") {
          return {
            status: 404,
            body: { error: "Product/warehouse combination not found." },
          };
        }
        throw err;
      } finally {
        await releaseLock(lockKey);
      }
    }
  );

  return NextResponse.json(responseBody, { status });
}
