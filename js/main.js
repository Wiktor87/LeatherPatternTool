// Main entry point
import './app.js';
import { OnboardingUI } from './ui/OnboardingUI.js';

// Expose OnboardingUI globally for HTML onclick handlers
window.OnboardingUI = OnboardingUI;

// Application will auto-initialize via the app const at end of app.js
