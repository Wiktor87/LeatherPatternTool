// Main entry point
import './app.js';
import { OnboardingUI } from './ui/OnboardingUI.js';
import { ErrorHandler } from './utils/ErrorHandler.js';

// Expose utilities globally for HTML onclick handlers and app.js
window.OnboardingUI = OnboardingUI;
window.ErrorHandler = ErrorHandler;

// Application will auto-initialize via the app const at end of app.js
