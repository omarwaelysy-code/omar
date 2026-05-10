import { useState, useEffect } from 'react';

export type ViewType = 'table' | 'card';

export function useViewPreference(key: string, defaultView: ViewType = 'table') {
  const [view, setView] = useState<ViewType>(() => {
    const saved = localStorage.getItem(`view_pref_${key}`);
    return (saved as ViewType) || defaultView;
  });

  useEffect(() => {
    localStorage.setItem(`view_pref_${key}`, view);
  }, [view, key]);

  return [view, setView] as const;
}
