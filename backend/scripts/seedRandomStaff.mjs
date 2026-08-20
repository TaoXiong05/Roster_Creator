// Seeds N random staff (with random roles and preferences) for a given user account.
// Usage: node scripts/seedRandomStaff.mjs <userId> [count]

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FIRST_NAMES = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Jamie', 'Avery', 'Quinn', 'Cameron', 'Sam', 'Drew'];
const LAST_NAMES = ['Chen', 'Smith', 'Nguyen', 'Garcia', 'Kim', 'Patel', 'Brown', 'Lopez', 'Wilson', 'Davis', 'Zhang', 'Martinez'];
const HOURS_PERIODS = ['weekly', 'weekly', 'weekly', 'fortnightly', 'monthly'];
const HOURS_UNITS = ['hours', 'hours', 'shifts'];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomWeekdayShiftPairs(templateIds, count) {
  const pairs = [];
  const seen = new Set();
  let attempts = 0;
  while (pairs.length < count && attempts < count * 10) {
    attempts++;
    const weekday = randomInt(0, 6);
    const shiftTemplateId = pick(templateIds);
    const key = `${weekday}:${shiftTemplateId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push({ weekday, shiftTemplateId });
  }
  return pairs;
}

function randomDateRange() {
  const startOffset = randomInt(1, 60);
  const span = randomInt(1, 4);
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + startOffset);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + span);
  const iso = (d) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

async function main() {
  const userId = process.argv[2];
  const count = Number(process.argv[3] ?? 10);
  if (!userId) {
    console.error('Usage: node scripts/seedRandomStaff.mjs <userId> [count]');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    console.error(`No user found with id ${userId}`);
    process.exit(1);
  }

  const responsibilities = await prisma.responsibilityTemplate.findMany({ where: { userId } });
  const shiftTemplates = await prisma.shiftTemplate.findMany({ where: { userId } });
  if (responsibilities.length === 0) {
    console.error('This account has no responsibility templates yet — create at least one first.');
    process.exit(1);
  }
  if (shiftTemplates.length === 0) {
    console.error('This account has no shift templates yet — create at least one first.');
    process.exit(1);
  }
  const templateIds = shiftTemplates.map((t) => t.id);

  const usedNames = new Set();
  const created = [];

  for (let i = 0; i < count; i++) {
    let name;
    do {
      name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
    } while (usedNames.has(name));
    usedNames.add(name);

    const email = `${name.toLowerCase().replace(/\s+/g, '.')}.${randomInt(100, 999)}@example.com`;
    const responsibilityIds = pickN(
      responsibilities.map((r) => r.id),
      randomInt(1, Math.min(3, responsibilities.length))
    );

    const staff = await prisma.staff.create({
      data: { userId, name, email, responsibilityIds },
    });

    const minHours = randomInt(8, 20);
    const maxHours = minHours + randomInt(10, 20);
    const preferredShifts = randomWeekdayShiftPairs(templateIds, randomInt(2, 4));
    const unavailableShifts = randomWeekdayShiftPairs(templateIds, randomInt(1, 3));
    const unavailableDateRanges = Math.random() < 0.3 ? [randomDateRange()] : [];

    await prisma.preference.create({
      data: {
        staffId: staff.id,
        minHours,
        maxHours,
        hoursPeriod: pick(HOURS_PERIODS),
        hoursUnit: pick(HOURS_UNITS),
        preferredShifts,
        unavailableShifts,
        unavailableDateRanges,
      },
    });

    created.push({ name, email, responsibilityIds, minHours, maxHours });
  }

  console.log(`Created ${created.length} random staff for ${user.email}:`);
  for (const c of created) {
    console.log(`  - ${c.name} <${c.email}> roles=${c.responsibilityIds.length} minHours=${c.minHours} maxHours=${c.maxHours}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
