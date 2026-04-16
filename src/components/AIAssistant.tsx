import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, X, Bot, User, Loader2, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { processAIRequest } from '../services/aiAssistantService';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AIAssistantProps {
  onNavigate?: (page: string) => void;
  isMobileFloating?: boolean;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({ onNavigate, isMobileFloating }) => {
  const { user } = useAuth();
  const { addPersistentNotification } = useNotification();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'مرحباً! أنا مساعدك الذكي. كيف يمكنني مساعدتك اليوم؟ يمكنك أن تطلب مني إضافة عملاء، موردين، أصناف، أو حتى إنشاء فواتير وسندات.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading || !user) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const result = await processAIRequest(userMessage, user);
      
      let finalResponse = result.text || 'عذراً، لم أستطع معالجة طلبك.';
      let navigationPage = null;

      // Check for navigation commands in the response (e.g., [NAVIGATE:page])
      if (result.text && result.text.includes('[NAVIGATE:')) {
        const match = result.text.match(/\[NAVIGATE:([\w-]+)\]/);
        if (match && match[1]) {
          navigationPage = match[1];
          finalResponse = result.text.replace(/\[NAVIGATE:[\w-]+\]/g, '').trim();
        }
      }

      setMessages(prev => [...prev, { role: 'assistant', content: finalResponse || (navigationPage ? 'تم الانتقال إلى الصفحة المطلوبة.' : 'عذراً، لم أستطع معالجة طلبك.') }]);
      
      if (navigationPage && onNavigate) {
        onNavigate(navigationPage);
      }

      // Add persistent notification only if an operation was performed
      if (result.operationPerformed) {
        addPersistentNotification({
          title: 'عملية ذكاء اصطناعي',
          message: finalResponse.length > 100 ? finalResponse.substring(0, 100) + '...' : finalResponse,
          type: 'success',
          category: 'ai'
        });
      }
    } catch (error: any) {
      console.error('AI Error:', error);
      const errorMessage = error.message || 'Unknown error';
      setMessages(prev => [...prev, { role: 'assistant', content: `حدث خطأ أثناء معالجة طلبك: ${errorMessage}. يرجى المحاولة مرة أخرى.` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Button or Inline Button */}
      {isMobileFloating ? (
        <button
          onClick={() => setIsOpen(true)}
          className="w-full h-full flex items-center justify-center text-white"
          title="المساعد الذكي"
        >
          <Sparkles size={24} />
        </button>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 left-6 z-50 p-4 bg-emerald-600 text-white rounded-full shadow-2xl hover:bg-emerald-700 transition-all hover:scale-110 active:scale-95 group"
          title="المساعد الذكي"
        >
          <Sparkles className="group-hover:animate-pulse" size={24} />
        </button>
      )}

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.9 }}
            className="fixed bottom-24 left-6 z-50 w-full max-w-md bg-white rounded-3xl shadow-2xl border border-zinc-100 flex flex-col overflow-hidden"
            style={{ height: '500px' }}
          >
            {/* Header */}
            <div className="p-4 bg-emerald-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot size={24} />
                <span className="font-bold">المساعد الذكي</span>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-2xl flex gap-2 ${
                      msg.role === 'user'
                        ? 'bg-emerald-600 text-white rounded-tr-none'
                        : 'bg-white text-zinc-800 shadow-sm border border-zinc-100 rounded-tl-none'
                    }`}
                  >
                    <div className="mt-1">
                      {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                    </div>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white p-3 rounded-2xl shadow-sm border border-zinc-100 rounded-tl-none flex items-center gap-2">
                    <Loader2 className="animate-spin text-emerald-600" size={16} />
                    <span className="text-sm text-zinc-500">جاري التفكير...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 bg-white border-t border-zinc-100">
              <div className="relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="اكتب طلبك هنا... (مثال: أضف عميل جديد باسم أحمد)"
                  className="w-full p-3 pr-12 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none text-sm"
                  rows={2}
                />
                <button
                  onClick={handleSend}
                  disabled={isLoading || !input.trim()}
                  className="absolute left-3 bottom-3 p-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <Send size={18} />
                </button>
              </div>
              <p className="mt-2 text-[10px] text-zinc-400 text-center">
                يمكنني مساعدتك في تنفيذ العمليات المحاسبية وإضافة البيانات الأساسية.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
