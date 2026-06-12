import type { Signal, WritableSignal } from "@angular/core";
import { signal, type ValueEqualityFn } from "@angular/core";
import type { Observable} from "rxjs";
import { BehaviorSubject, shareReplay } from "rxjs";
import type { ReactiveStorage } from "./types";

export class Observer {
  constructor(private readonly storage: ReactiveStorage) {
  }

  private readonly observables = new Map<string, BehaviorSubject<unknown>>();
  private readonly signals = new Map<string, WritableSignal<unknown>>();
  private readonly patchedSignals = new WeakSet<object>();
  // While true, the patched set()/update() of writable signals must not write
  // to the storage: the value is being applied FROM the storage.
  private skipStorageSet = false;

  /**
   * Pushes new value to observable (if it's not equal to previous),
   * sets signal value, if observable/signal was requested for this key.
   *
   * `null` is normalized to `undefined`: observables and signals only
   * expose `T | undefined` values.
   */
  public set(key: string, value: unknown) {
    if (value === null) {
      value = undefined;
    }
    const obs = this.observables.get(key);
    if (obs) {
      if (obs.getValue() !== value) {
        obs.next(value);
      }
    }

    const s = this.signals.get(key);
    if (s) {
      this.skipStorageSet = true;
      try {
        s.set(value);
      } finally {
        this.skipStorageSet = false;
      }
    }
  }

  /**
   * Pushes `undefined` to the observable/signal related to this key,
   * if such observable/signal was requested.
   */
  public removed(key: string) {
    const obs = this.observables.get(key);
    if (obs) {
      obs.next(undefined);
    }

    const s = this.signals.get(key);
    if (s) {
      this.skipStorageSet = true;
      try {
        s.set(undefined);
      } finally {
        this.skipStorageSet = false;
      }
    }
  }

  /**
   * Pushes `undefined` to every observable/signal that was requested.
   */
  public cleared() {
    const keys = new Set<string>([...this.observables.keys(), ...this.signals.keys()]);
    keys.forEach((key) => this.removed(key));
  }

  /**
   * Returns a hot observable (replay:1) and pushes the current value for this key.
   * The key becomes "observed" and future modifications will be pushed
   * to the returned observable.
   */
  public getObservable<T>(key: string, initialValue: unknown): Observable<T | undefined> {
    let obs = this.observables.get(key);
    if (!obs) {
      obs = new BehaviorSubject<unknown>(initialValue ?? undefined);
      this.observables.set(key, obs);
    }
    return obs.pipe(
      shareReplay({ refCount: true, bufferSize: 1 })
    ) as unknown as Observable<T | undefined>;
  }

  /**
   * Returns a signal and sets the current value for this key.
   * The key becomes "observed" and future modifications will be
   * written to the returned signal.
   */
  public getSignal<T>(key: string, initialValue: T | undefined, equal?: ValueEqualityFn<T | undefined>): Signal<T>;
  public getSignal<T>(key: string, initialValue: undefined, equal?: ValueEqualityFn<T | undefined>): Signal<T | undefined>;

  public getSignal<T>(key: string, initialValue?: T, equal?: ValueEqualityFn<T | undefined>): Signal<T> | Signal<T | undefined> {
    let s = this.signals.get(key) as WritableSignal<T | undefined>;
    if (!s) {
      s = signal<T | undefined>(initialValue ?? undefined, { equal });
      this.signals.set(key, s);
    }
    return s.asReadonly();
  }

  public getWritableSignal<T>(key: string, initialValue: T | undefined, equal?: ValueEqualityFn<T | undefined>): WritableSignal<T>;
  public getWritableSignal<T>(key: string, initialValue: undefined, equal?: ValueEqualityFn<T | undefined>): WritableSignal<T | undefined>;

  public getWritableSignal<T>(key: string, initialValue?: T, equal?: ValueEqualityFn<T | undefined>): WritableSignal<T> | WritableSignal<T | undefined> {
    let s = this.signals.get(key) as WritableSignal<T | undefined>;
    if (!s) {
      s = signal<T | undefined>(initialValue ?? undefined, { equal });
      this.signals.set(key, s);
    }
    // The signal might have been created by getSignal() — its set() and update()
    // are patched here, on the first getWritableSignal() call for this key.
    if (!this.patchedSignals.has(s)) {
      this.patchedSignals.add(s);
      const srcSet = s.set;
      s.set = (value: T) => {
        if (!this.skipStorageSet) {
          this.storage.set(key, value).catch(console?.error);
        }
        srcSet(value);
      }
      s.update = (updateFn: (value: T | undefined) => T | undefined) => {
        const value = updateFn(s());
        if (!this.skipStorageSet) {
          this.storage.set(key, value).catch(console?.error);
        }
        srcSet(value);
      }
    }
    return s;
  }

  public dispose() {
    this.observables.clear();
    this.signals.clear();
  }
}
