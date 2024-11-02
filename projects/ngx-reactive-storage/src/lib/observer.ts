import type { Signal, WritableSignal } from "@angular/core";
import { signal, type ValueEqualityFn } from "@angular/core";
import type { Observable} from "rxjs";
import { BehaviorSubject, shareReplay } from "rxjs";
import type { ReactiveStorage } from "./types";

let skipStorageSet = false;

export class Observer {
  constructor(private readonly storage: ReactiveStorage) {
  }

  private readonly observables = new Map<string, BehaviorSubject<unknown>>();
  private readonly signals = new Map<string, WritableSignal<unknown>>();

  /**
   * Pushes new value to observable (if it's not equal to previous),
   * sets signal value, if observable/signal was requested for this key.
   */
  public set(key: string, value: unknown) {
    const obs = this.observables.get(key);
    if (obs) {
      if (obs.getValue() !== value) {
        obs.next(value);
      }
    }

    const s = this.signals.get(key);
    if (s) {
      skipStorageSet = true;
      s.set(value);
      skipStorageSet = false;
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
      s.set(undefined);
    }
  }

  /**
   * Returns a hot observable (replay:1) and pushes the current value for this key.
   * The key becomes "observed" and future modifications will be pushed
   * to the returned observable.
   */
  public getObservable<T>(key: string, initialValue: unknown): Observable<T | undefined> {
    let obs = this.observables.get(key);
    if (!obs) {
      obs = new BehaviorSubject<unknown>(undefined);
      this.observables.set(key, obs);
    }
    if (initialValue !== null) {
      obs.next(initialValue);
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
      s = signal<T | undefined>(initialValue, { equal });
      this.signals.set(key, s);
    }
    if (initialValue !== undefined) {
      s.set(initialValue);
    }
    return s.asReadonly();
  }

  public getWritableSignal<T>(key: string, initialValue: T | undefined, equal?: ValueEqualityFn<T | undefined>): WritableSignal<T>;
  public getWritableSignal<T>(key: string, initialValue: undefined, equal?: ValueEqualityFn<T | undefined>): WritableSignal<T | undefined>;

  public getWritableSignal<T>(key: string, initialValue?: T, equal?: ValueEqualityFn<T | undefined>): WritableSignal<T> | WritableSignal<T | undefined> {
    let s = this.signals.get(key) as WritableSignal<T | undefined>;
    if (!s) {
      s = signal<T | undefined>(initialValue, { equal });
      const srcSet = s.set;
      s.set = (value: T) => {
        if (!skipStorageSet) {
          this.storage.set(key, value).catch(console?.error);
        }
        srcSet(value);
      }
      s.update = (updateFn: (value: T | undefined) => T | undefined) => {
        const value = updateFn(s());
        if (!skipStorageSet) {
          this.storage.set(key, value).catch(console?.error);
        }
        srcSet(value);
      }
      this.signals.set(key, s);
    }
    return s;
  }

  public dispose() {
    this.observables.clear();
    this.signals.clear();
  }
}
