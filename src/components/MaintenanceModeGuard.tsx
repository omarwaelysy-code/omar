import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { MaintenanceService } from '../services/MaintenanceService';
import { SystemConfig } from '../types';
import { Shield, Hammer, Clock, AlertTriangle } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

export const MaintenanceModeGuard: React.FC<Props> = ({ children }) => {
  const { user, loading } = useAuth();
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkMaintenance = async () => {
      const status = await MaintenanceService.getStatus();
      setConfig(status);
      setChecking(false);
    };

    checkMaintenance();
    // Poll every 30 seconds for state changes
    const interval = setInterval(checkMaintenance, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading || checking) return null;

  const isBypassed = user && (user.role === 'super_admin' || config?.allowed_users.includes(user.id));

  if (config?.maintenance_mode && !isBypassed) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="space-y-8 max-w-md">
          <div className="relative inline-block">
            <div className="w-24 h-24 bg-amber-50 rounded-[32px] flex items-center justify-center text-amber-500 animate-pulse">
              <Hammer size={48} />
            </div>
            <div className="absolute -top-2 -right-2 w-10 h-10 bg-zinc-900 border-4 border-zinc-50 rounded-2xl flex items-center justify-center text-white">
              <Clock size={18} />
            </div>
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl font-black text-zinc-900 uppercase tracking-tighter leading-none">
              System In Maintenance
            </h1>
            <p className="text-zinc-600 font-medium leading-relaxed">
              {config.maintenance_message || "We're currently performing scheduled updates to improve your ERP experience. We'll be back shortly."}
            </p>
          </div>

          <div className="p-4 bg-white border border-zinc-200 rounded-3xl shadow-sm space-y-3">
            <div className="flex items-center gap-2 justify-center text-zinc-400 font-bold text-xs uppercase tracking-widest">
              <AlertTriangle size={14} />
              Estimated Downtime
            </div>
            <div className="text-2xl font-black text-zinc-900">~ 15 Minutes</div>
          </div>

          <div className="pt-8">
            <p className="text-[10px] text-zinc-400 font-black uppercase tracking-[0.2em]">
              Official ERP V2 Baseline • Security Cluster ACTIVE
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
