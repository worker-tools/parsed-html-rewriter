import { parseHTML } from 'linkedom'
import { asyncIterableToStream } from 'whatwg-stream-to-async-iter';
import {
  ParsedHTMLRewriterElement,
  ParsedHTMLRewriterText,
  ParsedHTMLRewriterComment,
  ParsedHTMLRewriterDocumentType,
  ParsedHTMLRewriterEnd,
  promiseToAsyncIterable,
  append,
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

function findNext(el: Node | null): Node | null {
  while (el && !el.nextSibling) el = el.parentNode;
  return el && el.nextSibling;
}

export type ParsedElementHandler = ElementHandler & {
  innerHTML?(html: string): void | Promise<void>;
}

/**
 * A DOM-based implementation of Cloudflare's `HTMLRewriter`.
 */
export class ParsedHTMLRewriter implements HTMLRewriter {
  #onMap = new Map<string, ParsedElementHandler[]>();
  #onDocument = new Array<DocumentHandler>();

  public on(selector: string, handlers: ParsedElementHandler): HTMLRewriter {
    append(this.#onMap, selector, handlers);
    return this;
  }

  public onDocument(handlers: DocumentHandler): HTMLRewriter {
    this.#onDocument.push(handlers);
    return this;
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
      const elemMap = new Map<Element, ((el: Element) => Awaitable<void>)[]>();
      const htmlMap = new Map<Node | null, [Element, ((html: string) => Awaitable<void>)][]>();
      const textMap = new Map<Text, ((text: Text) => Awaitable<void>)[]>();
      const commMap = new Map<Comment, ((comment: Comment) => Awaitable<void>)[]>();

      for (const [selector, handlers] of this.#onMap) {
        for (const elem of document.querySelectorAll(selector)) {
          for (const handler of handlers) {
            if (handler.element) {
              append(elemMap, elem, handler.element.bind(handler));
            }

            // The `innerHTML` handler needs to run at the beginning of the next sibling node,
            // after all the inner handlers have completed:
            if (handler.innerHTML) {
              append(htmlMap, findNext(elem), [elem, handler.innerHTML.bind(handler)]);
            }

            // Non-element handlers are odd, in the sense that they run for _any_ children, not just the immediate ones:
            if (handler.text) {
              for (const text of findTextNodes(elem, document)) {
                append(textMap, text, handler.text.bind(handler))
              }
            }

            if (handler.comments) {
              for (const comm of findCommentNodes(elem, document)) {
                append(commMap, comm, handler.comments.bind(handler))
              }
            }
          }
        }
      }

      // Handle document doctype before everything else
      if(document.doctype) {
        const doctype = new ParsedHTMLRewriterDocumentType(document.doctype);
        for (const handler of this.#onDocument) {
          await handler.doctype?.(doctype);
        }
      }

      // We'll then walk the DOM and run the registered handlers each time we encounter an "interesting" node.
      // Because we've stored them in a hash map, and can retrieve them via object identity:
      const walker = document.createTreeWalker(document, SHOW_ELEMENT | SHOW_TEXT | SHOW_COMMENT);

      // We need to walk the entire tree ahead of time,
      // otherwise the order might change based on added/deleted elements:
      // We're also adding `null` at the end to handle the edge case of `innerHTML` of the last element.
      const nodes = [...treeWalkerToIter(walker), null];

      for (const node of nodes) {
        for (const [prevElem, handler] of htmlMap.get(node) ?? []) {
          await handler(prevElem.innerHTML);
        }

        if (isElement(node)) {
          const handlers = elemMap.get(node) ?? [];
          for (const handler of handlers) {
            await handler(new ParsedHTMLRewriterElement(node, document) as unknown as Element);
          }
        }
        else if (isText(node)) {
          const handlers = textMap.get(node) ?? [];
          const text = new ParsedHTMLRewriterText(node, document) as unknown as Text;
          for (const handler of handlers) {
            await handler(text);
          }
          for (const handler of this.#onDocument) {
            await handler.text?.(text);
          }
          if (!isText(node.nextSibling)) {
            const textLast = new ParsedHTMLRewriterText(null, document) as unknown as Text;
            for (const handler of handlers) {
              await handler(textLast);
            }
            for (const handler of this.#onDocument) {
              await handler.text?.(textLast);
            }
          }
        }
        else if (isComment(node)) {
          const handlers = commMap.get(node) ?? [];
          const comment = new ParsedHTMLRewriterComment(node, document) as unknown as Comment;
          for (const handler of handlers) {
            await handler(comment);
          }
          for (const handler of this.#onDocument) {
            await handler.comments?.(comment);
          }
        }
      }

      // Handle document end after everything else
      const end = new ParsedHTMLRewriterEnd(document);
      for (const handler of this.#onDocument) {
        await handler.end?.(end);
      }

      return new TextEncoder().encode(document.toString());
    })())), response);
  }
}
