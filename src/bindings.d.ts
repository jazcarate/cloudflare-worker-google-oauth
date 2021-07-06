export {}

declare global {
  const CLIENT_ID: string
  const CLIENT_SECRET: string
  const LOCAL: boolean
  const authTokens: KVNamespace
}
