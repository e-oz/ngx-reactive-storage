import { type Signal, type ValueEqualityFn, type WritableSignal } from '@angular/core';
import localforage from 'localforage';
import type { Observable } from 'rxjs';
import { Observer } from './observer';
import type { ReactiveStorage, SignalOptions } from './types';

type KeyChange = {
  type: 'set' | 'remove';
  key: string;
  value?: unknown;
};

export class RxStorage implements ReactiveStorage {
  private readonly storage?: LocalForage;
  private readonly dbName: string;
  private readonly tableName: string;
  private readonly observer = new Observer(this);
  private readonly channel?: BroadcastChannel;
  private readonly listener = (event: MessageEvent) => {
    if (event.data && typeof event.data === 'object') {
      const msg = event.data as KeyChange;
      switch (msg.type) {
        case 'set':
          this.observer.set(msg.key, msg.value);
          break;
        case 'remove':
          this.observer.removed(msg.key);
          break;
      }
    }
  };

  /**
   * @param tableName - name of the table in DB. Use name of the feature or the component when possible.
   * @param dbName - DB name. Use application name when possible.
   */
  constructor(tableName: string = 'table', dbName: string = 'db') {
    this.tableName = tableName || 'table';
    this.dbName = dbName || 'db';

    if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined' && typeof window.indexedDB !== 'undefined') {
      this.storage = localforage.createInstance({ name: this.dbName, storeName: this.tableName });
      this.channel = new BroadcastChannel(this.dbName + '.' + this.tableName);
      this.channel.addEventListener('message', this.listener, { passive: true })
    }
  }

  get<T = string>(key: string): Promise<T | null | undefined> {
    return new Promise((resolve, reject) => {
      if (!this.storage) {
        resolve(undefined);
        return;
      }
      this.storage.getItem<T>(key).then((value) => {
        if (value !== null) {
          this.observer.set(key, value);
        }
        resolve(value);
      }).catch(reject);
    });
  }

  getObservable<T>(key: string): Observable<T | undefined> {
    const obs = this.observer.getObservable<T>(key, undefined);
    this.get(key).catch((e) => {
      console.error('RxStorage::getObservable', e);
    });
    return obs;
  }

  getSignal<T>(key: string): Signal<T | undefined>;

  getSignal<T>(key: string, options: SignalOptions & {
    initialValue: undefined,
    equal: ValueEqualityFn<T | undefined>;
  }): Signal<T | undefined>;

  getSignal<T>(key: string, options: SignalOptions & {
    initialValue: undefined,
  }): Signal<T | undefined>;

  getSignal<T>(key: string, options: SignalOptions & {
    initialValue: T;
  }): Signal<T>;

  getSignal<T>(key: string, options: SignalOptions & {
    initialValue: T;
    equal: ValueEqualityFn<T | undefined>;
  }): Signal<T>;

  getSignal<T>(key: string, options: SignalOptions & {
    initialValue: T;
    equal: undefined;
  }): Signal<T>;

  getSignal<T>(key: string, options?: SignalOptions & {
    initialValue?: T;
    equal?: ValueEqualityFn<T | undefined>;
  }): Signal<T> {
    const s = this.observer.getSignal<T>(key, options?.initialValue, options?.equal);
    this.get(key).catch((e) => {
      console.error('RxStorage::getSignal', e);
    });
    return s;
  }

  getWritableSignal<T>(key: string): WritableSignal<T | undefined>;

  getWritableSignal<T>(key: string, options: SignalOptions & {
    initialValue: undefined,
    equal: ValueEqualityFn<T | undefined>;
  }): WritableSignal<T | undefined>;

  getWritableSignal<T>(key: string, options: SignalOptions & {
    initialValue: undefined,
  }): WritableSignal<T | undefined>;

  getWritableSignal<T>(key: string, options: SignalOptions & {
    initialValue: T;
  }): WritableSignal<T>;

  getWritableSignal<T>(key: string, options: SignalOptions & {
    initialValue: T;
    equal: ValueEqualityFn<T | undefined>;
  }): WritableSignal<T>;

  getWritableSignal<T>(key: string, options: SignalOptions & {
    initialValue: T;
    equal: undefined;
  }): WritableSignal<T>;

  getWritableSignal<T>(key: string, options?: SignalOptions & {
    initialValue?: T;
    equal?: ValueEqualityFn<T | undefined>;
  }): WritableSignal<T> {
    const s = this.observer.getWritableSignal<T>(key, options?.initialValue, options?.equal);
    this.get(key).catch((e) => {
      console.error('RxStorage::getWritableSignal', e);
    });
    return s;
  }

  set(key: string, value: unknown): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.storage) {
        resolve();
        return;
      }
      this.storage.setItem(key, value).then(() => {
        this.observer.set(key, value);
        this.broadcastChange({
          type: 'set',
          key,
          value
        });
        resolve();
      }).catch(reject);
    });
  }

  remove(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.storage) {
        resolve();
        return;
      }
      this.storage.removeItem(key).then(() => {
        this.observer.removed(key);
        this.broadcastChange({
          type: 'remove',
          key,
        });
        resolve();
      }).catch(reject);
    });
  }

  getKeys(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      if (!this.storage) {
        resolve([]);
        return;
      }
      this.storage.keys().then((keys) => {
        resolve(keys);
      }).catch(reject);
    });
  }

  clear(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.storage) {
        resolve();
        return;
      }
      this.storage.keys().then((keys) => {
        keys.forEach((key) => this.observer.removed(key));
        this.storage?.clear().then(() => resolve()).catch(reject);
      }).catch(reject);
    });
  }

  dispose(): void {
    this.observer.dispose();
    if (this.channel) {
      this.channel.removeEventListener('message', this.listener);
      this.channel.close();
    }
  }

  private broadcastChange(change: KeyChange) {
    this.channel?.postMessage(change);
  }
}
