import { Scale, Shield, Database, Pencil, Check } from 'lucide-react';

interface SchemaOption {
  id: string;
  name: string;
  description: string;
  icon: typeof Scale;
  columns: string[];
}

const SCHEMAS: SchemaOption[] = [
  {
    id: 'consent-review',
    name: 'Consent Review',
    description: 'Contracts requiring consent upon change of control',
    icon: Shield,
    columns: [
      'Counterparty', 'Contract Type', 'Date', 'Governing Law',
      'Assignment Clause', 'Change of Control', 'Mechanism', 'Our Party',
      'Agreement Title', 'Consent Mechanism', 'Notice Address',
      'Notice Method', 'Action Required', 'Termination for Convenience', 'Non-Compete',
    ],
  },
  {
    id: 'ma-dd-standard',
    name: 'M&A Due Diligence',
    description: 'Key commercial and legal terms for acquisition review',
    icon: Scale,
    columns: [
      'Counterparty', 'Contract Type', 'Effective Date', 'Expiry / Renewal',
      'Governing Law', 'Contract Value', 'Termination Rights', 'Liability Cap',
      'IP Ownership', 'Confidentiality', 'Assignment', 'Change of Control',
      'Non-Compete / Non-Solicit', 'Key Risks',
    ],
  },
  {
    id: 'data-mapping',
    name: 'Data Mapping (GDPR)',
    description: 'Map data processing activities for privacy compliance',
    icon: Database,
    columns: [
      'Counterparty / Processor', 'Agreement Type', 'Data Role',
      'Personal Data Categories', 'Data Subjects', 'Processing Purposes',
      'International Transfer', 'Sub-Processors', 'Security Measures',
      'Breach Notification', 'Data Retention', 'Audit Rights',
    ],
  },
];

interface SchemaPickerProps {
  selected: string | null;
  onSelect: (schemaId: string) => void;
}

export function SchemaPicker({ selected, onSelect }: SchemaPickerProps) {
  return (
    <div className="mt-8">
      <p className="text-sm font-semibold text-slate-700 mb-3">Choose extraction schema</p>
      <div className="grid grid-cols-2 gap-3">
        {SCHEMAS.map((s) => {
          const active = selected === s.id;
          return (
            <button key={s.id} onClick={() => onSelect(s.id)}
              className={`text-left p-4 rounded-xl border-2 transition-all duration-150
                ${active
                  ? 'border-indigo-400 bg-indigo-50/60 ring-1 ring-indigo-100'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'}`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${active ? 'bg-indigo-100' : 'bg-slate-100'}`}>
                    <s.icon className={`w-3.5 h-3.5
                      ${active ? 'text-indigo-600' : 'text-slate-500'}`} />
                  </div>
                  <span className="font-semibold text-sm text-slate-800">{s.name}</span>
                </div>
                {active && <Check className="w-4 h-4 text-indigo-500" />}
              </div>
              <p className="text-xs text-slate-500 mb-2.5 ml-8">
                {s.columns.length} columns &mdash; {s.description}
              </p>
              <div className="flex flex-wrap gap-1 ml-8">
                {s.columns.map((col) => (
                  <span key={col}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium
                      ${active
                        ? 'bg-indigo-100/80 text-indigo-700'
                        : 'bg-slate-100 text-slate-500'}`}>
                    {col}
                  </span>
                ))}
              </div>
            </button>
          );
        })}

        <button onClick={() => onSelect('custom')}
          className={`text-left p-4 rounded-xl border-2 border-dashed transition-all duration-150
            ${selected === 'custom'
              ? 'border-indigo-400 bg-indigo-50/60'
              : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50/50'}`}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg
                ${selected === 'custom' ? 'bg-indigo-100' : 'bg-slate-100'}`}>
                <Pencil className={`w-3.5 h-3.5
                  ${selected === 'custom' ? 'text-indigo-600' : 'text-slate-500'}`} />
              </div>
              <span className="font-semibold text-sm text-slate-800">Custom Schema</span>
            </div>
            {selected === 'custom' && <Check className="w-4 h-4 text-indigo-500" />}
          </div>
          <p className="text-xs text-slate-500 ml-8">
            Define your own columns &mdash; extract exactly what you need
          </p>
        </button>
      </div>
    </div>
  );
}
