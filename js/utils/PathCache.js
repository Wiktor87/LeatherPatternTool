/**
 * Path caching for performance optimization
 * Caches computed paths and invalidates when geometry changes
 */
export class PathCache {
  constructor() {
    this.cache = new Map();
    this.invalidated = true;
  }

  /**
   * Get a cached value or compute it
   * @param {string} key - Cache key
   * @param {Function} computeFn - Function to compute value if not cached
   * @returns {*} Cached or computed value
   */
  get(key, computeFn) {
    if (this.invalidated || !this.cache.has(key)) {
      this.cache.set(key, computeFn());
    }
    return this.cache.get(key);
  }

  /**
   * Invalidate the cache (call when geometry changes)
   */
  invalidate() {
    this.invalidated = true;
  }

  /**
   * Validate the cache (call after recomputing paths)
   */
  validate() {
    this.invalidated = false;
  }

  /**
   * Clear all cached values
   */
  clear() {
    this.cache.clear();
    this.invalidated = true;
  }

  /**
   * Remove a specific cached value
   * @param {string} key - Cache key to remove
   */
  remove(key) {
    this.cache.delete(key);
  }

  /**
   * Check if a key is cached
   * @param {string} key - Cache key to check
   * @returns {boolean} True if key is cached
   */
  has(key) {
    return !this.invalidated && this.cache.has(key);
  }
}
