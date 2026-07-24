import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail,
  MailOpen,
  Archive,
  Trash2,
  Search,
  CheckCircle2,
  Clock,
  User,
  Phone,
  MessageSquare,
  Calendar,
  X,
  FileText,
  Save,
  Loader2,
  Inbox,
  AlertTriangle
} from 'lucide-react';
import { dbService } from '../services/dbService';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotification } from '../contexts/NotificationContext';
import { ContactMessage } from '../types';

export const ContactMessages: React.FC = () => {
  const { t } = useLanguage();
  const { showNotification } = useNotification();
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'read' | 'archived'>('all');
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [notesInput, setNotesInput] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const selectedMessageRef = useRef<ContactMessage | null>(null);
  useEffect(() => {
    selectedMessageRef.current = selectedMessage;
  }, [selectedMessage]);

  const fetchMessages = async (showSpinner = false) => {
    try {
      if (showSpinner) setLoading(true);
      const data = await dbService.getContactMessages();
      const list = data || [];
      setMessages(list);

      if (selectedMessageRef.current) {
        const currentId = selectedMessageRef.current.id;
        const updated = list.find((m: ContactMessage) => m.id === currentId);
        if (updated) {
          setSelectedMessage(updated);
        }
      }
    } catch (error: any) {
      console.error('Failed to fetch contact messages:', error);
      showNotification(error.message || 'فشل في تحميل رسائل التواصل', 'error');
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages(true);
  }, []);

  useEffect(() => {
    if (selectedMessage) {
      setNotesInput(selectedMessage.notes || '');
    }
  }, [selectedMessage]);

  const handleOpenDetails = async (msg: ContactMessage) => {
    setSelectedMessage(msg);
    // If message is new, automatically mark as read upon viewing details
    if (msg.status === 'new') {
      try {
        await dbService.updateContactMessageStatus(msg.id, 'read');
        setSelectedMessage(prev => prev && prev.id === msg.id ? { ...prev, status: 'read' } : prev);
        await fetchMessages(false);
      } catch (err) {
        console.error('Failed to auto-mark message as read:', err);
      }
    }
  };

  const handleUpdateStatus = async (id: string, status: 'new' | 'read' | 'archived') => {
    if (!id) return;
    try {
      setActionLoading(true);
      await dbService.updateContactMessageStatus(id, status);

      if (selectedMessage?.id === id) {
        setSelectedMessage(prev => prev ? { ...prev, status } : null);
      }

      await fetchMessages(false);

      if (status === 'read') {
        showNotification(t('contact_messages.marked_read_success') || 'تم تحديث حالة الرسالة إلى مقروءة بنجاح.');
      } else if (status === 'archived') {
        showNotification(t('contact_messages.archived_success') || 'تم أرشفة الرسالة بنجاح.');
      } else if (status === 'new') {
        showNotification(t('contact_messages.marked_new_success') || 'تم تحديث حالة الرسالة إلى جديدة بنجاح.');
      }
    } catch (error: any) {
      console.error('Failed to update status:', error);
      showNotification(error.message || 'فشل في تحديث حالة الرسالة', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedMessage) return;
    try {
      setSavingNotes(true);
      await dbService.updateContactMessageNotes(selectedMessage.id, notesInput);

      setSelectedMessage(prev => prev ? { ...prev, notes: notesInput } : null);
      await fetchMessages(false);

      showNotification(t('contact_messages.notes_saved_success') || 'تم حفظ الملاحظات بنجاح.');
    } catch (error: any) {
      console.error('Failed to save notes:', error);
      showNotification(error.message || 'فشل في حفظ الملاحظات', 'error');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!id) return;
    try {
      setActionLoading(true);
      await dbService.deleteContactMessage(id);

      if (selectedMessage?.id === id) {
        setSelectedMessage(null);
      }
      setDeleteConfirmId(null);
      await fetchMessages(false);

      showNotification(t('contact_messages.deleted_success') || 'تم حذف الرسالة بنجاح.');
    } catch (error: any) {
      console.error('Failed to delete message:', error);
      showNotification(error.message || 'فشل في حذف الرسالة', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Filter messages
  const filteredMessages = messages.filter((msg) => {
    const matchesStatus = statusFilter === 'all' || msg.status === statusFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      msg.name.toLowerCase().includes(q) ||
      msg.email.toLowerCase().includes(q) ||
      (msg.phone && msg.phone.toLowerCase().includes(q)) ||
      msg.message.toLowerCase().includes(q);
    return matchesStatus && matchesQuery;
  });

  const totalCount = messages.length;
  const newCount = messages.filter((m) => m.status === 'new').length;
  const readCount = messages.filter((m) => m.status === 'read').length;
  const archivedCount = messages.filter((m) => m.status === 'archived').length;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto font-sans">
      {/* Header & Stats Cards */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <Mail className="w-8 h-8 text-[#1B853A]" />
            <span>{t('contact_messages.title')}</span>
          </h1>
          <p className="mt-1 text-slate-500 text-sm">{t('contact_messages.subtitle')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stat 1: Total */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {t('contact_messages.stat_total')}
            </p>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-1">{totalCount}</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
            <Inbox className="w-6 h-6" />
          </div>
        </div>

        {/* Stat 2: New */}
        <div className="bg-white p-5 rounded-2xl border border-emerald-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
              {t('contact_messages.stat_new')}
            </p>
            <h3 className="text-2xl font-extrabold text-emerald-800 mt-1">{newCount}</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-100/80 flex items-center justify-center text-emerald-700">
            <Mail className="w-6 h-6" />
          </div>
        </div>

        {/* Stat 3: Read */}
        <div className="bg-white p-5 rounded-2xl border border-blue-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
              {t('contact_messages.stat_read')}
            </p>
            <h3 className="text-2xl font-extrabold text-blue-800 mt-1">{readCount}</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-100/80 flex items-center justify-center text-blue-700">
            <MailOpen className="w-6 h-6" />
          </div>
        </div>

        {/* Stat 4: Archived */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {t('contact_messages.stat_archived')}
            </p>
            <h3 className="text-2xl font-extrabold text-slate-700 mt-1">{archivedCount}</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
            <Archive className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t('contact_messages.status_all')} ({totalCount})
          </button>
          <button
            onClick={() => setStatusFilter('new')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
              statusFilter === 'new'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            {t('contact_messages.status_new')} ({newCount})
          </button>
          <button
            onClick={() => setStatusFilter('read')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              statusFilter === 'read'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            {t('contact_messages.status_read')} ({readCount})
          </button>
          <button
            onClick={() => setStatusFilter('archived')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              statusFilter === 'archived'
                ? 'bg-slate-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t('contact_messages.status_archived')} ({archivedCount})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('contact_messages.search_placeholder')}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-medium"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 text-center flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mb-3 text-emerald-600" />
            <p className="text-sm font-medium">{t('common.loading')}</p>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center justify-center text-slate-400">
            <Inbox className="w-12 h-12 mb-3 stroke-[1.5]" />
            <p className="text-base font-semibold text-slate-700">{t('contact_messages.no_messages')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-5">{t('contact_messages.col_name')}</th>
                  <th className="py-3.5 px-5">{t('contact_messages.col_email')}</th>
                  <th className="py-3.5 px-5">{t('contact_messages.col_phone')}</th>
                  <th className="py-3.5 px-5">{t('contact_messages.col_date')}</th>
                  <th className="py-3.5 px-5">{t('contact_messages.col_status')}</th>
                  <th className="py-3.5 px-5 text-right">{t('contact_messages.col_actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMessages.map((msg) => {
                  const isNew = msg.status === 'new';
                  const isRead = msg.status === 'read';

                  return (
                    <tr
                      key={msg.id}
                      onClick={() => handleOpenDetails(msg)}
                      className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                        isNew ? 'bg-emerald-50/30 font-semibold' : ''
                      }`}
                    >
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                            isNew ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {msg.name ? msg.name.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">{msg.name}</span>
                            <span className="text-[11px] text-slate-400 font-normal line-clamp-1 max-w-[200px]">
                              {msg.message}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-5 text-slate-600 font-medium">
                        <a
                          href={`mailto:${msg.email}`}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:text-emerald-600 hover:underline"
                        >
                          {msg.email}
                        </a>
                      </td>
                      <td className="py-4 px-5 text-slate-600 font-medium" dir="ltr">
                        {msg.phone ? (
                          <a
                            href={`tel:${msg.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="hover:text-emerald-600 hover:underline"
                          >
                            {msg.phone}
                          </a>
                        ) : (
                          <span className="text-slate-400 font-normal">-</span>
                        )}
                      </td>
                      <td className="py-4 px-5 text-slate-500 font-medium whitespace-nowrap">
                        {formatDate(msg.created_at)}
                      </td>
                      <td className="py-4 px-5 whitespace-nowrap">
                        {isNew && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            {t('contact_messages.status_new')}
                          </span>
                        )}
                        {isRead && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                            {t('contact_messages.status_read')}
                          </span>
                        )}
                        {msg.status === 'archived' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {t('contact_messages.status_archived')}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          {msg.status !== 'archived' ? (
                            <button
                              title={t('contact_messages.archive')}
                              onClick={() => handleUpdateStatus(msg.id, 'archived')}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              title={t('contact_messages.mark_read')}
                              onClick={() => handleUpdateStatus(msg.id, 'read')}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                            >
                              <MailOpen className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            title={t('contact_messages.delete')}
                            onClick={() => setDeleteConfirmId(msg.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Slide-over Details Panel */}
      <AnimatePresence>
        {selectedMessage && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedMessage(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
            />

            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="pointer-events-auto w-screen max-w-xl bg-white shadow-2xl flex flex-col justify-between"
              >
                {/* Panel Header */}
                <div className="p-6 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/80">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 font-extrabold flex items-center justify-center text-sm">
                      {selectedMessage.name ? selectedMessage.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-lg">{selectedMessage.name}</h3>
                      <p className="text-xs text-slate-400">{formatDate(selectedMessage.created_at)}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedMessage(null)}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Panel Content Scrollable */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1">
                  {/* Sender Info Details Grid */}
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/70 text-xs">
                    <div>
                      <span className="text-slate-400 block font-medium mb-1">{t('contact_messages.col_name')}</span>
                      <span className="font-bold text-slate-800">{selectedMessage.name}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block font-medium mb-1">{t('contact_messages.col_email')}</span>
                      <a href={`mailto:${selectedMessage.email}`} className="font-bold text-emerald-700 hover:underline">
                        {selectedMessage.email}
                      </a>
                    </div>

                    <div>
                      <span className="text-slate-400 block font-medium mb-1">{t('contact_messages.col_phone')}</span>
                      {selectedMessage.phone ? (
                        <a href={`tel:${selectedMessage.phone}`} dir="ltr" className="font-bold text-emerald-700 hover:underline block text-right">
                          {selectedMessage.phone}
                        </a>
                      ) : (
                        <span className="text-slate-400 font-normal">-</span>
                      )}
                    </div>

                    <div>
                      <span className="text-slate-400 block font-medium mb-1">{t('contact_messages.col_status')}</span>
                      <span className="font-bold uppercase text-slate-800">{selectedMessage.status}</span>
                    </div>

                    {selectedMessage.handled_by && (
                      <div className="col-span-2 border-t border-slate-200/60 pt-2">
                        <span className="text-slate-400 block font-medium mb-0.5">{t('contact_messages.handled_by')}</span>
                        <span className="font-bold text-slate-700">{selectedMessage.handled_by}</span>
                      </div>
                    )}
                  </div>

                  {/* Message Content Box */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-emerald-600" />
                      <span>{t('landing.contact.form_message')}</span>
                    </h4>
                    <div className="p-4 rounded-2xl bg-white border border-slate-200 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-sans shadow-xs">
                      {selectedMessage.message}
                    </div>
                  </div>

                  {/* Internal Notes Textarea */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span>{t('contact_messages.internal_notes')}</span>
                    </h4>
                    <textarea
                      rows={4}
                      value={notesInput}
                      onChange={(e) => setNotesInput(e.target.value)}
                      placeholder={t('contact_messages.notes_placeholder')}
                      className="w-full p-3.5 rounded-2xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs text-slate-800 leading-relaxed font-sans"
                    />
                    <div className="mt-2 flex justify-end">
                      <button
                        onClick={handleSaveNotes}
                        disabled={savingNotes}
                        className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
                      >
                        {savingNotes ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        <span>{t('contact_messages.save_notes')}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Panel Footer Actions */}
                <div className="p-6 border-t border-slate-200/80 bg-slate-50 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {selectedMessage.status !== 'read' && (
                      <button
                        onClick={() => handleUpdateStatus(selectedMessage.id, 'read')}
                        disabled={actionLoading}
                        className="px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 shadow-xs cursor-pointer transition-colors"
                      >
                        <MailOpen className="w-4 h-4" />
                        <span>{t('contact_messages.mark_read')}</span>
                      </button>
                    )}

                    {selectedMessage.status !== 'new' && (
                      <button
                        onClick={() => handleUpdateStatus(selectedMessage.id, 'new')}
                        disabled={actionLoading}
                        className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-xs cursor-pointer transition-colors"
                      >
                        <Mail className="w-4 h-4" />
                        <span>{t('contact_messages.mark_new')}</span>
                      </button>
                    )}

                    {selectedMessage.status !== 'archived' ? (
                      <button
                        onClick={() => handleUpdateStatus(selectedMessage.id, 'archived')}
                        disabled={actionLoading}
                        className="px-3.5 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors"
                      >
                        <Archive className="w-4 h-4" />
                        <span>{t('contact_messages.archive')}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUpdateStatus(selectedMessage.id, 'read')}
                        disabled={actionLoading}
                        className="px-3.5 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors"
                      >
                        <MailOpen className="w-4 h-4" />
                        <span>{t('contact_messages.status_read')}</span>
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => setDeleteConfirmId(selectedMessage.id)}
                    disabled={actionLoading}
                    className="px-3.5 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors border border-red-200"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{t('contact_messages.delete')}</span>
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmId(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 z-10 text-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">{t('common.delete_confirm_title')}</h3>
              <p className="text-xs text-slate-500 leading-relaxed mb-6">
                {t('contact_messages.delete_confirm')}
              </p>

              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirmId)}
                  disabled={actionLoading}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer shadow-md"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  <span>{t('common.delete')}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
