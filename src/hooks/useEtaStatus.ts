import { useState, useEffect } from 'react';
import { apiRequest } from '../services/dbService';

/**
 * Hook to manage Electronic Invoice (ETA) connection state and previous data presence.
 * 
 * Rules:
 * 1. Columns must NOT appear if the company has never been linked to ETA and has no ETA data.
 * 2. If the company is linked to ETA, columns appear.
 * 3. If connection is lost/disconnected for any reason, but previous ETA data exists (or was previously linked),
 *    the columns and data remain visible.
 */
export function useEtaStatus(companyId?: string | null, items?: Array<any>) {
  const [isConfigured, setIsConfigured] = useState<boolean>(() => {
    if (!companyId) return false;
    return sessionStorage.getItem(`eta_configured_${companyId}`) === 'true';
  });

  const [hasServerData, setHasServerData] = useState<boolean>(() => {
    if (!companyId) return false;
    return (
      localStorage.getItem(`eta_unlocked_${companyId}`) === 'true' ||
      sessionStorage.getItem(`eta_visible_${companyId}`) === 'true'
    );
  });

  // Check if any items in the current page/dataset have ETA values
  const hasLocalData = Boolean(
    items &&
    items.length > 0 &&
    items.some(
      (item) =>
        (item.eta_uuid && String(item.eta_uuid).trim() !== '' && item.eta_uuid !== '-') ||
        (item.eta_invoice_number && String(item.eta_invoice_number).trim() !== '' && item.eta_invoice_number !== '-') ||
        (item.eta_status && String(item.eta_status).trim() !== '' && item.eta_status !== 'draft' && item.eta_status !== '-')
    )
  );

  useEffect(() => {
    if (!companyId) return;

    // If local data exists in any records, persist the unlocked state
    if (hasLocalData) {
      localStorage.setItem(`eta_unlocked_${companyId}`, 'true');
      sessionStorage.setItem(`eta_visible_${companyId}`, 'true');
      setHasServerData(true);
    }
  }, [companyId, hasLocalData]);

  useEffect(() => {
    if (!companyId) {
      setIsConfigured(false);
      setHasServerData(false);
      return;
    }

    let isMounted = true;

    const checkEtaSettings = async () => {
      try {
        const res = await apiRequest<any>('/company/eta-settings');
        if (!isMounted) return;

        const data = res?.data || res;
        const configured = Boolean(
          data &&
          data.client_id &&
          String(data.client_id).trim() !== '' &&
          (data.is_configured === true ||
           data.is_configured === 'true' ||
           data.client_secret_configured ||
           data.client_secret)
        );

        const hasDocs = Boolean(
          data?.has_documents ||
          (data?.documents_count && Number(data.documents_count) > 0)
        );

        sessionStorage.setItem(`eta_configured_${companyId}`, String(configured));
        setIsConfigured(configured);

        if (configured || hasDocs) {
          localStorage.setItem(`eta_unlocked_${companyId}`, 'true');
          sessionStorage.setItem(`eta_visible_${companyId}`, 'true');
          setHasServerData(true);
        }
      } catch (e) {
        // Retain any existing unlocked status on network failure
      }
    };

    checkEtaSettings();

    const handleUpdate = () => {
      checkEtaSettings();
    };

    window.addEventListener('eta_settings_updated', handleUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener('eta_settings_updated', handleUpdate);
    };
  }, [companyId]);

  const showEtaColumns = Boolean(isConfigured || hasServerData || hasLocalData);

  return {
    isConfigured,
    hasEtaData: Boolean(hasServerData || hasLocalData),
    showEtaColumns
  };
}
