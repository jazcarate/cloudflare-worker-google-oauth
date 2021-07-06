import { EnvSystem } from './env'

export interface GoogleSystem {
  oauthURL: (params: AuthParams) => string
  tokenExchange: (
    env: EnvSystem,
    url: URL,
    code: string,
  ) => Promise<TokenResponse>
  removeToken: (accessToken: string) => Promise<void>
  listDriveFiles: (
    accessToken: string,
    query: string | null,
  ) => Promise<DriveFiles>
}

interface AuthParams {
  client_id: string // The client ID for your application.
  redirect_uri: string // Determines where the API server redirects the user after the user completes the authorization flow.
  response_type: 'code'
  scope: string // A space-delimited list of scopes that identify the resources that your application could access on the user's behalf. These values inform the consent screen that Google displays to the user.
  state?: string // Specifies any string value that your application uses to maintain state between your authorization request and the authorization server's response.
}

interface TokenParams {
  client_id: string // The client ID for your application.
  client_secret: string // The client secret for your application.
  code: string // The authorization code returned from the initial request.
  grant_type: 'authorization_code'
  redirect_uri: string
}

interface TokenResponse {
  access_token: string // The token that your application sends to authorize a Google API request.
  expires_in: number // The remaining lifetime of the access token in seconds.
}

export interface DriveFiles {
  // https://developers.google.com/drive/api/v2/reference/files#resource
  items: {
    // https://developers.google.com/drive/api/v2/reference/files#resource
    title: string
    iconLink: string
    alternateLink: string
    owners: {
      displayName: string
    }[]
  }[]
}

export const DRIVE_SCOPE =
  'https://www.googleapis.com/auth/drive.metadata.readonly'

export function oauthURL(params: AuthParams): string {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value)
  })

  return url.href
}

async function tokenExchange(
  env: EnvSystem,
  url: URL,
  code: string,
): Promise<TokenResponse> {
  const { clientSecret, clientID } = env
  const redidirectURI = url.origin + '/auth'
  const params: TokenParams = {
    client_id: clientID,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redidirectURI,
  }

  const body = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    body.append(key, value)
  })

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })
  const resp = await response.json()
  if (resp.error) throw new Error(resp.error)
  return resp
}

async function removeToken(accessToken: string): Promise<void> {
  const body = new URLSearchParams()
  body.append('token', accessToken)

  const response = await fetch('https://oauth2.googleapis.com/revoke', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  if (response.status !== 200) {
    const resp = await response.text()
    throw new Error(resp)
  }

  return
}

async function listDriveFiles(
  accessToken: string,
  query: string | null,
): Promise<DriveFiles> {
  const url = new URL('https://www.googleapis.com/drive/v2/files')
  if (query) url.searchParams.append('q', `title contains '${query}'`) // https://developers.google.com/drive/api/v2/search-files

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const resp = await response.json()
  if (resp.error) throw new Error(JSON.stringify(resp.error))

  return resp
}

const system: GoogleSystem = {
  oauthURL,
  tokenExchange,
  removeToken,
  listDriveFiles,
}

export default system
