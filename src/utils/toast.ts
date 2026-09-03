export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

export const showToast = (message: string, type: ToastType = 'success') => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('app-toast', {
        detail: {
          id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
          message,
          type,
        },
      })
    );
  }
};
