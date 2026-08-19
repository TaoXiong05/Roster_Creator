// Displays dates as DD/MM/YYYY throughout the app, matching Australian date conventions.
// Accepts a plain "YYYY-MM-DD" date or a full ISO datetime string ("YYYY-MM-DDTHH:mm:ss.sssZ").
export function formatDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}
