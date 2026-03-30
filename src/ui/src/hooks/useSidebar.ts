import { useState } from 'react';
import type { SidebarMode, SelectedCell, SourceRef } from '@/types';

export function useSidebar() {
  const [mode, setMode] = useState<SidebarMode>('none');
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [previewDocId, setPreviewDocId] = useState<string | null>(null);
  const [counterpartyName, setCounterpartyName] = useState<string | null>(null);
  const [width, setWidth] = useState(420);

  const openCellDetail = (rowId: string, colId: string) => {
    setSelectedCell({ rowId, colId });
    setPreviewDocId(null);
    setCounterpartyName(null);
    setMode('cell-detail');
    setWidth(420);
  };

  const [sourceQuote, setSourceQuote] = useState<string | null>(null);
  const [sourceStart, setSourceStart] = useState<number | undefined>(undefined);
  const [sourceEnd, setSourceEnd] = useState<number | undefined>(undefined);
  const [sourceQuotes, setSourceQuotes] = useState<SourceRef[] | undefined>(undefined);

  const openDocPreview = (rowId: string, quote?: string, start?: number, end?: number, quotes?: SourceRef[]) => {
    setSelectedCell(null);
    setPreviewDocId(rowId);
    setSourceQuote(quote || null);
    setSourceStart(start);
    setSourceEnd(end);
    setSourceQuotes(quotes);
    setMode('document-preview');
    setWidth(Math.round(window.innerWidth * 0.45));
  };

  const openColumnEditor = () => { setMode('column-editor'); setWidth(400); };
  const openActions = () => { setMode('actions'); setWidth(400); };
  const openGrouping = () => { setMode('grouping'); setWidth(420); };

  const openCounterpartyProfile = (name: string) => {
    setCounterpartyName(name);
    setSelectedCell(null);
    setPreviewDocId(null);
    setMode('counterparty-profile');
    setWidth(480);
  };

  const openCounterpartyList = () => {
    setMode('counterparty-list');
    setWidth(420);
  };

  const toggleChat = () => {
    if (mode === 'chat') { close(); } else {
      setSelectedCell(null); setPreviewDocId(null); setCounterpartyName(null);
      setMode('chat'); setWidth(400);
    }
  };

  const close = () => {
    setMode('none');
    setSelectedCell(null);
    setPreviewDocId(null);
    setCounterpartyName(null);
    setSourceQuote(null);
    setSourceStart(undefined);
    setSourceEnd(undefined);
    setSourceQuotes(undefined);
  };

  return {
    mode, selectedCell, previewDocId, counterpartyName,
    sourceQuote, sourceStart, sourceEnd, sourceQuotes,
    width, setWidth, isOpen: mode !== 'none',
    openCellDetail, openDocPreview, openColumnEditor,
    openActions, openGrouping, openCounterpartyProfile,
    openCounterpartyList, toggleChat, close,
  };
}
