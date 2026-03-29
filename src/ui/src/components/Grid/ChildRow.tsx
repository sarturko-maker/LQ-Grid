import React from 'react';
import { flexRender, type Row as TRow } from '@tanstack/react-table';
import type { Row } from '@/types';

interface ChildRowProps {
  row: TRow<Row>;
  onDocClick: (id: string) => void;
}

/** Indented child document row under a group. */
export function ChildRow({ row, onDocClick }: ChildRowProps) {
  return (
    <tr className="bg-slate-50/30 hover:bg-slate-100/60 transition-colors duration-100
                   border-l-2 border-l-indigo-200">
      {row.getVisibleCells().map((cell, i) => {
        // Row number cell (index 0) — show empty for child rows
        if (i === 0) {
          return <td key={cell.id} className="px-2 py-3 border-b border-r border-slate-200 bg-slate-50 w-10" />;
        }
        // Document cell (index 1) — indented with connector
        if (i === 1) {
          return (
            <td key={cell.id}
              className="p-3 border-b border-r border-slate-200 bg-slate-50
                         sticky left-10 z-10 w-56 min-w-56 cursor-pointer pl-8
                         shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]"
              onClick={() => onDocClick(row.original._id)}>
              <div className="flex items-center gap-2 text-slate-500">
                <span className="text-indigo-300 text-[10px]">└</span>
                <span className="text-xs truncate hover:text-indigo-600 transition-colors"
                  title={row.original._document}>{row.original._document}</span>
              </div>
            </td>
          );
        }
        return (
          <React.Fragment key={cell.id}>
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </React.Fragment>
        );
      })}
    </tr>
  );
}
