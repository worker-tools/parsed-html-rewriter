# Parsed HTML Rewriter
A DOM-based implementation of [Cloudflare Worker's `HTMLRewriter`](https://developers.cloudflare.com/workers/runtime-apis/html-rewriter).

Unlike the original, this implementation dumps the entire document in memory, 
parses it into DOM (provided by [`linkedom`](https://github.com/WebReflection/linkedom)),
and runs selectors against this representation.
As a result, it is slower, more memory intensive, and can't process streaming data.

However, it should run in most JS contexts (including Web Workers, Service Workers and Deno) without modification and handle many (if not most) use cases of HTMLRewrter just fine. 
I should certainly be good enough for offline Workers development and allowing CF Workers to run in other JS contexts, such as Deno..
