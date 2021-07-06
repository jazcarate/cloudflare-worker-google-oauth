import { CryptoSystem } from '../src/lib/crypto'
import { EnvSystem } from '../src/lib/env'
import { GoogleSystem } from '../src/lib/google'
import { KVSystem } from '../src/lib/kv'

export const google: GoogleSystem = {
  oauthURL: jest.fn((params) => 'oauth url'),
  tokenExchange: jest.fn((env, url, code) =>
    Promise.resolve({
      access_token: 'access_token',
      expires_in: 100,
    }),
  ),
  removeToken: jest.fn((accessToken) => Promise.resolve()),
  listDriveFiles: jest.fn((accessToken, query) =>
    Promise.resolve({
      items: [
        {
          title: 'item 1',
          iconLink: 'http://example.com/image-1',
          alternateLink: 'http://example.com/link-1',
          owners: [
            {
              displayName: 'owner',
            },
          ],
        },
      ],
    }),
  ),
}

export const kv: KVSystem = {
  save: jest.fn((auth, token, expiration) => Promise.resolve()),
  get: jest.fn((auth) => Promise.resolve('a token')),
  remove: jest.fn((auth) => Promise.resolve()),
}

export const env: EnvSystem = {
  isLocal: false,
  clientID: 'client id',
  clientSecret: 'client secret',
  now: jest.fn(() => 1625608705094), //~ Jul 06 2021 00:00:05
}

export const crypo: CryptoSystem = {
  generateAuth: jest.fn(() => 'an auth'),
}
