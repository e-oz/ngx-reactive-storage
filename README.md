Reactive Storage
===============
<p align="center"><img src="./logo.svg" height="250px"></p>


Wrapper around [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) and [localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage).  

Allows to create databases and tables in both of them using a simple, Promise-based API.  

Modifications of the data can be observed using RxJS Observables or Angular Signals.

> [!IMPORTANT]
> Observables and signals will be created only upon demand, ensuring that no resources are wasted for keys that are not being observed.

## Uses
✳️ Angular 16 (Signals)  
✳️ RxJS 7 (Observables)  
✳️ localforage (IndexedDB)  

## Installation

```bash
npm i ngx-reactive-storage
```

```bash
yarn add ngx-reactive-storage
```

## Usage

```ts
import { RxStorage } from "ngx-reactive-storage";

const storage = new RxStorage();

storage.set('hello', 'world!');
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
  getSignal<T>(key: string): Signal<T | undefined>;

  /**
   * Set a key-value pair
   */
  set(key: string, value: unknown): Promise<void>;

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
