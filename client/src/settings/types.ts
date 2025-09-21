export interface AccessibilitySettings {
  highContrast: boolean;
  largeText: boolean;
  colorSafeSuits: boolean;
}

export function getFontScale(settings: AccessibilitySettings): number {
  return settings.largeText ? 1.25 : 1;
}
