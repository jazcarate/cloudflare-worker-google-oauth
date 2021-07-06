export interface CryptoSystem {
  generateAuth: () => string
}

function generateAuth(): string {
  return [...crypto.getRandomValues(new Uint8Array(20))]
    .map((m) => m.toString(36).padStart(2, '0'))
    .join('')
}

const system: CryptoSystem = {
  generateAuth,
}

export default system
