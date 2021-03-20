import { parseHTML } from 'linkedom'
import { asyncIterableToStream } from 'whatwg-stream-to-async-iter';
import { PushMap } from './push-maps.js';
import {
  ParsedHTMLRewriterElement,
  ParsedHTMLRewriterText,
  ParsedHTMLRewriterComment,
  promiseToAsyncIterable,
  treeWalkerToIter,
  Awaitable,
} from './support.js';

const ELEMENT_NODE = 1;
const ATTRIBUTE_NODE = 2;
const TEXT_NODE = 3;
const COMMENT_NODE = 8;
const DOCUMENT_NODE = 9;
const DOCUMENT_TYPE_NODE = 10;
const DOCUMENT_FRAGMENT_NODE = 11;
const SHOW_ALL = -1;
const SHOW_ELEMENT = 1;
const SHOW_TEXT = 4;
const SHOW_COMMENT = 128;

const isText = (n?: Node | null): n is Text => n?.nodeType === TEXT_NODE;
const isElement = (n?: Node | null): n is Element => n?.nodeType === ELEMENT_NODE;
const isComment = (n?: Node | null): n is Comment => n?.nodeType === COMMENT_NODE;

function* findTextNodes(el: Element, document: any): Iterable<Text> {
  const tw = document.createTreeWalker(el, SHOW_TEXT);
  for (const node of treeWalkerToIter(tw))
    yield node as Text;
}

function* findCommentNodes(el: Element, document: any): Iterable<Comment> {
  const tw = document.createTreeWalker(el, SHOW_COMMENT);
  for (const node of treeWalkerToIter(tw))
    yield node as Comment;
}

export type ParsedElementHandler = ElementHandler & {
  innerHTML?(html: string): void | Promise<void>;
}

/**
 * A DOM-based implementation of Cloudflare's `HTMLRewriter`.
 * 
 * Unlike the original, this implementation dumps the entire document in memory, 
 * parses it via `parseHTML` (provided by `linkedom`),
 * and runs selectors against this representation.
 * As a result, it is much slower and more memory intensive, and can't process streaming data.
 * 
 * However, it should run in most JS contexts (including Web Workers, Service Workers and Deno) without modification.
 * 
 * It is mainly intended for Workers development and allowing CF Workers to run in other JS contexts such as Deno..
 * 
 * TODO:
 * - Implement `onDocument` 
 * 
 * WANTED:
 * - A HTMLRewriter implementation using `lol-html` compiled to WebAssembly..
 */
export class ParsedHTMLRewriter implements HTMLRewriter {
  #onMap = new PushMap<string, ParsedElementHandler>();
  // #onDocument = new Array<DocumentHandler>();

  public on(selector: string, handlers: ParsedElementHandler): HTMLRewriter {
    this.#onMap.push(selector, handlers);
    return this;
  }

  public onDocument(_handlers: DocumentHandler): HTMLRewriter {
    // this.#onDocument.push(handlers);
    // return this;
    throw Error('Method not implemented.');
  }

  public transform(response: Response): Response {
    // This dance (promise => async gen => stream) is necessary because 
    // a) the `Response` constructor doesn't accept async data, except via (byte) streams, and
    // b) `HTMLRewriter.transform` is not an async function.
    return new Response(asyncIterableToStream(promiseToAsyncIterable((async () => {
      // This is where the "parse" part comes in: We're not actually stream processing, 
      // instead we'll just build the DOM in memory and run the selectors.
      const htmlText = await response.text();
      const { document } = parseHTML(htmlText);
      // const document = new DOMParser().parseFromString(htmlText, 'text/html')

      // After that, the hardest part is getting the order right.
      // First, we'll build a map of all elements that are "interesting", based on the registered handlers.
      // We take advantage of existing DOM APIs:
      const elemMap = new PushMap<Element, (el: Element) => Awaitable<void>>();
      const htmlMap = new PushMap<Element, (html: string) => Awaitable<void>>();
      const textMap = new PushMap<Text, (text: Text) => Awaitable<void>>();
      const commMap = new PushMap<Comment, (comment: Comment) => Awaitable<void>>();

      for (const [selector, handlers] of this.#onMap) {
        for (const elem of document.querySelectorAll(selector)) {
          for (const handler of handlers) {
            if (handler.element) {
              elemMap.push(elem, handler.element.bind(handler));
            }

            if (handler.innerHTML) {
              htmlMap.push(elem, handler.innerHTML.bind(handler));
            }

            // Non-element handlers are odd, in the sense that they run for _any_ children
            if (handler.text) {
              for (const text of findTextNodes(elem, document)) {
                textMap.push(text, handler.text.bind(handler))
              }
            }

            if (handler.comments) {
              for (const comm of findCommentNodes(elem, document)) {
                commMap.push(comm, handler.comments.bind(handler))
              }
            }
          }
        }
      }

      // We'll then walk the DOM and run the registered handlers each time we encounter an "interesting" node.
      // Because we've stored them in a hash map, and can retrieve them via object identity, this is now O(n)...
      const walker = document.createTreeWalker(document, SHOW_ELEMENT | SHOW_TEXT | SHOW_COMMENT);

      // We need to walk the entire tree ahead of time,
      // otherwise we'll miss elements that have been deleted by handlers.
      const nodes = [...treeWalkerToIter(walker)];

      for (const node of nodes) {
        if (isElement(node)) {
          const handlers = elemMap.get(node) ?? [];
          for (const handler of handlers) {
            await handler(new ParsedHTMLRewriterElement(node, document) as unknown as Element);
          }
          for (const handler of htmlMap.get(node) ?? []) {
            await handler(node.innerHTML);
          }
        }
        else if (isText(node)) {
          const handlers = textMap.get(node) ?? [];
          for (const handler of handlers) {
            await handler(new ParsedHTMLRewriterText(node, document) as unknown as Text);
          }
          if (!isText(node.nextSibling)) {
            for (const handler of handlers) {
              await handler(new ParsedHTMLRewriterText(null, document) as unknown as Text);
            }
          }
        }
        else if (isComment(node)) {
          const handlers = commMap.get(node) ?? [];
          for (const handler of handlers) {
            await handler(new ParsedHTMLRewriterComment(node, document) as unknown as Text);
          }
        }
      }

      return new TextEncoder().encode(document.toString());
    })())), response);
  }
}
