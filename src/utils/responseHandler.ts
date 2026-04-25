import { useNotification } from '../contexts/NotificationContext';

export interface PostSaveAction {
  name: string;
  action: () => Promise<void>;
}

export const useResponseHandler = () => {
  const { showNotification } = useNotification();

  const handleResponse = async (
    operation: () => Promise<any>,
    successMessage: string,
    onSuccess?: (result: any) => void,
    postSaveActions: PostSaveAction[] = []
  ) => {
    try {
      const result = await operation();
      
      // Success immediate feedback
      showNotification(successMessage, 'success');
      if (onSuccess) onSuccess(result);

      // Background actions
      if (postSaveActions.length > 0) {
        // We don't await the whole set if we want them in background, 
        // but often we want them to finish but just not fail the UI.
        Promise.all(postSaveActions.map(async (psa) => {
          try {
            await psa.action();
          } catch (err) {
            console.error(`Post-save action failed [${psa.name}]:`, err);
          }
        })).catch(err => console.error('Overall post-save failure:', err));
      }

      return result;
    } catch (error: any) {
      console.error('Operation failed:', error);
      showNotification('حدث خطأ أثناء حفظ البيانات', 'error');
      throw error;
    }
  };

  return { handleResponse };
};
