// Main entry point
import './app.js';
import { OnboardingUI } from './ui/OnboardingUI.js';
import { UIManager } from './ui/UIManager.js';
import { ErrorHandler } from './utils/ErrorHandler.js';

// Expose utilities globally for HTML onclick handlers and app.js
window.OnboardingUI = OnboardingUI;
window.UIManager = UIManager;
window.ErrorHandler = ErrorHandler;

// Application will auto-initialize via the app const at end of app.js
