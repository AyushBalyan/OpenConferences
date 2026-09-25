import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { OutreachRawRecipientRow } from '@openconferences/schemas';
import { OUTREACH_MAX_RECIPIENTS } from '@openconferences/schemas';

export const OUTREACH_FILE_MAX_BYTES = 2_097_152;

const HEADER_MAP: Record<string, 'name' | 'email' | 'topic' | 'paper'> = {
  name: 'name',
  email: 'email',
  topic: 'topic',
  paper: 'paper',
  'paper title': 'paper',
  papertitle: 'paper',
  paper_title: 'paper',
};

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

function mapHeader(value: string): 'name' | 'email' | 'topic' | 'paper' | null {
  return HEADER_MAP[normalizeHeader(value)] ?? null;
}

function cellString(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

export type ParsedSpreadsheet = {
  rows: OutreachRawRecipientRow[];
  error?: string;
};

function fromMatrix(matrix: unknown[][]): ParsedSpreadsheet {
  if (matrix.length < 2) {
    return { rows: [], error: 'The file must include a header row and at least one data row.' };
  }

  const headers = (matrix[0] ?? []).map((value) => mapHeader(cellString(value)));
  if (!headers.includes('name') || !headers.includes('email')) {
    return {
      rows: [],
      error: 'The file must include name and email columns. Optional columns: topic, paper.',
    };
  }

  const dataRows = matrix.slice(1).filter((row) => row.some((cell) => cellString(cell) !== ''));
  if (dataRows.length > OUTREACH_MAX_RECIPIENTS) {
    return {
      rows: [],
      error: `Too many rows (${dataRows.length}). Maximum is ${OUTREACH_MAX_RECIPIENTS}.`,
    };
  }

  const rows: OutreachRawRecipientRow[] = dataRows.map((row, index) => {
    const mapped: OutreachRawRecipientRow = {
      rowNumber: index + 2,
      name: '',
      email: '',
      topic: '',
      paper: '',
    };
    headers.forEach((key, columnIndex) => {
      if (!key) return;
      mapped[key] = cellString(row[columnIndex]);
    });
    return mapped;
  });

  return { rows };
}

export async function parseOutreachSpreadsheet(file: File): Promise<ParsedSpreadsheet> {
  if (file.size > OUTREACH_FILE_MAX_BYTES) {
    return { rows: [], error: 'File is too large. Maximum size is 2 MB.' };
  }
  if (file.size === 0) {
    return { rows: [], error: 'The selected file is empty.' };
  }

  const name = file.name.toLowerCase();
  if (name.endsWith('.csv') || file.type === 'text/csv') {
    const text = await file.text();
    const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true });
    if (parsed.errors.length > 0 && (!parsed.data || parsed.data.length === 0)) {
      return { rows: [], error: parsed.errors[0]?.message ?? 'Unable to parse CSV.' };
    }
    return fromMatrix(parsed.data);
  }

  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return { rows: [], error: 'The spreadsheet has no sheets.' };
    }
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      return { rows: [], error: 'The spreadsheet has no sheets.' };
    }
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
    return fromMatrix(matrix);
  }

  return { rows: [], error: 'Upload a CSV or Excel (.xlsx) file.' };
}

export function isOutreachSpreadsheet(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith('.csv') ||
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    file.type === 'text/csv' ||
    file.type === 'application/vnd.ms-excel' ||
    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
}
