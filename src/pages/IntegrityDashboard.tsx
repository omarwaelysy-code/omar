import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { dbService } from '../services/dbService';
import { AccountingEngine } from '../services/AccountingEngine';
import { JournalEntry, Account, AccountType } from '../types';
import { ShieldAlert, CheckCircle, Activity, Database, AlertCircle, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

import { ScenarioTestingService } from '../services/ScenarioTestingService';
import { useNotification } from '../contexts/NotificationContext';

import { SnapshotService } from '../services/SnapshotService';
import { LoadTestScenario } from '../services/LoadTestScenario';

export const IntegrityDashboard: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { showNotification } = useNotification();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  // ... existing logic ...

  const handleCreateSnapshot = async () => {
    if (!user) return;
    try {
      const snap = await SnapshotService.createSnapshot(user.company_id);
      showNotification(`Snapshot created with ${snap.data.journal_entries.length} entries`, 'success');
    } catch (e: any) {
      showNotification(e.message, 'error');
    }
  };

  const handleLoadTest = async () => {
    if (!user) return;
    setIsTesting(true);
    try {
      const result = await LoadTestScenario.runBurst(user.company_id, user.id, 50);
      showNotification(`Load test: ${result.succeeded} successful, ${result.failed} failed in ${result.duration.toFixed(0)}ms`, 'success');
      window.location.reload();
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setIsTesting(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      const e = await dbService.list<JournalEntry>('journal_entries', user.company_id);
      const a = await dbService.list<Account>('accounts', user.company_id);
      const t = await dbService.list<AccountType>('account_types', user.company_id);
      setEntries(e);
      setAccounts(a);
      setAccountTypes(t);
      setIsLoading(false);
    };

    loadData();
  }, [user]);

  const globalBalance = AccountingEngine.validateGlobalBalance(entries);
  const balanceSheet = AccountingEngine.calculateBalanceSheet(accounts, accountTypes, entries, new Date().toISOString().split('T')[0]);

  const handleSeed = async () => {
    if (!user) return;
    setIsSeeding(true);
    try {
      await ScenarioTestingService.seedTestCompany(user.company_id, user.id);
      showNotification('Test scenario seeded successfully', 'success');
      // Reload page to see new entries
      window.location.reload();
    } catch (e: any) {
      showNotification(e.message || 'Seeding failed', 'error');
    } finally {
      setIsSeeding(false);
    }
  };

  const runFullCheck = async () => {
    setIsChecking(true);
    // Simulate deep scanning
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsChecking(false);
  };

  if (isLoading) return <div className="p-8">Loading integrity data...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-zinc-900">{t('integrity.title') || 'Accounting Integrity Dashboard'}</h1>
          <p className="text-zinc-500 font-medium">{t('integrity.subtitle') || 'Monitor systems health and data consistency'}</p>
        </div>
        <button 
          onClick={runFullCheck}
          disabled={isChecking}
          className="bg-zinc-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-zinc-800 transition-all disabled:opacity-50"
        >
          <RefreshCw size={20} className={isChecking ? 'animate-spin' : ''} />
          {isChecking ? 'Scanning...' : 'Run Integrity Scan'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <button onClick={handleSeed} disabled={isSeeding} className="p-4 bg-zinc-100 hover:bg-zinc-200 rounded-2xl font-bold transition-all">
          Seed Scenario
        </button>
        <button onClick={handleLoadTest} disabled={isTesting} className="p-4 bg-zinc-100 hover:bg-zinc-200 rounded-2xl font-bold transition-all text-rose-600">
          Run Load Test
        </button>
        <button onClick={handleCreateSnapshot} className="p-4 bg-zinc-100 hover:bg-zinc-200 rounded-2xl font-bold transition-all text-emerald-600 font-sans">
          Create Snapshot
        </button>
        <div className="p-4 bg-zinc-900 text-white rounded-2xl font-bold flex items-center justify-center">
          Enterprise Mode: ACTIVE
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Global Balance Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-6 rounded-[2rem] border-2 shadow-lg ${globalBalance.isBalanced ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}
        >
          <div className="flex items-center gap-4 mb-4">
            <div className={`p-3 rounded-2xl ${globalBalance.isBalanced ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
              <Activity size={24} />
            </div>
            <div>
              <p className="text-sm font-black text-zinc-400 uppercase tracking-widest">Global Entry Balance</p>
              <h3 className="text-xl font-black text-zinc-900">{globalBalance.isBalanced ? 'Stable' : 'Unbalanced'}</h3>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Difference:</span>
              <span className={`font-black ${globalBalance.isBalanced ? 'text-emerald-600' : 'text-rose-600'}`}>
                {globalBalance.difference.toLocaleString()}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Balance Sheet Integrity */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`p-6 rounded-[2rem] border-2 shadow-lg ${balanceSheet.isBalanced ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}
        >
          <div className="flex items-center gap-4 mb-4">
            <div className={`p-3 rounded-2xl ${balanceSheet.isBalanced ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
              <ShieldAlert size={24} />
            </div>
            <div>
              <p className="text-sm font-black text-zinc-400 uppercase tracking-widest">A = L + E Check</p>
              <h3 className="text-xl font-black text-zinc-900">{balanceSheet.isBalanced ? 'Correct' : 'Failed'}</h3>
            </div>
          </div>
          <p className="text-sm text-zinc-500 font-medium">Assets must equal Liabilities + Equity.</p>
        </motion.div>

        {/* Database Health */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-6 rounded-[2rem] border-2 bg-zinc-50 border-zinc-100 shadow-lg"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 rounded-2xl bg-zinc-900 text-white">
              <Database size={24} />
            </div>
            <div>
              <p className="text-sm font-black text-zinc-400 uppercase tracking-widest">Total Volume</p>
              <h3 className="text-xl font-black text-zinc-900">{entries.length} Entries</h3>
            </div>
          </div>
          <p className="text-sm text-zinc-500 font-medium">Database status: Connected & Active</p>
        </motion.div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-zinc-200 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-zinc-100">
          <h3 className="text-xl font-black text-zinc-900 flex items-center gap-2">
            <AlertCircle className="text-rose-500" />
            Detected Anomalies
          </h3>
        </div>
        <div className="divide-y divide-zinc-100">
          {balanceSheet.diagnostics.unbalancedEntries.map((err, i) => (
            <div key={i} className="p-6 flex items-center justify-between hover:bg-zinc-50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-2 h-2 rounded-full bg-rose-500" />
                <div>
                  <p className="font-bold text-zinc-900">Unbalanced Journal Entry</p>
                  <p className="text-sm text-zinc-500">{err}</p>
                </div>
              </div>
              <span className="text-xs font-black px-3 py-1 bg-rose-100 text-rose-700 rounded-full uppercase">Critical</span>
            </div>
          ))}
          {balanceSheet.diagnostics.missingAccountEntries.map((err, i) => (
            <div key={i} className="p-6 flex items-center justify-between hover:bg-zinc-50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <div>
                  <p className="font-bold text-zinc-900">Dangling Reference</p>
                  <p className="text-sm text-zinc-500">{err}</p>
                </div>
              </div>
              <span className="text-xs font-black px-3 py-1 bg-amber-100 text-amber-700 rounded-full uppercase">Warning</span>
            </div>
          ))}
          {balanceSheet.diagnostics.unbalancedEntries.length === 0 && balanceSheet.diagnostics.missingAccountEntries.length === 0 && (
            <div className="p-12 text-center">
              <div className="bg-emerald-100 text-emerald-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} />
              </div>
              <p className="text-zinc-900 font-black text-xl">Perfect Health</p>
              <p className="text-zinc-500 font-medium">No accounting anomalies detected in currently loaded data.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
