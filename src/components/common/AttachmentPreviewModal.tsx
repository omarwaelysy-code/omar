import React, { useState, useEffect } from 'react';
import { 
  X, Download, ExternalLink, ZoomIn, ZoomOut, RotateCcw, 
  FileText, Image as ImageIcon, FileSpreadsheet, Presentation,
  FileCode, Copy, Check, File
} from 'lucide-react';
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
  const [textContent, setTextContent] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setZoom(1);
    setTextContent(null);
    setCopied(false);

    if (attachment && attachment.url) {
      const fileName = attachment.name || '';
      const isText = Boolean(
        attachment.type?.startsWith('text/') ||
        attachment.type === 'application/json' ||
        attachment.url.startsWith('data:text/') ||
        /\.(txt|csv|tsv|json|xml|log)$/i.test(fileName)
      );

      if (isText && attachment.url.startsWith('data:')) {
        try {
          const base64Index = attachment.url.indexOf('base64,');
          if (base64Index !== -1) {
            const base64 = attachment.url.substring(base64Index + 7);
            const decoded = decodeURIComponent(escape(atob(base64)));
            setTextContent(decoded);
          } else {
            const raw = decodeURIComponent(attachment.url.split(',')[1] || '');
            setTextContent(raw);
          }
        } catch (e) {
          console.error('Error decoding text content:', e);
        }
      }
    }
  }, [attachment]);

  if (!isOpen || !attachment || !attachment.url) return null;

  const fileName = (attachment.name || '').toLowerCase();
  const fileType = (attachment.type || '').toLowerCase();

  const isImage = Boolean(
    fileType.startsWith('image/') ||
    attachment.url.startsWith('data:image/') ||
    /\.(jpg|jpeg|png|webp|gif|svg|bmp)$/i.test(fileName)
  );

  const isPdf = Boolean(
    fileType === 'application/pdf' ||
    attachment.url.startsWith('data:application/pdf') ||
    /\.pdf$/i.test(fileName)
  );

  const isWord = Boolean(
    fileType.includes('word') ||
    fileType.includes('officedocument.wordprocessingml') ||
    /\.(doc|docx)$/i.test(fileName)
  );

  const isExcel = Boolean(
    fileType.includes('excel') ||
    fileType.includes('spreadsheetml') ||
    /\.(xls|xlsx)$/i.test(fileName)
  );

  const isPpt = Boolean(
    fileType.includes('presentation') ||
    fileType.includes('powerpoint') ||
    /\.(ppt|pptx)$/i.test(fileName)
  );

  const isText = Boolean(
    fileType.startsWith('text/') ||
    fileType === 'application/json' ||
    attachment.url.startsWith('data:text/') ||
    /\.(txt|csv|tsv|json|xml|log)$/i.test(fileName)
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
      a.download = attachment.name || 'document';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to download attachment:', err);
      window.open(attachment.url, '_blank');
    }
  };

  const handleCopyText = () => {
    if (!textContent) return;
    navigator.clipboard.writeText(textContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
  const handleResetZoom = () => setZoom(1);

  // Determine top header icon & color
  const getHeaderStyle = () => {
    if (isImage) return { icon: <ImageIcon className="w-4 h-4" />, bg: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400' };
    if (isPdf) return { icon: <FileText className="w-4 h-4" />, bg: 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400' };
    if (isWord) return { icon: <FileText className="w-4 h-4" />, bg: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' };
    if (isExcel) return { icon: <FileSpreadsheet className="w-4 h-4" />, bg: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400' };
    if (isPpt) return { icon: <Presentation className="w-4 h-4" />, bg: 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400' };
    if (isText) return { icon: <FileCode className="w-4 h-4" />, bg: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300' };
    return { icon: <File className="w-4 h-4" />, bg: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300' };
  };

  const headerStyle = getHeaderStyle();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm" dir={dir}>
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-8 h-8 rounded-lg ${headerStyle.bg} flex items-center justify-center shrink-0`}>
              {headerStyle.icon}
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer shadow-sm shadow-emerald-500/20"
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
                alt={attachment.name || 'Image'}
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
          ) : isText && textContent !== null ? (
            <div className="w-full h-[65vh] flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-xs">
                <span className="font-mono text-slate-500">{attachment.name}</span>
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-medium transition-colors"
                >
                  {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                  <span>{copied ? (isAr ? 'تم النسخ' : 'Copied') : (isAr ? 'نسخ النص' : 'Copy Text')}</span>
                </button>
              </div>
              <pre className="flex-1 overflow-auto p-4 font-mono text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap select-text text-left">
                {textContent}
              </pre>
            </div>
          ) : (
            /* Office / Word / Excel / PPT / Generic Card */
            <div className="text-center p-8 max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">
              <div className={`w-20 h-20 rounded-2xl mx-auto flex items-center justify-center shadow-inner ${
                isWord 
                  ? 'bg-blue-50 text-blue-600 border border-blue-200' 
                  : isExcel 
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                  : isPpt
                  ? 'bg-amber-50 text-amber-600 border border-amber-200'
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}>
                {isWord && <FileText size={38} />}
                {isExcel && <FileSpreadsheet size={38} />}
                {isPpt && <Presentation size={38} />}
                {!isWord && !isExcel && !isPpt && <File size={38} />}
              </div>

              <div>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider mb-2 ${
                  isWord 
                    ? 'bg-blue-100 text-blue-800' 
                    : isExcel 
                    ? 'bg-emerald-100 text-emerald-800'
                    : isPpt
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-200 text-slate-700'
                }`}>
                  {isWord ? 'Microsoft Word' : isExcel ? 'Microsoft Excel' : isPpt ? 'PowerPoint' : (attachment.name?.split('.').pop() || 'Office Document')}
                </span>
                <p className="font-bold text-slate-800 dark:text-slate-100 text-sm break-words">
                  {attachment.name}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {formatFileSize(attachment.size)} {attachment.uploaded_at ? `• ${String(attachment.uploaded_at).slice(0, 10)}` : ''}
                </p>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>{isAr ? 'تحميل الملف وفتحه على جهازك' : 'Download File to Open Locally'}</span>
                </button>
                <a
                  href={attachment.url}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{isAr ? 'فتح في نافذة مستقلة' : 'Open in New Window'}</span>
                </a>
              </div>
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
              {isAr ? 'مستند مرفق بالحركة' : 'Transaction supporting document'}
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
