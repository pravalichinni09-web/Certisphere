// Simple toast utility without external dependencies
// Provides success() and error() methods that use browser alert or console

const toast = {
  success: (message: string) => {
    console.log('[SUCCESS]', message);
    // Optionally show in DOM if a toast container exists
    showToast(message, 'success');
  },
  error: (message: string) => {
    console.error('[ERROR]', message);
    showToast(message, 'error');
  },
};

// Simple DOM-based toast display
function showToast(message: string, type: 'success' | 'error') {
  // Get or create toast container
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      max-width: 300px;
    `;
    document.body.appendChild(container);
  }

  // Create toast element
  const toast = document.createElement('div');
  toast.style.cssText = `
    background: ${type === 'success' ? '#10b981' : '#ef4444'};
    color: white;
    padding: 12px 16px;
    border-radius: 6px;
    margin-bottom: 8px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    animation: slideIn 0.3s ease-out;
    font-size: 14px;
  `;
  toast.textContent = message;

  container.appendChild(toast);

  // Auto remove after 3 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Add animation styles if not present
if (!document.getElementById('toast-styles')) {
  const style = document.createElement('style');
  style.id = 'toast-styles';
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);
}

export { toast };
