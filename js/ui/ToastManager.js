/**
 * ToastManager - Displays temporary notification messages
 */
export class ToastManager {
  /**
   * Show a toast notification
   * @param {string} message - Message to display
   * @param {string} type - Toast type: 'info', 'success', 'error', 'warning'
   * @param {number} duration - Duration in milliseconds (default: 3000)
   */
  static show(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) {
      console.warn('Toast container not found');
      return;
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, duration);
  }

  /**
   * Show info toast
   * @param {string} message - Message to display
   */
  static info(message) {
    ToastManager.show(message, 'info');
  }

  /**
   * Show success toast
   * @param {string} message - Message to display
   */
  static success(message) {
    ToastManager.show(message, 'success');
  }

  /**
   * Show error toast
   * @param {string} message - Message to display
   */
  static error(message) {
    ToastManager.show(message, 'error');
  }

  /**
   * Show warning toast
   * @param {string} message - Message to display
   */
  static warning(message) {
    ToastManager.show(message, 'warning');
  }
}
