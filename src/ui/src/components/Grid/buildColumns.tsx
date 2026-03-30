import { FileText, X } from 'lucide-react';
import type { Row, Column, SelectedCell, VerificationEntry, ConsentStatus } from '@/types';
import type { ColumnDef } from '@tanstack/react-table';
import { GridCell } from './GridCell';
import { ConsentBadge } from './ConsentBadge';

/** Build TanStack column definitions for the data grid. */
export function buildColumns(
  orderedColumns: Column[],
  selectedCell: SelectedCell | null,
  onCellClick: (rowId: string, colId: string) => void,
  onDocClick: (rowId: string) => void,
  getVerification: (rowId: string, colId: string) => VerificationEntry | null,
  onCounterpartyClick?: (name: string) => void,
  getConsentStatus?: (name: string) => ConsentStatus,
  wrapText?: boolean,
  docWidth?: number,
  onDeleteRow?: (rowId: string) => void,
): ColumnDef<Row>[] {
  const dw = docWidth || 224;
  const docCol: ColumnDef<Row> = {
    id: '_document',
    cell: ({ row }) => (
      <td className="p-3 border-b border-r border-slate-200 bg-white
                     sticky left-10 z-10 cursor-pointer
                     group/doc hover:bg-slate-50 transition-colors duration-150
                     shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]"
        style={{ width: dw, minWidth: 120 }}
        onClick={() => onDocClick(row.original._id)}>
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-slate-100 rounded-lg group-hover/doc:bg-indigo-50
                          transition-colors duration-200">
            <FileText className="w-3.5 h-3.5 text-slate-400 group-hover/doc:text-indigo-500
                                 transition-colors duration-200" />
          </div>
          <span className="text-sm font-medium text-slate-800 truncate
                           group-hover/doc:text-indigo-600 transition-colors duration-200"
                title={row.original._document}>
            {row.original._document}
          </span>
        </div>
      </td>
    ),
    enableSorting: true,
    sortingFn: (a, b) => a.original._document.localeCompare(b.original._document),
  };

  const dataCols: ColumnDef<Row>[] = orderedColumns.map((col) => ({
    id: col.id,
    cell: ({ row }) => {
      const cell = row.original.cells[col.id];
      if (!cell) return <td className="p-3 border-b border-r border-slate-200" />;

      // Counterparty column — clickable with consent badge
      if (col.id === 'counterparty' && onCounterpartyClick && cell.display) {
        const status = getConsentStatus?.(cell.display);
        return (
          <td className="p-3 border-b border-r border-slate-200 cursor-pointer
                         hover:bg-indigo-50/50 transition-colors"
            onClick={() => onCounterpartyClick(cell.display)}>
            <div className="flex items-center gap-2">
              {status && <ConsentBadge status={status} />}
              <span className="text-xs text-indigo-700 font-medium hover:underline truncate">
                {cell.display}
              </span>
            </div>
          </td>
        );
      }

      return (
        <GridCell cell={cell} columnId={col.id}
          isSelected={selectedCell?.rowId === row.original._id && selectedCell?.colId === col.id}
          verification={getVerification(row.original._id, col.id)}
          wrapText={wrapText}
          onClick={() => onCellClick(row.original._id, col.id)} />
      );
    },
    enableSorting: col.sortable,
    sortingFn: (a: { original: Row }, b: { original: Row }) => {
      const va = a.original.cells[col.id]?.value || '';
      const vb = b.original.cells[col.id]?.value || '';
      return smartSort(va, vb, col.type);
    },
  }));

  // Row number column with delete on hover
  const numCol: ColumnDef<Row> = {
    id: '_num',
    cell: ({ row }) => <RowNumCell index={row.index} rowId={row.original._id} onDelete={onDeleteRow} />,
    enableSorting: false,
  };

  return [numCol, docCol, ...dataCols];
}

function RowNumCell({ index, rowId, onDelete }: {
  index: number; rowId: string; onDelete?: (id: string) => void;
}) {
  return (
    <td className="px-2 py-3 border-b border-r border-slate-200 bg-white text-center
                   text-[11px] text-slate-400 font-mono w-10 min-w-10
                   sticky left-0 z-10">
      <div className="group/num flex items-center justify-center">
        <span className="group-hover/num:hidden">{index + 1}</span>
        {onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(rowId); }}
            className="hidden group-hover/num:block text-red-400 hover:text-red-600
                       cursor-pointer transition-colors"
            title="Delete row">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </td>
  );
}

/** Sort values intelligently based on column type. */
function smartSort(a: string, b: string, type: string): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;

  // Date columns — parse and compare timestamps
  if (type === 'date') {
    const da = new Date(a).getTime();
    const db = new Date(b).getTime();
    if (!isNaN(da) && !isNaN(db)) return da - db;
  }

  // Boolean columns — Yes before No
  if (type === 'boolean') {
    const ba = a.toLowerCase() === 'yes' ? 0 : 1;
    const bb = b.toLowerCase() === 'yes' ? 0 : 1;
    return ba - bb;
  }

  // Enum columns — sort by predefined order if known, else alphabetical
  if (type === 'enum') {
    const order: Record<string, number> = {
      obtain_consent: 0, flag_for_review: 1, send_notification: 2, no_action: 3,
      termination_right: 0, consent: 1, notification: 2, carve_out: 3, none: 4,
    };
    const oa = order[a] ?? 99;
    const ob = order[b] ?? 99;
    if (oa !== ob) return oa - ob;
  }

  // Default — case-insensitive alphabetical
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}
