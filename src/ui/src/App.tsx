import { useMemo, useCallback } from 'react';
import { MessageSquare } from 'lucide-react';
import type { OutputType } from '@/types';
import { useManifest } from '@/hooks/useManifest';
import { useVerification } from '@/hooks/useVerification';
import { useSidebar } from '@/hooks/useSidebar';
import { usePendingColumns } from '@/hooks/usePendingColumns';
import { useGrouping } from '@/hooks/useGrouping';
import { useCounterparties } from '@/hooks/useCounterparties';
import { DEFAULT_MODEL } from '@/lib/models';
import { getUniqueCounterparties } from '@/lib/counterpartyUtils';
import { requestGroupExtraction } from '@/lib/groupExtraction';
import { useState } from 'react';
import { DataGrid } from '@/components/Grid/DataGrid';
import { GridToolbar } from '@/components/Grid/GridToolbar';
import { CellDetail } from '@/components/Sidebar/CellDetail';
import { ColumnEditor } from '@/components/Sidebar/ColumnEditor';
import { ActionsPanel } from '@/components/Sidebar/ActionsPanel';
import { DocumentView } from '@/components/Sidebar/DocumentView';
import { AnalystChat } from '@/components/Chat/AnalystChat';
import { GroupPanel } from '@/components/Sidebar/GroupPanel';
import { CounterpartyProfile } from '@/components/Sidebar/CounterpartyProfile';
import { CounterpartyList } from '@/components/Sidebar/CounterpartyList';
import { DropZone } from '@/components/Upload/DropZone';
import { ResizeHandle } from '@/components/ResizeHandle';

export default function App() {
  const { manifest, loading, error } = useManifest();
  const jobName = manifest?.job.name || 'Untitled';
  const ver = useVerification(jobName);
  const sb = useSidebar();
  const cols = usePendingColumns(manifest);
  const grp = useGrouping(jobName);
  const cp = useCounterparties(jobName);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [wrapText, setWrapText] = useState(false);

  const ext = useMemo(() => {
    if (!manifest) return null;
    const rows = manifest.rows.map((row) => {
      const cells = { ...row.cells };
      for (const col of cols.pendingColumns) {
        if (!cells[col.id]) {
          cells[col.id] = { value: null, display: '', source_quote: null,
            source_location: null, confidence: 'low', status: 'pending', notes: null };
        }
      }
      return { ...row, cells };
    });
    return { ...manifest, columns: cols.allColumns, rows };
  }, [manifest, cols.allColumns, cols.pendingColumns]);

  const uniqueParties = useMemo(() => getUniqueCounterparties(ext), [ext]);

  const handleGroupExtraction = useCallback((groupId: string, name: string, docIds: string[]) => {
    if (!ext) return;
    const docNames = docIds
      .map((id) => ext.rows.find((r) => r._id === id)?._document)
      .filter(Boolean) as string[];
    if (docNames.length === 0) return;
    grp.setExtracting(groupId);
    requestGroupExtraction(name, docNames, ext.columns)
      .then((cells) => grp.setCells(groupId, cells))
      .catch(() => grp.setError(groupId));
  }, [grp, ext]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!ext || error) {
    return (
      <div className="h-screen flex flex-col bg-white">
        <Header onChat={sb.toggleChat} chatActive={sb.mode === 'chat'} />
        <DropZone />
      </div>
    );
  }

  const selRow = sb.selectedCell ? ext.rows.find((r) => r._id === sb.selectedCell!.rowId) : null;
  const selCol = sb.selectedCell ? ext.columns.find((c) => c.id === sb.selectedCell!.colId) : null;
  const selCell = selRow && sb.selectedCell ? selRow.cells[sb.selectedCell.colId] : null;
  const previewRow = sb.previewDocId ? ext.rows.find((r) => r._id === sb.previewDocId) : null;
  const cpProfile = sb.counterpartyName ? cp.getOrCreate(sb.counterpartyName) : null;
  const cpSummary = sb.counterpartyName
    ? uniqueParties.find((p) => p.name === sb.counterpartyName) : undefined;

  return (
    <div className="h-screen flex flex-col bg-white">
      <Header onChat={sb.toggleChat} chatActive={sb.mode === 'chat'} />
      <GridToolbar manifest={ext}
        verifiedCount={ver.counts.verified} flaggedCount={ver.counts.flagged}
        selectedModel={selectedModel} onModelChange={setSelectedModel}
        onAddColumn={sb.openColumnEditor} onActions={sb.openActions}
        onGrouping={sb.openGrouping} groupCount={grp.groups.length}
        onCounterparties={sb.openCounterpartyList} partyCount={uniqueParties.length}
        wrapText={wrapText} onToggleWrap={() => setWrapText((w) => !w)} />

      <div className="flex-1 flex overflow-hidden">
        <DataGrid manifest={ext} columnOrder={cols.columnOrder}
          selectedCell={sb.selectedCell}
          groups={grp.groups} wrapText={wrapText} onGroupToggle={grp.toggleExpand}
          onCellClick={sb.openCellDetail} onDocClick={sb.openDocPreview}
          onColumnReorder={cols.setColumnOrder} getVerification={ver.getStatus}
          onCounterpartyClick={sb.openCounterpartyProfile}
          getConsentStatus={cp.getConsentStatus} />

        <div className={`shrink-0 bg-white z-20 relative transition-[width,opacity] duration-300
          ease-out overflow-hidden ${sb.isOpen ? 'border-l border-slate-200 shadow-xl' : ''}`}
          style={{ width: sb.isOpen ? sb.width : 0 }}>
          {sb.isOpen && (
            <ResizeHandle width={sb.width} min={320}
              max={Math.min(900, typeof window !== 'undefined' ? window.innerWidth * 0.6 : 900)}
              onResize={sb.setWidth} side="left" />
          )}
          <div className="w-full h-full" style={{ minWidth: 320 }}>
            {sb.mode === 'cell-detail' && selRow && selCol && selCell && sb.selectedCell && (
              <CellDetail row={selRow} column={selCol} cell={selCell}
                verification={ver.getStatus(sb.selectedCell.rowId, sb.selectedCell.colId)}
                onVerify={(n) => ver.verify(sb.selectedCell!.rowId, sb.selectedCell!.colId, n)}
                onFlag={(n) => ver.flag(sb.selectedCell!.rowId, sb.selectedCell!.colId, n)}
                onOverride={(v, n) => ver.override(sb.selectedCell!.rowId, sb.selectedCell!.colId, v, n)}
                onClear={() => ver.clear(sb.selectedCell!.rowId, sb.selectedCell!.colId)}
                onClose={sb.close}
                onViewSource={(rowId, quote, start, end) => sb.openDocPreview(rowId, quote, start, end)} />
            )}
            {sb.mode === 'column-editor' && (
              <ColumnEditor model={selectedModel}
                onColumnAdded={(id, prompt, ot) => cols.addColumn(id, prompt, ot)} onClose={sb.close} />
            )}
            {sb.mode === 'actions' && <ActionsPanel manifest={ext} onClose={sb.close} />}
            {sb.mode === 'grouping' && (
              <GroupPanel manifest={ext} groups={grp.groups}
                onAdd={grp.addGroup} onRemove={grp.removeGroup}
                onToggle={grp.toggleExpand}
                onAddDoc={grp.addToGroup} onRemoveDoc={grp.removeFromGroup}
                onRequestExtraction={handleGroupExtraction}
                onClose={sb.close} />
            )}
            {sb.mode === 'counterparty-profile' && sb.counterpartyName && cpProfile && (
              <CounterpartyProfile name={sb.counterpartyName} manifest={ext}
                summary={cpSummary} profile={cpProfile}
                onUpdate={(p) => cp.updateProfile(sb.counterpartyName!, p)}
                onUpdateStrategy={(s) => cp.updateStrategy(sb.counterpartyName!, s)}
                onUpdateNotice={(n) => cp.updateNotice(sb.counterpartyName!, n)}
                onDocClick={sb.openDocPreview} onClose={sb.close} />
            )}
            {sb.mode === 'counterparty-list' && (
              <CounterpartyList parties={uniqueParties}
                getConsentStatus={cp.getConsentStatus}
                onSelect={sb.openCounterpartyProfile} onClose={sb.close} />
            )}
            {sb.mode === 'document-preview' && previewRow && (
              <DocumentView documentName={previewRow._document}
                sourceQuote={sb.sourceQuote}
                sourceStart={sb.sourceStart} sourceEnd={sb.sourceEnd}
                onClose={sb.close} />
            )}
            {sb.mode === 'chat' && <AnalystChat onClose={sb.close} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function Header({ onChat, chatActive }: { onChat: () => void; chatActive: boolean }) {
  return (
    <header className="h-14 bg-white border-b border-slate-100 flex items-center justify-between px-6 shrink-0">
      <h1 className="text-lg font-bold text-slate-800 tracking-tight">LQ Grid</h1>
      <button onClick={onChat}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg
          transition-all duration-200
          ${chatActive
            ? 'bg-indigo-50 text-indigo-600 border border-indigo-200 shadow-sm'
            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
        <MessageSquare className="w-3.5 h-3.5" />
        Analyst
      </button>
    </header>
  );
}
