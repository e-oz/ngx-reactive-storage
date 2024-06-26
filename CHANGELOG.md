### v1.2.2
Angular 18 is now supported.

### v1.2.1
Add info about `getWritableSignal()` to README.

### v1.2.0
Method `getWritableSignal()` will not write initial value to the storage anymore.

### v1.1.2
Fix: Do not emit an observable and signal if no value is found during the initial read in the storage.

### v1.1.1
Fix types in functions overloading.

### v1.1.0
New method: `getWritableSignal()` - returns a signal that you can modify using `set()` or `update()` methods, and these modifications will also update the storage key. 

### v1.0.4
More types overloading for `getSignal()` 🤦

### v1.0.3
Better TypeScript types for `getSignal()`, remove `SignalOptions` type (was not part of public API).

### v1.0.2
Better TypeScript types for `getSignal()` and `SignalOptions`.

### v1.0.1
Method `getSignal()` now accepts `SignalOptions` as the second argument. This allows you to set the initial value and the equality check function.

### v1.0.0
1. This library has been tested in production for a long enough time.
2. No breaking changes in the API are expected in the near future.

3. So we can indeed call it v1.0.0!

### v0.2.0
Use [BroadcastChannel](https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API) to sync changes of IndexedDB stores in multiple tabs.

### v0.1.3
More docs, more tests.

### v0.1.2

Improve documentation.
