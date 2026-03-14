import {
  MedicalClearanceStatus,
  PrismaClient,
  QualificationStatus,
  Role,
} from "@prisma/client";
import { v5 as uuidv5 } from "uuid";

const prisma = new PrismaClient();

const MOCK_USER_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
const DEMO_PASSWORD_HASH = "$2b$10$ZjJCuZWxfaG9NT8p6R6iV.7yMWy.kHequ/VpRsnTk/zp4ZkbdCPdi";

const employeeSeeds = [
  {
    id: uuidv5("employee@example.com", MOCK_USER_NAMESPACE),
    email: "employee@example.com",
    employeeNumber: "ECL-1001",
    firstName: "Avery",
    lastName: "Cole",
    role: Role.EMPLOYEE,
    departmentId: "MX-OPS",
    hireDate: new Date("2021-03-15T00:00:00.000Z"),
  },
  {
    id: uuidv5("supervisor@example.com", MOCK_USER_NAMESPACE),
    email: "supervisor@example.com",
    employeeNumber: "ECL-1002",
    firstName: "Jordan",
    lastName: "Nguyen",
    role: Role.SUPERVISOR,
    departmentId: "MX-OPS",
    hireDate: new Date("2018-07-09T00:00:00.000Z"),
  },
  {
    id: uuidv5("manager@example.com", MOCK_USER_NAMESPACE),
    email: "manager@example.com",
    employeeNumber: "ECL-1003",
    firstName: "Priya",
    lastName: "Shah",
    role: Role.MANAGER,
    departmentId: "MX-PLN",
    hireDate: new Date("2016-01-11T00:00:00.000Z"),
  },
  {
    id: uuidv5("compliance@example.com", MOCK_USER_NAMESPACE),
    email: "compliance@example.com",
    employeeNumber: "ECL-1004",
    firstName: "Elena",
    lastName: "Ramirez",
    role: Role.COMPLIANCE_OFFICER,
    departmentId: "QUALITY",
    hireDate: new Date("2019-09-23T00:00:00.000Z"),
  },
  {
    id: uuidv5("admin@example.com", MOCK_USER_NAMESPACE),
    email: "admin@example.com",
    employeeNumber: "ECL-1005",
    firstName: "Marcus",
    lastName: "Hill",
    role: Role.ADMIN,
    departmentId: "IT-ADMIN",
    hireDate: new Date("2017-05-01T00:00:00.000Z"),
  },
] as const;

const standardSeeds = [
  {
    code: "FAA-147-RT",
    name: "FAA Part 147 Recurrent Training",
    description: "Annual recurrent training baseline for airframe and powerplant technicians supporting repair station readiness.",
    issuingBody: "Federal Aviation Administration",
    version: "2026.1",
    requirements: [
      {
        category: "Airframe Systems",
        description: "Complete recurrent instruction on airframe systems, inspection practices, and documentation integrity.",
        minimumHours: "16.00",
        recertificationPeriodMonths: 12,
        requiredTests: ["closed-book practical assessment"],
      },
      {
        category: "Human Factors",
        description: "Review fatigue management, human factors, and error-prevention controls used on the line.",
        minimumHours: "8.00",
        recertificationPeriodMonths: 12,
        requiredTests: ["shift turnover scenario review"],
      },
    ],
  },
  {
    code: "OSHA-30-GI",
    name: "OSHA 30-Hour General Industry",
    description: "Supervisor-level workplace safety training for maintenance and operations teams.",
    issuingBody: "Occupational Safety and Health Administration",
    version: "2019",
    requirements: [
      {
        category: "Workplace Safety",
        description: "Cover hazard recognition, incident reporting, PPE usage, and emergency response expectations.",
        minimumHours: "30.00",
        recertificationPeriodMonths: 36,
        requiredTests: ["course completion certificate"],
      },
      {
        category: "Energy Control",
        description: "Review lockout-tagout controls for energized equipment maintenance and return-to-service checks.",
        minimumHours: "4.00",
        recertificationPeriodMonths: 24,
        requiredTests: ["lockout-tagout tabletop review"],
      },
    ],
  },
  {
    code: "HAZCOM-1910",
    name: "Hazard Communication 29 CFR 1910.1200",
    description: "Chemical safety, SDS handling, and labeling awareness for regulated shop environments.",
    issuingBody: "Occupational Safety and Health Administration",
    version: "2012",
    requirements: [
      {
        category: "Chemical Safety",
        description: "Review Safety Data Sheet interpretation, storage segregation, and spill-response expectations.",
        minimumHours: "6.00",
        recertificationPeriodMonths: 24,
        requiredTests: ["SDS lookup exercise"],
      },
    ],
  },
] as const;

const labelSeeds = [
  {
    code: "AIRFRAME",
    name: "Airframe Maintenance",
    description: "Hours, tasks, and evidence linked to airframe maintenance work.",
    effectiveDate: new Date("2025-01-01T00:00:00.000Z"),
    mappings: [{ hourCategory: "airframe_maintenance", version: 1, effectiveDate: new Date("2025-01-01T00:00:00.000Z") }],
  },
  {
    code: "POWERPLANT",
    name: "Powerplant Maintenance",
    description: "Hours and supporting records for engine and propulsion maintenance activities.",
    effectiveDate: new Date("2025-01-01T00:00:00.000Z"),
    mappings: [{ hourCategory: "powerplant_maintenance", version: 1, effectiveDate: new Date("2025-01-01T00:00:00.000Z") }],
  },
  {
    code: "SAFETY",
    name: "Safety & Compliance Training",
    description: "Structured training, drills, and compliance evidence for safety readiness.",
    effectiveDate: new Date("2025-01-01T00:00:00.000Z"),
    mappings: [{ hourCategory: "safety_training", version: 1, effectiveDate: new Date("2025-01-01T00:00:00.000Z") }],
  },
] as const;

const qualificationSeeds = [
  {
    employeeEmail: "employee@example.com",
    standardCode: "FAA-147-RT",
    certificationName: "A&P Recurrent Airframe Module",
    issuingBody: "Federal Aviation Administration",
    issueDate: new Date("2025-01-10T00:00:00.000Z"),
    expirationDate: new Date("2026-01-10T00:00:00.000Z"),
    status: QualificationStatus.ACTIVE,
  },
  {
    employeeEmail: "employee@example.com",
    standardCode: "OSHA-30-GI",
    certificationName: "OSHA 30-Hour General Industry",
    issuingBody: "Occupational Safety and Health Administration",
    issueDate: new Date("2024-02-14T00:00:00.000Z"),
    expirationDate: new Date("2027-02-14T00:00:00.000Z"),
    status: QualificationStatus.ACTIVE,
  },
  {
    employeeEmail: "supervisor@example.com",
    standardCode: "FAA-147-RT",
    certificationName: "Line Supervisor Recurrent Sign-Off",
    issuingBody: "Federal Aviation Administration",
    issueDate: new Date("2024-04-01T00:00:00.000Z"),
    expirationDate: new Date("2025-04-15T00:00:00.000Z"),
    status: QualificationStatus.EXPIRING_SOON,
  },
  {
    employeeEmail: "manager@example.com",
    standardCode: "OSHA-30-GI",
    certificationName: "OSHA 30-Hour General Industry",
    issuingBody: "Occupational Safety and Health Administration",
    issueDate: new Date("2023-11-20T00:00:00.000Z"),
    expirationDate: new Date("2026-11-20T00:00:00.000Z"),
    status: QualificationStatus.ACTIVE,
  },
  {
    employeeEmail: "compliance@example.com",
    standardCode: "HAZCOM-1910",
    certificationName: "Hazard Communication Coordinator",
    issuingBody: "Occupational Safety and Health Administration",
    issueDate: new Date("2024-09-05T00:00:00.000Z"),
    expirationDate: new Date("2026-09-05T00:00:00.000Z"),
    status: QualificationStatus.ACTIVE,
  },
  {
    employeeEmail: "admin@example.com",
    standardCode: "HAZCOM-1910",
    certificationName: "Facility Hazard Communication Awareness",
    issuingBody: "Occupational Safety and Health Administration",
    issueDate: new Date("2025-02-03T00:00:00.000Z"),
    expirationDate: new Date("2027-02-03T00:00:00.000Z"),
    status: QualificationStatus.PENDING_REVIEW,
  },
] as const;

const medicalClearanceSeeds = [
  {
    employeeEmail: "employee@example.com",
    clearanceType: "Respirator Clearance",
    status: MedicalClearanceStatus.CLEARED,
    effectiveDate: new Date("2024-08-01T00:00:00.000Z"),
    expirationDate: new Date("2025-08-01T00:00:00.000Z"),
    visualAcuityResult: "20/20 corrected",
    colorVisionResult: "Normal",
    issuedBy: "Aero Health Clinic",
  },
  {
    employeeEmail: "supervisor@example.com",
    clearanceType: "Respirator Clearance",
    status: MedicalClearanceStatus.CLEARED,
    effectiveDate: new Date("2024-06-15T00:00:00.000Z"),
    expirationDate: new Date("2025-06-15T00:00:00.000Z"),
    visualAcuityResult: "20/20 corrected",
    colorVisionResult: "Normal",
    issuedBy: "Aero Health Clinic",
  },
  {
    employeeEmail: "manager@example.com",
    clearanceType: "Annual Occupational Physical",
    status: MedicalClearanceStatus.PENDING,
    effectiveDate: new Date("2025-01-05T00:00:00.000Z"),
    expirationDate: new Date("2026-01-05T00:00:00.000Z"),
    visualAcuityResult: "20/25 corrected",
    colorVisionResult: "Normal",
    issuedBy: "Westside Occupational Health",
  },
] as const;

async function upsertEmployees() {
  await Promise.all(
    employeeSeeds.map((employee) =>
      prisma.employee.upsert({
        where: { email: employee.email },
        update: {
          employeeNumber: employee.employeeNumber,
          firstName: employee.firstName,
          lastName: employee.lastName,
          passwordHash: DEMO_PASSWORD_HASH,
          role: employee.role,
          departmentId: employee.departmentId,
          hireDate: employee.hireDate,
          isActive: true,
        },
        create: {
          ...employee,
          passwordHash: DEMO_PASSWORD_HASH,
          isActive: true,
        },
      }),
    ),
  );

  const employees = await prisma.employee.findMany({
    where: { email: { in: employeeSeeds.map((employee) => employee.email) } },
  });

  return new Map(employees.map((employee) => [employee.email, employee]));
}

async function upsertStandards() {
  await Promise.all(
    standardSeeds.map(({ requirements: _requirements, ...standard }) =>
      prisma.complianceStandard.upsert({
        where: { code: standard.code },
        update: standard,
        create: standard,
      }),
    ),
  );

  const standards = await prisma.complianceStandard.findMany({
    where: { code: { in: standardSeeds.map((standard) => standard.code) } },
  });
  const standardsByCode = new Map(standards.map((standard) => [standard.code, standard]));

  await prisma.standardRequirement.deleteMany({
    where: { standardId: { in: standards.map((standard) => standard.id) } },
  });

  await prisma.standardRequirement.createMany({
    data: standardSeeds.flatMap((standard) =>
      standard.requirements.map((requirement) => ({
        ...requirement,
        requiredTests: [...requirement.requiredTests],
        standardId: standardsByCode.get(standard.code)!.id,
      })),
    ),
  });

  return standardsByCode;
}

async function upsertLabels() {
  await Promise.all(
    labelSeeds.map(({ mappings: _mappings, ...label }) =>
      prisma.label.upsert({
        where: { code: label.code },
        update: label,
        create: label,
      }),
    ),
  );

  const labels = await prisma.label.findMany({
    where: { code: { in: labelSeeds.map((label) => label.code) } },
  });
  const labelsByCode = new Map(labels.map((label) => [label.code, label]));

  await prisma.labelMapping.deleteMany({
    where: { labelId: { in: labels.map((label) => label.id) } },
  });

  await prisma.labelMapping.createMany({
    data: labelSeeds.flatMap((label) =>
      label.mappings.map((mapping) => ({
        ...mapping,
        labelId: labelsByCode.get(label.code)!.id,
      })),
    ),
  });

  await prisma.taxonomyVersion.upsert({
    where: { versionNumber: 1 },
    update: {
      changeLog: "Initial workforce compliance taxonomy baseline for local demo environments.",
      migrationRules: {
        labels: labelSeeds.map((label) => label.code),
        standards: standardSeeds.map((standard) => standard.code),
      },
      publishedAt: new Date("2025-01-01T00:00:00.000Z"),
    },
    create: {
      versionNumber: 1,
      changeLog: "Initial workforce compliance taxonomy baseline for local demo environments.",
      migrationRules: {
        labels: labelSeeds.map((label) => label.code),
        standards: standardSeeds.map((standard) => standard.code),
      },
      publishedAt: new Date("2025-01-01T00:00:00.000Z"),
    },
  });
}

async function seedComplianceData() {
  const employeesByEmail = await upsertEmployees();
  const standardsByCode = await upsertStandards();
  await upsertLabels();

  const employeeIds = Array.from(employeesByEmail.values()).map((employee) => employee.id);

  await prisma.qualification.deleteMany({
    where: { employeeId: { in: employeeIds } },
  });

  await prisma.medicalClearance.deleteMany({
    where: { employeeId: { in: employeeIds } },
  });

  await prisma.qualification.createMany({
    data: qualificationSeeds.map((qualification) => ({
      employeeId: employeesByEmail.get(qualification.employeeEmail)!.id,
      standardId: standardsByCode.get(qualification.standardCode)!.id,
      certificationName: qualification.certificationName,
      issuingBody: qualification.issuingBody,
      issueDate: qualification.issueDate,
      expirationDate: qualification.expirationDate,
      status: qualification.status,
    })),
  });

  await prisma.medicalClearance.createMany({
    data: medicalClearanceSeeds.map((clearance) => ({
      employeeId: employeesByEmail.get(clearance.employeeEmail)!.id,
      clearanceType: clearance.clearanceType,
      status: clearance.status,
      effectiveDate: clearance.effectiveDate,
      expirationDate: clearance.expirationDate,
      visualAcuityResult: clearance.visualAcuityResult,
      colorVisionResult: clearance.colorVisionResult,
      issuedBy: clearance.issuedBy,
    })),
  });

  return {
    employees: employeesByEmail.size,
    standards: standardsByCode.size,
    qualifications: qualificationSeeds.length,
    labels: labelSeeds.length,
    medicalClearances: medicalClearanceSeeds.length,
  };
}

async function main() {
  console.log("🌱 Seeding workforce compliance demo data...");

  const counts = await seedComplianceData();

  console.log(
    `✅ Seed complete: ${counts.employees} employees, ${counts.standards} standards, ${counts.qualifications} qualifications, ${counts.labels} labels, ${counts.medicalClearances} medical clearances.`,
  );
}

main()
  .catch((error) => {
    console.error("❌ Seed failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
