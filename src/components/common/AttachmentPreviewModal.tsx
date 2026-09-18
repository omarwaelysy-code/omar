import React, { useState } from 'react';
import { X, Download, ExternalLink, ZoomIn, ZoomOut, RotateCcw, FileText, Image as ImageIcon } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

export interface ChequeAttachmentData {
  id?: string;
  name?: string;
  size?: number;
  type?: string;
  url?: string;
  uploaded_at?: string;
}

interface AttachmentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  attachment: ChequeAttachmentData | null;
  title?: string;
}

export const AttachmentPreviewModal: React.FC<AttachmentPreviewModalProps> = ({
  isOpen,
  onClose,
  attachment,
  title
}) => {
  const { language, dir } = useLanguage();
  const isAr = language === 'ar';
  const [zoom, setZoom] = useState(1);

  if (!isOpen || !attachment || !attachment.url) return null;

  const isImage = Boolean(
    attachment.type?.startsWith('image/') ||
    attachment.url.startsWith('data:image/') ||
    /\.(jpg|jpeg|png|webp|gif|svg|bmp)$/i.test(attachment.name || '')
  );

  const isPdf = Boolean(
    attachment.type === 'application/pdf' ||
    attachment.url.startsWith('data:application/pdf') ||
    /\.pdf$/i.test(attachment.name || '')
  );

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleDownload = () => {
    if (!attachment.url) return;
    try {
      const a = document.createElement('a');
      a.href = attachment.url;
      a.download = attachment.name || 'cheque_document';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to download attachment:', err);
      window.open(attachment.url, '_blank');
    }
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
  const handleResetZoom = () => setZoom(1);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm" dir={dir}>
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              {isImage ? <ImageIcon className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {attachment.name || title || (isAr ? 'عرض المرفق' : 'Attachment Preview')}
              </h3>
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                {attachment.size && <span>{formatFileSize(attachment.size)}</span>}
                {attachment.uploaded_at && (
                  <span>• {String(attachment.uploaded_at).slice(0, 10)}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Download Button in Header */}
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer shadow-sm shadow-blue-500/20"
              title={isAr ? 'تحميل المرفق' : 'Download Attachment'}
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isAr ? 'تحميل' : 'Download'}</span>
            </button>

            {/* Open in New Tab */}
            <a
              href={attachment.url}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={isAr ? 'فتح في علامة تبويب جديدة' : 'Open in New Tab'}
            >
              <ExternalLink className="w-4 h-4" />
            </a>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Viewer Body */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-950/5 dark:bg-slate-950/40 min-h-[350px]">
          {isImage ? (
            <div className="relative flex items-center justify-center w-full h-full overflow-auto">
              <img
                src={attachment.url}
                alt={attachment.name || 'Cheque Image'}
                style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
                className="max-h-[65vh] max-w-full object-contain rounded-lg shadow-md transition-transform duration-150"
              />
            </div>
          ) : isPdf ? (
            <iframe
              src={attachment.url}
              title={attachment.name || 'PDF Document'}
              className="w-full h-[65vh] rounded-lg border border-slate-200 dark:border-slate-700 bg-white"
            />
          ) : (
            <div className="text-center p-8 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto text-2xl">
                📄
              </div>
              <div>
                <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{attachment.name}</p>
                <p className="text-xs text-slate-400 mt-1">{attachment.type || (isAr ? 'مستند مرفق' : 'Document')}</p>
              </div>
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{isAr ? 'تحميل الملف إلى جهازك' : 'Download File to Device'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer with Controls (Zoom for image + Download info) */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-xs">
          {isImage ? (
            <div className="flex items-center gap-1.5 text-slate-500">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
                title={isAr ? 'تصغير' : 'Zoom Out'}
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="font-mono text-xs font-bold w-12 text-center">{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoom >= 3}
                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
                title={isAr ? 'تكبير' : 'Zoom In'}
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 cursor-pointer"
                title={isAr ? 'إعادة ضبط الحجم' : 'Reset Zoom'}
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="text-slate-400 text-[11px]">
              {isAr ? 'مستند مؤيد للشيك' : 'Cheque supporting document'}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isAr ? 'تحميل' : 'Download'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-200/80 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            >
              {isAr ? 'إغلاق' : 'Close'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
