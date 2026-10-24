import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { sanitizeText } from '../../lib/sanitize'
import { resolveSenderProfile } from '../../lib/senderProfile'

export interface CommunityPost {
  id: string
  user_id: string
  company_name: string | null
  company_logo: string | null
  author_avatar?: string | null
  post_type: 'news' | 'product' | 'hiring' | 'partnership' | 'funding' | 'announcement' | 'update'
  content: string
  image_url: string | null
  video_url?: string | null
  link_url: string | null
  likes_count: number
  comments_count: number
  is_verified: boolean
  data_origin: 'company_provided' | 'ebexta_verified' | 'ai_generated' | 'public_data'
  created_at: string
  user_reacted?: string | null
  is_anonymous?: boolean
}

export interface PostComment {
  id: string
  post_id: string
  user_id: string
  content: string
  created_at: string
  company_name?: string
  author_avatar?: string | null
}

interface CompanyFeedProps {
  onOpenCompanyProfile: (userId: string, companyName?: string) => void
  groupId?: string
}

const POST_TYPES = [
  { id: 'update', label: 'General Update', icon: 'feed' },
  { id: 'news', label: 'Company News', icon: 'newspaper' },
  { id: 'product', label: 'Product Launch', icon: 'rocket_launch' },
  { id: 'hiring', label: 'Hiring', icon: 'work' },
  { id: 'partnership', label: 'Partnership', icon: 'handshake' },
  { id: 'funding', label: 'Funding', icon: 'payments' },
  { id: 'announcement', label: 'Announcement', icon: 'campaign' },
] as const

const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // 10 MB limit
const MAX_VIDEO_BYTES = 15 * 1024 * 1024 // 15 MB compact limit for fast loading

/**
 * Client-side canvas image compressor.
 * Resizes images over 1200px and encodes to 82% WebP / JPEG.
 * Converts 5-10 MB photos down to ~200-400 KB payloads!
 */
async function compressImage(file: File): Promise<{ dataUrl: string; sizeKb: number }> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_IMAGE_BYTES) {
      reject(new Error('Image file is larger than 10 MB limit.'))
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height

        const MAX_DIM = 1200
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width)
            width = MAX_DIM
          } else {
            width = Math.round((width * MAX_DIM) / height)
            height = MAX_DIM
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve({ dataUrl: e.target?.result as string, sizeKb: Math.round(file.size / 1024) })
          return
        }

        ctx.drawImage(img, 0, 0, width, height)
        const mimeType = file.type === 'image/png' || file.type === 'image/webp' ? 'image/webp' : 'image/jpeg'
        const dataUrl = canvas.toDataURL(mimeType, 0.82)
        const sizeKb = Math.round((dataUrl.length * 3) / 4 / 1024)
        resolve({ dataUrl, sizeKb })
      }
      img.onerror = () => reject(new Error('Failed to parse image file.'))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('Failed to read image file.'))
    reader.readAsDataURL(file)
  })
}

/**
 * Lightweight Video File processor with 15 MB limit validation.
 */
async function processVideo(file: File): Promise<{ dataUrl: string; sizeMb: number }> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_VIDEO_BYTES) {
      reject(new Error(`Video is ${(file.size / 1024 / 1024).toFixed(1)} MB. Max video upload allowed is 15 MB for fast network streaming.`))
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      const sizeMb = parseFloat((file.size / 1024 / 1024).toFixed(2))
      resolve({ dataUrl, sizeMb })
    }
    reader.onerror = () => reject(new Error('Failed to read video file.'))
    reader.readAsDataURL(file)
  })
}

export function CompanyFeed({ onOpenCompanyProfile, groupId }: CompanyFeedProps) {
  const { user } = useAuth()
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'latest' | 'relevant'>('latest')
  
  // New Post Form & Media Sync
  const [showPublisher, setShowPublisher] = useState(false)
  const [userCompanyName, setUserCompanyName] = useState('')
  const [publishAnonymously, setPublishAnonymously] = useState(false)
  const [postType, setPostType] = useState<CommunityPost['post_type']>('update')
  const [content, setContent] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Media preview card state
  const [mediaPreview, setMediaPreview] = useState<{
    type: 'image' | 'video'
    url: string
    fileName: string
    sizeInfo: string
  } | null>(null)

  // File Inputs
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  // Active Comment Drawer
  const [activePostId, setActivePostId] = useState<string | null>(null)
  const [comments, setComments] = useState<PostComment[]>([])
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)

  // Report modal state
  const [reportingPostId, setReportingPostId] = useState<string | null>(null)
  const [reportReason, setReportReason] = useState('')

  const [userName, setUserName] = useState('')
  const [userAvatar, setUserAvatar] = useState('')

  // Sync logged in user's company name and personal profile details
  useEffect(() => {
    if (!user) return
    try {
      const localAvatar = localStorage.getItem('ebexta_user_avatar')
      const localName = localStorage.getItem('ebexta_user_name')
      if (localAvatar) setUserAvatar(localAvatar)
      if (localName) setUserName(localName)
    } catch { /* ignore */ }

    const googleAvatar =
      (user.user_metadata?.avatar_url as string | undefined) ||
      (user.user_metadata?.picture as string | undefined) ||
      ''

    supabase
      .from('profiles')
      .select('company_name, full_name, name, profile_image_url, avatar_url, logo_url')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        const sender = resolveSenderProfile(data)
        const resolved =
          data?.company_name?.trim() ||
          (user.user_metadata?.company_name as string | undefined)?.trim() ||
          (sender.companyName && sender.companyName !== 'Your Company' ? sender.companyName : '') ||
          (user.email ? user.email.split('@')[0] : '')

        if (resolved) {
          setUserCompanyName(resolved)
        }
        const uName = data?.full_name || data?.name || user.user_metadata?.full_name || user.user_metadata?.name || ''
        if (uName) setUserName(uName)
        const uAvatar = data?.profile_image_url || data?.avatar_url || data?.logo_url || googleAvatar || ''
        if (uAvatar) setUserAvatar(uAvatar)
      })
  }, [user])

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true)
      let query = supabase
        .from('community_posts')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(30)

      if (groupId) {
        query = query.eq('group_id', groupId)
      } else {
        query = query.is('group_id', null)
      }

      const { data: postsData, error } = await query
      if (error) throw error

      if (postsData && postsData.length > 0) {
        // Collect user_ids to fetch dynamic author profile details
        const userIds = Array.from(new Set(postsData.map((p) => p.user_id).filter(Boolean)))
        
        const profileMap = new Map<string, { company_name?: string; logo_url?: string; profile_image_url?: string; avatar_url?: string; full_name?: string }>()
        if (userIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, company_name, logo_url, profile_image_url, avatar_url, full_name')
            .in('id', userIds)

          profilesData?.forEach((prof) => {
            profileMap.set(prof.id, prof)
          })
        }

        const reactionMap = new Map<string, string>()
        if (user) {
          const postIds = postsData.map((p) => p.id)
          const { data: reactionsData } = await supabase
            .from('community_post_reactions')
            .select('post_id, reaction_type')
            .eq('user_id', user.id)
            .in('post_id', postIds)

          reactionsData?.forEach((r) => reactionMap.set(r.post_id, r.reaction_type))
        }

        const formatted = postsData.map((p) => {
          const prof = profileMap.get(p.user_id)
          const isOwnPost = user && p.user_id === user.id
          const localSender = isOwnPost ? resolveSenderProfile(prof) : null
          const googleAvatar = isOwnPost ? ((user.user_metadata?.avatar_url as string) || (user.user_metadata?.picture as string)) : null

          const isAnon =
            p.company_name === 'Verified Enterprise (Confidential)' ||
            p.company_name === 'Verified Enterprise' ||
            p.company_name === 'Verified Business'

          const resolvedName = isAnon
            ? 'Verified Enterprise (Confidential)'
            : (isOwnPost && userCompanyName ? userCompanyName : null) ||
              prof?.company_name?.trim() ||
              prof?.full_name?.trim() ||
              (localSender?.companyName && localSender.companyName !== 'Your Company' ? localSender.companyName : null) ||
              (p.company_name && p.company_name !== 'Verified Company' ? p.company_name : null) ||
              `Enterprise Member (${p.user_id ? p.user_id.slice(0, 5).toUpperCase() : 'VERIFIED'})`

          const resolvedAvatar = isAnon
            ? null
            : prof?.avatar_url || prof?.profile_image_url || prof?.logo_url || p.company_logo || googleAvatar || (isOwnPost ? userAvatar : null)

          return {
            ...p,
            company_name: resolvedName,
            company_logo: resolvedAvatar,
            author_avatar: resolvedAvatar,
            is_anonymous: isAnon,
            user_reacted: reactionMap.get(p.id) || null,
          }
        })
        setPosts(formatted)
      } else {
        setPosts([])
      }
    } catch (err: any) {
      console.error('Error fetching community posts:', err)
    } finally {
      setLoading(false)
    }
  }, [groupId, user, userCompanyName, userAvatar])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  // Realtime subscription for posts
  useEffect(() => {
    const channel = supabase
      .channel('public:community_posts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_posts' }, () => {
        fetchPosts()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchPosts])

  // Media File Select Handlers
  async function handleImageFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setFormError(null)
      const { dataUrl, sizeKb } = await compressImage(file)
      setImageUrl(dataUrl)
      setVideoUrl('')
      setMediaPreview({
        type: 'image',
        url: dataUrl,
        fileName: file.name,
        sizeInfo: `⚡ ${sizeKb} KB (Auto-Optimized WebP)`,
      })
    } catch (err: any) {
      setFormError(err.message || 'Failed to process image file.')
    }
  }

  async function handleVideoFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setFormError(null)
      const { dataUrl, sizeMb } = await processVideo(file)
      setVideoUrl(dataUrl)
      setImageUrl('')
      setMediaPreview({
        type: 'video',
        url: dataUrl,
        fileName: file.name,
        sizeInfo: `🎥 ${sizeMb} MB (Web Compatible Video)`,
      })
    } catch (err: any) {
      setFormError(err.message || 'Failed to process video file.')
    }
  }

  function handleClearMedia() {
    setImageUrl('')
    setVideoUrl('')
    setMediaPreview(null)
    if (imageInputRef.current) imageInputRef.current.value = ''
    if (videoInputRef.current) videoInputRef.current.value = ''
  }

  async function handleCreatePost(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!content.trim()) {
      setFormError('Post content cannot be empty.')
      return
    }

    try {
      setSubmitting(true)
      setFormError(null)

      // Fetch sender profile for company name & update DB profile if missing
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_name, logo_url, profile_image_url, avatar_url, full_name')
        .eq('id', user.id)
        .maybeSingle()

      const sender = resolveSenderProfile(profile)
      const resolvedCompanyName =
        userCompanyName.trim() ||
        profile?.company_name?.trim() ||
        profile?.full_name?.trim() ||
        (user.user_metadata?.company_name as string | undefined)?.trim() ||
        (sender.companyName && sender.companyName !== 'Your Company' ? sender.companyName : '') ||
        (user.email ? user.email.split('@')[0] : 'Enterprise Member')

      const finalCompanyName = publishAnonymously
        ? 'Verified Enterprise (Confidential)'
        : resolvedCompanyName

      const googleAvatar =
        (user.user_metadata?.avatar_url as string | undefined) ||
        (user.user_metadata?.picture as string | undefined) ||
        ''

      const companyLogo = publishAnonymously
        ? null
        : profile?.logo_url || profile?.avatar_url || profile?.profile_image_url || googleAvatar || userAvatar || null

      // Save company_name to profiles table in Supabase so future queries find it
      if (!publishAnonymously && resolvedCompanyName && resolvedCompanyName !== 'Enterprise Member') {
        await supabase.from('profiles').upsert({ id: user.id, company_name: resolvedCompanyName }, { onConflict: 'id' })
      }

      // Update localStorage filters cache as well
      try {
        const ob = JSON.parse(localStorage.getItem('ebexta_scan_filters') ?? '{}')
        localStorage.setItem('ebexta_scan_filters', JSON.stringify({ ...ob, companyName: resolvedCompanyName }))
      } catch (err) {
        // ignore storage write error
      }

      const { error } = await supabase.from('community_posts').insert({
        user_id: user.id,
        company_name: finalCompanyName,
        company_logo: companyLogo,
        post_type: postType,
        content: sanitizeText(content),
        image_url: imageUrl.trim() ? (imageUrl.trim().startsWith('data:') ? imageUrl.trim() : sanitizeText(imageUrl.trim(), 4096)) : null,
        video_url: videoUrl.trim() ? (videoUrl.trim().startsWith('data:') ? videoUrl.trim() : sanitizeText(videoUrl.trim(), 4096)) : null,
        link_url: linkUrl.trim() ? sanitizeText(linkUrl.trim()) : null,
        group_id: groupId || null,
        data_origin: 'company_provided',
      })

      if (error) throw error

      setContent('')
      setImageUrl('')
      setVideoUrl('')
      setLinkUrl('')
      setMediaPreview(null)
      setShowPublisher(false)
      fetchPosts()
    } catch (err: any) {
      setFormError(err.message || 'Failed to publish post.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggleReaction(post: CommunityPost, reactionType: string = 'like') {
    if (!user) return

    try {
      if (post.user_reacted) {
        // Remove reaction
        await supabase
          .from('community_post_reactions')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', user.id)

        setPosts((prev) =>
          prev.map((p) =>
            p.id === post.id
              ? { ...p, likes_count: Math.max(0, p.likes_count - 1), user_reacted: null }
              : p
          )
        )
      } else {
        // Add reaction
        await supabase.from('community_post_reactions').insert({
          post_id: post.id,
          user_id: user.id,
          reaction_type: reactionType,
        })

        setPosts((prev) =>
          prev.map((p) =>
            p.id === post.id
              ? { ...p, likes_count: p.likes_count + 1, user_reacted: reactionType }
              : p
          )
        )

        // Notify post owner if different user
        if (post.user_id !== user.id) {
          await supabase.from('community_notifications').insert({
            user_id: post.user_id,
            actor_id: user.id,
            type: 'post_reaction',
            title: 'New post reaction',
            body: `A member reacted to your ${post.post_type} post.`,
            link: `/dashboard/community`,
          })
        }
      }
    } catch (err) {
      console.error('Reaction error:', err)
    }
  }

  async function handleOpenComments(postId: string) {
    setActivePostId(postId)
    try {
      const { data } = await supabase
        .from('community_post_comments')
        .select('*')
        .eq('post_id', postId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })

      if (data && data.length > 0) {
        const commenterIds = Array.from(new Set(data.map((c) => c.user_id).filter(Boolean)))
        const profileMap = new Map<string, { company_name?: string; full_name?: string; avatar_url?: string; profile_image_url?: string; logo_url?: string }>()
        
        if (commenterIds.length > 0) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, company_name, full_name, avatar_url, profile_image_url, logo_url')
            .in('id', commenterIds)
          profs?.forEach((pr) => profileMap.set(pr.id, pr))
        }

        const formatted = data.map((c) => {
          const prof = profileMap.get(c.user_id)
          const isOwn = user && c.user_id === user.id
          const googleAvatar = isOwn ? ((user.user_metadata?.avatar_url as string) || (user.user_metadata?.picture as string)) : null
          const avatar = prof?.avatar_url || prof?.profile_image_url || prof?.logo_url || googleAvatar || (isOwn ? userAvatar : null)
          const cName = prof?.company_name || prof?.full_name || (isOwn ? (userName || userCompanyName) : 'Member')
          return {
            ...c,
            company_name: cName,
            author_avatar: avatar,
          }
        })
        setComments(formatted)
      } else {
        setComments([])
      }
    } catch (err) {
      console.error('Error fetching comments:', err)
    }
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !activePostId || !commentText.trim()) return

    try {
      setSubmittingComment(true)
      const { data, error } = await supabase
        .from('community_post_comments')
        .insert({
          post_id: activePostId,
          user_id: user.id,
          content: sanitizeText(commentText),
        })
        .select()
        .single()

      if (error) throw error

      const googleAvatar = (user.user_metadata?.avatar_url as string) || (user.user_metadata?.picture as string) || ''
      const myAvatar = userAvatar || googleAvatar || null

      setComments((prev) => [
        ...prev,
        {
          ...data,
          company_name: userCompanyName || userName || 'You',
          author_avatar: myAvatar,
        },
      ])
      setCommentText('')
      
      setPosts((prev) =>
        prev.map((p) => (p.id === activePostId ? { ...p, comments_count: p.comments_count + 1 } : p))
      )
    } catch (err: any) {
      console.error('Comment add error:', err)
    } finally {
      setSubmittingComment(false)
    }
  }

  async function handleDeletePost(postId: string) {
    if (!user) return
    if (!confirm('Are you sure you want to delete this broadcast?')) return

    try {
      const { error } = await supabase
        .from('community_posts')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', postId)
        .eq('user_id', user.id)

      if (error) {
        await supabase
          .from('community_posts')
          .delete()
          .eq('id', postId)
          .eq('user_id', user.id)
      }

      setPosts((prev) => prev.filter((p) => p.id !== postId))
    } catch (err: any) {
      console.error('Delete post error:', err)
      alert('Failed to delete post.')
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (!user) return
    if (!confirm('Delete this comment?')) return

    try {
      await supabase
        .from('community_post_comments')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', commentId)
        .eq('user_id', user.id)

      setComments((prev) => prev.filter((c) => c.id !== commentId))
      if (activePostId) {
        setPosts((prev) =>
          prev.map((p) => (p.id === activePostId ? { ...p, comments_count: Math.max(0, p.comments_count - 1) } : p))
        )
      }
    } catch (err) {
      console.error('Delete comment error:', err)
    }
  }

  async function handleReportPost() {
    if (!user || !reportingPostId || !reportReason.trim()) return
    try {
      await supabase.from('community_reports').insert({
        reporter_id: user.id,
        target_type: 'post',
        target_id: reportingPostId,
        reason: sanitizeText(reportReason),
      })
      setReportingPostId(null)
      setReportReason('')
      alert('Report submitted to EBEXTA moderation team.')
    } catch (err) {
      console.error('Report error:', err)
    }
  }

  return (
    <div className="space-y-6">
      {/* Feed Controls Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab('latest')}
            className={`px-4 py-2 rounded-xl text-[13px] font-semibold transition-all ${
              tab === 'latest'
                ? 'bg-[var(--accent-subtle)] text-[var(--accent-interactive)] border border-[var(--border-strong)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Latest Posts
          </button>
          <button
            onClick={() => setTab('relevant')}
            className={`px-4 py-2 rounded-xl text-[13px] font-semibold transition-all ${
              tab === 'relevant'
                ? 'bg-[var(--accent-subtle)] text-[var(--accent-interactive)] border border-[var(--border-strong)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Relevant Insights
          </button>
        </div>

        <button
          onClick={() => setShowPublisher(!showPublisher)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold bg-[var(--accent)] text-[var(--bg-elevated)] hover:opacity-90 transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          Publish Update
        </button>
      </div>

      {/* Post Publisher Card */}
      <AnimatePresence>
        {showPublisher && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleCreatePost}
            className="p-5 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-strong)] space-y-4 overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div>
                <span className="text-[14px] font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-[var(--accent-interactive)]">campaign</span>
                  Publish Company News & Public Broadcast
                </span>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  Share general company news, hiring, product launches, or press updates with the network. (For active B2B deal requirements, use 🎯 Declared Intent).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPublisher(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Publishing Profile & Verified Company Sync */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--bg-surface)] p-3 rounded-xl border border-[var(--border-subtle)]">
              <div className="flex items-center gap-2.5">
                {publishAnonymously ? (
                  <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold shrink-0">
                    <span className="material-symbols-outlined text-[18px]">verified_user</span>
                  </div>
                ) : userAvatar ? (
                  <img src={userAvatar} alt="Avatar" className="w-8 h-8 rounded-full object-cover border border-[var(--border-strong)] shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[var(--accent)] text-[var(--bg-elevated)] flex items-center justify-center text-[12px] font-bold shrink-0">
                    {(userName || userCompanyName || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <span className="text-[12.5px] font-bold text-[var(--text-primary)] block leading-tight">
                    {publishAnonymously ? 'Verified Enterprise (Confidential)' : (userName || 'Member User')}
                  </span>
                  <span className="text-[11px] font-bold text-[var(--accent-interactive)] flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px]">verified</span>
                    <span>{publishAnonymously ? 'Confidential Broadcast' : (userCompanyName || 'Verified Business')}</span>
                  </span>
                </div>
              </div>

              {/* Identity Disclosure Toggle */}
              <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-strong)] cursor-pointer hover:border-[var(--accent-interactive)] transition-all select-none">
                <input
                  type="checkbox"
                  checked={publishAnonymously}
                  onChange={(e) => setPublishAnonymously(e.target.checked)}
                  className="w-4 h-4 rounded border-[var(--border-strong)] text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                />
                <span className="text-[12px] font-bold text-[var(--text-primary)] flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px] text-emerald-400">shield</span>
                  Publish Anonymously (Verified Enterprise)
                </span>
              </label>
            </div>

            {/* Post Type Selector */}
            <div>
              <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-2 uppercase tracking-wider">
                Select Broadcast Type
              </label>
              <div className="flex flex-wrap gap-2">
                {POST_TYPES.map((pt) => (
                  <button
                    key={pt.id}
                    type="button"
                    onClick={() => setPostType(pt.id as any)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
                      postType === pt.id
                        ? 'bg-[var(--accent)] text-[var(--bg-elevated)] font-bold'
                        : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px]">{pt.icon}</span>
                    {pt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Content Textarea */}
            <div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={3}
                placeholder="Share news, hiring announcements, product updates, or strategic partnerships..."
                className="w-full p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] focus:border-[var(--accent-interactive)] focus:outline-none resize-none"
              />
            </div>

            {/* Hidden File Inputs */}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={handleImageFileSelect}
              className="hidden"
            />
            <input
              ref={videoInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime,video/*"
              onChange={handleVideoFileSelect}
              className="hidden"
            />

            {/* Media Attachment Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--accent-interactive)] hover:text-[var(--accent-interactive)] transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[17px] text-emerald-500">photo_library</span>
                  <span>Upload Photo (Auto-Compressed)</span>
                </button>

                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--accent-interactive)] hover:text-[var(--accent-interactive)] transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[17px] text-indigo-400">videocam</span>
                  <span>Upload Video (Max 15MB)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowLinkInput(!showLinkInput)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--accent-interactive)] hover:text-[var(--accent-interactive)] transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[17px] text-blue-400">link</span>
                  <span>Attach Link</span>
                </button>
              </div>

              {mediaPreview && (
                <button
                  type="button"
                  onClick={handleClearMedia}
                  className="text-[11px] font-bold text-red-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                  Clear Media
                </button>
              )}
            </div>

            {/* Media Live Preview Card */}
            {mediaPreview && (
              <div className="relative p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-strong)] flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {mediaPreview.type === 'image' ? (
                    <img src={mediaPreview.url} alt="Preview" className="w-14 h-14 rounded-lg object-cover border border-[var(--border-subtle)] shrink-0" />
                  ) : (
                    <video src={mediaPreview.url} className="w-20 h-14 rounded-lg object-cover border border-[var(--border-subtle)] bg-black shrink-0" />
                  )}
                  <div className="min-w-0">
                    <span className="block text-[12.5px] font-bold text-[var(--text-primary)] truncate">{mediaPreview.fileName}</span>
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--accent-subtle)] text-[var(--accent-interactive)] border border-[var(--border-strong)] mt-0.5">
                      {mediaPreview.sizeInfo}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClearMedia}
                  className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors shrink-0 cursor-pointer"
                  title="Remove media"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            )}

            {/* Optional External Link Input */}
            {showLinkInput && (
              <div className="pt-1">
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="Paste external link URL (e.g. https://yourcompany.com/blog/article)"
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] focus:border-[var(--accent-interactive)] focus:outline-none"
                />
              </div>
            )}

            {formError && (
              <div className="text-[12px] text-red-400 bg-red-950/40 p-2.5 rounded-lg border border-red-800/40 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">warning</span>
                <span>{formError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPublisher(false)}
                className="px-4 py-2 rounded-xl text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-xl text-[12px] font-bold bg-[var(--accent-interactive)] text-white hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2 shadow-xs cursor-pointer"
              >
                {submitting && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Publish Post
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Posts Listing */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-44 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] animate-pulse" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-3">
          <span className="material-symbols-outlined text-[42px] text-[var(--text-muted)]">campaign</span>
          <h3 className="text-[16px] font-bold text-[var(--text-primary)]">No community broadcasts yet</h3>
          <p className="text-[13px] text-[var(--text-muted)] max-w-md mx-auto">
            Be the first company to publish an update or market announcement to the EBEXTA business network.
          </p>
          <button
            onClick={() => setShowPublisher(true)}
            className="px-4 py-2 rounded-xl text-[13px] font-bold bg-[var(--accent-subtle)] text-[var(--accent-interactive)] border border-[var(--border-strong)] hover:opacity-90 transition-all"
          >
            Publish First Post
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-all space-y-4"
            >
              {/* Post Header */}
              <div className="flex items-start justify-between gap-3">
                <div
                  className={`flex items-center gap-3 ${post.is_anonymous ? 'cursor-default' : 'cursor-pointer group'}`}
                  onClick={() => {
                    if (post.is_anonymous) return
                    onOpenCompanyProfile(post.user_id, post.company_name || undefined)
                  }}
                >
                  {post.is_anonymous ? (
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold shrink-0">
                      <span className="material-symbols-outlined text-[20px]">verified_user</span>
                    </div>
                  ) : post.author_avatar || post.company_logo ? (
                    <img
                      src={post.author_avatar || post.company_logo!}
                      alt="Avatar"
                      className="w-10 h-10 rounded-xl object-cover border border-[var(--border-strong)] shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-[var(--accent-subtle)] border border-[var(--border-strong)] flex items-center justify-center font-bold text-[var(--accent-interactive)] shrink-0">
                      {post.company_name ? post.company_name[0]?.toUpperCase() : 'C'}
                    </div>
                  )}

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-interactive)] transition-colors">
                        {post.company_name || 'Verified Member'}
                      </span>
                      {post.is_anonymous ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">shield</span>
                          Confidential
                        </span>
                      ) : post.is_verified ? (
                        <span className="material-symbols-outlined text-[15px] text-[var(--accent-interactive)]" title="EBEXTA Verified">
                          verified
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] mt-0.5">
                      <span className="uppercase font-semibold tracking-wider text-[10px] text-[var(--accent-interactive)]">
                        {post.post_type}
                      </span>
                      <span>•</span>
                      <span>{new Date(post.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                    </div>
                  </div>
                </div>

                {/* Data Provenance & Action Badges */}
                <div className="flex items-center gap-2">
                  <DataOriginBadge origin={post.data_origin} />

                  {user && user.id === post.user_id && (
                    <button
                      onClick={() => handleDeletePost(post.id)}
                      className="p-1 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                      title="Delete broadcast"
                    >
                      <span className="material-symbols-outlined text-[17px]">delete</span>
                    </button>
                  )}

                  {user && user.id !== post.user_id && (
                    <button
                      onClick={() => setReportingPostId(post.id)}
                      className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                      title="Report content"
                    >
                      <span className="material-symbols-outlined text-[16px]">flag</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Post Content */}
              <div className="text-[13px] text-[var(--text-primary)] leading-relaxed whitespace-pre-line">
                {post.content}
              </div>

              {/* Video Attachment */}
              {post.video_url || (post.image_url && (post.image_url.startsWith('data:video') || post.image_url.match(/\.(mp4|webm|mov)(\?.*)?$/i))) ? (
                <div className="rounded-xl overflow-hidden border border-[var(--border-subtle)] max-h-[400px] bg-black flex items-center justify-center my-2">
                  <video
                    src={post.video_url || post.image_url!}
                    controls
                    preload="metadata"
                    className="w-full max-h-[400px] object-contain"
                  />
                </div>
              ) : post.image_url ? (
                <div className="rounded-xl overflow-hidden border border-[var(--border-subtle)] max-h-[500px] bg-black/30 my-2 flex items-center justify-center">
                  <img
                    src={post.image_url}
                    alt="Post Media"
                    className="w-full max-h-[500px] object-contain rounded-xl"
                    onError={(e) => {
                      // Hide element gracefully if corrupted string from legacy post
                      (e.target as HTMLElement).parentElement?.classList.add('hidden')
                    }}
                  />
                </div>
              ) : null}

              {/* Link Attachment */}
              {post.link_url && (
                <a
                  href={post.link_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--accent-interactive)] hover:underline truncate"
                >
                  <span className="material-symbols-outlined text-[16px]">link</span>
                  <span className="truncate">{post.link_url}</span>
                </a>
              )}

              {/* Footer Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-[var(--border-subtle)] text-[12px] text-[var(--text-secondary)]">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => handleToggleReaction(post)}
                    className={`flex items-center gap-1.5 font-semibold transition-colors ${
                      post.user_reacted ? 'text-[var(--accent-interactive)] font-bold' : 'hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {post.user_reacted ? 'thumb_up' : 'thumb_up_off'}
                    </span>
                    <span>{post.likes_count} Likes</span>
                  </button>

                  <button
                    onClick={() => handleOpenComments(post.id)}
                    className="flex items-center gap-1.5 font-semibold hover:text-[var(--text-primary)] transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">chat_bubble_outline</span>
                    <span>{post.comments_count} Comments</span>
                  </button>
                </div>

                <button
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href)
                    alert('Post link copied to clipboard!')
                  }}
                  className="flex items-center gap-1 font-semibold hover:text-[var(--text-primary)] transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">share</span>
                  <span>Share</span>
                </button>
              </div>

              {/* Inline Comments Section */}
              {activePostId === post.id && (
                <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] space-y-3">
                  <h4 className="text-[12px] font-bold text-[var(--text-primary)]">Comments</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {comments.length === 0 ? (
                      <p className="text-[11px] text-[var(--text-muted)]">No comments yet. Start the conversation!</p>
                    ) : (
                      comments.map((c) => (
                        <div key={c.id} className="p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] flex items-start gap-2.5">
                          {c.author_avatar ? (
                            <img src={c.author_avatar} alt="Avatar" className="w-6 h-6 rounded-full object-cover border border-[var(--border-strong)] shrink-0 mt-0.5" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-[var(--accent-subtle)] border border-[var(--border-strong)] flex items-center justify-center font-bold text-[10px] text-[var(--accent-interactive)] shrink-0 mt-0.5">
                              {(c.company_name || 'M').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] mb-0.5">
                              <span className="font-bold text-[var(--text-primary)] truncate">{c.company_name || 'Member'}</span>
                              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                <span>{new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                {user && user.id === c.user_id && (
                                  <button
                                    onClick={() => handleDeleteComment(c.id)}
                                    className="text-[var(--text-muted)] hover:text-red-400 p-0.5 transition-colors cursor-pointer"
                                    title="Delete comment"
                                  >
                                    <span className="material-symbols-outlined text-[13px]">delete</span>
                                  </button>
                                )}
                              </div>
                            </div>
                            <p className="text-[12px] text-[var(--text-primary)] leading-normal">{c.content}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add Comment Input */}
                  <form onSubmit={handleAddComment} className="flex items-center gap-2 pt-2">
                    <input
                      type="text"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Write a comment..."
                      className="flex-1 px-3 py-1.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] focus:border-[var(--accent-interactive)] focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={submittingComment || !commentText.trim()}
                      className="px-3 py-1.5 rounded-xl bg-[var(--accent-interactive)] text-white text-[12px] font-bold disabled:opacity-50"
                    >
                      Post
                    </button>
                  </form>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Content Report Modal */}
      {reportingPostId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-strong)] space-y-4">
            <h3 className="text-[16px] font-bold text-[var(--text-primary)] flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-400">report_problem</span>
              Report Content to Moderation
            </h3>
            <p className="text-[12px] text-[var(--text-secondary)]">
              Specify the reason for reporting this company broadcast (e.g. spam, misleading information, unauthorized solicitation).
            </p>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              rows={3}
              placeholder="Reason for report..."
              className="w-full p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setReportingPostId(null)}
                className="px-4 py-2 rounded-xl text-[12px] text-[var(--text-secondary)]"
              >
                Cancel
              </button>
              <button
                onClick={handleReportPost}
                disabled={!reportReason.trim()}
                className="px-4 py-2 rounded-xl text-[12px] font-bold bg-amber-500 text-black hover:opacity-90 disabled:opacity-50"
              >
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function DataOriginBadge({ origin }: { origin: CommunityPost['data_origin'] }) {
  const configs = {
    company_provided: {
      label: 'COMPANY-PROVIDED DATA',
      style: { background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)' },
      icon: 'verified_user',
    },
    ebexta_verified: {
      label: 'EBEXTA VERIFIED',
      style: { background: 'var(--accent-subtle)', color: 'var(--accent-interactive)', border: '1px solid var(--accent-interactive)' },
      icon: 'verified',
    },
    ai_generated: {
      label: 'AI ANALYSIS',
      style: { background: 'rgba(147, 51, 234, 0.08)', color: '#9333ea', border: '1px solid rgba(147, 51, 234, 0.3)' },
      icon: 'auto_awesome',
    },
    public_data: {
      label: 'PUBLIC / EBEXTA DATA',
      style: { background: 'var(--warning-bg)', color: 'var(--warning)', border: '1px solid var(--warning)' },
      icon: 'public',
    },
  }

  const c = configs[origin] || configs.company_provided

  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-bold tracking-wider shrink-0"
      style={c.style}
    >
      <span className="material-symbols-outlined text-[12px]">{c.icon}</span>
      {c.label}
    </span>
  )
}
