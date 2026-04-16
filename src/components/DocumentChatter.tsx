import React, { useEffect, useState } from 'react';
import { dbService } from '../services/dbService';
import { ActivityLog } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { User, Clock, ChevronRight, Edit3, Plus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DocumentChatterProps {
  documentId: string;
  collectionName: string;
}

const DocumentChatter: React.FC<DocumentChatterProps> = ({ documentId, collectionName }) => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && documentId) {
      const unsub = dbService.subscribe<ActivityLog>('activity_logs', user.company_id, (data) => {
        const filtered = data
          .filter(log => log.document_id === documentId)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setLogs(filtered);
        setLoading(false);
      });
      return () => unsub();
    }
  }, [user, documentId]);

  const getActionIcon = (action: string) => {
    if (action.includes('إضافة')) return <Plus className="w-4 h-4 text-green-500" />;
    if (action.includes('تعديل')) return <Edit3 className="w-4 h-4 text-blue-500" />;
    if (action.includes('حذف')) return <Trash2 className="w-4 h-4 text-red-500" />;
    return <Clock className="w-4 h-4 text-gray-500" />;
  };

  if (loading) return <div className="p-4 text-center text-gray-500">جاري تحميل السجل...</div>;

  return (
    <div className="bg-gray-50 border-r border-gray-200 w-80 flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-gray-200 bg-white flex items-center gap-2">
        <Clock className="w-5 h-5 text-gray-600" />
        <h3 className="font-bold text-gray-800">سجل النشاط</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <AnimatePresence initial={false}>
          {logs.length === 0 ? (
            <div className="text-center text-gray-400 py-10">لا توجد حركات مسجلة</div>
          ) : (
            logs.map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="relative pl-6 border-l-2 border-gray-200 pb-1"
              >
                {/* Timeline Dot */}
                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      <span>{log.username}</span>
                    </div>
                    <span>{format(new Date(log.timestamp), 'dd MMM yyyy HH:mm', { locale: ar })}</span>
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    {getActionIcon(log.action)}
                    <span className="font-semibold text-sm text-gray-800">{log.action}</span>
                  </div>

                  {log.changes && log.changes.length > 0 && (
                    <div className="mt-2 space-y-2 bg-white p-2 rounded border border-gray-100 shadow-sm">
                      {log.changes.map((change, idx) => (
                        <div key={idx} className="text-xs flex flex-wrap items-center gap-1">
                          <span className="font-medium text-gray-600">{change.field}:</span>
                          <span className="text-red-500 line-through opacity-70">{String(change.old_value || 'فارغ')}</span>
                          <ChevronRight className="w-3 h-3 text-gray-400" />
                          <span className="text-green-600 font-bold">{String(change.new_value || 'فارغ')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default DocumentChatter;
