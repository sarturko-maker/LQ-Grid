import { useState, useRef, useEffect } from 'react';
import { Send, X, Bot, User, Loader2 } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const RELAY = 'http://localhost:3002';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  loading?: boolean;
}

interface AnalystChatProps {
  onClose: () => void;
}

export function AnalystChat({ onClose }: AnalystChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (directQuestion?: string) => {
    const q = (directQuestion || input).trim();
    if (!q || sending) return;
    const reqId = `q_${Date.now()}`;

    setMessages((prev) => [...prev, { id: reqId + '_u', role: 'user', text: q }]);
    setMessages((prev) => [...prev, { id: reqId, role: 'assistant', text: '', loading: true }]);
    setInput('');
    setSending(true);

    // Send to relay
    try {
      await fetch(`${RELAY}/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: reqId, type: 'query',
          payload: { question: q },
          prompt: `Read data/output/ui-manifest.json.\nAnswer: "${q}"\nReference specific documents.`,
        }),
      });
    } catch {
      setMessages((prev) => prev.map((m) =>
        m.id === reqId ? { ...m, text: 'Could not reach relay server.', loading: false } : m
      ));
      setSending(false);
      return;
    }

    // Poll for response
    const start = Date.now();
    const poll = setInterval(async () => {
      if (Date.now() - start > 120000) {
        clearInterval(poll);
        setMessages((prev) => prev.map((m) =>
          m.id === reqId ? { ...m, text: 'Response timed out.', loading: false } : m
        ));
        setSending(false);
        return;
      }
      try {
        const r = await fetch(`${RELAY}/response/${reqId}`);
        if (r.status === 200) {
          const data = await r.json();
          clearInterval(poll);
          setMessages((prev) => prev.map((m) =>
            m.id === reqId ? { ...m, text: data.answer || data.text || JSON.stringify(data), loading: false } : m
          ));
          setSending(false);
        }
      } catch { /* keep polling */ }
    }, 2000);
  };

  const suggestions = [
    'Which contracts require consent before closing?',
    'Compare the assignment clauses across all contracts',
    'Which contract has the most restrictive provisions?',
    'Summarise the key risks for the buyer',
  ];

  return (
    <div className="h-full flex flex-col bg-white animate-in slide-in-from-right duration-300">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-indigo-600" />
          <div>
            <span className="text-sm font-semibold text-slate-800">Analyst</span>
            <p className="text-[10px] text-slate-500">Ask about your documents</p>
          </div>
        </div>
        <button onClick={onClose}
          className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-400">
            <Bot className="w-10 h-10 mb-3 opacity-20" />
            <p className="text-sm text-center max-w-[220px] mb-4">
              Ask questions about your reviewed documents
            </p>
            <div className="space-y-2 w-full max-w-[280px]">
              {suggestions.map((q) => (
                <button key={q} onClick={() => handleSend(q)}
                  className="block w-full text-left text-xs text-indigo-600
                             hover:bg-indigo-50 px-3 py-2 rounded-lg transition-colors">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}
                        animate-in fade-in slide-in-from-bottom-2 duration-200`}>
            <div className={`flex gap-2 max-w-[90%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0
                ${msg.role === 'user' ? 'bg-indigo-600' : 'bg-slate-700'} text-white`}>
                {msg.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
              </div>
              <div className={`p-3 rounded-2xl text-sm leading-relaxed
                ${msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-sm'
                  : 'bg-slate-50 text-slate-800 rounded-tl-sm border border-slate-200'}`}>
                {msg.loading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span className="text-slate-500">Analysing...</span>
                  </div>
                ) : msg.role === 'assistant' ? (
                  <div className="prose prose-sm prose-slate max-w-none
                    [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2
                    [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2
                    [&_li]:my-1 [&_li]:leading-relaxed
                    [&_p]:my-2 [&_p]:leading-relaxed
                    [&_strong]:text-slate-900 [&_strong]:font-semibold
                    [&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-3 [&_h1]:mb-2
                    [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-1
                    [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1
                    [&_table]:w-full [&_table]:my-2 [&_table]:text-xs
                    [&_th]:bg-slate-100 [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold [&_th]:border [&_th]:border-slate-200
                    [&_td]:px-2 [&_td]:py-1.5 [&_td]:border [&_td]:border-slate-200
                    [&_blockquote]:border-l-2 [&_blockquote]:border-indigo-300 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-slate-600
                    [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:rounded [&_code]:text-xs">
                    <Markdown remarkPlugins={[remarkGfm]}>{msg.text}</Markdown>
                  </div>
                ) : (
                  <div>{msg.text}</div>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="p-3 border-t border-slate-100">
        <div className="relative flex items-center">
          <input type="text" value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            disabled={sending}
            placeholder={sending ? 'Waiting for response...' : 'Ask about your documents...'}
            className="w-full bg-slate-100 rounded-full py-2.5 pl-4 pr-10 text-sm
                       focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all
                       disabled:opacity-60" />
          <button onClick={handleSend} disabled={!input.trim() || sending}
            className="absolute right-2 p-1.5 bg-indigo-600 text-white rounded-full
                       hover:bg-indigo-700 disabled:opacity-40 transition-colors">
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
