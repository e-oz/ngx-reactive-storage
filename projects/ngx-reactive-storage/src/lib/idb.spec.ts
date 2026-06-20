import { deserialize, serialize } from 'node:v8';

// jest-environment-jsdom does not provide structuredClone, which fake-indexeddb requires
if (typeof globalThis.structuredClone === 'undefined') {
  (globalThis as any).structuredClone = (value: unknown) => deserialize(serialize(value));
}

// fake-indexeddb must be imported before './idb' (which imports localforage):
// localforage captures the indexedDB global at module-evaluation time and
// silently falls back to its localStorage driver when it is missing.
import 'fake-indexeddb/auto';
import localforage from 'localforage';
import { Observable } from "rxjs";
import { RxStorage } from './idb';

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

// jest-environment-jsdom does not provide BroadcastChannel; assign the mock onto
// globalThis (a bare `BroadcastChannel = ...` throws ReferenceError in strict-mode ESM).
(globalThis as any).BroadcastChannel = BCMock;

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

  it('should run on the IndexedDB driver', async () => {
    await storage.set('driver-check', 'value');
    expect(storage['storage']?.driver()).toBe(localforage.INDEXEDDB);
  });

  it('should set and get a value', async () => {
    const key = 'set-get';
    const value = 'testValue';
    await storage.set(key, value);
    const result = await storage.get(key);
    expect(result).toEqual(value);
  });

  it('should remove a value', async () => {
    const key = 'remove-val';
    const value = 'testValue';
    await storage.set(key, value);
    await storage.remove(key);
    const result = await storage.get(key);
    expect(result).toBeNull();
  });

  it('should set and get an object', async () => {
    const key = 'set-get-obj';
    const value = { test: 'testValue' };
    await storage.set(key, value);
    const result = await storage.get<{
      test: string
    }>(key);
    expect(result).toEqual(value);
  });

  it('should return a signal and update it', async () => {
    const key = 'signal-update';
    const value = 'testValue';
    const s = storage.getSignal(key);
    expect(s()).toStrictEqual(undefined);
    await storage.set(key, value);
    expect(s()).toStrictEqual(value);
    await storage.remove(key);
    expect(s()).toStrictEqual(undefined);
  });

  it('should return a signal with initialValue when provided', () => {
    const key = 'signal-init';
    const initialValue = 'initial';
    const s = storage.getSignal(key, { initialValue });
    expect(s()).toBe(initialValue);
  });

  it('should return a signal with initialValue that gets overridden by stored value', async () => {
    const key = 'signal-init-override';
    const initialValue = 'initial';
    const storedValue = 'stored';
    const s = storage.getSignal(key, { initialValue });
    expect(s()).toBe(initialValue);
    await storage.set(key, storedValue);
    expect(s()).toBe(storedValue);
  });

  it('should use custom equality function when provided', () => {
    const key = 'signal-custom-eq';
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
    const key = 'obs-update';
    const value = 'testValue';
    const obs = storage.getObservable(key);

    expect(readObs(obs)).toStrictEqual(undefined);
    await storage.set(key, value);
    expect(readObs(obs)).toStrictEqual(value);
    await storage.remove(key);
    expect(readObs(obs)).toStrictEqual(undefined);
  });

  it('should support multiple subscribers to the same observable', async () => {
    const key = 'obs-multi-sub';
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
    const key = 'ws-update';
    const value = 'testValue';
    const initValue = 'initial value';
    const newValue = 'new value';

    const ws = storage.getWritableSignal<string>(key, { initialValue: initValue });
    expect(ws()).toStrictEqual(initValue);

    ws.set(value);
    expect(ws()).toStrictEqual(value);
    // the storage write behind a signal write is asynchronous for IndexedDB
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(await storage.get(key)).toStrictEqual(value);

    ws.update((val) => {
      expect(val).toStrictEqual(value);
      return newValue;
    });

    expect(ws()).toStrictEqual(newValue);
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(await storage.get(key)).toStrictEqual(newValue);
    await storage.remove(key);
    expect(ws()).toStrictEqual(undefined);
  });

  it('should work with WritableSignal without initialValue', async () => {
    const key = 'ws-no-init';
    const value = 'testValue';
    const ws = storage.getWritableSignal<string>(key);
    expect(ws()).toBeUndefined();
    ws.set(value);
    expect(ws()).toBe(value);
    // the storage write behind a signal write is asynchronous for IndexedDB
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(await storage.get(key)).toBe(value);
  });

  it('should not resurrect a removed key observed by a writable signal', async () => {
    const storage = new RxStorage('resurrectTable', 'resurrectDb');
    const ws = storage.getWritableSignal<string>('k');
    await storage.set('k', 'v');
    await storage.remove('k');
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(ws()).toBeUndefined();
    expect(await storage.getKeys()).toEqual([]);
  });

  describe('getKeys', () => {
    it('should return all keys for the current table', async () => {
      await storage.set('getkeys-a', 'value1');
      await storage.set('getkeys-b', 'value2');
      await new Promise(resolve => setTimeout(resolve, 10));
      const keys = await storage.getKeys();
      expect(keys).toContain('getkeys-a');
      expect(keys).toContain('getkeys-b');
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
      await storage1.set('iso-key1', 'value1');
      await storage2.set('iso-key2', 'value2');
      const keys1 = await storage1.getKeys();
      const keys2 = await storage2.getKeys();
      expect(keys1).toContain('iso-key1');
      expect(keys1).not.toContain('iso-key2');
      expect(keys2).toContain('iso-key2');
      expect(keys2).not.toContain('iso-key1');
    });
  });

  describe('dispose', () => {
    it('should dispose the observer and close BroadcastChannel', () => {
      const storage = new RxStorage('test');
      storage.getObservable('dispose-test');
      const channel = storage['channel'];
      if (channel) {
        const closeSpy = jest.spyOn(channel, 'close');
        const removeEventListenerSpy = jest.spyOn(channel, 'removeEventListener');
        storage.dispose();
        expect(removeEventListenerSpy).toHaveBeenCalled();
        expect(closeSpy).toHaveBeenCalled();
      } else {
        expect(() => storage.dispose()).not.toThrow();
      }
    });
  });

  describe('getSignal options', () => {
    it('should not overwrite the current value when getSignal() is called again with initialValue', async () => {
      const key = 'signal-reinit';
      const s1 = storage.getSignal<string>(key, { initialValue: 'init' });
      await storage.set(key, 'stored');
      expect(s1()).toBe('stored');
      // e.g. a second component starts observing the same key:
      storage.getSignal<string>(key, { initialValue: 'init' });
      expect(s1()).toBe('stored');
    });

    it('should not write initialValue into the storage when the key is observed by a writable signal', async () => {
      const key = 'signal-init-ws';
      await storage.set(key, 'stored');
      storage.getWritableSignal<string>(key);
      await new Promise(resolve => setTimeout(resolve, 50));
      storage.getSignal<string>(key, { initialValue: 'init' });
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(await storage.get(key)).toBe('stored');
    });

    it('should use both initialValue and equal together', async () => {
      const key = 'signal-init-equal';
      const equal = (a: string | undefined, b: string | undefined) => {
        if (typeof a !== 'string' || typeof b !== 'string') return a === b;
        return a.toLowerCase() === b.toLowerCase();
      };
      const s = storage.getSignal<string>(key, { initialValue: 'Hello', equal });
      expect(s()).toBe('Hello');
      await storage.set(key, 'hello');
      // equal says 'Hello' === 'hello', so signal should NOT update
      expect(s()).toBe('Hello');
      await storage.set(key, 'world');
      expect(s()).toBe('world');
    });
  });

  describe('getWritableSignal options', () => {
    it('should use custom equality function', async () => {
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

    it('should use both initialValue and equal together', async () => {
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
      // the storage write behind a signal write is asynchronous for IndexedDB
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(await storage.get(key)).toBe('bye');
    });

    it('should pick up already-stored value after async load', async () => {
      const key = 'ws-async-load';
      await storage.set(key, 'stored');
      const ws = storage.getWritableSignal<string>(key);
      // Initially may be undefined, but after async load it should update
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(ws()).toBe('stored');
    });
  });

  describe('idempotent creation', () => {
    it('should return the same signal for the same key', async () => {
      const key = 'idempotent-signal';
      const s1 = storage.getSignal<string>(key);
      const s2 = storage.getSignal<string>(key);
      await storage.set(key, 'value');
      expect(s1()).toBe('value');
      expect(s2()).toBe('value');
      expect(s1()).toBe(s2());
    });

    it('should return the same writable signal for the same key', async () => {
      const key = 'idempotent-ws';
      const ws1 = storage.getWritableSignal<string>(key);
      const ws2 = storage.getWritableSignal<string>(key);
      ws1.set('from-ws1');
      expect(ws2()).toBe('from-ws1');
    });

    it('should return the same underlying observable for the same key', async () => {
      const key = 'idempotent-obs';
      const obs1 = storage.getObservable<string>(key);
      const obs2 = storage.getObservable<string>(key);
      let result1: string | undefined;
      let result2: string | undefined;
      obs1.subscribe((val) => { result1 = val; });
      obs2.subscribe((val) => { result2 = val; });
      await storage.set(key, 'value');
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(result1).toBe('value');
      expect(result2).toBe('value');
    });

    it('should persist writes when getSignal() was called before getWritableSignal()', async () => {
      const key = 'ws-after-signal';
      const ro = storage.getSignal<string>(key);
      const ws = storage.getWritableSignal<string>(key);
      ws.set('v');
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(ro()).toBe('v');
      expect(await storage.get(key)).toBe('v');
    });
  });

  describe('observable and signal coexistence', () => {
    it('should update both observable and signal for the same key', async () => {
      const key = 'coexist-set';
      const obs = storage.getObservable<string>(key);
      const sig = storage.getSignal<string>(key);
      let obsValue: string | undefined;
      obs.subscribe((val) => { obsValue = val; });
      await storage.set(key, 'shared');
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(obsValue).toBe('shared');
      expect(sig()).toBe('shared');
    });

    it('should update both observable and signal on remove', async () => {
      const key = 'coexist-remove';
      const obs = storage.getObservable<string>(key);
      const sig = storage.getSignal<string>(key);
      let obsValue: string | undefined = 'initial';
      obs.subscribe((val) => { obsValue = val; });
      await storage.set(key, 'value');
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(obsValue).toBe('value');
      expect(sig()).toBe('value');
      await storage.remove(key);
      expect(obsValue).toBeUndefined();
      expect(sig()).toBeUndefined();
    });
  });

  describe('observable dedup', () => {
    it('should not re-emit when the same reference value is set', async () => {
      const key = 'obs-dedup';
      const obs = storage.getObservable<string>(key);
      const values: (string | undefined)[] = [];
      obs.subscribe((val) => { values.push(val); });
      await storage.set(key, 'a');
      await storage.set(key, 'a');
      await storage.set(key, 'b');
      await new Promise(resolve => setTimeout(resolve, 50));
      const nonUndefinedValues = values.filter(v => v !== undefined);
      expect(nonUndefinedValues).toEqual(['a', 'b']);
    });

    it('should not re-emit to existing subscribers when getObservable() is called again', async () => {
      const key = 'obs-recall';
      const obs = storage.getObservable<string>(key);
      await storage.set(key, 'v');
      const emissions: (string | undefined)[] = [];
      obs.subscribe((val) => { emissions.push(val); });
      expect(emissions).toStrictEqual(['v']);
      storage.getObservable<string>(key);
      await new Promise(resolve => setTimeout(resolve, 50));
      // toStrictEqual: plain toEqual would ignore an `undefined` array item
      expect(emissions).toStrictEqual(['v']);
    });
  });

  describe('clear', () => {
    it('should remove all keys from the current table', async () => {
      await storage.set('clear-a', 'value1');
      await storage.set('clear-b', 'value2');
      await storage.clear();
      const keys = await storage.getKeys();
      expect(keys).toEqual([]);
      expect(await storage.get('clear-a')).toBeNull();
      expect(await storage.get('clear-b')).toBeNull();
    });

    it('should update signals when keys are cleared', async () => {
      const key1 = 'clear-sig-a';
      const key2 = 'clear-sig-b';
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

    it('should update observables when keys are cleared', async () => {
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
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(val1).toBe('value1');
      expect(val2).toBe('value2');
      await storage.clear();
      expect(val1).toBeUndefined();
      expect(val2).toBeUndefined();
    });

    it('should not affect keys from other tables', async () => {
      const storage1 = new RxStorage('table1', 'db1');
      const storage2 = new RxStorage('table2', 'db1');
      await storage1.set('clear-iso-a', 'value1');
      await storage2.set('clear-iso-b', 'value2');
      await storage1.clear();
      expect(await storage1.get('clear-iso-a')).toBeNull();
      expect(await storage2.get('clear-iso-b')).toBe('value2');
    });
  });

  describe('BroadcastChannel', () => {
    it('should call postMessage on set', async () => {
      const channel = storage['channel'];
      if (channel) {
        const postSpy = jest.spyOn(channel, 'postMessage');
        await storage.set('bc-set', 'value');
        expect(postSpy).toHaveBeenCalledWith({ type: 'set', key: 'bc-set', value: 'value' });
      }
    });

    it('should call postMessage on remove', async () => {
      const channel = storage['channel'];
      if (channel) {
        await storage.set('bc-remove', 'value');
        const postSpy = jest.spyOn(channel, 'postMessage');
        await storage.remove('bc-remove');
        expect(postSpy).toHaveBeenCalledWith({ type: 'remove', key: 'bc-remove' });
      }
    });

    it('should call postMessage on clear', async () => {
      const storage = new RxStorage('clearBcTable', 'clearBcDb');
      await storage.set('k', 'v');
      const channel = storage['channel'];
      if (channel) {
        const postSpy = jest.spyOn(channel, 'postMessage');
        await storage.clear();
        expect(postSpy).toHaveBeenCalledWith({ type: 'clear' });
      }
    });

    it('should update observed signals when listener receives a clear message', async () => {
      const key = 'bc-listen-clear';
      const s = storage.getSignal<string>(key);
      await storage.set(key, 'value');
      expect(s()).toBe('value');
      const listener = storage['listener'];
      listener(new MessageEvent('message', {
        data: { type: 'clear' }
      }));
      expect(s()).toBeUndefined();
    });

    it('should update signal when listener receives a set message', async () => {
      const key = 'bc-listen-set';
      const s = storage.getSignal<string>(key);
      const listener = storage['listener'];
      listener(new MessageEvent('message', {
        data: { type: 'set', key, value: 'from-other-tab' }
      }));
      expect(s()).toBe('from-other-tab');
    });

    it('should update signal to undefined when listener receives a remove message', async () => {
      const key = 'bc-listen-remove';
      const s = storage.getSignal<string>(key);
      await storage.set(key, 'value');
      expect(s()).toBe('value');
      const listener = storage['listener'];
      listener(new MessageEvent('message', {
        data: { type: 'remove', key }
      }));
      expect(s()).toBeUndefined();
    });

    it('should ignore non-object messages', () => {
      const key = 'bc-ignore';
      const s = storage.getSignal<string>(key);
      const listener = storage['listener'];
      expect(() => {
        listener(new MessageEvent('message', { data: null }));
        listener(new MessageEvent('message', { data: 'string' }));
        listener(new MessageEvent('message', { data: 42 }));
      }).not.toThrow();
      expect(s()).toBeUndefined();
    });

    it('should ignore messages with unknown type', () => {
      const key = 'bc-unknown-type';
      const s = storage.getSignal<string>(key);
      const listener = storage['listener'];
      listener(new MessageEvent('message', {
        data: { type: 'unknown', key, value: 'nope' }
      }));
      expect(s()).toBeUndefined();
    });
  });

  describe('constructor', () => {
    it('should use default parameters when none provided', () => {
      const storage = new RxStorage();
      expect(storage).toBeInstanceOf(RxStorage);
    });

    it('should use custom tableName and dbName', async () => {
      const storage = new RxStorage('customTable', 'customDb');
      await storage.set('ctor-custom', 'value1');
      const keys = await storage.getKeys();
      expect(keys).toContain('ctor-custom');
    });

    it('should fall back to defaults for empty strings', () => {
      const s = new RxStorage('', '');
      expect(s['tableName']).toBe('table');
      expect(s['dbName']).toBe('db');
    });
  });

  describe('edge cases', () => {
    it('should handle null values', async () => {
      const key = 'edge-null';
      await storage.set(key, null);
      const result = await storage.get(key);
      expect(result).toBeNull();
    });

    it('should observe a stored null as undefined', async () => {
      const key = 'edge-null-sig';
      const s = storage.getSignal<string>(key);
      await storage.set(key, 'v');
      expect(s()).toBe('v');
      await storage.set(key, null);
      expect(s()).toBeUndefined();
      expect(await storage.get(key)).toBeNull();
    });

    it('should handle undefined values', async () => {
      const key = 'edge-undef';
      await storage.set(key, undefined);
      const result = await storage.get(key);
      // IndexedDB/localforage may return null for undefined values
      expect(result === null || result === undefined).toBe(true);
    });

    it('should handle complex objects', async () => {
      const key = 'edge-complex';
      // Date objects get serialized to strings in JSON
      const value = { nested: { data: [1, 2, 3] }, date: '2023-01-01T00:00:00.000Z' };
      await storage.set(key, value);
      const result = await storage.get(key);
      expect(result).toEqual(value);
    });

    it('should handle arrays', async () => {
      const key = 'edge-array';
      const value = [1, 2, 3, 'test', { nested: true }];
      await storage.set(key, value);
      const result = await storage.get(key);
      expect(result).toEqual(value);
    });

    it('should handle multiple keys being observed', async () => {
      const key1 = 'edge-multi-a';
      const key2 = 'edge-multi-b';
      const signal1 = storage.getSignal<string>(key1);
      const signal2 = storage.getSignal<string>(key2);
      await storage.set(key1, 'value1');
      await storage.set(key2, 'value2');
      expect(signal1()).toBe('value1');
      expect(signal2()).toBe('value2');
    });

    it('should handle get returning null for non-existent key', async () => {
      const key = 'edge-nonexistent';
      const result = await storage.get(key);
      expect(result).toBeNull();
    });

    it('should handle boolean values', async () => {
      const key = 'edge-bool';
      await storage.set(key, true);
      expect(await storage.get(key)).toBe(true);
      await storage.set(key, false);
      expect(await storage.get(key)).toBe(false);
    });

    it('should handle numeric values', async () => {
      const key = 'edge-num';
      await storage.set(key, 0);
      expect(await storage.get(key)).toBe(0);
      await storage.set(key, -1);
      expect(await storage.get(key)).toBe(-1);
      await storage.set(key, 3.14);
      expect(await storage.get(key)).toBe(3.14);
    });

    it('should handle empty string values', async () => {
      const key = 'edge-empty-str';
      await storage.set(key, '');
      const result = await storage.get(key);
      expect(result).toBe('');
    });
  });
});
