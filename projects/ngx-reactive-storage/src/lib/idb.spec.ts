import { RxStorage } from './idb';
import 'fake-indexeddb/auto';

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
});
