# Parsed HTML Rewriter
A DOM-based implementation of [Cloudflare Worker's `HTMLRewriter`](https://developers.cloudflare.com/workers/runtime-apis/html-rewriter).

***

___UPDATE: While this module works just fine, I've made [a new verison](https://github.com/worker-tools/html-rewriter) that is WASM/streaming based for much better performance.___

***

Unlike the original, this implementation parses the entire DOM (provided by [`linkedom`](https://github.com/WebReflection/linkedom)),
and runs selectors against this representation. As a result, it is slower, more memory intensive, and can't process streaming data.

Note that this approach was chosen to quickly implement the functionality of `HTMLRewriter`, as there is currently no JS implementation available.
A better implementation would replicate the streaming approach of [`lol-html`](https://github.com/cloudflare/lol-html), or even use a WebAssembly version of it. _Update: [Now available here](https://github.com/worker-tools/html-rewriter)_.

However, this implementation should run in most JS contexts (including Web Workers, Service Workers and Deno) without modification and handle many, if not most, use cases of `HTMLRewriter`. 
It should be good enough for testing and offline Workers development.

## Usage
This module can be used in two ways. 

As a standalone module: 

```ts
import { ParsedHTMLRewriter } from '@worker-tools/parsed-html-rewriter'

await new ParsedHTMLRewriter()
  .transform(new Response('<body></body>'))
  .text();
```

Or as a polyfill:

```ts
import '@worker-tools/parsed-html-rewriter/polyfill'

await new HTMLRewriter() // Will use the native version when running in a Worker
  .transform(new Response('<body></body>'))
  .text();
```

### innerHTML
Unlike the current (March 2021) version on CF Workers, this implementation already supports the [proposed `innerHTML` handler](https://github.com/cloudflare/lol-html/issues/40#issuecomment-567126687). 
Note that this feature is unstable and will likely change as the real version materializes.

```ts
await new HTMLRewriter()
  .on('body', {
    innerHTML(html) {
      console.log(html) // => '<div id="foo">bar</div>'
    },
  })
  .transform(new Response('<body><div id="foo">bar</div></body>'))
  .text();
```

## Caveats
- Because this version isn't based on streaming data, the order in which handlers are called can differ. Some measure have been taken to simulate the order, but differences may occur.
- Texts never arrive in chunks. There is always just one chunk, followed by an empty one with `lastInTextNode` set to `true`.

--------

<p align="center"><a href="https://workers.tools"><img src="https://workers.tools/assets/img/logo.svg" width="100" height="100" /></a>
<p align="center">This module is part of the Worker Tools collection<br/>⁕

[Worker Tools](https://workers.tools) are a collection of TypeScript libraries for writing web servers in [Worker Runtimes](https://workers.js.org) such as Cloudflare Workers, Deno Deploy and Service Workers in the browser. 

If you liked this module, you might also like:

- 🧭 [__Worker Router__][router] --- Complete routing solution that works across CF Workers, Deno and Service Workers
- 🔋 [__Worker Middleware__][middleware] --- A suite of standalone HTTP server-side middleware with TypeScript support
- 📄 [__Worker HTML__][html] --- HTML templating and streaming response library
- 📦 [__Storage Area__][kv-storage] --- Key-value store abstraction across [Cloudflare KV][cloudflare-kv-storage], [Deno][deno-kv-storage] and browsers.
- 🆗 [__Response Creators__][response-creators] --- Factory functions for responses with pre-filled status and status text
- 🎏 [__Stream Response__][stream-response] --- Use async generators to build streaming responses for SSE, etc...
- 🥏 [__JSON Fetch__][json-fetch] --- Drop-in replacements for Fetch API classes with first class support for JSON.
- 🦑 [__JSON Stream__][json-stream] --- Streaming JSON parser/stingifier with first class support for web streams.

Worker Tools also includes a number of polyfills that help bridge the gap between Worker Runtimes:
- ✏️ [__HTML Rewriter__][html-rewriter] --- Cloudflare's HTML Rewriter for use in Deno, browsers, etc...
- 📍 [__Location Polyfill__][location-polyfill] --- A `Location` polyfill for Cloudflare Workers.
- 🦕 [__Deno Fetch Event Adapter__][deno-fetch-event-adapter] --- Dispatches global `fetch` events using Deno’s native HTTP server.

[router]: https://workers.tools/router
[middleware]: https://workers.tools/middleware
[html]: https://workers.tools/html
[kv-storage]: https://workers.tools/kv-storage
[cloudflare-kv-storage]: https://workers.tools/cloudflare-kv-storage
[deno-kv-storage]: https://workers.tools/deno-kv-storage
[kv-storage-polyfill]: https://workers.tools/kv-storage-polyfill
[response-creators]: https://workers.tools/response-creators
[stream-response]: https://workers.tools/stream-response
[json-fetch]: https://workers.tools/json-fetch
[json-stream]: https://workers.tools/json-stream
[request-cookie-store]: https://workers.tools/request-cookie-store
[extendable-promise]: https://workers.tools/extendable-promise
[html-rewriter]: https://workers.tools/html-rewriter
[location-polyfill]: https://workers.tools/location-polyfill
[deno-fetch-event-adapter]: https://workers.tools/deno-fetch-event-adapter

Fore more visit [workers.tools](https://workers.tools).
