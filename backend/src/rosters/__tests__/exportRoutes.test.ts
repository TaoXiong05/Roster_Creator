import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import ExcelJS from 'exceljs';

// application/vnd.openxmlformats-... isn't in superagent's default bufferable-content-types list,
// so without this the response body would come back empty instead of the actual xlsx bytes.
function bufferedRequest(app: import('express').Express, url: string) {
  return request(app)
    .get(url)
    .buffer(true)
    .parse((res, callback) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => callback(null, Buffer.concat(chunks)));
    });
}

async function loadWorkbook(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  return workbook.worksheets[0];
}

vi.mock('../../db', () => ({
  prisma: { roster: { findUnique: vi.fn() }, responsibilityTemplate: { findMany: vi.fn() } },
}));

import { prisma } from '../../db';
import { createApp } from '../../app';
import { signToken } from '../../auth/jwt';

const app = createApp();
const authCookie = `token=${signToken({ userId: 'user-1' })}`;

const rosterFixture = {
  id: 'roster-1',
  userId: 'user-1',
  name: 'Week 34',
  status: 'published',
  dateRangeStart: new Date('2026-08-17'),
  dateRangeEnd: new Date('2026-08-23'),
  rosterShifts: [
    {
      date: new Date('2026-08-17'),
      responsibilityId: 'resp-1',
      shiftTemplate: { name: 'Morning', startTime: '06:00', endTime: '14:00' },
      assignments: [
        { staffId: 'staff-1', staff: { id: 'staff-1', name: 'Alice' } },
        { staffId: null, staff: null, unfilledTag: null },
      ],
    },
  ],
};

function mockResponsibilities() {
  (prisma.responsibilityTemplate.findMany as any).mockResolvedValue([{ id: 'resp-1', name: 'Cashier' }]);
}

describe('GET /rosters/:id/export/ics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResponsibilities();
  });

  it("returns 404 for another user's roster", async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({ id: 'roster-1', userId: 'someone-else' });

    const res = await request(app).get('/rosters/roster-1/export/ics').set('Cookie', authCookie);

    expect(res.status).toBe(404);
  });

  it('rejects exporting when the roster is not published', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({ ...rosterFixture, status: 'preview' });

    const res = await request(app).get('/rosters/roster-1/export/ics').set('Cookie', authCookie);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Publish this roster before exporting it' });
  });

  it('returns an ics calendar with the role name and a marked entry for unfilled slots', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue(rosterFixture);

    const res = await request(app).get('/rosters/roster-1/export/ics').set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/calendar');
    expect(res.text).toContain('SUMMARY:Morning · Cashier (Alice)');
    expect(res.text).toContain('SUMMARY:⚠ UNFILLED - Morning · Cashier');
    // DTSTART must stay in iCalendar's compact numeric format, not the DD/MM/YYYY display format used elsewhere.
    expect(res.text).toContain('DTSTART:20260817T060000');
  });

  it('filters to a single staff member when staffId is given, excluding unfilled slots', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({
      ...rosterFixture,
      rosterShifts: [
        {
          ...rosterFixture.rosterShifts[0],
          assignments: [
            { staffId: 'staff-1', staff: { id: 'staff-1', name: 'Alice' } },
            { staffId: 'staff-2', staff: { id: 'staff-2', name: 'Bob' } },
            { staffId: null, staff: null, unfilledTag: null },
          ],
        },
      ],
    });

    const res = await request(app).get('/rosters/roster-1/export/ics?staffId=staff-2').set('Cookie', authCookie);

    expect(res.text).toContain('Bob');
    expect(res.text).not.toContain('Alice');
    expect(res.text).not.toContain('UNFILLED');
  });

  it('includes only unfilled slots when unfilledOnly=true', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue(rosterFixture);

    const res = await request(app).get('/rosters/roster-1/export/ics?unfilledOnly=true').set('Cookie', authCookie);

    expect(res.text).toContain('⚠ UNFILLED - Morning · Cashier');
    expect(res.text).not.toContain('(Alice)');
  });
});

describe('GET /rosters/:id/export/xlsx', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResponsibilities();
  });

  function cellValues(sheet: ExcelJS.Worksheet): string[] {
    const values: string[] = [];
    sheet.eachRow((row) => row.eachCell({ includeEmpty: false }, (cell) => values.push(String(cell.value ?? ''))));
    return values;
  }

  function findCell(sheet: ExcelJS.Worksheet, value: string): ExcelJS.Cell | undefined {
    let found: ExcelJS.Cell | undefined;
    sheet.eachRow((row) =>
      row.eachCell({ includeEmpty: false }, (cell) => {
        if (cell.value === value) found = cell;
      })
    );
    return found;
  }

  it('rejects exporting when the roster is not published', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({ ...rosterFixture, status: 'draft' });

    const res = await request(app).get('/rosters/roster-1/export/xlsx').set('Cookie', authCookie);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Publish this roster before exporting it' });
  });

  it('returns a workbook with the role column, and week/day banner rows', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue(rosterFixture);

    const res = await bufferedRequest(app, '/rosters/roster-1/export/xlsx').set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    const sheet = await loadWorkbook(res.body);
    const values = cellValues(sheet);
    expect(values).toEqual(expect.arrayContaining(['Shift', 'Role', 'Start', 'End', 'Staff', 'Alice', 'Cashier']));
    expect(values.some((v) => v.includes('Week of'))).toBe(true);
    expect(values.some((v) => v.includes('17/08/2026'))).toBe(true);
  });

  it('marks an unfilled slot in the Staff column, highlighted apart from the week/day bands', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue(rosterFixture);

    const res = await bufferedRequest(app, '/rosters/roster-1/export/xlsx').set('Cookie', authCookie);

    const sheet = await loadWorkbook(res.body);
    const cell = findCell(sheet, 'UNFILLED');
    expect(cell).toBeDefined();
    const fill = cell!.fill as ExcelJS.FillPattern;
    expect(fill.fgColor?.argb).not.toBe('FFFCE8CE'); // week band tan
    expect(fill.fgColor?.argb).not.toBe('FFFFF3E2'); // day band tan
  });

  it('includes the unfilledTag in the Staff cell when one is set', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({
      ...rosterFixture,
      rosterShifts: [
        {
          ...rosterFixture.rosterShifts[0],
          assignments: [{ staffId: null, staff: null, unfilledTag: 'PICKUP' }],
        },
      ],
    });

    const res = await bufferedRequest(app, '/rosters/roster-1/export/xlsx').set('Cookie', authCookie);

    const sheet = await loadWorkbook(res.body);
    expect(findCell(sheet, 'UNFILLED (PICKUP)')).toBeDefined();
  });

  it('includes only unfilled rows when unfilledOnly=true', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue(rosterFixture);

    const res = await bufferedRequest(app, '/rosters/roster-1/export/xlsx?unfilledOnly=true').set('Cookie', authCookie);

    const sheet = await loadWorkbook(res.body);
    const values = cellValues(sheet);
    expect(values).toContain('UNFILLED');
    expect(values).not.toContain('Alice');
  });
});

describe('GET /rosters/:id/export/pdf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResponsibilities();
  });

  it('rejects exporting when the roster is not published', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({ ...rosterFixture, status: 'generating' });

    const res = await request(app).get('/rosters/roster-1/export/pdf').set('Cookie', authCookie);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Publish this roster before exporting it' });
  });

  it('returns a pdf document', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue(rosterFixture);

    const res = await request(app).get('/rosters/roster-1/export/pdf').set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
  });

  it('returns a pdf document when unfilledOnly=true', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue(rosterFixture);

    const res = await request(app).get('/rosters/roster-1/export/pdf?unfilledOnly=true').set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
  });
});
