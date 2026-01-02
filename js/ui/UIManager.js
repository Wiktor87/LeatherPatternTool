/**
 * UI Manager for coordinating UI state and operations
 * Provides helpers for loading states, modals, and UI updates
 */
export class UIManager {
  /**
   * Show loading overlay
   * @param {string} message - Loading message to display
   */
  static showLoading(message = 'Loading...') {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      const text = overlay.querySelector('.loading-text');
      if (text) {
        text.textContent = message;
      }
      overlay.style.display = 'flex';
    }
  }

  /**
   * Hide loading overlay
   */
  static hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
  }

  /**
   * Update element visibility
   * @param {string} elementId - Element ID
   * @param {boolean} visible - Whether element should be visible
   */
  static setVisible(elementId, visible) {
    const el = document.getElementById(elementId);
    if (el) {
      el.style.display = visible ? '' : 'none';
    }
  }

  /**
   * Update element enabled state
   * @param {string} elementId - Element ID
   * @param {boolean} enabled - Whether element should be enabled
   */
  static setEnabled(elementId, enabled) {
    const el = document.getElementById(elementId);
    if (el) {
      el.disabled = !enabled;
    }
  }

  /**
   * Update element text content
   * @param {string} elementId - Element ID
   * @param {string} text - New text content
   */
  static setText(elementId, text) {
    const el = document.getElementById(elementId);
    if (el) {
      el.textContent = text;
    }
  }

  /**
   * Update input element value
   * @param {string} elementId - Element ID
   * @param {*} value - New value
   */
  static setValue(elementId, value) {
    const el = document.getElementById(elementId);
    if (el) {
      if (el.type === 'checkbox') {
        el.checked = value;
      } else {
        el.value = value;
      }
    }
  }

  /**
   * Toggle element class
   * @param {string} elementId - Element ID
   * @param {string} className - Class name to toggle
   * @param {boolean} force - Force add (true) or remove (false)
   */
  static toggleClass(elementId, className, force = undefined) {
    const el = document.getElementById(elementId);
    if (el) {
      if (force !== undefined) {
        el.classList.toggle(className, force);
      } else {
        el.classList.toggle(className);
      }
    }
  }

  /**
   * Add class to element
   * @param {string} elementId - Element ID
   * @param {string} className - Class name to add
   */
  static addClass(elementId, className) {
    const el = document.getElementById(elementId);
    if (el) {
      el.classList.add(className);
    }
  }

  /**
   * Remove class from element
   * @param {string} elementId - Element ID
   * @param {string} className - Class name to remove
   */
  static removeClass(elementId, className) {
    const el = document.getElementById(elementId);
    if (el) {
      el.classList.remove(className);
    }
  }
}
