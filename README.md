Reactive Storage
===============
<p align="center"><img src="./logo.svg" height="250px"></p>


Wrapper around [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) and [localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage).  

Allows to create databases and tables in both of them using a simple, Promise-based API.  

Modifications of the data can be observed using RxJS Observables or Angular Signals.

While observing a specific key, you will receive notifications about changes made not only in the current instance of the application but also in other tabs or windows.

> [!IMPORTANT]  
> Observables and signals will be created only upon demand, ensuring that no resources are wasted for keys that are not being observed.

## Uses
✳️ Angular 16 or 17 (Signals)  
✳️ RxJS 7 (Observables)  
✳️ localForage (IndexedDB)  

## Installation

[npm](https://www.npmjs.com/package/ngx-reactive-storage):  
```bash
npm i ngx-reactive-storage
```

Yarn:  
```bash
yarn add ngx-reactive-storage
```

## Usage

```ts
import { RxStorage } from "ngx-reactive-storage";

const storage = new RxStorage();

storage.set('hello', 'world!');

type ColorSchema = {
	contrast: 'low' | 'medium' | 'high';
	name: string;
};
const value = { contrast: 'low', name: 'black' } satisfies My;
storage.set<ColorSchema>('color-scheme', value);
```


API
===
```ts
export type ReactiveStorage = {
  /**
   * Returns value by the key
   */
  get<T = string>(key: string): Promise<T | null | undefined>;

  /**
   * Returns a hot observable (replay:1) and pushes the current value for this key.
   * Future modifications will be pushed to the returned observable.
   *
   * If localStorage is being used as the storage, the value will be pushed synchronously
   * (to allow you to read it synchronously or asynchronously).
   */
  getObservable<T>(key: string): Observable<T | undefined>;

  /**
   * Returns a signal with the current value for this key.
   * The key becomes "observed" and future modifications will be
   * written to the returned signal.
   *
   * If localStorage is being used as the storage, the value will be pushed synchronously.
   */
  getSignal<T>(key: string, options?: SignalOptions): Signal<T | undefined>;


  /**
   * Returns a signal with the current value for this key.
   * The key becomes "observed" and future modifications will be
   * written to the returned signal.
   *
   * The usage of the `set()` and `update()` methods of this signal will also update the storage key.
   *
   * If localStorage is being used as the storage, the value will be pushed synchronously.
   */
  getWritableSignal<T>(key: string, options?: SignalOptions): WritableSignal<T | undefined>;

  /**
   * Set a key-value pair
   */
  set<T>(key: string, value: T): Promise<void>;

  /**
   * Removes a key
   */
  remove(key: string): Promise<void>;

  /**
   * Returns keys of the current table (located in the current database).
   */
  getKeys(): Promise<string[]>;

  /**
   * Removes all keys of the current table (located in the current database).
   */
  clear(): Promise<void>;

  /**
   * Removes links to observables and signals; removes event listeners.
   */
  dispose(): void;
}
```

https://user-images.githubusercontent.com/526352/284077145-51b438e0-e0e7-416d-b38d-d55449983793.mov


## What storage to use
The recommended storage is **IndexedDB**, because it:  
1. Is supported by every browser alive;
2. Gives you gigabytes of space (60% of the disk in Chrome, 10 Gb in Firefox, [etc.](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria#other_web_technologies));
3. Has native separation by databases and tables.

**localStorage** is limited to just 5 Mb of space, but sometimes you need to read some data synchronously before you render something.  

Using this library, you can use all the nice additions, one API for both types of storages, and still read from localStorage synchronously when needed, using observables or signals.  

Example:
```ts
import { RxLocalStorage } from "ngx-reactive-storage";

const storage = new RxLocalStorage('settings', 'db1');

const colorSchema = storage.getSignal<ColorSchema>('color-schema')();

```

## Supported browsers
* Chrome: v54+
* Edge: v79+
* Firefox: v38+
* Safari: v15.4+
* Opera: v41+
* Chrome for Android: v115+
* Firefox for Android: v115+
* Safari iOS: v15.4+
