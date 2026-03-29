import type {
  CounterpartyProfile, CounterpartyCategory, Materiality, ConsentStrategy,
} from '@/types';

interface ProfileFieldsProps {
  profile: CounterpartyProfile;
  onUpdate: (partial: Partial<CounterpartyProfile>) => void;
  onUpdateStrategy: (partial: Partial<ConsentStrategy>) => void;
}

export function ProfileFields({ profile, onUpdate, onUpdateStrategy }: ProfileFieldsProps) {
  return (
    <div className="space-y-4">
      {/* Editable fields */}
      <Section title="Details">
        <Row label="Category">
          <select value={profile.category || ''}
            onChange={(e) => onUpdate({ category: (e.target.value || null) as CounterpartyCategory | null })}
            className="input-sm">
            <option value="">Unset</option>
            <option value="customer">Customer</option>
            <option value="supplier">Supplier</option>
            <option value="landlord">Landlord</option>
            <option value="jv">JV Partner</option>
            <option value="other">Other</option>
          </select>
        </Row>
        <Row label="Materiality">
          <select value={profile.materiality || ''}
            onChange={(e) => onUpdate({ materiality: (e.target.value || null) as Materiality | null })}
            className="input-sm">
            <option value="">Unset</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </Row>
        <Row label="Owner">
          <input value={profile.relationshipOwner}
            onChange={(e) => onUpdate({ relationshipOwner: e.target.value })}
            placeholder="Relationship owner..." className="input-sm" />
        </Row>
        <Row label="Revenue">
          <input value={profile.revenueValue}
            onChange={(e) => onUpdate({ revenueValue: e.target.value })}
            placeholder="Revenue / contract value..." className="input-sm" />
        </Row>
        <Row label="Notes">
          <textarea value={profile.notes} rows={2}
            onChange={(e) => onUpdate({ notes: e.target.value })}
            placeholder="Internal notes..." className="input-sm resize-none" />
        </Row>
      </Section>

      {/* Consent strategy */}
      <Section title="Consent Strategy">
        <Row label="Priority">
          <select value={profile.strategy.priority}
            onChange={(e) => onUpdateStrategy({ priority: Number(e.target.value) as 1|2|3|4|5 })}
            className="input-sm">
            {[1,2,3,4,5].map((n) => (
              <option key={n} value={n}>{n} — {['','Critical','High','Medium','Low','Deferred'][n]}</option>
            ))}
          </select>
        </Row>
        <Row label="Approach">
          <select value={profile.strategy.approach}
            onChange={(e) => onUpdateStrategy({ approach: e.target.value as ConsentStrategy['approach'] })}
            className="input-sm">
            <option value="not_required">Not Required</option>
            <option value="pre-signing">Pre-Signing</option>
            <option value="post-signing">Post-Signing</option>
          </select>
        </Row>
        <Row label="Handling">
          <textarea value={profile.strategy.handlingNotes} rows={2}
            onChange={(e) => onUpdateStrategy({ handlingNotes: e.target.value })}
            placeholder="Special handling instructions..." className="input-sm resize-none" />
        </Row>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-[11px] text-slate-500 w-16 shrink-0 pt-1.5">{label}</span>
      <div className="flex-1 [&_.input-sm]:w-full [&_.input-sm]:text-xs [&_.input-sm]:px-2.5
                       [&_.input-sm]:py-1.5 [&_.input-sm]:border [&_.input-sm]:border-slate-200
                       [&_.input-sm]:rounded-lg [&_.input-sm]:focus:ring-1
                       [&_.input-sm]:focus:ring-indigo-300 [&_.input-sm]:focus:outline-none">
        {children}
      </div>
    </div>
  );
}
