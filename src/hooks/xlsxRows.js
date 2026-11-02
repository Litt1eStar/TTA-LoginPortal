// Reads the first sheet of an .xlsx/.xls file into rows of trimmed strings, the same shape parseCsvText returns.
// Loaded with import() only when a user picks an Excel file, so SheetJS stays out of the main bundle.
import { read, utils } from 'xlsx';

export const parseXlsxBuffer = (buffer) => {
  const wb = read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  // raw: false → cells as displayed text, so "081-234-5678" or a text-formatted "0812345678" keep their zeros
  return utils.sheet_to_json(ws, { header: 1, raw: false, defval: '', blankrows: false })
    .map(row => row.map(cell => String(cell ?? '').trim()))
    .filter(row => row.some(cell => cell.length > 0));
};
