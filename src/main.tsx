import {Component, ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { NavigationProvider } from './contexts/NavigationContext';
import { LanguageProvider } from './contexts/LanguageContext';

class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: {children: ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center" dir="rtl">
          <h1 className="text-2xl font-bold text-red-600 mb-4">عذراً، حدث خطأ ما.</h1>
          <div className="bg-stone-100 p-4 rounded-lg mb-6 max-w-lg overflow-auto text-left">
            <pre className="text-sm text-stone-700 whitespace-pre-wrap">
              {this.state.error?.toString()}
            </pre>
          </div>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-emerald-700 transition-colors"
          >
            إعادة تحميل الصفحة
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <LanguageProvider>
      <AuthProvider>
        <NavigationProvider>
          <NotificationProvider>
            <App />
          </NotificationProvider>
        </NavigationProvider>
      </AuthProvider>
    </LanguageProvider>
  </ErrorBoundary>
);
