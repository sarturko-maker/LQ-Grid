import { Loader2, CheckCircle } from 'lucide-react';

interface ActionCardProps {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  isRunning: boolean;
  isDone: boolean;
  onRun: () => void;
}

export function ActionCard({
  label, description, icon: Icon, color,
  isRunning, isDone, onRun,
}: ActionCardProps) {
  return (
    <button onClick={onRun} disabled={isRunning || isDone}
      className={`w-full text-left p-4 rounded-xl border transition-all duration-200
        mb-2 group active:scale-[0.98]
        ${isDone
          ? 'border-emerald-200 bg-emerald-50/50'
          : isRunning
            ? 'border-indigo-200 bg-indigo-50/30'
            : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'}`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-xl transition-colors duration-200 ${
          isDone ? 'bg-emerald-100 text-emerald-600' :
          isRunning ? 'bg-indigo-100 text-indigo-600' :
          color}`}>
          {isDone ? <CheckCircle className="w-4 h-4" /> :
           isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> :
           <Icon className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800">{label}</p>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            {isDone ? 'Sent to Claude Code — check terminal for output' :
             isRunning ? 'Processing...' :
             description}
          </p>
        </div>
      </div>
    </button>
  );
}
