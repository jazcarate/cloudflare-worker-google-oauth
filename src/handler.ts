import { KVSystem } from './lib/kv'
import { CryptoSystem } from './lib/crypto'
import { DriveFiles, DRIVE_SCOPE, GoogleSystem } from './lib/google'
import { redirect, findCookie } from './lib/http'
import { EnvSystem } from './lib/env'

function redirectToLogin(
  { clientID }: EnvSystem,
  { oauthURL }: GoogleSystem,
  url: URL,
  additionalHeader?: HeadersInit,
): Response {
  const redidirectURI = url.origin + '/auth'
  return redirect(
    oauthURL({
      client_id: clientID,
      redirect_uri: redidirectURI,
      response_type: 'code',
      scope: DRIVE_SCOPE,
      state: encodeURIComponent(url.search),
    }),
    additionalHeader,
  )
}

const EXPIRED = new Date(0)
const AUTH_COOKIE = 'auth'

function setCookie(auth: string, expiration: Date): HeadersInit {
  return {
    'Set-Cookie': `${AUTH_COOKIE}=${auth}; expires=${expiration.toUTCString()}; secure; HttpOnly`,
  }
}

function login(env: EnvSystem, google: GoogleSystem, url: URL): Response {
  return redirectToLogin(env, google, url, setCookie('deleted', EXPIRED))
}

function render(files: DriveFiles): Response {
  const html = `<!DOCTYPE html>
          <head>
            <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%221.2em%22 font-size=%2270%22>🔎</text></svg>">
            <title>Drive viewer 3000</title>
            <style>
              body {
                margin: 40px auto;
                max-width: 650px;
                line-height: 1.6;
                font-size: 18px;
                color: #444;
                padding: 0 10px
              }
            </style>
          </head>
          <body>
            <h1>Files</h1>
            <form>
              <input name="q" placeholder="Search" />
              <input type="submit" value="🔎" />
            </form>
            <ul>
            ${files.items
              .map(
                (file) => `<li>
              <a href="${file.alternateLink}">
                <img src="${file.iconLink}" /> <strong>${file.title}</strong>
                <small>${file.owners
                  .map(({ displayName }) => displayName)
                  .join(' ')}</small>
              </a>
              </li>`,
              )
              .join('')}
            </ul>
            <a href="/logout">Logout</a>
          </body>`

  return new Response(html, {
    headers: { 'content-type': 'text/html;charset=UTF-8' },
  })
}

const MILLIS = 1000

export default function (
  kv: KVSystem,
  google: GoogleSystem,
  env: EnvSystem,
  crypto: CryptoSystem,
): (event: FetchEvent) => Promise<Response> {
  const { remove, get, save } = kv
  const { tokenExchange, removeToken, listDriveFiles } = google
  const { isLocal, now } = env
  const { generateAuth } = crypto

  return async function handleRequest(event: FetchEvent): Promise<Response> {
    const request = event.request

    const cfURL = new URL(request.url)
    const url = isLocal
      ? new URL('http://127.0.0.1:8787' + cfURL.pathname + cfURL.search)
      : cfURL

    if (url.pathname === '/auth') {
      const error = url.searchParams.get('error')
      if (error !== null)
        return new Response(`Google OAuth error: [${error}]`, { status: 400 })

      const code = url.searchParams.get('code')
      if (code === null)
        return new Response(`Bad auth callback (no 'code')`, { status: 400 })

      const tokenResponse = await tokenExchange(env, url, code)
      const newAuth = generateAuth()
      const expiration = now() + tokenResponse.expires_in * MILLIS
      await save(
        newAuth,
        tokenResponse.access_token,
        Math.floor(expiration / MILLIS),
      )

      return redirect(
        '/' + decodeURIComponent(url.searchParams.get('state') || ''),
        setCookie(newAuth, new Date(expiration)),
      )
    }

    const cookies = request.headers.get('Cookie')
    if (!cookies) return login(env, google, url)

    const auth = findCookie(AUTH_COOKIE, cookies)
    if (!auth) return login(env, google, url)

    const token = await get(auth)
    if (!token) return login(env, google, url)

    switch (url.pathname) {
      case '/': {
        const files = await listDriveFiles(token, url.searchParams.get('q'))
        return render(files)
      }
      case '/logout': {
        event.waitUntil(Promise.allSettled([removeToken(token), remove(auth)]))

        return new Response('Loged out', {
          headers: setCookie('deleted', EXPIRED),
        })
      }
      default:
        console.log('Not found', url.pathname)
        return new Response('Not found', { status: 404 })
    }
  }
}
