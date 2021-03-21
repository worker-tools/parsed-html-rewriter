/**
 * Experimental TS decorator to mark class properties as enumerable. 
 * When applied to the class itself, it will also make the properties enumerable _on instances themselves_!
 * 
 * For mor on the difficulty of making getters enumerable, see:
 * https://stackoverflow.com/questions/34517538/setting-an-es6-class-getter-to-enumerable
 */
import { push } from "./push-maps.js";

const descriptorMap = new WeakMap<any, [string, PropertyDescriptor][]>();

export function enumerable(obj: any, property: string, descriptor: PropertyDescriptor): void;
export function enumerable<T extends { new (...args: any[]): {} }>(ctor: T): T;
export function enumerable(obj: any, property?: string, descriptor?: PropertyDescriptor) {
  if (property && descriptor) {
    descriptor.enumerable = true;
    push(descriptorMap, obj, [property, descriptor])
  } else {
    return class extends obj {
      constructor(...args: any[]) {
        super(...args);
        for (const [prop, desc] of descriptorMap.get(obj.prototype) ?? []) {
          Object.defineProperty(this, prop, desc);
        }
      }
    };
  }
}

// function* prototypes(obj: any) {
//   let prototype = Object.getPrototypeOf(obj);
//   while (prototype && prototype !== Object.prototype) {
//     yield prototype;
//     prototype = Object.getPrototypeOf(prototype);
//   }
// }
