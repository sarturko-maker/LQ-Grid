import { useState, useRef, useEffect } from 'react';
import { CheckCircle, AlertCircle, Minus } from 'lucide-react';
import type { Cell, VerificationEntry } from '@/types';

interface GridCellProps {
  cell: Cell;
  columnId: string;
  isSelected: boolean;
  verification: VerificationEntry | null;
  wrapText?: boolean;
  onClick: () => void;
}

function buyerSemantic(value: string | null, columnId: string): string {
  if (!value) return '';
  const v = value.toLowerCase().trim();

  if (columnId === 'assignment_found' || columnId === 'coc_found') {
    if (v === 'yes' || v === 'true') return 'border-l-amber-400 bg-amber-50/30';
    if (v === 'no' || v === 'false') return 'border-l-emerald-400 bg-emerald-50/20';
  }
  if (columnId === 'mechanism') {
    if (v === 'consent') return 'border-l-amber-400 bg-amber-50/30';
    if (v === 'termination_right') return 'border-l-red-400 bg-red-50/30';
    if (v === 'notification') return 'border-l-blue-400 bg-blue-50/20';
    if (v === 'none' || v === 'carve_out') return 'border-l-emerald-400 bg-emerald-50/20';
  }
  if (columnId === 'action' || columnId.includes('action')) {
    if (v === 'obtain_consent') return 'border-l-amber-400 bg-amber-50/30';
    if (v === 'flag_for_review') return 'border-l-red-400 bg-red-50/30';
    if (v === 'send_notification') return 'border-l-blue-400 bg-blue-50/20';
    if (v === 'no_action') return 'border-l-emerald-400 bg-emerald-50/20';
  }
  if (columnId === 'non_compete' || columnId.includes('compete')) {
    if (v.startsWith('no ') || v === 'none' || v.includes('no non-compete'))
      return 'border-l-emerald-400 bg-emerald-50/20';
    if (v.length > 5) return 'border-l-amber-400 bg-amber-50/30';
  }
  return '';
}

function verificationBg(status?: string): string {
  if (status === 'verified') return 'bg-emerald-50/60';
  if (status === 'flagged') return 'bg-red-50/60';
  return '';
}

export function GridCell({
  cell, columnId, isSelected, verification, wrapText, onClick,
}: GridCellProps) {
  const vStatus = verification?.status;
  const [showTooltip, setShowTooltip] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const contentRef = useRef<HTMLSpanElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (wrapText && contentRef.current) {
      const el = contentRef.current;
      setIsOverflowing(el.scrollHeight > el.clientHeight);
    } else {
      setIsOverflowing(false);
    }
  }, [wrapText, cell.display]);

  if (cell.status === 'pending') {
    return (
      <td className="p-3 border-b border-r border-slate-200">
        <div className="flex items-center gap-2">
          <div className="w-12 h-2 bg-slate-200 rounded-full animate-pulse" />
          <div className="w-6 h-2 bg-slate-100 rounded-full animate-pulse" />
        </div>
      </td>
    );
  }

  if (cell.status === 'failed') {
    return (
      <td className="p-3 border-b border-r border-slate-200 cursor-pointer
                     hover:bg-slate-50 transition-colors duration-150" onClick={onClick}>
        <div className="flex items-center gap-1.5 text-slate-400 text-xs">
          <Minus className="w-3 h-3" /><span>Not found</span>
        </div>
      </td>
    );
  }

  const displayValue = verification?.override || cell.display;
  const semantic = vStatus ? '' : buyerSemantic(cell.value, columnId);

  const handleMouseEnter = () => {
    if (wrapText && isOverflowing) {
      hoverTimer.current = setTimeout(() => setShowTooltip(true), 400);
    }
  };
  const handleMouseLeave = () => {
    clearTimeout(hoverTimer.current);
    setShowTooltip(false);
  };

  return (
    <td
      className={`p-3 border-b border-r border-l-2 border-slate-200 cursor-pointer
        transition-all duration-150 relative overflow-visible
        ${wrapText ? 'whitespace-normal break-words' : 'truncate max-w-[250px]'}
        ${semantic || 'border-l-slate-200'}
        ${vStatus ? verificationBg(vStatus) : ''}
        ${isSelected ? 'bg-indigo-50 ring-inset ring-2 ring-indigo-500' : 'hover:bg-slate-50/80'}`}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className={`flex items-start justify-between gap-2 ${wrapText ? '' : 'items-center'}`}>
        <span ref={contentRef}
          className={`text-sm ${wrapText ? 'line-clamp-3' : 'truncate'}`}>
          {displayValue}
        </span>
        {vStatus === 'verified' && <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
        {vStatus === 'flagged' && <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
      </div>

      {showTooltip && (
        <div className="absolute z-50 left-0 top-full mt-1 bg-white border border-slate-200
                        shadow-xl rounded-lg p-3 max-w-md text-sm text-slate-700
                        whitespace-normal break-words pointer-events-none"
          style={{ minWidth: '200px', maxHeight: '300px', overflow: 'auto' }}>
          {displayValue}
        </div>
      )}
    </td>
  );
}
