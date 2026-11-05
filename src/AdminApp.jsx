import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight, ArrowUpRight, Bell, BriefcaseBusiness, CalendarDays, Camera, Check, ChevronDown, Eye, EyeOff, FileText,
  Facebook, FolderKanban, House, Image, ImagePlus, Instagram, LayoutDashboard, Linkedin, LockKeyhole, LogOut, Mail, Menu, MessageCircle, Moon, Package, Plus,
  RefreshCw, Search, Send, Settings, Shield, Trash2, UserPlus, Users, X, ChartNoAxesCombined,
} from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { FaXTwitter, FaYoutube } from 'react-icons/fa6'
import { defaultSiteSettings, kindLabels } from './data'
import { isSupabaseConfigured, supabase } from './lib/supabase'

const tabs = ['homepage', 'about', 'team', 'services', 'products', 'projects', 'partners', 'testimonials', 'news', 'legal', 'settings', 'media', 'inquiries']
const contentKinds = new Set(['homepage', 'about', 'team', 'services', 'products', 'projects', 'partners', 'testimonials', 'news', 'legal'])
const websiteNavigation = [
  { id: 'homepage', label: 'Home', icon: House },
  { id: 'about', label: 'About Us', icon: BriefcaseBusiness },
  { id: 'services', label: 'Services', icon: Shield },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'projects', label: 'Our Work', icon: FolderKanban },
]
const adminNavigation = [
  { id: 'add-user', label: 'Add User', icon: UserPlus },
  { id: 'admins', label: 'Admins', icon: Users },
  { id: 'advertisements', label: 'Advertisements', icon: ImagePlus },
  { id: 'statistics', label: 'Website Statistics', icon: ChartNoAxesCombined },
  { id: 'chat', label: 'Admin Chat', icon: MessageCircle },
]
const logoPath = '/logo.png?v=2'
const avatarInitials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'A'

function imageObjectPath(imageUrl) {
  if (!imageUrl) return null
  try {
    const url = new URL(imageUrl)
    const marker = '/storage/v1/object/public/site-images/'
    const index = url.pathname.indexOf(marker)
    return index === -1 ? null : decodeURIComponent(url.pathname.slice(index + marker.length))
  } catch {
    return null
  }
}

function safeHttpUrl(value) {
  if (!value) return ''
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) ? url.href : ''
  } catch {
    return ''
  }
}

function slugify(text) {
  return text.normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export default function AdminApp() {
  const [session, setSession] = useState(null)
  const [authorized, setAuthorized] = useState(false)
  const [checking, setChecking] = useState(true)
  const [authError, setAuthError] = useState('')
  const [forgotMode, setForgotMode] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [recoveryMode, setRecoveryMode] = useState(false)
  const [recoveryMessage, setRecoveryMessage] = useState('')
  const [items, setItems] = useState([])
  const [inquiries, setInquiries] = useState([])
  const [settings, setSettings] = useState({})
  const [advertisements, setAdvertisements] = useState([])
  const [advertisementsLoading, setAdvertisementsLoading] = useState(false)
  const [editingAdvertisement, setEditingAdvertisement] = useState(null)
  const [settingsSection, setSettingsSection] = useState('profile')
  const [media, setMedia] = useState([])
  const [activeTab, setActiveTab] = useState('overview')
  const [userRole, setUserRole] = useState('')
  const [userProfile, setUserProfile] = useState(null)
  const [profiles, setProfiles] = useState([])
  const [navOpen, setNavOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [notificationsError, setNotificationsError] = useState('')
  const [selectedNotification, setSelectedNotification] = useState(null)
  const [topSearch, setTopSearch] = useState('')
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const topSearchRef = useRef(null)
  const topSearchInputRef = useRef(null)
  const notificationsRef = useRef(null)
  const [analyticsRange, setAnalyticsRange] = useState(7)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsViews, setAnalyticsViews] = useState({ total_views: 0, unique_visitors: 0, daily: [], top_pages: [] })
  const [chatMessages, setChatMessages] = useState([])
  const [selectedChatUser, setSelectedChatUser] = useState(null)
  const [chatSearch, setChatSearch] = useState('')
  const [chatOverview, setChatOverview] = useState([])
  const [chatBusy, setChatBusy] = useState(false)
  const [chatLoading, setChatLoading] = useState(false)
  const [chatUsersLoading, setChatUsersLoading] = useState(false)
  const [editing, setEditing] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [dataError, setDataError] = useState('')
  const [previewing, setPreviewing] = useState(null)
  const navigate = useNavigate()
  const location = useLocation()
  const profile = userProfile

  useEffect(() => {
    document.documentElement.classList.toggle('admin-compact-mode', profile?.preferences?.compact_mode === true)
    document.documentElement.classList.add('admin-scrollbars')
    return () => {
      document.documentElement.classList.remove('admin-compact-mode')
      document.documentElement.classList.remove('admin-scrollbars')
    }
  }, [profile?.preferences?.compact_mode])

  useEffect(() => {
    if (!mobileSearchOpen) return undefined
    const closeOnOutsideClick = (event) => {
      if (!topSearchRef.current?.contains(event.target)) {
        setMobileSearchOpen(false)
        setTopSearch('')
      }
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setMobileSearchOpen(false)
        setNavOpen(false)
        setTopSearch('')
      }
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [mobileSearchOpen])

  useEffect(() => {
    if (!notificationsOpen) return undefined
    const closeOnOutsideClick = (event) => {
      if (!notificationsRef.current?.contains(event.target)) setNotificationsOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setNotificationsOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [notificationsOpen])

  useEffect(() => {
    if (mobileSearchOpen) topSearchInputRef.current?.focus()
  }, [mobileSearchOpen])

  const verifyAdmin = useCallback(async (currentSession, isActive = () => true) => {
    if (!supabase) return false
    setSession(currentSession)
    setChecking(true)
    try {
      const { data, error } = await supabase.from('user_profiles').select('*').eq('user_id', currentSession.user.id).maybeSingle()
      if (!isActive()) return false
      if (error) {
        setAuthError(`Administrator access could not be verified: ${error.message}`)
        setAuthorized(false)
        return false
      } else if (['admin', 'editor'].includes(data?.role) && data?.is_active !== false) {
        setUserRole(data.role)
        setUserProfile(data)
        setAuthorized(true)
        setAuthError('')
        return true
      } else {
        setUserRole('')
        setUserProfile(null)
        setAuthorized(false)
        setAuthError(data?.is_active === false ? 'This administrator account is inactive.' : 'This account is not authorized to access the dashboard.')
        return false
      }
    } catch (error) {
      if (isActive()) {
        setAuthorized(false)
        setAuthError(`Administrator access could not be verified: ${error.message || 'A network error occurred.'}`)
      }
      return false
    } finally {
      if (isActive()) setChecking(false)
    }
  }, [])

  useEffect(() => {
    if (!supabase) {
      setChecking(false)
      return undefined
    }
    let active = true
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        setAuthError(error.message)
        setChecking(false)
      } else if (data.session) verifyAdmin(data.session, () => active)
      else setChecking(false)
    }).catch((error) => {
      if (active) { setAuthError(error.message || 'Could not check your session.'); setChecking(false) }
    })
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true)
      if (nextSession) queueMicrotask(() => { if (active) verifyAdmin(nextSession, () => active) })
      else { setSession(null); setAuthorized(false); setUserRole(''); setUserProfile(null); setItems([]); setInquiries([]); setChecking(false) }
    })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [verifyAdmin])

  useEffect(() => {
    if (checking) return
    if (authorized) {
      if (location.pathname === '/admin' || location.pathname.startsWith('/admin/login')) {
        navigate('/admin/dashboard', { replace: true })
      }
    } else if (location.pathname.startsWith('/admin') && location.pathname !== '/admin/login') {
      navigate('/admin/login', { replace: true })
    }
  }, [authorized, checking, location.pathname, navigate])

  const loadAdminData = useCallback(async () => {
    if (!supabase || !authorized) return
    setBusy(true)
    setDataError('')
    try {
      const [contentResponse, inquiryResponse, settingsResponse] = await Promise.all([
        supabase.from('content_items').select('*').order('kind').order('created_at'),
        supabase.from('contact_inquiries').select('*').order('created_at', { ascending: false }),
        supabase.from('site_settings').select('settings').eq('id', 'global').maybeSingle(),
      ])
      const failures = [contentResponse.error, inquiryResponse.error, settingsResponse.error].filter(Boolean)
      if (contentResponse.error) setDataError('Dashboard data could not be loaded. Retry to try again.')
      else setItems(contentResponse.data || [])
      if (inquiryResponse.error) setDataError('Dashboard data could not be loaded. Retry to try again.')
      else setInquiries(inquiryResponse.data || [])
      if (settingsResponse.error) setDataError('Dashboard data could not be loaded. Retry to try again.')
      else setSettings(settingsResponse.data?.settings || {})
      if (!failures.length) setDataError('')
      if (activeTab === 'media' && !failures.length) await loadMedia()
    } catch {
      setDataError('Dashboard data could not be loaded. Retry to try again.')
    } finally {
      setBusy(false)
    }
  }, [authorized, activeTab])

  useEffect(() => { loadAdminData() }, [loadAdminData])

  async function loadMedia() {
    try {
      const { data, error } = await supabase.storage.from('site-images').list('', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } })
      if (error) {
        setDataError(`Media library could not be loaded: ${error.message}`)
        return
      }
      const folders = (data || []).filter((entry) => entry.id === null)
      const objects = (data || []).filter((entry) => entry.id !== null)
      const nested = await Promise.all(folders.map(async (folder) => {
        const result = await supabase.storage.from('site-images').list(folder.name, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } })
        if (result.error) throw result.error
        return (result.data || []).map((object) => ({ ...object, path: `${folder.name}/${object.name}` }))
      }))
      setMedia([...objects.map((object) => ({ ...object, path: object.name })), ...nested.flat()])
    } catch (error) {
      setDataError(`Media library could not be loaded: ${error.message || 'A network error occurred.'}`)
    }
  }

  const currentItems = useMemo(() => {
    const visible = activeTab === 'inquiries' ? inquiries : items.filter((item) => item.kind === activeTab)
    return visible.filter((item) => {
      const statusMatches = statusFilter === 'all' || item.status === statusFilter
      const searchMatches = `${item.title || item.name || ''} ${item.slug || item.email || ''} ${item.summary || item.message || ''} ${item.metadata?.category || ''} ${item.metadata?.location || ''}`.toLowerCase().includes(search.toLowerCase())
      return statusMatches && searchMatches
    }).sort((left, right) => (Number(left.metadata?.display_order) || 0) - (Number(right.metadata?.display_order) || 0))
  }, [activeTab, inquiries, items, search, statusFilter])

  const searchResults = useMemo(() => {
    const needle = topSearch.trim().toLowerCase()
    if (!needle) return []
    const contentResults = items
      .filter((item) => `${item.title} ${item.summary} ${item.kind} ${item.metadata?.category || ''}`.toLowerCase().includes(needle))
      .map((item) => ({ type: 'content', item }))
    const inquiryResults = inquiries
      .filter((item) => `${item.name} ${item.email} ${item.service || ''} ${item.subject || ''} ${item.message}`.toLowerCase().includes(needle))
      .map((item) => ({ type: 'inquiry', item }))
    return [...contentResults, ...inquiryResults].slice(0, 8)
  }, [inquiries, items, topSearch])

  const loadNotifications = useCallback(async () => {
    if (!supabase || !authorized || !session?.user?.id) return
    setNotificationsLoading(true)
    setNotificationsError('')
    try {
      const { data, error } = await supabase.from('admin_notifications')
        .select('id,kind,title,body,href,is_read,created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
      if (error) {
        setNotificationsError(`Notifications could not be loaded: ${error.message}`)
        setNotifications([])
      } else setNotifications(data || [])
    } catch (error) {
      setNotificationsError(`Notifications could not be loaded: ${error.message || 'A network error occurred.'}`)
      setNotifications([])
    } finally {
      setNotificationsLoading(false)
    }
  }, [authorized, session?.user?.id])

  useEffect(() => {
    if (activeTab === 'notifications') loadNotifications()
  }, [activeTab, loadNotifications])

  useEffect(() => {
    if (authorized) loadNotifications()
  }, [authorized, loadNotifications])

  const loadProfiles = useCallback(async () => {
    if (!supabase || userRole !== 'admin') return
    try {
      const { data, error } = await supabase.functions.invoke('admin-users', { body: { action: 'list' } })
      if (error) setDataError(`Administrator accounts could not be loaded: ${error.message}`)
      else setProfiles(data?.users || [])
    } catch (error) {
      setDataError(`Administrator accounts could not be loaded: ${error.message || 'A network error occurred.'}`)
    }
  }, [userRole])

  useEffect(() => {
    if (activeTab === 'admins') loadProfiles()
  }, [activeTab, loadProfiles])

  const loadAdvertisements = useCallback(async () => {
    if (!supabase || userRole !== 'admin') return
    setAdvertisementsLoading(true)
    setDataError('')
    try {
      const { data, error } = await supabase.from('advertisements').select('*').order('created_at', { ascending: false })
      if (error) setDataError(`Advertisements could not be loaded: ${error.message}`)
      else setAdvertisements(data || [])
    } catch (error) {
      setDataError(`Advertisements could not be loaded: ${error.message || 'A network error occurred.'}`)
    } finally {
      setAdvertisementsLoading(false)
    }
  }, [userRole])

  useEffect(() => {
    if (activeTab === 'advertisements') loadAdvertisements()
  }, [activeTab, loadAdvertisements])

  useEffect(() => {
    if (activeTab !== 'statistics' || !supabase) return undefined
    let active = true
    setAnalyticsLoading(true)
    const from = new Date(Date.now() - analyticsRange * 24 * 60 * 60 * 1000).toISOString()
    supabase.rpc('get_website_analytics', { from_date: from })
      .then(({ data, error }) => {
        if (!active) return
        if (error) setDataError(`Website analytics could not be loaded: ${error.message}`)
        else setAnalyticsViews(data || { total_views: 0, unique_visitors: 0, daily: [], top_pages: [] })
      })
      .catch((error) => { if (active) setDataError(`Website analytics could not be loaded: ${error.message || 'A network error occurred.'}`) })
      .finally(() => { if (active) setAnalyticsLoading(false) })
    return () => { active = false }
  }, [activeTab, analyticsRange])

  const loadChatUsers = useCallback(async () => {
    if (!supabase) return
    setChatUsersLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_admin_chat_overview', { search_text: chatSearch.trim() })
      if (error) setDataError(`Chat administrators could not be loaded: ${error.message}`)
      else {
        setChatOverview(data || [])
      }
    } catch (error) {
      setDataError(`Chat administrators could not be loaded: ${error.message || 'A network error occurred.'}`)
    } finally {
      setChatUsersLoading(false)
    }
  }, [chatSearch])

  useEffect(() => {
    if (!authorized) return undefined
    loadChatUsers()
    const channel = supabase.channel(`admin-chat-notifications-${session?.user?.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_chat_messages' }, (payload) => {
        if (payload.new.sender_id !== session?.user?.id) loadChatUsers()
      }).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [authorized, loadChatUsers, session?.user?.id])

  useEffect(() => {
    if (!supabase || activeTab !== 'chat') return undefined
    let active = true
    const loadMessages = async () => {
      if (!selectedChatUser?.threadId) return
      setChatLoading(true)
      try {
        const { data, error } = await supabase.from('admin_chat_messages').select('*').eq('thread_id', selectedChatUser.threadId).order('created_at')
        if (!active) return
        if (error) setDataError(`Chat messages could not be loaded: ${error.message}`)
        else setChatMessages(data || [])
        if (!error) {
          const { error: readError } = await supabase.rpc('mark_admin_chat_thread_read', { chat_thread_id: selectedChatUser.threadId })
          if (readError) setDataError(`Conversation read status could not be updated: ${readError.message}`)
          else loadChatUsers()
        }
      } catch (error) {
        if (active) setDataError(`Chat messages could not be loaded: ${error.message || 'A network error occurred.'}`)
      } finally {
        if (active) setChatLoading(false)
      }
    }
    if (selectedChatUser?.threadId) loadMessages()
    const channel = supabase.channel(`admin-chat-${session.user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_chat_messages' }, (payload) => {
        if (!active) return
        const message = payload.new
        if (selectedChatUser?.threadId === message.thread_id) {
          setChatMessages((previous) => previous.some((entry) => entry.id === message.id) ? previous : [...previous, message])
          if (message.sender_id !== session.user.id) {
            supabase.rpc('mark_admin_chat_thread_read', { chat_thread_id: message.thread_id })
              .then(({ error }) => {
                if (error) setDataError(`Conversation read status could not be updated: ${error.message}`)
                else loadChatUsers()
              })
          }
        } else loadChatUsers()
      }).subscribe()
    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [activeTab, loadChatUsers, selectedChatUser?.threadId, session?.user?.id])

  async function createAdminUser(event) {
    event.preventDefault()
    if (userRole !== 'admin') return
    const form = event.currentTarget
    const fields = new FormData(form)
    const password = String(fields.get('password') || '')
    if (password !== fields.get('confirm_password')) {
      setMessage('Passwords do not match.')
      return
    }
    if (password.length < 12 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
      setMessage('Use at least 12 characters with uppercase and lowercase letters and a number.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: {
          action: 'create',
          full_name: String(fields.get('full_name') || '').trim(),
          email: String(fields.get('email') || '').trim(),
          phone: String(fields.get('phone') || '').trim(),
          password,
          role: String(fields.get('role') || 'editor'),
        },
      })
      if (error) setMessage(`User could not be created: ${error.message}`)
      else {
        form.reset()
        setMessage(`Account created for ${data?.user?.email || String(fields.get('email'))}.`)
        await loadProfiles()
      }
    } catch (error) {
      setMessage(`User could not be created: ${error.message || 'A network error occurred.'}`)
    } finally {
      setBusy(false)
    }
  }

  async function updateAdminUser(user, updates) {
    if (userRole !== 'admin') return
    setBusy(true)
    try {
      const { error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'update', user_id: user.user_id, ...updates },
      })
      if (error) {
        setMessage(`Administrator account could not be updated: ${error.message}`)
        return false
      }
      setMessage('Administrator account updated.')
      await loadProfiles()
      return true
    } catch (error) {
      setMessage(`Administrator account could not be updated: ${error.message || 'A network error occurred.'}`)
      return false
    } finally {
      setBusy(false)
    }
  }

  async function saveAdvertisement(event) {
    event.preventDefault()
    if (userRole !== 'admin') return
    const form = event.currentTarget
    const fields = new FormData(form)
    const title = String(fields.get('title') || '').trim()
    const description = String(fields.get('description') || '').trim()
    const destinationUrl = String(fields.get('destination_url') || '').trim()
    const placement = String(fields.get('placement') || '')
    const status = String(fields.get('status') || 'draft')
    const file = fields.get('image_file')
    const current = editingAdvertisement || {}
    let imageUrl = String(fields.get('image_url') || '').trim()
    if (!title || !destinationUrl || !placement) {
      setMessage('Title, destination URL and placement are required.')
      return
    }
    try {
      const parsedUrl = new URL(destinationUrl)
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('URL must begin with https:// or http://.')
    } catch (error) {
      setMessage(`Enter a valid destination URL. ${error.message === 'Invalid URL' ? '' : error.message}`.trim())
      return
    }
    if (file?.size && (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type) || file.size > 5 * 1024 * 1024)) {
      setMessage('Choose a JPEG, PNG, WebP or AVIF banner no larger than 5 MB.')
      return
    }
    if (!file?.size && !imageUrl) {
      setMessage('Upload an advertisement image or provide its image URL.')
      return
    }
    if (!file?.size && !safeHttpUrl(imageUrl)) {
      setMessage('Enter a valid HTTP or HTTPS advertisement image URL.')
      return
    }
    const startsAtInput = String(fields.get('starts_at') || '')
    const endsAtInput = String(fields.get('ends_at') || '')
    const startsAt = startsAtInput ? new Date(startsAtInput) : null
    const endsAt = endsAtInput ? new Date(endsAtInput) : null
    if (startsAt && Number.isNaN(startsAt.getTime()) || endsAt && Number.isNaN(endsAt.getTime())) {
      setMessage('Enter valid start and end dates.')
      return
    }
    if (startsAt && endsAt && endsAt <= startsAt) {
      setMessage('The end date must be later than the start date.')
      return
    }
    if (status === 'scheduled' && !startsAt) {
      setMessage('A scheduled advertisement needs a start date.')
      return
    }
    setBusy(true)
    setMessage('')
    let uploadedPath = ''
    try {
      if (file?.size) {
        uploadedPath = `advertisements/${crypto.randomUUID()}-${file.name.toLowerCase().replace(/[^a-z0-9.-]+/g, '-')}`
        const { error: uploadError } = await supabase.storage.from('site-images').upload(uploadedPath, file, { upsert: false, contentType: file.type })
        if (uploadError) {
          setMessage(`Advertisement image could not be uploaded: ${uploadError.message}`)
          return
        }
        imageUrl = supabase.storage.from('site-images').getPublicUrl(uploadedPath).data.publicUrl
      }
      const payload = {
        title, description, destination_url: destinationUrl, placement, status,
        starts_at: startsAt?.toISOString() || null,
        ends_at: endsAt?.toISOString() || null,
        image_url: imageUrl,
        created_by: session.user.id,
      }
      const response = current.id
        ? await supabase.from('advertisements').update(payload).eq('id', current.id).select().single()
        : await supabase.from('advertisements').insert(payload).select().single()
      if (response.error) {
        const cleanup = uploadedPath ? await supabase.storage.from('site-images').remove([uploadedPath]) : { error: null }
        setMessage(`Advertisement could not be saved: ${response.error.message}${cleanup.error ? `. Uploaded image cleanup failed: ${cleanup.error.message}` : ''}`)
        return
      }
      setAdvertisements((previous) => current.id ? previous.map((ad) => ad.id === current.id ? response.data : ad) : [response.data, ...previous])
      setEditingAdvertisement(null)
      setMessage('Advertisement saved.')
      form.reset()
      const oldPath = imageObjectPath(current.image_url)
      if (oldPath && oldPath !== uploadedPath && !imageUrl.includes(oldPath)) {
        const { error: cleanupError } = await supabase.storage.from('site-images').remove([oldPath])
        if (cleanupError) setMessage(`Advertisement saved, but the previous image could not be removed: ${cleanupError.message}`)
      }
      window.dispatchEvent(new Event('again:advertisements-updated'))
    } catch (error) {
      setMessage(`Advertisement could not be saved: ${error.message || 'A network error occurred.'}`)
      if (uploadedPath) {
        const { error: cleanupError } = await supabase.storage.from('site-images').remove([uploadedPath])
        if (cleanupError) setMessage((previous) => `${previous}. Uploaded image cleanup failed: ${cleanupError.message}`)
      }
    } finally {
      setBusy(false)
    }
  }

  async function updateAdvertisementStatus(advertisement, status) {
    if (userRole !== 'admin') return
    const { data, error } = await supabase.from('advertisements').update({ status }).eq('id', advertisement.id).select().single()
    if (error) setMessage(`Advertisement status could not be updated: ${error.message}`)
    else {
      setAdvertisements((previous) => previous.map((ad) => ad.id === data.id ? data : ad))
      setMessage(`Advertisement ${status === 'draft' ? 'unpublished' : status}.`)
      window.dispatchEvent(new Event('again:advertisements-updated'))
    }
  }

  async function deleteAdvertisement(advertisement) {
    if (userRole !== 'admin' || !window.confirm(`Delete “${advertisement.title}”? This cannot be undone.`)) return
    const { error } = await supabase.from('advertisements').delete().eq('id', advertisement.id)
    if (error) {
      setMessage(`Advertisement could not be deleted: ${error.message}`)
      return
    }
    setAdvertisements((previous) => previous.filter((ad) => ad.id !== advertisement.id))
    const imagePath = imageObjectPath(advertisement.image_url)
    if (imagePath) {
      const { error: imageError } = await supabase.storage.from('site-images').remove([imagePath])
      setMessage(imageError ? `Advertisement deleted, but its image could not be removed: ${imageError.message}` : 'Advertisement deleted.')
    } else setMessage('Advertisement deleted.')
    window.dispatchEvent(new Event('again:advertisements-updated'))
  }

  async function removeAdminUser(user) {
    if (userRole !== 'admin' || user.user_id === session.user.id) return
    if (!window.confirm(`Remove ${user.full_name || user.email}'s account? This cannot be undone.`)) return
    setBusy(true)
    try {
      const { error } = await supabase.functions.invoke('admin-users', { body: { action: 'delete', user_id: user.user_id } })
      if (error) setMessage(`Administrator account could not be removed: ${error.message}`)
      else {
        setMessage('Administrator account removed.')
        await loadProfiles()
      }
    } catch (error) {
      setMessage(`Administrator account could not be removed: ${error.message || 'A network error occurred.'}`)
    } finally {
      setBusy(false)
    }
  }

  async function openChat(user) {
    setChatBusy(true)
    setDataError('')
    try {
      const threadId = user.thread_id || user.threadId
      const { data, error } = threadId
        ? { data: threadId, error: null }
        : await supabase.rpc('get_or_create_admin_chat_thread', { other_user_id: user.user_id })
      if (error) setDataError(`Chat could not be opened: ${error.message}`)
      else {
        setSelectedChatUser({ ...user, threadId: data })
        setChatMessages([])
        const { error: readError } = await supabase.rpc('mark_admin_chat_thread_read', { chat_thread_id: data })
        if (readError) setDataError(`Conversation read status could not be updated: ${readError.message}`)
        else await loadChatUsers()
      }
    } catch (error) {
      setDataError(`Chat could not be opened: ${error.message || 'A network error occurred.'}`)
    } finally {
      setChatBusy(false)
    }
  }

  async function sendChatMessage(event) {
    event.preventDefault()
    if (!selectedChatUser || !supabase) return
    const form = event.currentTarget
    const body = String(new FormData(form).get('message') || '').trim()
    if (!body) return
    setChatBusy(true)
    try {
      const { error } = await supabase.from('admin_chat_messages').insert({
        thread_id: selectedChatUser.threadId,
        sender_id: session.user.id,
        body,
      })
      if (error) setDataError(`Message could not be sent: ${error.message}`)
      else form.reset()
    } catch (error) {
      setDataError(`Message could not be sent: ${error.message || 'A network error occurred.'}`)
    } finally {
      setChatBusy(false)
    }
  }

  async function signIn(event) {
    event.preventDefault()
    if (busy) return
    if (!supabase) return
    setBusy(true)
    setAuthError('')
    const fields = new FormData(event.currentTarget)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: fields.get('email'), password: fields.get('password') })
      if (error) setAuthError(error.message)
      else if (data.session) {
        const verified = await verifyAdmin(data.session)
        if (verified) navigate('/admin/dashboard', { replace: true })
      }
    } catch (error) {
      setAuthError(error.message || 'Sign in failed. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  async function sendPasswordReset(event) {
    event.preventDefault()
    if (busy) return
    if (!supabase) return
    setBusy(true)
    setAuthError('')
    setRecoveryMessage('')
    const email = String(new FormData(event.currentTarget).get('email') || '').trim()
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/admin/login`,
      })
      if (error) setAuthError(`Password reset could not be requested: ${error.message}`)
      else setRecoveryMessage('If an account exists for that email, a password reset link has been sent.')
    } catch (error) {
      setAuthError(`Password reset could not be requested: ${error.message || 'A network error occurred.'}`)
    } finally {
      setBusy(false)
    }
  }

  async function updateRecoveredPassword(event) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    const password = String(fields.get('password') || '')
    if (password.length < 12 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
      setAuthError('Use at least 12 characters with uppercase and lowercase letters and a number.')
      return
    }
    if (password !== fields.get('confirm_password')) {
      setAuthError('Passwords do not match.')
      return
    }
    setBusy(true)
    setAuthError('')
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) setAuthError(`Password could not be updated: ${error.message}`)
      else if (recoveryMode) {
        setRecoveryMode(false)
        setRecoveryMessage('Password updated. You can now sign in with your new password.')
        await supabase.auth.signOut()
      } else {
        setMessage('Password updated.')
        navigate('/admin/dashboard', { replace: true })
      }
    } catch (error) {
      setAuthError(`Password could not be updated: ${error.message || 'A network error occurred.'}`)
    } finally {
      setBusy(false)
    }
  }

  async function saveSettings(event) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    const fileFields = [...fields.entries()].filter(([name, file]) => name.endsWith('_file') && file?.size)
    const next = Object.fromEntries([...fields.entries()].filter(([name]) => !name.endsWith('_file')))
    const invalidFile = fileFields.find(([, file]) => !['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type) || file.size > 5 * 1024 * 1024)
    setBusy(true)
    setMessage('')
    if (invalidFile) {
      setMessage('Select JPEG, PNG, WebP or AVIF images no larger than 5 MB.')
      setBusy(false)
      return
    }
    const uploaded = []
    for (const [fieldName, file] of fileFields) {
      const path = `settings/${crypto.randomUUID()}-${file.name.toLowerCase().replace(/[^a-z0-9.-]+/g, '-')}`
      const { error: uploadError } = await supabase.storage.from('site-images').upload(path, file, { upsert: false, contentType: file.type })
      if (uploadError) {
        let errorMessage = `Image upload failed: ${uploadError.message}`
        if (uploaded.length) {
          const { error: cleanupError } = await supabase.storage.from('site-images').remove(uploaded.map((entry) => entry.path))
          if (cleanupError) errorMessage += `. Uploaded image cleanup failed: ${cleanupError.message}`
        }
        setMessage(errorMessage)
        setBusy(false)
        return
      }
      const settingName = fieldName.replace(/_file$/, '_url')
      uploaded.push({ path, settingName, oldPath: imageObjectPath(settings[settingName]) })
      next[settingName] = supabase.storage.from('site-images').getPublicUrl(path).data.publicUrl
    }
    const { error } = await supabase.from('site_settings').upsert({ id: 'global', settings: next })
    if (error) {
      let errorMessage = `Settings could not be saved: ${error.message}`
      if (uploaded.length) {
        const { error: cleanupError } = await supabase.storage.from('site-images').remove(uploaded.map((entry) => entry.path))
        if (cleanupError) errorMessage += `. Uploaded image cleanup failed: ${cleanupError.message}`
      }
      setMessage(errorMessage)
    }
    else {
      setSettings(next)
      setMessage('Site settings saved.')
      const oldPaths = uploaded.map((entry) => entry.oldPath).filter(Boolean)
      if (oldPaths.length) {
        const { error: cleanupError } = await supabase.storage.from('site-images').remove(oldPaths)
        if (cleanupError) setMessage(`Settings saved, but old image cleanup failed: ${cleanupError.message}`)
      }
    }
    setBusy(false)
  }

  async function saveProfile(event) {
    event.preventDefault()
    const form = event.currentTarget
    const fields = new FormData(form)
    const fullName = String(fields.get('full_name') || '').trim()
    const phone = String(fields.get('phone') || '').trim()
    const imageFile = fields.get('avatar_file')
    if (!fullName || fullName.length > 120 || phone.length > 40) {
      setMessage('Enter a name (up to 120 characters) and a phone number no longer than 40 characters.')
      return
    }
    if (imageFile?.size && (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(imageFile.type) || imageFile.size > 5 * 1024 * 1024)) {
      setMessage('Choose a JPEG, PNG, WebP or AVIF profile picture no larger than 5 MB.')
      return
    }
    const notificationPreferences = Object.fromEntries(['contact_inquiry', 'chat_message', 'system'].map((kind) => [
      kind,
      fields.has(`notification_${kind}`) ? fields.get(`notification_${kind}`) === 'on' : profile?.notification_preferences?.[kind] !== false,
    ]))
    const preferences = { ...(profile?.preferences || {}), compact_mode: fields.has('compact_mode') ? fields.get('compact_mode') === 'on' : profile?.preferences?.compact_mode === true }
    let avatarUrl = fields.get('remove_avatar') === 'on' ? '' : profile?.avatar_url || ''
    let uploadedPath = ''
    setBusy(true)
    setMessage('')
    try {
      if (imageFile?.size) {
        uploadedPath = `profiles/${session.user.id}/${crypto.randomUUID()}-${imageFile.name.toLowerCase().replace(/[^a-z0-9.-]+/g, '-')}`
        const { error: uploadError } = await supabase.storage.from('site-images').upload(uploadedPath, imageFile, { upsert: false, contentType: imageFile.type })
        if (uploadError) {
          setMessage(`Profile picture could not be uploaded: ${uploadError.message}`)
          return
        }
        avatarUrl = supabase.storage.from('site-images').getPublicUrl(uploadedPath).data.publicUrl
      }
      const { data, error } = await supabase.from('user_profiles')
        .update({ full_name: fullName, phone, avatar_url: avatarUrl, notification_preferences: notificationPreferences, preferences })
        .eq('user_id', session.user.id)
        .select('*')
        .single()
      if (error) {
        if (uploadedPath) {
          const { error: cleanupError } = await supabase.storage.from('site-images').remove([uploadedPath])
          setMessage(`Profile could not be saved: ${error.message}${cleanupError ? `. Uploaded image cleanup failed: ${cleanupError.message}` : ''}`)
        } else setMessage(`Profile could not be saved: ${error.message}`)
        return
      }
      setUserProfile(data)
      const { error: metadataError } = await supabase.auth.updateUser({ data: { full_name: fullName } })
      if (metadataError) setMessage(`Profile saved, but account display name could not be synchronized: ${metadataError.message}`)
      else setMessage('Profile and preferences saved.')
      const oldPath = imageObjectPath(profile?.avatar_url)
      if (oldPath && oldPath !== uploadedPath && (uploadedPath || !avatarUrl)) {
        const { error: cleanupError } = await supabase.storage.from('site-images').remove([oldPath])
        if (cleanupError) setMessage(`Profile saved, but the previous picture could not be removed: ${cleanupError.message}`)
      }
      form.reset()
    } catch (error) {
      setMessage(`Profile could not be saved: ${error.message || 'A network error occurred.'}`)
    } finally {
      setBusy(false)
    }
  }

  async function updateAccountEmail(event) {
    event.preventDefault()
    const email = String(new FormData(event.currentTarget).get('email') || '').trim().toLowerCase()
    if (!email || email.length > 254) {
      setMessage('Enter a valid email address.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const { error } = await supabase.auth.updateUser({ email })
      if (error) setMessage(`Email address could not be updated: ${error.message}`)
      else setMessage('Email update requested. Follow the confirmation link sent by Supabase to finish the change.')
    } catch (error) {
      setMessage(`Email address could not be updated: ${error.message || 'A network error occurred.'}`)
    } finally {
      setBusy(false)
    }
  }

  async function saveNotificationPreferences(event) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    const notificationPreferences = Object.fromEntries(['contact_inquiry', 'chat_message', 'system'].map((kind) => [kind, fields.get(kind) === 'on']))
    setBusy(true)
    setMessage('')
    try {
      const { data, error } = await supabase.from('user_profiles')
        .update({ notification_preferences: notificationPreferences })
        .eq('user_id', session.user.id)
        .select('*')
        .single()
      if (error) setMessage(`Notification preferences could not be saved: ${error.message}`)
      else {
        setUserProfile(data)
        setMessage('Notification preferences saved.')
      }
    } catch (error) {
      setMessage(`Notification preferences could not be saved: ${error.message || 'A network error occurred.'}`)
    } finally {
      setBusy(false)
    }
  }

  async function saveAppearancePreferences(event) {
    event.preventDefault()
    const compactMode = new FormData(event.currentTarget).get('compact_mode') === 'on'
    setBusy(true)
    setMessage('')
    try {
      const preferences = { ...(profile?.preferences || {}), compact_mode: compactMode }
      const { data, error } = await supabase.from('user_profiles')
        .update({ preferences })
        .eq('user_id', session.user.id)
        .select('*')
        .single()
      if (error) setMessage(`Appearance preferences could not be saved: ${error.message}`)
      else {
        setUserProfile(data)
        setMessage('Appearance preferences saved.')
      }
    } catch (error) {
      setMessage(`Appearance preferences could not be saved: ${error.message || 'A network error occurred.'}`)
    } finally {
      setBusy(false)
    }
  }

  async function saveSocialSettings(event) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const socialKeys = ['facebook_url', 'linkedin_url', 'instagram_url', 'x_url', 'youtube_url']
    const next = { ...settings }
    for (const key of socialKeys) {
      const value = String(formData.get(key) || '').trim()
      if (value) {
        try {
          const parsed = new URL(value)
          if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error()
        } catch {
          setMessage(`Enter a valid website URL for ${key.replace('_url', '').replace('_', ' ')}.`)
          return
        }
      }
      next[key] = value
    }
    setBusy(true)
    setMessage('')
    try {
      const { error } = await supabase.from('site_settings').upsert({ id: 'global', settings: next })
      if (error) setMessage(`Social media settings could not be saved: ${error.message}`)
      else {
        setSettings(next)
        setMessage('Social media settings saved.')
        window.dispatchEvent(new Event('again:content-updated'))
      }
    } catch (error) {
      setMessage(`Social media settings could not be saved: ${error.message || 'A network error occurred.'}`)
    } finally {
      setBusy(false)
    }
  }

  async function saveContent(event) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    const current = editing || {}
    const kind = activeTab
    const imageFile = fields.get('image_file')
    let imageUrl = String(fields.get('image_url') || '').trim()
    setBusy(true)
    setMessage('')
    if (imageFile?.size) {
      if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(imageFile.type) || imageFile.size > 5 * 1024 * 1024) {
        setMessage('Select a JPEG, PNG, WebP or AVIF image no larger than 5 MB.')
        setBusy(false)
        return
      }
      const path = `${kind}/${crypto.randomUUID()}-${imageFile.name.toLowerCase().replace(/[^a-z0-9.-]+/g, '-')}`
      const { error } = await supabase.storage.from('site-images').upload(path, imageFile, { upsert: false, contentType: imageFile.type })
      if (error) { setMessage(`Image upload failed: ${error.message}`); setBusy(false); return }
      imageUrl = supabase.storage.from('site-images').getPublicUrl(path).data.publicUrl
    }
    const metadata = {
      ...(current.metadata || {}),
      category: String(fields.get('category') || '').trim(),
      label: String(fields.get('label') || '').trim(),
      image_alt: String(fields.get('image_alt') || '').trim(),
      eyebrow: String(fields.get('eyebrow') || '').trim(),
      cta: String(fields.get('cta') || '').trim(),
      hero_proof_title: String(fields.get('hero_proof_title') || '').trim(),
      hero_proof_text: String(fields.get('hero_proof_text') || '').trim(),
      image_caption: String(fields.get('image_caption') || '').trim(),
      overview_heading: String(fields.get('overview_heading') || '').trim(),
      overview_text: String(fields.get('overview_text') || '').trim(),
      role: String(fields.get('role') || '').trim(),
      position: String(fields.get('role') || '').trim(),
      department: String(fields.get('organization') || '').trim(),
      email: String(fields.get('email') || '').trim(),
      author: kind === 'testimonials' ? String(fields.get('title') || '').trim() : String(fields.get('author') || '').trim(),
      organization: String(fields.get('organization') || '').trim(),
      project: String(fields.get('project') || '').trim(),
      rating: String(fields.get('rating') || '').trim(),
      website_url: String(fields.get('website_url') || '').trim(),
      display_order: Number(fields.get('display_order')) || 0,
      footer_order: Number(fields.get('footer_order')) || 0,
      homepage: fields.get('homepage') === 'on',
      footer: kind === 'services' ? fields.get('footer') === 'on' : current.metadata?.footer !== false,
      price: String(fields.get('price') || '').trim(),
      availability: String(fields.get('availability') || '').trim(),
      completed_date: String(fields.get('completed_date') || '').trim(),
      mission: String(fields.get('mission') || '').trim(),
      vision: String(fields.get('vision') || '').trim(),
      history: String(fields.get('history') || '').trim(),
      values: String(fields.get('values') || '').trim(),
      scope: String(fields.get('scope') || '').trim(),
      specifications: String(fields.get('specifications') || '').trim(),
      benefits: String(fields.get('benefits') || '').split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
      applications: String(fields.get('applications') || '').split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
      document_url: String(fields.get('document_url') || '').trim(),
      location: String(fields.get('location') || '').trim(),
      client: String(fields.get('client') || '').trim(),
      challenge: String(fields.get('challenge') || '').trim(),
      solution: String(fields.get('solution') || '').trim(),
      technologies: String(fields.get('technologies') || '').trim(),
      responsibilities: String(fields.get('responsibilities') || '').trim(),
      skills: String(fields.get('skills') || '').trim(),
      industries: String(fields.get('industries') || '').split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
      strengths: String(fields.get('strengths') || '').split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
      process: String(fields.get('process') || '').split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
      expertise: String(fields.get('expertise') || '').split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
      statistic_values: [1, 2, 3].map((index) => ({
        value: String(fields.get(`stat${index}_value`) || '').trim(),
        label: String(fields.get(`stat${index}_label`) || '').trim(),
      })).filter((stat) => stat.value && stat.label),
      related_slugs: String(fields.get('related_slugs') || '').split(',').map((slug) => slug.trim()).filter(Boolean),
      gallery: String(fields.get('gallery_urls') || '').split(/\r?\n/).map((url) => url.trim()).filter(Boolean).map((url) => ({ url, alt: String(fields.get('title') || '').trim() })),
      faq: String(fields.get('faq') || '').split(/\r?\n/).map((line) => {
        const [question, ...answer] = line.split('|')
        return { question: question.trim(), answer: answer.join('|').trim() }
      }).filter((entry) => entry.question && entry.answer),
    }
    const metadataFields = {
      label: 'label', eyebrow: 'eyebrow', cta: 'cta', hero_proof_title: 'hero_proof_title',
      hero_proof_text: 'hero_proof_text', image_caption: 'image_caption', overview_heading: 'overview_heading',
      overview_text: 'overview_text', role: 'role', organization: 'organization', project: 'project', rating: 'rating',
      website_url: 'website_url', display_order: 'display_order', homepage: 'homepage', price: 'price',
      availability: 'availability', completed_date: 'completed_date', mission: 'mission', vision: 'vision',
      history: 'history', values: 'values', scope: 'scope', specifications: 'specifications', benefits: 'benefits',
      applications: 'applications', document_url: 'document_url', position: 'role', department: 'organization',
      email: 'email', location: 'location', client: 'client', challenge: 'challenge', solution: 'solution',
      technologies: 'technologies', responsibilities: 'responsibilities', skills: 'skills', industries: 'industries',
      strengths: 'strengths', process: 'process', expertise: 'expertise', statistic_values: 'stat1_value',
      gallery: 'gallery_urls', faq: 'faq',
    }
    Object.entries(metadataFields).forEach(([key, field]) => {
      if (!fields.has(field) && current.metadata?.[key] !== undefined) metadata[key] = current.metadata[key]
    })
    if (kind === 'testimonials') metadata.author = String(fields.get('title') || '').trim()
    const title = String(fields.get('title') || '').trim()
    const payload = {
      kind,
      title,
      slug: slugify(String(fields.get('slug') || '').trim() || title),
      summary: String(fields.get('summary') || '').trim(),
      body: String(fields.get('body') || '').trim(),
      image_url: imageUrl,
      seo_title: String(fields.get('seo_title') || '').trim(),
      seo_description: String(fields.get('seo_description') || '').trim(),
      metadata,
      status: fields.get('status') === 'published' ? 'published' : 'draft',
    }
    const response = current.id
      ? await supabase.from('content_items').update(payload).eq('id', current.id).select().single()
      : await supabase.from('content_items').insert(payload).select().single()
    if (response.error) {
      let errorMessage = `Content could not be saved: ${response.error.message}`
      if (imageFile?.size) {
        const uploadedPath = imageObjectPath(imageUrl)
        if (uploadedPath) {
          const { error } = await supabase.storage.from('site-images').remove([uploadedPath])
          if (error) errorMessage += `. Uploaded image cleanup failed: ${error.message}`
        }
      }
      setMessage(errorMessage)
    } else {
      setItems((previous) => current.id ? previous.map((item) => item.id === current.id ? response.data : item) : [response.data, ...previous])
      setEditing(null)
      setMessage('Content saved.')
      window.dispatchEvent(new Event('again:content-updated'))
      const oldPath = imageObjectPath(current.image_url)
      if (oldPath && current.image_url !== imageUrl) {
        const { error } = await supabase.storage.from('site-images').remove([oldPath])
        if (error) setMessage(`Content saved, but old image cleanup failed: ${error.message}`)
      }
    }
    setBusy(false)
  }

  async function uploadMedia(event) {
    const file = event instanceof File ? event : event.currentTarget.files?.[0]
    if (!(event instanceof File)) event.currentTarget.value = ''
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setMessage('Select a JPEG, PNG, WebP or AVIF image no larger than 5 MB.')
      return
    }
    const path = `library/${crypto.randomUUID()}-${file.name.toLowerCase().replace(/[^a-z0-9.-]+/g, '-')}`
    setBusy(true)
    try {
      const { error } = await supabase.storage.from('site-images').upload(path, file, { upsert: false, contentType: file.type })
      if (error) setMessage(`Upload failed: ${error.message}`)
      else { setMessage('Image uploaded.'); await loadMedia() }
    } catch (error) {
      setMessage(`Upload failed: ${error.message || 'A network error occurred.'}`)
    } finally {
      setBusy(false)
    }
  }

  async function deleteMedia(item) {
    if (!window.confirm(`Delete image “${item.name}”?`)) return
    const { error } = await supabase.storage.from('site-images').remove([item.path])
    if (error) setMessage(`Image could not be deleted: ${error.message}`)
    else { setMedia((previous) => previous.filter((image) => image.path !== item.path)); setMessage('Image deleted.') }
  }

  async function togglePublish(item) {
    const status = item.status === 'published' ? 'draft' : 'published'
    const { data, error } = await supabase.from('content_items').update({ status }).eq('id', item.id).select().single()
    if (error) setMessage(`Publication status could not be updated: ${error.message}`)
    else {
      setItems((previous) => previous.map((entry) => entry.id === item.id ? data : entry))
      window.dispatchEvent(new Event('again:content-updated'))
    }
  }

  async function deleteContent(item) {
    if (!window.confirm(`Delete “${item.title}”? This cannot be undone.`)) return
    const { error } = await supabase.from('content_items').delete().eq('id', item.id)
    if (error) { setMessage(`Content could not be deleted: ${error.message}`); return }
    setItems((previous) => previous.filter((entry) => entry.id !== item.id))
    window.dispatchEvent(new Event('again:content-updated'))
    const imagePath = imageObjectPath(item.image_url)
    if (imagePath) {
      const { error: imageError } = await supabase.storage.from('site-images').remove([imagePath])
      setMessage(imageError ? `Content deleted, but its image could not be deleted: ${imageError.message}` : 'Content and uploaded image deleted.')
    } else setMessage('Content deleted.')
  }

  async function toggleRead(item) {
    const { data, error } = await supabase.from('contact_inquiries').update({ is_read: !item.is_read }).eq('id', item.id).select().single()
    if (error) setMessage(`Enquiry status could not be updated: ${error.message}`)
    else setInquiries((previous) => previous.map((entry) => entry.id === item.id ? data : entry))
  }

  async function deleteInquiry(item) {
    if (!window.confirm(`Delete the enquiry from ${item.name}?`)) return
    const { error } = await supabase.from('contact_inquiries').delete().eq('id', item.id)
    if (error) setMessage(`Enquiry could not be deleted: ${error.message}`)
    else { setInquiries((previous) => previous.filter((entry) => entry.id !== item.id)); setMessage('Enquiry deleted.') }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) setMessage(`Sign out failed: ${error.message}`)
    else {
      setProfileOpen(false)
      setNotificationsOpen(false)
      setNotifications([])
      navigate('/admin/login', { replace: true })
    }
  }

  async function openNotification(notification) {
    setSelectedNotification(notification)
    if (notification.is_read) return
    try {
      const { data, error } = await supabase.from('admin_notifications')
        .update({ is_read: true })
        .eq('id', notification.id)
        .eq('user_id', session.user.id)
        .select('id,kind,title,body,href,is_read,created_at')
        .single()
      if (error) {
        setNotificationsError(`Notification read status could not be updated: ${error.message}`)
        return
      }
      setNotifications((previous) => previous.map((entry) => entry.id === data.id ? data : entry))
      setSelectedNotification(data)
    } catch (error) {
      setNotificationsError(`Notification read status could not be updated: ${error.message || 'A network error occurred.'}`)
    }
  }

  function navigateDashboard(tab) {
    setActiveTab(tab)
    setEditing(null)
    setSearch('')
    setStatusFilter('all')
    setTopSearch('')
    setSelectedNotification(null)
    setNotificationsOpen(false)
    setMobileSearchOpen(false)
    setProfileOpen(false)
    if (tab !== 'chat') setChatSearch('')
    setMessage('')
    setDataError('')
    setNavOpen(false)
  }

  const publishedItems = items.filter((item) => item.status === 'published')
  const draftItems = items.filter((item) => item.status === 'draft')
  const statCards = [
    ['Published Content Items', publishedItems.length, 'all content sections'],
    ['Total Services', publishedItems.filter((item) => item.kind === 'services').length, 'published services'],
    ['Total Products', publishedItems.filter((item) => item.kind === 'products').length, 'published products'],
    ['Total Projects', publishedItems.filter((item) => item.kind === 'projects').length, 'published projects'],
    ['Published Testimonials', publishedItems.filter((item) => item.kind === 'testimonials').length, 'approved client feedback'],
    ['Drafts', draftItems.length, 'not visible to website visitors'],
    ['Website Enquiries', inquiries.length, `${inquiries.filter((item) => !item.is_read).length} unread`],
  ]
  const recentActivity = [
    ...items.map((item) => ({ id: item.id, label: `${item.kind === 'services' ? 'Service' : kindLabels[item.kind] || 'Content'}: ${item.title}`, status: item.status, date: item.updated_at || item.created_at, tab: item.kind })),
    ...inquiries.map((item) => ({ id: `enquiry-${item.id}`, label: `Enquiry from ${item.name}`, status: item.is_read ? 'read' : 'new', date: item.created_at, tab: 'inquiries' })),
  ].filter((item) => item.date).sort((left, right) => new Date(right.date) - new Date(left.date)).slice(0, 6)


  if (checking && location.pathname !== '/admin/login') return <div className="admin-setup-screen"><div className="admin-setup-card"><span className="admin-label">ADMINISTRATOR ACCESS</span><h1>Checking access…</h1></div></div>

  if (session && authorized && location.pathname === '/admin/change-password') return <PasswordChangeForm recovery={false} busy={busy} error={authError} status={recoveryMessage} onSubmit={updateRecoveredPassword} />

  if (recoveryMode) return <PasswordChangeForm recovery busy={busy} error={authError} status="" onSubmit={updateRecoveredPassword} />

  if (!session || !authorized) return (
    <main className="admin-login-screen">
      {forgotMode ? (
        <form className="login-card admin-login-card" onSubmit={sendPasswordReset}>
          <Link to="/" className="admin-login-back">Back to website</Link>
          <img className="admin-login-brand" src={logoPath} alt="Perfect Group" />
          <span className="admin-label admin-login-eyebrow">ACCOUNT RECOVERY</span>
          <h1>Reset your password</h1>
          <p>Enter your administrator email and we’ll send a password reset link if the account exists.</p>
          {!isSupabaseConfigured && <p className="admin-login-config" role="status">Supabase is not configured. Add its public key to the root <code>.env</code> as <code>VITE_SUPABASE_ANON_KEY</code> and restart Vite.</p>}
          <label htmlFor="recovery-email">Email Address</label>
          <div className="admin-login-input-wrap">
            <Mail size={18} aria-hidden="true" />
            <input id="recovery-email" className="admin-login-input" name="email" type="email" autoComplete="username" placeholder="you@company.com" required />
          </div>
          {authError && <p className="form-error" role="alert">{authError}</p>}
          {recoveryMessage && <p className="admin-login-success" role="status">{recoveryMessage}</p>}
          <button type="submit" className="admin-login-submit" disabled={busy || !isSupabaseConfigured}>{busy ? 'Sending…' : 'Send reset link'} <ArrowRight size={17} /></button>
          <button type="button" className="admin-login-link" onClick={() => { setForgotMode(false); setAuthError(''); setRecoveryMessage('') }}>Return to sign in</button>
        </form>
      ) : (
        <form className="login-card admin-login-card" onSubmit={signIn}>
          <Link to="/" className="admin-login-back">Back to website</Link>
          <img className="admin-login-brand" src={logoPath} alt="Perfect Group" />
          <span className="admin-label admin-login-eyebrow">PERFECT GROUP ADMINISTRATION</span>
          <h1>Welcome Back</h1>
          <p>Sign in to access your Perfect Group administration dashboard.</p>
          {!isSupabaseConfigured && <p className="admin-login-config" role="status">Supabase is not configured. Add its public key to the root <code>.env</code> as <code>VITE_SUPABASE_ANON_KEY</code> and restart Vite.</p>}
          <div className="admin-login-field">
            <label htmlFor="admin-email">Email Address</label>
            <div className="admin-login-input-wrap">
              <Mail size={18} aria-hidden="true" />
              <input id="admin-email" className="admin-login-input" name="email" type="email" autoComplete="username" placeholder="you@company.com" required />
            </div>
          </div>
          <div className="admin-login-field">
            <label htmlFor="admin-password">Password</label>
            <div className="admin-login-input-wrap">
              <LockKeyhole size={18} aria-hidden="true" />
              <input id="admin-password" className="admin-login-input" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" required />
              <button type="button" className="admin-login-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div className="admin-login-options">
            <button type="button" className="admin-login-link" onClick={() => { setForgotMode(true); setAuthError(''); setRecoveryMessage('') }}>Forgot Password?</button>
          </div>
          {authError && <p className="form-error" role="alert">{authError}</p>}
          {recoveryMessage && <p className="admin-message" role="status">{recoveryMessage}</p>}
          <button type="submit" className="admin-login-submit" disabled={busy || !isSupabaseConfigured} aria-busy={busy}>{busy ? 'Signing in…' : 'Sign In'} <ArrowRight size={17} /></button>
        </form>
      )}
    </main>
  )

  return <div className={`admin-layout ${navOpen ? 'admin-nav-open' : ''}`}><aside className="admin-sidebar"><Link to="/" className="admin-logo"><img src={logoPath} alt="Again" /></Link><span className="admin-label">WEBSITE</span><nav className="admin-nav">
      <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => navigateDashboard('overview')}><LayoutDashboard size={17} /> Overview</button>
      {websiteNavigation.map((tab) => <button key={tab.id} className={activeTab === tab.id ? 'active' : ''} onClick={() => navigateDashboard(tab.id)}><tab.icon size={17} /><span>{tab.label}</span></button>)}
      <span className="admin-label admin-nav-section">ADMINISTRATION</span>
      {adminNavigation.filter((tab) => !['admins', 'add-user', 'advertisements'].includes(tab.id) || profile?.role === 'admin').map((tab) => <button key={tab.id} className={activeTab === tab.id ? 'active' : ''} onClick={() => navigateDashboard(tab.id)}><tab.icon size={17} /><span>{tab.label}</span>{tab.id === 'chat' && chatOverview.reduce((count, user) => count + Number(user.unread_count || 0), 0) > 0 && <b>{chatOverview.reduce((count, user) => count + Number(user.unread_count || 0), 0)}</b>}</button>)}
      <button className={activeTab === 'inquiries' ? 'active' : ''} onClick={() => navigateDashboard('inquiries')}><MessageCircle size={17} /><span>Contact enquiries</span>{inquiries.filter((item) => !item.is_read).length > 0 && <b>{inquiries.filter((item) => !item.is_read).length}</b>}</button>
      <span className="admin-label admin-nav-section">CONTENT</span>
      {tabs.filter((tab) => contentKinds.has(tab)).map((tab) => <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => navigateDashboard(tab)}><FileText size={17} /><span>{kindLabels[tab]}</span></button>)}
      <button className={activeTab === 'media' ? 'active' : ''} onClick={() => navigateDashboard('media')}><Image size={17} /><span>Media library</span></button>
      <button className={activeTab === 'settings' ? 'active' : ''} onClick={() => navigateDashboard('settings')}><Settings size={17} /><span>Settings</span></button>
    </nav><div className="admin-sidebar-bottom"><span className="admin-label admin-nav-section">ACCOUNT</span><div className="admin-account-summary"><ProfileAvatar url={profile?.avatar_url} name={profile?.full_name || session.user.email} /><div><strong>{profile?.full_name || session.user.email}</strong><small>{profile?.role || 'Administrator'}</small></div></div><div className="admin-sidebar-account-links"><button onClick={() => navigateDashboard('profile')}>View profile</button><button onClick={() => { setSettingsSection('account'); navigateDashboard('settings') }}>Account settings</button><button onClick={() => { setSettingsSection('security'); navigateDashboard('settings') }}>Security settings</button>{userRole === 'admin' && <button onClick={() => { setSettingsSection('site'); navigateDashboard('settings') }}>Site settings</button>}</div><button className="admin-logout-button" onClick={signOut}><LogOut size={15} /> Logout</button><Link to="/" target="_blank">View website <ArrowUpRight size={15} /></Link></div></aside>
    <button className="admin-nav-backdrop" aria-label="Close navigation" onClick={() => setNavOpen(false)} />
    <main className="admin-main">
      <header className={`admin-topbar ${mobileSearchOpen ? 'admin-search-open' : ''}`}>
        <div className="admin-branding">
          <img className="admin-mobile-logo" src={logoPath} alt="Again" />
          <div><span className="admin-label">AGAIN WEBSITE</span><strong>{tabLabel(activeTab)}</strong></div>
        </div>
        <div className="admin-top-actions">
          <div className="admin-search-wrap" ref={topSearchRef}>
            <button className="admin-search-toggle" type="button" aria-label="Search dashboard" aria-expanded={mobileSearchOpen} onClick={() => setMobileSearchOpen((open) => !open)}><Search size={18} /></button>
            <div className="admin-search-control">
              <label className="admin-global-search"><Search size={16} aria-hidden="true" /><input ref={topSearchInputRef} type="search" value={topSearch} onChange={(event) => setTopSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') { setMobileSearchOpen(false); setNavOpen(false); setTopSearch('') } }} placeholder="Search dashboard" aria-label="Search dashboard" aria-expanded={mobileSearchOpen || Boolean(topSearch.trim())} aria-controls="admin-search-results" /></label>
              {topSearch && <button className="admin-search-clear" type="button" aria-label="Clear search" onClick={() => setTopSearch('')}><X size={15} /></button>}
            </div>
            {topSearch.trim() && <div className="admin-search-results" id="admin-search-results" role="listbox">{searchResults.length ? searchResults.map(({ type, item }) => <button key={`${type}-${item.id}`} role="option" onClick={() => { if (type === 'content') { navigateDashboard(item.kind); setEditing(item) } else { navigateDashboard('inquiries'); setSearch(item.email || item.name) } setTopSearch(''); setMobileSearchOpen(false) }}><span>{type === 'content' ? item.title : item.name || 'Website enquiry'}</span><small>{type === 'content' ? `${kindLabels[item.kind] || item.kind} · ${item.status}` : `Enquiry · ${item.email}`}</small></button>) : <p>No matching content or enquiries.</p>}<button className="admin-search-close" type="button" onClick={() => { setTopSearch(''); setMobileSearchOpen(false) }}>Close results</button></div>}
          </div>
          {mobileSearchOpen && <button className="admin-mobile-search-close" type="button" aria-label="Close search" onClick={() => { setMobileSearchOpen(false); setTopSearch('') }}><X size={18} /></button>}
          <div className="admin-popover-wrap" ref={notificationsRef}>
            <button className="admin-icon-button" aria-label="Open notifications" aria-expanded={notificationsOpen} title="Notifications" onClick={() => setNotificationsOpen((open) => !open)}><Bell size={18} />{notifications.some((item) => !item.is_read) && <i />}</button>
            {notificationsOpen && <div className="admin-notification-popover" role="dialog" aria-label="Recent notifications">
              <div className="admin-notification-popover-heading"><strong>Notifications</strong><button type="button" onClick={() => { setNotificationsOpen(false); navigateDashboard('notifications') }}>View all</button></div>
              {notificationsLoading ? <p className="admin-notification-popover-empty">Loading notifications…</p> : notificationsError ? <p className="admin-notification-popover-empty" role="alert">{notificationsError}</p> : notifications.length ? notifications.slice(0, 6).map((notification) => <button className={`admin-notification-popover-row ${notification.is_read ? '' : 'is-unread'}`} key={notification.id} type="button" onClick={() => { setNotificationsOpen(false); navigateDashboard('notifications'); openNotification(notification) }}><span className={`notification-dot ${notification.is_read ? '' : 'is-unread'}`} /><span><strong>{notification.title}</strong><small>{notification.body}</small></span></button>) : <p className="admin-notification-popover-empty">No notifications yet.</p>}
            </div>}
          </div>
          <div className="admin-popover-wrap admin-profile-wrap">
            <button className="admin-user" aria-label="Open user profile menu" aria-expanded={profileOpen} onClick={() => setProfileOpen((open) => !open)}><ProfileAvatar url={profile?.avatar_url} name={profile?.full_name || session.user.email} /><span>{profile?.full_name || session.user.email}</span><ChevronDown size={15} /></button>
            {profileOpen && <div className="admin-popover"><strong>{profile?.full_name || 'Account'}</strong><button onClick={() => { navigateDashboard('profile') }}>View profile</button><button onClick={() => { setSettingsSection('account'); navigateDashboard('settings') }}>Account settings</button><button onClick={() => { setSettingsSection('security'); navigateDashboard('settings') }}>Security settings</button>{userRole === 'admin' && <button onClick={() => { setSettingsSection('site'); navigateDashboard('settings') }}>Site settings</button>}<button className="admin-popover-logout" onClick={signOut}>Log out</button></div>}
          </div>
          <button className="admin-menu-toggle" type="button" aria-label={navOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={navOpen} onClick={() => setNavOpen((open) => !open)}><Menu size={19} /></button>
        </div>
      </header>
      <section className="admin-content"><div className="admin-heading"><div><span className="admin-label">MANAGE YOUR WEBSITE</span><h1>{tabLabel(activeTab)}</h1><p>{tabDescription(activeTab)}</p></div>{contentKinds.has(activeTab) && <button className="button button-primary" onClick={() => { const homepage = activeTab === 'homepage' ? items.find((item) => item.kind === 'homepage') : null; setEditing(homepage || { kind: activeTab, status: 'draft', metadata: {} }); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>{activeTab === 'homepage' && items.some((item) => item.kind === 'homepage') ? 'Edit homepage' : <><Plus size={16} /> Add {kindLabels[activeTab]?.toLowerCase()}</>}</button>}{activeTab === 'media' && <label className="button button-primary media-upload"><Plus size={16} /> Upload image<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={uploadMedia} hidden /></label>}</div>
      {message && <p className="admin-message" role="status">{message}</p>}{dataError && <><p className="form-error" role="alert">{dataError}</p><button className="button button-secondary" type="button" onClick={loadAdminData} disabled={busy}>Retry</button></>}
      {activeTab === 'notifications' && <NotificationsScreen
        notifications={notifications}
        loading={notificationsLoading}
        error={notificationsError}
        selected={selectedNotification}
        onSelect={openNotification}
        onBack={() => setSelectedNotification(null)}
        onRetry={loadNotifications}
      />}
      {activeTab === 'profile' && <ProfileScreen
        profile={profile}
        email={session.user.email}
        onAccountSettings={() => navigate('/admin/change-password')}
        onSiteSettings={() => navigateDashboard('settings')}
      />}
      {activeTab === 'overview' && <DashboardOverview
        stats={statCards}
        recent={recentActivity}
        loading={busy}
        onNavigate={navigateDashboard}
        onEdit={(item) => { navigateDashboard(item.kind); setEditing(item) }}
      />}
      {activeTab === 'add-user' && <AddUserScreen busy={busy} onSubmit={createAdminUser} isAdmin={userRole === 'admin'} onViewUsers={() => navigateDashboard('admins')} />}
      {activeTab === 'admins' && <AdminsScreen profiles={profiles} busy={busy} isAdmin={userRole === 'admin'} currentUserId={session.user.id} onUpdate={updateAdminUser} onRemove={removeAdminUser} onAddUser={() => navigateDashboard('add-user')} />}
      {activeTab === 'advertisements' && <AdvertisementsScreen
        ads={advertisements}
        loading={advertisementsLoading}
        busy={busy}
        editing={editingAdvertisement}
        onEdit={setEditingAdvertisement}
        onSave={saveAdvertisement}
        onStatus={updateAdvertisementStatus}
        onDelete={deleteAdvertisement}
        onRetry={loadAdvertisements}
      />}
      {activeTab === 'statistics' && <StatisticsScreen views={analyticsViews} range={analyticsRange} loading={analyticsLoading} onRangeChange={setAnalyticsRange} />}
      {activeTab === 'chat' && <ChatScreen
        profiles={chatOverview}
        currentUserId={session.user.id}
        selectedUser={selectedChatUser}
        messages={chatMessages}
        busy={chatBusy}
        loading={chatLoading}
        contactsLoading={chatUsersLoading}
        search={chatSearch}
        onSearch={setChatSearch}
        onSelect={openChat}
        onBack={() => setSelectedChatUser(null)}
        onRefresh={loadChatUsers}
        onSend={sendChatMessage}
      />}
      {contentKinds.has(activeTab) && editing && <ContentEditor key={editing.id || `${activeTab}-new`} item={editing} kind={activeTab} busy={busy} onSave={saveContent} onCancel={() => setEditing(null)} allItems={items} onPreview={(form) => {
        const fields = new FormData(form)
        setPreviewing({
          ...editing,
          kind: activeTab,
          title: String(fields.get('title') || '').trim(),
          summary: String(fields.get('summary') || '').trim(),
          body: String(fields.get('body') || '').trim(),
          image_url: String(fields.get('image_url') || '').trim() || (fields.get('image_file')?.size ? URL.createObjectURL(fields.get('image_file')) : ''),
          metadata: {
            ...(editing.metadata || {}),
            author: String(fields.get('title') || '').trim(),
            role: String(fields.get('role') || '').trim(),
            organization: String(fields.get('organization') || '').trim(),
            project: String(fields.get('project') || '').trim(),
            rating: String(fields.get('rating') || '').trim(),
            website_url: String(fields.get('website_url') || '').trim(),
          },
        })
      }} />}
      {activeTab === 'settings' && <SettingsScreen
        section={settingsSection}
        onSectionChange={setSettingsSection}
        profile={profile}
        session={session}
        settings={settings}
        busy={busy}
        isAdmin={userRole === 'admin'}
        onSaveProfile={saveProfile}
        onUpdateEmail={updateAccountEmail}
        onSaveNotifications={saveNotificationPreferences}
        onSaveAppearance={saveAppearancePreferences}
        onSaveSocial={saveSocialSettings}
        onSaveSite={saveSettings}
        onChangePassword={() => navigate('/admin/change-password')}
        onSignOut={signOut}
      />}
      {activeTab === 'media' && <><div className="media-drop-zone" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) uploadMedia(file) }}><Image size={24} /><strong>Drag and drop an image here</strong><span>JPEG, PNG, WebP or AVIF · Up to 5 MB</span></div><div className="media-grid">{media.length ? media.map((item) => <article className="media-item" key={item.path}><img src={supabase.storage.from('site-images').getPublicUrl(item.path).data.publicUrl} alt={item.name} /><p>{item.name}</p><button className="danger-action" onClick={() => deleteMedia(item)}>Delete</button></article>) : <p className="empty-state">No uploaded images yet.</p>}</div></>}
      {previewing && <ContentPreview item={previewing} onClose={() => {
        if (previewing.image_url?.startsWith('blob:')) URL.revokeObjectURL(previewing.image_url)
        setPreviewing(null)
      }} />}
      {(contentKinds.has(activeTab) || activeTab === 'inquiries') && <div className="admin-list-tools"><label>Search<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, email or description" /></label>{activeTab !== 'inquiries' && <label>Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All</option><option value="published">Published</option><option value="draft">Draft</option></select></label>}</div>}
      {busy && !editing && (activeTab === 'overview' || activeTab === 'inquiries' || contentKinds.has(activeTab)) ? <p className="admin-loading">Loading dashboard data…</p> : activeTab === 'inquiries' ? <div className="inquiry-list">{currentItems.length ? currentItems.map((item) => <article className={`inquiry-card ${item.is_read ? '' : 'unread'}`} key={item.id}><div className="inquiry-header"><div><span className={`status-pill ${item.is_read ? 'status-draft' : 'status-published'}`}>{item.is_read ? 'Read' : 'New'}</span><h3>{item.name}</h3></div><span>{new Date(item.created_at).toLocaleString()}</span></div><div className="inquiry-contact"><a href={`mailto:${item.email}`}>{item.email}</a>{item.phone && <a href={`tel:${item.phone}`}>{item.phone}</a>}{item.service && <span>{item.service}</span>}{item.subject && <span>{item.subject}</span>}</div><p>{item.message}</p><div className="item-actions"><button onClick={() => toggleRead(item)}>{item.is_read ? 'Mark unread' : 'Mark read'}</button><button className="danger-action" onClick={() => deleteInquiry(item)}>Delete</button></div></article>) : <p className="empty-state">No enquiries yet.</p>}</div> : contentKinds.has(activeTab) ? <div className="admin-item-list">{currentItems.length ? currentItems.map((item) => <article className="admin-item-card" key={item.id}>{item.image_url ? <img src={item.image_url} alt="" /> : <div className="item-image-placeholder"><Image size={20} /></div>}<div className="admin-item-copy"><div><span className={`status-pill ${item.status === 'published' ? 'status-published' : 'status-draft'}`}>{item.status}</span><span className="item-kind">{kindLabels[item.kind]}</span></div><h3>{item.title}</h3><p>{item.summary || item.body || item.slug}</p></div><div className="item-actions"><Link className="admin-preview" to={itemRoute(item)} target="_blank">Preview</Link><button onClick={() => { setEditing(item); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Edit</button><button onClick={() => togglePublish(item)}>{item.status === 'published' ? 'Unpublish' : 'Publish'}</button><button className="danger-action" onClick={() => deleteContent(item)}>Delete</button></div></article>) : <p className="empty-state">No matching content yet.</p>}</div> : null}
    </section></main></div>
}

function NotificationsScreen({ notifications, loading, error, selected, onSelect, onBack, onRetry }) {
  if (selected) return <section className="notification-detail">
    <button className="notification-back" type="button" onClick={onBack}><ArrowRight size={15} /> Back to notifications</button>
    {error && <p className="form-error" role="alert">{error}</p>}
    <article>
      <div className="notification-detail-meta"><span className={`notification-status ${selected.is_read ? 'is-read' : 'is-unread'}`}>{selected.is_read ? 'Read' : 'Unread'}</span><time dateTime={selected.created_at}>{new Date(selected.created_at).toLocaleString()}</time></div>
      <h2>{selected.title}</h2>
      <p>{selected.body || 'No additional details were provided.'}</p>
    </article>
  </section>
  return <section className="notification-center" aria-label="Notifications">
    {error ? <div className="notification-empty"><p className="form-error" role="alert">{error}</p><button type="button" onClick={onRetry}>Retry notifications</button></div> : loading ? <p className="admin-loading" role="status">Loading notifications…</p> : notifications.length ? <div className="notification-list">{notifications.map((notification) => <button className={`notification-row ${notification.is_read ? 'is-read' : 'is-unread'}`} key={notification.id} type="button" onClick={() => onSelect(notification)}>
      <span className={`notification-dot ${notification.is_read ? 'is-read' : 'is-unread'}`} aria-label={notification.is_read ? 'Read' : 'Unread'} />
      <span className="notification-row-copy"><strong>{notification.title}</strong><span>{notification.body || 'No additional details were provided.'}</span></span>
      <time dateTime={notification.created_at}>{new Date(notification.created_at).toLocaleString()}</time>
    </button>)}</div> : <div className="notification-empty"><Bell size={22} /><h2>No notifications yet</h2><p>New updates for your account will appear here.</p><button type="button" onClick={onRetry}>Refresh notifications</button></div>}
  </section>
}

function ProfileScreen({ profile, email, onAccountSettings, onSiteSettings }) {
  return <section className="profile-screen">
    <div className="profile-card"><ProfileAvatar url={profile?.avatar_url} name={profile?.full_name || email} /><div><h2>{profile?.full_name || 'Account profile'}</h2><p>{email}</p></div></div>
    <dl><div><dt>Name</dt><dd>{profile?.full_name || 'Not set'}</dd></div><div><dt>Email</dt><dd>{email}</dd></div><div><dt>Role</dt><dd>{profile?.role || 'Administrator'}</dd></div></dl>
    <div className="profile-actions"><button type="button" onClick={onAccountSettings}><Settings size={15} /> Account settings</button>{profile?.role === 'admin' && <button type="button" onClick={onSiteSettings}><Settings size={15} /> Site settings</button>}</div>
  </section>
}

function DashboardOverview({ stats, recent, loading, onNavigate, onEdit }) {
    return <div className="dashboard-overview">
      <div className="overview-welcome"><div><span className="admin-label">YOUR WEBSITE AT A GLANCE</span><h2>Welcome back</h2><p>Manage your content, users, and website activity from one place.</p></div><Link className="button button-primary" to="/" target="_blank">View website <ArrowUpRight size={15} /></Link></div>
      {loading ? <p className="admin-loading">Loading your website overview…</p> : <div className="overview-stat-grid">{stats.map(([label, value, note]) => <article className="overview-stat-card" key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}</div>}
      <div className="overview-columns"><section className="overview-panel"><div className="overview-panel-heading"><div><h2>Recent activity</h2><p>Latest content updates and website enquiries</p></div><button onClick={() => onNavigate('inquiries')}>View enquiries <ArrowUpRight size={14} /></button></div>{recent.length ? <div className="overview-activity-list">{recent.map((entry) => <button key={entry.id} onClick={() => entry.tab === 'inquiries' ? onNavigate('inquiries') : onEdit(entry)}><span className={`activity-dot ${entry.status}`} /><span className="overview-activity-copy"><strong>{entry.label}</strong><small>{new Date(entry.date).toLocaleString()}</small></span><span className={`status-pill ${entry.status === 'published' || entry.status === 'read' ? 'status-published' : 'status-draft'}`}>{entry.status}</span></button>)}</div> : <p className="empty-state">Your recent content and enquiries will appear here.</p>}</section>
        <section className="overview-panel overview-quick-actions"><div className="overview-panel-heading"><div><h2>Quick actions</h2><p>Common tasks for your website</p></div></div><button onClick={() => onNavigate('services')}><Shield size={17} /><span><strong>Manage services</strong><small>Edit and publish company services</small></span><ArrowUpRight size={15} /></button><button onClick={() => onNavigate('projects')}><FolderKanban size={17} /><span><strong>Manage projects</strong><small>Update featured portfolio work</small></span><ArrowUpRight size={15} /></button><button onClick={() => onNavigate('inquiries')}><MessageCircle size={17} /><span><strong>Contact enquiries</strong><small>Review submitted messages</small></span><ArrowUpRight size={15} /></button><button onClick={() => onNavigate('media')}><Image size={17} /><span><strong>Upload media</strong><small>Manage images and documents</small></span><ArrowUpRight size={15} /></button></section>
      </div>
    </div>
}

function ProfileAvatar({ url, name, className = '' }) {
    const [imageFailed, setImageFailed] = useState(false)

    useEffect(() => setImageFailed(false), [url])

    return url && !imageFailed
      ? <img className={`admin-avatar ${className}`} src={url} alt="" onError={() => setImageFailed(true)} />
      : <span className={`admin-avatar ${className}`}>{avatarInitials(name)}</span>
}

function PasswordChangeForm({ recovery, busy, error, status, onSubmit }) {
    const [passwordVisible, setPasswordVisible] = useState(false)
    return <div className="admin-setup-screen"><form className="login-card" onSubmit={onSubmit}>
      <Link to={recovery ? '/' : '/admin'} className="admin-back">{recovery ? '← Back to website' : '← Back to dashboard'}</Link>
      <img src={logoPath} alt="Again" />
      <span className="admin-label">{recovery ? 'ACCOUNT RECOVERY' : 'ACCOUNT SECURITY'}</span>
      <h1>{recovery ? 'Choose a new password' : 'Change your password'}</h1>
      <p>Use at least 12 characters with uppercase and lowercase letters and a number.</p>
      {['password', 'confirm_password'].map((name) => <label className="password-change-field" key={name}>{name === 'password' ? 'New password' : 'Confirm new password'}<span><input name={name} type={passwordVisible ? 'text' : 'password'} autoComplete="new-password" minLength={12} required /><button type="button" onClick={() => setPasswordVisible((visible) => !visible)} aria-label={passwordVisible ? 'Hide password' : 'Show password'}>{passwordVisible ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>)}
      {error && <p className="form-error" role="alert">{error}</p>}
      {status && <p className="admin-message" role="status">{status}</p>}
      <button type="submit" className="button button-primary" disabled={busy}>{busy ? 'Updating…' : 'Update password'} <ArrowRight size={16} /></button>
    </form></div>
}

function AvatarUploadField({ profile }) {
    const [preview, setPreview] = useState(profile?.avatar_url || '')
    const [removed, setRemoved] = useState(false)
    const [error, setError] = useState('')
    const fileInput = useRef(null)

    useEffect(() => {
      setPreview(profile?.avatar_url || '')
      setRemoved(false)
      setError('')
    }, [profile?.avatar_url])

    useEffect(() => () => {
      if (preview.startsWith('blob:')) URL.revokeObjectURL(preview)
    }, [preview])

    function chooseFile(file) {
      if (!file) return
      if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type) || file.size > 5 * 1024 * 1024) {
        setError('Choose a JPEG, PNG, WebP or AVIF image no larger than 5 MB.')
        if (fileInput.current) fileInput.current.value = ''
        return
      }
      setError('')
      setPreview(URL.createObjectURL(file))
      setRemoved(false)
    }

    return <div className="settings-avatar-field">
      {preview && !removed ? <img src={preview} alt="Profile preview" /> : <span className="admin-avatar">{avatarInitials(profile?.full_name)}</span>}
      <div><strong>Profile picture</strong><small>JPEG, PNG, WebP or AVIF · Up to 5 MB</small>
        <div className="settings-avatar-actions">
          <label className="button button-quiet"><Camera size={15} /> Choose picture<input ref={fileInput} name="avatar_file" type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => chooseFile(event.currentTarget.files?.[0])} hidden /></label>
          {profile?.avatar_url && <button className="button button-quiet" type="button" onClick={() => { setRemoved(true); setPreview(''); if (fileInput.current) fileInput.current.value = '' }}>Remove</button>}
        </div>
        {error && <span className="form-error" role="alert">{error}</span>}
      </div>
      {removed && <input type="hidden" name="remove_avatar" value="on" />}
    </div>
}

function AddUserScreen({ busy, onSubmit, isAdmin, onViewUsers }) {
    if (!isAdmin) return <p className="form-error" role="alert">Only administrators can add users.</p>
    return <form className="editor-card admin-user-form" onSubmit={onSubmit}>
      <div className="editor-heading"><div><span className="admin-label">USER ADMINISTRATION</span><h2>Create a team account</h2></div><button type="button" className="button button-quiet" onClick={onViewUsers}>Manage users <Users size={15} /></button></div>
      <p className="admin-form-intro">Create access for a teammate. Passwords are securely processed by the server and are never stored in the browser.</p>
      <div className="editor-grid">
        <label>Full name<input name="full_name" autoComplete="name" required maxLength={120} /></label>
        <label>Email address<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
        <label>Phone number<input name="phone" type="tel" autoComplete="tel" maxLength={40} /></label>
        <label>Temporary password<input name="password" type="password" autoComplete="new-password" minLength={12} required /></label>
        <label>Confirm password<input name="confirm_password" type="password" autoComplete="new-password" minLength={12} required /></label>
        <label>Role<select name="role" defaultValue="editor"><option value="editor">Editor</option><option value="admin">Administrator</option></select></label>
      </div>
      <div className="editor-actions"><button className="button button-primary" disabled={busy}>{busy ? 'Creating account…' : 'Create user'} <UserPlus size={16} /></button></div>
    </form>
}

function AdminsScreen({ profiles, busy, isAdmin, currentUserId, onUpdate, onRemove, onAddUser }) {
    const [editingUserId, setEditingUserId] = useState('')

    async function saveDetails(event, profile) {
      event.preventDefault()
      const form = new FormData(event.currentTarget)
      const full_name = String(form.get('full_name') || '').trim()
      const email = String(form.get('email') || '').trim()
      const phone = String(form.get('phone') || '').trim()
      if (!full_name || !email || phone.length > 40) return
      if (await onUpdate(profile, { full_name, email, phone })) setEditingUserId('')
    }

    if (!isAdmin) return <p className="form-error" role="alert">Only administrators can manage user accounts.</p>
    return <div className="admin-user-list"><div className="overview-panel-heading"><div><h2>Team accounts</h2><p>Manage account details, roles and access status.</p></div><button className="button button-primary" onClick={onAddUser}><Plus size={15} /> Add user</button></div>{busy && !profiles.length ? <p className="admin-loading">Loading administrator accounts…</p> : profiles.length ? profiles.map((profile) => <article className="admin-user-card" key={profile.user_id}><ProfileAvatar url={profile.avatar_url} name={profile.full_name || profile.email} /><div className="admin-user-details"><strong>{profile.full_name || 'Team member'}</strong><span>{profile.email}{profile.phone ? ` · ${profile.phone}` : ''}</span></div><label className="admin-role-control">Role<select value={profile.role} disabled={busy || profile.user_id === currentUserId} onChange={(event) => onUpdate(profile, { role: event.target.value })}><option value="editor">Editor</option><option value="admin">Administrator</option></select></label><label className="admin-active-control"><input type="checkbox" checked={profile.is_active !== false} disabled={busy || profile.user_id === currentUserId} onChange={(event) => onUpdate(profile, { is_active: event.target.checked })} /> Active</label><button className="admin-details-button" disabled={busy || editingUserId === profile.user_id} onClick={() => setEditingUserId(profile.user_id)}>Edit details</button><button className="danger-action" disabled={busy || profile.user_id === currentUserId} onClick={() => onRemove(profile)}>Remove</button>{editingUserId === profile.user_id && <form className="admin-edit-user-form" onSubmit={(event) => saveDetails(event, profile)}><label>Full name<input name="full_name" defaultValue={profile.full_name || ''} maxLength={120} required /></label><label>Email address<input name="email" type="email" defaultValue={profile.email || ''} maxLength={254} required /></label><label>Phone number<input name="phone" type="tel" defaultValue={profile.phone || ''} maxLength={40} /></label><div><button className="button button-primary" disabled={busy}>Save details</button><button type="button" className="button button-quiet" onClick={() => setEditingUserId('')}>Cancel</button></div></form>}</article>) : <p className="empty-state">No other administrator accounts were returned.</p>}</div>
}

function AdvertisementForm({ item, busy, onSave, onCancel }) {
    const dateValue = (value) => value ? new Date(value).toISOString().slice(0, 16) : ''
    return <form className="editor-card advertisement-form" onSubmit={onSave}>
      <div className="editor-heading"><div><span className="admin-label">ADVERTISEMENT</span><h2>{item?.id ? 'Edit advertisement' : 'Create advertisement'}</h2></div><button type="button" className="icon-button" onClick={onCancel} aria-label="Close editor"><X size={20} /></button></div>
      <div className="editor-grid">
        <label>Title<input name="title" defaultValue={item?.title || ''} maxLength={180} required /></label>
        <label>Destination URL<input name="destination_url" type="url" defaultValue={item?.destination_url || ''} placeholder="https://…" required /></label>
        <label className="editor-wide">Description<textarea name="description" rows="3" maxLength={2000} defaultValue={item?.description || ''} /></label>
        <ImageUploadField item={item || {}} label="Advertisement banner" />
        <label>Placement<select name="placement" defaultValue={item?.placement || 'homepage_banner'} required><option value="site_top">Top of all public pages</option><option value="homepage_banner">Homepage banner</option><option value="homepage_featured">Homepage featured section</option><option value="site_footer">Above the footer</option></select></label>
        <label>Publication status<select name="status" defaultValue={item?.status || 'draft'}><option value="draft">Draft</option><option value="published">Published</option><option value="scheduled">Scheduled</option></select></label>
        <label>Start date and time<input name="starts_at" type="datetime-local" defaultValue={dateValue(item?.starts_at)} /></label>
        <label>End date and time<input name="ends_at" type="datetime-local" defaultValue={dateValue(item?.ends_at)} /></label>
      </div>
      <div className="editor-actions"><button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save advertisement'} <Check size={16} /></button><button type="button" className="button button-quiet" onClick={onCancel}>Cancel</button></div>
    </form>
}

function AdvertisementsScreen({ ads, loading, busy, editing, onEdit, onSave, onStatus, onDelete, onRetry }) {
    return <div className="advertisement-management">
      {editing !== null && <AdvertisementForm key={editing?.id || 'new-ad'} item={editing} busy={busy} onSave={onSave} onCancel={() => onEdit(null)} />}
      <div className="overview-panel-heading"><div><h2>Advertisements</h2><p>Manage banners and their public website placements.</p></div>{editing === null && <button className="button button-primary" onClick={() => onEdit({})}><Plus size={15} /> Add advertisement</button>}</div>
      {loading ? <p className="admin-loading">Loading advertisements…</p> : ads.length ? <div className="advertisement-list">{ads.map((ad) => <article className="advertisement-card" key={ad.id}>
        {ad.image_url ? <img src={ad.image_url} alt="" /> : <div className="item-image-placeholder"><Image size={20} /></div>}
        <div className="advertisement-copy"><div><span className={`status-pill status-${ad.status === 'published' ? 'published' : 'draft'}`}>{ad.status}</span><span className="item-kind">{ad.placement.replaceAll('_', ' ')}</span></div><h3>{ad.title}</h3><p>{ad.description || 'No description provided.'}</p><a href={ad.destination_url} target="_blank" rel="noreferrer">{ad.destination_url}</a>{(ad.starts_at || ad.ends_at) && <small>{ad.starts_at ? `Starts ${new Date(ad.starts_at).toLocaleString()}` : 'No start date'}{ad.ends_at ? ` · Ends ${new Date(ad.ends_at).toLocaleString()}` : ''}</small>}</div>
        <div className="item-actions"><button onClick={() => onEdit(ad)}>Edit</button><button onClick={() => onStatus(ad, ad.status === 'draft' ? 'published' : 'draft')}>{ad.status === 'draft' ? 'Publish' : 'Unpublish'}</button><button className="danger-action" onClick={() => onDelete(ad)}>Delete</button></div>
      </article>)}</div> : <div className="analytics-empty"><ImagePlus size={28} /><h2>No advertisements yet</h2><p>Create a real advertisement to show it in its selected public website placement.</p><div className="editor-actions"><button className="button button-secondary" onClick={onRetry}>Retry</button>{editing === null && <button className="button button-primary" onClick={() => onEdit({})}><Plus size={15} /> Add advertisement</button>}</div></div>}
    </div>
}

const settingsSections = [
  ['profile', 'My profile', Users],
  ['account', 'Account settings', Settings],
  ['security', 'Security & privacy', LockKeyhole],
  ['notifications', 'Notifications', Bell],
  ['appearance', 'Appearance', Moon],
  ['social', 'Social media', MessageCircle],
  ['site', 'Website settings', Image],
]

function SettingsScreen({ section, onSectionChange, profile, session, settings, busy, isAdmin, onSaveProfile, onUpdateEmail, onSaveNotifications, onSaveAppearance, onSaveSocial, onSaveSite, onChangePassword, onSignOut }) {
    const visibleSections = settingsSections.filter(([id]) => id !== 'site' || isAdmin)
    const labels = {
      profile: ['My profile', 'Update your profile information and profile picture.'],
      account: ['Account settings', 'Manage your account email and review account status.'],
      security: ['Security & privacy', 'Update your password and review available session controls.'],
      notifications: ['Notification preferences', 'Choose which dashboard alerts are generated for your account.'],
      appearance: ['Appearance & preferences', 'Manage available dashboard display preferences.'],
      social: ['Social media settings', 'Configure official company social profile links without inventing destinations.'],
      site: ['Website settings', 'Update public website details and brand assets.'],
    }
    const notificationPreferences = profile?.notification_preferences || {}
    return <div className="settings-layout">
      <nav className="settings-sidebar" aria-label="Settings categories">{visibleSections.map(([id, label, Icon]) => <button key={id} className={section === id ? 'active' : ''} onClick={() => onSectionChange(id)}><Icon size={16} /><span>{label}</span></button>)}</nav>
      <section className="settings-panel">
        <div className="settings-panel-heading"><span className="admin-label">SETTINGS</span><h2>{labels[section]?.[0]}</h2><p>{labels[section]?.[1]}</p></div>
        {section === 'profile' && <form className="settings-form" onSubmit={onSaveProfile}>
          <AvatarUploadField profile={profile} />
          <div className="editor-grid"><label>Full name<input name="full_name" autoComplete="name" defaultValue={profile?.full_name || ''} maxLength={120} required /></label><label>Email address<input value={session.user.email || ''} disabled readOnly /></label><label>Phone number<input name="phone" type="tel" autoComplete="tel" defaultValue={profile?.phone || ''} maxLength={40} /></label></div>
          <div className="editor-actions"><button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save profile'} <Check size={16} /></button></div>
        </form>}
        {section === 'account' && <div className="settings-form">
          <form className="editor-grid" onSubmit={onUpdateEmail}><label className="editor-wide">Account email<input name="email" type="email" autoComplete="email" defaultValue={session.user.email || ''} maxLength={254} required /></label><p className="editor-wide settings-note">Changing your email may require confirming the new address through a link sent by the authentication provider.</p><div className="editor-actions editor-wide"><button className="button button-primary" disabled={busy}>{busy ? 'Submitting…' : 'Update email'} <Mail size={15} /></button></div></form>
          <dl className="settings-account-details"><div><dt>Account created</dt><dd>{session.user.created_at ? new Date(session.user.created_at).toLocaleDateString() : 'Not available'}</dd></div><div><dt>Account status</dt><dd>{profile?.is_active === false ? 'Inactive' : 'Active'}</dd></div><div><dt>Email confirmation</dt><dd>{session.user.email_confirmed_at ? 'Confirmed' : 'Pending confirmation'}</dd></div><div><dt>Role</dt><dd>{profile?.role || 'Not available'}</dd></div></dl>
        </div>}
        {section === 'security' && <div className="settings-form settings-security"><article><LockKeyhole size={21} /><div><h3>Password</h3><p>Use a unique password with at least 12 characters. Password updates are handled by Supabase Auth.</p></div><button className="button button-primary" onClick={onChangePassword}>Change password <ArrowRight size={15} /></button></article><article><Shield size={21} /><div><h3>Active sessions</h3><p>Session inventory and remote session revocation are not provided by the configured authentication backend.</p></div></article><article><LogOut size={21} /><div><h3>Sign out</h3><p>End this authenticated dashboard session on this device.</p></div><button className="button button-quiet" onClick={onSignOut}>Log out</button></article></div>}
        {section === 'notifications' && <form className="settings-form" onSubmit={onSaveNotifications}><div className="settings-options">
          {[
            ['contact_inquiry', 'Website enquiries', 'Dashboard alerts when a new contact enquiry is submitted.'],
            ['chat_message', 'Admin chat messages', 'Dashboard alerts when a teammate sends a chat message.'],
            ['system', 'System notifications', 'Other account and website notifications when supported.'],
          ].map(([key, title, description]) => <label className="settings-option" key={key}><span><strong>{title}</strong><small>{description}</small></span><input name={key} type="checkbox" defaultChecked={notificationPreferences[key] !== false} /></label>)}
          <p className="settings-note">Email delivery preferences are not available because this project does not currently send these notification categories by email.</p>
        </div><div className="editor-actions"><button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save preferences'} <Check size={16} /></button></div></form>}
        {section === 'appearance' && <form className="settings-form" onSubmit={onSaveAppearance}><label className="settings-option"><span><strong>Compact dashboard spacing</strong><small>Use tighter spacing for dashboard lists and panels.</small></span><input name="compact_mode" type="checkbox" defaultChecked={profile?.preferences?.compact_mode === true} /></label><p className="settings-note">Theme and color customization are not configured; the existing website branding remains unchanged.</p><div className="editor-actions"><button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save preferences'} <Check size={16} /></button></div></form>}
        {section === 'social' && <form className="settings-form" onSubmit={onSaveSocial}><div className="settings-social-list">{[
          ['facebook_url', 'Facebook', Facebook], ['linkedin_url', 'LinkedIn', Linkedin], ['instagram_url', 'Instagram', Instagram], ['x_url', 'X', FaXTwitter], ['youtube_url', 'YouTube', FaYoutube],
        ].map(([key, title, Icon]) => { const url = safeHttpUrl(settings[key]); return <label className="settings-social-row" key={key}><span>{url ? <a href={url} target="_blank" rel="noreferrer" aria-label={`Open ${title} profile`}><Icon size={19} /></a> : <span className="settings-social-unconfigured" title="Configure this profile URL to activate the link"><Icon size={19} /></span>}<strong>{title}</strong></span><input name={key} type="url" defaultValue={settings[key] || ''} placeholder="https:// profile URL" /><small>{url ? 'Configured' : 'Not configured'}</small></label>})}</div><p className="settings-note">Only entered URLs are clickable on the public website. Leave a field blank until the official company profile is available.</p><div className="editor-actions"><button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save social links'} <Check size={16} /></button></div></form>}
        {section === 'site' && isAdmin && <SettingsEditor settings={settings} busy={busy} onSave={onSaveSite} />}
      </section>
    </div>
}

function StatisticsScreen({ views, range, loading, onRangeChange }) {
    const dailyCounts = Array.from({ length: range }, (_, index) => {
      const date = new Date()
      date.setUTCHours(0, 0, 0, 0)
      date.setUTCDate(date.getUTCDate() - (range - index - 1))
      const key = date.toISOString().slice(0, 10)
      return { key, label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), count: views.daily?.find((day) => day.date === key)?.count || 0 }
    })
    const maxCount = Math.max(1, ...dailyCounts.map((day) => day.count))
    const topPages = views.top_pages || []
    return <div className="statistics-screen"><div className="statistics-toolbar"><p>Page visits recorded by this website. Analytics only become available after tracking is configured.</p><label>Period<select value={range} onChange={(event) => onRangeChange(Number(event.target.value))}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></label></div>{loading ? <p className="admin-loading">Loading website analytics…</p> : <><div className="overview-stat-grid statistics-summary"><article className="overview-stat-card"><span>Page views</span><strong>{views.total_views || 0}</strong><small>in selected period</small></article><article className="overview-stat-card"><span>Unique visitors</span><strong>{views.unique_visitors || 0}</strong><small>based on anonymous browser sessions</small></article></div>{views.total_views ? <div className="overview-columns"><section className="overview-panel"><div className="overview-panel-heading"><div><h2>Visits over time</h2><p>Daily page views</p></div></div><div className="statistics-chart" role="img" aria-label="Daily page views chart">{dailyCounts.map((day) => <div className="statistics-bar-wrap" key={day.key} title={`${day.label}: ${day.count} views`}><span>{day.count || ''}</span><div className="statistics-bar" style={{ height: `${Math.max(4, day.count / maxCount * 100)}%` }} /><small>{day.label}</small></div>)}</div></section><section className="overview-panel"><div className="overview-panel-heading"><div><h2>Top pages</h2><p>Most visited paths</p></div></div><div className="statistics-pages">{topPages.map((page) => <div key={page.path}><span>{page.path}</span><strong>{page.count}</strong></div>)}</div></section></div> : <div className="analytics-empty"><ChartNoAxesCombined size={28} /><h2>No analytics data yet</h2><p>Once page-view tracking is installed and visitors arrive, genuine statistics will appear here. No sample numbers are shown.</p></div>}</>}</div>
}

function ChatScreen({ profiles, currentUserId, selectedUser, messages, busy, loading, contactsLoading, search, onSearch, onSelect, onBack, onRefresh, onSend }) {
  const messagesEnd = useRef(null)
  const [messageSearch, setMessageSearch] = useState('')
  const otherUsers = profiles.filter((profile) => profile.user_id !== currentUserId)
  const visibleMessages = messages.filter((message) => message.body?.toLowerCase().includes(messageSearch.trim().toLowerCase()))

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [visibleMessages])

  return <div className={`admin-chat ${selectedUser ? 'has-selection' : ''}`}>
    <aside className="admin-chat-users">
      <div className="admin-chat-list-heading"><div><span className="admin-label">MESSAGES</span><h2>Team chat</h2></div><button type="button" className="admin-icon-button" onClick={onRefresh} aria-label="Refresh conversation list" title="Refresh conversation list"><RefreshCw size={16} /></button></div>
      <label className="admin-chat-search"><Search size={16} /><input type="search" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Find a teammate" aria-label="Search conversations" /></label>
      <div className="admin-chat-contact-list">{contactsLoading && !otherUsers.length ? <p className="admin-loading">Loading conversations…</p> : otherUsers.length ? otherUsers.map((profile) => <button className={selectedUser?.user_id === profile.user_id ? 'active' : ''} key={profile.user_id} onClick={() => onSelect(profile)}>
        <ProfileAvatar url={profile.avatar_url} name={profile.full_name || profile.email} />
        <span className="admin-chat-user-copy"><strong>{profile.full_name || profile.email}</strong><small className="admin-chat-last-message">{profile.last_message || 'Start a new conversation'}</small></span>
        <span className="admin-chat-user-meta">{profile.unread_count > 0 && <b aria-label={`${profile.unread_count} unread messages`}>{profile.unread_count > 99 ? '99+' : profile.unread_count}</b>}{profile.last_message_at && <small>{new Date(profile.last_message_at).toLocaleDateString()}</small>}</span>
      </button>) : <p className="empty-state">{search.trim() ? 'No administrators match that search.' : 'No other active administrators.'}</p>}</div>
    </aside>
    <section className="admin-chat-window">{selectedUser ? <>
      <div className="admin-chat-header"><button type="button" className="admin-chat-back" onClick={onBack} aria-label="Back to conversations"><ArrowRight size={17} /></button><ProfileAvatar url={selectedUser.avatar_url} name={selectedUser.full_name || selectedUser.email} /><div><strong>{selectedUser.full_name || selectedUser.email}</strong><small>{selectedUser.role} · Private conversation</small></div><label className="admin-chat-message-search"><Search size={15} /><input type="search" value={messageSearch} onChange={(event) => setMessageSearch(event.target.value)} placeholder="Search messages" aria-label="Search messages" />{messageSearch && <button type="button" onClick={() => setMessageSearch('')} aria-label="Clear message search"><X size={14} /></button>}</label></div>
      <div className="admin-chat-messages" aria-live="polite">{loading ? <p className="empty-state">Loading conversation…</p> : visibleMessages.length ? visibleMessages.map((message) => <article className={`admin-chat-message ${message.sender_id === currentUserId ? 'sent' : ''}`} key={message.id}><p>{message.body}</p><small><time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString()}</time>{message.sender_id === currentUserId && <span> · Sent</span>}</small></article>) : <p className="empty-state">{messageSearch ? 'No messages match your search.' : 'No messages yet. Start the conversation.'}</p>}<div ref={messagesEnd} /></div>
      <form className="admin-chat-composer" onSubmit={onSend}><input name="message" maxLength={4000} placeholder="Write a message…" aria-label="Write a message" required /><button className="button button-primary" disabled={busy}>{busy ? 'Sending…' : 'Send'} <Send size={16} /></button></form>
    </> : <div className="admin-chat-empty"><MessageCircle size={30} /><p>Select a teammate to view or start a conversation.</p></div>}</section>
  </div>
}

function ImageUploadField({ item, label }) {
    const fileInput = useRef(null)
    const urlInput = useRef(null)
    const [preview, setPreview] = useState(item.image_url || '')
    const [fileName, setFileName] = useState('')
    const [dragging, setDragging] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => () => {
      if (preview.startsWith('blob:')) URL.revokeObjectURL(preview)
    }, [preview])

    function chooseFile(file) {
      if (!file) return
      if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type) || file.size > 5 * 1024 * 1024) {
        setError('Use JPEG, PNG, WebP or AVIF up to 5 MB.')
        if (fileInput.current) fileInput.current.value = ''
        setFileName('')
        setPreview(item.image_url || '')
        return
      }
      const transfer = new DataTransfer()
      transfer.items.add(file)
      if (fileInput.current) fileInput.current.files = transfer.files
      setError('')
      setFileName(file.name)
      setPreview(URL.createObjectURL(file))
    }

    function removeImage() {
      if (fileInput.current) fileInput.current.value = ''
      if (urlInput.current) urlInput.current.value = ''
      setError('')
      setFileName('')
      setPreview('')
    }

    return <div className="image-upload-field editor-wide">
      <label>{label} URL<input ref={urlInput} name="image_url" type="url" defaultValue={item.image_url || ''} placeholder="https://…" onChange={(event) => { if (!fileName) setPreview(event.target.value) }} /></label>
      <div className={`image-drop-target ${dragging ? 'is-dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files[0]) }}>
        {preview ? <img src={preview} alt="" /> : <Image size={24} />}
        <div><strong>{fileName || `Drop or choose a ${label.toLowerCase()}`}</strong><small>JPEG, PNG, WebP or AVIF · Up to 5 MB</small></div>
        <label className="button button-quiet image-choose-button">Choose file<input ref={fileInput} name="image_file" type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => chooseFile(event.currentTarget.files?.[0])} hidden /></label>
        {preview && <button className="image-remove-button" type="button" onClick={removeImage}>Remove</button>}
      </div>
      {error && <span className="form-error" role="alert">{error}</span>}
      <p className="image-upload-note">Selecting a new file replaces the URL image when you save.</p>
    </div>
}

function ContentEditor({ item, kind, busy, onSave, onCancel, allItems, onPreview }) {
  const [slug, setSlug] = useState(item.slug || '')
  const [slugEdited, setSlugEdited] = useState(Boolean(item.slug))
  const availableRelations = allItems.filter((entry) => entry.id !== item.id)
  return <form className="editor-card" onSubmit={onSave}><div className="editor-heading"><div><span className="admin-label">{item.id ? 'EDIT CONTENT' : 'NEW CONTENT'}</span><h2>{item.id ? 'Edit item' : `Add ${kindLabels[kind]?.toLowerCase()}`}</h2></div><button type="button" className="icon-button" onClick={onCancel} aria-label="Close editor"><X size={20} /></button></div><div className="editor-grid">
    <label>{kind === 'partners' ? 'Partner name' : kind === 'testimonials' ? "Client's full name" : kind === 'team' ? 'Team member full name' : 'Title'}<input name="title" defaultValue={item.title || ''} required maxLength={180} onChange={(event) => { if (!slugEdited) setSlug(slugify(event.target.value)) }} /></label>
    <label>URL slug<input name="slug" value={slug} onChange={(event) => { setSlugEdited(true); setSlug(slugify(event.target.value)) }} maxLength={180} required /></label>
    <label className="editor-wide">{kind === 'partners' ? 'Short description' : kind === 'testimonials' ? 'Optional short summary' : 'Short description'}<textarea name="summary" rows="2" defaultValue={item.summary || ''} maxLength={800} /></label>
    <label className="editor-wide">{kind === 'testimonials' ? 'Testimonial statement' : 'Full text'}<textarea name="body" rows="5" defaultValue={item.body || ''} maxLength={5000} /></label>
    <ImageUploadField item={item} label={kind === 'partners' ? 'Partner logo' : kind === 'testimonials' || kind === 'team' ? 'Profile photo' : 'Content image'} />
    <label>Image alternative text<input name="image_alt" defaultValue={item.metadata?.image_alt || ''} /></label>
    <label>Category<input name="category" defaultValue={item.metadata?.category || ''} /></label>
    {(kind === 'homepage' || kind === 'about') && <><label>Eyebrow<input name="eyebrow" defaultValue={item.metadata?.eyebrow || ''} /></label><label>Button text<input name="cta" defaultValue={item.metadata?.cta || ''} /></label></>}
    {kind === 'homepage' && <><label>Hero proof heading<input name="hero_proof_title" defaultValue={item.metadata?.hero_proof_title || ''} /></label><label>Hero proof text<input name="hero_proof_text" defaultValue={item.metadata?.hero_proof_text || ''} /></label><label>Hero image caption<input name="image_caption" defaultValue={item.metadata?.image_caption || ''} /></label><label>Overview heading<input name="overview_heading" defaultValue={item.metadata?.overview_heading || ''} /></label><label className="editor-wide">Overview introduction<textarea name="overview_text" rows="3" defaultValue={item.metadata?.overview_text || ''} /></label></>}
    {(kind === 'products' || kind === 'projects') && <><label>Price (only if confirmed)<input name="price" defaultValue={item.metadata?.price || ''} /></label><label>Availability (only if confirmed)<input name="availability" defaultValue={item.metadata?.availability || ''} /></label></>}
    {kind === 'products' && <><label className="editor-wide">Product features, one per line<textarea name="benefits" rows="3" defaultValue={(item.metadata?.benefits || []).join('\n')} /></label><label className="editor-wide">Applications, one per line<textarea name="applications" rows="3" defaultValue={(item.metadata?.applications || []).join('\n')} /></label><label>Product document URL<input name="document_url" type="url" defaultValue={item.metadata?.document_url || ''} placeholder="https://…" /></label></>}
    {kind === 'projects' && <><label>Project location<input name="location" defaultValue={item.metadata?.location || ''} /></label><label>Completion date<input name="completed_date" defaultValue={item.metadata?.completed_date || ''} /></label><label>Client (only with permission)<input name="client" defaultValue={item.metadata?.client || ''} /></label><label>Technologies or equipment<input name="technologies" defaultValue={item.metadata?.technologies || ''} /></label><label className="editor-wide">Challenge or requirement<textarea name="challenge" rows="3" defaultValue={item.metadata?.challenge || ''} /></label><label className="editor-wide">Solution provided<textarea name="solution" rows="3" defaultValue={item.metadata?.solution || ''} /></label></>}
    {kind === 'partners' && <label>Partner website URL<input name="website_url" type="url" defaultValue={item.metadata?.website_url || ''} placeholder="https://partner.example" /></label>}
    {(kind === 'testimonials' || kind === 'team') && <><label>Professional position<input name="role" defaultValue={item.metadata?.role || item.metadata?.position || ''} /></label><label>{kind === 'team' ? 'Department' : 'Organization'}<input name="organization" defaultValue={item.metadata?.organization || item.metadata?.department || ''} /></label>{kind === 'testimonials' && <><label>Client location<input name="location" defaultValue={item.metadata?.location || ''} /></label><label>Related project<input name="project" defaultValue={item.metadata?.project || ''} /></label><label>Genuine rating (1–5, optional)<input name="rating" type="number" min="1" max="5" step="1" defaultValue={item.metadata?.rating || ''} /></label></>}</>}
    {kind === 'team' && <><label>Skills and expertise<textarea name="skills" rows="3" defaultValue={item.metadata?.skills || ''} /></label><label>Responsibilities<textarea name="responsibilities" rows="3" defaultValue={item.metadata?.responsibilities || ''} /></label><label>Professional contact (authorized only)<input name="email" type="email" defaultValue={item.metadata?.email || ''} /></label><label>Professional profile URL<input name="website_url" type="url" defaultValue={item.metadata?.website_url || ''} placeholder="https://…" /></label></>}
    {(kind === 'partners' || kind === 'testimonials' || kind === 'team' || kind === 'services' || kind === 'products' || kind === 'projects' || kind === 'news') && <><label>Display order<input name="display_order" type="number" min="0" step="1" defaultValue={item.metadata?.display_order ?? 0} /></label>{kind !== 'team' && <label className="editor-checkbox"><input name="homepage" type="checkbox" defaultChecked={item.metadata?.homepage !== false} /> Show on homepage</label>}</>}
    {kind === 'services' && <><label className="editor-checkbox"><input name="footer" type="checkbox" defaultChecked={item.metadata?.footer !== false} /> Include in footer services</label><label>Footer order (0 = automatic)<input name="footer_order" type="number" min="0" step="1" defaultValue={item.metadata?.footer_order ?? 0} /></label></>}
    {kind === 'homepage' && <><div className="editor-wide cms-field-heading">Homepage sections, one entry per line</div><label className="editor-wide">Industries served<textarea name="industries" rows="3" defaultValue={(item.metadata?.industries || []).join('\n')} /></label><label className="editor-wide">Why choose us: verified strengths<textarea name="strengths" rows="3" defaultValue={(item.metadata?.strengths || []).join('\n')} /></label><label className="editor-wide">Our process<textarea name="process" rows="3" defaultValue={(item.metadata?.process || []).join('\n')} /></label><label className="editor-wide">Technology and expertise<textarea name="expertise" rows="3" defaultValue={(item.metadata?.expertise || []).join('\n')} /></label>{[1, 2, 3].map((index) => <div className="editor-stat" key={index}><label>Verified statistic {index}<input name={`stat${index}_value`} defaultValue={item.metadata?.statistic_values?.[index - 1]?.value || ''} /></label><label>Statistic label<input name={`stat${index}_label`} defaultValue={item.metadata?.statistic_values?.[index - 1]?.label || ''} /></label></div>)}</>}
    {kind === 'about' && <><label>Mission<input name="mission" defaultValue={item.metadata?.mission || ''} /></label><label>Vision<input name="vision" defaultValue={item.metadata?.vision || ''} /></label><label className="editor-wide">Company history<textarea name="history" rows="3" defaultValue={item.metadata?.history || ''} /></label><label className="editor-wide">Areas of expertise, one per line<textarea name="expertise" rows="3" defaultValue={(item.metadata?.expertise || []).join('\n')} /></label><label className="editor-wide">Industries served, one per line<textarea name="industries" rows="3" defaultValue={(item.metadata?.industries || []).join('\n')} /></label><label className="editor-wide">Values<textarea name="values" defaultValue={item.metadata?.values || ''} /></label></>}
    {(kind === 'services' || kind === 'projects') && <label className="editor-wide">Scope of work<textarea name="scope" rows="3" defaultValue={item.metadata?.scope || ''} /></label>}
    {kind === 'services' && <><label className="editor-wide">Service benefits, one per line<textarea name="benefits" rows="3" defaultValue={(item.metadata?.benefits || []).join('\n')} /></label><label className="editor-wide">Implementation process, one step per line<textarea name="process" rows="3" defaultValue={(item.metadata?.process || []).join('\n')} /></label><label className="editor-wide">Industries served, one per line<textarea name="industries" rows="3" defaultValue={(item.metadata?.industries || []).join('\n')} /></label><label className="editor-checkbox"><input name="footer" type="checkbox" defaultChecked={item.metadata?.footer !== false} /> Include in footer services</label></>}
    {kind === 'products' && <label className="editor-wide">Technical specifications<textarea name="specifications" rows="3" defaultValue={item.metadata?.specifications || ''} /></label>}
    {(kind === 'services' || kind === 'products' || kind === 'projects' || kind === 'news') && <><label className="editor-wide">Additional image URLs, one per line<textarea name="gallery_urls" rows="3" defaultValue={(item.metadata?.gallery || []).map((image) => image.url).join('\n')} /></label><label className="editor-wide">FAQs, one per line in “Question | Answer” format<textarea name="faq" rows="3" defaultValue={(item.metadata?.faq || []).map((faq) => `${faq.question} | ${faq.answer}`).join('\n')} /></label></>}
    <label className="editor-wide">Related content slugs, comma separated<input name="related_slugs" defaultValue={(item.metadata?.related_slugs || []).join(', ')} placeholder={availableRelations.map((entry) => entry.slug).slice(0, 3).join(', ')} /></label>
    <label>SEO title<input name="seo_title" defaultValue={item.seo_title || ''} maxLength={180} /></label><label>SEO description<input name="seo_description" defaultValue={item.seo_description || ''} maxLength={300} /></label>
    <label>Publication<select name="status" defaultValue={item.status || 'draft'}><option value="draft">Draft</option><option value="published">Published</option></select></label>
  </div><div className="editor-actions"><button type="button" className="button button-quiet" onClick={(event) => onPreview(event.currentTarget.form)}>Preview</button><button type="button" className="button button-quiet" onClick={onCancel}>Cancel</button><button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save content'} <Check size={16} /></button></div></form>
}

function ContentPreview({ item, onClose }) {
  return <div className="content-preview-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="content-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="content-preview-title">
      <div className="content-preview-heading"><div><span className="admin-label">UNPUBLISHED PREVIEW</span><h2 id="content-preview-title">{kindLabels[item.kind]} preview</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close preview"><X size={20} /></button></div>
      {item.kind === 'partners'
        ? <div className="partner-preview"><PartnerPreviewLogo item={item} /></div>
        : item.kind === 'testimonials'
          ? <div className="testimonial-preview"><article className="testimonial-card"><div className="testimonial-card-top"><span className="quote-mark" aria-hidden="true">“</span>{Number(item.metadata?.rating) > 0 && <span className="testimonial-rating">{'★'.repeat(Math.min(5, Number(item.metadata.rating)))}</span>}</div><blockquote>{item.body || item.summary || 'Testimonial statement preview'}</blockquote>{(item.metadata?.organization || item.metadata?.project || item.metadata?.location) && <p className="testimonial-association">{[item.metadata.organization, item.metadata.project, item.metadata.location].filter(Boolean).join(' · ')}</p>}<div className="testimonial-author">{item.image_url ? <img className="author-avatar" src={item.image_url} alt="" width="60" height="60" /> : <span className="author-avatar">{(item.metadata?.author || item.title || 'C').slice(0, 1)}</span>}<div><strong>{item.metadata?.author || item.title || 'Client name'}</strong>{item.metadata?.role && <span>{item.metadata.role}</span>}</div></div></article></div>
          : <GenericContentPreview item={item} />}
    </section>
  </div>
}

function GenericContentPreview({ item }) {
  if (item.kind === 'services') return <article className="service-card public-card-preview"><div className="service-card-top"><span className="service-icon"><Shield size={21} /></span><span className="card-count">01</span></div><h3>{item.title}</h3><p>{item.summary || 'Service description will appear here.'}</p><div className="card-actions"><span>View details <ArrowUpRight size={16} /></span><span>Enquire <ArrowRight size={15} /></span></div></article>
  if (item.kind === 'team') return <article className="team-card public-card-preview"><div className="team-image"><img src={item.image_url || ''} alt={item.metadata?.image_alt || item.title} /></div><div><span>{item.metadata?.department || item.metadata?.organization || 'Team'}</span><h3>{item.title}</h3>{(item.metadata?.position || item.metadata?.role) && <p>{item.metadata.position || item.metadata.role}</p>}<span className="card-detail-link">View profile <ArrowRight size={15} /></span></div></article>
  if (['products', 'projects', 'news'].includes(item.kind)) return <article className={`${item.kind === 'projects' ? 'work-card' : 'product-card'} public-card-preview`}><div className={item.kind === 'projects' ? 'work-image' : 'product-image'}>{item.image_url && <img src={item.image_url} alt={item.metadata?.image_alt || item.title} />}<span><ArrowUpRight size={19} /></span></div><div className={item.kind === 'projects' ? 'work-copy' : 'product-copy'}><span>{item.metadata?.category || item.metadata?.label || kindLabels[item.kind]}</span><h3>{item.title}</h3><p>{item.summary || 'A short description will appear here.'}</p>{item.metadata?.location && <p className="record-location">{item.metadata.location}</p>}{item.metadata?.price && <p className="record-price">{item.metadata.price}</p>}<span className="card-detail-link">Learn more <ArrowRight size={15} /></span></div></article>
  return <article className={`generic-content-preview ${item.kind === 'homepage' || item.kind === 'about' ? 'generic-page-preview' : ''}`}>{item.image_url && <img src={item.image_url} alt={item.metadata?.image_alt || ''} />}{item.metadata?.eyebrow && <span className="section-kicker">{item.metadata.eyebrow}</span>}<h3>{item.title || 'Content title'}</h3>{item.summary && <p className="preview-summary">{item.summary}</p>}<div>{item.body?.split(/\n{2,}/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div></article>
}

function PartnerPreviewLogo({ item }) {
  return <div className="partner-tile">{item.image_url ? <img src={item.image_url} alt={item.metadata?.image_alt || item.title} /> : <span>{item.title || 'Uploaded partner logo will appear here'}</span>}</div>
}

function SettingsEditor({ settings, busy, onSave }) {
  const pageHeroes = [
    ['services', 'Services'], ['products', 'Products'], ['projects', 'Our work'],
    ['partners', 'Partners'], ['testimonials', 'Client feedback'], ['news', 'News and updates'],
    ['team', 'Our team'], ['contact', 'Contact'],
  ]
  return <form className="editor-card settings-editor" onSubmit={onSave}>
    <div className="editor-heading"><div><span className="admin-label">SITE SETTINGS</span><h2>Company identity, contact and social links</h2></div></div>
    <div className="editor-grid">
      <label>Company name<input name="company_name" defaultValue={settings.company_name || defaultSiteSettings.company_name} maxLength={180} /></label>
      <label>Company logo URL<input name="company_logo_url" type="url" defaultValue={settings.company_logo_url || ''} placeholder="https://…" /></label>
      <label>Upload company logo<input name="company_logo_file" type="file" accept="image/jpeg,image/png,image/webp,image/avif" /></label>
      <label>Business email<input name="business_email" type="email" defaultValue={settings.business_email || defaultSiteSettings.business_email} maxLength={254} /></label>
      <label className="editor-wide">Company description<textarea name="company_description" rows="3" defaultValue={settings.company_description || defaultSiteSettings.company_description} maxLength={800} /></label>
      <label>Telephone<input name="telephone" type="tel" defaultValue={settings.telephone || defaultSiteSettings.telephone} maxLength={40} /></label>
      <label>WhatsApp number<input name="whatsapp_number" type="tel" defaultValue={settings.whatsapp_number || ''} maxLength={40} /></label>
      <label>Office location<input name="office_location" defaultValue={settings.office_location || defaultSiteSettings.office_location} maxLength={240} /></label>
      <label>Business hours<input name="business_hours" defaultValue={settings.business_hours || ''} maxLength={240} /></label>
      <div className="editor-wide cms-field-heading">Page-specific hero images</div>
      {pageHeroes.map(([kind, label]) => <div className="editor-stat editor-wide" key={kind}>
        <label>{label} hero image URL<input name={`hero_${kind}_url`} type="url" defaultValue={settings[`hero_${kind}_url`] || ''} placeholder="https://…" /></label>
        <label>Upload {label.toLowerCase()} hero image<input name={`hero_${kind}_file`} type="file" accept="image/jpeg,image/png,image/webp,image/avif" /></label>
      </div>)}
      {[['facebook_url', 'Facebook'], ['linkedin_url', 'LinkedIn'], ['x_url', 'X'], ['instagram_url', 'Instagram'], ['youtube_url', 'YouTube'], ['tiktok_url', 'TikTok']].map(([name, label]) => <label key={name}>{label} profile URL<input name={name} type="url" defaultValue={settings[name] || ''} placeholder="https://…" /></label>)}
    </div>
    <div className="editor-actions"><button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save settings'} <Check size={16} /></button></div>
  </form>
}

function tabLabel(tab) {
  const labels = {
    overview: 'Overview',
    notifications: 'Notifications',
    profile: 'View profile',
    'add-user': 'Add User',
    admins: 'Admins',
    statistics: 'Website Statistics',
    chat: 'Admin Chat',
    settings: 'Site settings',
    media: 'Media library',
    inquiries: 'Contact enquiries',
  }
  return labels[tab] || kindLabels[tab] || 'Content management'
}

function tabDescription(tab) {
  if (tab === 'overview') return 'A clear view of your website content, enquiries and recent activity.'
  if (tab === 'notifications') return 'Updates and messages for your administrator account.'
  if (tab === 'profile') return 'Review your administrator account details and settings.'
  if (tab === 'add-user') return 'Create a secure account for a team member.'
  if (tab === 'admins') return 'Manage administrator and editor access to your CMS.'
  if (tab === 'statistics') return 'Review actual page views and visitor activity.'
  if (tab === 'chat') return 'Communicate privately with active CMS users.'
  if (tab === 'settings') return 'Update verified public contact information and WhatsApp number.'
  if (tab === 'media') return 'Upload and manage site images.'
  if (tab === 'inquiries') return 'Review messages submitted through the website.'
  return `Create, edit and publish ${kindLabels[tab]?.toLowerCase()} content.`
}

function itemRoute(item) {
  if (item.kind === 'homepage') return '/'
  if (item.kind === 'about') return '/about'
  if (item.kind === 'legal') return item.slug === 'terms' ? '/terms' : '/privacy-policy'
  return `${item.kind === 'news' ? '/news' : `/${item.kind}`}/${item.slug}`
}
