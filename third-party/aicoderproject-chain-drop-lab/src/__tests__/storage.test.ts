import { describe, it, expect, beforeEach } from 'vitest';
import { SafeStorage } from '../game/storage';

describe('SafeStorage', () => {
  beforeEach(() => {
    SafeStorage.clear();
  });

  it('should set and get items correctly', () => {
    SafeStorage.setItem('test_key', 'test_value');
    expect(SafeStorage.getItem('test_key')).toBe('test_value');
  });

  it('should remove items correctly', () => {
    SafeStorage.setItem('test_key', 'test_value');
    SafeStorage.removeItem('test_key');
    expect(SafeStorage.getItem('test_key')).toBeNull();
  });

  it('should clear all items correctly', () => {
    SafeStorage.setItem('key1', 'val1');
    SafeStorage.setItem('key2', 'val2');
    SafeStorage.clear();
    expect(SafeStorage.getItem('key1')).toBeNull();
    expect(SafeStorage.getItem('key2')).toBeNull();
  });

  it('should fallback to in-memory store if localStorage throws or is unsupported', () => {
    // Force fallback mode by overriding isSupported
    const originalIsSupported = SafeStorage.isSupported;
    SafeStorage.isSupported = () => false;

    SafeStorage.setItem('fallback_key', 'fallback_val');
    expect(SafeStorage.getItem('fallback_key')).toBe('fallback_val');

    SafeStorage.isSupported = originalIsSupported;
  });
});
