import {
  PrismaClient,
  DosageForm,
  BatchStatus,
  MovementType,
  PurchaseStatus,
  SupplierPayMethod,
  PrescriptionStatus,
  SessionStatus,
  SaleStatus,
  PaymentMethod,
  PaymentStatus,
  RefundMethod,
  RestockStatus,
  NotificationChannel,
  NotificationStatus,
  Gender,
  Prisma
} from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('================================================================');
  console.log('   PharmaSys ERP & POS - Comprehensive Realistic Mock Seeding   ');
  console.log('   Location: Colombo, Sri Lanka | Currency: LKR                 ');
  console.log('================================================================');

  // -------------------------------------------------------------
  // 1. ROLES & PERMISSIONS
  // -------------------------------------------------------------
  console.log('\n[1/13] Seeding Enterprise Security Roles...');
  const superAdminRole = await prisma.role.upsert({
    where: { name: 'SUPER_ADMIN' },
    update: {},
    create: {
      name: 'SUPER_ADMIN',
      displayName: 'System Administrator',
      description: 'Unrestricted enterprise administrative access to all modules, logs, and configurations'
    }
  });

  const managerRole = await prisma.role.upsert({
    where: { name: 'PHARMACY_MANAGER' },
    update: {},
    create: {
      name: 'PHARMACY_MANAGER',
      displayName: 'Pharmacy Manager',
      description: 'Management of procurement, supplier accounts, pricing, cash drawer reconciliation and P&L'
    }
  });

  const pharmacistRole = await prisma.role.upsert({
    where: { name: 'PHARMACIST' },
    update: {},
    create: {
      name: 'PHARMACIST',
      displayName: 'Responsible Pharmacist (SLMC)',
      description: 'Clinical oversight, prescription verification, controlled drugs and dispensing safety'
    }
  });

  const cashierRole = await prisma.role.upsert({
    where: { name: 'CASHIER' },
    update: {},
    create: {
      name: 'CASHIER',
      displayName: 'Counter Cashier / POS Operator',
      description: 'Counter retail checkout, barcode scanning, payment collection and receipt printing'
    }
  });

  const inventoryOfficerRole = await prisma.role.upsert({
    where: { name: 'INVENTORY_OFFICER' },
    update: {},
    create: {
      name: 'INVENTORY_OFFICER',
      displayName: 'Inventory Officer',
      description: 'Goods receiving bay (GRN), lot batch creation, expiry monitoring and stock takes'
    }
  });

  // -------------------------------------------------------------
  // 2. STAFF USERS
  // -------------------------------------------------------------
  console.log('\n[2/13] Seeding Staff Users with Argon2id Passwords...');
  const defaultAdminPass = await argon2.hash(process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@123456');
  const defaultCashierPass = await argon2.hash('Cashier@123456');
  const defaultPharmPass = await argon2.hash('Pharm@123456');
  const defaultManagerPass = await argon2.hash('Manager@123456');

  const adminUsername = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
  const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@pharmasys.lk';

  const adminUser = await prisma.user.upsert({
    where: { username: adminUsername },
    update: { passwordHash: defaultAdminPass },
    create: {
      username: adminUsername,
      email: adminEmail,
      passwordHash: defaultAdminPass,
      fullName: 'System Administrator',
      phone: '+94771234567',
      isActive: true,
      roles: { create: { roleId: superAdminRole.id } }
    }
  });

  const managerUser = await prisma.user.upsert({
    where: { username: 'manager' },
    update: { passwordHash: defaultManagerPass },
    create: {
      username: 'manager',
      email: 'manager@pharmasys.lk',
      passwordHash: defaultManagerPass,
      fullName: 'Kamal Gunaratne (Pharmacy Manager)',
      phone: '+94773344556',
      isActive: true,
      roles: { create: { roleId: managerRole.id } }
    }
  });

  const cashierUser = await prisma.user.upsert({
    where: { username: 'cashier' },
    update: { passwordHash: defaultCashierPass },
    create: {
      username: 'cashier',
      email: 'cashier@pharmasys.lk',
      passwordHash: defaultCashierPass,
      fullName: 'Nimali Fernando (Cashier 01)',
      phone: '+94772345678',
      isActive: true,
      roles: { create: { roleId: cashierRole.id } }
    }
  });

  const pharmacistUser = await prisma.user.upsert({
    where: { username: 'pharmacist' },
    update: { passwordHash: defaultPharmPass },
    create: {
      username: 'pharmacist',
      email: 'pharmacist@pharmasys.lk',
      passwordHash: defaultPharmPass,
      fullName: 'Dr. Ruwan Pathirana (SLMC 12450)',
      phone: '+94779876543',
      isActive: true,
      roles: { create: { roleId: pharmacistRole.id } }
    }
  });

  console.log('   -> Users created: admin, manager, cashier, pharmacist');

  // -------------------------------------------------------------
  // 3. CATEGORIES
  // -------------------------------------------------------------
  console.log('\n[3/13] Seeding Medicine Therapeutic Categories...');
  const categoryData = [
    { name: 'Antibiotics & Anti-Infectives', code: 'ANTIBIOTICS', description: 'Oral and injectable antibacterial formulations' },
    { name: 'Analgesics & Antipyretics', code: 'ANALGESICS', description: 'Pain relievers and fever reducers' },
    { name: 'Cardiovascular & Antihypertensives', code: 'CARDIO', description: 'Blood pressure, cardiac, and statin medications' },
    { name: 'Antidiabetic Agents', code: 'ANTIDIABETIC', description: 'Insulins and oral hypoglycemic agents' },
    { name: 'Gastrointestinal & Antacids', code: 'GASTRO', description: 'Proton pump inhibitors, H2 blockers, and antacids' },
    { name: 'Respiratory & Antihistamines', code: 'RESPIRATORY', description: 'Asthma inhalers, cough syrups, and anti-allergics' },
    { name: 'Vitamins & Nutritional Supplements', code: 'SUPPLEMENTS', description: 'Multivitamins, minerals, and tonics' },
    { name: 'Dermatology & Topical Preparations', code: 'DERMA', description: 'Antifungal, steroid, and antibiotic creams' },
    { name: 'Controlled & Narcotic Substances', code: 'NARCOTICS', description: 'Schedule II & III controlled analgesics' }
  ];

  const catMap: Record<string, bigint> = {};
  for (const cat of categoryData) {
    const record = await prisma.category.upsert({
      where: { code: cat.code },
      update: { name: cat.name, description: cat.description },
      create: { name: cat.name, code: cat.code, description: cat.description, isActive: true }
    });
    catMap[cat.code] = record.id;
  }

  // -------------------------------------------------------------
  // 4. MANUFACTURERS
  // -------------------------------------------------------------
  console.log('\n[4/13] Seeding Pharmaceutical Manufacturers...');
  const manufacturerData = [
    { name: 'GlaxoSmithKline (GSK) Pharmaceuticals', country: 'United Kingdom', contactPhone: '+44 20 8047 5000' },
    { name: 'Cipla Limited', country: 'India', contactPhone: '+91 22 2482 6000' },
    { name: 'Sun Pharma Laboratories Ltd', country: 'India', contactPhone: '+91 22 4324 4324' },
    { name: 'Astron Limited Sri Lanka', country: 'Sri Lanka', contactPhone: '+94 11 263 6441' },
    { name: 'State Pharmaceuticals Manufacturing Corporation (SPMC)', country: 'Sri Lanka', contactPhone: '+94 11 285 0374' },
    { name: 'Pfizer Pharmaceuticals', country: 'United States', contactPhone: '+1 212 733 2323' },
    { name: 'Bayer Healthcare AG', country: 'Germany', contactPhone: '+49 214 301' }
  ];

  const mfgMap: Record<string, bigint> = {};
  for (const m of manufacturerData) {
    const record = await prisma.manufacturer.upsert({
      where: { name: m.name },
      update: { country: m.country, contactPhone: m.contactPhone },
      create: { name: m.name, country: m.country, contactPhone: m.contactPhone, isActive: true }
    });
    mfgMap[m.name] = record.id;
  }

  // -------------------------------------------------------------
  // 5. GENERIC MOLECULES
  // -------------------------------------------------------------
  console.log('\n[5/13] Seeding Generic Molecules...');
  const genericData = [
    { name: 'Paracetamol', therapeuticClass: 'Analgesic / Antipyretic' },
    { name: 'Amoxicillin + Clavulanic Acid', therapeuticClass: 'Penicillin / Beta-lactamase inhibitor' },
    { name: 'Metformin Hydrochloride', therapeuticClass: 'Biguanide Oral Antidiabetic' },
    { name: 'Atorvastatin Calcium', therapeuticClass: 'HMG-CoA Reductase Inhibitor (Statin)' },
    { name: 'Losartan Potassium', therapeuticClass: 'Angiotensin Receptor Blocker (ARB)' },
    { name: 'Omeprazole', therapeuticClass: 'Proton Pump Inhibitor (PPI)' },
    { name: 'Salbutamol Sulfate', therapeuticClass: 'Short-acting Beta-2 Agonist' },
    { name: 'Cetirizine Dihydrochloride', therapeuticClass: 'Second-generation Antihistamine' },
    { name: 'Ciprofloxacin HCl', therapeuticClass: 'Fluoroquinolone Antibacterial' },
    { name: 'Tramadol Hydrochloride', therapeuticClass: 'Synthetic Opioid Analgesic' },
    { name: 'Amlodipine Besylate', therapeuticClass: 'Calcium Channel Blocker' },
    { name: 'Gliclazide', therapeuticClass: 'Sulfonylurea Antidiabetic' },
    { name: 'Dextromethorphan + Chlorpheniramine', therapeuticClass: 'Antitussive / Antihistamine Syrup' },
    { name: 'Ascorbic Acid (Vitamin C) 500mg', therapeuticClass: 'Water-soluble Vitamin' },
    { name: 'Clotrimazole 1%', therapeuticClass: 'Broad-spectrum Topical Antifungal' },
    { name: 'Azithromycin Dihydrate', therapeuticClass: 'Macrolide Antibiotic' },
    { name: 'Doxycycline Hyclate', therapeuticClass: 'Tetracycline Antibiotic' },
    { name: 'Cefixime Trihydrate', therapeuticClass: 'Third-generation Cephalosporin' }
  ];

  const genMap: Record<string, bigint> = {};
  for (const g of genericData) {
    const record = await prisma.genericMolecule.upsert({
      where: { name: g.name },
      update: { therapeuticClass: g.therapeuticClass },
      create: { name: g.name, therapeuticClass: g.therapeuticClass }
    });
    genMap[g.name] = record.id;
  }

  // -------------------------------------------------------------
  // 6. SUPPLIERS
  // -------------------------------------------------------------
  console.log('\n[6/13] Seeding Suppliers with Credit Limits & Payment Terms...');
  const suppliers = [
    {
      name: 'Hemas Pharmaceuticals PLC',
      contactPerson: 'Mr. Samantha Silva (Area Sales Head)',
      phone: '0112445566',
      email: 'orders@hemaspharma.com',
      address: 'Hemas Building, York Street, Colombo 01',
      paymentTerms: '30 Days Credit',
      creditLimit: 1500000,
      currentBalance: 0
    },
    {
      name: 'George Steuart Health (Pvt) Ltd',
      contactPerson: 'Ms. Nilanthi Perera',
      phone: '0114702500',
      email: 'pharma@georgesteuart.lk',
      address: 'No. 19, St. Michael\'s Road, Colombo 03',
      paymentTerms: '30 Days Credit',
      creditLimit: 1200000,
      currentBalance: 7750
    },
    {
      name: 'State Pharmaceuticals Corporation (SPC)',
      contactPerson: 'Mr. K.B. Bandara',
      phone: '0112320356',
      email: 'procurement@spc.lk',
      address: '75 Sir Baron Jayatilaka Mw, Colombo 01',
      paymentTerms: '14 Days Net',
      creditLimit: 800000,
      currentBalance: 0
    },
    {
      name: 'A. Baur & Co. (Pvt) Ltd',
      contactPerson: 'Mrs. K. Jayasuriya',
      phone: '0112448899',
      email: 'healthcare@baurs.com',
      address: '62 Jethawana Road, Grandpass, Colombo 14',
      paymentTerms: '30 Days Credit',
      creditLimit: 1000000,
      currentBalance: 0
    },
    {
      name: 'CIC Holdings PLC Healthcare Division',
      contactPerson: 'Mr. Rohan Wickramasinghe',
      phone: '0112359359',
      email: 'pharma.sales@cic.lk',
      address: '199 Kew Road, Colombo 02',
      paymentTerms: '45 Days Credit',
      creditLimit: 2000000,
      currentBalance: 0
    }
  ];

  const supplierMap: Record<string, bigint> = {};
  for (let i = 0; i < suppliers.length; i++) {
    const s = suppliers[i];
    const sup = await prisma.supplier.upsert({
      where: { id: BigInt(i + 1) },
      update: {
        name: s.name,
        contactPerson: s.contactPerson,
        phone: s.phone,
        email: s.email,
        address: s.address,
        paymentTerms: s.paymentTerms,
        creditLimit: new Prisma.Decimal(s.creditLimit),
        currentBalance: new Prisma.Decimal(s.currentBalance)
      },
      create: {
        name: s.name,
        contactPerson: s.contactPerson,
        phone: s.phone,
        email: s.email,
        address: s.address,
        paymentTerms: s.paymentTerms,
        creditLimit: new Prisma.Decimal(s.creditLimit),
        currentBalance: new Prisma.Decimal(s.currentBalance),
        isActive: true
      }
    });
    supplierMap[s.name] = sup.id;
  }

  // -------------------------------------------------------------
  // 7. MEDICINES, PACKAGING UNITS & REALISTIC FEFO BATCHES
  // -------------------------------------------------------------
  console.log('\n[7/13] Seeding Comprehensive Sri Lankan Medicine Inventory & Batches...');

  const dateDaysFromNow = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d;
  };

  const medicineDefinitions = [
    {
      name: 'Paracetamol 500mg Tablets',
      brandName: 'Panadol',
      genericKey: 'Paracetamol',
      mfgKey: 'GlaxoSmithKline (GSK) Pharmaceuticals',
      categoryCode: 'ANALGESICS',
      barcode: '4792012001015',
      skuCode: 'MED-PAN-500',
      strength: '500mg',
      dosageForm: DosageForm.TABLET,
      baseUnit: 'tablet',
      prescriptionRequired: false,
      isNarcotic: false,
      reorderLevel: 100,
      storageCondition: 'Store below 30°C in dry place',
      costPrice: 4.50,
      sellingPrice: 7.00,
      units: [
        { unitName: 'Strip', factor: 10, barcode: '4792012001022' },
        { unitName: 'Box', factor: 100, barcode: '4792012001039' }
      ],
      batches: [
        { batchNumber: 'PAN-2026-A1', mfgDate: new Date('2025-08-01'), expiryDate: dateDaysFromNow(540), quantity: 850, status: BatchStatus.ACTIVE, cost: 4.50, sell: 7.00 },
        { batchNumber: 'PAN-2025-X4', mfgDate: new Date('2024-04-10'), expiryDate: dateDaysFromNow(22), quantity: 120, status: BatchStatus.NEAR_EXPIRY, cost: 4.20, sell: 6.50 }
      ]
    },
    {
      name: 'Amoxicillin + Clavulanate 625mg Tablets',
      brandName: 'Augmentin 625mg',
      genericKey: 'Amoxicillin + Clavulanic Acid',
      mfgKey: 'GlaxoSmithKline (GSK) Pharmaceuticals',
      categoryCode: 'ANTIBIOTICS',
      barcode: '4792012002012',
      skuCode: 'MED-AUG-625',
      strength: '625mg',
      dosageForm: DosageForm.TABLET,
      baseUnit: 'tablet',
      prescriptionRequired: true,
      isNarcotic: false,
      reorderLevel: 50,
      storageCondition: 'Store in airtight blister below 25°C',
      costPrice: 145.00,
      sellingPrice: 195.00,
      units: [
        { unitName: 'Strip (7s)', factor: 7, barcode: '4792012002039' },
        { unitName: 'Box (14s)', factor: 14, barcode: '4792012002046' }
      ],
      batches: [
        { batchNumber: 'AUG-2026-01', mfgDate: new Date('2025-10-15'), expiryDate: dateDaysFromNow(420), quantity: 280, status: BatchStatus.ACTIVE, cost: 145.00, sell: 195.00 }
      ]
    },
    {
      name: 'Metformin Hydrochloride 500mg Tablets',
      brandName: 'Glucophage 500mg',
      genericKey: 'Metformin Hydrochloride',
      mfgKey: 'Sun Pharma Laboratories Ltd',
      categoryCode: 'ANTIDIABETIC',
      barcode: '4792012003039',
      skuCode: 'MED-GLU-500',
      strength: '500mg',
      dosageForm: DosageForm.TABLET,
      baseUnit: 'tablet',
      prescriptionRequired: true,
      isNarcotic: false,
      reorderLevel: 150,
      storageCondition: 'Store below 25°C',
      costPrice: 6.50,
      sellingPrice: 11.00,
      units: [
        { unitName: 'Strip', factor: 10, barcode: '4792012003046' },
        { unitName: 'Box', factor: 100, barcode: '4792012003053' }
      ],
      batches: [
        { batchNumber: 'GLU-2026-M1', mfgDate: new Date('2025-11-01'), expiryDate: dateDaysFromNow(600), quantity: 1200, status: BatchStatus.ACTIVE, cost: 6.50, sell: 11.00 },
        { batchNumber: 'GLU-2025-E2', mfgDate: new Date('2024-06-15'), expiryDate: dateDaysFromNow(28), quantity: 150, status: BatchStatus.NEAR_EXPIRY, cost: 6.00, sell: 10.00 }
      ]
    },
    {
      name: 'Atorvastatin Calcium 20mg Tablets',
      brandName: 'Lipitor 20mg',
      genericKey: 'Atorvastatin Calcium',
      mfgKey: 'Pfizer Pharmaceuticals',
      categoryCode: 'CARDIO',
      barcode: '4792012004046',
      skuCode: 'MED-LIP-20',
      strength: '20mg',
      dosageForm: DosageForm.TABLET,
      baseUnit: 'tablet',
      prescriptionRequired: true,
      isNarcotic: false,
      reorderLevel: 60,
      storageCondition: 'Store at 20°C to 25°C',
      costPrice: 36.00,
      sellingPrice: 54.00,
      units: [
        { unitName: 'Strip', factor: 10, barcode: '4792012004053' },
        { unitName: 'Box (30s)', factor: 30, barcode: '4792012004060' }
      ],
      batches: [
        { batchNumber: 'LIP-2026-S1', mfgDate: new Date('2025-09-01'), expiryDate: dateDaysFromNow(480), quantity: 420, status: BatchStatus.ACTIVE, cost: 36.00, sell: 54.00 }
      ]
    },
    {
      name: 'Losartan Potassium 50mg Film-Coated Tablets',
      brandName: 'Losartan Stada 50mg',
      genericKey: 'Losartan Potassium',
      mfgKey: 'Astron Limited Sri Lanka',
      categoryCode: 'CARDIO',
      barcode: '4792012005053',
      skuCode: 'MED-LOS-50',
      strength: '50mg',
      dosageForm: DosageForm.TABLET,
      baseUnit: 'tablet',
      prescriptionRequired: true,
      isNarcotic: false,
      reorderLevel: 80,
      storageCondition: 'Protect from light and moisture',
      costPrice: 14.00,
      sellingPrice: 22.00,
      units: [
        { unitName: 'Strip (14s)', factor: 14, barcode: '4792012005060' },
        { unitName: 'Box (28s)', factor: 28, barcode: '4792012005077' }
      ],
      batches: [
        { batchNumber: 'LOS-2026-K1', mfgDate: new Date('2025-07-20'), expiryDate: dateDaysFromNow(510), quantity: 560, status: BatchStatus.ACTIVE, cost: 14.00, sell: 22.00 }
      ]
    },
    {
      name: 'Omeprazole 20mg Delayed-Release Capsules',
      brandName: 'Omez 20mg',
      genericKey: 'Omeprazole',
      mfgKey: 'Cipla Limited',
      categoryCode: 'GASTRO',
      barcode: '4792012006060',
      skuCode: 'MED-OMZ-20',
      strength: '20mg',
      dosageForm: DosageForm.CAPSULE,
      baseUnit: 'capsule',
      prescriptionRequired: false,
      isNarcotic: false,
      reorderLevel: 100,
      storageCondition: 'Store in original container below 25°C',
      costPrice: 13.00,
      sellingPrice: 21.00,
      units: [
        { unitName: 'Strip', factor: 10, barcode: '4792012006077' },
        { unitName: 'Box', factor: 100, barcode: '4792012006084' }
      ],
      batches: [
        { batchNumber: 'OMZ-2026-P2', mfgDate: new Date('2025-10-01'), expiryDate: dateDaysFromNow(450), quantity: 900, status: BatchStatus.ACTIVE, cost: 13.00, sell: 21.00 }
      ]
    },
    {
      name: 'Salbutamol Inhaler 100mcg (200 Doses)',
      brandName: 'Ventolin Evohaler',
      genericKey: 'Salbutamol Sulfate',
      mfgKey: 'GlaxoSmithKline (GSK) Pharmaceuticals',
      categoryCode: 'RESPIRATORY',
      barcode: '4792012007074',
      skuCode: 'MED-VENT-100',
      strength: '100mcg/actuation',
      dosageForm: DosageForm.INHALER,
      baseUnit: 'inhaler',
      prescriptionRequired: true,
      isNarcotic: false,
      reorderLevel: 20,
      storageCondition: 'Store below 30°C. Protect from frost and direct sunlight.',
      costPrice: 1280.00,
      sellingPrice: 1650.00,
      units: [],
      batches: [
        { batchNumber: 'VEN-2026-V1', mfgDate: new Date('2025-09-10'), expiryDate: dateDaysFromNow(390), quantity: 45, status: BatchStatus.ACTIVE, cost: 1280.00, sell: 1650.00 }
      ]
    },
    {
      name: 'Cetirizine Dihydrochloride 10mg Tablets',
      brandName: 'Zyrtec 10mg',
      genericKey: 'Cetirizine Dihydrochloride',
      mfgKey: 'Astron Limited Sri Lanka',
      categoryCode: 'RESPIRATORY',
      barcode: '4792012008081',
      skuCode: 'MED-ZYR-10',
      strength: '10mg',
      dosageForm: DosageForm.TABLET,
      baseUnit: 'tablet',
      prescriptionRequired: false,
      isNarcotic: false,
      reorderLevel: 75,
      storageCondition: 'Store below 25°C',
      costPrice: 7.00,
      sellingPrice: 13.00,
      units: [
        { unitName: 'Strip', factor: 10, barcode: '4792012008098' },
        { unitName: 'Box', factor: 100, barcode: '4792012008104' }
      ],
      batches: [
        { batchNumber: 'ZYR-2026-C1', mfgDate: new Date('2025-11-20'), expiryDate: dateDaysFromNow(660), quantity: 600, status: BatchStatus.ACTIVE, cost: 7.00, sell: 13.00 }
      ]
    },
    {
      name: 'Ciprofloxacin 500mg Tablets',
      brandName: 'Ciprobid 500mg',
      genericKey: 'Ciprofloxacin HCl',
      mfgKey: 'Cipla Limited',
      categoryCode: 'ANTIBIOTICS',
      barcode: '4792012009095',
      skuCode: 'MED-CIP-500',
      strength: '500mg',
      dosageForm: DosageForm.TABLET,
      baseUnit: 'tablet',
      prescriptionRequired: true,
      isNarcotic: false,
      reorderLevel: 50,
      storageCondition: 'Store in dry place below 25°C',
      costPrice: 24.00,
      sellingPrice: 38.00,
      units: [
        { unitName: 'Strip', factor: 10, barcode: '4792012009101' },
        { unitName: 'Box', factor: 50, barcode: '4792012009118' }
      ],
      batches: [
        { batchNumber: 'CIP-2026-R4', mfgDate: new Date('2025-08-15'), expiryDate: dateDaysFromNow(410), quantity: 350, status: BatchStatus.ACTIVE, cost: 24.00, sell: 38.00 }
      ]
    },
    {
      name: 'Tramadol HCl 50mg Capsules (Controlled Substance)',
      brandName: 'Tramal 50mg',
      genericKey: 'Tramadol Hydrochloride',
      mfgKey: 'State Pharmaceuticals Manufacturing Corporation (SPMC)',
      categoryCode: 'NARCOTICS',
      barcode: '4792012010107',
      skuCode: 'MED-TRA-50',
      strength: '50mg',
      dosageForm: DosageForm.CAPSULE,
      baseUnit: 'capsule',
      prescriptionRequired: true,
      isNarcotic: true,
      reorderLevel: 40,
      storageCondition: 'Schedule II Narcotics Safe Lock Box',
      costPrice: 22.00,
      sellingPrice: 35.00,
      units: [
        { unitName: 'Strip', factor: 10, barcode: '4792012010114' }
      ],
      batches: [
        { batchNumber: 'TRM-2026-N1', mfgDate: new Date('2025-10-05'), expiryDate: dateDaysFromNow(490), quantity: 180, status: BatchStatus.ACTIVE, cost: 22.00, sell: 35.00 }
      ]
    },
    {
      name: 'Amlodipine Besylate 5mg Tablets',
      brandName: 'Norvasc 5mg',
      genericKey: 'Amlodipine Besylate',
      mfgKey: 'Pfizer Pharmaceuticals',
      categoryCode: 'CARDIO',
      barcode: '4792012011111',
      skuCode: 'MED-NOR-5',
      strength: '5mg',
      dosageForm: DosageForm.TABLET,
      baseUnit: 'tablet',
      prescriptionRequired: true,
      isNarcotic: false,
      reorderLevel: 60,
      storageCondition: 'Store below 30°C',
      costPrice: 16.00,
      sellingPrice: 26.00,
      units: [
        { unitName: 'Strip (14s)', factor: 14, barcode: '4792012011128' },
        { unitName: 'Box (28s)', factor: 28, barcode: '4792012011135' }
      ],
      batches: [
        { batchNumber: 'NOR-2026-A5', mfgDate: new Date('2025-09-25'), expiryDate: dateDaysFromNow(520), quantity: 400, status: BatchStatus.ACTIVE, cost: 16.00, sell: 26.00 }
      ]
    },
    {
      name: 'Gliclazide Modified-Release 60mg Tablets',
      brandName: 'Diamicron MR 60mg',
      genericKey: 'Gliclazide',
      mfgKey: 'Astron Limited Sri Lanka',
      categoryCode: 'ANTIDIABETIC',
      barcode: '4792012012125',
      skuCode: 'MED-DIA-60',
      strength: '60mg',
      dosageForm: DosageForm.TABLET,
      baseUnit: 'tablet',
      prescriptionRequired: true,
      isNarcotic: false,
      reorderLevel: 50,
      storageCondition: 'Store below 25°C',
      costPrice: 26.00,
      sellingPrice: 40.00,
      units: [
        { unitName: 'Strip (15s)', factor: 15, barcode: '4792012012132' },
        { unitName: 'Box (60s)', factor: 60, barcode: '4792012012149' }
      ],
      batches: [
        { batchNumber: 'DIA-2026-G2', mfgDate: new Date('2025-10-18'), expiryDate: dateDaysFromNow(580), quantity: 360, status: BatchStatus.ACTIVE, cost: 26.00, sell: 40.00 }
      ]
    },
    {
      name: 'Corex D Cough & Cold Syrup 100ml',
      brandName: 'Corex D Syrup',
      genericKey: 'Dextromethorphan + Chlorpheniramine',
      mfgKey: 'Pfizer Pharmaceuticals',
      categoryCode: 'RESPIRATORY',
      barcode: '4792012013139',
      skuCode: 'MED-COR-100',
      strength: '100ml Bottle',
      dosageForm: DosageForm.SYRUP,
      baseUnit: 'bottle',
      prescriptionRequired: false,
      isNarcotic: false,
      reorderLevel: 25,
      storageCondition: 'Protect from sunlight. Do not freeze.',
      costPrice: 410.00,
      sellingPrice: 560.00,
      units: [],
      batches: [
        { batchNumber: 'COR-2026-S3', mfgDate: new Date('2025-07-15'), expiryDate: dateDaysFromNow(365), quantity: 85, status: BatchStatus.ACTIVE, cost: 410.00, sell: 560.00 }
      ]
    },
    {
      name: 'Cebion Vitamin C 500mg Chewable Tablets (Orange)',
      brandName: 'Cebion Orange 500mg',
      genericKey: 'Ascorbic Acid (Vitamin C) 500mg',
      mfgKey: 'Bayer Healthcare AG',
      categoryCode: 'SUPPLEMENTS',
      barcode: '4792012014143',
      skuCode: 'MED-CEB-500',
      strength: '500mg',
      dosageForm: DosageForm.TABLET,
      baseUnit: 'tablet',
      prescriptionRequired: false,
      isNarcotic: false,
      reorderLevel: 80,
      storageCondition: 'Store below 25°C in dry container',
      costPrice: 9.00,
      sellingPrice: 16.00,
      units: [
        { unitName: 'Strip', factor: 10, barcode: '4792012014150' },
        { unitName: 'Box', factor: 100, barcode: '4792012014167' }
      ],
      batches: [
        { batchNumber: 'CEB-2026-V8', mfgDate: new Date('2025-11-05'), expiryDate: dateDaysFromNow(550), quantity: 750, status: BatchStatus.ACTIVE, cost: 9.00, sell: 16.00 }
      ]
    },
    {
      name: 'Canesten 1% Topical Antifungal Cream 20g',
      brandName: 'Canesten Cream 20g',
      genericKey: 'Clotrimazole 1%',
      mfgKey: 'Bayer Healthcare AG',
      categoryCode: 'DERMA',
      barcode: '4792012015157',
      skuCode: 'MED-CAN-20',
      strength: '1% w/w 20g',
      dosageForm: DosageForm.CREAM,
      baseUnit: 'tube',
      prescriptionRequired: false,
      isNarcotic: false,
      reorderLevel: 20,
      storageCondition: 'Store below 25°C',
      costPrice: 320.00,
      sellingPrice: 460.00,
      units: [],
      batches: [
        { batchNumber: 'CAN-2026-T1', mfgDate: new Date('2025-08-25'), expiryDate: dateDaysFromNow(460), quantity: 60, status: BatchStatus.ACTIVE, cost: 320.00, sell: 460.00 }
      ]
    },
    // LOW STOCK SAMPLE: Azithromycin 500mg (Triggers Low Stock Notification Pill!)
    {
      name: 'Azithromycin 500mg Film-Coated Tablets',
      brandName: 'Zithromax 500mg',
      genericKey: 'Azithromycin Dihydrate',
      mfgKey: 'Pfizer Pharmaceuticals',
      categoryCode: 'ANTIBIOTICS',
      barcode: '4792012016161',
      skuCode: 'MED-AZI-500',
      strength: '500mg',
      dosageForm: DosageForm.TABLET,
      baseUnit: 'tablet',
      prescriptionRequired: true,
      isNarcotic: false,
      reorderLevel: 50,
      storageCondition: 'Store below 30°C',
      costPrice: 110.00,
      sellingPrice: 165.00,
      units: [
        { unitName: 'Strip (3s)', factor: 3, barcode: '4792012016178' }
      ],
      batches: [
        { batchNumber: 'AZI-2026-LOW', mfgDate: new Date('2025-09-01'), expiryDate: dateDaysFromNow(380), quantity: 15, status: BatchStatus.ACTIVE, cost: 110.00, sell: 165.00 }
      ]
    },
    // EXPIRED LOT SAMPLE: Doxycycline 100mg (Triggers Expired alert & FEFO safety lockout!)
    {
      name: 'Doxycycline 100mg Capsules',
      brandName: 'Doxypal 100mg',
      genericKey: 'Doxycycline Hyclate',
      mfgKey: 'State Pharmaceuticals Manufacturing Corporation (SPMC)',
      categoryCode: 'ANTIBIOTICS',
      barcode: '4792012017175',
      skuCode: 'MED-DOX-100',
      strength: '100mg',
      dosageForm: DosageForm.CAPSULE,
      baseUnit: 'capsule',
      prescriptionRequired: true,
      isNarcotic: false,
      reorderLevel: 40,
      storageCondition: 'Protect from light and moisture',
      costPrice: 12.00,
      sellingPrice: 20.00,
      units: [],
      batches: [
        { batchNumber: 'DOX-2024-EXP', mfgDate: new Date('2023-01-10'), expiryDate: dateDaysFromNow(-45), quantity: 40, status: BatchStatus.EXPIRED, cost: 12.00, sell: 20.00 }
      ]
    },
    // QUARANTINED LOT SAMPLE: Cefixime 200mg (Damaged in transit / QC Hold)
    {
      name: 'Cefixime 200mg Dispersible Tablets',
      brandName: 'Cefspan 200mg',
      genericKey: 'Cefixime Trihydrate',
      mfgKey: 'Cipla Limited',
      categoryCode: 'ANTIBIOTICS',
      barcode: '4792012018189',
      skuCode: 'MED-CEF-200',
      strength: '200mg',
      dosageForm: DosageForm.TABLET,
      baseUnit: 'tablet',
      prescriptionRequired: true,
      isNarcotic: false,
      reorderLevel: 30,
      storageCondition: 'Store below 25°C in airtight foil',
      costPrice: 75.00,
      sellingPrice: 115.00,
      units: [],
      batches: [
        { batchNumber: 'CEF-2026-Q1', mfgDate: new Date('2025-06-10'), expiryDate: dateDaysFromNow(300), quantity: 25, status: BatchStatus.QUARANTINED, cost: 75.00, sell: 115.00 }
      ]
    }
  ];

  const batchMap: Record<string, bigint> = {};
  const medMap: Record<string, bigint> = {};

  // Resolve any conflicting barcodes from previous initial seeds
  for (const m of medicineDefinitions) {
    if (m.barcode) {
      const conflict = await prisma.medicine.findFirst({
        where: { barcode: m.barcode, NOT: { skuCode: m.skuCode } }
      });
      if (conflict) {
        await prisma.medicine.update({
          where: { id: conflict.id },
          data: { barcode: null }
        });
      }
    }
  }

  for (const m of medicineDefinitions) {
    const existingMed = await prisma.medicine.findFirst({
      where: {
        OR: [
          { skuCode: m.skuCode },
          ...(m.barcode ? [{ barcode: m.barcode }] : [])
        ]
      }
    });

    let med;
    if (existingMed) {
      med = await prisma.medicine.update({
        where: { id: existingMed.id },
        data: {
          name: m.name,
          brandName: m.brandName,
          barcode: m.barcode,
          skuCode: m.skuCode,
          categoryId: catMap[m.categoryCode],
          manufacturerId: mfgMap[m.mfgKey],
          genericId: genMap[m.genericKey],
          strength: m.strength,
          dosageForm: m.dosageForm,
          baseUnit: m.baseUnit,
          prescriptionRequired: m.prescriptionRequired,
          isNarcotic: m.isNarcotic,
          reorderLevel: new Prisma.Decimal(m.reorderLevel),
          storageCondition: m.storageCondition,
          isActive: true
        }
      });
    } else {
      med = await prisma.medicine.create({
        data: {
          name: m.name,
          brandName: m.brandName,
          barcode: m.barcode,
          skuCode: m.skuCode,
          categoryId: catMap[m.categoryCode],
          manufacturerId: mfgMap[m.mfgKey],
          genericId: genMap[m.genericKey],
          strength: m.strength,
          dosageForm: m.dosageForm,
          baseUnit: m.baseUnit,
          prescriptionRequired: m.prescriptionRequired,
          isNarcotic: m.isNarcotic,
          reorderLevel: new Prisma.Decimal(m.reorderLevel),
          storageCondition: m.storageCondition,
          isActive: true
        }
      });
    }

    medMap[m.skuCode] = med.id;

    // Seed packaging units
    for (const u of m.units) {
      if (u.barcode) {
        const conflictUnit = await prisma.medicineUnit.findFirst({
          where: { barcode: u.barcode, NOT: { medicineId: med.id, unitName: u.unitName } }
        });
        if (conflictUnit) {
          await prisma.medicineUnit.update({
            where: { id: conflictUnit.id },
            data: { barcode: null }
          });
        }
      }

      await prisma.medicineUnit.upsert({
        where: {
          uk_medicine_unit: {
            medicineId: med.id,
            unitName: u.unitName
          }
        },
        update: {
          baseUnitFactor: new Prisma.Decimal(u.factor),
          barcode: u.barcode,
          isSellable: true
        },
        create: {
          medicineId: med.id,
          unitName: u.unitName,
          baseUnitFactor: new Prisma.Decimal(u.factor),
          barcode: u.barcode,
          isSellable: true
        }
      });
    }

    // Seed Batches
    for (const b of m.batches) {
      const batchRecord = await prisma.medicineBatch.upsert({
        where: {
          uk_medicine_batch: {
            medicineId: med.id,
            batchNumber: b.batchNumber
          }
        },
        update: {
          expiryDate: b.expiryDate,
          mfgDate: b.mfgDate,
          costPrice: new Prisma.Decimal(b.cost),
          sellingPrice: new Prisma.Decimal(b.sell),
          quantityOnHand: new Prisma.Decimal(b.quantity),
          status: b.status
        },
        create: {
          medicineId: med.id,
          batchNumber: b.batchNumber,
          mfgDate: b.mfgDate,
          expiryDate: b.expiryDate,
          costPrice: new Prisma.Decimal(b.cost),
          sellingPrice: new Prisma.Decimal(b.sell),
          quantityOnHand: new Prisma.Decimal(b.quantity),
          status: b.status
        }
      });

      batchMap[b.batchNumber] = batchRecord.id;

      // Seed Initial Stock Movement Ledger Entry for this batch
      const existingMovement = await prisma.stockMovement.findFirst({
        where: { batchId: batchRecord.id, referenceType: 'INITIAL_GRN' }
      });

      if (!existingMovement) {
        await prisma.stockMovement.create({
          data: {
            batchId: batchRecord.id,
            movementType: MovementType.PURCHASE,
            quantityDelta: new Prisma.Decimal(b.quantity),
            balanceAfter: new Prisma.Decimal(b.quantity),
            referenceType: 'INITIAL_GRN',
            referenceId: BigInt(1),
            userId: adminUser.id,
            note: `Initial opening inventory stock batch ${b.batchNumber}`,
            createdAt: b.mfgDate || new Date()
          }
        });
      }
    }
  }

  console.log(`   -> Seeded ${medicineDefinitions.length} medicines, packaging units, and active FEFO batches.`);

  // -------------------------------------------------------------
  // 8. PURCHASE ORDERS & GRN INVOICES
  // -------------------------------------------------------------
  console.log('\n[8/13] Seeding Completed Procurement GRNs & Supplier Payments...');
  const existingPO1 = await prisma.purchase.findUnique({ where: { purchaseNumber: 'GRN-2026-0001' } });
  if (!existingPO1) {
    const hemasSupplierId = supplierMap['Hemas Pharmaceuticals PLC'];
    const augBatchId = batchMap['AUG-2026-01'];
    const panBatchId = batchMap['PAN-2026-A1'];
    const augMedId = medMap['MED-AUG-625'];
    const panMedId = medMap['MED-PAN-500'];

    const po1 = await prisma.purchase.create({
      data: {
        purchaseNumber: 'GRN-2026-0001',
        supplierId: hemasSupplierId,
        supplierInvoiceNo: 'HEM-INV-88912',
        status: PurchaseStatus.RECEIVED,
        subtotal: new Prisma.Decimal(45250.00),
        discountAmount: new Prisma.Decimal(0.00),
        taxAmount: new Prisma.Decimal(0.00),
        totalAmount: new Prisma.Decimal(45250.00),
        amountPaid: new Prisma.Decimal(45250.00),
        createdBy: adminUser.id,
        receivedAt: new Date(),
        items: {
          create: [
            {
              medicineId: augMedId,
              batchId: augBatchId,
              batchNumber: 'AUG-2026-01',
              expiryDate: dateDaysFromNow(420),
              orderedQuantity: new Prisma.Decimal(200),
              receivedQuantity: new Prisma.Decimal(200),
              bonusQuantity: new Prisma.Decimal(10), // 10 Free bonus tablets
              unitCost: new Prisma.Decimal(145.00),
              sellingPrice: new Prisma.Decimal(195.00),
              lineTotal: new Prisma.Decimal(29000.00)
            },
            {
              medicineId: panMedId,
              batchId: panBatchId,
              batchNumber: 'PAN-2026-A1',
              expiryDate: dateDaysFromNow(540),
              orderedQuantity: new Prisma.Decimal(3500),
              receivedQuantity: new Prisma.Decimal(3500),
              bonusQuantity: new Prisma.Decimal(100),
              unitCost: new Prisma.Decimal(4.50),
              sellingPrice: new Prisma.Decimal(7.00),
              lineTotal: new Prisma.Decimal(15750.00)
            }
          ]
        }
      }
    });

    await prisma.supplierPayment.create({
      data: {
        paymentNumber: 'SPAY-2026-0001',
        supplierId: hemasSupplierId,
        purchaseId: po1.id,
        amount: new Prisma.Decimal(45250.00),
        paymentMethod: SupplierPayMethod.BANK_TRANSFER,
        paymentReference: 'COMB-FT-20260312-998',
        paidAt: new Date(),
        createdBy: managerUser.id
      }
    });
    console.log('   -> Seeded GRN-2026-0001 with supplier payment');
  }

  // -------------------------------------------------------------
  // 9. CUSTOMERS, CLINICAL PATIENTS & PRESCRIPTIONS
  // -------------------------------------------------------------
  console.log('\n[9/13] Seeding Customers, Clinical Patients (Allergies/Conditions) & Prescriptions...');
  const customerData = [
    {
      name: 'K.A. Nimal Perera',
      phone: '0771234567',
      email: 'nimal.perera@gmail.com',
      address: 'No. 45/2, Temple Road, Maharagama',
      whatsappConsent: true,
      patient: {
        name: 'K.A. Nimal Perera',
        age: 58,
        gender: Gender.MALE,
        allergies: 'Penicillin (Urticaria/Rash)',
        conditions: 'Type 2 Diabetes Mellitus, Essential Hypertension'
      },
      prescription: {
        code: 'RX-2026-0089',
        doctorName: 'Dr. Asela Ratnayake (MBBS, MD)',
        doctorSlmcNo: 'SLMC-24150',
        notes: 'Glucophage 500mg 1 tab bd pc, Losartan 50mg 1 tab mane'
      }
    },
    {
      name: 'M. Sunethra Silva',
      phone: '0719876543',
      email: 'sunethra.silva@yahoo.com',
      address: '12 Lake Drive, Rajagiriya',
      whatsappConsent: true,
      patient: {
        name: 'M. Sunethra Silva',
        age: 46,
        gender: Gender.FEMALE,
        allergies: 'Sulfa drugs, Aspirin',
        conditions: 'Bronchial Asthma, Dyslipidemia'
      },
      prescription: {
        code: 'RX-2026-0095',
        doctorName: 'Dr. Priyantha Senaratne (MBBS, MRCP)',
        doctorSlmcNo: 'SLMC-18920',
        notes: 'Ventolin Evohaler 2 puffs prn, Cetirizine 10mg nocte'
      }
    },
    {
      name: 'Mohamed Rilwan',
      phone: '0768822334',
      email: 'm.rilwan@gmail.com',
      address: '88 Main Street, Dehiwala',
      whatsappConsent: true,
      patient: {
        name: 'Mohamed Rilwan',
        age: 64,
        gender: Gender.MALE,
        allergies: 'NKDA (No Known Drug Allergies)',
        conditions: 'Ischemic Heart Disease, Dyslipidemia'
      }
    },
    {
      name: 'Walk-in Cash Customer',
      phone: '0700000000',
      whatsappConsent: false
    }
  ];

  const custMap: Record<string, bigint> = {};
  const rxMap: Record<string, bigint> = {};

  for (const c of customerData) {
    const cust = await prisma.customer.upsert({
      where: { phone: c.phone },
      update: {
        name: c.name,
        email: c.email,
        address: c.address,
        whatsappConsent: c.whatsappConsent,
        consentAt: c.whatsappConsent ? new Date() : null
      },
      create: {
        name: c.name,
        phone: c.phone,
        email: c.email,
        address: c.address,
        outstandingBalance: new Prisma.Decimal(0),
        whatsappConsent: c.whatsappConsent,
        consentAt: c.whatsappConsent ? new Date() : null
      }
    });

    custMap[c.name] = cust.id;

    if (c.patient) {
      let patient = await prisma.patient.findFirst({
        where: { customerId: cust.id }
      });

      if (!patient) {
        patient = await prisma.patient.create({
          data: {
            customerId: cust.id,
            fullName: c.patient.name,
            age: c.patient.age,
            gender: c.patient.gender,
            knownAllergies: c.patient.allergies,
            chronicConditions: c.patient.conditions
          }
        });
      }

      if (c.prescription && patient) {
        const rx = await prisma.prescription.upsert({
          where: { prescriptionCode: c.prescription.code },
          update: {
            status: PrescriptionStatus.DISPENSED,
            dispensedRefills: 1
          },
          create: {
            prescriptionCode: c.prescription.code,
            patientId: patient.id,
            doctorName: c.prescription.doctorName,
            doctorSlmcNo: c.prescription.doctorSlmcNo,
            prescriptionDate: new Date(),
            status: PrescriptionStatus.DISPENSED,
            totalRefills: 3,
            dispensedRefills: 1,
            clinicalNotes: c.prescription.notes
          }
        });
        rxMap[c.prescription.code] = rx.id;
      }
    }
  }

  // -------------------------------------------------------------
  // 10. CASH SESSIONS (Past Closed & Active Open)
  // -------------------------------------------------------------
  console.log('\n[10/13] Seeding Daily Cash Sessions (Closed Shift & Active Open Shift)...');
  const pastSessionDate = new Date();
  pastSessionDate.setDate(pastSessionDate.getDate() - 1);

  // Past Closed Session
  let closedSession = await prisma.cashSession.findFirst({
    where: { status: SessionStatus.CLOSED }
  });

  if (!closedSession) {
    closedSession = await prisma.cashSession.create({
      data: {
        userId: cashierUser.id,
        openingFloat: new Prisma.Decimal(5000.00),
        closingAmount: new Prisma.Decimal(28450.00),
        expectedAmount: new Prisma.Decimal(28450.00),
        variance: new Prisma.Decimal(0.00),
        status: SessionStatus.CLOSED,
        notes: 'Shift balanced accurately. Daily cash reconciled without variance.',
        openedAt: pastSessionDate,
        closedAt: pastSessionDate
      }
    });
  }

  // Active Open Session for Cashier
  let openSession = await prisma.cashSession.findFirst({
    where: { userId: cashierUser.id, status: SessionStatus.OPEN }
  });

  if (!openSession) {
    openSession = await prisma.cashSession.create({
      data: {
        userId: cashierUser.id,
        openingFloat: new Prisma.Decimal(5000.00),
        expectedAmount: new Prisma.Decimal(6050.00),
        status: SessionStatus.OPEN,
        notes: 'Counter 01 Morning Session open and actively serving POS transactions.',
        openedAt: new Date()
      }
    });
  }

  console.log(`   -> Active Open Cash Session ID: ${openSession.id} (Opening Float: LKR 5,000.00)`);

  // -------------------------------------------------------------
  // 11. POS SALES TRANSACTIONS, INVOICES & PAYMENTS
  // -------------------------------------------------------------
  console.log('\n[11/13] Seeding Realistic Retail Sales Invoices & Ceylon LankaPay/Card/Cash Payments...');

  // Sale 1: Dispensed Prescription to Nimal Perera (Glucophage + Losartan + Panadol)
  const existingSale1 = await prisma.sale.findUnique({ where: { invoiceNumber: 'INV-2026-0001' } });
  if (!existingSale1) {
    const sale1 = await prisma.sale.create({
      data: {
        invoiceNumber: 'INV-2026-0001',
        idempotencyKey: 'IDEMP-INV-2026-0001',
        cashSessionId: closedSession.id,
        customerId: custMap['K.A. Nimal Perera'],
        prescriptionId: rxMap['RX-2026-0089'],
        cashierId: cashierUser.id,
        status: SaleStatus.COMPLETED,
        subtotal: new Prisma.Decimal(1460.00),
        discountAmount: new Prisma.Decimal(60.00), // LKR 60 senior citizen discount
        taxAmount: new Prisma.Decimal(0.00),
        grandTotal: new Prisma.Decimal(1400.00),
        amountPaid: new Prisma.Decimal(1500.00),
        changeAmount: new Prisma.Decimal(100.00),
        reprintCount: 0,
        createdAt: pastSessionDate,
        items: {
          create: [
            {
              medicineId: medMap['MED-GLU-500'],
              batchId: batchMap['GLU-2026-M1'],
              quantity: new Prisma.Decimal(60),
              unitPrice: new Prisma.Decimal(11.00),
              unitCostSnapshot: new Prisma.Decimal(6.50),
              discountAmount: new Prisma.Decimal(20.00),
              lineTotal: new Prisma.Decimal(640.00)
            },
            {
              medicineId: medMap['MED-LOS-50'],
              batchId: batchMap['LOS-2026-K1'],
              quantity: new Prisma.Decimal(30),
              unitPrice: new Prisma.Decimal(22.00),
              unitCostSnapshot: new Prisma.Decimal(14.00),
              discountAmount: new Prisma.Decimal(20.00),
              lineTotal: new Prisma.Decimal(640.00)
            },
            {
              medicineId: medMap['MED-PAN-500'],
              batchId: batchMap['PAN-2026-A1'],
              quantity: new Prisma.Decimal(20),
              unitPrice: new Prisma.Decimal(7.00),
              unitCostSnapshot: new Prisma.Decimal(4.50),
              discountAmount: new Prisma.Decimal(20.00),
              lineTotal: new Prisma.Decimal(120.00)
            }
          ]
        },
        payments: {
          create: {
            paymentMethod: PaymentMethod.CASH,
            amount: new Prisma.Decimal(1400.00),
            referenceCode: 'CASH-REC-001',
            status: PaymentStatus.SUCCESS
          }
        }
      }
    });

    // Record Stock Movement Outflows
    await prisma.stockMovement.create({
      data: {
        batchId: batchMap['GLU-2026-M1'],
        movementType: MovementType.SALE,
        quantityDelta: new Prisma.Decimal(-60),
        balanceAfter: new Prisma.Decimal(1140),
        referenceType: 'SALE',
        referenceId: sale1.id,
        userId: cashierUser.id,
        note: 'Dispensed on INV-2026-0001 (Prescription RX-2026-0089)'
      }
    });

    await prisma.stockMovement.create({
      data: {
        batchId: batchMap['LOS-2026-K1'],
        movementType: MovementType.SALE,
        quantityDelta: new Prisma.Decimal(-30),
        balanceAfter: new Prisma.Decimal(530),
        referenceType: 'SALE',
        referenceId: sale1.id,
        userId: cashierUser.id,
        note: 'Dispensed on INV-2026-0001'
      }
    });

    console.log('   -> Seeded INV-2026-0001 (LKR 1,400.00 - Cash)');
  }

  // Sale 2: Credit Card Sale to Sunethra Silva (Ventolin + Zyrtec + Cebion)
  const existingSale2 = await prisma.sale.findUnique({ where: { invoiceNumber: 'INV-2026-0002' } });
  if (!existingSale2) {
    await prisma.sale.create({
      data: {
        invoiceNumber: 'INV-2026-0002',
        idempotencyKey: 'IDEMP-INV-2026-0002',
        cashSessionId: closedSession.id,
        customerId: custMap['M. Sunethra Silva'],
        prescriptionId: rxMap['RX-2026-0095'],
        cashierId: cashierUser.id,
        status: SaleStatus.COMPLETED,
        subtotal: new Prisma.Decimal(2360.00),
        discountAmount: new Prisma.Decimal(0.00),
        taxAmount: new Prisma.Decimal(0.00),
        grandTotal: new Prisma.Decimal(2360.00),
        amountPaid: new Prisma.Decimal(2360.00),
        changeAmount: new Prisma.Decimal(0.00),
        reprintCount: 0,
        createdAt: pastSessionDate,
        items: {
          create: [
            {
              medicineId: medMap['MED-VENT-100'],
              batchId: batchMap['VEN-2026-V1'],
              quantity: new Prisma.Decimal(1),
              unitPrice: new Prisma.Decimal(1650.00),
              unitCostSnapshot: new Prisma.Decimal(1280.00),
              discountAmount: new Prisma.Decimal(0.00),
              lineTotal: new Prisma.Decimal(1650.00)
            },
            {
              medicineId: medMap['MED-ZYR-10'],
              batchId: batchMap['ZYR-2026-C1'],
              quantity: new Prisma.Decimal(30),
              unitPrice: new Prisma.Decimal(13.00),
              unitCostSnapshot: new Prisma.Decimal(7.00),
              discountAmount: new Prisma.Decimal(0.00),
              lineTotal: new Prisma.Decimal(390.00)
            },
            {
              medicineId: medMap['MED-CEB-500'],
              batchId: batchMap['CEB-2026-V8'],
              quantity: new Prisma.Decimal(20),
              unitPrice: new Prisma.Decimal(16.00),
              unitCostSnapshot: new Prisma.Decimal(9.00),
              discountAmount: new Prisma.Decimal(0.00),
              lineTotal: new Prisma.Decimal(320.00)
            }
          ]
        },
        payments: {
          create: {
            paymentMethod: PaymentMethod.CREDIT_CARD,
            amount: new Prisma.Decimal(2360.00),
            referenceCode: 'TXN-VISA-88219-COMM',
            status: PaymentStatus.SUCCESS
          }
        }
      }
    });
    console.log('   -> Seeded INV-2026-0002 (LKR 2,360.00 - Credit Card)');
  }

  // Sale 3: LankaPay QR Digital Payment (Today's Open Session)
  const existingSale3 = await prisma.sale.findUnique({ where: { invoiceNumber: 'INV-2026-0003' } });
  if (!existingSale3) {
    await prisma.sale.create({
      data: {
        invoiceNumber: 'INV-2026-0003',
        idempotencyKey: 'IDEMP-INV-2026-0003',
        cashSessionId: openSession.id,
        customerId: custMap['Walk-in Cash Customer'],
        cashierId: cashierUser.id,
        status: SaleStatus.COMPLETED,
        subtotal: new Prisma.Decimal(1050.00),
        discountAmount: new Prisma.Decimal(0.00),
        taxAmount: new Prisma.Decimal(0.00),
        grandTotal: new Prisma.Decimal(1050.00),
        amountPaid: new Prisma.Decimal(1050.00),
        changeAmount: new Prisma.Decimal(0.00),
        reprintCount: 0,
        createdAt: new Date(),
        items: {
          create: [
            {
              medicineId: medMap['MED-OMZ-20'],
              batchId: batchMap['OMZ-2026-P2'],
              quantity: new Prisma.Decimal(20),
              unitPrice: new Prisma.Decimal(21.00),
              unitCostSnapshot: new Prisma.Decimal(13.00),
              discountAmount: new Prisma.Decimal(0.00),
              lineTotal: new Prisma.Decimal(420.00)
            },
            {
              medicineId: medMap['MED-COR-100'],
              batchId: batchMap['COR-2026-S3'],
              quantity: new Prisma.Decimal(1),
              unitPrice: new Prisma.Decimal(560.00),
              unitCostSnapshot: new Prisma.Decimal(410.00),
              discountAmount: new Prisma.Decimal(0.00),
              lineTotal: new Prisma.Decimal(560.00)
            },
            {
              medicineId: medMap['MED-PAN-500'],
              batchId: batchMap['PAN-2026-A1'],
              quantity: new Prisma.Decimal(10),
              unitPrice: new Prisma.Decimal(7.00),
              unitCostSnapshot: new Prisma.Decimal(4.50),
              discountAmount: new Prisma.Decimal(0.00),
              lineTotal: new Prisma.Decimal(70.00)
            }
          ]
        },
        payments: {
          create: {
            paymentMethod: PaymentMethod.LANKAPAY_QR,
            amount: new Prisma.Decimal(1050.00),
            referenceCode: 'LQR-REF-99210-CEY',
            status: PaymentStatus.SUCCESS
          }
        }
      }
    });
    console.log('   -> Seeded INV-2026-0003 (LKR 1,050.00 - LankaPay QR)');
  }

  // Sale 4 & Return: Partially Refunded Sale with Restock Ledger
  const existingSale4 = await prisma.sale.findUnique({ where: { invoiceNumber: 'INV-2026-0004' } });
  if (!existingSale4) {
    const sale4 = await prisma.sale.create({
      data: {
        invoiceNumber: 'INV-2026-0004',
        idempotencyKey: 'IDEMP-INV-2026-0004',
        cashSessionId: closedSession.id,
        customerId: custMap['Mohamed Rilwan'],
        cashierId: cashierUser.id,
        status: SaleStatus.PARTIALLY_REFUNDED,
        subtotal: new Prisma.Decimal(2080.00),
        discountAmount: new Prisma.Decimal(0.00),
        taxAmount: new Prisma.Decimal(0.00),
        grandTotal: new Prisma.Decimal(2080.00),
        amountPaid: new Prisma.Decimal(2100.00),
        changeAmount: new Prisma.Decimal(20.00),
        reprintCount: 0,
        createdAt: pastSessionDate,
        items: {
          create: [
            {
              medicineId: medMap['MED-LIP-20'],
              batchId: batchMap['LIP-2026-S1'],
              quantity: new Prisma.Decimal(30),
              unitPrice: new Prisma.Decimal(54.00),
              unitCostSnapshot: new Prisma.Decimal(36.00),
              discountAmount: new Prisma.Decimal(0.00),
              lineTotal: new Prisma.Decimal(1620.00)
            },
            {
              medicineId: medMap['MED-CAN-20'],
              batchId: batchMap['CAN-2026-T1'],
              quantity: new Prisma.Decimal(1),
              unitPrice: new Prisma.Decimal(460.00),
              unitCostSnapshot: new Prisma.Decimal(320.00),
              discountAmount: new Prisma.Decimal(0.00),
              lineTotal: new Prisma.Decimal(460.00)
            }
          ]
        },
        payments: {
          create: {
            paymentMethod: PaymentMethod.CASH,
            amount: new Prisma.Decimal(2080.00),
            referenceCode: 'CASH-REC-004',
            status: PaymentStatus.SUCCESS
          }
        }
      }
    });

    const returnItemRecord = await prisma.saleItem.findFirst({
      where: { saleId: sale4.id, medicineId: medMap['MED-CAN-20'] }
    });

    if (returnItemRecord) {
      await prisma.salesReturn.create({
        data: {
          returnNumber: 'RET-2026-0001',
          saleId: sale4.id,
          reason: 'Customer mistakenly selected ointment instead of cream. Sealed packaging verified.',
          refundTotal: new Prisma.Decimal(460.00),
          refundMethod: RefundMethod.CASH,
          processedBy: cashierUser.id,
          approvedBy: managerUser.id,
          returnItems: {
            create: {
              saleItemId: returnItemRecord.id,
              batchId: batchMap['CAN-2026-T1'],
              returnQuantity: new Prisma.Decimal(1),
              refundAmount: new Prisma.Decimal(460.00),
              restockStatus: RestockStatus.RESTOCKED
            }
          }
        }
      });

      // Restock ledger movement
      await prisma.stockMovement.create({
        data: {
          batchId: batchMap['CAN-2026-T1'],
          movementType: MovementType.SALE_RETURN,
          quantityDelta: new Prisma.Decimal(1),
          balanceAfter: new Prisma.Decimal(60),
          referenceType: 'SALE_RETURN',
          referenceId: sale4.id,
          userId: cashierUser.id,
          note: 'Restocked return from RET-2026-0001'
        }
      });
      console.log('   -> Seeded Return RET-2026-0001 (LKR 460.00 Restocked to inventory)');
    }
  }

  // -------------------------------------------------------------
  // 12. OPERATING EXPENSES
  // -------------------------------------------------------------
  console.log('\n[12/13] Seeding Operational Expenses & Petty Cash Logs...');
  const expenseCategories = [
    'Utilities (Electricity, Water, Internet)',
    'Shop Premises Rent & Maintenance',
    'Staff Salaries & Overtime Wages',
    'Packaging, Carry Bags & Thermal Rolls',
    'NMRA License & Legal Regulatory Fees',
    'Bank Terminal Fees & Merchant Surcharges'
  ];

  const expCatMap: Record<string, bigint> = {};
  for (const exp of expenseCategories) {
    const c = await prisma.expenseCategory.upsert({
      where: { name: exp },
      update: {},
      create: { name: exp }
    });
    expCatMap[exp] = c.id;
  }

  const sampleExpenses = [
    {
      category: 'Utilities (Electricity, Water, Internet)',
      amount: 18450.00,
      description: 'CEB Commercial Electricity Bill (February/March billing cycle)',
      date: new Date('2026-03-05')
    },
    {
      category: 'Utilities (Electricity, Water, Internet)',
      amount: 4800.00,
      description: 'SLT Fibre 100Mbps Broadband & Static IP monthly bill',
      date: new Date('2026-03-08')
    },
    {
      category: 'Packaging, Carry Bags & Thermal Rolls',
      amount: 6250.00,
      description: '50 Rolls of 80mm High-Sensitivity BPA-Free Thermal POS Paper',
      date: new Date('2026-03-10')
    },
    {
      category: 'Packaging, Carry Bags & Thermal Rolls',
      amount: 3500.00,
      description: '1,000 Pcs Eco-friendly Biodegradable Medicine Dispensing Bags',
      date: new Date('2026-03-11'),
      cashSessionId: closedSession.id
    },
    {
      category: 'NMRA License & Legal Regulatory Fees',
      amount: 15000.00,
      description: 'NMRA Annual Retail Pharmacy License Renewal & Inspection Levy',
      date: new Date('2026-03-01')
    }
  ];

  for (const e of sampleExpenses) {
    const existing = await prisma.expense.findFirst({
      where: { description: e.description }
    });
    if (!existing) {
      await prisma.expense.create({
        data: {
          categoryId: expCatMap[e.category],
          cashSessionId: e.cashSessionId || null,
          amount: new Prisma.Decimal(e.amount),
          description: e.description,
          createdBy: managerUser.id,
          expenseDate: e.date
        }
      });
    }
  }
  console.log('   -> Seeded operational expense records and petty cash vouchers');

  // -------------------------------------------------------------
  // 13. WHATSAPP NOTIFICATION LOGS & PHARMACY SETTINGS
  // -------------------------------------------------------------
  console.log('\n[13/13] Seeding WhatsApp Delivery Logs & Pharmacy Settings...');

  const notificationSamples = [
    {
      customerName: 'K.A. Nimal Perera',
      phone: '94771234567',
      template: 'prescription_refill_reminder',
      status: NotificationStatus.DELIVERED,
      payload: { medicine: 'Glucophage 500mg', daysRemaining: 3, rxCode: 'RX-2026-0089' },
      providerId: 'wamid.HBgMOTE3NzEyMzQ1NjcVAhIAEhgWM0E4OTFFOTkz'
    },
    {
      customerName: 'M. Sunethra Silva',
      phone: '94719876543',
      template: 'digital_invoice_receipt',
      status: NotificationStatus.READ,
      payload: { invoiceNo: 'INV-2026-0002', totalAmount: 'LKR 2,360.00' },
      providerId: 'wamid.HBgMOTE3MTk4NzY1NDMVAhIAEhgWM0E4OTFFOTk0'
    },
    {
      customerName: 'Mohamed Rilwan',
      phone: '94768822334',
      template: 'health_wellness_tip',
      status: NotificationStatus.SENT,
      payload: { topic: 'Monitoring Blood Pressure at Home', advice: 'Take readings at the same time each morning.' },
      providerId: 'wamid.HBgMOTE3Njg4MjIzMzQVAhIAEhgWM0E4OTFFOTk1'
    }
  ];

  for (const n of notificationSamples) {
    const custId = custMap[n.customerName];
    const existing = await prisma.notificationLog.findFirst({
      where: { providerMessageId: n.providerId }
    });
    if (!existing) {
      await prisma.notificationLog.create({
        data: {
          customerId: custId,
          channel: NotificationChannel.WHATSAPP,
          recipientPhone: n.phone,
          templateName: n.template,
          payload: n.payload,
          providerMessageId: n.providerId,
          status: n.status,
          sentAt: new Date()
        }
      });
    }
  }

  // System Settings
  const settings = [
    { key: 'PHARMACY_NAME', value: process.env.PHARMACY_NAME || 'PharmaSys Retail Pharmacy', desc: 'Registered Trading Name' },
    { key: 'PHARMACY_ADDRESS', value: process.env.PHARMACY_ADDRESS || '124 Galle Road, Colombo 03, Sri Lanka', desc: 'Physical Location' },
    { key: 'PHARMACY_PHONE', value: process.env.PHARMACY_PHONE || '+94 11 234 5678', desc: 'Hotline / WhatsApp Support' },
    { key: 'PHARMACY_EMAIL', value: process.env.PHARMACY_EMAIL || 'info@pharmasys.lk', desc: 'Primary Contact Email' },
    { key: 'PHARMACY_SLMC_NO', value: process.env.PHARMACY_SLMC_NO || 'SLMC-PH-2024-8891', desc: 'Pharmacy Registration Certificate Number' },
    { key: 'PHARMACY_TIN', value: process.env.PHARMACY_TAX_NO || 'TIN-409182390', desc: 'Inland Revenue Department Tax Identification' },
    { key: 'RECEIPT_PRINTER_WIDTH', value: process.env.DEFAULT_RECEIPT_WIDTH || '80mm', desc: 'Thermal Roll Width (58mm / 80mm)' },
    { key: 'RECEIPT_HEADER_NOTE', value: process.env.RECEIPT_HEADER_NOTE || 'Trust in Care & Wellness', desc: 'Receipt Header Banner' },
    { key: 'RECEIPT_FOOTER_NOTE', value: process.env.RECEIPT_FOOTER_NOTE || 'Thank you for your visit. Get well soon!\nMedicines once dispensed cannot be returned unless recalled.\nCustomer Care Hotline: 011 234 5678', desc: 'Receipt Footer Terms' },
    { key: 'DEFAULT_CURRENCY', value: process.env.DEFAULT_CURRENCY || 'LKR', desc: 'Operational Base Currency' },
    { key: 'DEFAULT_TIMEZONE', value: process.env.DEFAULT_TIMEZONE || 'Asia/Colombo', desc: 'Standard Local Timezone' }
  ];

  for (const s of settings) {
    await prisma.pharmacySetting.upsert({
      where: { settingKey: s.key },
      update: { settingValue: s.value, description: s.desc },
      create: { settingKey: s.key, settingValue: s.value, description: s.desc }
    });
  }

  console.log('\n================================================================');
  console.log('   PharmaSys ERP Database Seeding Completed with 100% Success!  ');
  console.log('================================================================\n');
}

main()
  .catch((e) => {
    console.error('Seeding error encountered:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
