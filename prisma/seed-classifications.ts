import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedClassifications() {
  console.log('Seeding Medicine Classifications, Dosage Forms, and Units...');

  // 1. Categories (30)
  const categories = [
    { name: 'Antibiotics', code: 'ANTIBIOTICS', description: 'Anti-infective agents that kill or inhibit bacteria' },
    { name: 'Analgesics', code: 'ANALGESICS', description: 'Pain management drugs and fever reducers' },
    { name: 'Anti-inflammatory', code: 'ANTI_INFLAMMATORY', description: 'Steroidal and non-steroidal anti-inflammatory agents' },
    { name: 'Cardiovascular', code: 'CARDIOVASCULAR', description: 'Medications for heart conditions, arrhythmias, and circulation' },
    { name: 'Antihypertensives', code: 'ANTIHYPERTENSIVES', description: 'Blood pressure regulation drugs' },
    { name: 'Diabetes', code: 'DIABETES', description: 'Oral hypoglycemics, insulins, and diabetic supplies' },
    { name: 'Respiratory', code: 'RESPIRATORY', description: 'Inhalers, bronchodilators, cough and cold preparations' },
    { name: 'Antihistamines', code: 'ANTIHISTAMINES', description: 'Allergy and anaphylaxis relief medications' },
    { name: 'Gastrointestinal', code: 'GASTROINTESTINAL', description: 'PPIs, antacids, laxatives, and antispasmodics' },
    { name: 'Vitamins & Minerals', code: 'VITAMINS_MINERALS', description: 'Essential supplements, multivitamins, and dietary nutrients' },
    { name: 'Dermatology', code: 'DERMATOLOGY', description: 'Topical ointments, eczema and skin therapeutics' },
    { name: 'Neurology', code: 'NEUROLOGY', description: 'CNS stimulants, neuropathic pain, migraine and Parkinson’s therapy' },
    { name: 'Antifungals', code: 'ANTIFUNGALS', description: 'Oral and topical treatments for fungal infections' },
    { name: 'Antivirals', code: 'ANTIVIRALS', description: 'Medications targeting viral infections' },
    { name: 'Antiparasitics', code: 'ANTIPARASITICS', description: 'Agents combating parasitic infestations' },
    { name: 'Anthelmintics', code: 'ANTHELMINTICS', description: 'Deworming treatments for roundworms, tapeworms, etc.' },
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

  // 2. Subcategories
  const subcategoryData: { catCode: string; name: string; code: string; desc?: string }[] = [
    // Antibiotics
    { catCode: 'ANTIBIOTICS', name: 'Penicillins', code: 'ANTIBIOTICS_PEN', desc: 'Amoxicillin, Ampicillin, Co-Amoxiclav' },
    { catCode: 'ANTIBIOTICS', name: 'Cephalosporins', code: 'ANTIBIOTICS_CEPH', desc: 'Cephalexin, Cefuroxime, Cefixime' },
    { catCode: 'ANTIBIOTICS', name: 'Macrolides', code: 'ANTIBIOTICS_MACRO', desc: 'Azithromycin, Clarithromycin, Erythromycin' },
    { catCode: 'ANTIBIOTICS', name: 'Tetracyclines', code: 'ANTIBIOTICS_TETRA', desc: 'Doxycycline, Minocycline' },
    { catCode: 'ANTIBIOTICS', name: 'Fluoroquinolones', code: 'ANTIBIOTICS_QUIN', desc: 'Ciprofloxacin, Levofloxacin' },
    { catCode: 'ANTIBIOTICS', name: 'Aminoglycosides', code: 'ANTIBIOTICS_AMINO', desc: 'Gentamicin, Amikacin' },
    { catCode: 'ANTIBIOTICS', name: 'Carbapenems', code: 'ANTIBIOTICS_CARBA', desc: 'Meropenem, Imipenem' },

    // Analgesics
    { catCode: 'ANALGESICS', name: 'Paracetamol', code: 'ANALGESICS_PCM', desc: 'Paracetamol formulations' },
    { catCode: 'ANALGESICS', name: 'NSAIDs', code: 'ANALGESICS_NSAID', desc: 'Ibuprofen, Diclofenac, Mefenamic Acid' },
    { catCode: 'ANALGESICS', name: 'Opioid Analgesics', code: 'ANALGESICS_OPIOID', desc: 'Tramadol, Codeine' },
    { catCode: 'ANALGESICS', name: 'Combination Analgesics', code: 'ANALGESICS_COMBO', desc: 'Paracetamol + Caffeine / Tramadol' },

    // Anti-inflammatory
    { catCode: 'ANTI_INFLAMMATORY', name: 'Corticosteroids', code: 'ANTI_INFLAM_STEROID', desc: 'Prednisolone, Dexamethasone' },
    { catCode: 'ANTI_INFLAMMATORY', name: 'DMARDs', code: 'ANTI_INFLAM_DMARD', desc: 'Methotrexate, Hydroxychloroquine' },

    // Cardiovascular
    { catCode: 'CARDIOVASCULAR', name: 'Statins & Lipid Regulators', code: 'CARDIO_STATIN', desc: 'Atorvastatin, Rosuvastatin' },
    { catCode: 'CARDIOVASCULAR', name: 'Antiarrhythmics', code: 'CARDIO_ARRHYTH', desc: 'Amiodarone, Digoxin' },
    { catCode: 'CARDIOVASCULAR', name: 'Vasodilators & Nitrates', code: 'CARDIO_VASODIL', desc: 'Glyceryl Trinitrate (GTN)' },

    // Antihypertensives
    { catCode: 'ANTIHYPERTENSIVES', name: 'ACE Inhibitors', code: 'HT_ACE', desc: 'Enalapril, Ramipril' },
    { catCode: 'ANTIHYPERTENSIVES', name: 'ARBs (Angiotensin Blockers)', code: 'HT_ARB', desc: 'Losartan, Telmisartan' },
    { catCode: 'ANTIHYPERTENSIVES', name: 'Beta Blockers', code: 'HT_BETA', desc: 'Atenolol, Bisoprolol, Carvedilol' },
    { catCode: 'ANTIHYPERTENSIVES', name: 'Calcium Channel Blockers', code: 'HT_CCB', desc: 'Amlodipine, Diltiazem' },
    { catCode: 'ANTIHYPERTENSIVES', name: 'Diuretics', code: 'HT_DIURETIC', desc: 'Furosemide, Spironolactone' },

    // Diabetes
    { catCode: 'DIABETES', name: 'Biguanides', code: 'DIAB_BIGUANIDE', desc: 'Metformin Hydrochloride' },
    { catCode: 'DIABETES', name: 'Sulfonylureas', code: 'DIAB_SULFONYL', desc: 'Gliclazide, Glimepiride' },
    { catCode: 'DIABETES', name: 'DPP-4 Inhibitors', code: 'DIAB_DPP4', desc: 'Sitagliptin, Vildagliptin, Linagliptin' },
    { catCode: 'DIABETES', name: 'SGLT2 Inhibitors', code: 'DIAB_SGLT2', desc: 'Empagliflozin, Dapagliflozin' },
    { catCode: 'DIABETES', name: 'Insulins', code: 'DIAB_INSULIN', desc: 'Human Actrapid, Mixtard, Glargine' },

    // Respiratory
    { catCode: 'RESPIRATORY', name: 'Bronchodilators', code: 'RESP_BRONCHO', desc: 'Salbutamol, Formoterol' },
    { catCode: 'RESPIRATORY', name: 'Cough Preparations', code: 'RESP_COUGH', desc: 'Dextromethorphan, Guaifenesin' },
    { catCode: 'RESPIRATORY', name: 'Mucolytics', code: 'RESP_MUCO', desc: 'Ambroxol, Bromhexine, Acetylcysteine' },
    { catCode: 'RESPIRATORY', name: 'Inhaled Corticosteroids', code: 'RESP_ICS', desc: 'Budesonide, Fluticasone' },

    // Gastrointestinal
    { catCode: 'GASTROINTESTINAL', name: 'Proton Pump Inhibitors (PPIs)', code: 'GI_PPI', desc: 'Omeprazole, Pantoprazole, Esomeprazole' },
    { catCode: 'GASTROINTESTINAL', name: 'Antacids & Antiflatulents', code: 'GI_ANTACID', desc: 'Magaldrate, Simethicone' },
    { catCode: 'GASTROINTESTINAL', name: 'Antiemetics', code: 'GI_ANTIEMETIC', desc: 'Domperidone, Ondansetron' },
    { catCode: 'GASTROINTESTINAL', name: 'Laxatives', code: 'GI_LAXATIVE', desc: 'Bisacodyl, Lactulose' }
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

  // 3. Dosage Forms (Grouped)
  const dosageForms: { group: string; names: string[] }[] = [
    {
      group: 'Solid Forms',
      names: [
        'Tablets', 'Capsules', 'Effervescent Tablets', 'Chewable Tablets',
        'Sublingual Tablets', 'Dispersible Tablets', 'Orodispersible Tablets',
        'Powders', 'Granules', 'Pellets', 'Lozenges', 'Pastilles'
      ]
    },
    {
      group: 'Liquid Forms',
      names: [
        'Syrups', 'Suspensions', 'Solutions', 'Drops', 'Emulsions',
        'Elixirs', 'Tinctures', 'Mouthwashes', 'Gargles'
      ]
    },
    {
      group: 'Topical Forms',
      names: [
        'Creams', 'Ointments', 'Gels', 'Lotions', 'Topical Solutions',
        'Sprays', 'Dusting Powders', 'Patches', 'Liniments'
      ]
    },
    {
      group: 'Inhalation Forms',
      names: [
        'Inhalers', 'Metered Dose Inhalers (MDI)', 'Dry Powder Inhalers (DPI)',
        'Nebulizer Solutions', 'Inhalation Aerosols', 'Inhalation Powders',
        'Nasal Sprays', 'Nasal Drops', 'Nasal Solutions'
      ]
    },
    {
      group: 'Injectable Forms',
      names: [
        'Injections', 'Injectable Solutions', 'Injectable Suspensions',
        'Injectable Emulsions', 'Powder for Injection', 'Lyophilized Powder for Injection',
        'Prefilled Syringes', 'Injection Cartridges', 'Infusion Solutions',
        'Concentrates for Infusion'
      ]
    },
    {
      group: 'Ophthalmic & Otic Forms',
      names: [
        'Eye Drops', 'Eye Ointments', 'Eye Gels', 'Eye Solutions',
        'Eye Suspensions', 'Ear Drops', 'Ear Solutions', 'Ear Sprays'
      ]
    },
    {
      group: 'Rectal & Vaginal Forms',
      names: [
        'Suppositories', 'Rectal Creams', 'Rectal Ointments', 'Rectal Solutions',
        'Enemas', 'Vaginal Tablets', 'Vaginal Pessaries', 'Vaginal Creams',
        'Vaginal Gels', 'Vaginal Capsules', 'Vaginal Suppositories'
      ]
    },
    {
      group: 'Other Forms',
      names: [
        'Transdermal Patches', 'Medicated Films', 'Oral Films', 'Sublingual Films',
        'Oral Strips', 'Medicated Shampoos', 'Medicated Soaps', 'Medicated Foams',
        'Medicated Wipes', 'Dental Gels', 'Dental Pastes', 'Oral Sprays'
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

  // 4. Selling Units (30)
  const sellingUnits: { name: string; abbr: string; type: string; decimals: boolean }[] = [
    { name: 'Tablet', abbr: 'tab', type: 'COUNT', decimals: false },
    { name: 'Capsule', abbr: 'cap', type: 'COUNT', decimals: false },
    { name: 'Pill', abbr: 'pill', type: 'COUNT', decimals: false },
    { name: 'Strip', abbr: 'strip', type: 'PACKAGING', decimals: false },
    { name: 'Blister', abbr: 'blister', type: 'PACKAGING', decimals: false },
    { name: 'Sachet', abbr: 'sachet', type: 'COUNT', decimals: false },
    { name: 'Bottle', abbr: 'btl', type: 'PACKAGING', decimals: false },
    { name: 'Vial', abbr: 'vial', type: 'PACKAGING', decimals: false },
    { name: 'Ampoule', abbr: 'amp', type: 'PACKAGING', decimals: false },
    { name: 'Tube', abbr: 'tube', type: 'PACKAGING', decimals: false },
    { name: 'Pack', abbr: 'pack', type: 'PACKAGING', decimals: false },
    { name: 'Box', abbr: 'box', type: 'PACKAGING', decimals: false },
    { name: 'Inhaler', abbr: 'inh', type: 'COUNT', decimals: false },
    { name: 'Piece', abbr: 'pc', type: 'COUNT', decimals: false },
    { name: 'Unit', abbr: 'unit', type: 'COUNT', decimals: false },
    { name: 'Drop', abbr: 'drop', type: 'COUNT', decimals: false },
    { name: 'Millilitre (ml)', abbr: 'ml', type: 'VOLUME', decimals: true },
    { name: 'Litre (L)', abbr: 'L', type: 'VOLUME', decimals: true },
    { name: 'Gram (g)', abbr: 'g', type: 'WEIGHT', decimals: true },
    { name: 'Kilogram (kg)', abbr: 'kg', type: 'WEIGHT', decimals: true },
    { name: 'Microgram (mcg)', abbr: 'mcg', type: 'WEIGHT', decimals: true },
    { name: 'Patch', abbr: 'patch', type: 'COUNT', decimals: false },
    { name: 'Suppository', abbr: 'supp', type: 'COUNT', decimals: false },
    { name: 'Pessary', abbr: 'pess', type: 'COUNT', decimals: false },
    { name: 'Syringe', abbr: 'syr', type: 'COUNT', decimals: false },
    { name: 'Cartridge', abbr: 'cart', type: 'COUNT', decimals: false },
    { name: 'Roll', abbr: 'roll', type: 'COUNT', decimals: false },
    { name: 'Pair', abbr: 'pair', type: 'COUNT', decimals: false },
    { name: 'Set', abbr: 'set', type: 'COUNT', decimals: false },
    { name: 'Kit', abbr: 'kit', type: 'COUNT', decimals: false }
  ];

  for (const su of sellingUnits) {
    await prisma.sellingUnit.upsert({
      where: { name: su.name },
      update: { abbreviation: su.abbr, unitType: su.type, allowDecimals: su.decimals },
      create: {
        name: su.name,
        abbreviation: su.abbr,
        unitType: su.type,
        allowDecimals: su.decimals,
        isActive: true
      }
    });
  }

  // 5. Purchase Units
  const purchaseUnits: { name: string; abbr: string; desc?: string }[] = [
    { name: 'Box', abbr: 'box', desc: 'Standard secondary packaging box' },
    { name: 'Carton', abbr: 'ctn', desc: 'Outer shipping carton containing multiple boxes' },
    { name: 'Pack', abbr: 'pack', desc: 'Multi-item consumer or dispenser pack' },
    { name: 'Strip', abbr: 'strip', desc: 'Foil or plastic medicine strip' },
    { name: 'Bottle', abbr: 'btl', desc: 'Liquid, syrup, or tablet bottle' },
    { name: 'Vial', abbr: 'vial', desc: 'Sterile injection or solution vial' },
    { name: 'Piece', abbr: 'pc', desc: 'Single unit piece' },
    { name: 'Ampoule', abbr: 'amp', desc: 'Single-use glass ampoule' },
    { name: 'Tube', abbr: 'tube', desc: 'Ointment or cream tube' },
    { name: 'Tin', abbr: 'tin', desc: 'Metal container' },
    { name: 'Drum', abbr: 'drum', desc: 'Bulk liquid or powder drum' },
    { name: 'Crate', abbr: 'crate', desc: 'Wholesale delivery crate' },
    { name: 'Bundle', abbr: 'bdl', desc: 'Bound collection of packages' }
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

  console.log('✅ Medicine Classifications and Units successfully seeded!');
}

seedClassifications()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

