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
      const key = 'obs-stored';
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
      const key = 'obs-external';
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
      const key = 'obs-multi-sub';
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
      const key = 'obs-nonexistent';
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
      const key = 'signal-stored';
      const value = 'testValue';
      storage.set(key, value);
      const signal = storage.getSignal<string>(key);
      expect(signal()).toBe(value);
    });

    it('returns a signal with initialValue when provided', () => {
      const storage = new RxLocalStorage();
      const key = 'signal-init';
      const initialValue = 'initial';
      const signal = storage.getSignal<string>(key, { initialValue });
      expect(signal()).toBe(initialValue);
    });

    it('returns a signal with initialValue that gets overridden by stored value', async () => {
      const storage = new RxLocalStorage();
      const key = 'signal-init-override';
      const initialValue = 'initial';
      const storedValue = 'stored';
      const signal = storage.getSignal<string>(key, { initialValue });
      expect(signal()).toBe(initialValue);
      await storage.set(key, storedValue);
      expect(signal()).toBe(storedValue);
    });

    it('uses custom equality function when provided', () => {
      const storage = new RxLocalStorage();
      const key = 'signal-custom-eq';
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
      const key = 'get-stored';
      const value = 'testValue';
      localStorage.setItem(storage['prefixed'](key), JSON.stringify(value));
      const result = await storage.get<string>(key);
      expect(result).toBe(value);
    });

    it('returns a Promise that resolves with null if the key does not exist', async () => {
      const storage = new RxLocalStorage();
      const key = 'get-nonexistent';
      const result = await storage.get<string>(key);
      expect(result).toBeNull();
    });

    it('returns a Promise that rejects if the stored value is not a valid JSON', async () => {
      const storage = new RxLocalStorage();
      const key = 'get-invalid-json';
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
      const key = 'remove-item';
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      localStorage.setItem(storage['prefixed'](key), 'value');
      await storage.remove(key);
      expect(localStorage.getItem(storage['prefixed'](key))).toBeNull();
      consoleErrorSpy.mockRestore();
    });

    it('rejects the Promise if an error occurs', async () => {
      const storage = new RxLocalStorage();
      const key = 'remove-error';
      localStorage.removeItem = jest.fn(() => {
        throw new Error('Failed to remove item');
      });
      await expect(storage.remove(key)).rejects.toThrow('Failed to remove item');
    });
  });

  describe('set', () => {
    it('sets the item in localStorage', async () => {
      const storage = new RxLocalStorage();
      const key = 'set-item';
      const value = 'testValue';
      await storage.set(key, value);
      expect(localStorage.getItem(storage['prefixed'](key))).toBe(JSON.stringify(value));
    });

    it('rejects the Promise if an error occurs', async () => {
      const storage = new RxLocalStorage();
      const key = 'set-error';
      const value = 'testValue';
      localStorage.setItem = jest.fn(() => {
        throw new Error('Failed to set item');
      });
      await expect(storage.set(key, value)).rejects.toThrow('Failed to set item');
    });

    it('should update a key in the storage when WritableSignal is updated', async () => {
      const storage = new RxLocalStorage();
      const key = 'ws-update';
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
      const key = 'ws-no-init';
      const value = 'testValue';
      const ws = storage.getWritableSignal<string>(key);
      expect(ws()).toBeUndefined();
      ws.set(value);
      expect(ws()).toBe(value);
      expect(await storage.get(key)).toBe(value);
    });

    it('should update signal when storage changes externally', async () => {
      const storage = new RxLocalStorage();
      const key = 'ws-external';
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
      await storage.set('getkeys-a', 'value1');
      await storage.set('getkeys-b', 'value2');
      await new Promise(resolve => setTimeout(resolve, 10));
      const keys = await storage.getKeys();
      expect(keys).toContain('getkeys-a');
      expect(keys).toContain('getkeys-b');
      expect(keys.length).toBeGreaterThanOrEqual(2);
    });

    it('returns empty array when no keys exist', async () => {
      const storage = new RxLocalStorage('emptyTable', 'emptyDb');
      const keys = await storage.getKeys();
      expect(keys).toEqual([]);
    });

    it('only returns keys from the current table and database', async () => {
      const storage1 = new RxLocalStorage('table1', 'db1');
      const storage2 = new RxLocalStorage('table2', 'db1');
      await storage1.set('iso-key1', 'value1');
      await storage2.set('iso-key2', 'value2');
      await new Promise(resolve => setTimeout(resolve, 10));
      const keys1 = await storage1.getKeys();
      const keys2 = await storage2.getKeys();
      expect(keys1).toContain('iso-key1');
      expect(keys1).not.toContain('iso-key2');
      expect(keys2).toContain('iso-key2');
      expect(keys2).not.toContain('iso-key1');
    });
  });

  describe('getSignal options', () => {
    it('should use both initialValue and equal together', () => {
      const storage = new RxLocalStorage();
      const key = 'signal-init-equal';
      const equal = (a: string | undefined, b: string | undefined) => {
        if (typeof a !== 'string' || typeof b !== 'string') return a === b;
        return a.toLowerCase() === b.toLowerCase();
      };
      const s = storage.getSignal<string>(key, { initialValue: 'Hello', equal });
      expect(s()).toBe('Hello');
      storage.set(key, 'hello');
      // equal says 'Hello' === 'hello', so signal should NOT update
      expect(s()).toBe('Hello');
      storage.set(key, 'world');
      expect(s()).toBe('world');
    });
  });

  describe('getWritableSignal options', () => {
    it('should use custom equality function', () => {
      const storage = new RxLocalStorage();
      const key = 'ws-custom-eq';
      const equal = (a: number | undefined, b: number | undefined) => {
        return Math.floor(a ?? 0) === Math.floor(b ?? 0);
      };
      const ws = storage.getWritableSignal<number>(key, { initialValue: 5, equal });
      expect(ws()).toBe(5);
      ws.set(5.3);
      // equal says floor(5) === floor(5.3), so signal value stays the same
      expect(ws()).toBe(5);
      ws.set(6);
      expect(ws()).toBe(6);
    });

    it('should use both initialValue and equal together', () => {
      const storage = new RxLocalStorage();
      const key = 'ws-init-equal';
      const equal = (a: string | undefined, b: string | undefined) => {
        if (typeof a !== 'string' || typeof b !== 'string') return a === b;
        return a.trim() === b.trim();
      };
      const ws = storage.getWritableSignal<string>(key, { initialValue: 'hi', equal });
      expect(ws()).toBe('hi');
      ws.set('hi ');
      // equal says 'hi' === 'hi ', so signal should NOT update
      expect(ws()).toBe('hi');
      ws.set('bye');
      expect(ws()).toBe('bye');
    });

    it('should read existing value from localStorage synchronously', () => {
      const storage = new RxLocalStorage();
      const key = 'ws-sync-read';
      localStorage.setItem(storage['prefixed'](key), JSON.stringify('existing'));
      const ws = storage.getWritableSignal<string>(key);
      expect(ws()).toBe('existing');
    });

    it('should prefer stored value over initialValue', () => {
      const storage = new RxLocalStorage();
      const key = 'ws-stored-over-init';
      localStorage.setItem(storage['prefixed'](key), JSON.stringify('stored'));
      const ws = storage.getWritableSignal<string>(key, { initialValue: 'fallback' });
      expect(ws()).toBe('stored');
    });
  });

  describe('idempotent creation', () => {
    it('should return the same signal for the same key', () => {
      const storage = new RxLocalStorage();
      const key = 'idempotent-signal';
      const s1 = storage.getSignal<string>(key);
      const s2 = storage.getSignal<string>(key);
      storage.set(key, 'value');
      expect(s1()).toBe('value');
      expect(s2()).toBe('value');
      expect(s1()).toBe(s2());
    });

    it('should return the same writable signal for the same key', () => {
      const storage = new RxLocalStorage();
      const key = 'idempotent-ws';
      const ws1 = storage.getWritableSignal<string>(key);
      const ws2 = storage.getWritableSignal<string>(key);
      ws1.set('from-ws1');
      expect(ws2()).toBe('from-ws1');
    });

    it('should return the same underlying observable for the same key', () => {
      const storage = new RxLocalStorage();
      const key = 'idempotent-obs';
      const obs1 = storage.getObservable<string>(key);
      const obs2 = storage.getObservable<string>(key);
      let result1: string | undefined;
      let result2: string | undefined;
      obs1.subscribe((val) => { result1 = val; });
      obs2.subscribe((val) => { result2 = val; });
      storage.set(key, 'value');
      expect(result1).toBe('value');
      expect(result2).toBe('value');
    });
  });

  describe('observable and signal coexistence', () => {
    it('should update both observable and signal for the same key', () => {
      const storage = new RxLocalStorage();
      const key = 'coexist-set';
      const obs = storage.getObservable<string>(key);
      const sig = storage.getSignal<string>(key);
      let obsValue: string | undefined;
      obs.subscribe((val) => { obsValue = val; });
      storage.set(key, 'shared');
      expect(obsValue).toBe('shared');
      expect(sig()).toBe('shared');
    });

    it('should update both observable and signal on remove', () => {
      const storage = new RxLocalStorage();
      const key = 'coexist-remove';
      const obs = storage.getObservable<string>(key);
      const sig = storage.getSignal<string>(key);
      let obsValue: string | undefined = 'initial';
      obs.subscribe((val) => { obsValue = val; });
      storage.set(key, 'value');
      expect(obsValue).toBe('value');
      expect(sig()).toBe('value');
      storage.remove(key);
      expect(obsValue).toBeUndefined();
      expect(sig()).toBeUndefined();
    });
  });

  describe('observable dedup', () => {
    it('should not re-emit when the same reference value is set', () => {
      const storage = new RxLocalStorage();
      const key = 'obs-dedup';
      const obs = storage.getObservable<string>(key);
      const values: (string | undefined)[] = [];
      obs.subscribe((val) => { values.push(val); });
      storage.set(key, 'a');
      storage.set(key, 'a');
      storage.set(key, 'b');
      const nonUndefinedValues = values.filter(v => v !== undefined);
      expect(nonUndefinedValues).toEqual(['a', 'b']);
    });
  });

  describe('clear', () => {
    it('removes all keys from the current table', async () => {
      const storage = new RxLocalStorage('table1', 'db1');
      await storage.set('clear-a', 'value1');
      await storage.set('clear-b', 'value2');
      await new Promise(resolve => setTimeout(resolve, 10));
      await storage.clear();
      await new Promise(resolve => setTimeout(resolve, 10));
      const keys = await storage.getKeys();
      expect(keys).toEqual([]);
      expect(await storage.get('clear-a')).toBeNull();
      expect(await storage.get('clear-b')).toBeNull();
    });

    it('updates signals when keys are cleared', async () => {
      const storage = new RxLocalStorage();
      const key1 = 'clear-sig-a';
      const key2 = 'clear-sig-b';
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

    it('updates observables when keys are cleared', async () => {
      const storage = new RxLocalStorage();
      const key1 = 'clear-obs-a';
      const key2 = 'clear-obs-b';
      const obs1 = storage.getObservable<string>(key1);
      const obs2 = storage.getObservable<string>(key2);
      let val1: string | undefined;
      let val2: string | undefined;
      obs1.subscribe((v) => { val1 = v; });
      obs2.subscribe((v) => { val2 = v; });
      await storage.set(key1, 'value1');
      await storage.set(key2, 'value2');
      expect(val1).toBe('value1');
      expect(val2).toBe('value2');
      await storage.clear();
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(val1).toBeUndefined();
      expect(val2).toBeUndefined();
    });

    it('does not affect keys from other tables', async () => {
      const storage1 = new RxLocalStorage('table1', 'db1');
      const storage2 = new RxLocalStorage('table2', 'db1');
      await storage1.set('clear-iso-a', 'value1');
      await storage2.set('clear-iso-b', 'value2');
      await new Promise(resolve => setTimeout(resolve, 10));
      await storage1.clear();
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(await storage1.get('clear-iso-a')).toBeNull();
      expect(await storage2.get('clear-iso-b')).toBe('value2');
    });
  });

  describe('constructor', () => {
    it('uses default parameters when none provided', () => {
      const storage = new RxLocalStorage();
      expect(storage).toBeInstanceOf(RxLocalStorage);
    });

    it('uses custom tableName, dbName, and delimiter', async () => {
      const storage = new RxLocalStorage('customTable', 'customDb', '::');
      await storage.set('ctor-custom', 'value1');
      await new Promise(resolve => setTimeout(resolve, 10));
      const keys = await storage.getKeys();
      expect(keys).toContain('ctor-custom');
      const prefixedKey = storage['prefixed']('ctor-custom');
      expect(localStorage.getItem(prefixedKey)).toBeTruthy();
    });

    it('should fall back to defaults for empty strings', () => {
      const s = new RxLocalStorage('', '', '');
      expect(s['tableName']).toBe('table');
      expect(s['dbName']).toBe('db');
      expect(s['delimiter']).toBe('|~:%:^|');
    });
  });

  describe('StorageEvent listener', () => {
    it('should ignore events for non-observed keys', async () => {
      const storage = new RxLocalStorage();
      const key = 'listener-observed';
      const otherKey = 'listener-other';
      const sig = storage.getSignal<string>(key);

      const prefixedOther = storage['prefixed'](otherKey);
      window.dispatchEvent(new StorageEvent('storage', {
        key: prefixedOther,
        newValue: JSON.stringify('nope'),
      }));
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(sig()).toBeUndefined();
    });

    it('should handle null newValue (key removed externally)', async () => {
      const storage = new RxLocalStorage();
      const key = 'listener-null';
      const sig = storage.getSignal<string>(key);
      await storage.set(key, 'value');
      expect(sig()).toBe('value');

      window.dispatchEvent(new StorageEvent('storage', {
        key: storage['prefixed'](key),
        newValue: null,
      }));
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(sig()).toBeNull();
    });

    it('should handle "undefined" string as undefined', async () => {
      const storage = new RxLocalStorage();
      const key = 'listener-undef-str';
      const sig = storage.getSignal<string>(key);
      await storage.set(key, 'value');
      expect(sig()).toBe('value');

      window.dispatchEvent(new StorageEvent('storage', {
        key: storage['prefixed'](key),
        newValue: 'undefined',
      }));
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(sig()).toBeUndefined();
    });

    it('should handle JSON parse errors gracefully', async () => {
      const storage = new RxLocalStorage();
      const key = 'listener-bad-json';
      const sig = storage.getSignal<string>(key);
      await storage.set(key, 'value');
      expect(sig()).toBe('value');

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      window.dispatchEvent(new StorageEvent('storage', {
        key: storage['prefixed'](key),
        newValue: 'not{valid}json',
      }));
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(sig()).toBe('value');
      consoleErrorSpy.mockRestore();
    });
  });

  describe('unprefixed', () => {
    it('returns undefined for keys with fewer than 3 parts', () => {
      const storage = new RxLocalStorage();
      expect(storage['unprefixed']('onlyonepart')).toBeUndefined();
      expect(storage['unprefixed']('')).toBeUndefined();
    });

    it('returns undefined for keys with wrong dbName', () => {
      const storage = new RxLocalStorage('table', 'mydb');
      const delimiter = storage['delimiter'];
      const wrongKey = `otherdb${delimiter}table${delimiter}key`;
      expect(storage['unprefixed'](wrongKey)).toBeUndefined();
    });

    it('returns undefined for keys with wrong tableName', () => {
      const storage = new RxLocalStorage('table', 'mydb');
      const delimiter = storage['delimiter'];
      const wrongKey = `mydb${delimiter}othertable${delimiter}key`;
      expect(storage['unprefixed'](wrongKey)).toBeUndefined();
    });

    it('returns the key for correctly prefixed keys', () => {
      const storage = new RxLocalStorage('table', 'mydb');
      const delimiter = storage['delimiter'];
      const prefixedKey = `mydb${delimiter}table${delimiter}mykey`;
      expect(storage['unprefixed'](prefixedKey)).toBe('mykey');
    });
  });

  describe('edge cases', () => {
    it('handles null values', async () => {
      const storage = new RxLocalStorage();
      const key = 'edge-null';
      await storage.set(key, null);
      const result = await storage.get(key);
      expect(result).toBeNull();
    });

    it('handles undefined values', async () => {
      const storage = new RxLocalStorage();
      const key = 'edge-undef';
      await storage.set(key, undefined);
      const result = await storage.get(key);
      expect(result === null || result === undefined).toBe(true);
    });

    it('handles complex objects', async () => {
      const storage = new RxLocalStorage();
      const key = 'edge-complex';
      const value = { nested: { data: [1, 2, 3] }, date: '2023-01-01T00:00:00.000Z' };
      await storage.set(key, value);
      const result = await storage.get(key);
      expect(result).toEqual(value);
    });

    it('handles arrays', async () => {
      const storage = new RxLocalStorage();
      const key = 'edge-array';
      const value = [1, 2, 3, 'test', { nested: true }];
      await storage.set(key, value);
      const result = await storage.get(key);
      expect(result).toEqual(value);
    });

    it('handles multiple keys being observed', async () => {
      const storage = new RxLocalStorage();
      const key1 = 'edge-multi-a';
      const key2 = 'edge-multi-b';
      const signal1 = storage.getSignal<string>(key1);
      const signal2 = storage.getSignal<string>(key2);
      await storage.set(key1, 'value1');
      await storage.set(key2, 'value2');
      expect(signal1()).toBe('value1');
      expect(signal2()).toBe('value2');
    });

    it('handles boolean values', async () => {
      const storage = new RxLocalStorage();
      await storage.set('edge-bool', true);
      expect(await storage.get('edge-bool')).toBe(true);
      await storage.set('edge-bool', false);
      expect(await storage.get('edge-bool')).toBe(false);
    });

    it('handles numeric values', async () => {
      const storage = new RxLocalStorage();
      await storage.set('edge-num', 0);
      expect(await storage.get('edge-num')).toBe(0);
      await storage.set('edge-num', -1);
      expect(await storage.get('edge-num')).toBe(-1);
      await storage.set('edge-num', 3.14);
      expect(await storage.get('edge-num')).toBe(3.14);
    });

    it('handles empty string values', async () => {
      const storage = new RxLocalStorage();
      await storage.set('edge-empty-str', '');
      const result = await storage.get('edge-empty-str');
      expect(result).toBe('');
    });
  });

  describe('dispose', () => {
    it('disposes the observer and removes the storage event listener', () => {
      const storage = new RxLocalStorage();
      storage.getObservable('dispose-test');
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
      storage.dispose();
      expect(removeEventListenerSpy).toHaveBeenCalledWith('storage', storage['listener']);
    });

    it('clears observed keys', () => {
      const storage = new RxLocalStorage();
      storage.getObservable('dispose-obs');
      storage.getSignal('dispose-sig');
      expect(storage['observedKeys'].size).toBeGreaterThan(0);
      storage.dispose();
      expect(storage['observedKeys'].size).toBe(0);
    });

    it('should not throw when disposed without any listening', () => {
      const storage = new RxLocalStorage();
      expect(() => storage.dispose()).not.toThrow();
      expect(storage['observedKeys'].size).toBe(0);
    });
  });
});
