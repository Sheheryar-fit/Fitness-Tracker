// Supabase Auth logs in with an email, but this app uses usernames. Each
// username maps to an internal address that never receives mail.
// Must match public.login_email() in supabase/security_1_auth.sql
export async function usernameToEmail(username) {
  const bytes = new TextEncoder().encode(username.trim().toLowerCase())
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  const hex = Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 32)}@users.example.com`
}
