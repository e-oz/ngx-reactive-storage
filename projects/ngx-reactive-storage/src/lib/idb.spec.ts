import { RxStorage } from './idb';
import 'fake-indexeddb/auto';
import { Observable } from "rxjs";

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
});
