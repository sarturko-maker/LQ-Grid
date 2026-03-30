import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  flexRender, type SortingState,
} from '@tanstack/react-table';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import type { Row, Column, Manifest, SelectedCell, VerificationEntry, DocumentGroup, ConsentStatus } from '@/types';
import { GridHeader } from './GridHeader';
import { GroupRow } from './GroupRow';
import { ChildRow } from './ChildRow';
import { ColumnFilter } from './ColumnFilter';
import { buildColumns } from './buildColumns';

interface DataGridProps {
  manifest: Manifest;
  columnOrder: string[];
  selectedCell: SelectedCell | null;
  groups: DocumentGroup[];
  wrapText: boolean;
  onGroupToggle: (id: string) => void;
  onCellClick: (rowId: string, colId: string) => void;
  onDocClick: (rowId: string) => void;
  onColumnReorder: (newOrder: string[]) => void;
  getVerification: (rowId: string, colId: string) => VerificationEntry | null;
  onCounterpartyClick: (name: string) => void;
  getConsentStatus: (name: string) => ConsentStatus;
  onDeleteRow?: (rowId: string) => void;
}

export function DataGrid({
  manifest, columnOrder, selectedCell, groups, wrapText, onGroupToggle,
  onCellClick, onDocClick, onColumnReorder, getVerification,
  onCounterpartyClick, getConsentStatus, onDeleteRow,
}: DataGridProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [colWidths, setColWidths] = useState<Record<string, number>>({});

  const setFilter = useCallback((colId: string, v: string) => {
    setFilters((prev) => ({ ...prev, [colId]: v }));
  }, []);

  const handleResize = useCallback((colId: string, w: number) => {
    setColWidths((prev) => ({ ...prev, [colId]: w }));
  }, []);

  const orderedColumns = useMemo(() => {
    const colMap = new Map(manifest.columns.map((c) => [c.id, c]));
    return columnOrder.map((id) => colMap.get(id)).filter((c): c is Column => c != null);
  }, [manifest.columns, columnOrder]);

  const filteredRows = useMemo(() => {
    const active = Object.entries(filters).filter(([, v]) => v);
    if (active.length === 0) return manifest.rows;
    return manifest.rows.filter((row) =>
      active.every(([colId, fv]) => {
        const cell = row.cells[colId];
        return (cell?.display || cell?.value || '').toLowerCase().includes(fv.toLowerCase());
      }),
    );
  }, [manifest.rows, filters]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = columnOrder.indexOf(active.id as string);
    const newIdx = columnOrder.indexOf(over.id as string);
    const next = [...columnOrder];
    next.splice(oldIdx, 1);
    next.splice(newIdx, 0, active.id as string);
    onColumnReorder(next);
  };

  const docWidth = colWidths['_document'] || 224;

  const handleDocResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = docWidth;
    const onMove = (ev: MouseEvent) => {
      const newW = Math.max(120, startW + ev.clientX - startX);
      handleResize('_document', newW);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [docWidth, handleResize]);

  const tableColumns = useMemo(
    () => buildColumns(orderedColumns, selectedCell, onCellClick, onDocClick,
      getVerification, onCounterpartyClick, getConsentStatus, wrapText, docWidth, onDeleteRow),
    [orderedColumns, selectedCell, onCellClick, onDocClick,
      getVerification, onCounterpartyClick, getConsentStatus, wrapText, docWidth, onDeleteRow],
  );

  const table = useReactTable({
    data: filteredRows, columns: tableColumns,
    state: { sorting }, onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row._id,
  });

  const groupedIds = useMemo(() => new Set(groups.flatMap((g) => g.documents)), [groups]);
  const rows = table.getRowModel().rows;
  const rowMap = new Map(rows.map((r) => [r.id, r]));

  return (
    <div className="flex-1 overflow-auto">
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <table className="text-left border-collapse"
          style={{ tableLayout: 'fixed', width: 40 + docWidth + orderedColumns.reduce((s, c) => s + (colWidths[c.id] || 200), 0) }}>
          <thead className="sticky top-0 z-20 bg-white shadow-[0_1px_0_0_rgba(0,0,0,0.08)]">
            <tr>
              <th className="px-2 py-3 border-b border-r border-slate-200 bg-white
                             font-semibold text-[10px] text-slate-400 text-center
                             sticky left-0 z-30 w-10 min-w-10">#</th>
              <th className="p-3 border-b border-r border-slate-200 bg-white
                             font-semibold text-xs text-slate-600 uppercase tracking-wider
                             sticky left-10 z-30 relative
                             shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]"
                style={{ width: docWidth, minWidth: 120 }}>
                Document
                <div className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize
                                 hover:bg-indigo-400 active:bg-indigo-500 transition-colors"
                  onMouseDown={handleDocResizeStart} />
              </th>
              <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
                {orderedColumns.map((col) => {
                  const ss = sorting.find((s) => s.id === col.id);
                  return (
                    <GridHeader key={col.id} column={col}
                      width={colWidths[col.id] || 200}
                      sortDirection={ss ? (ss.desc ? 'desc' : 'asc') : null}
                      onSort={() => setSorting((prev) => {
                        const ex = prev.find((s) => s.id === col.id);
                        if (!ex) return [{ id: col.id, desc: false }];
                        if (!ex.desc) return [{ id: col.id, desc: true }];
                        return [];
                      })}
                      onResize={handleResize} />
                  );
                })}
              </SortableContext>
            </tr>
            <tr className="bg-slate-50">
              <th className="px-2 py-1.5 border-b border-r border-slate-200 bg-slate-50
                             sticky left-0 z-30 w-10 min-w-10" />
              <th className="px-2 py-1.5 border-b border-r border-slate-200 bg-slate-50
                             sticky left-10 z-30
                             shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]"
                style={{ width: docWidth, minWidth: 120 }} />
              {orderedColumns.map((col) => (
                <th key={col.id} className="px-2 py-1.5 border-b border-r border-slate-200 bg-slate-50"
                  style={{ width: colWidths[col.id] || 200 }}>
                  <ColumnFilter column={col} rows={manifest.rows}
                    value={filters[col.id] || ''} onChange={(v) => setFilter(col.id, v)} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-sm text-slate-700">
            {groups.map((g) => (
              <React.Fragment key={`grp-${g.id}`}>
                <GroupRow group={g} columns={orderedColumns}
                  onToggle={() => onGroupToggle(g.id)} />
                {g.isExpanded && g.documents.map((docId) => {
                  const row = rowMap.get(docId);
                  return row ? <ChildRow key={`c-${row.id}`} row={row}
                    onDocClick={onDocClick} /> : null;
                })}
              </React.Fragment>
            ))}
            {rows.filter((r) => !groupedIds.has(r.id)).map((row) => (
              <tr key={row.id} className="hover:bg-slate-50/60 transition-colors duration-100">
                {row.getVisibleCells().map((cell) => (
                  <React.Fragment key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </React.Fragment>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </DndContext>
    </div>
  );
}
