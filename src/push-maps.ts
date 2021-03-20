/** A map implementation that supports multiple values per key (as array) */
export class PushMap<K, V> extends Map<K, V[]> {
  push(k: K, v: V) {
    const vs = this.get(k) ?? [];
    vs.push(v);
    this.set(k, vs);
  }
}

export class PushWeakMap<O extends object, V> extends WeakMap<O, V[]> {
  push(o: O, v: V) {
    const vs = this.get(o) ?? [];
    vs.push(v);
    this.set(o, vs);
  }
}
