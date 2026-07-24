/**
 * Deterministic seed (CLAUDE.md #7: mock data is first-class). Mirrors the bms mock
 * spine (the Okonkwo & Mensah household), so once the app is wired to this API it
 * returns the same data the mock does today. Run in the deploy env after migrate + rls.
 */
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TENANT = 'tenant-klc';
const json = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

const mailingAddress = { line1: '42 Sunnybrae Crescent', city: 'Brampton', province: 'ON', postalCode: 'L6Z 1R6' };
const namedInsured = { firstName: 'Amara', lastName: 'Okonkwo', dateOfBirth: '1986-04-12', mailingAddress };

const autoRisk = {
  line: 'auto',
  party: { householdId: 'OKONKA01', clientId: 'CL-AMARA' },
  effectiveDate: '2025-12-24',
  province: 'ON',
  namedInsured,
  drivers: [
    { id: 'drv-1', firstName: 'Amara', lastName: 'Okonkwo', dateOfBirth: '1986-04-12', relationshipToApplicant: 'applicant', licence: { number: 'O1234-56789-01234', province: 'ON', class: 'G', dateFirstLicensed: '2004-05-01' }, driverTrainingCertified: true, convictions: [] },
    { id: 'drv-2', firstName: 'Daniel', lastName: 'Mensah', dateOfBirth: '1984-09-30', relationshipToApplicant: 'spouse', licence: { number: 'M9876-54321-09876', province: 'ON', class: 'G', dateFirstLicensed: '2002-11-20' }, driverTrainingCertified: false, convictions: [] },
  ],
  vehicles: [
    { id: 'veh-1', year: 2022, make: 'Toyota', model: 'RAV4', vin: '2T3P1RFV5NW123456', primaryDriverId: 'drv-1', use: 'commute', annualKm: 18000, ownership: 'financed', physicalDamage: { collision: { elected: true, deductible: { kind: 'amount', value: { currency: 'CAD', amountCents: 100000 } } }, comprehensive: { elected: true, deductible: { kind: 'amount', value: { currency: 'CAD', amountCents: 100000 } } } }, endorsements: [] },
  ],
  coverages: {
    liabilityLimit: { kind: 'amount', value: { currency: 'CAD', amountCents: 100000000 } },
    accidentBenefits: { package: 'sabs_standard', optionalElections: [{ benefit: 'increased_medical_rehab', elected: true, limit: { kind: 'amount', value: { currency: 'CAD', amountCents: 100000000 } } }] },
    directCompensationPropertyDamage: { kind: 'included' },
    uninsuredAutomobile: { kind: 'included' },
    endorsements: [],
  },
  history: { priorInsurer: 'Maple Mutual', priorPolicyNumber: 'MM-889-2201', continuousYearsInsured: 6, cancellations: [], atFaultClaims: [] },
};

const propertyRisk = {
  line: 'property',
  party: { householdId: 'OKONKA01', clientId: 'CL-AMARA' },
  effectiveDate: '2025-12-24',
  province: 'ON',
  namedInsured,
  riskAddress: { line1: '128 Chinguacousy Road', city: 'Brampton', province: 'ON', postalCode: 'L6Y 2R4' },
  dwellingType: 'detached',
  occupancy: 'owner_occupied',
  construction: { yearBuilt: 1998, storeys: 2, squareFeet: 2100, wall: 'brick_veneer', roof: 'asphalt_shingle', heating: 'forced_air_gas', electrical: 'breakers_200_amp', plumbing: 'copper_pex', basement: 'finished' },
  protection: { hydrantDistance: 'within_300m', fireHallDistance: 'within_5km', alarm: 'fire_and_burglary', monitored: true },
  coverages: {
    dwellingA: { kind: 'amount', value: { currency: 'CAD', amountCents: 68400000 } },
    detachedStructuresB: { kind: 'amount', value: { currency: 'CAD', amountCents: 6840000 } },
    contentsC: { kind: 'amount', value: { currency: 'CAD', amountCents: 47880000 } },
    additionalLivingD: { kind: 'amount', value: { currency: 'CAD', amountCents: 13680000 } },
    personalLiabilityE: { kind: 'amount', value: { currency: 'CAD', amountCents: 100000000 } },
    voluntaryMedicalF: { kind: 'amount', value: { currency: 'CAD', amountCents: 500000 } },
    deductible: { kind: 'amount', value: { currency: 'CAD', amountCents: 250000 } },
    endorsements: [],
  },
  interests: [{ id: 'int-1', type: 'mortgagee', name: 'First Dominion Bank', reference: 'FD-88213307' }],
};

async function main(): Promise<void> {
  await prisma.tenant.upsert({ where: { id: TENANT }, update: {}, create: { id: TENANT, name: 'KLC Group' } });

  await prisma.household.upsert({
    where: { id: 'OKONKA01' },
    update: {},
    create: { id: 'OKONKA01', tenantId: TENANT, code: 'OKONKA01', displayName: 'Amara Okonkwo & Daniel Mensah', email: 'amara.okonkwo@email.ca', phone: '(647) 555-0182', primaryContact: json(namedInsured) },
  });

  await prisma.policy.upsert({
    where: { id: 'pol-okonkwo-auto' },
    update: {},
    create: { id: 'pol-okonkwo-auto', tenantId: TENANT, householdId: 'OKONKA01', policyNumber: 'A21677149PLA', line: 'auto', carrier: 'True North P&C', status: 'in_force', effectiveDate: new Date('2025-12-24'), expiresOn: new Date('2026-12-24'), risk: json(autoRisk) },
  });
  await prisma.policy.upsert({
    where: { id: 'pol-okonkwo-home' },
    update: {},
    create: { id: 'pol-okonkwo-home', tenantId: TENANT, householdId: 'OKONKA01', policyNumber: 'H55231887HAB', line: 'property', carrier: 'Laurier Insurance', status: 'in_force', effectiveDate: new Date('2025-12-24'), expiresOn: new Date('2026-12-24'), risk: json(propertyRisk) },
  });

  await prisma.quoteShop.upsert({
    where: { id: 'shop-okonkwo-1' },
    update: {},
    create: { id: 'shop-okonkwo-1', tenantId: TENANT, householdId: 'OKONKA01', purpose: 'new_business', requestedBy: 'user-rina', riskRef: json({ riskId: 'risk-auto-1', version: 1 }), createdAt: new Date('2026-06-15T11:42:00.000Z') },
  });

  const results = [
    { id: 'shop-okonkwo-1-MM', carrierId: 'MM', carrierName: 'Maple Mutual', source: 'manual', outcome: 'quoted', provenance: 'firm', premiumCents: 320400, coverageVariant: 'AUTO — $1M TPL, $1,000 collision/comp', presentedToClient: true, simulated: false, respondedAt: new Date('2026-06-15T11:40:00.000Z') },
    { id: 'shop-okonkwo-1-TN', carrierId: 'TN', carrierName: 'True North P&C', source: 'portal', outcome: 'quoted', provenance: 'firm', premiumCents: 346000, coverageVariant: 'AUTO — bundled with home', presentedToClient: true, simulated: false, respondedAt: new Date('2026-06-15T11:41:00.000Z') },
    { id: 'shop-okonkwo-1-CG', carrierId: 'CG', carrierName: 'Cascadia General', source: 'api', outcome: 'declined', provenance: 'firm', declineReason: 'Not writing this driver profile in the GTA this quarter.', presentedToClient: false, simulated: false, respondedAt: new Date('2026-06-15T11:39:00.000Z') },
  ];
  for (const r of results) {
    await prisma.quoteResult.upsert({ where: { id: r.id }, update: {}, create: { ...r, tenantId: TENANT, shopId: 'shop-okonkwo-1' } });
  }

  const renewals = [
    { id: 'ren-okonkwo', policyRef: 'A21677149PLA', householdId: 'OKONKA01', line: 'auto', expiringPremiumCents: 360000 },
    { id: 'ren-tremblay', policyRef: 'H55231887HAB', householdId: 'TREMBL02', line: 'property', expiringPremiumCents: 185000 },
    { id: 'ren-boychuk', policyRef: 'C88120043CON', householdId: 'BOYCHU03', line: 'property', expiringPremiumCents: 98000 },
  ];
  for (const r of renewals) {
    await prisma.renewalTransaction.upsert({ where: { id: r.id }, update: {}, create: { ...r, tenantId: TENANT, effectiveDate: new Date('2026-12-24'), status: 'due' } });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
