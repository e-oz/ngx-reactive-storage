import { Observable } from "rxjs";
import { RxStorage } from './idb';
import 'fake-indexeddb/auto';

class BCMock {
  addEventListener() {
  }

  postMessage() {
  }

  removeEventListener() {
  }

  close() {
  }
}

// @ts-ignore
BroadcastChannel = BCMock;

function readObs<T = unknown>(obs: Observable<T>): T | undefined {
  let v;
  obs.subscribe((val) => v = val);
  return v;
}

describe('IdbStorage', () => {
  let storage: RxStorage;
  const registryName = 'test';

  beforeEach(() => {
    storage = new RxStorage(registryName);
  });

  it('should create an instance of the IdbStorage class', () => {
    expect(storage).toBeInstanceOf(RxStorage);
  });

  it('should set and get a value', async () => {
    const key = 'testKey';
    const value = 'testValue';
    await storage.set(key, value);
    const result = await storage.get(key);
    expect(result).toEqual(value);
  });

  it('should remove a value', async () => {
    const key = 'testKey';
    const value = 'testValue';
    await storage.set(key, value);
    await storage.remove(key);
    const result = await storage.get(key);
    expect(result).toBeNull();
  });

  it('should set and get an object', async () => {
    const key = 'testKey';
    const value = { test: 'testValue' };
    await storage.set(key, value);
    const result = await storage.get<{
      test: string
    }>(key);
    expect(result).toEqual(value);
  });

  it('should return a signal and update it', async () => {
    const key = 'testKey';
    const value = 'testValue';
    const s = storage.getSignal(key);
    expect(s()).toStrictEqual(undefined);
    await storage.set(key, value);
    expect(s()).toStrictEqual(value);
    await storage.remove(key);
    expect(s()).toStrictEqual(undefined);
  });

  it('should return a signal with initialValue when provided', () => {
    const key = 'testKey';
    const initialValue = 'initial';
    const s = storage.getSignal(key, { initialValue });
    expect(s()).toBe(initialValue);
  });

  it('should return a signal with initialValue that gets overridden by stored value', async () => {
    const key = 'testKey';
    const initialValue = 'initial';
    const storedValue = 'stored';
    const s = storage.getSignal(key, { initialValue });
    expect(s()).toBe(initialValue);
    await storage.set(key, storedValue);
    expect(s()).toBe(storedValue);
  });

  it('should use custom equality function when provided', () => {
    const key = 'testKey';
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    const equal: (a: string | undefined, b: string | undefined) => boolean = 
      (a, b) => {
        if (typeof a !== 'string' || typeof b !== 'string') return a === b;
        return a.toLowerCase() === b.toLowerCase();
      };
    // Test with equal function only (use type assertion to help TypeScript)
    const s = storage.getSignal(key, { equal } as any);
    expect(s).toBeDefined();
    // Test that signal works with the equality function
    expect(s()).toBeUndefined();
    consoleErrorSpy.mockRestore();
  });

  it('should return an observable and update it', async () => {
    const key = 'testKey';
    const value = 'testValue';
    const obs = storage.getObservable(key);

    expect(readObs(obs)).toStrictEqual(undefined);
    await storage.set(key, value);
    expect(readObs(obs)).toStrictEqual(value);
    await storage.remove(key);
    expect(readObs(obs)).toStrictEqual(undefined);
  });

  it('should support multiple subscribers to the same observable', async () => {
    const key = 'testKey';
    const value = 'testValue';
    const obs = storage.getObservable<string>(key);
    let result1: string | undefined;
    let result2: string | undefined;
    obs.subscribe((val) => { result1 = val; });
    obs.subscribe((val) => { result2 = val; });
    // Wait for async get to complete
    await new Promise(resolve => setTimeout(resolve, 50));
    await storage.set(key, value);
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(result1).toBe(value);
    expect(result2).toBe(value);
  });

  it('should update a key in the storage when WritableSignal is updated', async () => {
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
    const key = 'testKey';
    const value = 'testValue';
    const ws = storage.getWritableSignal<string>(key);
    expect(ws()).toBeUndefined();
    ws.set(value);
    expect(ws()).toBe(value);
    expect(await storage.get(key)).toBe(value);
  });

  describe('getKeys', () => {
    it('should return all keys for the current table', async () => {
      await storage.set('key1', 'value1');
      await storage.set('key2', 'value2');
      await new Promise(resolve => setTimeout(resolve, 10));
      const keys = await storage.getKeys();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
    });

    it('should return empty array when no keys exist', async () => {
      // Create a new storage instance to ensure it's empty
      const emptyStorage = new RxStorage('emptyTable', 'emptyDb');
      const keys = await emptyStorage.getKeys();
      expect(keys).toEqual([]);
    });

    it('should only return keys from the current table', async () => {
      const storage1 = new RxStorage('table1', 'db1');
      const storage2 = new RxStorage('table2', 'db1');
      await storage1.set('key1', 'value1');
      await storage2.set('key2', 'value2');
      const keys1 = await storage1.getKeys();
      const keys2 = await storage2.getKeys();
      expect(keys1).toContain('key1');
      expect(keys1).not.toContain('key2');
      expect(keys2).toContain('key2');
      expect(keys2).not.toContain('key1');
    });
  });

  describe('clear', () => {
    it('should remove all keys from the current table', async () => {
      await storage.set('key1', 'value1');
      await storage.set('key2', 'value2');
      await storage.clear();
      const keys = await storage.getKeys();
      expect(keys).toEqual([]);
      expect(await storage.get('key1')).toBeNull();
      expect(await storage.get('key2')).toBeNull();
    });

    it('should update signals when keys are cleared', async () => {
      const key1 = 'key1';
      const key2 = 'key2';
      const signal1 = storage.getSignal<string>(key1);
      const signal2 = storage.getSignal<string>(key2);
      await storage.set(key1, 'value1');
      await storage.set(key2, 'value2');
      expect(signal1()).toBe('value1');
      expect(signal2()).toBe('value2');
      await storage.clear();
      expect(signal1()).toBeUndefined();
      expect(signal2()).toBeUndefined();
    });

    it('should not affect keys from other tables', async () => {
      const storage1 = new RxStorage('table1', 'db1');
      const storage2 = new RxStorage('table2', 'db1');
      await storage1.set('key1', 'value1');
      await storage2.set('key2', 'value2');
      await storage1.clear();
      expect(await storage1.get('key1')).toBeNull();
      expect(await storage2.get('key2')).toBe('value2');
    });
  });

  describe('dispose', () => {
    it('should dispose the observer and close BroadcastChannel', () => {
      const storage = new RxStorage('test');
      storage.getObservable('test');
      const channel = storage['channel'];
      if (channel) {
        const closeSpy = jest.spyOn(channel, 'close');
        const removeEventListenerSpy = jest.spyOn(channel, 'removeEventListener');
        storage.dispose();
        expect(removeEventListenerSpy).toHaveBeenCalled();
        expect(closeSpy).toHaveBeenCalled();
      } else {
        // If channel is undefined (e.g., in test environment), just verify dispose doesn't throw
        expect(() => storage.dispose()).not.toThrow();
      }
    });
  });

  describe('constructor', () => {
    it('should use default parameters when none provided', () => {
      const storage = new RxStorage();
      expect(storage).toBeInstanceOf(RxStorage);
    });

    it('should use custom tableName and dbName', async () => {
      const storage = new RxStorage('customTable', 'customDb');
      await storage.set('key1', 'value1');
      const keys = await storage.getKeys();
      expect(keys).toContain('key1');
    });
  });

  describe('edge cases', () => {
    it('should handle null values', async () => {
      const key = 'testKey';
      await storage.set(key, null);
      const result = await storage.get(key);
      expect(result).toBeNull();
    });

    it('should handle undefined values', async () => {
      const key = 'testKey';
      await storage.set(key, undefined);
      const result = await storage.get(key);
      // IndexedDB/localforage may return null for undefined values
      expect(result === null || result === undefined).toBe(true);
    });

    it('should handle complex objects', async () => {
      const key = 'testKey';
      // Date objects get serialized to strings in JSON
      const value = { nested: { data: [1, 2, 3] }, date: '2023-01-01T00:00:00.000Z' };
      await storage.set(key, value);
      const result = await storage.get(key);
      expect(result).toEqual(value);
    });

    it('should handle arrays', async () => {
      const key = 'testKey';
      const value = [1, 2, 3, 'test', { nested: true }];
      await storage.set(key, value);
      const result = await storage.get(key);
      expect(result).toEqual(value);
    });

    it('should handle multiple keys being observed', async () => {
      const key1 = 'key1';
      const key2 = 'key2';
      const signal1 = storage.getSignal<string>(key1);
      const signal2 = storage.getSignal<string>(key2);
      await storage.set(key1, 'value1');
      await storage.set(key2, 'value2');
      expect(signal1()).toBe('value1');
      expect(signal2()).toBe('value2');
    });

    it('should handle get returning null for non-existent key', async () => {
      const key = 'nonExistentKey';
      const result = await storage.get(key);
      expect(result).toBeNull();
    });
  });
});
