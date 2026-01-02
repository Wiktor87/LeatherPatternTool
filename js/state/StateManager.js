/**
 * Central state manager with pub/sub pattern
 * Manages all application state and notifies subscribers of changes
 */
export class StateManager {
  constructor() {
    this.state = {
      mode: 'select',
      layer: 'symmetric',
      currentLayer: 'front', // for two-layer mode
      selected: null,
      hover: null,
      view: { x: 0, y: 0, zoom: 1 },
      publishMode: false,
      settingsOpen: false,
      outlinerOpen: false,
      shiftHeld: false,
      isPanning: false,
      drag: { active: false },
      tempStitch: null,
      tempShape: null,
      tempCustomHole: null,
      // Two-layer mode state
      frontLayer: null,
      backLayer: null,
      ghostOffset: { x: 0, y: 0 },
      // Reference image state
      refImage: {
        img: null,
        x: 0,
        y: 0,
        scale: 1,
        width: 0,
        height: 0,
        calibrating: false,
        calPt1: null,
        calPt2: null
      },
      // Publish mode state
      publishView: { x: 0, y: 0, scale: 1 }
    };
    this.listeners = new Map();
  }

  /**
   * Get a state value by key
   * @param {string} key - State key
   * @returns {*} State value
   */
  get(key) {
    return this.state[key];
  }

  /**
   * Set a state value and notify subscribers
   * @param {string} key - State key
   * @param {*} value - New value
   */
  set(key, value) {
    const oldValue = this.state[key];
    this.state[key] = value;
    this.notify(key, value, oldValue);
  }

  /**
   * Update multiple state values at once
   * @param {Object} updates - Object with key-value pairs to update
   */
  update(updates) {
    Object.entries(updates).forEach(([key, value]) => {
      this.set(key, value);
    });
  }

  /**
   * Subscribe to state changes
   * @param {string} key - State key to watch
   * @param {Function} callback - Callback function (newValue, oldValue) => void
   * @returns {Function} Unsubscribe function
   */
  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, []);
    }
    this.listeners.get(key).push(callback);
    return () => this.unsubscribe(key, callback);
  }

  /**
   * Unsubscribe from state changes
   * @param {string} key - State key
   * @param {Function} callback - Callback function to remove
   */
  unsubscribe(key, callback) {
    if (!this.listeners.has(key)) return;
    const callbacks = this.listeners.get(key);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  /**
   * Notify all subscribers of a state change
   * @param {string} key - State key that changed
   * @param {*} newValue - New value
   * @param {*} oldValue - Previous value
   */
  notify(key, newValue, oldValue) {
    const callbacks = this.listeners.get(key) || [];
    callbacks.forEach(cb => {
      try {
        cb(newValue, oldValue);
      } catch (error) {
        console.error(`Error in state listener for ${key}:`, error);
      }
    });
  }

  /**
   * Get all state keys
   * @returns {string[]} Array of state keys
   */
  keys() {
    return Object.keys(this.state);
  }

  /**
   * Get entire state object (for debugging)
   * @returns {Object} Current state
   */
  getAll() {
    return { ...this.state };
  }
}

// Create singleton instance
export const state = new StateManager();
