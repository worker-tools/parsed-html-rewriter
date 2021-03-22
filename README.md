# Parsed HTML Rewriter
A DOM-based implementation of [Cloudflare Worker's `HTMLRewriter`](https://developers.cloudflare.com/workers/runtime-apis/html-rewriter).

Unlike the original, this implementation parses the entire DOM (provided by [`linkedom`](https://github.com/WebReflection/linkedom)),
and runs selectors against this representation. As a result, it is slower, more memory intensive, and can't process streaming data.

Note that this approach was chosen to quickly implement the functionality, as there is currently no JS implementation of HTMLRewriter available (as of this writing).
A better implementation would replicate the streaming approach of [`lol-html`](https://github.com/cloudflare/lol-html), or even use a WebAssembly version of it.

However, this implementation should run in most JS contexts (including Web Workers, Service Workers and Deno) without modification and handle many, if not most, use cases of HTMLRewriter. 
It should certainly be good enough for testing and offline Workers development.
