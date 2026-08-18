import PDFDocument from 'pdfkit';

export interface PdfRow {
  date: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  staffName: string;
}

export function buildPdf(title: string, rows: PdfRow[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text(title, { align: 'left' });
    doc.moveDown();
    doc.fontSize(10);
    for (const row of rows) {
      doc.text(`${row.date}  ${row.shiftName} (${row.startTime}-${row.endTime})  —  ${row.staffName}`);
    }
    doc.end();
  });
}
