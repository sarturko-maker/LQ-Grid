/**
 * Client-side CSV and XLSX export.
 * No server needed — runs entirely in the browser.
 */

import * as XLSX from 'xlsx/xlsx.mjs';
import type { Manifest } from '@/types';

/** Export to Excel (.xlsx) with coloured headers */
export function exportXLSX(manifest: Manifest): void {
  const columns = manifest.columns;
  const rows = manifest.rows;

  // Build worksheet data
  const wsData: string[][] = [];

  // Header row
  wsData.push(['Document', ...columns.map((c) => c.label)]);

  // Data rows
  for (const row of rows) {
    wsData.push([
      row._document,
      ...columns.map((col) => {
        const cell = row.cells[col.id];
        return cell?.display || cell?.value || '';
      }),
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws['!cols'] = [
    { wch: 35 }, // Document
    ...columns.map(() => ({ wch: 25 })),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, manifest.job.name.slice(0, 31));

  // Summary sheet
  const summaryData = [
    ['Job Name', manifest.job.name],
    ['Created', manifest.job.created_at],
    ['Documents', String(manifest.job.document_count)],
    ['Columns', String(manifest.job.column_count)],
    ['Total Cells', String(manifest.summary.total_cells)],
    ['Complete', String(manifest.summary.complete)],
    ['Failed', String(manifest.summary.failed)],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(summaryData);
  ws2['!cols'] = [{ wch: 15 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Summary');

  XLSX.writeFile(wb, `${safeName(manifest.job.name)}_export.xlsx`);
}

/** Export to CSV */
export function exportCSV(manifest: Manifest): void {
  const columns = manifest.columns;
  const rows = manifest.rows;

  const headers = ['Document', ...columns.map((c) => c.label)];

  const csvRows = rows.map((row) => [
    escapeCsv(row._document),
    ...columns.map((col) => {
      const cell = row.cells[col.id];
      return escapeCsv(cell?.display || cell?.value || '');
    }),
  ].join(','));

  const csv = [headers.map(escapeCsv).join(','), ...csvRows].join('\n');
  downloadString(csv, `${safeName(manifest.job.name)}_export.csv`, 'text/csv');
}

function escapeCsv(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase();
}

function downloadString(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
