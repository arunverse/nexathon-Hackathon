import { supabase } from './supabase'

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/dashboard` },
  })
  if (error) throw error
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${window.location.origin}/onboarding` },
  })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

export async function createProfileIfMissing(userId: string, email: string) {
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .single()

  if (!existing) {
    await supabase.from('profiles').insert({
      id: userId,
      sender_email: email,
      company_name: '',
      mission: '',
      mode: 'seeker',
      plan: 'growth',
      credits: 2500,
      credit_limit: 2500,
      is_admin: false,
    })
  }
}
