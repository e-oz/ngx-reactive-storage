Reactive Storage
===============
<p align="center"><img src="./logo.svg" height="250px"></p>


Wrapper around [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) and [localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage).  

Allows to create databases and tables in both of them using a simple API.  

Modifications of the data can be observed using RxJS Observables or Angular Signals.

> [!IMPORTANT]
> While observing a specific key, you will receive notifications about changes made not only in the current instance of the application but also in other tabs or windows. 
> It opens a lot of interesting opportunities for data synchronization across tabs and windows.

Observables and signals will be created only upon demand, ensuring that no resources are wasted for keys that are not being observed.

## Uses
✳️ Angular v19+  
✳️ TypeScript 5.6+  
✳️ RxJS v7+  
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

const colorScheme = storage.getSignal('color-scheme')();

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


Documentation
=============

## Table of Contents

- [Storage Implementations](#storage-implementations)
  - [IndexedDB — `RxStorage`](#indexeddb--rxstorage)
  - [localStorage — `RxLocalStorage`](#localstorage--rxlocalstorage)
- [Databases and Tables](#databases-and-tables)
- [Reading and Writing Data](#reading-and-writing-data)
  - [Set a value](#set-a-value)
  - [Get a value](#get-a-value)
  - [Remove a value](#remove-a-value)
  - [List all keys](#list-all-keys)
  - [Clear all keys](#clear-all-keys)
- [Observing Changes with Observables](#observing-changes-with-observables)
- [Observing Changes with Signals](#observing-changes-with-signals)
  - [Read-only Signal](#read-only-signal)
  - [Writable Signal](#writable-signal)
  - [Initial values](#initial-values)
  - [Custom equality function](#custom-equality-function)
  - [Idempotent creation and coexistence](#idempotent-creation-and-coexistence)
- [Cross-Tab Synchronization](#cross-tab-synchronization)
- [As a global (singleton) service](#as-a-global-singleton-service)
- [As a feature-level service](#as-a-feature-level-service)
- [Using signals in a component template](#using-signals-in-a-component-template)
- [Two-way binding with writable signals](#two-way-binding-with-writable-signals)
- [SSR Compatibility](#ssr-compatibility)
- [Cleanup and Disposal](#cleanup-and-disposal)
  - [Disposing observers — `dispose()`](#disposing-observers--dispose)
  - [Clearing stored data — `clear()`](#clearing-stored-data--clear)
- [Storing Complex Data](#storing-complex-data)
- [Recipes](#recipes)
  - [Persisted user preferences](#persisted-user-preferences)
  - [Caching API responses](#caching-api-responses)
  - [Theme switcher synced across tabs](#theme-switcher-synced-across-tabs)
  - [Swapping storage backends with `ReactiveStorage`](#swapping-storage-backends-with-reactivestorage)
  - [Migrating from raw `localStorage` / `IndexedDB`](#migrating-from-raw-localstorage--indexeddb)

---

## Storage Implementations

The library provides two classes that implement the same `ReactiveStorage` interface. You can swap one for the other without changing the rest of your code.

### IndexedDB — `RxStorage`

Backed by [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) (via [localforage](https://github.com/localForage/localForage)). Cross-tab notifications are delivered through [BroadcastChannel](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel).

```ts
import { RxStorage } from "ngx-reactive-storage";

const storage = new RxStorage("settings", "my-app");
```

**Constructor:**

| Parameter   | Type     | Default   | Description                                         |
| ----------- | -------- | --------- | --------------------------------------------------- |
| `tableName` | `string` | `'table'` | Name of the object store (table) inside the database |
| `dbName`    | `string` | `'db'`    | Name of the IndexedDB database                       |

### localStorage — `RxLocalStorage`

Backed by [localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage). Cross-tab notifications are delivered through the native [`storage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event) event.

Values are automatically serialized and deserialized via `JSON.stringify` / `JSON.parse`.

With `RxLocalStorage`, observables and signals are populated **synchronously** — the value is available immediately after calling `getSignal()` or `getObservable()`.

```ts
import { RxLocalStorage } from "ngx-reactive-storage";

const storage = new RxLocalStorage("settings", "my-app");

// The signal already holds the stored value (synchronously):
const lang = storage.getSignal<string>("language");
console.log(lang()); // e.g. "en"
```

**Constructor:**

| Parameter   | Type     | Default      | Description                                                          |
| ----------- | -------- | ------------ | -------------------------------------------------------------------- |
| `tableName` | `string` | `'table'`    | Logical table name (used to namespace keys)                           |
| `dbName`    | `string` | `'db'`       | Logical database name (used to namespace keys)                        |
| `delimiter` | `string` | `'\|~:%:^\|'` | Separator between `dbName`, `tableName`, and `key` in the actual key |

---

## Databases and Tables

Both `RxStorage` and `RxLocalStorage` support logical separation of data into databases and tables. This prevents key collisions when multiple features (or even multiple apps on the same origin) store data side by side.

```ts
// Feature: user settings
const settingsStorage = new RxStorage("settings", "my-app");

// Feature: recent searches
const searchStorage = new RxStorage("recent-searches", "my-app");

// A completely different app on the same origin
const otherAppStorage = new RxStorage("config", "other-app");
```

For `RxStorage`, this maps directly to IndexedDB databases and object stores.  
For `RxLocalStorage`, the `dbName`, `tableName`, and `key` are joined with the delimiter to form the actual `localStorage` key (e.g. `my-app|~:%:^|settings|~:%:^|color-scheme`).

---

## Reading and Writing Data

All read/write methods return `Promise`s, making the API consistent across both storage backends.

### Set a value

```ts
storage.set("theme", "dark");
storage.set("counter", 42);
storage.set("user", { name: "Alice", role: "admin" });
```

Any JSON-serializable value can be stored. With `RxStorage` (IndexedDB), binary data like `ArrayBuffer` and `Blob` are also supported.

### Get a value

```ts
const theme = await storage.get<string>("theme");
// "dark"

const user = await storage.get<{ name: string; role: string }>("user");
// { name: "Alice", role: "admin" }

const missing = await storage.get("nonexistent-key");
// null
```

The generic type parameter lets you specify the expected return type. The default type is `string`, so `storage.get("key")` is equivalent to `storage.get<string>("key")`.

**Return value when the key is missing:**

| Scenario                     | Returns     |
| ---------------------------- | ----------- |
| Key does not exist (browser) | `null`      |
| Browser APIs not available (SSR) | `undefined` |

### Remove a value

```ts
await storage.remove("theme");
```

After removal, any signal or observable watching this key will receive `undefined`.

### List all keys

```ts
const keys = await storage.getKeys();
// ["theme", "counter", "user"]
```

Returns only keys that belong to the current table in the current database.

### Clear all keys

```ts
await storage.clear();
```

Removes all keys in the current table. Keys in other tables or databases are not affected. All observing signals and observables will receive `undefined`.

---

## Observing Changes with Observables

`getObservable()` returns a hot `Observable` (backed by `BehaviorSubject` with `shareReplay({ refCount: true, bufferSize: 1 })`). The current value is pushed immediately upon subscription, and every future modification to that key is pushed to all subscribers.

```ts
import type { Observable } from "rxjs";

const theme$: Observable<string | undefined> = storage.getObservable<string>("theme");

// Subscribing immediately receives the current value (or `undefined` if the key doesn't exist)
theme$.subscribe((value) => {
  console.log("Theme changed:", value);
});

// Later:
storage.set("theme", "dark");
// Console: "Theme changed: dark"

await storage.remove("theme");
// Console: "Theme changed: undefined"
```

Observables are created lazily — calling `getObservable()` for a key that nobody asked about before allocates a `BehaviorSubject`. Calling it again for the same key returns the same underlying stream.

> **Note:** Unlike `getSignal()` and `getWritableSignal()`, `getObservable()` does not accept options — there is no `initialValue` or `equal` parameter. The observable always starts with `undefined` if the key has no stored value.

Multiple subscribers share the same observable:

```ts
const theme$ = storage.getObservable<string>("theme");

theme$.subscribe((v) => console.log("Subscriber A:", v));
theme$.subscribe((v) => console.log("Subscriber B:", v));

storage.set("theme", "light");
// Both subscribers receive "light"
```

---

## Observing Changes with Signals

### Read-only Signal

`getSignal()` returns a read-only `Signal`. The storage key becomes "observed" — every call to `storage.set()` or `storage.remove()` for that key will update the signal.

```ts
import type { Signal } from "@angular/core";

const theme: Signal<string | undefined> = storage.getSignal<string>("theme");

console.log(theme()); // undefined (no value stored yet)

storage.set("theme", "dark");
console.log(theme()); // "dark"
```

### Writable Signal

`getWritableSignal()` returns a `WritableSignal`. It works like a regular signal, **but writing to it also writes to the storage automatically**:

```ts
import type { WritableSignal } from "@angular/core";

const counter: WritableSignal<number | undefined> = storage.getWritableSignal<number>("counter");

// Reading from storage → signal:
storage.set("counter", 10);
console.log(counter()); // 10

// Writing to signal → storage:
counter.set(20);
console.log(await storage.get("counter")); // 20

// Using update():
counter.update((current) => (current ?? 0) + 1);
console.log(counter()); // 21
console.log(await storage.get("counter")); // 21
```

This makes `getWritableSignal()` ideal for two-way binding scenarios where both the component and the storage need to stay in sync.

### Initial values

Both `getSignal()` and `getWritableSignal()` accept an `initialValue` option. The signal will hold this value until the actual stored value is loaded.

For `RxStorage` (IndexedDB), the stored value is loaded asynchronously, so `initialValue` lets you avoid an initial `undefined` flash:

```ts
// Without initialValue:
const theme = storage.getSignal<string>("theme");
console.log(theme()); // undefined (until IndexedDB responds)

// With initialValue:
const theme = storage.getSignal<string>("theme", { initialValue: "system" });
console.log(theme()); // "system" (immediately, before IndexedDB responds)
// Once IndexedDB responds with the actual value, the signal updates automatically.
```

For `RxLocalStorage`, the stored value is read synchronously, so `initialValue` serves as a fallback when the key doesn't exist yet:

```ts
const lang = storage.getSignal<string>("language", { initialValue: "en" });
// If "language" is in localStorage → signal holds the stored value
// If "language" is not in localStorage → signal holds "en"
```

When `initialValue` is provided and is of type `T`, the returned signal's type narrows from `Signal<T | undefined>` to `Signal<T>`:

```ts
// Type: Signal<string | undefined>
const a = storage.getSignal<string>("key");

// Type: Signal<string>
const b = storage.getSignal<string>("key", { initialValue: "default" });
```

### Custom equality function

Both `getSignal()` and `getWritableSignal()` accept a custom `equal` function to control when the signal notifies consumers of a change:

```ts
const name = storage.getSignal<string>("username", {
  equal: (a, b) => {
    if (typeof a !== "string" || typeof b !== "string") return a === b;
    return a.toLowerCase() === b.toLowerCase();
  },
});

// The signal will NOT notify consumers when the value changes
// from "Alice" to "alice" (case-insensitive equality).
```

The same works for writable signals:

```ts
const label = storage.getWritableSignal<string>("label", {
  equal: (a, b) => a?.trim() === b?.trim(),
});
```

You can combine `initialValue` and `equal` in a single options object:

```ts
const fontSize = storage.getWritableSignal<number>("font-size", {
  initialValue: 16,
  equal: (a, b) => Math.abs((a ?? 0) - (b ?? 0)) < 0.5,
});
```

### Idempotent creation and coexistence

Calling `getSignal()` or `getWritableSignal()` multiple times for the **same key** returns the same underlying signal — a new signal is not allocated on every call:

```ts
const a = storage.getSignal<string>("theme");
const b = storage.getSignal<string>("theme");
// a and b share the same underlying signal
```

You can also observe the same key with **both** an observable and a signal simultaneously. They are maintained independently and both receive updates:

```ts
const theme$ = storage.getObservable<string>("theme");
const theme = storage.getSignal<string>("theme");

storage.set("theme", "dark");
// theme$ emits "dark", theme() returns "dark"
```

---

## Cross-Tab Synchronization

One of the key features of this library is automatic synchronization across browser tabs and windows.

**`RxStorage` (IndexedDB)** uses [BroadcastChannel](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel). When a value is set or removed, a message is posted to all other tabs listening on the same `dbName.tableName` channel. Their observables and signals update automatically.

**`RxLocalStorage`** uses the native [`storage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event) event, which fires in every tab **except** the one that made the change. The library listens for this event and updates any observed keys.

This means:

```ts
// Tab A
const storage = new RxStorage("settings", "my-app");
const theme = storage.getSignal<string>("theme");

// Tab B
const storage = new RxStorage("settings", "my-app");
storage.set("theme", "dark");

// Tab A: theme() is now "dark" — updated automatically!
```

No additional setup is needed. Cross-tab sync works out of the box for every key that is being observed (via `getObservable()`, `getSignal()`, or `getWritableSignal()`).

---

### As a global (singleton) service

Create a service with `providedIn: 'root'` to share the storage instance across the entire application:

```ts
import { Injectable } from "@angular/core";
import { RxStorage } from "ngx-reactive-storage";
import type { ReactiveStorage } from "ngx-reactive-storage";

@Injectable({ providedIn: "root" })
export class AppStorageService {
  readonly settings: ReactiveStorage = new RxStorage("settings", "my-app");
  readonly cache: ReactiveStorage = new RxStorage("cache", "my-app");
}
```

Then inject it in any component or service:

```ts
@Component({ /* ... */ })
export class SettingsComponent {
  private readonly appStorage = inject(AppStorageService);
  protected readonly theme = this.appStorage.settings.getSignal<string>("theme", {
    initialValue: "system",
  });
}
```

### As a feature-level service

For feature-scoped storage that is shared between a component and its descendants, provide the service at the component level:

```ts
@Injectable()
export class DashboardStorageService {
  readonly storage: ReactiveStorage = new RxStorage("dashboard", "my-app");

  dispose(): void {
    this.storage.dispose();
  }
}

@Component({
  selector: "app-dashboard",
  providers: [DashboardStorageService],
  template: `...`,
})
export class DashboardComponent implements OnDestroy {
  private readonly dashboardStorage = inject(DashboardStorageService);

  ngOnDestroy(): void {
    this.dashboardStorage.dispose();
  }
}
```

All descendants of `DashboardComponent` can `inject(DashboardStorageService)` and share the same instance.

### Using signals in a component template

```ts
@Component({
  selector: "app-greeting",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (username(); as name) {
      <p>Welcome back, {{ name }}!</p>
    } @else {
      <p>Welcome, guest!</p>
    }
  `,
})
export class GreetingComponent {
  private readonly storage = inject(AppStorageService);
  protected readonly username = this.storage.settings.getSignal<string>("username");
}
```

Because the signal is reactive, the template updates automatically when the stored value changes — even from another tab.

### Two-way binding with writable signals

`getWritableSignal()` is particularly useful when you want a form control to persist its value:

```ts
@Component({
  selector: "app-font-size-picker",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <label>
      Font size
      <input type="range" min="12" max="24" [(ngModel)]="fontSize" />
      <span>{{ fontSize() }}px</span>
    </label>
  `,
})
export class FontSizePickerComponent {
  private readonly storage = new RxLocalStorage("preferences", "my-app");
  protected readonly fontSize = this.storage.getWritableSignal<number>("font-size", {
    initialValue: 16,
  });
}
```

---

## SSR Compatibility

Both `RxStorage` and `RxLocalStorage` are safe to use with Server-Side Rendering. They check for the availability of browser APIs (`window`, `indexedDB`, `localStorage`, `BroadcastChannel`) before using them.

On the server:
- `get()` resolves with `undefined`
- `set()` and `remove()` resolve immediately (no-op)
- `getKeys()` resolves with an empty array
- `getSignal()` and `getWritableSignal()` return a signal with `undefined` (or the provided `initialValue`)
- `getObservable()` returns an observable that emits `undefined`

This means your components can call storage methods unconditionally without `if (typeof window !== 'undefined')` checks.

---

## Cleanup and Disposal

### Disposing observers — `dispose()`

`dispose()` is optional and rarely needed. It removes in-memory references to observables and signals and stops cross-tab synchronization (BroadcastChannel / StorageEvent listeners). The underlying data in IndexedDB or localStorage is **not** deleted.

The main use case is stopping cross-tab sync for a storage instance that is no longer relevant — for example, a feature-level storage tied to a component's lifetime:

```ts
export class MyComponent {
  private readonly storage = new RxLocalStorage("my-component", "my-app");
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.destroyRef.onDestroy(() => this.storage.dispose());
  }
}
```

> After calling `dispose()`, the observables and signals created by this storage instance will no longer receive updates.

### Clearing stored data — `clear()`

To actually delete all data in the current table, use `clear()`:

```ts
await storage.clear();
```

All keys in the current table are removed, and every observing signal and observable receives `undefined`. Keys in other tables or databases are not affected.

---

## Storing Complex Data

Both backends can store any JSON-serializable data: strings, numbers, booleans, objects, arrays, and `null`.

```ts
// Primitive values
storage.set("count", 42);
storage.set("enabled", true);
storage.set("name", "Alice");

// Objects
storage.set("user", { name: "Alice", roles: ["admin", "editor"] });

// Arrays
storage.set("recent-ids", [101, 102, 103]);

// Nested structures
storage.set("config", {
  display: { theme: "dark", density: "compact" },
  notifications: { email: true, push: false },
});
```

**IndexedDB** (`RxStorage`) additionally supports `Blob`, `File`, `ArrayBuffer`, `Float32Array`, and other structured-clone-compatible types — these cannot be stored in `localStorage`.

> **Note:** Circular references are not supported (same limitation as `JSON.stringify`) and will cause an exception.

Retrieve with proper typing:

```ts
type UserConfig = {
  readonly display: { readonly theme: string; readonly density: string };
  readonly notifications: { readonly email: boolean; readonly push: boolean };
};

const config = await storage.get<UserConfig>("config");
```

---

## Recipes

### Persisted user preferences

A global service that stores user preferences in IndexedDB and exposes them as signals:

```ts
@Injectable({ providedIn: "root" })
export class UserPreferencesService {
  private readonly storage = new RxStorage("preferences", "my-app");

  readonly theme = this.storage.getWritableSignal<string>("theme", {
    initialValue: "system",
  });

  readonly language = this.storage.getWritableSignal<string>("language", {
    initialValue: "en",
  });

  readonly sidebarCollapsed = this.storage.getWritableSignal<boolean>(
    "sidebar-collapsed",
    { initialValue: false },
  );
}
```

Any component can inject this service and read/write preferences through the writable signals:

```ts
@Component({
  template: `
    <button (click)="toggleSidebar()">
      {{ prefs.sidebarCollapsed() ? "Expand" : "Collapse" }}
    </button>
  `,
})
export class SidebarToggleComponent {
  protected readonly prefs = inject(UserPreferencesService);

  protected toggleSidebar(): void {
    this.prefs.sidebarCollapsed.update((v) => !v);
    // Persisted to IndexedDB and synced to other tabs automatically
  }
}
```

### Caching API responses

Store API responses in IndexedDB to serve them instantly on subsequent visits:

```ts
@Injectable({ providedIn: "root" })
export class ProductCacheService {
  private readonly storage = new RxStorage("product-cache", "my-app");

  async getProduct(id: string): Promise<Product | null> {
    const cached = await this.storage.get<Product>(`product-${id}`);
    return cached ?? null;
  }

  async cacheProduct(id: string, product: Product): Promise<void> {
    this.storage.set(`product-${id}`, product);
  }

  async invalidate(id: string): Promise<void> {
    await this.storage.remove(`product-${id}`);
  }

  async invalidateAll(): Promise<void> {
    await this.storage.clear();
  }
}
```

### Theme switcher synced across tabs

Using `RxLocalStorage` so the theme is available synchronously on page load (no flash of wrong theme):

```ts
@Injectable({ providedIn: "root" })
export class ThemeService {
  private readonly storage = new RxLocalStorage("ui", "my-app");

  readonly theme = this.storage.getWritableSignal<"light" | "dark" | "system">(
    "theme",
    { initialValue: "system" },
  );
}
```

```ts
@Component({
  selector: "app-root",
  template: `<router-outlet />`,
  host: {
    "[attr.data-theme]": "themeService.theme()",
  },
})
export class AppComponent {
  protected readonly themeService = inject(ThemeService);
}
```

Open two tabs — changing the theme in one tab immediately updates the other, because `RxLocalStorage` listens for `StorageEvent`.

### Swapping storage backends with `ReactiveStorage`

Both `RxStorage` and `RxLocalStorage` implement the `ReactiveStorage` interface. You can program against the interface and swap the backend without changing any consuming code:

```ts
import type { ReactiveStorage } from "ngx-reactive-storage";
import { RxStorage, RxLocalStorage } from "ngx-reactive-storage";

@Injectable({ providedIn: "root" })
export class SettingsStorageService {
  readonly storage: ReactiveStorage = shouldUseSyncRead()
    ? new RxLocalStorage("settings", "my-app")
    : new RxStorage("settings", "my-app");
}
```

Note that each backend stores data independently — switching from `RxStorage` to `RxLocalStorage` (or vice versa) does not migrate existing data. The data in IndexedDB and localStorage are separate.

This is also useful for testing — you can provide a different implementation (or the same class with a test-specific database name) without touching the component code:

```ts
// In a test:
const testStorage = new RxLocalStorage("settings", "test-db");
TestBed.configureTestingModule({
  providers: [
    { provide: SettingsStorageService, useValue: { storage: testStorage } },
  ],
});
```

### Migrating from raw `localStorage` / `IndexedDB`

If you are currently using `localStorage` directly:

```ts
// Before:
localStorage.setItem("color-scheme", JSON.stringify("dark"));
const scheme = JSON.parse(localStorage.getItem("color-scheme") ?? '""');

// After:
const storage = new RxLocalStorage("settings", "my-app");
storage.set("color-scheme", "dark");
const scheme = await storage.get<string>("color-scheme");
```

The library handles JSON serialization/deserialization automatically, adds cross-tab reactivity, and gives you observable/signal access to any key.
