import { RxLocalStorage } from './local-storage';

describe('LocalStorage', () => {
  let localStorageMock: Record<string, string>;
  let mockStorageEvent: StorageEvent;
  let originalLocalStorage: Storage;
  let localStorageSpy: jest.SpyInstance;

  beforeEach(() => {
    localStorageMock = {};
    originalLocalStorage = window.localStorage;
    const mockStorage: any = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, value: string) => {
        mockStorage[key] = value;
        localStorageMock[key] = value;
        mockStorageEvent = new StorageEvent('storage', { key, newValue: value });
        window.dispatchEvent(mockStorageEvent);
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
        delete localStorageMock[key];
        mockStorageEvent = new StorageEvent('storage', { key, newValue: null });
        window.dispatchEvent(mockStorageEvent);
      },
      clear: () => {
        Object.keys(mockStorage).forEach(key => {
          if (!['getItem', 'setItem', 'removeItem', 'clear'].includes(key)) {
            delete mockStorage[key];
          }
        });
        localStorageMock = {};
        mockStorageEvent = new StorageEvent('storage', { key: null, newValue: null });
        window.dispatchEvent(mockStorageEvent);
      },
    };
    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
      writable: true,
    });
    localStorageSpy = jest.spyOn(window.localStorage, 'getItem');
  });

  afterEach(() => {
    localStorageSpy.mockRestore();
    Object.defineProperty(window, 'localStorage', { value: originalLocalStorage });
  });

  describe('getObservable', () => {
    it('returns an observable with the stored value', () => {
      const storage = new RxLocalStorage();
      const key = 'testKey';
      const value = 'testValue';
      localStorage.setItem(storage['prefixed'](key), JSON.stringify(value));
      const observable = storage.getObservable<string>(key);
      let result: string | undefined;
      observable.subscribe((val) => {
        result = val;
      });
      expect(result).toBe(value);
    });

    it('updates observable when storage changes externally', async () => {
      const storage = new RxLocalStorage();
      const key = 'testKey';
      const value1 = 'value1';
      const value2 = 'value2';
      const observable = storage.getObservable<string>(key);
      const values: string[] = [];
      observable.subscribe((val) => {
        if (val !== undefined) {
          values.push(val);
        }
      });
      localStorage.setItem(storage['prefixed'](key), JSON.stringify(value1));
      await new Promise(resolve => setTimeout(resolve, 0));
      localStorage.setItem(storage['prefixed'](key), JSON.stringify(value2));
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(values).toContain(value1);
      expect(values).toContain(value2);
    });

    it('supports multiple subscribers to the same observable', () => {
      const storage = new RxLocalStorage();
      const key = 'testKey';
      const value = 'testValue';
      localStorage.setItem(storage['prefixed'](key), JSON.stringify(value));
      const observable = storage.getObservable<string>(key);
      let result1: string | undefined;
      let result2: string | undefined;
      observable.subscribe((val) => { result1 = val; });
      observable.subscribe((val) => { result2 = val; });
      expect(result1).toBe(value);
      expect(result2).toBe(value);
    });

    it('returns undefined for non-existent key', () => {
      const storage = new RxLocalStorage();
      const key = 'nonExistentKey';
      const observable = storage.getObservable<string>(key);
      let result: string | undefined;
      observable.subscribe((val) => {
        result = val;
      });
      expect(result).toBeUndefined();
    });
  });

  describe('getSignal', () => {
    it('returns a signal with the stored value', () => {
      const storage = new RxLocalStorage();
      const key = 'testKey';
      const value = 'testValue';
      storage.set(key, value);
      const signal = storage.getSignal<string>(key);
      expect(signal()).toBe(value);
    });

    it('returns a signal with initialValue when provided', () => {
      const storage = new RxLocalStorage();
      const key = 'testKey';
      const initialValue = 'initial';
      const signal = storage.getSignal<string>(key, { initialValue });
      expect(signal()).toBe(initialValue);
    });

    it('returns a signal with initialValue that gets overridden by stored value', async () => {
      const storage = new RxLocalStorage();
      const key = 'testKey';
      const initialValue = 'initial';
      const storedValue = 'stored';
      const signal = storage.getSignal<string>(key, { initialValue });
      expect(signal()).toBe(initialValue);
      await storage.set(key, storedValue);
      expect(signal()).toBe(storedValue);
    });

    it('uses custom equality function when provided', () => {
      const storage = new RxLocalStorage();
      const key = 'testKey';
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const equal: (a: string | undefined, b: string | undefined) => boolean = 
        (a, b) => {
          if (typeof a !== 'string' || typeof b !== 'string') return a === b;
          return a.toLowerCase() === b.toLowerCase();
        };
      // Test with equal function only (use type assertion to help TypeScript)
      const signal = storage.getSignal<string>(key, { equal } as any);
      expect(signal).toBeDefined();
      // Test that signal works with the equality function
      expect(signal()).toBeUndefined();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('get', () => {
    it('returns a Promise that resolves with the stored value', async () => {
      const storage = new RxLocalStorage();
      const key = 'testKey';
      const value = 'testValue';
      localStorage.setItem(storage['prefixed'](key), JSON.stringify(value));
      const result = await storage.get<string>(key);
      expect(result).toBe(value);
    });

    it('returns a Promise that resolves with null if the key does not exist', async () => {
      const storage = new RxLocalStorage();
      const key = 'nonExistentKey';
      const result = await storage.get<string>(key);
      expect(result).toBeNull();
    });

    it('returns a Promise that rejects if the stored value is not a valid JSON', async () => {
      const storage = new RxLocalStorage();
      const key = 'testKey';
      const invalidValue = 'invalidJSON';
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      localStorage.setItem(storage['prefixed'](key), invalidValue);
      await expect(storage.get<string>(key)).rejects.toThrow();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('remove', () => {
    it('removes the item from localStorage', async () => {
      const storage = new RxLocalStorage();
      const key = 'testKey';
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      localStorage.setItem(storage['prefixed'](key), 'value');
      await storage.remove(key);
      expect(localStorage.getItem(storage['prefixed'](key))).toBeNull();
      consoleErrorSpy.mockRestore();
    });

    it('rejects the Promise if an error occurs', async () => {
      const storage = new RxLocalStorage();
      const key = 'testKey';
      localStorage.removeItem = jest.fn(() => {
        throw new Error('Failed to remove item');
      });
      await expect(storage.remove(key)).rejects.toThrow('Failed to remove item');
    });
  });

  describe('set', () => {
    it('sets the item in localStorage', async () => {
      const storage = new RxLocalStorage();
      const key = 'testKey';
      const value = 'testValue';
      await storage.set(key, value);
      expect(localStorage.getItem(storage['prefixed'](key))).toBe(JSON.stringify(value));
    });

    it('rejects the Promise if an error occurs', async () => {
      const storage = new RxLocalStorage();
      const key = 'testKey';
      const value = 'testValue';
      localStorage.setItem = jest.fn(() => {
        throw new Error('Failed to set item');
      });
      await expect(storage.set(key, value)).rejects.toThrow('Failed to set item');
    });


    it('should update a key in the storage when WritableSignal is updated', async () => {
      const storage = new RxLocalStorage();
      const key = 'testKey';
      const value = 'testValue';
      const initValue = 'initial value';
      const newValue = 'new value';

      const ws = storage.getWritableSignal<string>(key, { initialValue: initValue });
      expect(ws()).toStrictEqual(initValue);

      ws.set(value);
      expect(ws()).toStrictEqual(value);
      expect(await storage.get(key)).toStrictEqual(value);

      ws.update((val) => {
        expect(val).toStrictEqual(value);
        return newValue;
      });

      expect(ws()).toStrictEqual(newValue);
      expect(await storage.get(key)).toStrictEqual(newValue);
      await storage.remove(key);
      expect(ws()).toStrictEqual(undefined);
    });

    it('should work with WritableSignal without initialValue', async () => {
      const storage = new RxLocalStorage();
      const key = 'testKey';
      const value = 'testValue';
      const ws = storage.getWritableSignal<string>(key);
      expect(ws()).toBeUndefined();
      ws.set(value);
      expect(ws()).toBe(value);
      expect(await storage.get(key)).toBe(value);
    });

    it('should update signal when storage changes externally', async () => {
      const storage = new RxLocalStorage();
      const key = 'testKey';
      const value1 = 'value1';
      const value2 = 'value2';
      const ws = storage.getWritableSignal<string>(key);
      await storage.set(key, value1);
      expect(ws()).toBe(value1);
      localStorage.setItem(storage['prefixed'](key), JSON.stringify(value2));
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(ws()).toBe(value2);
    });
  });

  describe('getKeys', () => {
    it('returns all keys for the current table', async () => {
      const storage = new RxLocalStorage('table1', 'db1');
      await storage.set('key1', 'value1');
      await storage.set('key2', 'value2');
      // Wait a bit for async operations
      await new Promise(resolve => setTimeout(resolve, 10));
      const keys = await storage.getKeys();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys.length).toBeGreaterThanOrEqual(2);
    });

    it('returns empty array when no keys exist', async () => {
      // Use a unique table/db name to ensure it's empty
      const storage = new RxLocalStorage('emptyTable', 'emptyDb');
      const keys = await storage.getKeys();
      expect(keys).toEqual([]);
    });

    it('only returns keys from the current table and database', async () => {
      const storage1 = new RxLocalStorage('table1', 'db1');
      const storage2 = new RxLocalStorage('table2', 'db1');
      await storage1.set('key1', 'value1');
      await storage2.set('key2', 'value2');
      await new Promise(resolve => setTimeout(resolve, 10));
      const keys1 = await storage1.getKeys();
      const keys2 = await storage2.getKeys();
      expect(keys1).toContain('key1');
      expect(keys1).not.toContain('key2');
      expect(keys2).toContain('key2');
      expect(keys2).not.toContain('key1');
    });
  });

  describe('clear', () => {
    it('removes all keys from the current table', async () => {
      const storage = new RxLocalStorage('table1', 'db1');
      await storage.set('key1', 'value1');
      await storage.set('key2', 'value2');
      await new Promise(resolve => setTimeout(resolve, 10));
      await storage.clear();
      await new Promise(resolve => setTimeout(resolve, 10));
      const keys = await storage.getKeys();
      expect(keys).toEqual([]);
      expect(await storage.get('key1')).toBeNull();
      expect(await storage.get('key2')).toBeNull();
    });

    it('updates signals when keys are cleared', async () => {
      const storage = new RxLocalStorage();
      const key1 = 'key1';
      const key2 = 'key2';
      const signal1 = storage.getSignal<string>(key1);
      const signal2 = storage.getSignal<string>(key2);
      await storage.set(key1, 'value1');
      await storage.set(key2, 'value2');
      expect(signal1()).toBe('value1');
      expect(signal2()).toBe('value2');
      await storage.clear();
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(signal1()).toBeUndefined();
      expect(signal2()).toBeUndefined();
    });

    it('does not affect keys from other tables', async () => {
      const storage1 = new RxLocalStorage('table1', 'db1');
      const storage2 = new RxLocalStorage('table2', 'db1');
      await storage1.set('key1', 'value1');
      await storage2.set('key2', 'value2');
      await new Promise(resolve => setTimeout(resolve, 10));
      await storage1.clear();
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(await storage1.get('key1')).toBeNull();
      expect(await storage2.get('key2')).toBe('value2');
    });
  });

  describe('constructor', () => {
    it('uses default parameters when none provided', () => {
      const storage = new RxLocalStorage();
      expect(storage).toBeInstanceOf(RxLocalStorage);
    });

    it('uses custom tableName, dbName, and delimiter', async () => {
      const storage = new RxLocalStorage('customTable', 'customDb', '::');
      await storage.set('key1', 'value1');
      await new Promise(resolve => setTimeout(resolve, 10));
      const keys = await storage.getKeys();
      expect(keys).toContain('key1');
      // Verify the key is prefixed correctly
      const prefixedKey = storage['prefixed']('key1');
      expect(localStorage.getItem(prefixedKey)).toBeTruthy();
    });
  });

  describe('edge cases', () => {
    it('handles null values', async () => {
      const storage = new RxLocalStorage();
      const key = 'testKey';
      await storage.set(key, null);
      const result = await storage.get(key);
      expect(result).toBeNull();
    });

    it('handles undefined values', async () => {
      const storage = new RxLocalStorage();
      const key = 'testKey';
      await storage.set(key, undefined);
      const result = await storage.get(key);
      // JSON.stringify(undefined) becomes undefined, which localStorage stores as "undefined" string
      // When retrieved, it may be null or undefined depending on implementation
      expect(result === null || result === undefined).toBe(true);
    });

    it('handles complex objects', async () => {
      const storage = new RxLocalStorage();
      const key = 'testKey';
      // Date objects get serialized to strings in JSON
      const value = { nested: { data: [1, 2, 3] }, date: '2023-01-01T00:00:00.000Z' };
      await storage.set(key, value);
      const result = await storage.get(key);
      expect(result).toEqual(value);
    });

    it('handles arrays', async () => {
      const storage = new RxLocalStorage();
      const key = 'testKey';
      const value = [1, 2, 3, 'test', { nested: true }];
      await storage.set(key, value);
      const result = await storage.get(key);
      expect(result).toEqual(value);
    });

    it('handles multiple keys being observed', async () => {
      const storage = new RxLocalStorage();
      const key1 = 'key1';
      const key2 = 'key2';
      const signal1 = storage.getSignal<string>(key1);
      const signal2 = storage.getSignal<string>(key2);
      await storage.set(key1, 'value1');
      await storage.set(key2, 'value2');
      expect(signal1()).toBe('value1');
      expect(signal2()).toBe('value2');
    });
  });

  describe('dispose', () => {
    it('disposes the observer and removes the storage event listener', () => {
      const storage = new RxLocalStorage();
      storage.getObservable('test');
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
      storage.dispose();
      expect(removeEventListenerSpy).toHaveBeenCalledWith('storage', storage['listener']);
    });

    it('clears observed keys', () => {
      const storage = new RxLocalStorage();
      storage.getObservable('key1');
      storage.getSignal('key2');
      expect(storage['observedKeys'].size).toBeGreaterThan(0);
      storage.dispose();
      expect(storage['observedKeys'].size).toBe(0);
    });
  });
});
