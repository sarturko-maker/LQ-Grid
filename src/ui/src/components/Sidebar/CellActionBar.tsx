import { useState } from 'react';
import { CheckCircle, Flag } from 'lucide-react';
import type { VerificationEntry } from '@/types';

interface CellActionBarProps {
  verification: VerificationEntry | null;
  onVerify: (note?: string) => void;
  onFlag: (note: string) => void;
  onOverride: (value: string, note?: string) => void;
  onClear: () => void;
}

export function CellActionBar({
  verification, onVerify, onFlag, onOverride, onClear,
}: CellActionBarProps) {
  const [flagNote, setFlagNote] = useState('');
  const [showFlag, setShowFlag] = useState(false);
  const [overrideVal, setOverrideVal] = useState('');
  const [showOverride, setShowOverride] = useState(false);
  const vStatus = verification?.status;

  return (
    <div className="border-t border-slate-100 bg-slate-50">
      {/* Flag input */}
      {showFlag && (
        <div className="px-4 pt-3 space-y-2">
          <textarea value={flagNote} onChange={(e) => setFlagNote(e.target.value)}
            placeholder="Why are you flagging this cell?"
            className="w-full p-2 text-sm border border-slate-200 rounded-lg
                       focus:ring-2 focus:ring-red-400 resize-none" rows={2} autoFocus />
          <div className="flex gap-2">
            <button onClick={() => { onFlag(flagNote); setShowFlag(false); setFlagNote(''); }}
              disabled={!flagNote.trim()}
              className="px-3 py-1.5 text-xs font-bold bg-red-600 text-white rounded-md
                         hover:bg-red-700 disabled:opacity-50">Flag</button>
            <button onClick={() => setShowFlag(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-md">Cancel</button>
          </div>
        </div>
      )}

      {/* Override input */}
      {showOverride && (
        <div className="px-4 pt-3 space-y-2">
          <input type="text" value={overrideVal} onChange={(e) => setOverrideVal(e.target.value)}
            placeholder="Enter corrected value"
            className="w-full p-2 text-sm border border-slate-200 rounded-lg
                       focus:ring-2 focus:ring-blue-400" autoFocus />
          <div className="flex gap-2">
            <button onClick={() => { onOverride(overrideVal); setShowOverride(false); setOverrideVal(''); }}
              disabled={!overrideVal.trim()}
              className="px-3 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-md
                         hover:bg-blue-700 disabled:opacity-50">Save</button>
            <button onClick={() => setShowOverride(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-md">Cancel</button>
          </div>
        </div>
      )}

      {/* Buttons */}
      <div className="px-4 py-3 flex items-center gap-2">
        <button onClick={() => onVerify()}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-colors
            ${vStatus === 'verified'
              ? 'bg-emerald-600 text-white'
              : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'}`}>
          <CheckCircle className="w-3.5 h-3.5" />
          {vStatus === 'verified' ? 'Verified' : 'Verify'}
        </button>
        <button onClick={() => setShowFlag(!showFlag)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-colors
            ${vStatus === 'flagged'
              ? 'bg-red-600 text-white'
              : 'bg-white text-red-700 border border-red-200 hover:bg-red-50'}`}>
          <Flag className="w-3.5 h-3.5" />
          {vStatus === 'flagged' ? 'Flagged' : 'Flag'}
        </button>
        <button onClick={() => setShowOverride(!showOverride)}
          className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white
                     border border-slate-200 rounded-md hover:bg-slate-50">
          Override
        </button>
        {verification && (
          <button onClick={onClear}
            className="ml-auto px-3 py-1.5 text-xs text-slate-400 hover:text-slate-600">
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
