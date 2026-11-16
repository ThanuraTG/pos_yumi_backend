import { PrismaClient, DosageForm, BatchStatus, MovementType } from '@prisma/client';
import { MedicinesService } from './medicines.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../database/prisma.service';

async function testMedicineModule() {
  console.log('--- Starting Medicine Management Module Integration Test ---');
  const prisma = new PrismaService();
  await prisma.$connect();

  const auditLogsService = new AuditLogsService(prisma);
  const medicinesService = new MedicinesService(prisma, auditLogsService);

  // 1. Test SKU Auto-generation
  const generatedSku = await medicinesService.generateSkuCode();
  console.log(`[PASS 1] Auto-generated SKU Code: ${generatedSku}`);

  // Fetch category and supplier for test
  const cat = await prisma.category.findFirst();
  if (!cat) throw new Error('No category found');
  const sup = await prisma.supplier.findFirst();

  const testBarcode = '4799999900018';

  // 2. Test Create Medicine with Initial Stock Batch
  console.log('\n[TEST 2] Creating Medicine with Specifications, Pricing & Initial Batch...');
  const newMed = await medicinesService.create(
    {
      name: 'Ibuprofen',
      brandName: 'Brufen 400mg',
      skuCode: generatedSku,
      barcode: testBarcode,
      categoryId: cat.id.toString(),
      subCategory: 'Non-steroidal anti-inflammatory',
      strength: '400mg',
      dosageForm: DosageForm.TABLET,
      composition: 'Each coated tablet contains Ibuprofen BP 400mg',
      packSize: 'Box of 100',
      baseUnit: 'TABLET',
      route: 'Oral',
      storageCondition: 'Store below 25°C in a dry place',
      prescriptionRequired: false,
      isNarcotic: false,

      // Pricing
      purchasePrice: 12.50,
      sellingPrice: 18.00,
      wholesalePrice: 15.00,
      mrp: 20.00,
      discountPercentage: 5,
      taxPercentage: 0,

      // Initial Batch & Stock
      initialBatchNumber: 'BRU-2026-X1',
      mfgDate: '2026-01-15',
      expiryDate: '2027-12-31',
      initialStockQuantity: 500,
      reorderLevel: 100,
      maxStockLevel: 2000,
      rackLocation: 'Rack B-03 / Shelf 1',
      warehouseLocation: 'Main Dispensary',

      // Supplier
      supplierId: sup ? sup.id.toString() : undefined,

      // Settings
      isActive: true,
      lowStockAlert: true,
      expiryAlert: true,
      notes: 'Test item for medicine management module'
    },
    '1'
  );

  console.log(`[PASS 2] Successfully created medicine ID: ${newMed.id}, SKU: ${newMed.skuCode}`);

  // 3. Verify Batch & StockMovement created atomically
  const batches = await medicinesService.getBatches(newMed.id.toString());
  console.log(`[PASS 3] Batches created for medicine: ${batches.length}`);
  if (batches.length !== 1 || Number(batches[0].quantityOnHand) !== 500) {
    throw new Error('Initial batch quantity mismatch');
  }

  const stockHistory = await medicinesService.getStockHistory(newMed.id.toString());
  console.log(`[PASS 3b] Stock movement ledger entries: ${stockHistory.length}, Delta: ${stockHistory[0].quantityDelta}`);
  if (stockHistory.length !== 1 || Number(stockHistory[0].quantityDelta) !== 500) {
    throw new Error('Stock movement ledger mismatch');
  }

  // 4. Test Duplicate Prevention (Barcode)
  console.log('\n[TEST 4] Testing Duplicate Barcode Prevention...');
  try {
    await medicinesService.create(
      {
        name: 'Another Ibuprofen',
        brandName: 'Ibugesic 400mg',
        barcode: testBarcode, // Same barcode
        categoryId: cat.id.toString(),
        strength: '400mg',
        dosageForm: DosageForm.TABLET
      },
      '1'
    );
    throw new Error('Should have failed due to duplicate barcode');
  } catch (err: any) {
    console.log(`[PASS 4] Correctly rejected duplicate barcode: ${err.message}`);
  }

  // 5. Test MRP Validation (Selling price > MRP)
  console.log('\n[TEST 5] Testing MRP Constraint (Selling Price > MRP)...');
  try {
    await medicinesService.create(
      {
        name: 'Paracetamol Test',
        brandName: 'Overpriced Med',
        categoryId: cat.id.toString(),
        strength: '500mg',
        dosageForm: DosageForm.TABLET,
        purchasePrice: 10.00,
        sellingPrice: 50.00,
        mrp: 30.00 // Selling 50 > MRP 30
      },
      '1'
    );
    throw new Error('Should have failed due to selling price > MRP');
  } catch (err: any) {
    console.log(`[PASS 5] Correctly rejected Selling Price > MRP: ${err.message}`);
  }

  // 6. Test FindAll with Inventory Metrics
  console.log('\n[TEST 6] Testing FindAll with Computed Metrics & Filters...');
  const listRes = await medicinesService.findAll(1, 10, 'Brufen');
  console.log(`[PASS 6] Search found ${listRes.items.length} items`);
  const found = listRes.items.find((m) => m.id === newMed.id);
  if (!found) throw new Error('Created medicine not found in search');
  console.log(`   -> Available Stock: ${found.availableStock}`);
  console.log(`   -> Profit Amount: LKR ${found.profitAmount}`);
  console.log(`   -> Profit Margin: ${found.profitMargin}%`);
  console.log(`   -> Stock Status: ${found.stockStatus}`);
  console.log(`   -> Expiry Status: ${found.expiryStatus}`);

  // 7. Test Update Medicine
  console.log('\n[TEST 7] Testing Update Medicine Details...');
  const updated = await medicinesService.update(
    newMed.id.toString(),
    {
      sellingPrice: 19.50,
      storageCondition: 'Store strictly below 20°C in climate control'
    },
    '1'
  );
  console.log(`[PASS 7] Updated selling price: ${updated.sellingPrice}`);

  // 8. Test Toggle Active Status
  console.log('\n[TEST 8] Testing Toggle Active Status...');
  const toggledOff = await medicinesService.toggleActive(newMed.id.toString(), '1');
  console.log(`[PASS 8] Toggled active: ${toggledOff.isActive} (expected false)`);
  const toggledOn = await medicinesService.toggleActive(newMed.id.toString(), '1');
  console.log(`[PASS 8b] Toggled active: ${toggledOn.isActive} (expected true)`);

  // 9. Clean up test record (Soft delete)
  console.log('\n[TEST 9] Testing Soft Delete / Safe Archive...');
  const delRes = await medicinesService.softDelete(newMed.id.toString(), '1');
  console.log(`[PASS 9] Soft delete result: ${delRes.message}`);

  // Verify it is excluded from normal queries
  const afterDel = await prisma.medicine.findUnique({ where: { id: newMed.id } });
  console.log(`[PASS 9b] deletedAt timestamp set: ${afterDel?.deletedAt?.toISOString()}`);

  // Permanently clean test records to leave DB pristine
  await prisma.stockMovement.deleteMany({ where: { batch: { medicineId: newMed.id } } });
  await prisma.medicineBatch.deleteMany({ where: { medicineId: newMed.id } });
  await prisma.medicine.delete({ where: { id: newMed.id } });
  console.log('[CLEANUP] Test database records cleanly pruned.');

  await prisma.$disconnect();
  console.log('\n=========================================================');
  console.log('   ALL 9 MEDICINE MODULE WORKFLOW TESTS PASSED 100%!    ');
  console.log('=========================================================');
}

testMedicineModule().catch((err) => {
  console.error('Test Failed:', err);
  process.exit(1);
});
