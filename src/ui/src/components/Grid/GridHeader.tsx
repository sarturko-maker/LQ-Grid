import { useState, useCallback } from 'react';
import { ArrowUp, ArrowDown, GripVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Column as ColumnDef, OutputType } from '@/types';

interface GridHeaderProps {
  column: ColumnDef;
  sortDirection: 'asc' | 'desc' | null;
  width: number;
  onSort: () => void;
  onResize: (colId: string, width: number) => void;
}

function outputTypeBadge(outputType?: OutputType): { label: string; cls: string } | null {
  switch (outputType) {
    case 'verbatim': return { label: 'verbatim', cls: 'bg-amber-100 text-amber-700' };
    case 'summary': return { label: 'summary', cls: 'bg-blue-100 text-blue-700' };
    case 'classification': return { label: 'yes/no', cls: 'bg-emerald-100 text-emerald-700' };
    case 'date': return { label: 'date', cls: 'bg-purple-100 text-purple-700' };
    default: return null;
  }
}

export function GridHeader({ column, sortDirection, width, onSort, onResize }: GridHeaderProps) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    width,
    minWidth: 100,
  };

  const badge = outputTypeBadge(column.outputType);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = width;
    const onMove = (ev: MouseEvent) => {
      const newW = Math.max(100, startW + ev.clientX - startX);
      onResize(column.id, newW);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [width, column.id, onResize]);

  return (
    <th ref={setNodeRef} style={style}
      className={`p-3 border-b border-r border-slate-200 bg-white text-left
                   font-semibold text-xs text-slate-600 uppercase tracking-wider
                   select-none group hover:bg-slate-50/80 transition-colors duration-150
                   sticky top-0 z-10 relative
                   ${isDragging ? 'shadow-lg ring-2 ring-indigo-300 rounded z-50' : ''}`}>
      <div className="flex items-center justify-between gap-1.5">
        <button className="p-0.5 rounded opacity-0 group-hover:opacity-60 hover:!opacity-100
                     cursor-grab active:cursor-grabbing text-slate-400 transition-opacity duration-150"
          {...attributes} {...listeners}>
          <GripVertical className="w-3 h-3" />
        </button>

        <button onClick={onSort}
          className="flex flex-col gap-1 min-w-0 flex-1 text-left cursor-pointer
                     hover:text-indigo-600 transition-colors">
          <div className="flex items-center gap-1.5">
            <span className="truncate">{column.label}</span>
            {sortDirection === 'asc' && <ArrowUp className="w-3 h-3 text-indigo-500 shrink-0" />}
            {sortDirection === 'desc' && <ArrowDown className="w-3 h-3 text-indigo-500 shrink-0" />}
          </div>
          {badge && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full w-fit font-medium ${badge.cls}`}>
              {badge.label}
            </span>
          )}
        </button>
      </div>

      {/* Resize handle */}
      <div className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize
                       hover:bg-indigo-400 active:bg-indigo-500 transition-colors"
        onMouseDown={handleResizeStart} />
    </th>
  );
}
