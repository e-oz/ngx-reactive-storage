import type { Signal, ValueEqualityFn, WritableSignal } from "@angular/core";
import type { Observable } from "rxjs";

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

export type SignalOptions<T = unknown> = {
  initialValue?: unknown;
  equal?: ValueEqualityFn<T>;
};
