import webStreams from 'node-web-streams';
import fetch from 'node-fetch-polyfill';
import { concatBufferSources } from 'typed-array-utils';

Object.assign(global, webStreams);
Object.assign(global, fetch);

class NonSuckingResponse extends Response {
  async text() {
    if (this._rawBody instanceof ReadableStream) {
      const r = this._rawBody.getReader();
      const bs = [];
      let i = await r.read();
      while (!i.done) { 
        bs.push(i.value); 
        i = await r.read() 
      }
      return new TextDecoder().decode(concatBufferSources(...bs))
    } else {
      return super.text();
    }
  }
}

global.Response = NonSuckingResponse;
