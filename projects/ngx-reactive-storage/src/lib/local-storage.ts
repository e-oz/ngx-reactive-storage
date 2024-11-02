import type { Injector } from '@angular/core';
import { afterNextRender, isDevMode, type Signal, type ValueEqualityFn, type WritableSignal } from '@angular/core';
import type { Observable } from 'rxjs';
import { Observer } from "./observer";
import type { ReactiveStorage, SignalOptions } from './types';

type Key = string;

type PrefixedKey = Key & { __key: 'prefixed' };

export class RxLocalStorage implements ReactiveStorage {
  private readonly tableName: string;
  private readonly dbName: string;
  private readonly delimiter: string;
  private readonly observer = new Observer(this);
  private isListening = false;
  private observedKeys = new Set<PrefixedKey>();
  private readonly listener = (event: StorageEvent) => {
    if (event.key && this.observedKeys.has(event.key as PrefixedKey)) {
      try {
        const key = this.unprefixed(event.key);
        if (key) {
          const value = event.newValue == null ? event.newValue : JSON.parse(event.newValue);
          this.observer.set(key, value);
        }
      } catch (_) {

      }
    }
  };

  /**
   * @param tableName - name of the table in DB. Use name of the feature or the component when possible.
   * @param dbName - DB name. Use application name when possible.
   * @param delimiter - delimiter between dbName, tableName and key (localStorage only have keys, this way we can separate them by db and tables).
   * @param injector - pass an Injector instance to make it work with SSR
   */
  constructor(tableName: string = 'table', dbName: string = 'db', delimiter: string = '|~:%:^|', private injector?: Injector) {
    this.delimiter = delimiter || '|~:%:^|';
    this.dbName = dbName || 'db';
    this.tableName = tableName || 'table';
  }

  getObservable<T>(key: string): Observable<T | undefined> {
    let value: T | undefined;
    let obs: Observable<T | undefined> | undefined = undefined;
    this.whenStorageIsReady((storage) => {
      const str = storage.getItem(this.prefixed(key));
      if (str !== null) {
        try {
          value = JSON.parse(str);
          if (obs) { // if this variable is defined, it was async call and initial value was not set
            this.observer.set(key, value);
          }
        } catch (_) {
        }
      }
      this.startListening(key);
    });
    obs = this.observer.getObservable<T>(key, value);
    return obs;
  }

  getSignal<T>(key: string): Signal<T | undefined>;

  getSignal<T>(key: string, options: SignalOptions & {
    equal: ValueEqualityFn<T | undefined>;
  }): Signal<T | undefined>;

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
    let value = options?.initialValue;
    let s: Signal<T> | undefined = undefined;

    this.whenStorageIsReady((storage) => {
      const str = storage.getItem(this.prefixed(key));
      if (str !== null) {
        try {
          value = JSON.parse(str);
          if (s) { // if this variable is defined, it was async call and initial value was not set
            this.observer.set(key, value);
          }
        } catch (_) {
        }
      }
      this.startListening(key);
    });
    s = this.observer.getSignal<T>(key, value, options?.equal);
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
    let value = options?.initialValue;
    let s: WritableSignal<T> | undefined = undefined;
    this.whenStorageIsReady((storage) => {
      const str = storage.getItem(this.prefixed(key));
      if (str !== null) {
        try {
          value = JSON.parse(str);
          if (s) { // if this variable is defined, it was async call and initial value was not set
            this.observer.set(key, value);
          }
        } catch (_) {
        }
      }
      this.startListening(key);
    });
    s = this.observer.getWritableSignal<T>(key, value, options?.equal);
    return s;
  }

  get<T = string>(key: string): Promise<T | null | undefined> {
    return new Promise((resolve, reject) => {
      this.whenStorageIsReady((storage) => {
        try {
          const str = storage.getItem(this.prefixed(key));
          if (str === null) {
            this.observer.removed(key);
            resolve(str);
            return;
          }
          resolve(JSON.parse(str));
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  getKeys(): Promise<string[]> {
    return new Promise((resolve) => {
      this.whenStorageIsReady((storage) => {
        resolve(Object.keys(storage).map(
          (k) => this.unprefixed(k)
        ).filter(key => key !== undefined) as string[])
      });
    });
  }

  remove(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.whenStorageIsReady((storage) => {
        try {
          storage.removeItem(this.prefixed(key));
          this.observer.removed(key);
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  set(key: string, value: unknown): Promise<void> {
    return new Promise((resolve, reject) => {
      this.whenStorageIsReady((storage) => {
        try {
          const v = JSON.stringify(value);
          storage.setItem(this.prefixed(key), v);
          this.observer.set(key, value);
          resolve(undefined);
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  clear(): Promise<void> {
    return new Promise((resolve) => {
      this.getKeys().then((keys) => {
        const requests: Promise<void>[] = [];
        keys.forEach((key) => requests.push(this.remove(key)));
        Promise.all(requests).then(() => resolve());
      });
    });
  }

  dispose() {
    this.observer.dispose();
    this.observedKeys.clear();
    if (this.isListening) {
      try {
        if (typeof window !== 'undefined') {
          window.removeEventListener('storage', this.listener);
        }
      } catch (_) {
      }
    }
  }

  private prefixed(key: Key): PrefixedKey {
    return [this.dbName, this.tableName, key].join(this.delimiter) as PrefixedKey;
  }

  private unprefixed(key: string): Key | undefined {
    const parts = key.split(this.delimiter);
    if (parts.length < 3) {
      return undefined;
    }
    if (parts[0] !== this.dbName) {
      return undefined;
    }
    if (parts[1] !== this.tableName) {
      return undefined;
    }
    return parts[2];
  }

  private startListening(key: Key) {
    this.observedKeys.add(this.prefixed(key));
    if (!this.isListening) {
      this.isListening = true;
      if (typeof window !== 'undefined') {
        window.addEventListener('storage', this.listener, { passive: true });
      } else {
        afterNextRender(() => {
          window.addEventListener('storage', this.listener, { passive: true });
        }, { injector: this.injector });
      }
    }
  }

  private whenStorageIsReady(cb: (storage: Storage) => unknown): void {
    if (typeof localStorage !== 'undefined') {
      cb(localStorage);
    } else {
      if (!this.injector) {
        if (isDevMode()) {
          console.error('RxLocalStorage:: For SSR, please provide an Injector instance in the constructor.');
        }
      }
      afterNextRender(() => {
        if (typeof localStorage !== 'undefined') {
          cb(localStorage);
        } else {
          if (isDevMode()) {
            console.trace('RxLocalStorage:: localStorage is undefined in afterNextRender().');
          }
        }
      }, { injector: this.injector });
    }
  }
}
