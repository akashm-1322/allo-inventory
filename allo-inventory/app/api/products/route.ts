import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const products = await prisma.product.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      stocks: {
        include: {
          warehouse: { select: { id: true, name: true, location: true } },
        },
      },
    },
  });

  const response = products.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    price: p.price,
    imageUrl: p.imageUrl,
    warehouses: p.stocks.map((s) => ({
      warehouseId: s.warehouse.id,
      warehouseName: s.warehouse.name,
      warehouseLocation: s.warehouse.location,
      totalUnits: s.totalUnits,
      reservedUnits: s.reservedUnits,
      availableUnits: Math.max(0, s.totalUnits - s.reservedUnits),
    })),
  }));

  return NextResponse.json(response);
}
