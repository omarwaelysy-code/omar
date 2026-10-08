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
  Filter,
  ShieldCheck,
  Lock,
  UserPlus,
  PenSquare
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotification } from '../contexts/NotificationContext';
import { dbService } from '../services/dbService';
import { InternalMessage, MailUser, AttachmentItem } from '../types';
import { AttachmentsManager } from '../components/common/AttachmentsManager';

type MailCategory = 'company' | 'support';
type FolderType = 'inbox' | 'sent' | 'starred' | 'archive' | 'trash';

// Arabic day names map
const ARABIC_DAYS: Record<number, string> = {
  0: 'الأحد',
  1: 'الإثنين',
  2: 'الثلاثاء',
  3: 'الأربعاء',
  4: 'الخميس',
  5: 'الجمعة',
  6: 'السبت'
};

const ENGLISH_DAYS: Record<number, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday'
};

// Format exact Day, Date, and Time (Hour:Minute AM/PM)
function formatMailDateTime(dateStr?: string, isAr = true) {
  if (!dateStr) return { dayName: '', fullDate: '', timeStr: '', displayString: '', shortDisplay: '' };
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return { dayName: '', fullDate: dateStr, timeStr: '', displayString: dateStr, shortDisplay: dateStr };

    const dayName = isAr ? ARABIC_DAYS[d.getDay()] || '' : ENGLISH_DAYS[d.getDay()] || '';
    
    // Date formatting
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const fullDate = `${day}/${month}/${year}`;

    // Time formatting 12-hour
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = isAr ? (hours >= 12 ? 'م' : 'ص') : (hours >= 12 ? 'PM' : 'AM');
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 should be 12
    const timeStr = `${hours}:${minutes} ${ampm}`;

    const displayString = isAr
      ? `${dayName}، ${fullDate} - ${timeStr}`
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
  const [companyUsers, setCompanyUsers] = useState<MailUser[]>([]);
  const [supportContacts, setSupportContacts] = useState<MailUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<InternalMessage | null>(null);

  // Unread counters
  const [unreadCounts, setUnreadCounts] = useState({ total: 0, company: 0, support: 0 });

  // Compose State (INTEGRATED IN-PAGE VIEW)
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

  // Fixed Support Recipient (routes to Super Admin / Support)
  const fixedSupportRecipient: MailUser = useMemo(() => {
    if (supportContacts.length > 0) {
      const sAdmin = supportContacts.find(u => u.role === 'super_admin' || u.username === 'admin') || supportContacts[0];
      return {
        id: sAdmin.id,
        name: sAdmin.name || (isAr ? 'فريق الدعم الفني المركزي (Super Admin)' : 'Central Support Team (Super Admin)'),
        email: sAdmin.email || 'support@obrain.system',
        role: 'super_admin'
      };
    }
    return {
      id: 'super-admin-support',
      name: isAr ? 'فريق الدعم الفني المركزي (Super Admin)' : 'Central Support Team (Super Admin)',
      email: 'support@obrain.system',
      role: 'super_admin'
    };
  }, [supportContacts, isAr]);

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

  // Fetch company users and support contacts
  const fetchContacts = async () => {
    try {
      const [comp, supp] = await Promise.all([
        dbService.getInternalMailContacts('company').catch(() => []),
        dbService.getInternalMailContacts('support').catch(() => [])
      ]);
      setCompanyUsers(comp || []);
      setSupportContacts(supp || []);
    } catch (e) {
      console.error('Failed to fetch contacts:', e);
    }
  };

  // Fetch messages from database
  const fetchMessages = async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const allMsgs = await dbService.listAll<InternalMessage>('internal_messages');
      setMessages(allMsgs || []);
      await fetchUnreadCounts();
    } catch (e: any) {
      console.error('Failed to fetch internal messages:', e);
      showNotification(isAr ? 'فشل تحميل الرسائل' : 'Failed to load messages', 'error');
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchMessages(true);
    fetchContacts();
  }, []);

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
    setIsComposeOpen(false);
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
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, is_starred: res.is_starred } : m));
      if (selectedMessage?.id === msgId) {
        setSelectedMessage(prev => prev ? { ...prev, is_starred: res.is_starred } : null);
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
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, archived_by: res.archived_by } : m));
      if (selectedMessage?.id === msgId) {
        setSelectedMessage(null);
      }
      showNotification(isAr ? 'تم تحديث الأرشيف' : 'Archive updated', 'success');
    } catch (e) {
      console.error('Failed to toggle archive:', e);
    }
  };

  // Move to Trash (Soft delete) or Permanent Delete
  const handleDeleteMessage = async (msgId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;

    const isAlreadyTrash = Array.isArray(msg.deleted_by) && msg.deleted_by.includes(currentUserId);

    try {
      if (isAlreadyTrash) {
        if (!window.confirm(isAr ? 'هل أنت متأكد من الحذف النهائي للرسالة؟' : 'Permanently delete this message?')) return;
        await dbService.delete('internal_messages', msgId);
        setMessages(prev => prev.filter(m => m.id !== msgId));
        if (selectedMessage?.id === msgId) setSelectedMessage(null);
        showNotification(isAr ? 'تم الحذف النهائي للرسالة' : 'Message permanently deleted', 'success');
      } else {
        const updatedDeleted = [...(msg.deleted_by || []), currentUserId];
        await dbService.update('internal_messages', msgId, { deleted_by: updatedDeleted });
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, deleted_by: updatedDeleted } : m));
        if (selectedMessage?.id === msgId) setSelectedMessage(null);
        showNotification(isAr ? 'تم نقل الرسالة إلى سلة المهملات' : 'Moved to trash', 'success');
      }
      fetchUnreadCounts();
    } catch (e) {
      console.error('Failed to delete message:', e);
      showNotification(isAr ? 'فشل حذف الرسالة' : 'Failed to delete message', 'error');
    }
  };

  // Open Compose View (Integrated in-page)
  const handleOpenCompose = () => {
    setSelectedMessage(null);
    setIsComposeOpen(true);
    if (activeCategory === 'support') {
      setComposeTo([fixedSupportRecipient]);
      setShowCcInput(false);
    } else {
      setComposeTo([]);
      setShowCcInput(false);
    }
    setComposeCc([]);
    setComposeSubject('');
    setComposeBody('');
    setComposeAttachments([]);
  };

  // Close Compose View
  const handleCloseCompose = () => {
    setIsComposeOpen(false);
    setComposeTo([]);
    setComposeCc([]);
    setShowCcInput(false);
    setComposeSubject('');
    setComposeBody('');
    setComposeAttachments([]);
  };

  // Helper to commit typed text into recipient chips (To or CC)
  const commitRecipient = (type: 'to' | 'cc', rawText?: string): MailUser | null => {
    const text = (rawText !== undefined ? rawText : (type === 'to' ? toSearchQuery : ccSearchQuery)).trim();
    if (!text) return null;

    // Check if it matches an existing contact by email, username, or name
    const matched = companyUsers.find(
      c => (c.email && c.email.toLowerCase() === text.toLowerCase()) ||
           (c.username && c.username.toLowerCase() === text.toLowerCase()) ||
           (c.name && c.name.toLowerCase() === text.toLowerCase())
    );

    const recipient: MailUser = matched || {
      id: `custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: text.includes('@') ? text.split('@')[0] : text,
      email: text.includes('@') ? text : '',
      role: 'user'
    };

    if (type === 'to') {
      setComposeTo(prev => {
        const already = prev.some(u => 
          (recipient.email && u.email && u.email.toLowerCase() === recipient.email.toLowerCase()) ||
          u.id === recipient.id ||
          u.name.toLowerCase() === recipient.name.toLowerCase()
        );
        return already ? prev : [...prev, recipient];
      });
      setToSearchQuery('');
      setIsToDropdownOpen(false);
    } else {
      setComposeCc(prev => {
        const already = prev.some(u => 
          (recipient.email && u.email && u.email.toLowerCase() === recipient.email.toLowerCase()) ||
          u.id === recipient.id ||
          u.name.toLowerCase() === recipient.name.toLowerCase()
        );
        return already ? prev : [...prev, recipient];
      });
      setCcSearchQuery('');
      setIsCcDropdownOpen(false);
    }

    return recipient;
  };

  // Send New Message
  const handleSendMessage = async () => {
    // Automatically commit any pending input text in "To" or "CC"
    let effectiveTo = [...composeTo];
    if (toSearchQuery.trim()) {
      const added = commitRecipient('to', toSearchQuery.trim());
      if (added && !effectiveTo.some(u => (added.email && u.email === added.email) || u.id === added.id)) {
        effectiveTo.push(added);
      }
    }

    let effectiveCc = [...composeCc];
    if (ccSearchQuery.trim()) {
      const added = commitRecipient('cc', ccSearchQuery.trim());
      if (added && !effectiveCc.some(u => (added.email && u.email === added.email) || u.id === added.id)) {
        effectiveCc.push(added);
      }
    }

    // In support mode, To is always locked to the fixed support recipient
    const recipientsTo = activeCategory === 'support' ? [fixedSupportRecipient] : effectiveTo;

    if (recipientsTo.length === 0) {
      showNotification(isAr ? 'يرجى تحديد مستلم واحد على الأقل (To)' : 'Please select at least one recipient (To)', 'error');
      return;
    }
    if (!composeSubject.trim()) {
      showNotification(isAr ? 'يرجى كتابة عنوان أو موضوع الرسالة' : 'Please enter a message subject', 'error');
      return;
    }
    if (!composeBody.trim()) {
      showNotification(isAr ? 'يرجى كتابة تفاصيل ونص الرسالة' : 'Please enter the message body', 'error');
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
        to_users: recipientsTo,
        cc_users: effectiveCc,
        subject: composeSubject.trim(),
        body: composeBody.trim(),
        attachments: composeAttachments,
        is_starred: [],
        read_by: [user?.id || ''],
        archived_by: [],
        deleted_by: []
      };

      const newId = await dbService.create<InternalMessage>('internal_messages', payload);
      const created: InternalMessage = {
        id: (typeof newId === 'string' && newId) ? newId : (payload.id || Date.now().toString()),
        company_id: user?.company_id,
        category: activeCategory,
        sender_id: user?.id || 'unknown',
        sender_name: user?.name || user?.username || 'المستخدم',
        sender_email: user?.email || '',
        to_users: recipientsTo,
        cc_users: composeCc,
        subject: composeSubject.trim(),
        body: composeBody.trim(),
        attachments: composeAttachments,
        is_starred: [],
        read_by: [user?.id || ''],
        archived_by: [],
        deleted_by: [],
        created_at: new Date().toISOString()
      };
      setMessages(prev => [created, ...prev]);
      
      showNotification(
        isAr
          ? (activeCategory === 'support' ? 'تم إرسال تذكرة الدعم الفني بنجاح' : 'تم إرسال الرسالة بنجاح')
          : 'Message sent successfully',
        'success'
      );
      
      handleCloseCompose();
      fetchUnreadCounts();
    } catch (e: any) {
      console.error('Failed to send message:', e);
      showNotification(isAr ? 'فشل في إرسال الرسالة' : 'Failed to send message', 'error');
    } finally {
      setSending(false);
    }
  };

  // Send Quick Reply to currently viewed message
  const handleSendReply = async () => {
    if (!selectedMessage || !replyBody.trim()) return;

    setSendingReply(true);
    try {
      // Determine reply recipient
      const replyTo: MailUser[] = selectedMessage.sender_id === user?.id
        ? selectedMessage.to_users
        : [{
            id: selectedMessage.sender_id,
            name: selectedMessage.sender_name,
            email: selectedMessage.sender_email,
            role: 'sender'
          }];

      const subject = selectedMessage.subject.startsWith('Re:')
        ? selectedMessage.subject
        : `Re: ${selectedMessage.subject}`;

      const payload: Partial<InternalMessage> = {
        company_id: user?.company_id,
        category: selectedMessage.category,
        sender_id: user?.id || 'unknown',
        sender_name: user?.name || user?.username || 'المستخدم',
        sender_email: user?.email || '',
        to_users: replyTo,
        cc_users: selectedMessage.cc_users || [],
        subject: subject,
        body: replyBody.trim(),
        attachments: replyAttachments,
        parent_id: selectedMessage.id,
        is_starred: [],
        read_by: [user?.id || ''],
        archived_by: [],
        deleted_by: []
      };

      const newId = await dbService.create<InternalMessage>('internal_messages', payload);
      const created: InternalMessage = {
        id: (typeof newId === 'string' && newId) ? newId : (payload.id || Date.now().toString()),
        company_id: user?.company_id,
        category: selectedMessage.category,
        sender_id: user?.id || 'unknown',
        sender_name: user?.name || user?.username || 'المستخدم',
        sender_email: user?.email || '',
        to_users: replyTo,
        cc_users: selectedMessage.cc_users || [],
        subject: subject,
        body: replyBody.trim(),
        attachments: replyAttachments,
        parent_id: selectedMessage.id,
        is_starred: [],
        read_by: [user?.id || ''],
        archived_by: [],
        deleted_by: [],
        created_at: new Date().toISOString()
      };

      setMessages(prev => [created, ...prev]);
      setReplyBody('');
      setReplyAttachments([]);
      setShowReplyAttachments(false);
      showNotification(isAr ? 'تم إرسال الرد بنجاح' : 'Reply sent successfully', 'success');
      fetchUnreadCounts();
    } catch (e: any) {
      console.error('Failed to send reply:', e);
      showNotification(isAr ? 'فشل في إرسال الرد' : 'Failed to send reply', 'error');
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-100 dark:bg-slate-900 overflow-hidden font-sans" dir={dir}>
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & TABS BAR (مدمجة كباقي شاشات النظام) */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 px-4 md:px-6 py-3 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-2xs">
        {/* Title and Category Tabs */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0">
            <Mail size={20} />
          </div>
          <div>
            <h1 className="text-base md:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span>{isAr ? 'صندوق البريد والمراسلات' : 'Internal Mail & Communications'}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                {isAr ? 'مباشر' : 'Live'}
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isAr ? 'نظام المراسلات الداخلي والتواصل المباشر مع الدعم الفني' : 'Company internal mail & technical support system'}
            </p>
          </div>
        </div>

        {/* 2 Main Navigation Tabs */}
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
          {/* Tab 1: بريد الشركة الداخلي */}
          <button
            type="button"
            onClick={() => {
              setActiveCategory('company');
              setSelectedMessage(null);
              setIsComposeOpen(false);
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeCategory === 'company'
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Building size={15} />
            <span>{isAr ? 'بريد الشركة الداخلي' : 'Company Mail'}</span>
            {unreadCounts.company > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-emerald-600 text-white animate-pulse">
                {unreadCounts.company}
              </span>
            )}
          </button>

          {/* Tab 2: التواصل بالدعم */}
          <button
            type="button"
            onClick={() => {
              setActiveCategory('support');
              setSelectedMessage(null);
              setIsComposeOpen(false);
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeCategory === 'support'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Headphones size={15} />
            <span>{isAr ? 'التواصل بالدعم الفني' : 'Technical Support'}</span>
            {unreadCounts.support > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-blue-600 text-white animate-pulse">
                {unreadCounts.support}
              </span>
            )}
          </button>
        </div>

        {/* Global Search & Refresh */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute top-1/2 -translate-y-1/2 right-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={isAr ? 'بحث في الرسائل، المرسل، العنوان...' : 'Search messages...'}
              className="w-48 sm:w-64 pr-9 pl-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-emerald-500 text-slate-800 dark:text-white transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute top-1/2 -translate-y-1/2 left-2 text-slate-400 hover:text-slate-600"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => fetchMessages(true)}
            disabled={loading}
            className="p-2 text-slate-600 dark:text-slate-300 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 transition-all cursor-pointer disabled:opacity-50"
            title={isAr ? 'تحديث الرسائل' : 'Refresh messages'}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin text-emerald-600' : ''} />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. STATS & CATEGORY CONTEXT BAR */}
      {/* ========================================================================= */}
      <div className="bg-slate-50/80 dark:bg-slate-850/50 border-b border-slate-200/80 dark:border-slate-800/80 px-4 md:px-6 py-2 flex flex-wrap items-center justify-between text-xs text-slate-600 dark:text-slate-400 gap-2 shrink-0">
        <div className="flex items-center gap-2 font-medium">
          <span className="text-slate-400">{isAr ? 'المسار الحالي:' : 'Current context:'}</span>
          <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            {activeCategory === 'support' ? (
              <>
                <ShieldCheck size={14} className="text-blue-600 dark:text-blue-400" />
                <span>{isAr ? 'تذاكر الدعم الفني المركزي' : 'Central Support Tickets'}</span>
              </>
            ) : (
              <>
                <Building size={14} className="text-emerald-600 dark:text-emerald-400" />
                <span>{isAr ? 'بريد الشركة الداخلي' : 'Internal Company Mail'}</span>
              </>
            )}
          </span>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
            {activeFolder === 'inbox' && (isAr ? 'البريد الوارد' : 'Inbox')}
            {activeFolder === 'sent' && (isAr ? 'الرسائل الصادرة' : 'Sent')}
            {activeFolder === 'starred' && (isAr ? 'المميزة بنجمة' : 'Starred')}
            {activeFolder === 'archive' && (isAr ? 'الأرشيف' : 'Archive')}
            {activeFolder === 'trash' && (isAr ? 'سلة المهملات' : 'Trash')}
          </span>
        </div>

        {/* Counter Pills */}
        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>{isAr ? 'الوارد:' : 'Inbox:'} <b>{folderCounts.inboxTotal}</b></span>
            {folderCounts.inboxUnread > 0 && (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">({folderCounts.inboxUnread} {isAr ? 'جديدة' : 'new'})</span>
            )}
          </span>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span>{isAr ? 'الصادر:' : 'Sent:'} <b>{folderCounts.sentTotal}</b></span>
          </span>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>{isAr ? 'المميزة:' : 'Starred:'} <b>{folderCounts.starredTotal}</b></span>
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. MAIN WORKSPACE: SIDEBAR + INTEGRATED CONTENT AREA */}
      {/* ========================================================================= */}
      <div className="flex-1 flex overflow-hidden p-3 md:p-4 gap-3 md:gap-4">
        {/* LEFT SIDEBAR: FOLDERS */}
        <div className="w-56 md:w-64 shrink-0 bg-white dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between p-3 shadow-xs">
          <div className="space-y-3">
            {/* COMPOSE BUTTON (OPENS INTEGRATED VIEW) */}
            <button
              type="button"
              onClick={handleOpenCompose}
              className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-white text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer ${
                activeCategory === 'support'
                  ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
              }`}
            >
              <PenSquare size={16} />
              <span>
                {activeCategory === 'support'
                  ? (isAr ? 'إنشاء تذكرة دعم فني' : 'New Support Ticket')
                  : (isAr ? 'رسالة جديدة' : 'New Message')}
              </span>
            </button>

            {/* Folder Navigation */}
            <div className="space-y-1">
              {/* Inbox */}
              <button
                type="button"
                onClick={() => {
                  setIsComposeOpen(false);
                  setActiveFolder('inbox');
                  setSelectedMessage(null);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeFolder === 'inbox' && !isComposeOpen
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800/60'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Inbox size={15} className={activeFolder === 'inbox' && !isComposeOpen ? 'text-emerald-600' : 'text-slate-400'} />
                  <span>{isAr ? 'البريد الوارد' : 'Inbox'}</span>
                </div>
                {folderCounts.inboxUnread > 0 ? (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-emerald-600 text-white">
                    {folderCounts.inboxUnread}
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400 font-normal">{folderCounts.inboxTotal}</span>
                )}
              </button>

              {/* Sent */}
              <button
                type="button"
                onClick={() => {
                  setIsComposeOpen(false);
                  setActiveFolder('sent');
                  setSelectedMessage(null);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeFolder === 'sent' && !isComposeOpen
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold border border-slate-200 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Send size={15} className={activeFolder === 'sent' && !isComposeOpen ? 'text-blue-600' : 'text-slate-400'} />
                  <span>{isAr ? 'الرسائل الصادرة' : 'Sent'}</span>
                </div>
                <span className="text-[11px] text-slate-400 font-normal">{folderCounts.sentTotal}</span>
              </button>

              {/* Starred */}
              <button
                type="button"
                onClick={() => {
                  setIsComposeOpen(false);
                  setActiveFolder('starred');
                  setSelectedMessage(null);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeFolder === 'starred' && !isComposeOpen
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold border border-slate-200 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Star size={15} className={activeFolder === 'starred' && !isComposeOpen ? 'text-amber-500 fill-amber-500' : 'text-slate-400'} />
                  <span>{isAr ? 'المميزة بنجمة' : 'Starred'}</span>
                </div>
                <span className="text-[11px] text-slate-400 font-normal">{folderCounts.starredTotal}</span>
              </button>

              {/* Archive */}
              <button
                type="button"
                onClick={() => {
                  setIsComposeOpen(false);
                  setActiveFolder('archive');
                  setSelectedMessage(null);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeFolder === 'archive' && !isComposeOpen
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold border border-slate-200 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Archive size={15} className={activeFolder === 'archive' && !isComposeOpen ? 'text-purple-600' : 'text-slate-400'} />
                  <span>{isAr ? 'الأرشيف' : 'Archive'}</span>
                </div>
                <span className="text-[11px] text-slate-400 font-normal">{folderCounts.archiveTotal}</span>
              </button>

              {/* Trash */}
              <button
                type="button"
                onClick={() => {
                  setIsComposeOpen(false);
                  setActiveFolder('trash');
                  setSelectedMessage(null);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeFolder === 'trash' && !isComposeOpen
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold border border-slate-200 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Trash2 size={15} className={activeFolder === 'trash' && !isComposeOpen ? 'text-rose-600' : 'text-slate-400'} />
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

        {/* ========================================================================= */}
        {/* RIGHT AREA: INTEGRATED VIEW (NO FLOATING MODAL - 100% IN-PAGE) */}
        {/* ========================================================================= */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          {/* ======================================================================= */}
          {/* VIEW 1: INTEGRATED COMPOSE FORM (شاشة مدمجة مش فوق الشاشات) */}
          {/* ======================================================================= */}
          {isComposeOpen ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Integrated Toolbar Header */}
              <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleCloseCompose}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-650 transition-all cursor-pointer shadow-2xs"
                  >
                    <ArrowRight size={14} className={isAr ? '' : 'rotate-180'} />
                    <span>{isAr ? 'الرجوع للقائمة' : 'Back to list'}</span>
                  </button>

                  <div className="h-5 w-[1px] bg-slate-300 dark:bg-slate-700 hidden sm:block" />

                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg text-white ${activeCategory === 'support' ? 'bg-blue-600' : 'bg-emerald-600'}`}>
                      <Mail size={16} />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                        {activeCategory === 'support'
                          ? (isAr ? 'إنشاء تذكرة دعم فني جديدة' : 'New Support Ticket')
                          : (isAr ? 'إنشاء رسالة جديدة' : 'New Message')}
                      </h2>
                      <p className="text-[11px] text-slate-400 hidden sm:block">
                        {activeCategory === 'support'
                          ? (isAr ? 'موجّهة مباشرة إلى إدارة النظام والدعم الفني المركزي' : 'Direct to System Management & Technical Support')
                          : (isAr ? 'بريد داخلي خاص بمستخدمي الشركة' : 'Internal mail for company users')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Top Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCloseCompose}
                    className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer"
                  >
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    onClick={handleSendMessage}
                    disabled={sending}
                    className={`flex items-center gap-2 px-5 py-1.5 rounded-xl text-white text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50 ${
                      activeCategory === 'support'
                        ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
                        : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
                    }`}
                  >
                    <Send size={14} />
                    <span>
                      {sending
                        ? (isAr ? 'جاري الإرسال...' : 'Sending...')
                        : activeCategory === 'support'
                          ? (isAr ? 'إرسال تذكرة الدعم' : 'Send Support Ticket')
                          : (isAr ? 'إرسال الرسالة' : 'Send Message')}
                    </span>
                  </button>
                </div>
              </div>

              {/* Form Body (Scrollable) */}
              <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-5">
                {/* 1. Recipient "To" */}
                {activeCategory === 'support' ? (
                  /* SUPPORT MODE: TO IS FIXED TO SUPER ADMIN / SUPPORT */
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold">{isAr ? 'إلى (To):' : 'To:'}</span>
                        <span className="text-[11px] text-blue-600 dark:text-blue-400 font-normal">
                          ({isAr ? 'ثابت للدعم الفني المركزي - يصل للسوبر أدمن' : 'Fixed to Central Technical Support - goes to Super Admin'})
                        </span>
                      </div>
                      {!showCcInput && (
                        <button
                          type="button"
                          onClick={() => setShowCcInput(true)}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <UserPlus size={13} />
                          <span>+ {isAr ? 'إضافة نسخة (CC) لزملاء بالشركة' : 'Add CC (Company Colleague)'}</span>
                        </button>
                      )}
                    </div>

                    {/* Fixed Support Banner */}
                    <div className="p-3 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                          <ShieldCheck size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {fixedSupportRecipient.name}
                            </span>
                            <span className="text-[11px] font-mono text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 rounded-full font-semibold">
                              {fixedSupportRecipient.email}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {isAr
                              ? 'يصل الطلب فوراً ومباشرةً إلى إدارة النظام والدعم الفني العام لمتابعته وحله'
                              : 'Routed directly to Super Admin & Technical Support Team'}
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-800 shrink-0">
                        🔒 {isAr ? 'مستلم ثابت' : 'Fixed'}
                      </span>
                    </div>
                  </div>
                ) : (
                  /* COMPANY MODE: MULTI-SELECT TO FROM COMPANY USERS */
                  <div className="space-y-1.5 relative" ref={toDropdownRef}>
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold">{isAr ? 'إلى (To):' : 'To:'}</span>
                        <span className="text-[11px] text-emerald-600 font-normal">
                          ({isAr ? 'يمكنك تحديد أكثر من شخص' : 'Multiple recipients allowed'})
                        </span>
                      </div>
                      {!showCcInput && (
                        <button
                          type="button"
                          onClick={() => setShowCcInput(true)}
                          className="text-xs text-blue-600 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <UserPlus size={13} />
                          <span>+ {isAr ? 'إضافة نسخة (CC)' : 'Add CC'}</span>
                        </button>
                      )}
                    </div>

                    {/* Chips & Search Input */}
                    <div className="min-h-[44px] p-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl flex flex-wrap items-center gap-2 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500/20">
                      {composeTo.map(u => (
                        <span
                          key={u.id}
                          className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-200 rounded-lg text-xs font-medium border border-emerald-200 dark:border-emerald-800 shadow-2xs"
                        >
                          <span className="font-bold">{u.name}</span>
                          {u.email && u.email !== u.name && (
                            <span className="text-[10px] opacity-75 dir-ltr font-mono">({u.email})</span>
                          )}
                          <button
                            type="button"
                            onClick={() => setComposeTo(prev => prev.filter(item => item.id !== u.id))}
                            className="hover:text-rose-600 cursor-pointer p-0.5 rounded-full hover:bg-emerald-200 dark:hover:bg-emerald-900 transition-colors"
                          >
                            <X size={13} />
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
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
                            e.preventDefault();
                            commitRecipient('to');
                          }
                        }}
                        onBlur={() => {
                          if (toSearchQuery.trim()) {
                            commitRecipient('to');
                          }
                        }}
                        onFocus={() => setIsToDropdownOpen(true)}
                        placeholder={composeTo.length === 0 ? (isAr ? 'اختر زميلاً أو اكتب بريداً واضغط Enter...' : 'Select user or type email & Enter...') : (isAr ? 'إضافة مستلم آخر...' : 'Add recipient...')}
                        className="flex-1 min-w-[160px] bg-transparent text-xs p-1 focus:outline-none text-slate-850 dark:text-white"
                      />
                    </div>

                    {/* Dropdown list for To */}
                    {isToDropdownOpen && (
                      <div className="absolute z-30 top-full mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-52 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                        {toSearchQuery.trim() && (
                          <div
                            onClick={() => commitRecipient('to')}
                            className="px-3.5 py-2.5 text-xs flex items-center justify-between bg-emerald-50/80 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 cursor-pointer font-semibold border-b border-emerald-100 dark:border-emerald-900 transition-colors"
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <span>➕ {isAr ? 'اعتماد المستلم/البريد:' : 'Add recipient:'}</span>
                              <span className="font-mono text-emerald-900 dark:text-emerald-100 underline truncate">{toSearchQuery.trim()}</span>
                            </div>
                            <span className="text-[10px] bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100 px-2 py-0.5 rounded font-mono shrink-0">
                              Enter ↵
                            </span>
                          </div>
                        )}
                        {companyUsers
                          .filter(c => c.id !== user?.id && !composeTo.some(t => t.id === c.id))
                          .filter(c => !toSearchQuery || c.name.toLowerCase().includes(toSearchQuery.toLowerCase()) || (c.email && c.email.toLowerCase().includes(toSearchQuery.toLowerCase())))
                          .map(c => (
                            <div
                              key={c.id}
                              onClick={() => {
                                setComposeTo(prev => [...prev, c]);
                                setToSearchQuery('');
                                setIsToDropdownOpen(false);
                              }}
                              className="px-3.5 py-2.5 text-xs flex items-center justify-between hover:bg-emerald-50 dark:hover:bg-slate-700/60 cursor-pointer transition-colors"
                            >
                              <div>
                                <p className="font-bold text-slate-850 dark:text-white">{c.name}</p>
                                <p className="text-[11px] text-slate-400 font-mono">{c.email || ''}</p>
                              </div>
                              <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded">
                                {c.role || (isAr ? 'موظف' : 'User')}
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Recipient "CC" (متاح في الدعم الفني لزملاء الشركة، وفي بريد الشركة) */}
                {showCcInput && (
                  <div className="space-y-1.5 relative" ref={ccDropdownRef}>
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold">{isAr ? 'نسخة إلى (CC) داخل الشركة:' : 'CC (Inside Company):'}</span>
                        <span className="text-[11px] text-blue-600 dark:text-blue-400 font-normal">
                          ({isAr ? 'يمكنك تحديد زميل أو أكثر داخل شركتك للاطلاع والمتابعة' : 'Pick one or more colleagues from your company'})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCcInput(false);
                          setComposeCc([]);
                        }}
                        className="text-xs text-rose-500 hover:underline cursor-pointer"
                      >
                        {isAr ? 'إلغاء النسخة' : 'Remove CC'}
                      </button>
                    </div>

                    <div className="min-h-[44px] p-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl flex flex-wrap items-center gap-2 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/20">
                      {composeCc.map(u => (
                        <span
                          key={u.id}
                          className="flex items-center gap-1.5 px-3 py-1 bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-200 rounded-lg text-xs font-medium border border-blue-200 dark:border-blue-800 shadow-2xs"
                        >
                          <span className="font-bold">{u.name}</span>
                          {u.email && u.email !== u.name && (
                            <span className="text-[10px] opacity-75 dir-ltr font-mono">({u.email})</span>
                          )}
                          <button
                            type="button"
                            onClick={() => setComposeCc(prev => prev.filter(item => item.id !== u.id))}
                            className="hover:text-rose-600 cursor-pointer p-0.5 rounded-full hover:bg-blue-200 dark:hover:bg-blue-900 transition-colors"
                          >
                            <X size={13} />
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
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
                            e.preventDefault();
                            commitRecipient('cc');
                          }
                        }}
                        onBlur={() => {
                          if (ccSearchQuery.trim()) {
                            commitRecipient('cc');
                          }
                        }}
                        onFocus={() => setIsCcDropdownOpen(true)}
                        placeholder={composeCc.length === 0 ? (isAr ? 'اختر زميلاً أو اكتب بريداً واضغط Enter...' : 'Search company colleagues or enter email...') : (isAr ? 'إضافة نسخة أخرى...' : 'Add CC...')}
                        className="flex-1 min-w-[160px] bg-transparent text-xs p-1 focus:outline-none text-slate-850 dark:text-white"
                      />
                    </div>

                    {isCcDropdownOpen && (
                      <div className="absolute z-30 top-full mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-52 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                        {ccSearchQuery.trim() && (
                          <div
                            onClick={() => commitRecipient('cc')}
                            className="px-3.5 py-2.5 text-xs flex items-center justify-between bg-blue-50/80 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-800 dark:text-blue-200 cursor-pointer font-semibold border-b border-blue-100 dark:border-blue-900 transition-colors"
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <span>➕ {isAr ? 'اعتماد النسخة/البريد:' : 'Add CC:'}</span>
                              <span className="font-mono text-blue-900 dark:text-blue-100 underline truncate">{ccSearchQuery.trim()}</span>
                            </div>
                            <span className="text-[10px] bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100 px-2 py-0.5 rounded font-mono shrink-0">
                              Enter ↵
                            </span>
                          </div>
                        )}
                        {companyUsers
                          .filter(c => c.id !== user?.id && !composeCc.some(item => item.id === c.id))
                          .filter(c => !ccSearchQuery || c.name.toLowerCase().includes(ccSearchQuery.toLowerCase()) || (c.email && c.email.toLowerCase().includes(ccSearchQuery.toLowerCase())))
                          .map(c => (
                            <div
                              key={c.id}
                              onClick={() => {
                                setComposeCc(prev => [...prev, c]);
                                setCcSearchQuery('');
                                setIsCcDropdownOpen(false);
                              }}
                              className="px-3.5 py-2.5 text-xs flex items-center justify-between hover:bg-blue-50 dark:hover:bg-slate-700/60 cursor-pointer transition-colors"
                            >
                              <div>
                                <p className="font-bold text-slate-850 dark:text-white">{c.name}</p>
                                <p className="text-[11px] text-slate-400 font-mono">{c.email || ''}</p>
                              </div>
                              <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded">
                                {c.role || (isAr ? 'موظف' : 'User')}
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Subject Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {activeCategory === 'support'
                      ? (isAr ? 'عنوان المشكلة أو الاستفسار:' : 'Ticket Subject:')
                      : (isAr ? 'عنوان الرسالة / الموضوع:' : 'Subject:')}
                  </label>
                  <input
                    type="text"
                    value={composeSubject}
                    onChange={e => setComposeSubject(e.target.value)}
                    placeholder={
                      activeCategory === 'support'
                        ? (isAr ? 'اكتب ملخصاً واضحاً للمشكلة أو الاستفسار...' : 'Brief summary of the issue...')
                        : (isAr ? 'اكتب عنوان الرسالة هنا...' : 'Enter message subject...')
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-850 dark:text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                  />
                </div>

                {/* 4. Message Body */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {activeCategory === 'support'
                      ? (isAr ? 'تفاصيل التذكرة وشرح المشكلة:' : 'Ticket Details:')
                      : (isAr ? 'نص الرسالة:' : 'Message Body:')}
                  </label>
                  <textarea
                    rows={8}
                    value={composeBody}
                    onChange={e => setComposeBody(e.target.value)}
                    placeholder={
                      activeCategory === 'support'
                        ? (isAr ? 'اكتب تفاصيل الاستفسار أو المشكلة التي تواجهك بدقة لمساعدتك بشكل أسرع...' : 'Describe your issue in detail...')
                        : (isAr ? 'اكتب تفاصيل الرسالة هنا...' : 'Type your message details here...')
                    }
                    className="w-full p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-850 dark:text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 resize-y leading-relaxed font-sans"
                  />
                </div>

                {/* 5. Attachments Manager */}
                <div className="pt-2">
                  <AttachmentsManager
                    attachments={composeAttachments}
                    onChange={setComposeAttachments}
                    title={isAr ? 'المرفقات (صور، مستندات، ملفات PDF، Excel)' : 'Attachments'}
                    compact={true}
                  />
                </div>
              </div>

              {/* Form Bottom Footer */}
              <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
                <button
                  type="button"
                  onClick={handleCloseCompose}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>

                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={sending}
                  className={`flex items-center gap-2 px-6 py-2 rounded-xl text-white text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50 ${
                    activeCategory === 'support'
                      ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
                      : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
                  }`}
                >
                  <Send size={15} />
                  <span>
                    {sending
                      ? (isAr ? 'جاري الإرسال...' : 'Sending...')
                      : activeCategory === 'support'
                        ? (isAr ? 'إرسال تذكرة الدعم' : 'Send Support Ticket')
                        : (isAr ? 'إرسال الرسالة' : 'Send Message')}
                  </span>
                </button>
              </div>
            </div>
          ) : selectedMessage ? (
            /* ======================================================================= */
            /* VIEW 2: INTEGRATED MESSAGE DETAIL VIEW */
            /* ======================================================================= */
            <div className="flex-1 flex flex-col overflow-y-auto p-4 md:p-6 space-y-4">
              {/* Back button & Action Toolbar */}
              <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setSelectedMessage(null)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-700 rounded-lg hover:bg-slate-100 transition-all cursor-pointer border border-slate-200 dark:border-slate-600 shadow-2xs"
                >
                  <ArrowRight size={14} className={isAr ? '' : 'rotate-180'} />
                  <span>{isAr ? 'الرجوع للقائمة' : 'Back to list'}</span>
                </button>

                <div className="flex items-center gap-1.5">
                  {/* Star */}
                  <button
                    type="button"
                    onClick={() => handleToggleStar(selectedMessage.id)}
                    className="p-2 text-slate-500 hover:text-amber-500 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-all cursor-pointer"
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
                    className="p-2 text-slate-500 hover:text-purple-600 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-all cursor-pointer"
                    title={isAr ? 'أرشفة' : 'Archive'}
                  >
                    <Archive size={16} />
                  </button>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => handleDeleteMessage(selectedMessage.id)}
                    className="p-2 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-all cursor-pointer"
                    title={isAr ? 'حذف' : 'Delete'}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Message Header Card */}
              <div className="bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 md:p-6 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        selectedMessage.category === 'support' ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300' : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
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
                        <span key={u.id} className="px-2 py-0.5 rounded-full bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium border border-slate-200 dark:border-slate-600">
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
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap min-h-[120px]">
                  {selectedMessage.body}
                </div>

                {/* Attachments Section */}
                {Array.isArray(selectedMessage.attachments) && selectedMessage.attachments.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                      <Paperclip size={14} className="text-emerald-600" />
                      <span>{isAr ? 'المرفقات' : 'Attachments'} ({selectedMessage.attachments.length})</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {selectedMessage.attachments.map((att, idx) => (
                        <div
                          key={att.id || idx}
                          className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-750 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-emerald-500 transition-all group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                              {att.type?.includes('image') ? <ImageIcon size={16} /> : <FileText size={16} />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{att.name}</p>
                              <p className="text-[10px] text-slate-400">
                                {att.size ? `${(att.size / 1024).toFixed(1)} KB` : ''}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setPreviewAttachment(att)}
                              className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                              title={isAr ? 'معاينة' : 'Preview'}
                            >
                              <Eye size={14} />
                            </button>
                            {att.url && (
                              <a
                                href={att.url}
                                download={att.name}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                                title={isAr ? 'تحميل' : 'Download'}
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
              <div className="bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 md:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-white">
                    <Reply size={15} className="text-emerald-600" />
                    <span>{isAr ? 'الرد السريع على الرسالة' : 'Quick Reply'}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowReplyAttachments(!showReplyAttachments)}
                    className="text-xs font-semibold text-emerald-600 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Paperclip size={13} />
                    <span>{showReplyAttachments ? (isAr ? 'إخفاء المرفقات' : 'Hide attachments') : (isAr ? 'إرفاق ملف' : 'Attach file')}</span>
                  </button>
                </div>

                <textarea
                  rows={3}
                  value={replyBody}
                  onChange={e => setReplyBody(e.target.value)}
                  placeholder={isAr ? 'اكتب ردك هنا...' : 'Write your reply...'}
                  className="w-full p-3 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 resize-y"
                />

                {showReplyAttachments && (
                  <div className="pt-2">
                    <AttachmentsManager
                      attachments={replyAttachments}
                      onChange={setReplyAttachments}
                      title={isAr ? 'مرفقات الرد' : 'Reply attachments'}
                      compact={true}
                    />
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSendReply}
                    disabled={sendingReply || !replyBody.trim()}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl text-white text-xs font-bold bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-500/20 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    <Send size={14} />
                    <span>{sendingReply ? (isAr ? 'جاري الإرسال...' : 'Sending...') : (isAr ? 'إرسال الرد' : 'Send Reply')}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ======================================================================= */
            /* VIEW 3: INTEGRATED MESSAGE LIST VIEW */
            /* ======================================================================= */
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* List Header Toolbar */}
              <div className="p-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60 flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {filteredMessages.length} {isAr ? 'رسائل' : 'messages'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">
                    {isAr ? 'يتم التحديث تلقائياً' : 'Auto refreshed'}
                  </span>
                </div>
              </div>

              {/* Messages List Container */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {filteredMessages.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 space-y-3">
                    <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                      <Inbox size={24} />
                    </div>
                    <p className="text-xs font-medium">
                      {searchQuery
                        ? (isAr ? 'لا توجد رسائل مطابقة لنتيجة البحث' : 'No messages matching your search')
                        : (isAr ? 'لا توجد رسائل في هذا المجلد' : 'No messages in this folder')}
                    </p>
                  </div>
                ) : (
                  filteredMessages.map(msg => {
                    const isRead = Array.isArray(msg.read_by) && msg.read_by.includes(currentUserId);
                    const isStarred = Array.isArray(msg.is_starred) && msg.is_starred.includes(currentUserId);
                    const dateFormatted = formatMailDateTime(msg.created_at, isAr);
                    const hasAttachments = Array.isArray(msg.attachments) && msg.attachments.length > 0;

                    return (
                      <div
                        key={msg.id}
                        onClick={() => handleSelectMessage(msg)}
                        className={`group px-4 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer ${
                          !isRead
                            ? 'bg-emerald-50/30 dark:bg-emerald-950/15 font-bold text-slate-900 dark:text-white'
                            : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {/* Star Button */}
                        <button
                          type="button"
                          onClick={e => handleToggleStar(msg.id, e)}
                          className="p-1 text-slate-300 hover:text-amber-500 transition-colors cursor-pointer"
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
                            className="p-1 hover:text-purple-600 text-slate-400 rounded transition-colors cursor-pointer"
                            title={isAr ? 'أرشفة' : 'Archive'}
                          >
                            <Archive size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={e => handleDeleteMessage(msg.id, e)}
                            className="p-1 hover:text-rose-600 text-slate-400 rounded transition-colors cursor-pointer"
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

      {/* Attachment Preview Modal (Lightbox) */}
      <AttachmentPreviewModal
        isOpen={!!previewAttachment}
        attachment={previewAttachment}
        onClose={() => setPreviewAttachment(null)}
      />
    </div>
  );
};

// =========================================================================
// Lightbox modal for attachment previews (Images, PDFs, Documents)
// =========================================================================
interface PreviewModalProps {
  isOpen: boolean;
  attachment: AttachmentItem | null;
  onClose: () => void;
}

const AttachmentPreviewModal: React.FC<PreviewModalProps> = ({ isOpen, attachment, onClose }) => {
  if (!isOpen || !attachment) return null;

  const isImage = attachment.type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(attachment.name);
  const isPdf = attachment.type === 'application/pdf' || /\.pdf$/i.test(attachment.name);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2 truncate">
            <FileText size={16} className="text-emerald-400 shrink-0" />
            <span className="font-bold text-sm truncate">{attachment.name}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {attachment.url && (
              <a
                href={attachment.url}
                download={attachment.name}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                <Download size={14} />
                <span>تحميل</span>
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Viewer */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-100 dark:bg-slate-950 min-h-[300px]">
          {isImage && attachment.url ? (
            <img
              src={attachment.url}
              alt={attachment.name}
              className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-md"
            />
          ) : isPdf && attachment.url ? (
            <iframe
              src={attachment.url}
              title={attachment.name}
              className="w-full h-[75vh] rounded-lg border border-slate-300 dark:border-slate-800"
            />
          ) : (
            <div className="text-center p-8 space-y-3">
              <FileText size={48} className="mx-auto text-slate-400" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{attachment.name}</p>
              <p className="text-xs text-slate-400">لا يمكن معاينة هذا النوع من الملفات مباشرة داخل المتصفح.</p>
              {attachment.url && (
                <a
                  href={attachment.url}
                  download={attachment.name}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-emerald-700 transition-all cursor-pointer"
                >
                  <Download size={15} />
                  <span>تحميل الملف الآن</span>
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InternalMail;
