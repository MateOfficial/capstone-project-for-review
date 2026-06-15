import { useState, useRef, useEffect } from 'react';
import { Send, X, Minimize2, Bot } from 'lucide-react';
import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const QUICK_PROMPTS = [
  'Which synthesizers are in stock?',
  'Guitars with prices and stock',
  'What is the Yamaha PSR-E373?',
];

export default function AiAssistantEmployee() {
  const [open, setOpen] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/employee/ai/status')
      .then(res => setConfigured(res.data.data?.configured ?? false))
      .catch(() => setConfigured(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;

    const history = [...messages];
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.post('/employee/ai/chat', { message: msg, history });
      const data = res.data.data;
      if (data.success) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${data.error}` }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  if (configured === false) return null;

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 bg-teal-700 hover:bg-teal-800 text-white rounded-full p-4 shadow-lg transition-colors flex items-center gap-2 pr-5"
          title="Ask AI about this product"
        >
          <Bot size={22} />
          <span className="text-sm font-medium">Ask AI</span>
        </button>
      )}

      {/* Chat window */}
      {open && (
        <div
          className="fixed bottom-6 right-6 z-50 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col"
          style={{ height: '500px' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-teal-700 rounded-t-2xl">
            <div className="flex items-center gap-2 text-white">
              <Bot size={18} />
              <div>
                <p className="font-medium text-sm leading-tight">AI assistant</p>
                <p className="text-teal-200 text-xs leading-tight">Ask about a product or model</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setOpen(false)} className="text-teal-200 hover:text-white p-1">
                <Minimize2 size={15} />
              </button>
              <button
                onClick={() => { setOpen(false); setMessages([]); }}
                className="text-teal-200 hover:text-white p-1"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-gray-400 text-sm mt-4">
                <Bot size={28} className="mx-auto mb-2 text-teal-300" />
                <p className="font-medium text-gray-600">Hello! How can I help?</p>
                <p className="text-xs mt-1 mb-3">Ask about specs, price, or availability</p>
                <div className="space-y-2 text-left">
                  {QUICK_PROMPTS.map(prompt => (
                    <button
                      key={prompt}
                      onClick={() => sendMessage(prompt)}
                      className="w-full text-left text-xs px-3 py-2 rounded-xl border border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100 transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-teal-700 text-white rounded-br-sm'
                      : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-3 py-2">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-gray-100">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder="Ask a question about the product…"
                className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400"
                disabled={loading}
              />
              <button
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                className="bg-teal-700 hover:bg-teal-800 disabled:bg-teal-300 text-white rounded-xl px-3 py-2 transition-colors"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
