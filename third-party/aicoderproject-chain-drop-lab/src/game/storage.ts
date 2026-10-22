export class SafeStorage {
  private static fallbackStore: Record<string, string> = {};

  public static isSupported(): boolean {
    try {
      const testKey = '__storage_test__';
      window.localStorage.setItem(testKey, testKey);
      window.localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  public static getItem(key: string): string | null {
    if (this.isSupported()) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return this.fallbackStore[key] || null;
      }
    }
    return this.fallbackStore[key] || null;
  }

  public static setItem(key: string, value: string): void {
    if (this.isSupported()) {
      try {
        window.localStorage.setItem(key, value);
        return;
      } catch {
        // Fall through to memory fallback
      }
    }
    this.fallbackStore[key] = value;
  }

  public static removeItem(key: string): void {
    if (this.isSupported()) {
      try {
        window.localStorage.removeItem(key);
        return;
      } catch {
        // Fall through
      }
    }
    delete this.fallbackStore[key];
  }

  public static clear(): void {
    if (this.isSupported()) {
      try {
        window.localStorage.clear();
        return;
      } catch {
        // Fall through
      }
    }
    this.fallbackStore = {};
  }
}
