/**
 * Error handler with user-friendly messages
 * Centralizes error handling and displays appropriate messages to users
 */
export class ErrorHandler {
  /**
   * Handle an error with optional user message
   * @param {Error} error - The error object
   * @param {string} context - Context where error occurred
   * @param {string} userMessage - Optional custom message for user
   */
  static handle(error, context, userMessage = null) {
    console.error(`[${context}]`, error);
    
    const message = userMessage || this.getReadableMessage(error, context);
    
    // Show toast notification if available
    if (typeof window !== 'undefined' && window.app && window.app.showToast) {
      window.app.showToast(message, 'error');
    } else {
      console.error(message);
    }
  }

  /**
   * Get a user-friendly error message based on context
   * @param {Error} error - The error object
   * @param {string} context - Context where error occurred
   * @returns {string} User-friendly error message
   */
  static getReadableMessage(error, context) {
    const messages = {
      'generateMatchingCircle': 'Could not create circle from edge. Please select an edge range first.',
      'loadProject': 'Failed to load project. The file may be corrupted.',
      'saveProject': 'Failed to save project. Please try again.',
      'exportImage': 'Failed to export image. Please try again.',
      'ClipperLib': 'Geometry library failed to load. Some features may not work correctly.',
      'referenceImage': 'Failed to load reference image. Please check the file format.',
      'calibration': 'Calibration failed. Please try again.',
      'offsetPath': 'Failed to create offset path. Check your pattern geometry.',
      'booleanOperation': 'Geometric operation failed. Your pattern may have self-intersections.',
      'fileRead': 'Failed to read file. Please check the file format.',
      'fileWrite': 'Failed to write file. Please check your browser permissions.',
      'undo': 'Cannot undo. No more history available.',
      'redo': 'Cannot redo. No more history available.',
      'deleteElement': 'Failed to delete element.',
      'duplicateElement': 'Failed to duplicate element.',
      'dragOperation': 'Drag operation failed.'
    };
    
    return messages[context] || `An error occurred in ${context}. Please try again.`;
  }

  /**
   * Handle a warning (non-critical issue)
   * @param {string} message - Warning message
   * @param {string} context - Context of warning
   */
  static warn(message, context = 'Warning') {
    console.warn(`[${context}]`, message);
    
    if (typeof window !== 'undefined' && window.app && window.app.showToast) {
      window.app.showToast(message, 'warning');
    }
  }

  /**
   * Show success message
   * @param {string} message - Success message
   */
  static success(message) {
    if (typeof window !== 'undefined' && window.app && window.app.showToast) {
      window.app.showToast(message, 'success');
    } else {
      console.log(message);
    }
  }
}
