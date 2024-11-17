import type { Signal } from '@angular/core';
import { type ValueEqualityFn, type WritableSignal } from '@angular/core';
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
          const value = event.newValue == null ?
            event.newValue
            : event.newValue === 'undefined' ? undefined : JSON.parse(event.newValue);
          this.observer.set(key, value);
        }
      } catch (e) {
        console.error('RxLocalStorage::listener', e);
      }
    }
  };

  constructor(tableName: string = 'table', dbName: string = 'db', delimiter: string = '|~:%:^|') {
    this.delimiter = delimiter || '|~:%:^|';
    this.dbName = dbName || 'db';
    this.tableName = tableName || 'table';
  }

  getObservable<T>(key: string): Observable<T | undefined> {
    let value: T | undefined;
    if (typeof localStorage !== 'undefined') {
      const str = localStorage.getItem(this.prefixed(key));
      if (str !== null) {
        try {
          value = JSON.parse(str);
        } catch (_) {
        }
      }
      this.startListening(key);
    }
    return this.observer.getObservable<T>(key, value);
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
    if (typeof localStorage !== 'undefined') {
      const str = localStorage.getItem(this.prefixed(key));
      if (str !== null) {
        try {
          value = JSON.parse(str);
        } catch (_) {
        }
      }
      this.startListening(key);
    }
    return this.observer.getSignal<T>(key, value, options?.equal);
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
    if (typeof localStorage !== 'undefined') {
      const str = localStorage.getItem(this.prefixed(key));
      if (str !== null) {
        try {
          value = JSON.parse(str);
        } catch (_) {
        }
      }
      this.startListening(key);
    }
    return this.observer.getWritableSignal<T>(key, value, options?.equal);
  }

  get<T = string>(key: string): Promise<T | null | undefined> {
    return new Promise((resolve, reject) => {
      if (typeof localStorage !== 'undefined') {
        try {
          const str = localStorage.getItem(this.prefixed(key));
          if (str === null) {
            this.observer.removed(key);
            resolve(str);
            return;
          }
          resolve(JSON.parse(str));
        } catch (e) {
          reject(e);
        }
      } else {
        resolve(undefined);
      }
    });
  }

  getKeys(): Promise<string[]> {
    return Promise.resolve(
      typeof localStorage === 'undefined' ? [] :
        Object.keys(localStorage).map(
          (k) => this.unprefixed(k)
        ).filter(key => key !== undefined) as string[]
    );
  }

  remove(key: string): Promise<void> {
    if (typeof localStorage === 'undefined') {
      return Promise.resolve();
    }
    try {
      localStorage.removeItem(this.prefixed(key));
      this.observer.removed(key);
      return Promise.resolve();
    } catch (e) {
      return Promise.reject(e);
    }
  }

  set(key: string, value: unknown): Promise<void> {
    if (typeof localStorage === 'undefined') {
      return Promise.resolve();
    }
    try {
      const v = JSON.stringify(value);
      localStorage.setItem(this.prefixed(key), v);
      this.observer.set(key, value);
      return Promise.resolve(undefined);
    } catch (e) {
      return Promise.reject(e);
    }
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
        window.removeEventListener('storage', this.listener);
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
      window.addEventListener('storage', this.listener, { passive: true });
    }
  }
}
