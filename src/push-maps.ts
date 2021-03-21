export function push<K, V>(m: Map<K, V[]>, k: K, v: V): typeof m;
export function push<K extends object, V>(m: WeakMap<K, V[]>, k: K, v: V): typeof m;
export function push<K, V>(m: any, k: K, v: V) {
  const vs = m.get(k) ?? [];
  vs.push(v);
  return m.set(k, vs);
}
