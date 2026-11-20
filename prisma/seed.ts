import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('================================================================');
  console.log('   PharmaSys ERP - Production Clean Master Data Seeding         ');
  console.log('   (Security, Classifications, Units, Manufacturers, Settings)   ');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // 1. ENTERPRISE SECURITY ROLES & SYSTEM PERMISSIONS MATRIX
  // -------------------------------------------------------------
  console.log('[1/7] Seeding Enterprise Security Roles & Permissions Matrix...');

  const roles = [
    {
      name: 'SUPER_ADMIN',
      displayName: 'System Administrator',
      description: 'Unrestricted enterprise administrative access to all modules, logs, and configurations'
    },
    {
      name: 'PHARMACY_MANAGER',
      displayName: 'Pharmacy Manager',
      description: 'Management of procurement, supplier accounts, pricing, cash drawer reconciliation and P&L'
    },
    {
      name: 'PHARMACIST',
      displayName: 'Responsible Pharmacist (SLMC)',
      description: 'Clinical oversight, prescription verification, controlled drugs and dispensing safety'
    },
    {
      name: 'CASHIER',
      displayName: 'Counter Cashier / POS Operator',
      description: 'Counter retail checkout, barcode scanning, payment collection and receipt printing'
    },
    {
      name: 'INVENTORY_OFFICER',
      displayName: 'Inventory Officer',
      description: 'Goods receiving bay (GRN), lot batch creation, expiry monitoring and stock takes'
    }
  ];

  const roleMap: Record<string, bigint> = {};
  for (const r of roles) {
    const roleRecord = await prisma.role.upsert({
      where: { name: r.name },
      update: { displayName: r.displayName, description: r.description },
      create: { name: r.name, displayName: r.displayName, description: r.description }
    });
    roleMap[r.name] = roleRecord.id;
  }

  // System Permissions Matrix
  const permissions = [
    // Sales & POS
    { code: 'sales.create', module: 'sales', description: 'Create retail sales invoices and process checkout' },
    { code: 'sales.refund', module: 'sales', description: 'Process customer product returns and cash refunds' },
    { code: 'sales.view_all', module: 'sales', description: 'View full history of all store sales transactions' },
    { code: 'sales.reprint_receipt', module: 'sales', description: 'Reprint duplicate POS customer tax receipts' },

    // Medicines & Master Catalog
    { code: 'medicines.view', module: 'medicines', description: 'Browse and search medicine catalog' },
    { code: 'medicines.create', module: 'medicines', description: 'Create new pharmaceutical products and SKUs' },
    { code: 'medicines.edit', module: 'medicines', description: 'Modify medicine information and classifications' },
    { code: 'medicines.delete', module: 'medicines', description: 'Archive or remove medicine records' },

    // Batches & Expiry Control
    { code: 'batches.view', module: 'batches', description: 'View batches, lot numbers, and FEFO expiry timeline' },
    { code: 'batches.create', module: 'batches', description: 'Manually register a new batch into inventory' },
    { code: 'batches.quarantine', module: 'batches', description: 'Quarantine, hold, or unhold damaged/recalled batches' },

    // Inventory & Stock Adjustments
    { code: 'inventory.view_ledger', module: 'inventory', description: 'Inspect stock movement audit ledgers' },
    { code: 'inventory.adjust', module: 'inventory', description: 'Submit inventory stock-take adjustment requests' },
    { code: 'inventory.approve_adjustment', module: 'inventory', description: 'Approve or reject stock write-offs' },

    // Procurement & GRN
    { code: 'purchases.view', module: 'purchases', description: 'View purchase orders and goods receipt notes' },
    { code: 'purchases.order_create', module: 'purchases', description: 'Generate purchase orders to pharmaceutical suppliers' },
    { code: 'purchases.receive_grn', module: 'purchases', description: 'Receive supplier shipments into inventory via GRN' },

    // Cash Register & Shift Sessions
    { code: 'cash_register.open_close', module: 'cash_sessions', description: 'Open, close, and balance cashier drawer shifts' },
    { code: 'cash_register.record_drop', module: 'cash_sessions', description: 'Record cash drops or petty cash expenses' },

    // Customers & Patient Records
    { code: 'customers.view', module: 'customers', description: 'Search and view customer records and accounts' },
    { code: 'customers.manage', module: 'customers', description: 'Create, update customer contact and credit settings' },

    // Prescriptions & Clinical Oversight
    { code: 'prescriptions.view', module: 'prescriptions', description: 'Inspect doctor prescriptions and refills' },
    { code: 'prescriptions.verify', module: 'prescriptions', description: 'Pharmacist verification of dosage and contraindications' },
    { code: 'prescriptions.dispense', module: 'prescriptions', description: 'Mark prescription refills as dispensed' },

    // Reports & Financial Analytics
    { code: 'reports.view_sales', module: 'reports', description: 'Access daily and periodic sales performance reports' },
    { code: 'reports.view_profit', module: 'reports', description: 'View profit margin analysis by item and category' },
    { code: 'reports.view_pnl', module: 'reports', description: 'Inspect comprehensive profit & loss financial statement' },
    { code: 'reports.view_inventory', module: 'reports', description: 'Analyze stock valuation, aging, and slow-movers' },

    // Settings, Security & Staff
    { code: 'settings.manage', module: 'settings', description: 'Configure store parameters, tax rates, and peripherals' },
    { code: 'users.manage', module: 'users', description: 'Manage employee accounts, passwords, and role privileges' },
    { code: 'suppliers.view', module: 'suppliers', description: 'View pharmaceutical suppliers and ledgers' },
    { code: 'suppliers.manage', module: 'suppliers', description: 'Manage supplier credit limits and agreements' }
  ];

  const permMap: Record<string, bigint> = {};
  for (const p of permissions) {
    const permRecord = await prisma.permission.upsert({
      where: { code: p.code },
      update: { description: p.description, module: p.module },
      create: { code: p.code, module: p.module, description: p.description }
    });
    permMap[p.code] = permRecord.id;
  }

  // Assign standard permissions to roles
  const managerPermissions = permissions.map((p) => p.code).filter((c) => c !== 'users.manage');
  const pharmacistPermissions = [
    'medicines.view', 'medicines.create', 'medicines.edit',
    'batches.view', 'batches.quarantine', 'inventory.view_ledger',
    'prescriptions.view', 'prescriptions.verify', 'prescriptions.dispense',
    'sales.create', 'sales.view_all', 'customers.view', 'customers.manage',
    'reports.view_inventory', 'reports.view_sales'
  ];
  const cashierPermissions = [
    'sales.create', 'sales.refund', 'sales.view_all', 'sales.reprint_receipt',
    'cash_register.open_close', 'cash_register.record_drop',
    'medicines.view', 'batches.view', 'customers.view', 'customers.manage',
    'prescriptions.view', 'prescriptions.dispense'
  ];
  const inventoryOfficerPermissions = [
    'medicines.view', 'medicines.create', 'medicines.edit',
    'batches.view', 'batches.create', 'batches.quarantine',
    'inventory.view_ledger', 'inventory.adjust',
    'purchases.view', 'purchases.order_create', 'purchases.receive_grn',
    'suppliers.view', 'reports.view_inventory'
  ];

  const linkRolePermissions = async (roleName: string, codes: string[]) => {
    const rId = roleMap[roleName];
    if (!rId) return;
    for (const code of codes) {
      const pId = permMap[code];
      if (pId) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: rId, permissionId: pId } },
          update: {},
          create: { roleId: rId, permissionId: pId }
        });
      }
    }
  };

  await linkRolePermissions('SUPER_ADMIN', permissions.map((p) => p.code));
  await linkRolePermissions('PHARMACY_MANAGER', managerPermissions);
  await linkRolePermissions('PHARMACIST', pharmacistPermissions);
  await linkRolePermissions('CASHIER', cashierPermissions);
  await linkRolePermissions('INVENTORY_OFFICER', inventoryOfficerPermissions);

  console.log('   -> Enterprise roles & permissions matrix successfully seeded.');

  // -------------------------------------------------------------
  // 2. PRODUCTION SYSTEM ADMINISTRATOR
  // -------------------------------------------------------------
  console.log('\n[2/7] Seeding Default System Administrator Account...');
  const defaultAdminPass = await argon2.hash(process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@123456');
  const adminUsername = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
  const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@pharmasys.lk';

  const adminUser = await prisma.user.upsert({
    where: { username: adminUsername },
    update: { email: adminEmail },
    create: {
      username: adminUsername,
      email: adminEmail,
      passwordHash: defaultAdminPass,
      fullName: 'System Administrator',
      phone: '+94771234567',
      isActive: true,
      roles: { create: { roleId: roleMap['SUPER_ADMIN'] } }
    }
  });

  // Ensure admin user has SUPER_ADMIN role
  const existingUserRole = await prisma.userRole.findFirst({
    where: { userId: adminUser.id, roleId: roleMap['SUPER_ADMIN'] }
  });
  if (!existingUserRole) {
    await prisma.userRole.create({
      data: { userId: adminUser.id, roleId: roleMap['SUPER_ADMIN'] }
    });
  }
  console.log(`   -> System Admin initialized: ${adminUsername} (${adminEmail})`);

  // -------------------------------------------------------------
  // 3. MEDICINE CLASSIFICATION & UNIT MANAGEMENT
  // -------------------------------------------------------------
  console.log('\n[3/7] Seeding Medicine Classification & Unit Management (37+ Categories, Forms, Units)...');

  // 3.1 Therapeutic Categories (37+ Clinical Categories)
  const categories = [
    { name: 'Analgesics', code: 'ANALGESICS', description: 'Pain management drugs and fever reducers' },
    { name: 'Anthelmintics', code: 'ANTHELMINTICS', description: 'Deworming treatments for roundworms, tapeworms, etc.' },
    { name: 'Anti-inflammatory', code: 'ANTI_INFLAMMATORY', description: 'Steroidal and non-steroidal anti-inflammatory agents' },
    { name: 'Antibiotics', code: 'ANTIBIOTICS', description: 'Anti-infective agents that kill or inhibit bacteria' },
    { name: 'Antidiabetic Agents', code: 'ANTIDIABETIC', description: 'Insulins and oral hypoglycemic agents' },
    { name: 'Cardiovascular', code: 'CARDIOVASCULAR', description: 'Medications for heart conditions, arrhythmias, and circulation' },
    { name: 'Antihypertensives', code: 'ANTIHYPERTENSIVES', description: 'Blood pressure regulation drugs' },
    { name: 'Respiratory', code: 'RESPIRATORY', description: 'Inhalers, bronchodilators, cough and cold preparations' },
    { name: 'Antihistamines', code: 'ANTIHISTAMINES', description: 'Allergy and anaphylaxis relief medications' },
    { name: 'Gastrointestinal', code: 'GASTROINTESTINAL', description: 'PPIs, antacids, laxatives, and antispasmodics' },
    { name: 'Vitamins & Minerals', code: 'VITAMINS_MINERALS', description: 'Essential supplements, multivitamins, and dietary nutrients' },
    { name: 'Dermatology', code: 'DERMATOLOGY', description: 'Topical ointments, eczema and skin therapeutics' },
    { name: 'Neurology', code: 'NEUROLOGY', description: 'CNS stimulants, neuropathic pain, migraine and Parkinson’s therapy' },
    { name: 'Antifungals', code: 'ANTIFUNGALS', description: 'Oral and topical treatments for fungal infections' },
    { name: 'Antivirals', code: 'ANTIVIRALS', description: 'Medications targeting viral infections' },
    { name: 'Antiparasitics', code: 'ANTIPARASITICS', description: 'Agents combating parasitic infestations' },
    { name: 'Antiseptics & Disinfectants', code: 'ANTISEPTICS_DISINFECTANTS', description: 'Surface, skin, and wound cleaning sanitizers' },
    { name: 'Ophthalmology', code: 'OPHTHALMOLOGY', description: 'Eye drops, ointments, and glaucoma treatments' },
    { name: 'ENT Medicines', code: 'ENT_MEDICINES', description: 'Ear, nose, and throat specific medications' },
    { name: 'Urology', code: 'UROLOGY', description: 'Urinary tract, prostate, and kidney stone management' },
    { name: 'Gynecology', code: 'GYNECOLOGY', description: 'Women’s reproductive health and contraceptive therapies' },
    { name: 'Hormonal Medicines', code: 'HORMONAL', description: 'Thyroid, corticosteroid, and metabolic hormone treatments' },
    { name: 'Psychiatric Medicines', code: 'PSYCHIATRIC', description: 'Antidepressants, anxiolytics, and mood stabilizers' },
    { name: 'Antiepileptics', code: 'ANTIEPILEPTICS', description: 'Seizure control and anticonvulsant drugs' },
    { name: 'Bone & Joint Health', code: 'BONE_JOINT_HEALTH', description: 'Osteoporosis, calcium, and arthritis therapeutics' },
    { name: 'Blood Related Medicines', code: 'BLOOD_RELATED', description: 'Anticoagulants, antiplatelets, and hematinics' },
    { name: 'Immunological Medicines', code: 'IMMUNOLOGICAL', description: 'Vaccines, serums, and immunosuppressants' },
    { name: 'Oncology', code: 'ONCOLOGY', description: 'Chemotherapy and adjuvant cancer care drugs' },
    { name: 'Emergency Medicines', code: 'EMERGENCY', description: 'Critical care, anaphylaxis kits, and resuscitation essentials' },
    { name: 'Sedatives & Hypnotics', code: 'SEDATIVES', description: 'Sleep management, anxiolytics, and tranquilizers' },
    { name: 'Controlled & Narcotic Substances', code: 'NARCOTICS', description: 'Schedule II & III controlled analgesics' },
    { name: 'Anesthetics', code: 'ANESTHETICS', description: 'Local and general anesthetic medications' },
    { name: 'Antidotes & Toxicology', code: 'ANTIDOTES', description: 'Reversal agents, chelators, and poison antidotes' },
    { name: 'Dental & Oral Care', code: 'DENTAL', description: 'Oral pastes, dental analgesics, and periodontal washes' },
    { name: 'Pediatric Formulations', code: 'PEDIATRIC', description: 'Pediatric drops, suspensions, and flavored liquid formulations' },
    { name: 'Geriatric & Palliative Care', code: 'GERIATRIC', description: 'Specialized supportive medications for elderly care' },
    { name: 'Medical Devices & Surgical Consumables', code: 'SURGICAL_DEVICES', description: 'Cannulas, syringes, infusion sets, and surgical disposables' },
    { name: 'Diagnostic Reagents & Test Strips', code: 'DIAGNOSTICS', description: 'Blood glucose test strips, pregnancy cassettes, and urinalysis' },
    { name: 'Wound Care & Dressings', code: 'WOUND_CARE', description: 'Bandages, surgical gauze, sterile cotton, and medical adhesive tape' },
    { name: 'Other Medicines', code: 'OTHER', description: 'General therapeutic and specialized medicines' }
  ];

  const catMap: Record<string, bigint> = {};
  for (const c of categories) {
    const record = await prisma.category.upsert({
      where: { code: c.code },
      update: { name: c.name, description: c.description },
      create: { name: c.name, code: c.code, description: c.description, isActive: true }
    });
    catMap[c.code] = record.id;
  }

  // 3.2 Hierarchical Subcategories
  const subcategoryData: { catCode: string; name: string; code: string; desc?: string }[] = [
    // Analgesics (4 subcategories)
    { catCode: 'ANALGESICS', name: 'Paracetamol Formulations', code: 'ANALGESICS_PCM', desc: 'Oral tablets, infusions, and pediatric suspensions' },
    { catCode: 'ANALGESICS', name: 'NSAIDs', code: 'ANALGESICS_NSAID', desc: 'Ibuprofen, Diclofenac, Mefenamic Acid, Meloxicam' },
    { catCode: 'ANALGESICS', name: 'Opioid Analgesics', code: 'ANALGESICS_OPIOID', desc: 'Tramadol, Codeine, Morphine' },
    { catCode: 'ANALGESICS', name: 'Combination Analgesics', code: 'ANALGESICS_COMBO', desc: 'Paracetamol + Caffeine / Tramadol' },

    // Anthelmintics
    { catCode: 'ANTHELMINTICS', name: 'Benzimidazoles', code: 'ANTHELM_BENZ', desc: 'Mebendazole, Albendazole' },
    { catCode: 'ANTHELMINTICS', name: 'Other Deworming Agents', code: 'ANTHELM_OTHER', desc: 'Pyrantel pamoate, Ivermectin' },

    // Anti-inflammatory (2 subcategories)
    { catCode: 'ANTI_INFLAMMATORY', name: 'Corticosteroids', code: 'ANTI_INFLAM_STEROID', desc: 'Prednisolone, Dexamethasone, Hydrocortisone' },
    { catCode: 'ANTI_INFLAMMATORY', name: 'DMARDs', code: 'ANTI_INFLAM_DMARD', desc: 'Methotrexate, Hydroxychloroquine, Sulfasalazine' },

    // Antibiotics (7 subcategories)
    { catCode: 'ANTIBIOTICS', name: 'Penicillins', code: 'ANTIBIOTICS_PEN', desc: 'Amoxicillin, Ampicillin, Co-Amoxiclav' },
    { catCode: 'ANTIBIOTICS', name: 'Cephalosporins', code: 'ANTIBIOTICS_CEPH', desc: 'Cephalexin, Cefuroxime, Cefixime' },
    { catCode: 'ANTIBIOTICS', name: 'Macrolides', code: 'ANTIBIOTICS_MACRO', desc: 'Azithromycin, Clarithromycin, Erythromycin' },
    { catCode: 'ANTIBIOTICS', name: 'Tetracyclines', code: 'ANTIBIOTICS_TETRA', desc: 'Doxycycline, Minocycline' },
    { catCode: 'ANTIBIOTICS', name: 'Fluoroquinolones', code: 'ANTIBIOTICS_QUIN', desc: 'Ciprofloxacin, Levofloxacin' },
    { catCode: 'ANTIBIOTICS', name: 'Aminoglycosides', code: 'ANTIBIOTICS_AMINO', desc: 'Gentamicin, Amikacin' },
    { catCode: 'ANTIBIOTICS', name: 'Carbapenems', code: 'ANTIBIOTICS_CARBA', desc: 'Meropenem, Imipenem' },

    // Antidiabetic Agents
    { catCode: 'ANTIDIABETIC', name: 'Biguanides', code: 'DIAB_BIGUANIDE', desc: 'Metformin Hydrochloride (Standard & Prolonged Release)' },
    { catCode: 'ANTIDIABETIC', name: 'Sulfonylureas', code: 'DIAB_SULFONYL', desc: 'Gliclazide, Glimepiride, Glibenclamide' },
    { catCode: 'ANTIDIABETIC', name: 'DPP-4 Inhibitors', code: 'DIAB_DPP4', desc: 'Sitagliptin, Vildagliptin, Linagliptin' },
    { catCode: 'ANTIDIABETIC', name: 'SGLT2 Inhibitors', code: 'DIAB_SGLT2', desc: 'Empagliflozin, Dapagliflozin' },
    { catCode: 'ANTIDIABETIC', name: 'Insulins', code: 'DIAB_INSULIN', desc: 'Human Actrapid, Mixtard, Glargine, Degludec' },

    // Cardiovascular
    { catCode: 'CARDIOVASCULAR', name: 'Statins & Lipid Lowering', code: 'CARDIO_STATIN', desc: 'Atorvastatin, Rosuvastatin, Fenofibrate' },
    { catCode: 'CARDIOVASCULAR', name: 'Antiarrhythmics', code: 'CARDIO_ARRHYTH', desc: 'Amiodarone, Digoxin, Flecainide' },
    { catCode: 'CARDIOVASCULAR', name: 'Nitrates & Vasodilators', code: 'CARDIO_VASODIL', desc: 'Glyceryl Trinitrate (GTN), Isosorbide Mononitrate' },

    // Antihypertensives
    { catCode: 'ANTIHYPERTENSIVES', name: 'ACE Inhibitors', code: 'HT_ACE', desc: 'Enalapril, Ramipril, Lisinopril' },
    { catCode: 'ANTIHYPERTENSIVES', name: 'Angiotensin Receptor Blockers (ARBs)', code: 'HT_ARB', desc: 'Losartan, Telmisartan, Valsartan' },
    { catCode: 'ANTIHYPERTENSIVES', name: 'Beta Blockers', code: 'HT_BETA', desc: 'Atenolol, Bisoprolol, Carvedilol' },
    { catCode: 'ANTIHYPERTENSIVES', name: 'Calcium Channel Blockers (CCBs)', code: 'HT_CCB', desc: 'Amlodipine, Diltiazem, Verapamil' },
    { catCode: 'ANTIHYPERTENSIVES', name: 'Diuretics', code: 'HT_DIURETIC', desc: 'Furosemide, Spironolactone, Hydrochlorothiazide' },

    // Respiratory
    { catCode: 'RESPIRATORY', name: 'Bronchodilators & Beta-2 Agonists', code: 'RESP_BRONCHO', desc: 'Salbutamol, Formoterol, Salmeterol' },
    { catCode: 'RESPIRATORY', name: 'Inhaled Corticosteroids (ICS)', code: 'RESP_ICS', desc: 'Budesonide, Fluticasone, Beclomethasone' },
    { catCode: 'RESPIRATORY', name: 'Cough Syrups & Antitussives', code: 'RESP_COUGH', desc: 'Dextromethorphan, Guaifenesin' },
    { catCode: 'RESPIRATORY', name: 'Mucolytics', code: 'RESP_MUCO', desc: 'Ambroxol, Bromhexine, Acetylcysteine' },

    // Antihistamines
    { catCode: 'ANTIHISTAMINES', name: 'First-Generation Antihistamines', code: 'HIST_1ST', desc: 'Chlorpheniramine, Hydroxyzine, Promethazine' },
    { catCode: 'ANTIHISTAMINES', name: 'Second-Generation Antihistamines', code: 'HIST_2ND', desc: 'Cetirizine, Loratadine, Fexofenadine, Levocetirizine' },

    // Gastrointestinal
    { catCode: 'GASTROINTESTINAL', name: 'Proton Pump Inhibitors (PPIs)', code: 'GI_PPI', desc: 'Omeprazole, Pantoprazole, Esomeprazole, Rabeprazole' },
    { catCode: 'GASTROINTESTINAL', name: 'Antacids & Antiflatulents', code: 'GI_ANTACID', desc: 'Magaldrate, Simethicone, Aluminum Hydroxide' },
    { catCode: 'GASTROINTESTINAL', name: 'Antiemetics & Prokinetics', code: 'GI_ANTIEMETIC', desc: 'Domperidone, Ondansetron, Metoclopramide' },
    { catCode: 'GASTROINTESTINAL', name: 'Laxatives & Stool Softeners', code: 'GI_LAXATIVE', desc: 'Bisacodyl, Lactulose, Ispaghula Husk' },

    // Dermatology
    { catCode: 'DERMATOLOGY', name: 'Topical Antifungals', code: 'DERMA_FUNGAL', desc: 'Clotrimazole, Terbinafine, Miconazole creams' },
    { catCode: 'DERMATOLOGY', name: 'Topical Corticosteroids', code: 'DERMA_STEROID', desc: 'Hydrocortisone, Betamethasone, Clobetasol' },
    { catCode: 'DERMATOLOGY', name: 'Topical Antibacterials', code: 'DERMA_ANTIBACT', desc: 'Mupirocin, Fusidic Acid, Silver Sulfadiazine' },
    { catCode: 'DERMATOLOGY', name: 'Emollients & Barrier Ointments', code: 'DERMA_EMOLLIENT', desc: 'Aqueous cream, Liquid paraffin, Zinc castor oil' },

    // Ophthalmology
    { catCode: 'OPHTHALMOLOGY', name: 'Antibacterial Eye Drops', code: 'OPHTH_ANTIBACT', desc: 'Chloramphenicol, Ciprofloxacin, Tobramycin' },
    { catCode: 'OPHTHALMOLOGY', name: 'Artificial Tears & Lubricants', code: 'OPHTH_LUBRICANT', desc: 'Carboxymethylcellulose, Hydroxypropyl Methylcellulose' },
    { catCode: 'OPHTHALMOLOGY', name: 'Glaucoma Therapeutics', code: 'OPHTH_GLAUCOMA', desc: 'Timolol, Latanoprost, Dorzolamide' }
  ];

  for (const s of subcategoryData) {
    const parentId = catMap[s.catCode];
    if (parentId) {
      await prisma.subCategory.upsert({
        where: {
          categoryId_code: {
            categoryId: parentId,
            code: s.code
          }
        },
        update: { name: s.name, description: s.desc },
        create: {
          categoryId: parentId,
          name: s.name,
          code: s.code,
          description: s.desc,
          isActive: true
        }
      });
    }
  }

  // 3.3 Clinical Dosage Forms (Grouped into 8 clinical categories)
  const dosageForms: { group: string; names: string[] }[] = [
    {
      group: 'Solid Forms',
      names: [
        'Tablets', 'Capsules', 'Effervescent Tablets', 'Chewable Tablets',
        'Sublingual Tablets', 'Dispersible Tablets', 'Orodispersible Tablets',
        'Caplets', 'Modified Release Tablets', 'Enteric Coated Tablets',
        'Powders', 'Granules', 'Pellets', 'Lozenges', 'Pastilles'
      ]
    },
    {
      group: 'Liquid Forms',
      names: [
        'Syrups', 'Suspensions', 'Solutions', 'Oral Drops', 'Emulsions',
        'Elixirs', 'Tinctures', 'Mouthwashes', 'Gargles', 'Oral Liquids',
        'Mixtures', 'Linctuses'
      ]
    },
    {
      group: 'Topical Forms',
      names: [
        'Creams', 'Ointments', 'Gels', 'Lotions', 'Topical Solutions',
        'Topical Sprays', 'Dusting Powders', 'Transdermal Patches',
        'Liniments', 'Pastes', 'Topical Foams', 'Collodions'
      ]
    },
    {
      group: 'Inhalation Forms',
      names: [
        'Inhalers', 'Metered Dose Inhalers (MDI)', 'Dry Powder Inhalers (DPI)',
        'Nebulizer Solutions', 'Inhalation Aerosols', 'Inhalation Powders',
        'Nasal Sprays', 'Nasal Drops', 'Nasal Solutions', 'Breath-Actuated Inhalers'
      ]
    },
    {
      group: 'Injectable Forms',
      names: [
        'Injections', 'Injectable Solutions', 'Injectable Suspensions',
        'Injectable Emulsions', 'Powder for Injection', 'Lyophilized Powder for Injection',
        'Prefilled Syringes', 'Injection Cartridges', 'Infusion Solutions',
        'Concentrates for Infusion', 'Intravenous Infusions'
      ]
    },
    {
      group: 'Ophthalmic & Otic Forms',
      names: [
        'Eye Drops', 'Eye Ointments', 'Eye Gels', 'Eye Solutions',
        'Eye Suspensions', 'Ear Drops', 'Ear Solutions', 'Ear Sprays',
        'Eye Washes'
      ]
    },
    {
      group: 'Rectal & Vaginal Forms',
      names: [
        'Suppositories', 'Rectal Creams', 'Rectal Ointments', 'Rectal Solutions',
        'Enemas', 'Vaginal Tablets', 'Vaginal Pessaries', 'Vaginal Creams',
        'Vaginal Gels', 'Vaginal Capsules', 'Vaginal Suppositories', 'Vaginal Rings'
      ]
    },
    {
      group: 'Other & Diagnostic Forms',
      names: [
        'Medicated Films', 'Oral Films', 'Sublingual Films', 'Oral Strips',
        'Medicated Shampoos', 'Medicated Soaps', 'Medicated Wipes',
        'Dental Gels', 'Dental Pastes', 'Oral Sprays', 'Test Strips',
        'Surgical Dressings', 'Subcutaneous Implants'
      ]
    }
  ];

  for (const dfg of dosageForms) {
    for (const dfName of dfg.names) {
      await prisma.dosageFormMaster.upsert({
        where: { name: dfName },
        update: { categoryGroup: dfg.group },
        create: {
          name: dfName,
          categoryGroup: dfg.group,
          isActive: true
        }
      });
    }
  }

  // 3.4 Selling Units (34 units)
  const sellingUnits: { name: string; abbr: string; type: string; decimals: boolean; desc?: string }[] = [
    { name: 'Tablet', abbr: 'tab', type: 'COUNT', decimals: false, desc: 'Single oral solid tablet' },
    { name: 'Capsule', abbr: 'cap', type: 'COUNT', decimals: false, desc: 'Single gelatin or plant capsule' },
    { name: 'Pill', abbr: 'pill', type: 'COUNT', decimals: false, desc: 'Single medicinal pill' },
    { name: 'Strip', abbr: 'strip', type: 'PACKAGING', decimals: false, desc: 'Foil or blister medicine strip' },
    { name: 'Blister', abbr: 'blister', type: 'PACKAGING', decimals: false, desc: 'Blister packaging card' },
    { name: 'Sachet', abbr: 'sachet', type: 'COUNT', decimals: false, desc: 'Single oral powder or oral solution packet' },
    { name: 'Bottle', abbr: 'btl', type: 'PACKAGING', decimals: false, desc: 'Glass or plastic liquid medicine bottle' },
    { name: 'Vial', abbr: 'vial', type: 'PACKAGING', decimals: false, desc: 'Sterile injection or solution vial' },
    { name: 'Ampoule', abbr: 'amp', type: 'PACKAGING', decimals: false, desc: 'Single-use glass injection ampoule' },
    { name: 'Tube', abbr: 'tube', type: 'PACKAGING', decimals: false, desc: 'Ointment, gel, or topical cream tube' },
    { name: 'Pack', abbr: 'pack', type: 'PACKAGING', decimals: false, desc: 'Pre-assembled consumer retail pack' },
    { name: 'Box', abbr: 'box', type: 'PACKAGING', decimals: false, desc: 'Small retail unit box' },
    { name: 'Inhaler', abbr: 'inh', type: 'COUNT', decimals: false, desc: 'Metered dose inhaler canister device' },
    { name: 'Piece', abbr: 'pc', type: 'COUNT', decimals: false, desc: 'Individual discrete physical piece' },
    { name: 'Unit', abbr: 'unit', type: 'COUNT', decimals: false, desc: 'Standard clinical dosage unit' },
    { name: 'Drop', abbr: 'drop', type: 'COUNT', decimals: false, desc: 'Single ophthalmic or otic drop' },
    { name: 'Millilitre (ml)', abbr: 'ml', type: 'VOLUME', decimals: true, desc: 'Liquid volume measure in millilitres' },
    { name: 'Litre (L)', abbr: 'L', type: 'VOLUME', decimals: true, desc: 'Bulk liquid measure in litres' },
    { name: 'Gram (g)', abbr: 'g', type: 'WEIGHT', decimals: true, desc: 'Weight measure in grams' },
    { name: 'Kilogram (kg)', abbr: 'kg', type: 'WEIGHT', decimals: true, desc: 'Weight measure in kilograms' },
    { name: 'Microgram (mcg)', abbr: 'mcg', type: 'WEIGHT', decimals: true, desc: 'Microgram potency measure' },
    { name: 'Milligram (mg)', abbr: 'mg', type: 'WEIGHT', decimals: true, desc: 'Milligram strength measure' },
    { name: 'Patch', abbr: 'patch', type: 'COUNT', decimals: false, desc: 'Transdermal sustained-release patch' },
    { name: 'Suppository', abbr: 'supp', type: 'COUNT', decimals: false, desc: 'Single rectal suppository cone' },
    { name: 'Pessary', abbr: 'pess', type: 'COUNT', decimals: false, desc: 'Single vaginal pessary tablet' },
    { name: 'Syringe', abbr: 'syr', type: 'COUNT', decimals: false, desc: 'Prefilled graduated injection syringe' },
    { name: 'Cartridge', abbr: 'cart', type: 'COUNT', decimals: false, desc: 'Dental or insulin pen cartridge' },
    { name: 'Roll', abbr: 'roll', type: 'COUNT', decimals: false, desc: 'Cotton, bandage, or surgical tape roll' },
    { name: 'Pair', abbr: 'pair', type: 'COUNT', decimals: false, desc: 'Surgical or examination gloves pair' },
    { name: 'Set', abbr: 'set', type: 'COUNT', decimals: false, desc: 'Infusion, blood transfusion or dressing set' },
    { name: 'Kit', abbr: 'kit', type: 'COUNT', decimals: false, desc: 'Diagnostic rapid test kit or first aid kit' },
    { name: 'Dose', abbr: 'dose', type: 'COUNT', decimals: false, desc: 'Pre-measured clinical dose' },
    { name: 'Puff', abbr: 'puff', type: 'COUNT', decimals: false, desc: 'Single inhaler spray actuation' },
    { name: 'Applicator', abbr: 'appl', type: 'COUNT', decimals: false, desc: 'Medicated vaginal or topical applicator' }
  ];

  for (const su of sellingUnits) {
    await prisma.sellingUnit.upsert({
      where: { name: su.name },
      update: { abbreviation: su.abbr, unitType: su.type, allowDecimals: su.decimals, description: su.desc },
      create: {
        name: su.name,
        abbreviation: su.abbr,
        unitType: su.type,
        allowDecimals: su.decimals,
        description: su.desc,
        isActive: true
      }
    });
  }

  // 3.5 Purchase Units (18 secondary/tertiary units)
  const purchaseUnits: { name: string; abbr: string; desc?: string }[] = [
    { name: 'Box', abbr: 'box', desc: 'Standard secondary packaging box' },
    { name: 'Carton', abbr: 'ctn', desc: 'Outer master shipping carton containing multiple boxes' },
    { name: 'Pack', abbr: 'pack', desc: 'Multi-item consumer or dispenser pack' },
    { name: 'Strip', abbr: 'strip', desc: 'Foil or plastic medicine strip' },
    { name: 'Bottle', abbr: 'btl', desc: 'Liquid, syrup, or tablet bottle' },
    { name: 'Vial', abbr: 'vial', desc: 'Sterile injection or solution vial' },
    { name: 'Piece', abbr: 'pc', desc: 'Single wholesale unit piece' },
    { name: 'Ampoule', abbr: 'amp', desc: 'Single-use glass ampoule' },
    { name: 'Tube', abbr: 'tube', desc: 'Ointment or cream tube' },
    { name: 'Tin', abbr: 'tin', desc: 'Metal container or canister' },
    { name: 'Drum', abbr: 'drum', desc: 'Bulk liquid or raw ingredient drum' },
    { name: 'Crate', abbr: 'crate', desc: 'Wholesale delivery crate' },
    { name: 'Bundle', abbr: 'bdl', desc: 'Bound collection of packages' },
    { name: 'Case', abbr: 'case', desc: 'Protective shipper case' },
    { name: 'Jar', abbr: 'jar', desc: 'Wide-mouth powder or tablet jar' },
    { name: 'Container', abbr: 'cont', desc: 'Sealed wholesale storage container' },
    { name: 'Roll', abbr: 'roll', desc: 'Bulk surgical dressing or tape roll' },
    { name: 'Kit', abbr: 'kit', desc: 'Complete diagnostic or treatment procedure kit' }
  ];

  for (const pu of purchaseUnits) {
    await prisma.purchaseUnit.upsert({
      where: { name: pu.name },
      update: { abbreviation: pu.abbr, description: pu.desc },
      create: {
        name: pu.name,
        abbreviation: pu.abbr,
        description: pu.desc,
        isActive: true
      }
    });
  }

  console.log(`   -> Seeded ${categories.length} Categories, ${subcategoryData.length} Subcategories, ` +
    `${dosageForms.reduce((sum, g) => sum + g.names.length, 0)} Dosage Forms, ` +
    `${sellingUnits.length} Selling Units, and ${purchaseUnits.length} Purchase Units.`);

  // -------------------------------------------------------------
  // 4. PHARMACEUTICAL MANUFACTURERS
  // -------------------------------------------------------------
  console.log('\n[4/7] Seeding Pharmaceutical Manufacturers...');
  const manufacturerData = [
    { name: 'GlaxoSmithKline (GSK) Pharmaceuticals', country: 'United Kingdom', contactPhone: '+44 20 8047 5000' },
    { name: 'Cipla Limited', country: 'India', contactPhone: '+91 22 2482 6000' },
    { name: 'Sun Pharma Laboratories Ltd', country: 'India', contactPhone: '+91 22 4324 4324' },
    { name: 'Astron Limited Sri Lanka', country: 'Sri Lanka', contactPhone: '+94 11 263 6441' },
    { name: 'State Pharmaceuticals Manufacturing Corporation (SPMC)', country: 'Sri Lanka', contactPhone: '+94 11 285 0374' },
    { name: 'Pfizer Pharmaceuticals', country: 'United States', contactPhone: '+1 212 733 2323' },
    { name: 'Bayer Healthcare AG', country: 'Germany', contactPhone: '+49 214 301' },
    { name: 'Torrent Pharmaceuticals Ltd', country: 'India', contactPhone: '+91 79 2659 9000' },
    { name: 'Novartis AG', country: 'Switzerland', contactPhone: '+41 61 324 1111' },
    { name: 'Sanofi S.A.', country: 'France', contactPhone: '+33 1 53 77 40 00' },
    { name: 'Abbott Laboratories', country: 'United States', contactPhone: '+1 224 667 6100' },
    { name: 'Glenmark Pharmaceuticals', country: 'India', contactPhone: '+91 22 4018 9999' }
  ];

  for (const m of manufacturerData) {
    await prisma.manufacturer.upsert({
      where: { name: m.name },
      update: { country: m.country, contactPhone: m.contactPhone },
      create: { name: m.name, country: m.country, contactPhone: m.contactPhone, isActive: true }
    });
  }
  console.log(`   -> Seeded ${manufacturerData.length} Pharmaceutical Manufacturers.`);

  // -------------------------------------------------------------
  // 5. ESSENTIAL GENERIC DRUG MOLECULES
  // -------------------------------------------------------------
  console.log('\n[5/7] Seeding Generic Drug Molecules...');
  const genericData = [
    { name: 'Paracetamol', therapeuticClass: 'Analgesic / Antipyretic' },
    { name: 'Amoxicillin + Clavulanic Acid', therapeuticClass: 'Penicillin / Beta-lactamase inhibitor' },
    { name: 'Metformin Hydrochloride', therapeuticClass: 'Biguanide Oral Antidiabetic' },
    { name: 'Atorvastatin Calcium', therapeuticClass: 'HMG-CoA Reductase Inhibitor (Statin)' },
    { name: 'Losartan Potassium', therapeuticClass: 'Angiotensin Receptor Blocker (ARB)' },
    { name: 'Omeprazole', therapeuticClass: 'Proton Pump Inhibitor (PPI)' },
    { name: 'Pantoprazole Sodium', therapeuticClass: 'Proton Pump Inhibitor (PPI)' },
    { name: 'Salbutamol Sulfate', therapeuticClass: 'Short-acting Beta-2 Agonist' },
    { name: 'Cetirizine Dihydrochloride', therapeuticClass: 'Second-generation Antihistamine' },
    { name: 'Fexofenadine Hydrochloride', therapeuticClass: 'Non-sedating Antihistamine' },
    { name: 'Ciprofloxacin HCl', therapeuticClass: 'Fluoroquinolone Antibacterial' },
    { name: 'Levofloxacin Hemihydrate', therapeuticClass: 'Fluoroquinolone Antibacterial' },
    { name: 'Tramadol Hydrochloride', therapeuticClass: 'Synthetic Opioid Analgesic' },
    { name: 'Amlodipine Besylate', therapeuticClass: 'Calcium Channel Blocker' },
    { name: 'Gliclazide', therapeuticClass: 'Sulfonylurea Antidiabetic' },
    { name: 'Dextromethorphan + Chlorpheniramine', therapeuticClass: 'Antitussive / Antihistamine Syrup' },
    { name: 'Ascorbic Acid (Vitamin C) 500mg', therapeuticClass: 'Water-soluble Vitamin' },
    { name: 'Clotrimazole 1%', therapeuticClass: 'Broad-spectrum Topical Antifungal' },
    { name: 'Azithromycin Dihydrate', therapeuticClass: 'Macrolide Antibiotic' },
    { name: 'Doxycycline Hyclate', therapeuticClass: 'Tetracycline Antibiotic' },
    { name: 'Cefixime Trihydrate', therapeuticClass: 'Third-generation Cephalosporin' },
    { name: 'Montelukast Sodium', therapeuticClass: 'Leukotriene Receptor Antagonist' },
    { name: 'Rosuvastatin Calcium', therapeuticClass: 'Lipid-lowering Statin' },
    { name: 'Domperidone', therapeuticClass: 'Dopamine D2 Receptor Antagonist (Antiemetic)' }
  ];

  for (const g of genericData) {
    await prisma.genericMolecule.upsert({
      where: { name: g.name },
      update: { therapeuticClass: g.therapeuticClass },
      create: { name: g.name, therapeuticClass: g.therapeuticClass }
    });
  }
  console.log(`   -> Seeded ${genericData.length} Generic Drug Molecules.`);

  // -------------------------------------------------------------
  // 6. OPERATIONAL EXPENSE CATEGORIES
  // -------------------------------------------------------------
  console.log('\n[6/7] Seeding Operational Expense Categories...');
  const expenseCategories = [
    'Utilities (Electricity, Water, Internet)',
    'Shop Premises Rent & Maintenance',
    'Staff Salaries & Overtime Wages',
    'Packaging, Carry Bags & Thermal Rolls',
    'NMRA License & Legal Regulatory Fees',
    'Bank Terminal Fees & Merchant Surcharges',
    'IT Infrastructure & Software Subscriptions',
    'Equipment Maintenance & Calibrations'
  ];

  for (const exp of expenseCategories) {
    await prisma.expenseCategory.upsert({
      where: { name: exp },
      update: {},
      create: { name: exp }
    });
  }
  console.log(`   -> Seeded ${expenseCategories.length} Operational Expense Categories.`);

  // -------------------------------------------------------------
  // 7. PHARMACY SYSTEM SETTINGS
  // -------------------------------------------------------------
  console.log('\n[7/7] Seeding Pharmacy Enterprise Configuration Settings...');
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
  console.log(`   -> Seeded ${settings.length} Pharmacy System Settings.`);

  console.log('\n================================================================');
  console.log('   PharmaSys Production Seed Completed with 100% Purity!        ');
  console.log('   (Zero mock transactions, full classifications & roles ready) ');
  console.log('================================================================\n');
}

main()
  .catch((e) => {
    console.error('Production seeding error encountered:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
