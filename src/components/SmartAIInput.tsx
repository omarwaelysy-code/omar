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
    <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-3 mb-4">
      <div className="flex items-center gap-2 mb-2 text-emerald-700 font-bold">
        <Sparkles size={16} className="text-emerald-500" />
        <span className="text-sm">{t('smart_ai_input.title')}</span>
      </div>

      <div className="relative group">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder || t('smart_ai_input.placeholder')}
          className="w-full h-20 bg-white border border-emerald-100 rounded-xl p-3 pr-10 pl-10 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all resize-none text-right text-sm"
        />

        <div className="absolute left-3 top-3 flex flex-col gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 bg-white border border-emerald-100 text-emerald-600 rounded-xl hover:bg-emerald-50 transition-all shadow-sm"
            title={t('smart_ai_input.attachment_image')}
          >
            <ImageIcon size={20} />
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
            className={`p-2 ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-white border border-emerald-100 text-emerald-600 hover:bg-emerald-50'} rounded-xl transition-all shadow-sm`}
            title={isRecording ? t('smart_ai_input.stop_record') : t('smart_ai_input.voice_record')}
          >
            <Mic size={20} />
          </button>

          <button
            onClick={() => docInputRef.current?.click()}
            className="p-2 bg-white border border-emerald-100 text-emerald-600 rounded-xl hover:bg-emerald-50 transition-all shadow-sm"
            title={t('smart_ai_input.attachment_doc')}
          >
            <FileText size={20} />
          </button>
          <input
            type="file"
            ref={docInputRef}
            onChange={handleDocChange}
            accept=".pdf,.doc,.docx,.txt"
            className="hidden"
          />
        </div>

        <div className="absolute right-3 bottom-3">
          <button
            onClick={handleAnalyze}
            disabled={isProcessing || (!text.trim() && !attachedImage && !attachedDoc)}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-emerald-600/20"
          >
            {isProcessing ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Sparkles size={18} />
            )}
            {t('smart_ai_input.analyze')}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {(attachedImage || attachedDoc) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mt-3 flex flex-wrap gap-2"
          >
            {attachedImage && (
              <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-emerald-200 group">
                <img src={attachedImage} alt="Attached" className="w-full h-full object-cover" />
                <button
                  onClick={() => setAttachedImage(null)}
                  className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={12} />
                </button>
              </div>
            )}
            {attachedDoc && (
              <div className="flex items-center gap-2 px-3 py-2 bg-white border border-emerald-100 rounded-xl text-emerald-700 text-xs font-medium">
                <Paperclip size={14} />
                <span>{t('smart_ai_input.attached_doc')}</span>
                <button
                  onClick={() => setAttachedDoc(null)}
                  className="text-red-500 hover:text-red-700"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
