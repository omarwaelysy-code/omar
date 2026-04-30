import React from 'react';
import { AlertCircle, Settings, Database } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface DatabaseErrorProps {
  error?: string;
}

const DatabaseError: React.FC<DatabaseErrorProps> = ({ error }) => {
  const { t } = useLanguage();
  
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-red-100">
        <div className="flex items-center justify-center w-16 h-16 bg-red-50 rounded-full mb-6 mx-auto">
          <AlertCircle className="w-8 h-8 text-red-600" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
          {t('database.error_title')}
        </h1>
        <p className="text-gray-600 text-center mb-8">
          {t('database.error_desc')}
        </p>

        <div className="bg-gray-50 rounded-xl p-4 mb-8 space-y-3">
          <div className="flex items-start gap-3">
            <Settings className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-900">{t('database.solution_title')}</p>
              <p className="text-sm text-gray-600">
                {t('database.solution_desc')}
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-white p-3 rounded border border-gray-200 text-left">
            <span className="text-blue-700">DB_HOST</span>
            <span className="text-gray-400">{t('database.host')}</span>
            <span className="text-blue-700">DB_USER</span>
            <span className="text-gray-400">{t('database.user')}</span>
            <span className="text-blue-700">DB_PASSWORD</span>
            <span className="text-gray-400">{t('database.password')}</span>
            <span className="text-blue-700">DB_NAME</span>
            <span className="text-gray-400">{t('database.name')}</span>
          </div>
        </div>

        {error && (
          <div className="mb-8 p-3 bg-red-50 rounded border border-red-100 text-xs font-mono text-red-700 overflow-auto max-h-32">
            {error}
          </div>
        )}

        <button 
          onClick={() => window.location.reload()}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <Database className="w-5 h-5" />
          {t('common.retry')}
        </button>
        
        <p className="mt-6 text-center text-xs text-gray-400">
          {t('database.localhost_warning')}
        </p>
      </div>
    </div>
  );
};

export default DatabaseError;
