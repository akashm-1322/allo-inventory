import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Clear existing data
  await prisma.reservation.deleteMany();
  await prisma.stock.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.idempotencyRecord.deleteMany();

  // Warehouses
  const [mumbai, delhi, bangalore] = await Promise.all([
    prisma.warehouse.create({
      data: { name: "Mumbai Hub", location: "Mumbai, MH" },
    }),
    prisma.warehouse.create({
      data: { name: "Delhi North", location: "New Delhi, DL" },
    }),
    prisma.warehouse.create({
      data: { name: "Bangalore South", location: "Bengaluru, KA" },
    }),
  ]);

  console.log("✓ Warehouses created");

  // Products + stock
  const products = [
    {
      name: "Sony WH-1000XM5",
      description: "Industry-leading noise cancelling headphones with 30-hour battery life.",
      price: 299.99,
      imageUrl: null,
      stocks: [
        { warehouseId: mumbai.id, totalUnits: 12, reservedUnits: 0 },
        { warehouseId: delhi.id, totalUnits: 8, reservedUnits: 0 },
        { warehouseId: bangalore.id, totalUnits: 3, reservedUnits: 0 },
      ],
    },
    {
      name: "Apple AirPods Pro (3rd Gen)",
      description: "Active noise cancellation, Transparency mode, and Adaptive Audio.",
      price: 249.00,
      imageUrl: null,
      stocks: [
        { warehouseId: mumbai.id, totalUnits: 20, reservedUnits: 0 },
        { warehouseId: delhi.id, totalUnits: 15, reservedUnits: 0 },
        { warehouseId: bangalore.id, totalUnits: 10, reservedUnits: 0 },
      ],
    },
    {
      name: "Samsung Galaxy Tab S9",
      description: "11-inch Dynamic AMOLED 2X display with IP68 water resistance.",
      price: 699.99,
      imageUrl: null,
      stocks: [
        { warehouseId: mumbai.id, totalUnits: 5, reservedUnits: 0 },
        { warehouseId: delhi.id, totalUnits: 1, reservedUnits: 0 },
        { warehouseId: bangalore.id, totalUnits: 0, reservedUnits: 0 },
      ],
    },
    {
      name: "Logitech MX Master 3S",
      description: "High-precision 8K DPI sensor with near-silent clicks and USB-C charging.",
      price: 99.99,
      imageUrl: null,
      stocks: [
        { warehouseId: mumbai.id, totalUnits: 0, reservedUnits: 0 },
        { warehouseId: delhi.id, totalUnits: 0, reservedUnits: 0 },
        { warehouseId: bangalore.id, totalUnits: 0, reservedUnits: 0 },
      ],
    },
    {
      name: "ASUS ROG Ally X",
      description: "AMD Ryzen Z1 Extreme gaming handheld with 7-inch FHD 120Hz display.",
      price: 799.99,
      imageUrl: null,
      stocks: [
        { warehouseId: mumbai.id, totalUnits: 2, reservedUnits: 0 },
        { warehouseId: delhi.id, totalUnits: 3, reservedUnits: 0 },
        { warehouseId: bangalore.id, totalUnits: 1, reservedUnits: 0 },
      ],
    },
    {
      name: "Kindle Paperwhite (2024)",
      description: "7-inch glare-free display, 16GB storage, and 12-week battery life.",
      price: 149.99,
      imageUrl: null,
      stocks: [
        { warehouseId: mumbai.id, totalUnits: 18, reservedUnits: 0 },
        { warehouseId: delhi.id, totalUnits: 22, reservedUnits: 0 },
        { warehouseId: bangalore.id, totalUnits: 14, reservedUnits: 0 },
      ],
    },
  ];

  for (const { stocks, ...productData } of products) {
    const product = await prisma.product.create({ data: productData });
    for (const stock of stocks) {
      await prisma.stock.create({
        data: { productId: product.id, ...stock },
      });
    }
  }

  console.log(`✓ ${products.length} products created`);
  console.log("✅ Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
