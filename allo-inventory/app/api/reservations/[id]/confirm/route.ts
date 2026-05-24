import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { lazyExpireReservation } from "@/lib/expiry";
import { withIdempotency } from "@/lib/idempotency";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const idempotencyKey = req.headers.get("Idempotency-Key");

  const { status, body } = await withIdempotency(idempotencyKey, async () => {
    // Lazy expiry check before confirming
    await lazyExpireReservation(id);

    const reservation = await prisma.reservation.findUnique({ where: { id } });

    if (!reservation) {
      return { status: 404, body: { error: "Reservation not found." } };
    }

    if (reservation.status === "EXPIRED") {
      return {
        status: 410,
        body: { error: "This reservation has expired. The hold has been released." },
      };
    }

    if (reservation.status === "RELEASED") {
      return {
        status: 410,
        body: { error: "This reservation has already been cancelled." },
      };
    }

    if (reservation.status === "CONFIRMED") {
      // Already confirmed — idempotent response
      const full = await prisma.reservation.findUnique({
        where: { id },
        include: {
          product: { select: { id: true, name: true, price: true } },
          warehouse: { select: { id: true, name: true, location: true } },
        },
      });
      return { status: 200, body: full };
    }

    // PENDING → CONFIRMED
    // Decrement totalUnits and reservedUnits (the reservation is now a real sale)
    const confirmed = await prisma.$transaction(async (tx) => {
      const updated = await tx.reservation.update({
        where: { id, status: "PENDING" }, // guard against race
        data: { status: "CONFIRMED" },
        include: {
          product: { select: { id: true, name: true, price: true } },
          warehouse: { select: { id: true, name: true, location: true } },
        },
      });

      // Release the reserved slot and decrement total inventory
      await tx.$executeRaw`
        UPDATE "Stock"
        SET
          "totalUnits"    = GREATEST(0, "totalUnits" - ${reservation.quantity}),
          "reservedUnits" = GREATEST(0, "reservedUnits" - ${reservation.quantity})
        WHERE "productId" = ${reservation.productId}
          AND "warehouseId" = ${reservation.warehouseId}
      `;

      return updated;
    });

    return { status: 200, body: confirmed };
  });

  return NextResponse.json(body, { status });
}
