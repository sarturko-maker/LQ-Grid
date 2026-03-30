import { Plus, Trash2 } from 'lucide-react';

export interface CustomColumn {
  label: string;
  prompt: string;
}

interface Props {
  columns: CustomColumn[];
  onChange: (columns: CustomColumn[]) => void;
}

export function CustomSchemaEditor({ columns, onChange }: Props) {
  const add = () => onChange([...columns, { label: '', prompt: '' }]);
  const remove = (i: number) => onChange(columns.filter((_, j) => j !== i));
  const update = (i: number, field: 'label' | 'prompt', val: string) =>
    onChange(columns.map((c, j) => (j === i ? { ...c, [field]: val } : c)));

  const valid = columns.filter(c => c.label && c.prompt).length;

  return (
    <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
      <p className="text-xs font-semibold text-slate-600 mb-3">
        Define columns
        {valid > 0 && <span className="text-indigo-600 ml-1">({valid} ready)</span>}
      </p>
      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {columns.map((col, i) => (
          <div key={i} className="flex gap-2 items-start">
            <input value={col.label} placeholder="Column name"
              onChange={e => update(i, 'label', e.target.value)}
              className="w-40 shrink-0 px-3 py-2 text-sm bg-white border border-slate-200
                         rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500
                         focus:border-transparent" />
            <input value={col.prompt}
              placeholder="What to extract (e.g. 'Termination notice period')"
              onChange={e => update(i, 'prompt', e.target.value)}
              className="flex-1 px-3 py-2 text-sm bg-white border border-slate-200
                         rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500
                         focus:border-transparent" />
            {columns.length > 1 && (
              <button onClick={() => remove(i)}
                className="p-2 text-slate-400 hover:text-red-500 transition-colors shrink-0">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>
      <button onClick={add}
        className="mt-2.5 flex items-center gap-1.5 text-xs text-indigo-600
                   hover:text-indigo-800 font-medium">
        <Plus className="w-3.5 h-3.5" /> Add column
      </button>
    </div>
  );
}
