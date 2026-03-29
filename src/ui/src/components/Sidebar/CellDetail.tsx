import { X, Copy, MapPin, MessageSquare, AlertTriangle, FileSearch } from 'lucide-react';
import type { Cell, Column, Row, VerificationEntry } from '@/types';
import { CellActionBar } from './CellActionBar';

interface CellDetailProps {
  row: Row;
  column: Column;
  cell: Cell;
  verification: VerificationEntry | null;
  onVerify: (note?: string) => void;
  onFlag: (note: string) => void;
  onOverride: (value: string, note?: string) => void;
  onClear: () => void;
  onClose: () => void;
  onViewSource?: (rowId: string, quote: string, start?: number, end?: number) => void;
}

export function CellDetail({
  row, column, cell, verification,
  onVerify, onFlag, onOverride, onClear, onClose, onViewSource,
}: CellDetailProps) {
  const displayValue = verification?.override || cell.display;

  return (
    <div className="h-full flex flex-col bg-white animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
            Cell Detail
          </p>
          <p className="text-sm font-semibold text-slate-800 truncate max-w-[250px]">
            {row._document}
          </p>
        </div>
        <button onClick={onClose}
          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <span className="text-xs font-bold text-slate-500 uppercase bg-slate-100 px-2 py-1 rounded">
          {column.label}
        </span>

        <div className="text-base text-slate-900 font-medium leading-relaxed">
          {displayValue}
          {verification?.override && (
            <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
              overridden
            </span>
          )}
        </div>

        {cell.source_quote && (
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase mb-1.5">Source Quote</h4>
            <blockquote className="p-3 bg-amber-50 border-l-2 border-amber-300 rounded-r-lg
                                   text-sm text-slate-700 italic leading-relaxed">
              "{cell.source_quote}"
            </blockquote>
            {cell.source_location && (
              <div className="flex items-center gap-1 mt-1.5 text-xs text-slate-500">
                <MapPin className="w-3 h-3" />{cell.source_location}
              </div>
            )}
            <div className="flex items-center gap-3 mt-2">
              <button onClick={() => navigator.clipboard.writeText(cell.source_quote!)}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
                <Copy className="w-3 h-3" />Copy
              </button>
              {onViewSource && (
                <button onClick={() => onViewSource(row._id, cell.source_quote!,
                    cell.source_start, cell.source_end)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold
                             text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg
                             hover:bg-indigo-100 transition-colors">
                  <FileSearch className="w-3.5 h-3.5" />View Source
                </button>
              )}
            </div>
          </div>
        )}

        {cell.notes && (
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase mb-1.5">AI Notes</h4>
            <div className="flex items-start gap-2 p-3 bg-slate-50 rounded-lg">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-600">{cell.notes}</p>
            </div>
          </div>
        )}

        {verification?.note && (
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase mb-1.5">Review Note</h4>
            <div className="flex items-start gap-2 p-3 bg-indigo-50 rounded-lg">
              <MessageSquare className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-600">{verification.note}</p>
            </div>
          </div>
        )}
      </div>

      <CellActionBar verification={verification}
        onVerify={onVerify} onFlag={onFlag}
        onOverride={onOverride} onClear={onClear} />
    </div>
  );
}
