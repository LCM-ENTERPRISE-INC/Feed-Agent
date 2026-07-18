import toast from 'react-hot-toast';
import axios from 'axios';

/**
 * Robust notification wrappers aligning with Feed-Agent's Design System
 */
export const showToast = {
  success: (message: string) => {
    toast.success(message, {
      className: 'glass-toast',
      iconTheme: {
        primary: 'var(--success)',
        secondary: 'var(--surface)',
      },
    });
  },

  error: (error: unknown, fallbackMessage = 'Ocorreu um erro inesperado de rede.') => {
    let errorMessage = fallbackMessage;

    if (axios.isAxiosError(error)) {
      // Try to extract backend error messages (Prisma or Express payloads)
      const data = error.response?.data as { message?: string; error?: string } | undefined;
      if (data?.message) {
        errorMessage = data.message;
      } else if (data?.error) {
        errorMessage = data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    toast.error(errorMessage, {
      className: 'glass-toast',
      iconTheme: {
        primary: 'var(--error)',
        secondary: 'var(--surface)',
      },
    });
  },

  info: (message: string) => {
    toast(message, {
      className: 'glass-toast',
      icon: 'ℹ️',
    });
  },
};

export default showToast;
