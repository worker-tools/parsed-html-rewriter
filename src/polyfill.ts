import { ParsedHTMLRewriter } from './index.js';

if (!('HTMLRewriter' in self)) {
  Object.defineProperty(self, 'HTMLRewriter', {
    configurable: false,
    enumerable: false,
    writable: false,
    value: ParsedHTMLRewriter
  })
}