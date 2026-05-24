import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const reservation = await prisma.reservation.findUnique({ where: { id } });

  if (!reservation) {
    return NextResponse.json({ error: "Reservation not found." }, { status: 404 });
  }

  // Already terminal — return current state
  if (reservation.status !== "PENDING") {
    const full = await prisma.reservation.findUnique({
      where: { id },
      include: {
        product: { select: { id: true, name: true, price: true } },
        warehouse: { select: { id: true, name: true, location: true } },
      },
    });
    return NextResponse.json(full);
  }

  const released = await prisma.$transaction(async (tx) => {
    const updated = await tx.reservation.update({
      where: { id, status: "PENDING" },
      data: { status: "RELEASED" },
      include: {
        product: { select: { id: true, name: true, price: true } },
        warehouse: { select: { id: true, name: true, location: true } },
      },
    });

    // Return units to available stock
    await tx.$executeRaw`
      UPDATE "Stock"
      SET "reservedUnits" = GREATEST(0, "reservedUnits" - ${reservation.quantity})
      WHERE "productId" = ${reservation.productId}
        AND "warehouseId" = ${reservation.warehouseId}
    `;

    return updated;
  });

  return NextResponse.json(released);
}
