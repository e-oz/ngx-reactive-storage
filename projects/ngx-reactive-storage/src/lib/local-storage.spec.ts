import { RxLocalStorage } from './local-storage';

describe('LocalStorage', () => {
  let localStorageMock: Record<string, string>;
  let mockStorageEvent: StorageEvent;
  let originalLocalStorage: Storage;
  let localStorageSpy: jest.SpyInstance;

  beforeEach(() => {
    localStorageMock = {};
    originalLocalStorage = window.localStorage;
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (key: string) => localStorageMock[key] || null,
        setItem: (key: string, value: string) => {
          localStorageMock[key] = value;
          mockStorageEvent = new StorageEvent('storage', { key, newValue: value });
          window.dispatchEvent(mockStorageEvent);
        },
        removeItem: (key: string) => {
          delete localStorageMock[key];
          mockStorageEvent = new StorageEvent('storage', { key, newValue: null });
          window.dispatchEvent(mockStorageEvent);
        },
        clear: () => {
          localStorageMock = {};
          mockStorageEvent = new StorageEvent('storage', { key: null, newValue: null });
          window.dispatchEvent(mockStorageEvent);
        },
      },
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
      localStorage.setItem(storage['prefixed'](key), invalidValue);
      await expect(storage.get<string>(key)).rejects.toThrow();
    });
  });

  describe('remove', () => {
    it('removes the item from localStorage', async () => {
      const storage = new RxLocalStorage();
      const key = 'testKey';
      localStorage.setItem(storage['prefixed'](key), 'value');
      await storage.remove(key);
      expect(localStorage.getItem(storage['prefixed'](key))).toBeNull();
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
  });

  describe('dispose', () => {
    it('disposes the observer and removes the storage event listener', () => {
      const storage = new RxLocalStorage();
      storage.getObservable('test');
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
      storage.dispose();
      expect(removeEventListenerSpy).toHaveBeenCalledWith('storage', storage['listener']);
    });
  });
});
