/**
 * Reviews — one review per user of their EBEXTA experience.
 * Backed by the public.reviews table (see supabase/reviews.sql). RLS scopes
 * reads/writes to the owner; admins see everything in the console.
 */
import { supabase } from './supabase'

export interface Review {
  id: string
  user_id: string
  rating: number
  title: string | null
  body: string | null
  display_name: string | null
  company: string | null
  status: 'published' | 'hidden'
  created_at: string
  updated_at: string
}

/** The current user's existing review, if they've left one. */
export async function fetchMyReview(userId: string): Promise<Review | null> {
  try {
    const { data } = await supabase.from('reviews').select('*').eq('user_id', userId).maybeSingle()
    return (data as Review) ?? null
  } catch {
    return null
  }
}

/** Create or update the user's review (upsert keyed on user_id). */
export async function submitReview(input: {
  userId: string
  rating: number
  title?: string
  body?: string
  displayName?: string
  company?: string
}): Promise<{ error: string | null }> {
  const row = {
    user_id: input.userId,
    rating: input.rating,
    title: input.title?.trim() || null,
    body: input.body?.trim() || null,
    display_name: input.displayName?.trim() || null,
    company: input.company?.trim() || null,
    status: 'published' as const,
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabase.from('reviews').upsert(row, { onConflict: 'user_id' })
  return { error: error?.message ?? null }
}
