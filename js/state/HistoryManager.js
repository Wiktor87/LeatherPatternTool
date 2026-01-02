/**
 * HistoryManager - Manages undo/redo history
 * Captures and restores application state snapshots
 */
export class HistoryManager {
  /**
   * @param {Object} options - Configuration options
   * @param {number} options.maxHistory - Maximum number of history states
   * @param {Function} options.onUpdate - Callback when history changes
   */
  constructor(options = {}) {
    this.maxHistory = options.maxHistory || 50;
    this.onUpdate = options.onUpdate || (() => {});
    this.history = [];
    this.historyIndex = -1;
  }

  /**
   * Save current state to history
   * @param {Object} state - State snapshot to save
   */
  saveState(state) {
    // Remove any redo states after current position
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    // Deep clone the state
    const snapshot = JSON.parse(JSON.stringify(state));
    this.history.push(snapshot);

    // Limit history size
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    } else {
      this.historyIndex++;
    }

    this.onUpdate();
  }

  /**
   * Undo to previous state
   * @returns {Object|null} Previous state or null if none available
   */
  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.onUpdate();
      return JSON.parse(JSON.stringify(this.history[this.historyIndex]));
    }
    return null;
  }

  /**
   * Redo to next state
   * @returns {Object|null} Next state or null if none available
   */
  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.onUpdate();
      return JSON.parse(JSON.stringify(this.history[this.historyIndex]));
    }
    return null;
  }

  /**
   * Check if undo is available
   * @returns {boolean}
   */
  canUndo() {
    return this.historyIndex > 0;
  }

  /**
   * Check if redo is available
   * @returns {boolean}
   */
  canRedo() {
    return this.historyIndex < this.history.length - 1;
  }

  /**
   * Clear all history
   */
  clear() {
    this.history = [];
    this.historyIndex = -1;
    this.onUpdate();
  }

  /**
   * Get current state index
   * @returns {number}
   */
  getCurrentIndex() {
    return this.historyIndex;
  }

  /**
   * Get total number of states
   * @returns {number}
   */
  getHistoryLength() {
    return this.history.length;
  }
}
