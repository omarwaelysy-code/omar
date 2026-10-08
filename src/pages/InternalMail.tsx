import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail,
  Send,
  Inbox,
  Star,
  Archive,
  Trash2,
  Search,
  Plus,
  Paperclip,
  X,
  Reply,
  Forward,
  Check,
  CheckCheck,
  Clock,
  User as UserIcon,
  Headphones,
  Building,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  FileText,
  Download,
  Eye,
  AlertCircle,
  FileSpreadsheet,
  FileCode,
  Image as ImageIcon,
  Sparkles,
  ArrowRight,
  Filter
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotification } from '../contexts/NotificationContext';
import { dbService } from '../services/dbService';
import { InternalMessage, MailUser, AttachmentItem } from '../types';
import { AttachmentsManager } from '../components/common/AttachmentsManager';
import { AttachmentPreviewModal } from '../components/common/AttachmentPreviewModal';

type FolderType = 'inbox' | 'sent' | 'starred' | 'archive' | 'trash';
type MailCategory = 'company' | 'support';

// Helper to format exact Day, Date, and Time in Arabic / English
export function formatMailDateTime(dateStr?: string, isAr: boolean = true) {
  if (!dateStr) return { dayName: '', fullDate: '', timeStr: '', displayString: '' };
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return { dayName: '', fullDate: dateStr, timeStr: '', displayString: dateStr };

    const dayNamesAr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const dayNamesEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = isAr ? dayNamesAr[d.getDay()] : dayNamesEn[d.getDay()];

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const fullDate = `${year}/${month}/${day}`;

    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const isPM = hours >= 12;
    hours = hours % 12 || 12;
    const ampm = isAr ? (isPM ? 'م' : 'ص') : (isPM ? 'PM' : 'AM');
    const timeStr = `${hours}:${minutes} ${ampm}`;

    const displayString = isAr
      ? `${dayName}، ${fullDate} - الساعة ${timeStr}`
      : `${dayName}, ${fullDate} at ${timeStr}`;

    const shortDisplay = `${dayName} ${timeStr}`;

    return { dayName, fullDate, timeStr, displayString, shortDisplay };
  } catch {
    return { dayName: '', fullDate: dateStr, timeStr: '', displayString: dateStr, shortDisplay: dateStr };
  }
}

export const InternalMail: React.FC = () => {
  const { user } = useAuth();
  const { language, dir } = useLanguage();
  const { showNotification } = useNotification();
  const isAr = language === 'ar';

  // Active Category: 'company' (بريد الشركة الداخلي) or 'support' (الدعم الفني)
  const [activeCategory, setActiveCategory] = useState<MailCategory>('company');
  const [activeFolder, setActiveFolder] = useState<FolderType>('inbox');
  
  // Data
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [contacts, setContacts] = useState<MailUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<InternalMessage | null>(null);

  // Unread counters
  const [unreadCounts, setUnreadCounts] = useState({ total: 0, company: 0, support: 0 });

  // Compose Modal State
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState<MailUser[]>([]);
  const [composeCc, setComposeCc] = useState<MailUser[]>([]);
  const [showCcInput, setShowCcInput] = useState(false);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeAttachments, setComposeAttachments] = useState<AttachmentItem[]>([]);
  const [sending, setSending] = useState(false);

  // Quick reply state
  const [replyBody, setReplyBody] = useState('');
  const [replyAttachments, setReplyAttachments] = useState<AttachmentItem[]>([]);
  const [showReplyAttachments, setShowReplyAttachments] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);

  // Attachment preview modal
  const [previewAttachment, setPreviewAttachment] = useState<AttachmentItem | null>(null);

  // Recipient search dropdown states in Compose
  const [toSearchQuery, setToSearchQuery] = useState('');
  const [isToDropdownOpen, setIsToDropdownOpen] = useState(false);
  const [ccSearchQuery, setCcSearchQuery] = useState('');
  const [isCcDropdownOpen, setIsCcDropdownOpen] = useState(false);

  const toDropdownRef = useRef<HTMLDivElement>(null);
  const ccDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toDropdownRef.current && !toDropdownRef.current.contains(e.target as Node)) {
        setIsToDropdownOpen(false);
      }
      if (ccDropdownRef.current && !ccDropdownRef.current.contains(e.target as Node)) {
        setIsCcDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch unread count & trigger global layout update
  const fetchUnreadCounts = async () => {
    try {
      const counts = await dbService.getInternalMailUnreadCount();
      setUnreadCounts(counts);
      window.dispatchEvent(new CustomEvent('internal_mail_updated', { detail: counts }));
    } catch (e) {
      console.error('Failed to fetch unread mail count:', e);
    }
  };

  // Fetch contacts for the active category
  const fetchContacts = async () => {
    try {
      const data = await dbService.getInternalMailContacts(activeCategory);
      setContacts(data || []);
    } catch (e) {
      console.error('Failed to fetch contacts:', e);
    }
  };

  // Fetch messages from database
  const fetchMessages = async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      // Fetch all messages for current company/user
      const allMsgs = await dbService.getAll<InternalMessage>('internal_messages');
      setMessages(allMsgs || []);
      await fetchUnreadCounts();
    } catch (e: any) {
      console.error('Failed to fetch internal messages:', e);
      showNotification(isAr ? 'فشل تحميل الرسائل' : 'Failed to load messages', 'error');
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  // Initial load and category change
  useEffect(() => {
    fetchMessages(true);
    fetchContacts();
  }, [activeCategory]);

  // Filter messages based on active Category, Folder, and Search Query
  const currentUserId = user?.id || '';
  const filteredMessages = useMemo(() => {
    return messages.filter(msg => {
      // 1. Filter by category ('company' or 'support')
      if (msg.category !== activeCategory) return false;

      // Check soft-deleted
      const isDeleted = Array.isArray(msg.deleted_by) && msg.deleted_by.includes(currentUserId);
      const isArchived = Array.isArray(msg.archived_by) && msg.archived_by.includes(currentUserId);
      const isStarred = Array.isArray(msg.is_starred) && msg.is_starred.includes(currentUserId);

      // Sent by me?
      const isSentByMe = msg.sender_id === currentUserId;
      // Addressed to me (either in To or CC)?
      const isToMe = Array.isArray(msg.to_users) && msg.to_users.some(u => u.id === currentUserId);
      const isCcMe = Array.isArray(msg.cc_users) && msg.cc_users.some(u => u.id === currentUserId);
      const isAddressedToMe = isToMe || isCcMe;

      // Super admin can see all support messages
      const isSuperAdminSupport = user?.role === 'super_admin' && msg.category === 'support';

      // If viewing trash
      if (activeFolder === 'trash') {
        if (!isDeleted) return false;
      } else {
        // Exclude deleted
        if (isDeleted) return false;

        // Folder filtering
        if (activeFolder === 'archive') {
          if (!isArchived) return false;
        } else {
          // If archived, don't show in regular inbox/sent/starred
          if (isArchived) return false;

          if (activeFolder === 'starred') {
            if (!isStarred) return false;
          } else if (activeFolder === 'sent') {
            if (!isSentByMe) return false;
          } else if (activeFolder === 'inbox') {
            if (!isAddressedToMe && !isSuperAdminSupport) return false;
          }
        }
      }

      // Search Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const subjectMatch = msg.subject?.toLowerCase().includes(q);
        const bodyMatch = msg.body?.toLowerCase().includes(q);
        const senderMatch = msg.sender_name?.toLowerCase().includes(q);
        const toMatch = Array.isArray(msg.to_users) && msg.to_users.some(u => u.name?.toLowerCase().includes(q));
        const ccMatch = Array.isArray(msg.cc_users) && msg.cc_users.some(u => u.name?.toLowerCase().includes(q));
        if (!subjectMatch && !bodyMatch && !senderMatch && !toMatch && !ccMatch) return false;
      }

      return true;
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [messages, activeCategory, activeFolder, searchQuery, currentUserId, user?.role]);

  // Folder Counts
  const folderCounts = useMemo(() => {
    let inboxUnread = 0;
    let inboxTotal = 0;
    let sentTotal = 0;
    let starredTotal = 0;
    let archiveTotal = 0;
    let trashTotal = 0;

    messages.forEach(msg => {
      if (msg.category !== activeCategory) return;
      const isDeleted = Array.isArray(msg.deleted_by) && msg.deleted_by.includes(currentUserId);
      const isArchived = Array.isArray(msg.archived_by) && msg.archived_by.includes(currentUserId);
      const isStarred = Array.isArray(msg.is_starred) && msg.is_starred.includes(currentUserId);
      const isSentByMe = msg.sender_id === currentUserId;
      const isToMe = Array.isArray(msg.to_users) && msg.to_users.some(u => u.id === currentUserId);
      const isCcMe = Array.isArray(msg.cc_users) && msg.cc_users.some(u => u.id === currentUserId);
      const isAddressedToMe = isToMe || isCcMe;
      const isSuperAdminSupport = user?.role === 'super_admin' && msg.category === 'support';
      const isRead = Array.isArray(msg.read_by) && msg.read_by.includes(currentUserId);

      if (isDeleted) {
        trashTotal++;
      } else if (isArchived) {
        archiveTotal++;
      } else {
        if (isStarred) starredTotal++;
        if (isSentByMe) sentTotal++;
        if (isAddressedToMe || isSuperAdminSupport) {
          inboxTotal++;
          if (!isRead && !isSentByMe) inboxUnread++;
        }
      }
    });

    return { inboxUnread, inboxTotal, sentTotal, starredTotal, archiveTotal, trashTotal };
  }, [messages, activeCategory, currentUserId, user?.role]);

  // Open Message and Mark Read
  const handleSelectMessage = async (msg: InternalMessage) => {
    setSelectedMessage(msg);
    const isRead = Array.isArray(msg.read_by) && msg.read_by.includes(currentUserId);
    if (!isRead) {
      try {
        await dbService.markInternalMailRead(msg.id);
        setMessages(prev => prev.map(m => m.id === msg.id ? {
          ...m,
          read_by: [...(m.read_by || []), currentUserId]
        } : m));
        fetchUnreadCounts();
      } catch (e) {
        console.error('Failed to mark read:', e);
      }
    }
  };

  // Toggle Star
  const handleToggleStar = async (msgId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await dbService.toggleInternalMailStar(msgId);
      setMessages(prev => prev.map(m => {
        if (m.id !== msgId) return m;
        const currentStars = Array.isArray(m.is_starred) ? m.is_starred : [];
        const newStars = res.is_starred
          ? [...currentStars, currentUserId]
          : currentStars.filter(id => id !== currentUserId);
        return { ...m, is_starred: newStars };
      }));
      if (selectedMessage?.id === msgId) {
        setSelectedMessage(prev => prev ? {
          ...prev,
          is_starred: res.is_starred
            ? [...(prev.is_starred || []), currentUserId]
            : (prev.is_starred || []).filter(id => id !== currentUserId)
        } : null);
      }
    } catch (e) {
      console.error('Failed to toggle star:', e);
    }
  };

  // Toggle Archive
  const handleToggleArchive = async (msgId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await dbService.toggleInternalMailArchive(msgId);
      setMessages(prev => prev.map(m => {
        if (m.id !== msgId) return m;
        const cur = Array.isArray(m.archived_by) ? m.archived_by : [];
        const newArr = res.is_archived ? [...cur, currentUserId] : cur.filter(id => id !== currentUserId);
        return { ...m, archived_by: newArr };
      }));
      if (selectedMessage?.id === msgId) {
        setSelectedMessage(null);
      }
      showNotification(isAr ? 'تم تحديث حالة الأرشيف' : 'Archive updated', 'success');
      fetchUnreadCounts();
    } catch (e) {
      console.error('Failed to toggle archive:', e);
    }
  };

  // Delete or Move to Trash
  const handleDeleteMessage = async (msgId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      // If already in trash, permanent delete or mark as deleted
      const msg = messages.find(m => m.id === msgId);
      const isAlreadyInTrash = Array.isArray(msg?.deleted_by) && msg?.deleted_by.includes(currentUserId);

      if (isAlreadyInTrash) {
        if (!confirm(isAr ? 'هل أنت متأكد من الحذف النهائي للرسالة؟' : 'Permanently delete this message?')) return;
        await dbService.delete('internal_messages', msgId);
        setMessages(prev => prev.filter(m => m.id !== msgId));
      } else {
        // Move to trash by adding current user to deleted_by
        const curDeleted = Array.isArray(msg?.deleted_by) ? msg!.deleted_by : [];
        const updatedDeleted = [...curDeleted, currentUserId];
        await dbService.update('internal_messages', msgId, { deleted_by: updatedDeleted });
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, deleted_by: updatedDeleted } : m));
      }

      if (selectedMessage?.id === msgId) {
        setSelectedMessage(null);
      }
      showNotification(isAr ? 'تم نقل الرسالة إلى المهملات' : 'Message moved to trash', 'success');
      fetchUnreadCounts();
    } catch (e) {
      console.error('Failed to delete message:', e);
      showNotification(isAr ? 'فشل حذف الرسالة' : 'Failed to delete message', 'error');
    }
  };

  // Send New Message
  const handleSendMessage = async () => {
    if (composeTo.length === 0) {
      showNotification(isAr ? 'يرجى تحديد مستلم واحد على الأقل (To)' : 'Please select at least one recipient (To)', 'error');
      return;
    }
    if (!composeSubject.trim()) {
      showNotification(isAr ? 'يرجى كتابة عنوان الرسالة' : 'Please enter a message subject', 'error');
      return;
    }
    if (!composeBody.trim()) {
      showNotification(isAr ? 'يرجى كتابة نص الرسالة' : 'Please enter the message body', 'error');
      return;
    }

    setSending(true);
    try {
      const payload: Partial<InternalMessage> = {
        company_id: user?.company_id,
        category: activeCategory,
        sender_id: user?.id || 'unknown',
        sender_name: user?.name || user?.username || 'المستخدم',
        sender_email: user?.email || '',
        to_users: composeTo,
        cc_users: composeCc,
        subject: composeSubject.trim(),
        body: composeBody.trim(),
        attachments: composeAttachments,
        is_starred: [],
        read_by: [user?.id || ''], // Sender already read their own sent message
        archived_by: [],
        deleted_by: []
      };

      const created = await dbService.create<InternalMessage>('internal_messages', payload);
      setMessages(prev => [created, ...prev]);
      
      showNotification(isAr ? 'تم إرسال الرسالة بنجاح' : 'Message sent successfully', 'success');
      setIsComposeOpen(false);
      setComposeTo([]);
      setComposeCc([]);
      setShowCcInput(false);
      setComposeSubject('');
      setComposeBody('');
      setComposeAttachments([]);

      fetchUnreadCounts();
    } catch (e: any) {
      console.error('Failed to send message:', e);
      showNotification(isAr ? 'فشل في إرسال الرسالة' : 'Failed to send message', 'error');
    } finally {
      setSending(false);
    }
  };

  // Quick Reply inside message detail
  const handleSendReply = async () => {
    if (!selectedMessage || !replyBody.trim()) return;
    setSendingReply(true);
    try {
      // In reply, To is original sender + other recipients
      const replyTo: MailUser[] = [{
        id: selectedMessage.sender_id,
        name: selectedMessage.sender_name,
        email: selectedMessage.sender_email
      }];

      const payload: Partial<InternalMessage> = {
        company_id: user?.company_id,
        category: selectedMessage.category,
        parent_id: selectedMessage.id,
        sender_id: user?.id || 'unknown',
        sender_name: user?.name || user?.username || 'المستخدم',
        sender_email: user?.email || '',
        to_users: replyTo,
        cc_users: selectedMessage.cc_users || [],
        subject: selectedMessage.subject.startsWith('Re:') || selectedMessage.subject.startsWith('رد:')
          ? selectedMessage.subject
          : `رد: ${selectedMessage.subject}`,
        body: replyBody.trim(),
        attachments: replyAttachments,
        is_starred: [],
        read_by: [user?.id || ''],
        archived_by: [],
        deleted_by: []
      };

      const created = await dbService.create<InternalMessage>('internal_messages', payload);
      setMessages(prev => [created, ...prev]);
      setReplyBody('');
      setReplyAttachments([]);
      setShowReplyAttachments(false);
      showNotification(isAr ? 'تم إرسال الرد بنجاح' : 'Reply sent successfully', 'success');
      fetchUnreadCounts();
    } catch (e: any) {
      console.error('Failed to reply:', e);
      showNotification(isAr ? 'فشل في إرسال الرد' : 'Failed to send reply', 'error');
    } finally {
      setSendingReply(false);
    }
  };

  // Prepare Forward
  const handleForward = (msg: InternalMessage) => {
    setComposeSubject(`إعادة توجيه: ${msg.subject}`);
    setComposeBody(`\n\n--- الرسالة الأصلية ---\nمن: ${msg.sender_name}\nالتاريخ: ${formatMailDateTime(msg.created_at, isAr).displayString}\nالموضوع: ${msg.subject}\n\n${msg.body}`);
    setComposeAttachments(msg.attachments || []);
    setComposeTo([]);
    setComposeCc([]);
    setIsComposeOpen(true);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] min-h-[550px] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm" dir={dir}>
      {/* 1. TOP HEADER & MAIN TABS */}
      <div className="bg-white dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 px-6 py-3 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-xl border border-emerald-100 dark:border-emerald-800/40">
            <Mail className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span>{isAr ? 'البريد والمراسلات الداخلية' : 'Internal Mail & Messages'}</span>
            </h1>
            <p className="text-xs text-slate-400">
              {isAr ? 'مراسلات مستخدمي الشركة والتواصل المباشر مع الدعم الفني' : 'Company messaging & technical support communication'}
            </p>
          </div>
        </div>

        {/* 2 Main Navigation Tabs */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => {
              setActiveCategory('company');
              setSelectedMessage(null);
            }}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeCategory === 'company'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Building size={14} />
            <span>{isAr ? 'بريد الشركة الداخلي' : 'Company Mail'}</span>
            {unreadCounts.company > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeCategory === 'company' ? 'bg-white text-emerald-700' : 'bg-rose-500 text-white'
              }`}>
                {unreadCounts.company}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveCategory('support');
              setSelectedMessage(null);
            }}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeCategory === 'support'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Headphones size={14} />
            <span>{isAr ? 'التواصل بالدعم الفني' : 'Support Tickets'}</span>
            {unreadCounts.support > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeCategory === 'support' ? 'bg-white text-blue-700' : 'bg-rose-500 text-white'
              }`}>
                {unreadCounts.support}
              </span>
            )}
          </button>
        </div>

        {/* Refresh & Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchMessages(true)}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
            title={isAr ? 'تحديث الرسائل' : 'Refresh'}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin text-emerald-600' : ''} />
          </button>
        </div>
      </div>

      {/* 2. BODY CONTAINER: SIDEBAR + CONTENT */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT / RIGHT SIDEBAR: FOLDERS & COMPOSE */}
        <div className="w-56 shrink-0 bg-white dark:bg-slate-850 border-inline-end border-slate-200 dark:border-slate-800 flex flex-col justify-between p-3">
          <div className="space-y-3">
            {/* Compose Button */}
            <button
              type="button"
              onClick={() => {
                setComposeTo([]);
                setComposeCc([]);
                setShowCcInput(false);
                setComposeSubject('');
                setComposeBody('');
                setComposeAttachments([]);
                setIsComposeOpen(true);
              }}
              className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-white font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer ${
                activeCategory === 'support' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
              }`}
            >
              <Plus size={16} className="stroke-[2.5]" />
              <span>{activeCategory === 'support' ? (isAr ? 'تذكرة دعم جديدة' : 'New Ticket') : (isAr ? 'رسالة جديدة' : 'Compose')}</span>
            </button>

            {/* Folder Navigation */}
            <div className="space-y-1">
              {/* Inbox */}
              <button
                type="button"
                onClick={() => { setActiveFolder('inbox'); setSelectedMessage(null); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeFolder === 'inbox'
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold border border-slate-200 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Inbox size={15} className={activeFolder === 'inbox' ? 'text-emerald-600' : 'text-slate-400'} />
                  <span>{isAr ? 'صندوق الوارد' : 'Inbox'}</span>
                </div>
                {folderCounts.inboxUnread > 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white">
                    {folderCounts.inboxUnread}
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400 font-normal">{folderCounts.inboxTotal}</span>
                )}
              </button>

              {/* Sent */}
              <button
                type="button"
                onClick={() => { setActiveFolder('sent'); setSelectedMessage(null); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeFolder === 'sent'
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold border border-slate-200 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Send size={15} className={activeFolder === 'sent' ? 'text-blue-600' : 'text-slate-400'} />
                  <span>{isAr ? 'الرسائل الصادرة' : 'Sent'}</span>
                </div>
                <span className="text-[11px] text-slate-400 font-normal">{folderCounts.sentTotal}</span>
              </button>

              {/* Starred */}
              <button
                type="button"
                onClick={() => { setActiveFolder('starred'); setSelectedMessage(null); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeFolder === 'starred'
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold border border-slate-200 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Star size={15} className={activeFolder === 'starred' ? 'text-amber-500 fill-amber-500' : 'text-slate-400'} />
                  <span>{isAr ? 'المميزة بنجمة' : 'Starred'}</span>
                </div>
                <span className="text-[11px] text-slate-400 font-normal">{folderCounts.starredTotal}</span>
              </button>

              {/* Archive */}
              <button
                type="button"
                onClick={() => { setActiveFolder('archive'); setSelectedMessage(null); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeFolder === 'archive'
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold border border-slate-200 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Archive size={15} className={activeFolder === 'archive' ? 'text-purple-600' : 'text-slate-400'} />
                  <span>{isAr ? 'الأرشيف' : 'Archive'}</span>
                </div>
                <span className="text-[11px] text-slate-400 font-normal">{folderCounts.archiveTotal}</span>
              </button>

              {/* Trash */}
              <button
                type="button"
                onClick={() => { setActiveFolder('trash'); setSelectedMessage(null); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeFolder === 'trash'
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold border border-slate-200 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Trash2 size={15} className={activeFolder === 'trash' ? 'text-rose-600' : 'text-slate-400'} />
                  <span>{isAr ? 'سلة المهملات' : 'Trash'}</span>
                </div>
                <span className="text-[11px] text-slate-400 font-normal">{folderCounts.trashTotal}</span>
              </button>
            </div>
          </div>

          {/* Quick status footer */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 space-y-1">
            <div className="flex items-center justify-between font-bold">
              <span>{isAr ? 'المستخدم الحالي' : 'User'}</span>
              <span className="text-emerald-600 dark:text-emerald-400">{user?.name || user?.username}</span>
            </div>
            <div className="text-[10px] text-slate-400 truncate">{user?.email || '—'}</div>
          </div>
        </div>

        {/* RIGHT AREA: MESSAGES LIST OR DETAIL VIEW */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50 dark:bg-slate-900/50">
          {selectedMessage ? (
            /* ========================================================================= */
            /* 3. MESSAGE DETAIL VIEW */
            /* ========================================================================= */
            <div className="flex-1 flex flex-col overflow-y-auto p-4 md:p-6 space-y-4">
              {/* Back button & Action Toolbar */}
              <div className="bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setSelectedMessage(null)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 transition-all cursor-pointer"
                >
                  <ArrowRight size={14} className={isAr ? '' : 'rotate-180'} />
                  <span>{isAr ? 'الرجوع للقائمة' : 'Back to list'}</span>
                </button>

                <div className="flex items-center gap-1.5">
                  {/* Star */}
                  <button
                    type="button"
                    onClick={() => handleToggleStar(selectedMessage.id)}
                    className="p-2 text-slate-500 hover:text-amber-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                    title={isAr ? 'تمييز بنجمة' : 'Star'}
                  >
                    <Star
                      size={16}
                      className={
                        Array.isArray(selectedMessage.is_starred) && selectedMessage.is_starred.includes(currentUserId)
                          ? 'text-amber-500 fill-amber-500'
                          : ''
                      }
                    />
                  </button>

                  {/* Archive */}
                  <button
                    type="button"
                    onClick={() => handleToggleArchive(selectedMessage.id)}
                    className="p-2 text-slate-500 hover:text-purple-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                    title={isAr ? 'أرشفة' : 'Archive'}
                  >
                    <Archive size={16} />
                  </button>

                  {/* Forward */}
                  <button
                    type="button"
                    onClick={() => handleForward(selectedMessage)}
                    className="p-2 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                    title={isAr ? 'إعادة توجيه' : 'Forward'}
                  >
                    <Forward size={16} />
                  </button>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => handleDeleteMessage(selectedMessage.id)}
                    className="p-2 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                    title={isAr ? 'حذف' : 'Delete'}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Message Header & Subject */}
              <div className="bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        selectedMessage.category === 'support' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {selectedMessage.category === 'support' ? (isAr ? 'دعم فني' : 'Support') : (isAr ? 'بريد داخلي' : 'Internal Mail')}
                      </span>
                      <h2 className="text-base md:text-lg font-bold text-slate-900 dark:text-white">
                        {selectedMessage.subject}
                      </h2>
                    </div>

                    {/* Exact Day, Date, and Time */}
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <Clock size={13} className="text-emerald-600" />
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {formatMailDateTime(selectedMessage.created_at, isAr).displayString}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sender & Recipient Information */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 text-xs">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-sm shadow-xs shrink-0">
                      {selectedMessage.sender_name?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white text-sm">
                        {selectedMessage.sender_name}
                      </div>
                      <div className="text-slate-400 text-xs">
                        {selectedMessage.sender_email || '—'}
                      </div>
                    </div>
                  </div>

                  {/* To & CC chips */}
                  <div className="space-y-1.5 text-right md:text-left">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-slate-400 font-semibold">{isAr ? 'إلى:' : 'To:'}</span>
                      {Array.isArray(selectedMessage.to_users) && selectedMessage.to_users.map(u => (
                        <span key={u.id} className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-medium border border-slate-200 dark:border-slate-700">
                          {u.name} {u.role ? `(${u.role})` : ''}
                        </span>
                      ))}
                    </div>

                    {Array.isArray(selectedMessage.cc_users) && selectedMessage.cc_users.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-slate-400 font-semibold">{isAr ? 'نسخة إلى:' : 'CC:'}</span>
                        {selectedMessage.cc_users.map(u => (
                          <span key={u.id} className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-[11px] font-medium border border-blue-200 dark:border-blue-800/40">
                            {u.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Message Body */}
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap min-h-[120px]">
                  {selectedMessage.body}
                </div>

                {/* Attachments Section */}
                {Array.isArray(selectedMessage.attachments) && selectedMessage.attachments.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                      <Paperclip size={14} className="text-emerald-600" />
                      <span>{isAr ? `المرفقات (${selectedMessage.attachments.length})` : `Attachments (${selectedMessage.attachments.length})`}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {selectedMessage.attachments.map((att, idx) => (
                        <div
                          key={att.id || idx}
                          className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-emerald-400 transition-all text-xs"
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <FileText size={18} className="text-emerald-600 shrink-0" />
                            <div className="overflow-hidden">
                              <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{att.name}</p>
                              <p className="text-[10px] text-slate-400">
                                {att.size ? `${(att.size / 1024).toFixed(1)} KB` : ''}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => setPreviewAttachment(att)}
                              className="p-1.5 text-slate-500 hover:text-emerald-600 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                              title={isAr ? 'معاينة' : 'Preview'}
                            >
                              <Eye size={14} />
                            </button>
                            {att.url && (
                              <a
                                href={att.url}
                                download={att.name}
                                className="p-1.5 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                                title={isAr ? 'تنزيل' : 'Download'}
                              >
                                <Download size={14} />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Reply Box */}
              <div className="bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <Reply size={14} className="text-emerald-600" />
                  <span>{isAr ? 'الرد السريع' : 'Quick Reply'}</span>
                </div>

                <textarea
                  value={replyBody}
                  onChange={e => setReplyBody(e.target.value)}
                  placeholder={isAr ? 'اكتب ردك هنا...' : 'Type your reply here...'}
                  className="w-full h-24 p-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-emerald-500 resize-none"
                />

                {showReplyAttachments && (
                  <div className="pt-2">
                    <AttachmentsManager
                      attachments={replyAttachments}
                      onChange={setReplyAttachments}
                      compact={true}
                    />
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => setShowReplyAttachments(!showReplyAttachments)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
                  >
                    <Paperclip size={14} />
                    <span>{isAr ? 'إرفاق ملف' : 'Attach file'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSendReply}
                    disabled={sendingReply || !replyBody.trim()}
                    className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
                  >
                    <Send size={14} />
                    <span>{sendingReply ? (isAr ? 'جاري الإرسال...' : 'Sending...') : (isAr ? 'إرسال الرد' : 'Send Reply')}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* 4. MESSAGES LIST VIEW */
            /* ========================================================================= */
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Search Bar & Header */}
              <div className="bg-white dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[220px] max-w-md">
                  <Search size={15} className={`absolute top-1/2 -translate-y-1/2 text-slate-400 ${isAr ? 'right-3' : 'left-3'}`} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder={isAr ? 'البحث في الرسائل (المرسل، الموضوع، النص)...' : 'Search messages...'}
                    className={`w-full py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-emerald-500 ${
                      isAr ? 'pr-9 pl-3' : 'pl-9 pr-3'
                    }`}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className={`absolute top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 ${isAr ? 'left-2.5' : 'right-2.5'}`}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="text-xs text-slate-500 font-semibold">
                  {filteredMessages.length} {isAr ? 'رسالة' : 'messages'}
                </div>
              </div>

              {/* Message Items List */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
                {loading ? (
                  <div className="flex flex-col items-center justify-center h-64 gap-2 text-slate-400">
                    <RefreshCw size={24} className="animate-spin text-emerald-600" />
                    <p className="text-xs">{isAr ? 'جاري تحميل الرسائل...' : 'Loading messages...'}</p>
                  </div>
                ) : filteredMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400 p-6 text-center">
                    <Mail className="w-12 h-12 opacity-30 text-slate-400" />
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-400">
                      {isAr ? 'لا توجد رسائل في هذا المجلد' : 'No messages found in this folder'}
                    </p>
                    <p className="text-xs text-slate-400 max-w-sm">
                      {isAr ? 'يمكنك إنشاء رسالة جديدة للتواصل مع أعضاء الفريق أو الدعم الفني' : 'Compose a new message to communicate with team members or support'}
                    </p>
                  </div>
                ) : (
                  filteredMessages.map(msg => {
                    const isRead = Array.isArray(msg.read_by) && msg.read_by.includes(currentUserId);
                    const isStarred = Array.isArray(msg.is_starred) && msg.is_starred.includes(currentUserId);
                    const hasAttachments = Array.isArray(msg.attachments) && msg.attachments.length > 0;
                    const dateFormatted = formatMailDateTime(msg.created_at, isAr);

                    return (
                      <div
                        key={msg.id}
                        onClick={() => handleSelectMessage(msg)}
                        className={`group px-4 py-3 flex items-center gap-3 transition-colors cursor-pointer ${
                          !isRead
                            ? 'bg-emerald-50/40 dark:bg-emerald-950/20 hover:bg-emerald-50/70 font-semibold text-slate-900 dark:text-white'
                            : 'bg-white dark:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {/* Star Button */}
                        <button
                          type="button"
                          onClick={e => handleToggleStar(msg.id, e)}
                          className="p-1 text-slate-300 hover:text-amber-500 transition-colors"
                          title={isAr ? 'تمييز بنجمة' : 'Star'}
                        >
                          <Star size={15} className={isStarred ? 'text-amber-500 fill-amber-500' : ''} />
                        </button>

                        {/* Unread indicator dot */}
                        <div className="w-2 flex justify-center">
                          {!isRead && (
                            <span className="w-2 h-2 rounded-full bg-emerald-600 ring-2 ring-emerald-200 dark:ring-emerald-900 shrink-0" />
                          )}
                        </div>

                        {/* Sender Name / Recipients if Sent */}
                        <div className="w-36 md:w-44 shrink-0 overflow-hidden">
                          <p className="text-xs font-bold truncate">
                            {activeFolder === 'sent'
                              ? `${isAr ? 'إلى: ' : 'To: '}${msg.to_users?.map(u => u.name).join(', ') || '—'}`
                              : msg.sender_name}
                          </p>
                        </div>

                        {/* Subject & Body snippet */}
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          <span className={`text-xs truncate ${!isRead ? 'font-bold text-slate-900 dark:text-white' : 'font-medium'}`}>
                            {msg.subject}
                          </span>
                          <span className="text-xs text-slate-400 font-normal truncate hidden sm:inline">
                            — {msg.body?.replace(/\n/g, ' ')}
                          </span>
                        </div>

                        {/* Attachment indicator */}
                        {hasAttachments && (
                          <div className="shrink-0 text-slate-400" title={isAr ? 'تحتوي على مرفقات' : 'Has attachments'}>
                            <Paperclip size={14} className="text-emerald-600" />
                          </div>
                        )}

                        {/* Exact Day, Date, and Time display */}
                        <div className="shrink-0 text-left md:text-right font-medium text-[11px] text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300">
                          <span className="hidden md:inline">{dateFormatted.displayString}</span>
                          <span className="inline md:hidden">{dateFormatted.shortDisplay}</span>
                        </div>

                        {/* Quick hover actions */}
                        <div className="shrink-0 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                          <button
                            type="button"
                            onClick={e => handleToggleArchive(msg.id, e)}
                            className="p-1 hover:text-purple-600 text-slate-400 rounded transition-colors"
                            title={isAr ? 'أرشفة' : 'Archive'}
                          >
                            <Archive size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={e => handleDeleteMessage(msg.id, e)}
                            className="p-1 hover:text-rose-600 text-slate-400 rounded transition-colors"
                            title={isAr ? 'حذف' : 'Delete'}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. COMPOSE MESSAGE MODAL (Integrated overlay) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isComposeOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" dir={dir}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
            >
              {/* Compose Header */}
              <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail size={16} className="text-emerald-400" />
                  <span className="font-bold text-sm">
                    {activeCategory === 'support' ? (isAr ? 'إنشاء تذكرة دعم فني' : 'New Support Ticket') : (isAr ? 'رسالة جديدة' : 'New Message')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsComposeOpen(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Compose Body */}
              <div className="p-5 flex-1 overflow-y-auto space-y-4">
                {/* 1. Recipient "To" with Multi-select */}
                <div className="space-y-1 relative" ref={toDropdownRef}>
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-1.5">
                      <span>{isAr ? 'إلى (To):' : 'To:'}</span>
                      <span className="text-[10px] text-emerald-600 font-normal">
                        ({isAr ? 'يمكنك تحديد أكثر من شخص' : 'Multiple recipients allowed'})
                      </span>
                    </div>
                    {!showCcInput && (
                      <button
                        type="button"
                        onClick={() => setShowCcInput(true)}
                        className="text-[11px] text-blue-600 hover:underline font-bold"
                      >
                        + {isAr ? 'إضافة نسخة (CC)' : 'Add CC'}
                      </button>
                    )}
                  </div>

                  {/* To Chips & Search Input */}
                  <div className="min-h-[42px] p-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex flex-wrap items-center gap-1.5 focus-within:border-emerald-500">
                    {composeTo.map(u => (
                      <span
                        key={u.id}
                        className="flex items-center gap-1 px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 rounded-lg text-xs font-medium border border-emerald-200 dark:border-emerald-800"
                      >
                        <span>{u.name}</span>
                        <button
                          type="button"
                          onClick={() => setComposeTo(prev => prev.filter(item => item.id !== u.id))}
                          className="hover:text-emerald-950"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}

                    <input
                      type="text"
                      value={toSearchQuery}
                      onChange={e => {
                        setToSearchQuery(e.target.value);
                        setIsToDropdownOpen(true);
                      }}
                      onFocus={() => setIsToDropdownOpen(true)}
                      placeholder={composeTo.length === 0 ? (isAr ? 'اختر أو ابحث عن مستخدمين...' : 'Select recipients...') : ''}
                      className="flex-1 min-w-[120px] bg-transparent text-xs p-1 focus:outline-none"
                    />
                  </div>

                  {/* Dropdown list for To */}
                  {isToDropdownOpen && (
                    <div className="absolute z-20 top-full mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                      {contacts
                        .filter(c => !composeTo.some(t => t.id === c.id))
                        .filter(c => !toSearchQuery || c.name.toLowerCase().includes(toSearchQuery.toLowerCase()) || (c.email && c.email.toLowerCase().includes(toSearchQuery.toLowerCase())))
                        .map(c => (
                          <div
                            key={c.id}
                            onClick={() => {
                              setComposeTo(prev => [...prev, c]);
                              setToSearchQuery('');
                              setIsToDropdownOpen(false);
                            }}
                            className="px-3 py-2 text-xs flex items-center justify-between hover:bg-emerald-50 dark:hover:bg-slate-700/60 cursor-pointer"
                          >
                            <div>
                              <p className="font-bold text-slate-800 dark:text-white">{c.name}</p>
                              <p className="text-[10px] text-slate-400">{c.email || c.role || ''}</p>
                            </div>
                            <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded">
                              {c.role || (isAr ? 'مستخدم' : 'User')}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* 2. Recipient "CC" with Multi-select */}
                {showCcInput && (
                  <div className="space-y-1 relative" ref={ccDropdownRef}>
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <span>{isAr ? 'نسخة إلى (CC):' : 'CC:'}</span>
                        <span className="text-[10px] text-blue-600 font-normal">
                          ({isAr ? 'يمكنك تحديد أكثر من شخص' : 'Multiple CC allowed'})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCcInput(false);
                          setComposeCc([]);
                        }}
                        className="text-[11px] text-rose-500 hover:underline"
                      >
                        {isAr ? 'إلغاء النسخة' : 'Remove CC'}
                      </button>
                    </div>

                    <div className="min-h-[42px] p-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex flex-wrap items-center gap-1.5 focus-within:border-blue-500">
                      {composeCc.map(u => (
                        <span
                          key={u.id}
                          className="flex items-center gap-1 px-2.5 py-1 bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-200 rounded-lg text-xs font-medium border border-blue-200 dark:border-blue-800"
                        >
                          <span>{u.name}</span>
                          <button
                            type="button"
                            onClick={() => setComposeCc(prev => prev.filter(item => item.id !== u.id))}
                            className="hover:text-blue-950"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}

                      <input
                        type="text"
                        value={ccSearchQuery}
                        onChange={e => {
                          setCcSearchQuery(e.target.value);
                          setIsCcDropdownOpen(true);
                        }}
                        onFocus={() => setIsCcDropdownOpen(true)}
                        placeholder={composeCc.length === 0 ? (isAr ? 'اختر مستخدمين للنسخة...' : 'Select CC recipients...') : ''}
                        className="flex-1 min-w-[120px] bg-transparent text-xs p-1 focus:outline-none"
                      />
                    </div>

                    {/* Dropdown list for CC */}
                    {isCcDropdownOpen && (
                      <div className="absolute z-20 top-full mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                        {contacts
                          .filter(c => !composeCc.some(t => t.id === c.id))
                          .filter(c => !ccSearchQuery || c.name.toLowerCase().includes(ccSearchQuery.toLowerCase()))
                          .map(c => (
                            <div
                              key={c.id}
                              onClick={() => {
                                setComposeCc(prev => [...prev, c]);
                                setCcSearchQuery('');
                                setIsCcDropdownOpen(false);
                              }}
                              className="px-3 py-2 text-xs flex items-center justify-between hover:bg-blue-50 dark:hover:bg-slate-700/60 cursor-pointer"
                            >
                              <div>
                                <p className="font-bold text-slate-800 dark:text-white">{c.name}</p>
                                <p className="text-[10px] text-slate-400">{c.email || ''}</p>
                              </div>
                              <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded">
                                {c.role || ''}
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Subject Input */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {isAr ? 'عنوان الرسالة / الموضوع:' : 'Subject:'}
                  </label>
                  <input
                    type="text"
                    value={composeSubject}
                    onChange={e => setComposeSubject(e.target.value)}
                    placeholder={isAr ? 'اكتب عنوان الرسالة...' : 'Enter message subject...'}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-emerald-500 font-semibold"
                  />
                </div>

                {/* 4. Message Body */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {isAr ? 'نص الرسالة:' : 'Message Body:'}
                  </label>
                  <textarea
                    value={composeBody}
                    onChange={e => setComposeBody(e.target.value)}
                    rows={7}
                    placeholder={isAr ? 'اكتب تفاصيل الرسالة هنا...' : 'Write message content here...'}
                    className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-emerald-500 resize-none leading-relaxed"
                  />
                </div>

                {/* 5. Attachments Manager */}
                <div className="space-y-1">
                  <AttachmentsManager
                    attachments={composeAttachments}
                    onChange={setComposeAttachments}
                    title={isAr ? 'المرفقات (صور، مستندات، ملفات PDF، Excel)' : 'Attachments'}
                    compact={true}
                  />
                </div>
              </div>

              {/* Compose Footer */}
              <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsComposeOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>

                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={sending}
                  className={`flex items-center gap-2 px-6 py-2 rounded-xl text-white text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50 ${
                    activeCategory === 'support' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
                  }`}
                >
                  <Send size={15} />
                  <span>{sending ? (isAr ? 'جاري الإرسال...' : 'Sending...') : (isAr ? 'إرسال الرسالة' : 'Send Message')}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Attachment Preview Modal */}
      {previewAttachment && (
        <AttachmentPreviewModal
          attachment={previewAttachment}
          onClose={() => setPreviewAttachment(null)}
        />
      )}
    </div>
  );
};
