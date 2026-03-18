/** Telegram WebApp haptic feedback wrappers */

function getWebApp(): any {
  return (window as any).Telegram?.WebApp;
}

export function hapticLight() {
  getWebApp()?.HapticFeedback?.impactOccurred('light');
}

export function hapticMedium() {
  getWebApp()?.HapticFeedback?.impactOccurred('medium');
}

export function hapticHeavy() {
  getWebApp()?.HapticFeedback?.impactOccurred('heavy');
}

export function hapticSuccess() {
  getWebApp()?.HapticFeedback?.notificationOccurred('success');
}

export function hapticError() {
  getWebApp()?.HapticFeedback?.notificationOccurred('error');
}

export function hapticWarning() {
  getWebApp()?.HapticFeedback?.notificationOccurred('warning');
}
