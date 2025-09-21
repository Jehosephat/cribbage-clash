import type { AccessibilitySettings } from './types';

const STORAGE_KEY = 'cribbage-clash:accessibility';

const defaultSettings: AccessibilitySettings = {
  highContrast: false,
  largeText: false,
  colorSafeSuits: true
};

let settings: AccessibilitySettings = loadSettings();

const listeners = new Set<(value: AccessibilitySettings) => void>();

function loadSettings(): AccessibilitySettings {
  if (typeof window === 'undefined' || !('localStorage' in window)) {
    return { ...defaultSettings };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...defaultSettings };
    }
    const parsed = JSON.parse(raw) as Partial<AccessibilitySettings>;
    return { ...defaultSettings, ...parsed };
  } catch (error) {
    console.warn('Failed to read accessibility settings', error);
    return { ...defaultSettings };
  }
}

function persistSettings(): void {
  if (typeof window === 'undefined' || !('localStorage' in window)) {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn('Failed to persist accessibility settings', error);
  }
}

export function getAccessibilitySettings(): AccessibilitySettings {
  return settings;
}

export function updateAccessibilitySettings(update: Partial<AccessibilitySettings>): void {
  settings = { ...settings, ...update };
  persistSettings();
  listeners.forEach((listener) => listener(settings));
}

export function onAccessibilitySettingsChange(
  listener: (value: AccessibilitySettings) => void
): () => void {
  listeners.add(listener);
  listener(settings);
  return () => {
    listeners.delete(listener);
  };
}

export function resetAccessibilitySettings(): void {
  settings = { ...defaultSettings };
  persistSettings();
  listeners.forEach((listener) => listener(settings));
}
