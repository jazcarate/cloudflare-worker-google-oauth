/// <reference lib="webworker" />

import main from '../src/handler'
import { kv, google, env, crypo } from './mock'
import makeServiceWorkerEnv from 'service-worker-mock'

declare var global: any

const handleRequest = main(kv, google, env, crypo)

describe('handle', () => {
  beforeEach(() => {
    Object.assign(global, makeServiceWorkerEnv())
    jest.resetModules()
    jest.clearAllMocks()
  })

  describe('GET /', () => {
    describe('when the client has no valid auth', () => {
      test('when the client has no Cookie header then it is redirected to google oauth url', async () => {
        const event = new FetchEvent('fetch', {
          request: new Request('/', { method: 'GET' }),
        })
        const result = await handleRequest(event)

        expect(result).toRedirectToGoogle()
      })

      test('when the client has some random Cookie header then it is redirected to google oauth url', async () => {
        const event = new FetchEvent('fetch', {
          request: new Request('/', {
            method: 'GET',
            headers: { Cookie: 'foo=bar' },
          }),
        })
        const result = await handleRequest(event)

        expect(result).toRedirectToGoogle()
      })

      test('when the client has the correct Cookie but there is no KV for it', async () => {
        changeMock(kv.get, (auth) => {
          expect(auth).toEqual('an auth')
          return Promise.resolve(null)
        })

        const event = new FetchEvent('fetch', {
          request: new Request('/', {
            method: 'GET',
            headers: { Cookie: 'auth=an auth' },
          }),
        })
        const result = await handleRequest(event)

        expect(result).toRedirectToGoogle()

        changeMock(kv.get, () => Promise.resolve('a token'))
      })

      test('the url gets send as state', async () => {
        const event = new FetchEvent('fetch', {
          request: new Request('/?q=search', { method: 'GET' }),
        })
        const result = await handleRequest(event)

        const oauthParam = mock(google.oauthURL).calls[0][0]
        expect(oauthParam.state).toEqual('%3Fq%3Dsearch')
      })
    })

    describe('when the client has a valid auth', () => {
      test('renders the list of files', async () => {
        const event = new FetchEvent('fetch', {
          request: new Request('/', {
            method: 'GET',
            headers: { Cookie: 'auth=an auth' },
          }),
        })
        const result = await handleRequest(event)
        expect(result.status).toEqual(200)
        expect(result.headers.get('content-type')).toEqual(
          'text/html;charset=UTF-8',
        )
        const text = await result.text()
        expect(text).toContain('<title>Drive viewer 3000</title>')
        expect(text).toContain('<a href="http://example.com/link-1">')
        expect(text).toContain('<img src="http://example.com/image-1" />')
        expect(text).toContain('<strong>item 1</strong>')
        expect(text).toContain('<small>owner</small>')
      })

      test('the query goes to google api', async () => {
        const event = new FetchEvent('fetch', {
          request: new Request('/?q=search', {
            method: 'GET',
            headers: { Cookie: 'auth=an auth' },
          }),
        })
        const result = await handleRequest(event)
        expect(result.status).toEqual(200)

        expect(mock(google.listDriveFiles).calls.length).toEqual(1)
        const googleRemoveParams = mock(google.listDriveFiles).calls[0][1]
        expect(googleRemoveParams).toEqual('search')
      })
    })
  })

  describe('GET /logout', () => {
    describe('when the client has no valid auth', () => {
      test('when the client has no Cookie header then it is redirected to google oauth url', async () => {
        const event = new FetchEvent('fetch', {
          request: new Request('/logout', { method: 'GET' }),
        })
        const result = await handleRequest(event)

        expect(result).toRedirectToGoogle()
      })

      test('when the client has some random Cookie header then it is redirected to google oauth url', async () => {
        const event = new FetchEvent('fetch', {
          request: new Request('/logout', {
            method: 'GET',
            headers: { Cookie: 'foo=bar' },
          }),
        })
        const result = await handleRequest(event)

        expect(result).toRedirectToGoogle()
      })

      test('when the client has the correct Cookie but there is no KV for it', async () => {
        changeMock(kv.get, (auth) => {
          expect(auth).toEqual('an auth')
          return Promise.resolve(null)
        })

        const event = new FetchEvent('fetch', {
          request: new Request('/logout', {
            method: 'GET',
            headers: { Cookie: 'auth=an auth' },
          }),
        })
        const result = await handleRequest(event)

        expect(result).toRedirectToGoogle()

        changeMock(kv.get, () => Promise.resolve('a token'))
      })
    })

    describe('when the client has a valid auth', () => {
      test('removes the token', async () => {
        const event = new FetchEvent('fetch', {
          request: new Request('/logout', {
            method: 'GET',
            headers: { Cookie: 'auth=an auth' },
          }),
        })
        const result = await handleRequest(event)
        expect(result.status).toEqual(200)
        expect(result.headers.get('Set-Cookie')).toEqual(
          'auth=deleted; expires=Thu, 01 Jan 1970 00:00:00 GMT; secure; HttpOnly',
        )

        expect(mock(google.removeToken).calls.length).toEqual(1)
        const googleRemoveParams = mock(google.removeToken).calls[0][0]
        expect(googleRemoveParams).toEqual('a token')

        expect(mock(kv.remove).calls.length).toEqual(1)
        const removeParams = mock(kv.remove).calls[0][0]
        expect(removeParams).toEqual('an auth')

        const text = await result.text()
        expect(text).toContain('Loged out')
      })
    })
  })

  describe('GET /auth', () => {
    describe('when the callback is not valid', () => {
      test('when the callback has an error', async () => {
        const event = new FetchEvent('fetch', {
          request: new Request('/auth?error=an_error', { method: 'GET' }),
        })
        const result = await handleRequest(event)
        expect(result.status).toEqual(400)

        const text = await result.text()
        expect(text).toEqual('Google OAuth error: [an_error]')
      })

      test('when the callback has no code', async () => {
        const event = new FetchEvent('fetch', {
          request: new Request('/auth', {
            method: 'GET',
          }),
        })
        const result = await handleRequest(event)
        expect(result.status).toEqual(400)

        const text = await result.text()
        expect(text).toEqual("Bad auth callback (no 'code')")
      })

      test('when the code cant be validated with google', async () => {
        changeMock(google.tokenExchange, (env, url, code) => {
          expect(code).toEqual('a_code')
          return Promise.reject('invalid token')
        })

        const event = new FetchEvent('fetch', {
          request: new Request('/auth?code=a_code', {
            method: 'GET',
          }),
        })

        try {
          await handleRequest(event)
        } catch (e) {
          expect(e).toEqual('invalid token')
        } finally {
          changeMock(google.tokenExchange, () =>
            Promise.resolve({
              access_token: 'access_token',
              expires_in: 100,
            }),
          )
        }
      })
    })

    describe('when the callback is valid', () => {
      test('a new auth is saved and sent to the client', async () => {
        const event = new FetchEvent('fetch', {
          request: new Request('/auth?code=a_code', { method: 'GET' }),
        })
        const result = await handleRequest(event)

        expect(result.status).toEqual(302)
        expect(result.headers.get('Location')).toEqual('/')
        expect(result.headers.get('Set-Cookie')).toEqual(
          'auth=an auth; expires=Tue, 06 Jul 2021 22:00:05 GMT; secure; HttpOnly',
        )

        expect(mock(crypo.generateAuth).calls.length).toEqual(1)

        expect(mock(kv.save).calls.length).toEqual(1)
        const saveParams = mock(kv.save).calls[0]
        expect(saveParams).toEqual(['an auth', 'access_token', 1625608805])
      })

      test('the state is preserved', async () => {
        const event = new FetchEvent('fetch', {
          request: new Request('/auth?code=a_code&state=a_state', {
            method: 'GET',
          }),
        })
        const result = await handleRequest(event)

        expect(result.status).toEqual(302)
        expect(result.headers.get('Location')).toEqual('/a_state')
        expect(result.headers.get('Set-Cookie')).toEqual(
          'auth=an auth; expires=Tue, 06 Jul 2021 22:00:05 GMT; secure; HttpOnly',
        )

        expect(mock(crypo.generateAuth).calls.length).toEqual(1)

        expect(mock(kv.save).calls.length).toEqual(1)
        const saveParams = mock(kv.save).calls[0]
        expect(saveParams).toEqual(['an auth', 'access_token', 1625608805])
      })
    })
  })

  describe('GET some other path', () => {
    test('return a not found', async () => {
      const event = new FetchEvent('fetch', {
        request: new Request('/foo', {
          method: 'GET',
          headers: { Cookie: 'auth=an auth' },
        }),
      })
      const result = await handleRequest(event)

      expect(result.status).toEqual(404)
      const text = await result.text()
      expect(text).toContain('Not found')
    })
  })
})

declare global {
  namespace jest {
    interface Matchers<R> {
      toRedirectToGoogle(): R
    }
  }
}

expect.extend({
  toRedirectToGoogle(response) {
    if (response.headers.get('Location') !== 'oauth url')
      return {
        pass: false,
        message: () => 'No Location header present',
      }

    if (response.status !== 302)
      return {
        pass: false,
        message: () => 'Status was not a redirect (302)',
      }

    const len = mock(google.oauthURL).calls.length
    if (len !== 1)
      return {
        pass: false,
        message: () => `expected only one call to 'oauthURL' but was ${len}`,
      }

    const oauthParams = mock(google.oauthURL).calls[0][0]

    if (oauthParams.client_id != env.clientID)
      return {
        pass: false,
        message: () =>
          'Expected `client_id`:\n' +
          '  to match the env\n' +
          'Received:\n' +
          '  "' +
          oauthParams.client_id +
          '"',
      }
    if (oauthParams.redirect_uri != 'https://www.test.com/auth')
      return {
        pass: false,
        message: () =>
          'Expected `redirect_uri`:\n' +
          '  "https://www.test.com/auth"\n' +
          'Received:\n' +
          '  "' +
          oauthParams.redirect_uri +
          '"',
      }

    if (oauthParams.response_type != 'code')
      return {
        pass: false,
        message: () =>
          'Expected `response_type`:\n' +
          '  "code"\n' +
          'Received:\n' +
          '  "' +
          oauthParams.response_type +
          '"',
      }
    if (
      oauthParams.scope !=
      'https://www.googleapis.com/auth/drive.metadata.readonly'
    )
      return {
        pass: false,
        message: () =>
          'Expected `scope`:\n' +
          '  to be google drive metadata readonly\n' +
          'Received:\n' +
          '  "' +
          oauthParams.scope +
          '"',
      }

    return {
      pass: true,
      message: () => '',
    }
  },
})

function mock(f: any): jest.MockedFunction<typeof f> {
  return f.mock
}

type AnyF = (...args: any[]) => any
function changeMock<T extends AnyF>(f: T, newF: T) {
  ;(f as jest.MockedFunction<typeof newF>).mockImplementation(newF)
}
