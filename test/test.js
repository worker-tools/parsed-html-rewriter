import './patch-global.js';

import assert from 'assert';
import { ParsedHTMLRewriter } from '../index.js';
// import { parseHTML, DOMParser } from 'linkedom'

; (async () => {
  try {
    // Testing the environment first
    assert.ok(Response)
    assert.ok(new Response())
    assert.ok(ReadableStream)
    assert.ok(new ReadableStream({}))
    assert.ok(ParsedHTMLRewriter)
    assert.ok(new ParsedHTMLRewriter())

    // console.log(parseHTML(`<body id="foo" class="bar"></body>`).document.documentElement.outerHTML)
    // console.log(new DOMParser().parseFromString(`<body id="foo" class="bar"></body>`, 'text/html').toString())

    assert.strictEqual(
      await new Response('<body></body>').text(),
      '<body></body>',
    );

    assert.strictEqual(
      await new ParsedHTMLRewriter().transform(new Response('<body></body>')).text(),
      '<body></body>',
    );

    const htmlText = '<body id="id" class="body" zzz="" to="remove" remove="2">Hello <span id="span">span content</span><!--more--> text.</body>';
    let calledBodyElem = false;
    let calledBodyText = false;
    let calledBodyComm = false;
    let calledSpanElem = false;
    let calledSpanText = false;
    const texts = ['Hello ', '', 'span content', '', ' text.', ''];
    const actualHTMLText = await new ParsedHTMLRewriter()
      .on('body', {
        element(el) {
          calledBodyElem = true;
          assert.ok(el);
          assert.ok(el.hasAttribute);
          assert.ok(el.hasAttribute('id'));
          assert.ok(el.hasAttribute('class'));
          assert.strictEqual(el.getAttribute('id'), 'id');
          assert.strictEqual(el.getAttribute('class'), 'body');

          assert.deepStrictEqual(
            new Set(Object.keys(el)),
            new Set(['removed', 'attributes', 'tagName', 'namespaceURI']),
          );

          // Remove an attribute
          assert.strictEqual(el.removeAttribute('to'), el);
          assert.strictEqual(el.hasAttribute('to'), false);
          assert.deepStrictEqual(
            new Map([...el.attributes]),
            new Map([['id', 'id'], ['class', 'body'], ['zzz', ''], ['remove', '2']]),
          );

          // Remove another attribute
          el.removeAttribute('remove');
          assert.strictEqual(el.hasAttribute('remove'), false);
          assert.deepStrictEqual(
            new Map([...el.attributes]),
            new Map([['id', 'id'], ['class', 'body'], ['zzz', '']]),
          );

          // Change an attribute
          assert.strictEqual(el.setAttribute('id', 'foo'), el);
          assert.strictEqual(el.getAttribute('id'), 'foo');
        },
        text(span) {
          calledBodyText = true;
          assert.ok(span);
          assert.ok('lastInTextNode' in span);
          assert.deepStrictEqual(
            new Set(Object.keys(span)),
            new Set(['removed', 'text', 'lastInTextNode']),
          );
          assert.strictEqual(span.text, texts.shift());
        },
        comments(comm) {
          calledBodyComm = true;
          assert.ok(comm)
          assert.strictEqual(comm.text, 'more')
          assert.deepStrictEqual(
            new Set(Object.keys(comm)),
            new Set(['removed', 'text']),
          );
        }
      })
      .on('span[id]', {
        element(span) {
          calledSpanElem = true
          assert.ok(span)
          assert.ok(span.hasAttribute('id'));
          assert.strictEqual(span.getAttribute('id'), 'span');
        },
        text(span) {
          calledSpanText = true
          assert.ok(span);
          assert.ok('lastInTextNode' in span);
          if (span.lastInTextNode) 
            assert.strictEqual(span.text, '');
          else 
            assert.strictEqual(span.text, 'span content');
        }
      })
      .transform(new Response(htmlText))
      .text()

    // assert.strictEqual( 
    //   actualHTMLText,
    //   // TODO: Why does linkedom reverse the oder of attributes?
    //   '<body zzz class="body" id="foo">Hello <span id="span">span content</span> text.</body>',
    // );

    assert.ok(calledBodyElem);
    assert.ok(calledBodyText);
    assert.ok(calledBodyComm);
    assert.ok(calledSpanElem);
    assert.ok(calledSpanText);

    assert.strictEqual(
      await new ParsedHTMLRewriter()
        .on('main', { element(el) { el.replace('<div>Foobar</div>') } })
        .transform(new Response('<body><main></main></body>'))
        .text(),
      '<body>&lt;div&gt;Foobar&lt;/div&gt;</body>',
    );
    assert.strictEqual(
      await new ParsedHTMLRewriter()
        .on('main', { element(el) { el.replace('<div>Foobar</div>', { html: true }) } })
        .transform(new Response('<body><main></main></body>'))
        .text(),
      '<body><div>Foobar</div></body>',
    );

    assert.strictEqual(
      await new ParsedHTMLRewriter()
        .on('main', { element(el) { el.remove() } })
        .transform(new Response('<body><header>H</header><main>M</main><footer>F</footer></body>'))
        .text(),
      '<body><header>H</header><footer>F</footer></body>',
    );

    assert.strictEqual(
      await new ParsedHTMLRewriter()
        .on('main', { element(el) { el.removeAndKeepContent() } })
        .transform(new Response('<body><header>H</header><main>M</main><footer>F</footer></body>'))
        .text(),
      '<body><header>H</header>M<footer>F</footer></body>',
    );

    assert.strictEqual(
      await new ParsedHTMLRewriter()
        .on('main', { element(el) { el.setInnerContent('<div>D</div>') } })
        .transform(new Response('<body><header>H</header><main>M</main><footer>F</footer></body>'))
        .text(),
      '<body><header>H</header><main>&lt;div&gt;D&lt;/div&gt;</main><footer>F</footer></body>',
    );
    assert.strictEqual(
      await new ParsedHTMLRewriter()
        .on('main', { element(el) { el.setInnerContent('<div>D</div>', { html: true }) } })
        .transform(new Response('<body><header>H</header><main>M</main><footer>F</footer></body>'))
        .text(),
      '<body><header>H</header><main><div>D</div></main><footer>F</footer></body>',
    );
  } catch (err) {
    console.error(err)
  }
})()