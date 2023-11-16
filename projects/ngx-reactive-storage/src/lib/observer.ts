import { Signal, signal, type ValueEqualityFn, WritableSignal } from "@angular/core";
import { BehaviorSubject, Observable, shareReplay } from "rxjs";

export class Observer {
  private readonly observables = new Map<string, BehaviorSubject<unknown>>();
  private readonly signals = new Map<string, WritableSignal<unknown>>();

  /**
   * Pushes new value to observable (if it's not equal to previous),
   * sets signal value, if observable/signal was requested for this key.
   */
  public set(key: string, value: unknown) {
    let obs = this.observables.get(key);
    if (obs) {
      if (obs.getValue() !== value) {
        obs.next(value);
      }
    }

    let s = this.signals.get(key);
    if (s) {
      s.set(value);
    }
  }

  /**
   * Pushes `undefined` to the observable/signal related to this key,
   * if such observable/signal was requested.
   */
  public removed(key: string) {
    let obs = this.observables.get(key);
    if (obs) {
      obs.next(undefined);
    }

    let s = this.signals.get(key);
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
  public getSignal<T>(key: string, initialValue: T, equal?: ValueEqualityFn<T | undefined>): Signal<T>;
  public getSignal<T>(key: string, initialValue: undefined, equal?: ValueEqualityFn<T | undefined>): Signal<T | undefined>;
  public getSignal<T>(key: string, initialValue: T, equal?: ValueEqualityFn<T | undefined>): Signal<T> {
    let s = this.signals.get(key) as WritableSignal<T>;
    if (!s) {
      s = signal<T>(initialValue, { equal });
      this.signals.set(key, s);
    }
    s.set(initialValue);
    return s.asReadonly();
  }

  public dispose() {
    this.observables.clear();
    this.signals.clear();
  }
}
