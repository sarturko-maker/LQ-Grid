import { ChevronDown, ChevronRight, FolderOpen, Loader2 } from 'lucide-react';
import type { DocumentGroup, Column } from '@/types';
import { GridCell } from './GridCell';

interface GroupRowProps {
  group: DocumentGroup;
  columns: Column[];
  onToggle: () => void;
}

export function GroupRow({ group, columns, onToggle }: GroupRowProps) {
  const hasCells = group.status === 'complete' && group.cells;

  return (
    <tr className="bg-indigo-50 border-b border-indigo-200 hover:bg-indigo-100
                   transition-colors">
      {/* Row number cell — empty for groups */}
      <td className="px-2 py-3 border-b border-r border-indigo-200 bg-indigo-50
                     w-10 min-w-10 sticky left-0 z-10" />

      {/* Frozen document column */}
      <td className="p-3 border-b border-r border-indigo-200 bg-indigo-50
                     sticky left-10 z-10 w-56 min-w-56 cursor-pointer
                     shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]"
        onClick={onToggle}>
        <div className="flex items-center gap-2">
          {group.isExpanded
            ? <ChevronDown className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            : <ChevronRight className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
          <FolderOpen className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          <div className="min-w-0">
            <span className="text-xs font-semibold text-indigo-700 truncate block">
              {group.name}
            </span>
            <span className="text-[10px] text-indigo-400">
              {group.documents.length} docs
              {group.status === 'extracting' && ' · analysing...'}
            </span>
          </div>
        </div>
      </td>

      {/* Data cells */}
      {columns.map((col) => {
        if (group.status === 'extracting') {
          return (
            <td key={col.id} className="p-3 border-b border-r border-indigo-200 bg-indigo-50">
              <Loader2 className="w-3 h-3 animate-spin text-indigo-300" />
            </td>
          );
        }
        if (hasCells && group.cells![col.id]) {
          return (
            <GridCell key={col.id} cell={group.cells![col.id]}
              columnId={col.id} isSelected={false} verification={null}
              onClick={() => {}} />
          );
        }
        return (
          <td key={col.id} className="p-3 border-b border-r border-indigo-200 bg-indigo-50">
            <span className="text-[10px] text-indigo-300 italic">
              {group.status === 'pending' ? 'pending' : '—'}
            </span>
          </td>
        );
      })}
    </tr>
  );
}
