import { Signal } from '@angular/core';
import { Observable } from 'rxjs';
import type { ReactiveStorage } from './types';
import { Observer } from "./observer";

type Key = string;

type PrefixedKey = Key & { __key: 'prefixed' };

export class RxLocalStorage implements ReactiveStorage {
  private readonly tableName: string;
  private readonly dbName: string;
  private readonly delimiter: string;
  private readonly observer = new Observer();
  private isListening = false;
  private observedKeys = new Set<PrefixedKey>();
  private readonly listener = (event: StorageEvent) => {
    if (event.key && this.observedKeys.has(event.key as PrefixedKey)) {
      try {
        const key = this.unprefixed(event.key);
        if (key) {
          const value = event.newValue == null ? event.newValue : JSON.parse(event.newValue);
          this.observer.fetched(key, value);
        }
      } catch (_) {

      }
    }
  };

  constructor(tableName: string = 'table', dbName: string = 'db', delimiter: string = '|~:%:^|') {
    this.delimiter = delimiter || '|~:%:^|';
    this.dbName = dbName || 'db';
    this.tableName = tableName || 'table';
  }

  public getObservable<T>(key: string): Observable<T | undefined> {
    const str = localStorage.getItem(this.prefixed(key));
    let value: T | undefined;
    if (str !== null) {
      try {
        value = JSON.parse(str);
      } catch (_) {
      }
    }
    this.startListening(key);
    return this.observer.getObservable<T>(key, value);
  }

  public getSignal<T>(key: string): Signal<T | undefined> {
    const str = localStorage.getItem(this.prefixed(key));
    let value: T | undefined;
    if (str !== null) {
      try {
        value = JSON.parse(str);
      } catch (_) {
      }
    }
    this.startListening(key);
    return this.observer.getSignal<T>(key, value);
  }

  public get<T = string>(key: string): Promise<T | null | undefined> {
    return new Promise((resolve, reject) => {
      try {
        const str = localStorage.getItem(this.prefixed(key));
        if (str === null) {
          this.observer.removed(key);
          resolve(str);
          return;
        }
        const value = JSON.parse(str);
        this.observer.fetched(key, value);
        resolve(value);
      } catch (e) {
        reject(e);
      }
    });
  }

  public getKeys(): Promise<string[]> {
    return Promise.resolve(
      Object.keys(localStorage).map(
        (k) => this.unprefixed(k)
      ).filter(key => key !== undefined) as string[]
    );
  }

  public remove(key: string): Promise<void> {
    try {
      localStorage.removeItem(this.prefixed(key));
      this.observer.removed(key);
      return Promise.resolve();
    } catch (e) {
      return Promise.reject(e);
    }
  }

  public set(key: string, value: unknown): Promise<void> {
    try {
      const v = JSON.stringify(value);
      localStorage.setItem(this.prefixed(key), v);
      this.observer.set(key, value);
      return Promise.resolve(undefined);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  public clear(): Promise<void> {
    return new Promise((resolve) => {
      this.getKeys().then((keys) => {
        const requests: Promise<void>[] = [];
        keys.forEach((key) => requests.push(this.remove(key)));
        Promise.all(requests).then(() => resolve());
      });
    });
  }

  public dispose() {
    this.observer.dispose();
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
