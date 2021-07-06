export interface EnvSystem {
  isLocal: boolean
  clientID: string
  clientSecret: string
  now: () => number
}

const system: EnvSystem = {
  isLocal: LOCAL,
  clientID: CLIENT_ID,
  clientSecret: CLIENT_SECRET,
  now: () => Date.now(),
}

export default system
