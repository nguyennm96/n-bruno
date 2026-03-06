import { addResponseExample } from './exampleReducers';

jest.mock('utils/common', () => ({
  uuid: () => 'generated-uid'
}));

describe('exampleReducers', () => {
  it('creates a request snapshot instead of reusing the live request references', () => {
    const state = {
      collections: [
        {
          uid: 'collection-1',
          items: [
            {
              uid: 'request-1',
              type: 'http-request',
              name: 'Get users',
              request: {
                url: 'https://api.example.com/users',
                method: 'GET',
                headers: [{ uid: 'header-1', name: 'Accept', value: 'application/json', enabled: true }],
                params: [],
                body: { mode: 'none' }
              },
              draft: {
                uid: 'request-1',
                type: 'http-request',
                request: {
                  url: 'https://api.example.com/users',
                  method: 'GET',
                  headers: [{ uid: 'header-1', name: 'Accept', value: 'application/json', enabled: true }],
                  params: [],
                  body: { mode: 'none' }
                },
                examples: []
              },
              examples: []
            }
          ]
        }
      ]
    };

    addResponseExample(state, {
      payload: {
        itemUid: 'request-1',
        collectionUid: 'collection-1',
        example: {
          uid: 'example-1',
          name: '200 OK',
          description: 'Created from latest response',
          status: 200,
          statusText: 'OK',
          headers: [{ name: 'content-type', value: 'application/json', enabled: true }],
          body: { type: 'json', content: '{\n  "ok": true\n}' }
        }
      }
    });

    const item = state.collections[0].items[0];
    const example = item.draft.examples[0];

    expect(example.request).not.toBe(item.draft.request);
    expect(example.request.headers).not.toBe(item.draft.request.headers);
    expect(example.request.body).not.toBe(item.draft.request.body);
    expect(example.response.status).toBe(200);
    expect(example.response.headers[0].name).toBe('content-type');
    expect(example.request.auth).toBeUndefined();
    expect(example.request.script).toBeUndefined();
    expect(example.request.vars).toBeUndefined();
    expect(example.request.assertions).toBeUndefined();
    expect(example.request.tests).toBeUndefined();
    expect(example.request.docs).toBeUndefined();
  });

  it('accepts a prebuilt nested example payload', () => {
    const state = {
      collections: [
        {
          uid: 'collection-1',
          items: [
            {
              uid: 'request-1',
              type: 'http-request',
              name: 'Get users',
              request: {
                url: 'https://api.example.com/users',
                method: 'GET',
                headers: [],
                params: [],
                body: { mode: 'none' }
              },
              draft: {
                uid: 'request-1',
                type: 'http-request',
                request: {
                  url: 'https://api.example.com/users',
                  method: 'GET',
                  headers: [],
                  params: [],
                  body: { mode: 'none' }
                },
                examples: []
              },
              examples: []
            }
          ]
        }
      ]
    };

    addResponseExample(state, {
      payload: {
        itemUid: 'request-1',
        collectionUid: 'collection-1',
        example: {
          uid: 'example-2',
          name: '404 Not Found',
          description: 'Nested payload',
          request: {
            url: 'https://api.example.com/users/404',
            method: 'GET',
            headers: [],
            params: [],
            body: { mode: 'none' }
          },
          response: {
            status: 404,
            statusText: 'Not Found',
            headers: [{ uid: 'header-2', name: 'content-type', value: 'application/json', enabled: true }],
            body: { type: 'json', content: '{ "message": "not found" }' }
          }
        }
      }
    });

    const example = state.collections[0].items[0].draft.examples[0];
    expect(example.name).toBe('404 Not Found');
    expect(example.request.url).toBe('https://api.example.com/users/404');
    expect(example.response.status).toBe(404);
    expect(example.response.statusText).toBe('Not Found');
  });

  it('strips unsupported request keys from provided example snapshots', () => {
    const state = {
      collections: [
        {
          uid: 'collection-1',
          items: [
            {
              uid: 'request-1',
              type: 'http-request',
              name: 'Get users',
              request: {
                url: 'https://api.example.com/users',
                method: 'GET',
                headers: [],
                params: [],
                body: { mode: 'none' }
              },
              draft: {
                uid: 'request-1',
                type: 'http-request',
                request: {
                  url: 'https://api.example.com/users',
                  method: 'GET',
                  headers: [],
                  params: [],
                  body: { mode: 'none' }
                },
                examples: []
              },
              examples: []
            }
          ]
        }
      ]
    };

    addResponseExample(state, {
      payload: {
        itemUid: 'request-1',
        collectionUid: 'collection-1',
        example: {
          uid: 'example-3',
          name: 'Sanitized Example',
          request: {
            url: 'https://api.example.com/users/1',
            method: 'GET',
            headers: [],
            params: [],
            body: { mode: 'none' },
            auth: { mode: 'bearer' },
            script: { req: 'foo' },
            vars: { req: [] },
            assertions: [],
            tests: 'pm.test()',
            docs: 'ignore me'
          },
          response: {
            status: 200,
            statusText: 'OK',
            headers: [],
            body: { type: 'json', content: '{}' }
          }
        }
      }
    });

    const example = state.collections[0].items[0].draft.examples[0];
    expect(Object.keys(example.request).sort()).toEqual(['body', 'headers', 'method', 'params', 'url']);
  });
});
