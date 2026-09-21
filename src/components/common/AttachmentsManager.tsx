import React, { useState, useRef } from 'react';
import { 
  Paperclip, Upload, X, Eye, Download, Trash2, FileText, Image as ImageIcon,
  AlertCircle, Plus, FileSpreadsheet, Presentation, FileCode, File
} from 'lucide-react';
import { AttachmentItem } from '../../types';
import { AttachmentPreviewModal } from './AttachmentPreviewModal';
import { useLanguage } from '../../contexts/LanguageContext';

interface AttachmentsManagerProps {
  attachments: AttachmentItem[];
  onChange: (attachments: AttachmentItem[]) => void;
  title?: string;
  subtitle?: string;
  maxFileSizeMB?: number;
  readOnly?: boolean;
  compact?: boolean;
}

export const AttachmentsManager: React.FC<AttachmentsManagerProps> = ({
  attachments = [],
  onChange,
  title,
  subtitle,
  maxFileSizeMB = 15,
  readOnly = false,
  compact = false
}) => {
  const { language, dir } = useLanguage();
  const isAr = language === 'ar';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [previewAttachment, setPreviewAttachment] = useState<AttachmentItem | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleFileProcess = (file: File): Promise<AttachmentItem> => {
    return new Promise((resolve, reject) => {
      if (file.size > maxFileSizeMB * 1024 * 1024) {
        reject(new Error(isAr ? `حجم الملف ${file.name} يتجاوز الحد المسموح (${maxFileSizeMB} ميجابايت)` : `File ${file.name} exceeds maximum size (${maxFileSizeMB}MB)`));
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const item: AttachmentItem = {
          id: 'att_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7),
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          url: reader.result as string,
          uploaded_at: new Date().toISOString()
        };
        resolve(item);
      };
      reader.onerror = () => {
        reject(new Error(isAr ? `فشل قراءة الملف ${file.name}` : `Failed to read file ${file.name}`));
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setErrorMessage(null);

    const newFiles = Array.from(fileList);
    const addedItems: AttachmentItem[] = [];
    const errors: string[] = [];

    for (const file of newFiles) {
      try {
        const item = await handleFileProcess(file);
        addedItems.push(item);
      } catch (err: any) {
        errors.push(err.message || 'Error processing file');
      }
    }

    if (errors.length > 0) {
      setErrorMessage(errors.join(' | '));
    }

    if (addedItems.length > 0) {
      onChange([...(attachments || []), ...addedItems]);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onChange((attachments || []).filter(att => att.id !== id));
  };

  const handleDownload = (att: AttachmentItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const a = document.createElement('a');
      a.href = att.url;
      a.download = att.name || 'document';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  const getFileInfo = (att: AttachmentItem) => {
    const name = (att.name || '').toLowerCase();
    const type = (att.type || '').toLowerCase();

    if (type.startsWith('image/') || att.url?.startsWith('data:image/') || /\.(jpg|jpeg|png|webp|gif|svg|bmp)$/i.test(name)) {
      return { category: 'image', badge: 'IMG', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    }
    if (type === 'application/pdf' || att.url?.startsWith('data:application/pdf') || /\.pdf$/i.test(name)) {
      return { category: 'pdf', badge: 'PDF', color: 'bg-rose-50 text-rose-700 border-rose-200' };
    }
    if (type.includes('word') || type.includes('officedocument.wordprocessingml') || /\.(doc|docx)$/i.test(name)) {
      return { category: 'word', badge: 'DOC', color: 'bg-blue-50 text-blue-700 border-blue-200' };
    }
    if (type.includes('excel') || type.includes('spreadsheetml') || /\.(xls|xlsx)$/i.test(name)) {
      return { category: 'excel', badge: 'XLS', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    }
    if (type.includes('presentation') || type.includes('powerpoint') || /\.(ppt|pptx)$/i.test(name)) {
      return { category: 'ppt', badge: 'PPT', color: 'bg-amber-50 text-amber-700 border-amber-200' };
    }
    if (type.startsWith('text/') || type === 'application/json' || att.url?.startsWith('data:text/') || /\.(txt|csv|tsv|json|xml|log)$/i.test(name)) {
      const ext = name.split('.').pop()?.toUpperCase() || 'TXT';
      return { category: 'text', badge: ext, color: 'bg-slate-100 text-slate-700 border-slate-300' };
    }
    const ext = name.split('.').pop()?.toUpperCase() || 'FILE';
    return { category: 'file', badge: ext.slice(0, 4), color: 'bg-slate-100 text-slate-700 border-slate-300' };
  };

  const safeAttachments = Array.isArray(attachments) ? attachments : [];

  return (
    <div className="space-y-2.5 w-full" dir={dir}>
      {/* Hidden file input supporting all common formats */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Header if title provided or when attachments exist */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 bg-emerald-600/10 text-emerald-700 rounded flex items-center justify-center">
            <Paperclip size={12} />
          </div>
          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-none">
            {title || (isAr ? 'المستندات والمرفقات' : 'Documents & Attachments')}
          </h4>
          {safeAttachments.length > 0 && (
            <span className="px-1.5 py-0.2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold rounded-full border border-emerald-200 dark:border-emerald-800">
              {safeAttachments.length}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {subtitle && <span className="text-[10px] text-slate-400">{subtitle}</span>}
          {!readOnly && safeAttachments.length > 0 && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 transition-all cursor-pointer shadow-2xs"
            >
              <Plus size={12} />
              <span>{isAr ? 'إضافة المزيد' : 'Add more'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Error notification */}
      {errorMessage && (
        <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-700 text-xs">
          <AlertCircle size={14} className="shrink-0" />
          <span className="flex-1 text-[11px] font-medium">{errorMessage}</span>
          <button 
            type="button"
            onClick={() => setErrorMessage(null)} 
            className="text-rose-500 hover:text-rose-700 p-0.5"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Upload Drop Zone (shown when empty or always available unless readOnly) */}
      {!readOnly && safeAttachments.length === 0 && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer rounded-xl border-2 border-dashed transition-all p-3.5 text-center flex flex-col items-center justify-center gap-1.5 ${
            isDragging 
              ? 'border-emerald-500 bg-emerald-50/70 scale-[0.99]' 
              : 'border-slate-200 hover:border-emerald-400 hover:bg-slate-50/80 bg-white/70'
          }`}
        >
          <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-xs">
            <Upload size={16} />
          </div>
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
              {isAr ? 'اضغط لرفع مستند أو صورة، أو اسحب الملفات هنا' : 'Click to upload document or image, or drag files here'}
            </p>
            <p className="text-[10px] text-slate-400 font-medium">
              {isAr 
                ? `يدعم الصور (PNG, JPG)، ملفات PDF، ومستندات أوفيس (Word, Excel) والملفات النصية (بحد أقصى ${maxFileSizeMB} ميجابايت)` 
                : `Supports images, PDF, Office documents (Word, Excel) & Text (up to ${maxFileSizeMB}MB)`}
            </p>
          </div>
        </div>
      )}

      {/* Attachments List / Grid */}
      {safeAttachments.length > 0 && (
        <div className={`grid gap-2 ${compact ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'}`}>
          {safeAttachments.map((att) => {
            const fileInfo = getFileInfo(att);

            return (
              <div
                key={att.id}
                className="group relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 hover:border-emerald-400 dark:hover:border-emerald-500 hover:shadow-xs transition-all flex items-center gap-2.5 overflow-hidden"
              >
                {/* Thumbnail / Icon preview */}
                <div 
                  onClick={() => setPreviewAttachment(att)}
                  className="w-11 h-11 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 shrink-0 flex items-center justify-center overflow-hidden cursor-pointer relative group/thumb"
                  title={isAr ? 'انقر للمعاينة' : 'Click to preview'}
                >
                  {fileInfo.category === 'image' ? (
                    <img 
                      src={att.url} 
                      alt={att.name} 
                      className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform" 
                    />
                  ) : fileInfo.category === 'pdf' ? (
                    <div className="flex flex-col items-center justify-center text-rose-600">
                      <FileText size={18} />
                      <span className="text-[8px] font-black uppercase tracking-tight">PDF</span>
                    </div>
                  ) : fileInfo.category === 'word' ? (
                    <div className="flex flex-col items-center justify-center text-blue-600">
                      <FileText size={18} />
                      <span className="text-[8px] font-black uppercase tracking-tight">DOC</span>
                    </div>
                  ) : fileInfo.category === 'excel' ? (
                    <div className="flex flex-col items-center justify-center text-emerald-600">
                      <FileSpreadsheet size={18} />
                      <span className="text-[8px] font-black uppercase tracking-tight">XLS</span>
                    </div>
                  ) : fileInfo.category === 'ppt' ? (
                    <div className="flex flex-col items-center justify-center text-amber-600">
                      <Presentation size={18} />
                      <span className="text-[8px] font-black uppercase tracking-tight">PPT</span>
                    </div>
                  ) : fileInfo.category === 'text' ? (
                    <div className="flex flex-col items-center justify-center text-slate-600 dark:text-slate-300">
                      <FileCode size={18} />
                      <span className="text-[8px] font-black uppercase tracking-tight">{fileInfo.badge}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-600 dark:text-slate-300">
                      <File size={18} />
                      <span className="text-[8px] font-black uppercase tracking-tight">{fileInfo.badge}</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center text-white">
                    <Eye size={13} />
                  </div>
                </div>

                {/* File info */}
                <div className="flex-1 min-w-0">
                  <p 
                    className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate cursor-pointer hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                    title={att.name}
                    onClick={() => setPreviewAttachment(att)}
                  >
                    {att.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400 font-mono">
                    <span className={`px-1 py-0.2 rounded text-[8px] font-black uppercase border ${fileInfo.color}`}>
                      {fileInfo.badge}
                    </span>
                    <span>{formatFileSize(att.size)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setPreviewAttachment(att)}
                    className="p-1 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-slate-700 transition-colors"
                    title={isAr ? 'معاينة' : 'Preview'}
                  >
                    <Eye size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDownload(att, e)}
                    className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors"
                    title={isAr ? 'تحميل' : 'Download'}
                  >
                    <Download size={13} />
                  </button>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={(e) => handleDelete(att.id, e)}
                      className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-700 transition-colors"
                      title={isAr ? 'حذف' : 'Delete'}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview Modal */}
      {previewAttachment && (
        <AttachmentPreviewModal
          isOpen={Boolean(previewAttachment)}
          onClose={() => setPreviewAttachment(null)}
          attachment={previewAttachment}
          title={previewAttachment.name}
        />
      )}
    </div>
  );
};

