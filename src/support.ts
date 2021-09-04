export type Awaitable<T> = T | Promise<T>;

export function append<K, V>(m: Map<K, V[]>, k: K, v: V) {
  const vs = m.get(k) ?? [];
  vs.push(v);
  return m.set(k, vs);
}

export async function* promiseToAsyncIterable<T>(promise: Promise<T>): AsyncIterableIterator<T> {
  yield await promise;
}

export function* treeWalkerToIter(walker: TreeWalker): IterableIterator<Node> {
  let node = walker.nextNode();
  while (node) {
    yield node;
    node = walker.nextNode();
  }
}

type Content = string;

/** Fragment form string function that works with linkedom. */
function fragmentFromString(document: Document, html: string) {
  const temp = document.createElement('template');
  temp.innerHTML = html;
  return temp.content;
}

function replace(document: Document, node: Element | Text | Comment | null, content: string, opts?: ContentOptions) {
  node?.replaceWith(...opts?.html
    ? fragmentFromString(document, content).childNodes // depends on DOM.Iterable
    : [content]);
}

export class ParsedHTMLRewriterNode {
  #node: Element | Text | Comment | null;
  #doc: Document;
  constructor(node: Element | Text | Comment | null, document: Document) {
    this.#node = node;
    this.#doc = document;
  }

  get removed() { return !this.#doc.contains(this.#node) }

  before(content: Content, opts?: ContentOptions): this {
    const before = this.#doc.createComment('');
    this.#node?.parentElement?.insertBefore(before, this.#node)
    replace(this.#doc, before, content, opts);
    return this;
  }

  after(content: Content, opts?: ContentOptions): this {
    const after = this.#doc.createComment('');
    this.#node?.parentElement?.insertBefore(after, this.#node.nextSibling)
    replace(this.#doc, after, content, opts);
    return this;
  }

  replace(content: Content, opts?: ContentOptions): this {
    replace(this.#doc, this.#node, content, opts);
    return this;
  }

  remove(): this {
    this.#node?.remove()
    return this;
  }
}

export class ParsedHTMLRewriterElement extends ParsedHTMLRewriterNode {
  #node: Element;

  constructor(node: Element, document: Document) {
    super(node, document)
    this.#node = node;
  }

  get tagName() { return this.#node.tagName.toLowerCase() }
  get attributes(): Iterable<[string, string]> {
    return [...this.#node.attributes].map(attr => [attr.name, attr.value]);
  }
  get namespaceURI() { return this.#node.namespaceURI }

  getAttribute(name: string) {
    return this.#node.getAttribute(name);
  }

  hasAttribute(name: string) {
    return this.#node.hasAttribute(name);
  }

  setAttribute(name: string, value: string): this {
    this.#node.setAttribute(name, value);
    return this;
  }

  removeAttribute(name: string): this {
    this.#node.removeAttribute(name);
    return this;
  }

  prepend(content: Content, opts?: ContentOptions): this {
    return this.before(content, opts);
  }

  append(content: Content, opts?: ContentOptions): this {
    return this.after(content, opts);
  }

  setInnerContent(content: Content, opts?: ContentOptions): this {
    this.#node[opts?.html ? 'innerHTML' : 'textContent'] = content;
    return this;
  }

  removeAndKeepContent(): this {
    this.#node?.replaceWith(...this.#node.childNodes);
    return this;
  }
}

export class ParsedHTMLRewriterText extends ParsedHTMLRewriterNode {
  #text: Text | null;
  #done: boolean;

  constructor(text: Text | null, document: Document) {
    super(text, document);
    this.#text = text;
    this.#done = text === null;
  }
  get text() { return this.#text?.textContent ?? '' }
  get lastInTextNode() { return this.#done }
}

export class ParsedHTMLRewriterComment extends ParsedHTMLRewriterNode {
  #comm: Comment;
  constructor(comm: Comment, document: Document) {
    super(comm, document);
    this.#comm = comm;
  }
  get text() { return this.#comm.textContent ?? '' }
  set text(value: string) { this.#comm.textContent = value }
}

export class ParsedHTMLRewriterDocumentType {
  #doctype: DocumentType;

  constructor(doctype: DocumentType) {
    this.#doctype = doctype;
  }
  get name() { return this.#doctype.name }
  get publicId() { return this.#doctype.publicId }
  get systemId() { return this.#doctype.systemId }
}

export class ParsedHTMLRewriterEnd {
  #doc: Document;

  constructor(document: Document) {
    this.#doc = document;
  }

  append(content: Content, opts?: ContentOptions): this {
    const after = this.#doc.createComment('');
    this.#doc.insertBefore(after, null);
    replace(this.#doc, after, content, opts);
    return this;
  }
}

// function* ancestors(el: Node) {
//   while (el.parentElement) {
//     yield el.parentElement
//     el = el.parentElement
//   }
// }

// function root(el: Node): globalThis.HTMLElement | undefined {
//   const ancs = [...ancestors(el)]
//   return ancs[ancs.length - 1];
// }

// function* zip<X, Y>(xs: Iterable<X>, ys: Iterable<Y>): IterableIterator<[X, Y]> {
//   const xit = xs[Symbol.iterator]();
//   const yit = ys[Symbol.iterator]();
//   while (true) {
//     const [xr, yr] = [xit.next(), yit.next()];
//     if (xr.done || yr.done) break;
//     yield [xr.value, yr.value];
//   }
// }

// /* Checks if this element or any of its parents matches a given `selector`. */
// function matchesAncestors(el: Element | null, selector: string): Element | null {
//   let curr = el;
//   while (curr != null) {
//     if (curr.matches(selector)) return curr;
//     curr = curr.parentElement;
//   }
//   return null;
// }