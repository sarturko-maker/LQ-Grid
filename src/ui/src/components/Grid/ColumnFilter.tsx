import { useState } from 'react';
import { Search, X } from 'lucide-react';
import type { Column, Row } from '@/types';

interface ColumnFilterProps {
  column: Column;
  rows: Row[];
  value: string;
  onChange: (value: string) => void;
}

/** Render an appropriate filter input based on column type and content. */
export function ColumnFilter({ column, rows, value, onChange }: ColumnFilterProps) {
  const colType = column.type;

  // Boolean / enum columns → dropdown with distinct values
  if (colType === 'boolean' || colType === 'enum') {
    const options = distinctValues(column.id, rows);
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full text-[11px] px-1.5 py-1 border border-slate-200 rounded
                   bg-white text-slate-600 focus:ring-1 focus:ring-indigo-300 focus:outline-none">
        <option value="">All</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }

  // Text / string / date → search input
  return (
    <div className="relative">
      <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-300" />
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
        placeholder="Filter..."
        className="w-full text-[11px] pl-5 pr-5 py-1 border border-slate-200 rounded
                   bg-white text-slate-600 placeholder:text-slate-300
                   focus:ring-1 focus:ring-indigo-300 focus:outline-none" />
      {value && (
        <button onClick={() => onChange('')}
          className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-slate-300
                     hover:text-slate-500">
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

function distinctValues(colId: string, rows: Row[]): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    const cell = row.cells[colId];
    const val = cell?.display || cell?.value;
    if (val) seen.add(val);
  }
  return Array.from(seen).sort();
}
