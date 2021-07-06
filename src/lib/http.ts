export function findCookie(name: string, coockieString: string): string | null {
  for (const cookie of coockieString.split(';')) {
    const [key, value] = cookie.split('=', 2)
    if (key.trim() === name) return value
  }
  return null
}

export function redirect(
  location: string,
  additionalHeader?: HeadersInit,
): Response {
  return new Response('', {
    status: 302,
    headers: {
      ...additionalHeader,
      Location: location,
    },
  })
}
