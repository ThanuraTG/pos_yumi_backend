import 'dotenv/config';
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

// Helper to compute dates relative to today
export const dateDaysFromNow = (days: number): Date => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
};

// ============================================================================
// 1. MOCK STAFF ACCOUNTS
// ============================================================================
export const mockStaffUsers = [
  {
    username: 'manager',
    email: 'manager@pharmasys.lk',
    password: 'Manager@123456',
    fullName: 'Kamal Gunaratne (Pharmacy Manager)',
    phone: '+94773344556',
    roleName: 'PHARMACY_MANAGER'
  },
  {
    username: 'cashier',
    email: 'cashier@pharmasys.lk',
    password: 'Cashier@123456',
    fullName: 'Nimali Fernando (Cashier 01)',
    phone: '+94772345678',
    roleName: 'CASHIER'
  },
  {
    username: 'pharmacist',
    email: 'pharmacist@pharmasys.lk',
    password: 'Pharm@123456',
    fullName: 'Dr. Ruwan Pathirana (SLMC 12450)',
    phone: '+94779876543',
    roleName: 'PHARMACIST'
  }
];

// ============================================================================
// 2. MOCK SUPPLIERS (Distributors in Sri Lanka)
// ============================================================================
export const mockSuppliers = [
  {
    id: 1,
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
    id: 2,
    name: 'George Steuart Health (Pvt) Ltd',
    contactPerson: 'Ms. Nilanthi Perera',
    phone: '0114702500',
    email: 'pharma@georgesteuart.lk',
    address: "No. 19, St. Michael's Road, Colombo 03",
    paymentTerms: '30 Days Credit',
    creditLimit: 1200000,
    currentBalance: 7750
  },
  {
    id: 3,
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
    id: 4,
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
    id: 5,
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

// ============================================================================
// 3. MOCK MEDICINES, BATCHES & PACKAGING UNITS
// ============================================================================
export const mockMedicines = [
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
    costPrice: 4.5,
    sellingPrice: 7.0,
    units: [
      { unitName: 'Strip', factor: 10, barcode: '4792012001022' },
      { unitName: 'Box', factor: 100, barcode: '4792012001039' }
    ],
    batches: [
      { batchNumber: 'PAN-2026-A1', mfgDate: new Date('2025-08-01'), expiryDate: dateDaysFromNow(540), quantity: 850, status: BatchStatus.ACTIVE, cost: 4.5, sell: 7.0 },
      { batchNumber: 'PAN-2025-X4', mfgDate: new Date('2024-04-10'), expiryDate: dateDaysFromNow(22), quantity: 120, status: BatchStatus.NEAR_EXPIRY, cost: 4.2, sell: 6.5 }
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
    costPrice: 145.0,
    sellingPrice: 195.0,
    units: [
      { unitName: 'Strip (7s)', factor: 7, barcode: '4792012002039' },
      { unitName: 'Box (14s)', factor: 14, barcode: '4792012002046' }
    ],
    batches: [
      { batchNumber: 'AUG-2026-01', mfgDate: new Date('2025-10-15'), expiryDate: dateDaysFromNow(420), quantity: 280, status: BatchStatus.ACTIVE, cost: 145.0, sell: 195.0 }
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
    costPrice: 6.5,
    sellingPrice: 11.0,
    units: [
      { unitName: 'Strip', factor: 10, barcode: '4792012003046' },
      { unitName: 'Box', factor: 100, barcode: '4792012003053' }
    ],
    batches: [
      { batchNumber: 'GLU-2026-M1', mfgDate: new Date('2025-11-01'), expiryDate: dateDaysFromNow(600), quantity: 1200, status: BatchStatus.ACTIVE, cost: 6.5, sell: 11.0 },
      { batchNumber: 'GLU-2025-E2', mfgDate: new Date('2024-06-15'), expiryDate: dateDaysFromNow(28), quantity: 150, status: BatchStatus.NEAR_EXPIRY, cost: 6.0, sell: 10.0 }
    ]
  },
  {
    name: 'Atorvastatin Calcium 20mg Tablets',
    brandName: 'Lipitor 20mg',
    genericKey: 'Atorvastatin Calcium',
    mfgKey: 'Pfizer Pharmaceuticals',
    categoryCode: 'CARDIOVASCULAR',
    barcode: '4792012004046',
    skuCode: 'MED-LIP-20',
    strength: '20mg',
    dosageForm: DosageForm.TABLET,
    baseUnit: 'tablet',
    prescriptionRequired: true,
    isNarcotic: false,
    reorderLevel: 60,
    storageCondition: 'Store at 20°C to 25°C',
    costPrice: 36.0,
    sellingPrice: 54.0,
    units: [
      { unitName: 'Strip', factor: 10, barcode: '4792012004053' },
      { unitName: 'Box (30s)', factor: 30, barcode: '4792012004060' }
    ],
    batches: [
      { batchNumber: 'LIP-2026-S1', mfgDate: new Date('2025-09-01'), expiryDate: dateDaysFromNow(480), quantity: 420, status: BatchStatus.ACTIVE, cost: 36.0, sell: 54.0 }
    ]
  },
  {
    name: 'Losartan Potassium 50mg Film-Coated Tablets',
    brandName: 'Losartan Stada 50mg',
    genericKey: 'Losartan Potassium',
    mfgKey: 'Astron Limited Sri Lanka',
    categoryCode: 'ANTIHYPERTENSIVES',
    barcode: '4792012005053',
    skuCode: 'MED-LOS-50',
    strength: '50mg',
    dosageForm: DosageForm.TABLET,
    baseUnit: 'tablet',
    prescriptionRequired: true,
    isNarcotic: false,
    reorderLevel: 80,
    storageCondition: 'Protect from light and moisture',
    costPrice: 14.0,
    sellingPrice: 22.0,
    units: [
      { unitName: 'Strip (14s)', factor: 14, barcode: '4792012005060' },
      { unitName: 'Box (28s)', factor: 28, barcode: '4792012005077' }
    ],
    batches: [
      { batchNumber: 'LOS-2026-K1', mfgDate: new Date('2025-07-20'), expiryDate: dateDaysFromNow(510), quantity: 560, status: BatchStatus.ACTIVE, cost: 14.0, sell: 22.0 }
    ]
  },
  {
    name: 'Omeprazole 20mg Delayed-Release Capsules',
    brandName: 'Omez 20mg',
    genericKey: 'Omeprazole',
    mfgKey: 'Cipla Limited',
    categoryCode: 'GASTROINTESTINAL',
    barcode: '4792012006060',
    skuCode: 'MED-OMZ-20',
    strength: '20mg',
    dosageForm: DosageForm.CAPSULE,
    baseUnit: 'capsule',
    prescriptionRequired: false,
    isNarcotic: false,
    reorderLevel: 100,
    storageCondition: 'Store in original container below 25°C',
    costPrice: 13.0,
    sellingPrice: 21.0,
    units: [
      { unitName: 'Strip', factor: 10, barcode: '4792012006077' },
      { unitName: 'Box', factor: 100, barcode: '4792012006084' }
    ],
    batches: [
      { batchNumber: 'OMZ-2026-P2', mfgDate: new Date('2025-10-01'), expiryDate: dateDaysFromNow(450), quantity: 900, status: BatchStatus.ACTIVE, cost: 13.0, sell: 21.0 }
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
    costPrice: 1280.0,
    sellingPrice: 1650.0,
    units: [],
    batches: [
      { batchNumber: 'VEN-2026-V1', mfgDate: new Date('2025-09-10'), expiryDate: dateDaysFromNow(390), quantity: 45, status: BatchStatus.ACTIVE, cost: 1280.0, sell: 1650.0 }
    ]
  },
  {
    name: 'Cetirizine Dihydrochloride 10mg Tablets',
    brandName: 'Zyrtec 10mg',
    genericKey: 'Cetirizine Dihydrochloride',
    mfgKey: 'Astron Limited Sri Lanka',
    categoryCode: 'ANTIHISTAMINES',
    barcode: '4792012008081',
    skuCode: 'MED-ZYR-10',
    strength: '10mg',
    dosageForm: DosageForm.TABLET,
    baseUnit: 'tablet',
    prescriptionRequired: false,
    isNarcotic: false,
    reorderLevel: 75,
    storageCondition: 'Store below 25°C',
    costPrice: 7.0,
    sellingPrice: 13.0,
    units: [
      { unitName: 'Strip', factor: 10, barcode: '4792012008098' },
      { unitName: 'Box', factor: 100, barcode: '4792012008104' }
    ],
    batches: [
      { batchNumber: 'ZYR-2026-C1', mfgDate: new Date('2025-11-20'), expiryDate: dateDaysFromNow(660), quantity: 600, status: BatchStatus.ACTIVE, cost: 7.0, sell: 13.0 }
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
    costPrice: 24.0,
    sellingPrice: 38.0,
    units: [
      { unitName: 'Strip', factor: 10, barcode: '4792012009101' },
      { unitName: 'Box', factor: 50, barcode: '4792012009118' }
    ],
    batches: [
      { batchNumber: 'CIP-2026-R4', mfgDate: new Date('2025-08-15'), expiryDate: dateDaysFromNow(410), quantity: 350, status: BatchStatus.ACTIVE, cost: 24.0, sell: 38.0 }
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
    costPrice: 22.0,
    sellingPrice: 35.0,
    units: [
      { unitName: 'Strip', factor: 10, barcode: '4792012010114' }
    ],
    batches: [
      { batchNumber: 'TRM-2026-N1', mfgDate: new Date('2025-10-05'), expiryDate: dateDaysFromNow(490), quantity: 180, status: BatchStatus.ACTIVE, cost: 22.0, sell: 35.0 }
    ]
  },
  {
    name: 'Amlodipine Besylate 5mg Tablets',
    brandName: 'Norvasc 5mg',
    genericKey: 'Amlodipine Besylate',
    mfgKey: 'Pfizer Pharmaceuticals',
    categoryCode: 'ANTIHYPERTENSIVES',
    barcode: '4792012011111',
    skuCode: 'MED-NOR-5',
    strength: '5mg',
    dosageForm: DosageForm.TABLET,
    baseUnit: 'tablet',
    prescriptionRequired: true,
    isNarcotic: false,
    reorderLevel: 60,
    storageCondition: 'Store below 30°C',
    costPrice: 16.0,
    sellingPrice: 26.0,
    units: [
      { unitName: 'Strip (14s)', factor: 14, barcode: '4792012011128' },
      { unitName: 'Box (28s)', factor: 28, barcode: '4792012011135' }
    ],
    batches: [
      { batchNumber: 'NOR-2026-A5', mfgDate: new Date('2025-09-25'), expiryDate: dateDaysFromNow(520), quantity: 400, status: BatchStatus.ACTIVE, cost: 16.0, sell: 26.0 }
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
    costPrice: 26.0,
    sellingPrice: 40.0,
    units: [
      { unitName: 'Strip (15s)', factor: 15, barcode: '4792012012132' },
      { unitName: 'Box (60s)', factor: 60, barcode: '4792012012149' }
    ],
    batches: [
      { batchNumber: 'DIA-2026-G2', mfgDate: new Date('2025-10-18'), expiryDate: dateDaysFromNow(580), quantity: 360, status: BatchStatus.ACTIVE, cost: 26.0, sell: 40.0 }
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
    costPrice: 410.0,
    sellingPrice: 560.0,
    units: [],
    batches: [
      { batchNumber: 'COR-2026-S3', mfgDate: new Date('2025-07-15'), expiryDate: dateDaysFromNow(365), quantity: 85, status: BatchStatus.ACTIVE, cost: 410.0, sell: 560.0 }
    ]
  },
  {
    name: 'Cebion Vitamin C 500mg Chewable Tablets (Orange)',
    brandName: 'Cebion Orange 500mg',
    genericKey: 'Ascorbic Acid (Vitamin C) 500mg',
    mfgKey: 'Bayer Healthcare AG',
    categoryCode: 'VITAMINS_MINERALS',
    barcode: '4792012014143',
    skuCode: 'MED-CEB-500',
    strength: '500mg',
    dosageForm: DosageForm.TABLET,
    baseUnit: 'tablet',
    prescriptionRequired: false,
    isNarcotic: false,
    reorderLevel: 80,
    storageCondition: 'Store below 25°C in dry container',
    costPrice: 9.0,
    sellingPrice: 16.0,
    units: [
      { unitName: 'Strip', factor: 10, barcode: '4792012014150' },
      { unitName: 'Box', factor: 100, barcode: '4792012014167' }
    ],
    batches: [
      { batchNumber: 'CEB-2026-V8', mfgDate: new Date('2025-11-05'), expiryDate: dateDaysFromNow(550), quantity: 750, status: BatchStatus.ACTIVE, cost: 9.0, sell: 16.0 }
    ]
  },
  {
    name: 'Canesten 1% Topical Antifungal Cream 20g',
    brandName: 'Canesten Cream 20g',
    genericKey: 'Clotrimazole 1%',
    mfgKey: 'Bayer Healthcare AG',
    categoryCode: 'DERMATOLOGY',
    barcode: '4792012015157',
    skuCode: 'MED-CAN-20',
    strength: '1% w/w 20g',
    dosageForm: DosageForm.CREAM,
    baseUnit: 'tube',
    prescriptionRequired: false,
    isNarcotic: false,
    reorderLevel: 20,
    storageCondition: 'Store below 25°C',
    costPrice: 320.0,
    sellingPrice: 460.0,
    units: [],
    batches: [
      { batchNumber: 'CAN-2026-T1', mfgDate: new Date('2025-08-25'), expiryDate: dateDaysFromNow(460), quantity: 60, status: BatchStatus.ACTIVE, cost: 320.0, sell: 460.0 }
    ]
  },
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
    costPrice: 110.0,
    sellingPrice: 165.0,
    units: [
      { unitName: 'Strip (3s)', factor: 3, barcode: '4792012016178' }
    ],
    batches: [
      { batchNumber: 'AZI-2026-LOW', mfgDate: new Date('2025-09-01'), expiryDate: dateDaysFromNow(380), quantity: 15, status: BatchStatus.ACTIVE, cost: 110.0, sell: 165.0 }
    ]
  },
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
    costPrice: 12.0,
    sellingPrice: 20.0,
    units: [],
    batches: [
      { batchNumber: 'DOX-2024-EXP', mfgDate: new Date('2023-01-10'), expiryDate: dateDaysFromNow(-45), quantity: 40, status: BatchStatus.EXPIRED, cost: 12.0, sell: 20.0 }
    ]
  },
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
    costPrice: 75.0,
    sellingPrice: 115.0,
    units: [],
    batches: [
      { batchNumber: 'CEF-2026-Q1', mfgDate: new Date('2025-06-10'), expiryDate: dateDaysFromNow(300), quantity: 25, status: BatchStatus.QUARANTINED, cost: 75.0, sell: 115.0 }
    ]
  }
];

// ============================================================================
// 4. MOCK CUSTOMERS & PATIENTS
// ============================================================================
export const mockCustomers = [
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

// ============================================================================
// 5. MOCK SAMPLE EXPENSES
// ============================================================================
export const mockSampleExpenses = [
  {
    category: 'Utilities (Electricity, Water, Internet)',
    amount: 18450.0,
    description: 'CEB Commercial Electricity Bill (February/March billing cycle)',
    date: new Date('2026-03-05')
  },
  {
    category: 'Utilities (Electricity, Water, Internet)',
    amount: 4800.0,
    description: 'SLT Fibre 100Mbps Broadband & Static IP monthly bill',
    date: new Date('2026-03-08')
  },
  {
    category: 'Packaging, Carry Bags & Thermal Rolls',
    amount: 6250.0,
    description: '50 Rolls of 80mm High-Sensitivity BPA-Free Thermal POS Paper',
    date: new Date('2026-03-10')
  },
  {
    category: 'Packaging, Carry Bags & Thermal Rolls',
    amount: 3500.0,
    description: '1,000 Pcs Eco-friendly Biodegradable Medicine Dispensing Bags',
    date: new Date('2026-03-11'),
    useClosedSession: true
  },
  {
    category: 'NMRA License & Legal Regulatory Fees',
    amount: 15000.0,
    description: 'NMRA Annual Retail Pharmacy License Renewal & Inspection Levy',
    date: new Date('2026-03-01')
  }
];

// ============================================================================
// 6. MOCK WHATSAPP NOTIFICATION LOGS
// ============================================================================
export const mockNotificationLogs = [
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

// ============================================================================
// RUNNABLE SEEDER FUNCTION FOR MOCK TEST DATA
// ============================================================================
export async function seedMockData() {
  console.log('================================================================');
  console.log('   PharmaSys ERP - Seeding Mock Test Data                       ');
  console.log('   (Used for local testing & development demo scenarios)        ');
  console.log('================================================================\n');

  // 1. Staff Users
  console.log('[1/7] Seeding Mock Staff Users...');
  const userMap: Record<string, bigint> = {};
  for (const u of mockStaffUsers) {
    const role = await prisma.role.findUnique({ where: { name: u.roleName } });
    if (!role) {
      console.warn(`Role ${u.roleName} not found. Please run production seed.ts first!`);
      continue;
    }
    const hash = await argon2.hash(u.password);
    const user = await prisma.user.upsert({
      where: { username: u.username },
      update: { passwordHash: hash, fullName: u.fullName, phone: u.phone },
      create: {
        username: u.username,
        email: u.email,
        passwordHash: hash,
        fullName: u.fullName,
        phone: u.phone,
        isActive: true,
        roles: { create: { roleId: role.id } }
      }
    });
    userMap[u.username] = user.id;
  }
  const adminUser = await prisma.user.findFirst({ where: { username: 'admin' } });
  const adminId = adminUser ? adminUser.id : (Object.values(userMap)[0] || BigInt(1));

  // 2. Suppliers
  console.log('\n[2/7] Seeding Mock Suppliers...');
  const supplierMap: Record<string, bigint> = {};
  for (const s of mockSuppliers) {
    const sup = await prisma.supplier.upsert({
      where: { id: BigInt(s.id) },
      update: {
        name: s.name,
        contactPerson: s.contactPerson,
        phone: s.phone,
        email: s.email,
        address: s.address,
        paymentTerms: s.paymentTerms,
        creditLimit: new Prisma.Decimal(s.creditLimit),
        currentBalance: new Prisma.Decimal(s.currentBalance),
        isActive: true
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

  // 3. Medicines, Packaging & Batches
  console.log('\n[3/7] Seeding Mock Medicines & FEFO Batches...');
  const medMap: Record<string, bigint> = {};
  const batchMap: Record<string, bigint> = {};

  for (const m of mockMedicines) {
    // Resolve category, manufacturer, generic
    const cat = await prisma.category.findUnique({ where: { code: m.categoryCode } });
    const mfg = await prisma.manufacturer.findUnique({ where: { name: m.mfgKey } });
    const gen = await prisma.genericMolecule.findUnique({ where: { name: m.genericKey } });

    const existingMed = await prisma.medicine.findFirst({
      where: {
        OR: [
          { skuCode: m.skuCode },
          ...(m.barcode ? [{ barcode: m.barcode }] : [])
        ]
      }
    });

    const medData = {
      name: m.name,
      brandName: m.brandName,
      barcode: m.barcode,
      skuCode: m.skuCode,
      categoryId: cat ? cat.id : null,
      manufacturerId: mfg ? mfg.id : null,
      genericId: gen ? gen.id : null,
      strength: m.strength,
      dosageForm: m.dosageForm,
      baseUnit: m.baseUnit,
      prescriptionRequired: m.prescriptionRequired,
      isNarcotic: m.isNarcotic,
      reorderLevel: new Prisma.Decimal(m.reorderLevel),
      storageCondition: m.storageCondition,
      isActive: true
    };

    let medRecord;
    if (existingMed) {
      medRecord = await prisma.medicine.update({ where: { id: existingMed.id }, data: medData });
    } else {
      medRecord = await prisma.medicine.create({ data: medData });
    }
    medMap[m.skuCode] = medRecord.id;

    // Units
    for (const u of m.units) {
      await prisma.medicineUnit.upsert({
        where: {
          uk_medicine_unit: {
            medicineId: medRecord.id,
            unitName: u.unitName
          }
        },
        update: {
          baseUnitFactor: new Prisma.Decimal(u.factor),
          barcode: u.barcode,
          isSellable: true
        },
        create: {
          medicineId: medRecord.id,
          unitName: u.unitName,
          baseUnitFactor: new Prisma.Decimal(u.factor),
          barcode: u.barcode,
          isSellable: true
        }
      });
    }

    // Batches
    for (const b of m.batches) {
      const batchRecord = await prisma.medicineBatch.upsert({
        where: {
          uk_medicine_batch: {
            medicineId: medRecord.id,
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
          medicineId: medRecord.id,
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
            userId: adminId,
            note: `Initial opening inventory stock batch ${b.batchNumber}`,
            createdAt: b.mfgDate || new Date()
          }
        });
      }
    }
  }

  // 4. Procurement GRN & Supplier Payment
  console.log('\n[4/7] Seeding Mock Procurement GRNs & Supplier Payments...');
  const existingPO = await prisma.purchase.findUnique({ where: { purchaseNumber: 'GRN-2026-0001' } });
  if (!existingPO && supplierMap['Hemas Pharmaceuticals PLC']) {
    const po1 = await prisma.purchase.create({
      data: {
        purchaseNumber: 'GRN-2026-0001',
        supplierId: supplierMap['Hemas Pharmaceuticals PLC'],
        supplierInvoiceNo: 'HEM-INV-88912',
        status: PurchaseStatus.RECEIVED,
        subtotal: new Prisma.Decimal(45250.0),
        discountAmount: new Prisma.Decimal(0.0),
        taxAmount: new Prisma.Decimal(0.0),
        totalAmount: new Prisma.Decimal(45250.0),
        amountPaid: new Prisma.Decimal(45250.0),
        createdBy: adminId,
        receivedAt: new Date(),
        items: {
          create: [
            {
              medicineId: medMap['MED-AUG-625'],
              batchId: batchMap['AUG-2026-01'],
              batchNumber: 'AUG-2026-01',
              expiryDate: dateDaysFromNow(420),
              orderedQuantity: new Prisma.Decimal(200),
              receivedQuantity: new Prisma.Decimal(200),
              bonusQuantity: new Prisma.Decimal(10),
              unitCost: new Prisma.Decimal(145.0),
              sellingPrice: new Prisma.Decimal(195.0),
              lineTotal: new Prisma.Decimal(29000.0)
            },
            {
              medicineId: medMap['MED-PAN-500'],
              batchId: batchMap['PAN-2026-A1'],
              batchNumber: 'PAN-2026-A1',
              expiryDate: dateDaysFromNow(540),
              orderedQuantity: new Prisma.Decimal(3500),
              receivedQuantity: new Prisma.Decimal(3500),
              bonusQuantity: new Prisma.Decimal(100),
              unitCost: new Prisma.Decimal(4.5),
              sellingPrice: new Prisma.Decimal(7.0),
              lineTotal: new Prisma.Decimal(15750.0)
            }
          ]
        }
      }
    });

    await prisma.supplierPayment.create({
      data: {
        paymentNumber: 'SPAY-2026-0001',
        supplierId: supplierMap['Hemas Pharmaceuticals PLC'],
        purchaseId: po1.id,
        amount: new Prisma.Decimal(45250.0),
        paymentMethod: SupplierPayMethod.BANK_TRANSFER,
        paymentReference: 'COMB-FT-20260312-998',
        paidAt: new Date(),
        createdBy: userMap['manager'] || adminId
      }
    });
  }

  // 5. Customers, Clinical Patients & Prescriptions
  console.log('\n[5/7] Seeding Mock Customers, Patients & Prescriptions...');
  const custMap: Record<string, bigint> = {};
  const rxMap: Record<string, bigint> = {};

  for (const c of mockCustomers) {
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
      let patient = await prisma.patient.findFirst({ where: { customerId: cust.id } });
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
          update: { status: PrescriptionStatus.DISPENSED, dispensedRefills: 1 },
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

  // 6. Cash Sessions & Sales Invoices
  console.log('\n[6/7] Seeding Mock Cash Sessions & POS Sales Invoices...');
  const cashierId = userMap['cashier'] || adminId;
  const pastSessionDate = new Date();
  pastSessionDate.setDate(pastSessionDate.getDate() - 1);

  let closedSession = await prisma.cashSession.findFirst({ where: { status: SessionStatus.CLOSED } });
  if (!closedSession) {
    closedSession = await prisma.cashSession.create({
      data: {
        userId: cashierId,
        openingFloat: new Prisma.Decimal(5000.0),
        closingAmount: new Prisma.Decimal(28450.0),
        expectedAmount: new Prisma.Decimal(28450.0),
        variance: new Prisma.Decimal(0.0),
        status: SessionStatus.CLOSED,
        notes: 'Shift balanced accurately. Daily cash reconciled without variance.',
        openedAt: pastSessionDate,
        closedAt: pastSessionDate
      }
    });
  }

  let openSession = await prisma.cashSession.findFirst({ where: { userId: cashierId, status: SessionStatus.OPEN } });
  if (!openSession) {
    openSession = await prisma.cashSession.create({
      data: {
        userId: cashierId,
        openingFloat: new Prisma.Decimal(5000.0),
        expectedAmount: new Prisma.Decimal(6050.0),
        status: SessionStatus.OPEN,
        notes: 'Counter 01 Morning Session open and actively serving POS transactions.',
        openedAt: new Date()
      }
    });
  }

  // Invoices 1, 2, 3, 4
  const existingSale1 = await prisma.sale.findUnique({ where: { invoiceNumber: 'INV-2026-0001' } });
  if (!existingSale1 && medMap['MED-GLU-500']) {
    const sale1 = await prisma.sale.create({
      data: {
        invoiceNumber: 'INV-2026-0001',
        idempotencyKey: 'IDEMP-INV-2026-0001',
        cashSessionId: closedSession.id,
        customerId: custMap['K.A. Nimal Perera'],
        prescriptionId: rxMap['RX-2026-0089'],
        cashierId: cashierId,
        status: SaleStatus.COMPLETED,
        subtotal: new Prisma.Decimal(1460.0),
        discountAmount: new Prisma.Decimal(60.0),
        taxAmount: new Prisma.Decimal(0.0),
        grandTotal: new Prisma.Decimal(1400.0),
        amountPaid: new Prisma.Decimal(1500.0),
        changeAmount: new Prisma.Decimal(100.0),
        reprintCount: 0,
        createdAt: pastSessionDate,
        items: {
          create: [
            {
              medicineId: medMap['MED-GLU-500'],
              batchId: batchMap['GLU-2026-M1'],
              quantity: new Prisma.Decimal(60),
              unitPrice: new Prisma.Decimal(11.0),
              unitCostSnapshot: new Prisma.Decimal(6.5),
              discountAmount: new Prisma.Decimal(20.0),
              lineTotal: new Prisma.Decimal(640.0)
            },
            {
              medicineId: medMap['MED-LOS-50'],
              batchId: batchMap['LOS-2026-K1'],
              quantity: new Prisma.Decimal(30),
              unitPrice: new Prisma.Decimal(22.0),
              unitCostSnapshot: new Prisma.Decimal(14.0),
              discountAmount: new Prisma.Decimal(20.0),
              lineTotal: new Prisma.Decimal(640.0)
            },
            {
              medicineId: medMap['MED-PAN-500'],
              batchId: batchMap['PAN-2026-A1'],
              quantity: new Prisma.Decimal(20),
              unitPrice: new Prisma.Decimal(7.0),
              unitCostSnapshot: new Prisma.Decimal(4.5),
              discountAmount: new Prisma.Decimal(20.0),
              lineTotal: new Prisma.Decimal(120.0)
            }
          ]
        },
        payments: {
          create: {
            paymentMethod: PaymentMethod.CASH,
            amount: new Prisma.Decimal(1400.0),
            referenceCode: 'CASH-REC-001',
            status: PaymentStatus.SUCCESS
          }
        }
      }
    });

    await prisma.stockMovement.create({
      data: {
        batchId: batchMap['GLU-2026-M1'],
        movementType: MovementType.SALE,
        quantityDelta: new Prisma.Decimal(-60),
        balanceAfter: new Prisma.Decimal(1140),
        referenceType: 'SALE',
        referenceId: sale1.id,
        userId: cashierId,
        note: 'Dispensed on INV-2026-0001 (Prescription RX-2026-0089)'
      }
    });
  }

  // 7. Mock Expenses & WhatsApp Logs
  console.log('\n[7/7] Seeding Mock Expenses & WhatsApp Notification Logs...');
  for (const e of mockSampleExpenses) {
    const existing = await prisma.expense.findFirst({ where: { description: e.description } });
    if (!existing) {
      const expCat = await prisma.expenseCategory.findUnique({ where: { name: e.category } });
      if (expCat) {
        await prisma.expense.create({
          data: {
            categoryId: expCat.id,
            cashSessionId: e.useClosedSession ? closedSession.id : null,
            amount: new Prisma.Decimal(e.amount),
            description: e.description,
            createdBy: userMap['manager'] || adminId,
            expenseDate: e.date
          }
        });
      }
    }
  }

  for (const n of mockNotificationLogs) {
    const existing = await prisma.notificationLog.findFirst({ where: { providerMessageId: n.providerId } });
    if (!existing) {
      await prisma.notificationLog.create({
        data: {
          customerId: custMap[n.customerName] || null,
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

  console.log('\n================================================================');
  console.log('   PharmaSys ERP Mock Test Data Successfully Seeded!            ');
  console.log('================================================================\n');
}

// Allow direct CLI execution: npx ts-node prisma/mock_data.ts
if (require.main === module) {
  seedMockData()
    .catch((e) => {
      console.error('Mock data seeding error encountered:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
