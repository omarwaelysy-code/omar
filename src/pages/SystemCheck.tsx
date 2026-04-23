import React, { useState, useEffect } from 'react';
import { ShieldCheck, AlertTriangle, Database, CheckCircle, RefreshCw, Server, Search, Check } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';

interface SchemaStatus {
  missingTables: string[];
  missingColumns: { table: string; columns: string[] }[];
  databaseHealth: string;
  dbVersion: string;
  pendingMigrations: string[];
}

export const SystemCheck: React.FC = () => {
  const { t, dir } = useLanguage();
  const [status, setStatus] = useState<SchemaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [fixing, setFixing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/erp/system/check', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch system status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleFix = async () => {
    setFixing(true);
    setMessage(null);
    try {
      console.log('Starting system fix...');
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/erp/system/fix', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        const count = data.appliedCount || 0;
        setMessage({ 
          type: 'success', 
          text: count > 0 ? `Successfully applied ${count} migrations!` : 'System is already up to date.' 
        });
        await fetchStatus();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to fix issues.' });
      }
    } catch (error) {
      console.error('Fix error:', error);
      setMessage({ type: 'error', text: 'Connection error while fixing.' });
    } finally {
      setFixing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="animate-spin text-emerald-500" size={48} />
      </div>
    );
  }

  const hasIssues = status && (status.missingTables.length > 0 || status.missingColumns.length > 0 || status.pendingMigrations.length > 0);

  return (
    <div className="space-y-6" dir={dir}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-500/20">
            <ShieldCheck size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">System Integrity Check</h1>
            <p className="text-zinc-500 text-sm">Database schema & migration audit</p>
          </div>
        </div>
        <button
          onClick={fetchStatus}
          disabled={loading}
          className="p-2 text-zinc-400 hover:text-zinc-900 transition-colors"
          title="Refresh Status"
        >
          <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`p-4 rounded-2xl border flex items-center gap-3 ${message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'}`}
          >
            {message.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
            <span className="font-medium">{message.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Status Overview */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-[2rem] border border-zinc-100 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-50">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <Search size={20} className="text-emerald-500" />
                Diagnostic Results
              </h2>
              {hasIssues ? (
                <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full uppercase tracking-wider">Issues Detected</span>
              ) : (
                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full uppercase tracking-wider">Perfect Health</span>
              )}
            </div>

            <div className="space-y-4">
              {/* Missing Tables */}
              <div>
                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-tight mb-2">Missing Tables</h3>
                {status?.missingTables.length === 0 ? (
                  <div className="flex items-center gap-2 text-emerald-600 text-sm py-2 px-3 bg-emerald-50 rounded-xl w-fit">
                    <CheckCircle size={16} /> All tables present
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {status?.missingTables.map(table => (
                      <div key={table} className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100 font-mono">
                        <AlertTriangle size={14} /> {table}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Missing Columns */}
              <div>
                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-tight mb-2">Missing Columns</h3>
                {status?.missingColumns.length === 0 ? (
                  <div className="flex items-center gap-2 text-emerald-600 text-sm py-2 px-3 bg-emerald-50 rounded-xl w-fit">
                    <CheckCircle size={16} /> All columns present
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {status?.missingColumns.map((item, idx) => (
                      <div key={idx} className="p-3 bg-amber-50 border border-amber-100 rounded-2xl">
                        <div className="text-sm font-bold text-amber-700 mb-2 flex items-center gap-2">
                          <Database size={14} /> Table: <span className="font-mono">{item.table}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {item.columns.map(col => (
                            <span key={col} className="px-2 py-0.5 bg-white border border-amber-200 text-amber-600 text-xs font-mono rounded-lg">
                              {col}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pending Migrations */}
              <div>
                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-tight mb-2">Pending Migrations</h3>
                {status?.pendingMigrations.length === 0 ? (
                  <div className="flex items-center gap-2 text-emerald-600 text-sm py-2 px-3 bg-emerald-50 rounded-xl w-fit">
                    <CheckCircle size={16} /> Schema up to date
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {status?.pendingMigrations.map(m => (
                      <div key={m} className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 text-zinc-600 rounded-xl text-sm border border-zinc-200 font-mono">
                        <RefreshCw size={14} /> {m}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {hasIssues && (
              <div className="pt-6 border-t border-zinc-50">
                <button
                  onClick={handleFix}
                  disabled={fixing}
                  className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {fixing ? (
                    <>
                      <RefreshCw className="animate-spin" size={20} />
                      Fixing System Schema...
                    </>
                  ) : (
                    <>
                      <Check size={20} />
                      Fix Automatically (Apply Migrations)
                    </>
                  )}
                </button>
                <p className="text-center text-xs text-zinc-400 mt-4 italic">
                  * All migrations are additive and safe. No data will be deleted.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Server Info */}
        <div className="space-y-6">
          <div className="bg-zinc-900 p-6 rounded-[2rem] text-white shadow-xl">
            <h2 className="font-bold mb-4 flex items-center gap-2 text-zinc-400 uppercase text-xs tracking-widest">
              <Server size={16} /> Database Engine
            </h2>
            <div className="space-y-4">
              <div>
                <div className="text-zinc-500 text-xs mb-1">Version Info</div>
                <div className="text-sm font-mono break-words leading-relaxed text-zinc-300 bg-black/30 p-3 rounded-xl">
                  {status?.dbVersion}
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                <div className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  Status
                </div>
                <div className="text-sm font-bold uppercase tracking-wider text-emerald-500">Live</div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2rem] border border-zinc-100 shadow-sm">
            <h2 className="font-bold mb-4 flex items-center gap-2 text-zinc-400 uppercase text-xs tracking-widest leading-none">
              <ShieldCheck size={16} /> Security Info
            </h2>
            <p className="text-sm text-zinc-600 bg-zinc-50 p-3 rounded-xl leading-relaxed">
              System uses <strong>PostgreSQL 16</strong> with <strong>Bcrypt</strong> hashing for passwords and <strong>JWT</strong> for session management.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
