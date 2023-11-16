import { Signal, type ValueEqualityFn, type WritableSignal } from '@angular/core';
import * as localForage from 'localforage';
import { Observable } from 'rxjs';
import { Observer } from "./observer";
import type { ReactiveStorage, SignalOptions } from './types';

type KeyChange = {
  type: 'set' | 'remove';
  key: string;
  value?: unknown;
};

export class RxStorage implements ReactiveStorage {
  private readonly store: LocalForage;
  private readonly dbName: string;
  private readonly tableName: string;
  private readonly observer = new Observer(this);
  private readonly channel: BroadcastChannel;
  private readonly listener = (event: MessageEvent) => {
    if (event.data && typeof event.data === 'object') {
      const msg = event.data as KeyChange;
      switch (msg.type) {
        case 'set':
          this.observer.set(msg.key, msg.value);
          break;
        case "remove":
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
    this.store = localForage.createInstance({ name: this.dbName, storeName: this.tableName });
    this.channel = new BroadcastChannel(this.dbName + '.' + this.tableName);
    this.channel.addEventListener('message', this.listener, { passive: true });
  }

  get<T = string>(key: string): Promise<T | null | undefined> {
    return new Promise((resolve, reject) => {
      this.store.getItem<T>(key).then((value) => {
        if (value !== null) {
          this.observer.set(key, value);
        }
        resolve(value);
      }).catch(e => reject(e));
    });
  }

  getObservable<T>(key: string): Observable<T | undefined> {
    const obs = this.observer.getObservable<T>(key, undefined);
    this.get(key).catch();
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
    this.get(key).catch();
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
    this.get(key).catch();
    return s;
  }

  set(key: string, value: unknown): Promise<void> {
    return new Promise((resolve, reject) => {
      this.store.setItem(key, value).then(() => {
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
      this.store.removeItem(key).then(() => {
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
    return this.store.keys();
  }

  clear(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.getKeys().then((keys) => {
        keys.forEach((key) => this.observer.removed(key));
        this.store.clear().then(() => resolve()).catch(reject);
      }).catch(reject);
    });
  }

  dispose(): void {
    this.observer.dispose();
    this.channel.removeEventListener('message', this.listener);
    this.channel.close();
  }

  private broadcastChange(change: KeyChange) {
    this.channel.postMessage(change);
  }
}
