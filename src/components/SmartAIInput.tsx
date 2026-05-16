import React, { useState, useRef } from 'react';
import { Sparkles, Mic, Image as ImageIcon, FileText, Send, X, Loader2, Paperclip } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { parseTransaction } from '../services/geminiService';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';

interface SmartAIInputProps {
  transactionType: 'sales_invoice' | 'purchase_invoice' | 'return' | 'purchase_return' | 'receipt_voucher' | 'payment_voucher' | 'cash_transfer' | 'discount';
  onDataExtracted: (data: any) => void;
  placeholder?: string;
}

export const SmartAIInput: React.FC<SmartAIInputProps> = ({ transactionType, onDataExtracted, placeholder }) => {
  const [text, setText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [attachedDoc, setAttachedDoc] = useState<string | null>(null);
  const { showNotification } = useNotification();
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleAnalyze = async () => {
    if (!text.trim() && !attachedImage && !attachedDoc) {
      showNotification(t('smart_ai_input.error_empty'), 'error');
      return;
    }

    setIsProcessing(true);
    try {
      const result = await parseTransaction(transactionType, {
        text: text.trim() || undefined,
        image: attachedImage || undefined,
      });
      onDataExtracted(result);
      showNotification(t('smart_ai_input.success_analyze'), 'success');
      // Clear after success? Maybe keep it for review
      // setText('');
      // setAttachedImage(null);
    } catch (error: any) {
      showNotification(error.message || t('common.error'), 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // For now we just store the name or base64 if small
      // Gemini can handle text from docs if we extract it, or we can send base64 if it's an image-pdf
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachedDoc(reader.result as string);
        // If it's a doc, we might want to try parsing it as text if possible
        // But for now, let's treat it as a potential image/pdf for Gemini
      };
      reader.readAsDataURL(file);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          setIsProcessing(true);
          try {
            const result = await parseTransaction(transactionType, { audio: base64Audio });
            onDataExtracted(result);
            showNotification(t('smart_ai_input.success_audio'), 'success');
          } catch (error: any) {
            showNotification(error.message || t('common.error'), 'error');
          } finally {
            setIsProcessing(false);
          }
        };
        reader.readAsDataURL(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      showNotification(t('smart_ai_input.error_mic'), 'error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className="bg-emerald-50/20 border border-emerald-100 rounded-[2.5rem] p-6 mb-8 relative">
      <div className="flex items-center justify-end gap-2 mb-4 text-emerald-600 font-black">
        <span className="text-sm tracking-tight">الإنشاء الذكي بالذكاء الاصطناعي</span>
        <Sparkles size={18} className="text-emerald-500" />
      </div>

      <div className="relative bg-white rounded-3xl border border-emerald-100 shadow-sm overflow-hidden min-h-[160px] flex group focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
        {/* Side Actions Bar */}
        <div className="w-16 border-r border-emerald-50 flex flex-col items-center py-4 gap-4 bg-zinc-50/50">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 text-emerald-600 hover:bg-white rounded-2xl transition-all hover:shadow-sm group/btn"
            title={t('smart_ai_input.attachment_image')}
          >
            <ImageIcon size={22} className="group-hover/btn:scale-110 transition-transform" />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />

          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`p-2.5 ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'text-emerald-600 hover:bg-white'} rounded-2xl transition-all hover:shadow-sm group/btn`}
            title={isRecording ? t('smart_ai_input.stop_record') : t('smart_ai_input.voice_record')}
          >
            <Mic size={22} className="group-hover/btn:scale-110 transition-transform" />
          </button>

          <button
            onClick={() => docInputRef.current?.click()}
            className="p-2.5 text-emerald-600 hover:bg-white rounded-2xl transition-all hover:shadow-sm group/btn"
            title={t('smart_ai_input.attachment_doc')}
          >
            <FileText size={22} className="group-hover/btn:scale-110 transition-transform" />
          </button>
          <input
            type="file"
            ref={docInputRef}
            onChange={handleDocChange}
            accept=".pdf,.doc,.docx,.txt"
            className="hidden"
          />
        </div>

        {/* Input Area */}
        <div className="flex-1 flex flex-col">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder || t('smart_ai_input.placeholder')}
            className="w-full flex-1 p-5 outline-none resize-none text-right text-base font-bold text-zinc-800 placeholder:text-zinc-300 bg-transparent leading-relaxed"
          />
          
          <div className="p-4 flex justify-start items-center gap-4">
            <button
              onClick={handleAnalyze}
              disabled={isProcessing || (!text.trim() && !attachedImage && !attachedDoc)}
              className="px-8 py-3 bg-emerald-500 text-white rounded-2xl font-black hover:bg-emerald-600 transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-lg shadow-emerald-500/20 active:scale-95 min-w-[140px]"
            >
              {isProcessing ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Sparkles size={20} />
              )}
              <span className="text-sm">تحليل النص</span>
            </button>

            <AnimatePresence>
              {(attachedImage || attachedDoc) && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="flex gap-2"
                >
                  {attachedImage && (
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-emerald-200 group/img">
                      <img src={attachedImage} alt="Attached" className="w-full h-full object-cover" />
                      <button
                        onClick={() => setAttachedImage(null)}
                        className="absolute inset-0 bg-black/40 flex items-center justify-center text-white opacity-0 group-hover/img:opacity-100 transition-opacity"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                  {attachedDoc && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 text-[10px] font-black">
                      <Paperclip size={12} />
                      <button
                        onClick={() => setAttachedDoc(null)}
                        className="text-red-500 hover:scale-110 transition-transform"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};
