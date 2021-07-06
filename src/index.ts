import kv from './lib/kv'
import google from './lib/google'
import env from './lib/env'
import crypo from './lib/crypto'
import main from './handler'

const handleRequest = main(kv, google, env, crypo)

addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event))
})
