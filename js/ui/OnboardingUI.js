/**
 * Onboarding modal for first-time users
 * Shows helpful information about tools and features
 */
export class OnboardingUI {
  /**
   * Show the onboarding modal
   */
  static show() {
    if (localStorage.getItem('onboardingComplete')) return;
    
    const modal = document.createElement('div');
    modal.id = 'onboarding-modal';
    modal.innerHTML = `
      <div class="onboarding-content">
        <h2>Welcome to Leather Pattern Tool</h2>
        <div class="onboarding-steps">
          <div class="step">
            <span class="step-icon">↖️</span>
            <h3>Select</h3>
            <p>Click to select and move pattern elements</p>
          </div>
          <div class="step">
            <span class="step-icon">⭕</span>
            <h3>Hole</h3>
            <p>Add holes for rivets, snaps, or decorative elements</p>
          </div>
          <div class="step">
            <span class="step-icon">✏️</span>
            <h3>Custom Hole</h3>
            <p>Draw custom hole shapes by clicking points</p>
          </div>
          <div class="step">
            <span class="step-icon">🧵</span>
            <h3>Stitch Line</h3>
            <p>Draw stitch lines for sewing guides</p>
          </div>
          <div class="step">
            <span class="step-icon">📍</span>
            <h3>Edge Stitch</h3>
            <p>Add stitches along the pattern edge automatically</p>
          </div>
          <div class="step">
            <span class="step-icon">🔳</span>
            <h3>Full Border</h3>
            <p>Add stitches around the entire pattern perimeter</p>
          </div>
          <div class="step">
            <span class="step-icon">🔷</span>
            <h3>Shape</h3>
            <p>Add geometric shapes like circles and rectangles</p>
          </div>
          <div class="step">
            <span class="step-icon">📝</span>
            <h3>Text</h3>
            <p>Add text annotations to your pattern</p>
          </div>
        </div>
        <div class="onboarding-tips">
          <h3>Quick Tips</h3>
          <ul>
            <li><strong>Grid Snap:</strong> Enable in settings (⚙) for precise alignment</li>
            <li><strong>Layers:</strong> Toggle between Mirrored and Single layers</li>
            <li><strong>Undo/Redo:</strong> Use Ctrl+Z and Ctrl+Y</li>
            <li><strong>Publish:</strong> Click 📐 Publish when ready to print</li>
          </ul>
        </div>
        <div class="onboarding-actions">
          <button class="primary" id="onboarding-start-btn">Get Started</button>
          <label><input type="checkbox" id="dont-show-again"> Don't show again</label>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
    // Set up event listeners
    document.getElementById('onboarding-start-btn').addEventListener('click', () => {
      this.complete();
    });
    
    // Close on background click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.complete();
      }
    });
  }

  /**
   * Complete onboarding and close modal
   */
  static complete() {
    const dontShowAgain = document.getElementById('dont-show-again');
    if (dontShowAgain && dontShowAgain.checked) {
      localStorage.setItem('onboardingComplete', 'true');
    }
    const modal = document.getElementById('onboarding-modal');
    if (modal) {
      modal.remove();
    }
  }

  /**
   * Reset onboarding (for testing or user preference)
   */
  static reset() {
    localStorage.removeItem('onboardingComplete');
  }
}
