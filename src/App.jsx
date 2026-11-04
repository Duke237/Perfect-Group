import { useEffect, useRef, useState } from 'react'
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck, Building2, Check,
  ChevronLeft, ChevronRight, Clapperboard, CodeXml, GraduationCap, Mail, MapPin,
  Menu, MessageCircle, Network, Phone, Send, ShieldCheck, Sparkles, X,
} from 'lucide-react'
import { FaFacebookF, FaInstagram, FaLinkedinIn, FaTiktok, FaWhatsapp, FaXTwitter, FaYoutube } from 'react-icons/fa6'
import {
  BrowserRouter, Link, NavLink, Outlet, Route, Routes, useLocation, useParams,
} from 'react-router-dom'
import AdminApp from './AdminApp.jsx'
import { defaultSiteSettings, initialContent, kindLabels, primaryNavigation } from './data'
import { isSupabaseConfigured, supabase } from './lib/supabase'

const logoPath = '/logo.png'
const serviceIcons = [ShieldCheck, CodeXml, Network, Building2, Clapperboard, GraduationCap]
const pageHeroImages = {
  about: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1400&q=85',
  services: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&w=1400&q=85',
  products: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=1400&q=85',
  projects: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1400&q=85',
  partners: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1400&q=85',
  testimonials: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1400&q=85',
  news: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1400&q=85',
  team: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1400&q=85',
  contact: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1600&q=85',
}

function SiteProvider() {
  const [content, setContent] = useState(isSupabaseConfigured ? [] : initialContent)
  const [siteSettings, setSiteSettings] = useState({})
  const [advertisements, setAdvertisements] = useState([])
  const [contentError, setContentError] = useState(false)
  const [contentLoading, setContentLoading] = useState(isSupabaseConfigured)
  const [contentRetry, setContentRetry] = useState(0)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true
    setContentLoading(true)
    Promise.all([
      supabase.from('content_items').select('*').eq('status', 'published'),
      supabase.from('site_settings').select('settings').eq('id', 'global').maybeSingle(),
      supabase.from('advertisements').select('id,title,description,image_url,destination_url,placement').in('status', ['published', 'scheduled']).order('created_at', { ascending: false }),
    ]).then(([contentResult, settingsResult, adsResult]) => {
      if (!active) return
      if (contentResult.error || settingsResult.error) {
        setContentError(true)
        return
      }
      setContent(contentResult.data || [])
      setSiteSettings(settingsResult.data?.settings || {})
      setContentError(false)
      if (adsResult.error) {
        console.error(`Public advertisements could not be loaded: ${adsResult.error.message}`)
      } else setAdvertisements(adsResult.data || [])
    }).catch(() => {
      if (active) setContentError(true)
    }).finally(() => {
      if (active) setContentLoading(false)
    })
    return () => { active = false }
  }, [contentRetry])

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined
    let active = true
    const syncPublishedContent = async () => {
      try {
        const [contentResult, settingsResult, adsResult] = await Promise.all([
          supabase.from('content_items').select('*').eq('status', 'published'),
          supabase.from('site_settings').select('settings').eq('id', 'global').maybeSingle(),
          supabase.from('advertisements').select('id,title,description,image_url,destination_url,placement').in('status', ['published', 'scheduled']).order('created_at', { ascending: false }),
        ])
        if (!active) return
        if (contentResult.error || settingsResult.error) {
          setContentError(true)
          return
        }
        setContent(contentResult.data || [])
        setSiteSettings(settingsResult.data?.settings || {})
        setContentError(false)
        if (adsResult.error) {
          console.error(`Public advertisements could not be refreshed: ${adsResult.error.message}`)
        } else setAdvertisements(adsResult.data || [])
      } catch {
        if (active) setContentError(true)
      }
    }
    const channel = supabase.channel('published-site-content')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'content_items' }, syncPublishedContent)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_settings' }, syncPublishedContent)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'advertisements' }, syncPublishedContent)
      .subscribe()
    window.addEventListener('again:content-updated', syncPublishedContent)
    window.addEventListener('again:advertisements-updated', syncPublishedContent)
    return () => {
      active = false
      window.removeEventListener('again:content-updated', syncPublishedContent)
      window.removeEventListener('again:advertisements-updated', syncPublishedContent)
      supabase.removeChannel(channel)
    }
  }, [])

  const refreshContent = async () => {
    if (!isSupabaseConfigured) return
    const [{ data, error }, settingsResponse, adsResponse] = await Promise.all([
      supabase.from('content_items').select('*').eq('status', 'published'),
      supabase.from('site_settings').select('settings').eq('id', 'global').maybeSingle(),
      supabase.from('advertisements').select('id,title,description,image_url,destination_url,placement').in('status', ['published', 'scheduled']).order('created_at', { ascending: false }),
    ])
    if (error || settingsResponse.error) throw new Error('Website content could not be refreshed.')
    setContent(data || [])
    setSiteSettings(settingsResponse.data?.settings || {})
    if (adsResponse.error) {
      console.error(`Public advertisements could not be refreshed: ${adsResponse.error.message}`)
    } else setAdvertisements(adsResponse.data || [])
  }

  const publicSettings = {
    ...defaultSiteSettings,
    ...siteSettings,
    company_name: siteSettings.company_name || defaultSiteSettings.company_name,
    company_description: siteSettings.company_description || defaultSiteSettings.company_description,
    office_location: siteSettings.office_location || defaultSiteSettings.office_location,
    business_email: siteSettings.business_email || defaultSiteSettings.business_email,
    telephone: siteSettings.telephone || defaultSiteSettings.telephone,
  }
  return <><PageViewTracker />{contentLoading && <div className="system-notice" role="status">Loading published website content…</div>}{contentError && <div className="system-notice" role="status"><span>Website content is temporarily unavailable.</span><button type="button" onClick={() => setContentRetry((retry) => retry + 1)} disabled={contentLoading}>{contentLoading ? 'Retrying…' : 'Retry'}</button></div>}<ContentRouter content={content} settings={publicSettings} advertisements={advertisements} refreshContent={refreshContent} /></>
}

function PageViewTracker() {
  const { pathname } = useLocation()
  const lastPath = useRef('')

  useEffect(() => {
    if (!isSupabaseConfigured || pathname.startsWith('/admin') || lastPath.current === pathname) return
    lastPath.current = pathname
    let visitorId
    try {
      visitorId = sessionStorage.getItem('again:analytics-visitor')
      if (!visitorId) {
        visitorId = crypto.randomUUID()
        sessionStorage.setItem('again:analytics-visitor', visitorId)
      }
    } catch (error) {
      console.error('Anonymous page-view tracking could not access session storage.', error)
      return
    }
    supabase.from('website_page_views').insert({ visitor_id: visitorId, path: pathname })
      .then(({ error }) => {
        if (error) console.error(`Anonymous page-view tracking failed: ${error.message}`)
      })
      .catch((error) => console.error('Anonymous page-view tracking failed.', error))
  }, [pathname])

  return null
}

function Footer({ settings, content }) {
  const socialProfiles = [
    ['facebook_url', 'Facebook', FaFacebookF], ['linkedin_url', 'LinkedIn', FaLinkedinIn],
    ['instagram_url', 'Instagram', FaInstagram], ['x_url', 'X', FaXTwitter], ['youtube_url', 'YouTube', FaYoutube],
  ].map(([key, label, Icon]) => ({ label, Icon, href: validWebsiteUrl(settings[key]) }))
  const services = published(content, 'services')
  const serviceLinks = [
    { label: 'CCTV & Surveillance', terms: ['cctv', 'surveillance', 'security camera'] },
    { label: 'Networking & IT Infrastructure', terms: ['network', 'it infrastructure', 'infrastructure'] },
    { label: 'Website Development', terms: ['website development', 'web development', 'website'] },
    { label: 'Software & Mobile App Development', terms: ['software', 'mobile app', 'application development'] },
    { label: 'Solar & Electrical Solutions', terms: ['solar', 'electrical'] },
    { label: 'Building & Construction', terms: ['building', 'construction'] },
  ].map(({ label, terms }) => {
    const match = services.find((service) => {
      const searchable = `${service.title || ''} ${service.slug || ''}`.toLowerCase()
      return terms.some((term) => searchable.includes(term))
    })
    return { label, to: match?.slug ? `/services/${encodeURIComponent(match.slug)}` : '/services' }
  })
  const companyName = settings.company_name || 'Again'
  const companyLogo = validWebsiteUrl(settings.company_logo_url) || logoPath
  return <footer className="site-footer">
    <div className="footer-columns">
      <div className="footer-company"><Link to="/" className="footer-brand"><img src={companyLogo} alt={companyName} /></Link><p>{settings.company_description || ''}</p>{settings.office_location && <p className="footer-location">{settings.office_location}</p>}</div>
      <div className="footer-column"><h2>Explore</h2><Link to="/">Home</Link><Link to="/about">About Us</Link><Link to="/services">Services</Link><Link to="/products">Products</Link><Link to="/projects">Our Work</Link><Link to="/contact">Contact Us</Link></div>
      <div className="footer-column footer-services"><h2>Services</h2>{serviceLinks.map(({ label, to }) => <Link key={label} to={to}>{label}</Link>)}</div>
      <div className="footer-column"><h2>Contact</h2>{settings.telephone && <a href={`tel:${settings.telephone.replace(/[^\d+]/g, '')}`}>{settings.telephone}</a>}{settings.business_email && <a href={`mailto:${settings.business_email}`}>{settings.business_email}</a>}{settings.business_hours && <span>{settings.business_hours}</span>}{settings.office_location && <span>{settings.office_location}</span>}</div>
    </div>
    <div className="footer-meta"><nav className="footer-socials" aria-label="Social media">{socialProfiles.map(({ label, Icon, href }) => href ? <a href={href} key={label} aria-label={label} title={label} target="_blank" rel="noopener noreferrer"><Icon size={16} aria-hidden="true" /></a> : <span className="footer-social-unconfigured" key={label} aria-label={`${label} profile URL not configured`} title={`${label} profile URL can be set in dashboard site settings`}><Icon size={16} aria-hidden="true" /></span>)}</nav><nav className="footer-nav" aria-label="Company links"><Link to="/partners">Partners</Link><Link to="/testimonials">Client Feedback</Link><Link to="/news">News &amp; Updates</Link><Link to="/team">Our Team</Link><Link to="/privacy-policy">Privacy Policy</Link><Link to="/terms">Terms and Conditions</Link></nav></div>
    <div className="footer-bottom"><span>© 2021 Perfect group. All rights reserved.</span></div>
  </footer>
}

function AdPlacement({ advertisements = [], placement }) {
  const items = advertisements.filter((advertisement) => advertisement.placement === placement && validWebsiteUrl(advertisement.destination_url) && validWebsiteUrl(advertisement.image_url))
  if (!items.length) return null
  return <section className={`public-ad-placement public-ad-${placement}`} aria-label="Sponsored advertisements">
    {items.map((advertisement) => <a className="public-ad-card" href={advertisement.destination_url} key={advertisement.id} target="_blank" rel="noopener noreferrer">
      <img src={advertisement.image_url} alt={advertisement.title} loading="lazy" />
      <span className="public-ad-copy"><small>Advertisement</small><strong>{advertisement.title}</strong>{advertisement.description && <span>{advertisement.description}</span>}</span>
      <ArrowUpRight size={17} aria-hidden="true" />
    </a>)}
  </section>
}

function ContentRouter({ content, settings, advertisements, refreshContent }) {
  return <>
    <Routes>
      <Route path="/admin/*" element={<AdminApp />} />
      <Route element={<PublicLayout settings={settings} content={content} advertisements={advertisements} />}>
        <Route path="/" element={<HomePage content={content} settings={settings} advertisements={advertisements} />} />
        <Route path="/about" element={<AboutPage content={content} settings={settings} />} />
        <Route path="/team" element={<ListingPage kind="team" content={content} settings={settings} />} />
        <Route path="/team/:slug" element={<DetailPage kind="team" content={content} settings={settings} />} />
        <Route path="/services" element={<ListingPage kind="services" content={content} settings={settings} />} />
        <Route path="/services/:slug" element={<DetailPage kind="services" content={content} settings={settings} />} />
        <Route path="/products" element={<ListingPage kind="products" content={content} settings={settings} />} />
        <Route path="/products/:slug" element={<DetailPage kind="products" content={content} settings={settings} />} />
        <Route path="/projects" element={<ListingPage kind="projects" content={content} settings={settings} />} />
        <Route path="/projects/:slug" element={<DetailPage kind="projects" content={content} settings={settings} />} />
        <Route path="/contact" element={<ContactPage content={content} settings={settings} refreshContent={refreshContent} />} />
        <Route path="/partners" element={<ListingPage kind="partners" content={content} settings={settings} />} />
        <Route path="/partners/:slug" element={<DetailPage kind="partners" content={content} settings={settings} />} />
        <Route path="/testimonials" element={<ListingPage kind="testimonials" content={content} settings={settings} />} />
        <Route path="/news" element={<ListingPage kind="news" content={content} settings={settings} />} />
        <Route path="/news/:slug" element={<DetailPage kind="news" content={content} settings={settings} />} />
        <Route path="/privacy-policy" element={<LegalPage slug="privacy-policy" content={content} />} />
        <Route path="/terms" element={<LegalPage slug="terms" content={content} />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  </>
}

function PublicLayout({ settings, content, advertisements }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const whatsApp = settings.whatsapp_number || import.meta.env.VITE_WHATSAPP_NUMBER || ''
  const companyLogo = validWebsiteUrl(settings.company_logo_url) || logoPath
  const whatsappUrl = makeWhatsAppUrl(whatsApp, 'Hello Again, I would like to learn more about your services.')
  useEffect(() => {
    setMobileOpen(false)
    window.scrollTo(0, 0)
  }, [location.pathname])
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return undefined
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        }
      })
    }, { threshold: 0.12, rootMargin: '0px 0px -35px 0px' })
    document.querySelectorAll('main .scroll-reveal').forEach((element) => {
      element.classList.add('will-reveal')
      observer.observe(element)
    })
    return () => observer.disconnect()
  }, [location.pathname, content])
  return <>
    <header className="site-header">
      <Link to="/" className="brand" aria-label={`${settings.company_name || 'Again'} home`}><img src={companyLogo} alt={settings.company_name || 'Again'} /></Link>
      <button className="mobile-menu-button" aria-label={mobileOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileOpen} onClick={() => setMobileOpen(!mobileOpen)}>{mobileOpen ? <X size={22} /> : <Menu size={22} />}</button>
      <nav className={mobileOpen ? 'main-nav is-open' : 'main-nav'} aria-label="Main navigation">
        {primaryNavigation.map(({ label, path }, index) => <NavLink key={path} to={path} end={path === '/'} className={({ isActive }) => `${index === 5 ? 'nav-contact ' : ''}${isActive ? 'active' : ''}`}>{label}</NavLink>)}
      </nav>
    </header>
    <AdPlacement advertisements={advertisements} placement="site_top" />
    <main><Outlet /></main>
    <AdPlacement advertisements={advertisements} placement="site_footer" />
    <Footer settings={settings} content={content} />
    {whatsApp && <a className="whatsapp-fab" href={whatsappUrl} target="_blank" rel="noreferrer" aria-label="Contact Again on WhatsApp"><FaWhatsapp size={21} /><span>Chat with us</span></a>}
  </>
}

function PageMeta({ title, description, image }) {
  useEffect(() => {
    const descriptionElement = document.querySelector('meta[name="description"]')
    const previousDescription = descriptionElement?.content
    document.title = 'P.G'
    if (descriptionElement && description) descriptionElement.content = description.slice(0, 300)
    let canonical = document.querySelector('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = `${window.location.origin}${window.location.pathname}`
    return () => {
      document.title = 'P.G'
      if (descriptionElement && previousDescription) descriptionElement.content = previousDescription
    }
  }, [title, description, image])
  return null
}

function ContentLink({ item, kind, children, className }) {
  const path = `${kindPath(kind)}/${item.slug}`
  return <Link to={path} className={className}>{children}</Link>
}

function HomePage({ content, settings, advertisements }) {
  const home = published(content, 'homepage')[0] || initialContent[0]
  const about = published(content, 'about')[0] || initialContent[1]
  const featured = (kind) => published(content, kind)
    .filter((item) => item.metadata?.homepage !== false)
    .sort((left, right) => (Number(left.metadata?.display_order) || 0) - (Number(right.metadata?.display_order) || 0))
  const services = featured('services').slice(0, 3)
  const products = featured('products').slice(0, 3)
  const projects = featured('projects').slice(0, 2)
  const news = featured('news').slice(0, 3)
  const partners = published(content, 'partners')
    .filter((item) => item.image_url && item.metadata?.homepage !== false)
    .sort((left, right) => (Number(left.metadata?.display_order) || 0) - (Number(right.metadata?.display_order) || 0))
    .slice(0, 8)
  const testimonials = published(content, 'testimonials')
    .filter((item) => item.metadata?.homepage !== false && (item.metadata?.author || item.title) && (item.body || item.summary))
    .sort((left, right) => (Number(left.metadata?.display_order) || 0) - (Number(right.metadata?.display_order) || 0))
  return <>
    <PageMeta title={home.seo_title || home.title} description={home.seo_description || home.summary} />
    <section className="hero-section" id="home">
      <div className="hero-copy"><div className="eyebrow"><span />{home.metadata?.eyebrow || 'Technology. Infrastructure. Creativity.'}</div><h1>{home.title}</h1><p className="hero-lede">{home.summary}</p><div className="hero-actions"><Link className="button button-primary" to="/services">{home.metadata?.cta || 'Explore our services'} <ArrowRight size={17} /></Link><Link className="text-link" to="/about">Discover Again <ArrowUpRight size={17} /></Link></div>{home.metadata?.hero_proof_title && <div className="hero-proof"><div className="proof-mark"><BadgeCheck size={19} /></div><div><strong>{home.metadata.hero_proof_title}</strong>{home.metadata.hero_proof_text && <span>{home.metadata.hero_proof_text}</span>}</div></div>}</div>
      <div className="hero-visual"><img src={home.image_url} alt={home.metadata?.image_alt || home.title} />{home.metadata?.image_caption && <div className="hero-caption"><span className="caption-dot" />{home.metadata.image_caption}</div>}<div className="hero-index">01 <span>/</span> 04</div><Link className="hero-scroll" to="/about" aria-label="Discover Again"><ArrowDown size={17} /></Link></div>
    </section>
    <AdPlacement advertisements={advertisements} placement="homepage_banner" />
    {partners.length > 0 ? <PartnerStrip partners={partners} /> : <section className="partner-strip partner-strip-empty scroll-reveal"><div className="partner-strip-heading"><span className="section-kicker">Trusted Partners &amp; Collaborators</span><p>Building strong partnerships to deliver reliable solutions.</p></div></section>}
    {projects.length > 0 && <PreviewSection title="Our Work in" emphasis="Action" label="Selected projects" path="/projects" content={projects} kind="projects" />}
    <AdPlacement advertisements={advertisements} placement="homepage_featured" />
    <section className="intro-section section-wrap scroll-reveal"><div className="section-kicker">Company overview <span>01</span></div><div className="intro-grid"><div><h2>{home.metadata?.overview_heading || about.title}</h2>{about.image_url && <img className="overview-image" src={about.image_url} alt={about.metadata?.image_alt || about.title} loading="lazy" />}</div><div className="intro-text"><p>{home.metadata?.overview_text || about.summary}</p><p>{about.body}</p><Link className="underlined-link" to="/about">More about {settings.company_name || 'Again'} <ArrowRight size={16} /></Link></div></div>{home.metadata?.statistic_values?.length > 0 && <div className="stats-row">{home.metadata.statistic_values.map((stat) => <div key={`${stat.value}-${stat.label}`}><AnimatedStatistic value={stat.value} /><span>{stat.label}</span></div>)}</div>}</section>
    <ManagedListSection title="Industries and sectors" items={home.metadata?.industries} variant="sectors" />
    {services.length > 0 && <PreviewSection title="More than a service." emphasis="A way forward." label="What we do" path="/services" content={services} kind="services" dark />}
    {products.length > 0 && <PreviewSection title="Good tools make" emphasis="great work possible." label="Products & procurement" path="/products" content={products} kind="products" />}
    <ManagedListSection title="Why work with us" items={home.metadata?.strengths} variant="strengths" />
    <ManagedListSection title="Our process" items={home.metadata?.process} variant="process" />
    <ManagedListSection title="Technology and expertise" items={home.metadata?.expertise} variant="expertise" />
    {news.length > 0 && <PreviewSection title="Updates from Again" emphasis="What's happening." label="News & updates" path="/news" content={news} kind="news" />}
    {testimonials.length > 0 && <TestimonialCarousel items={testimonials} />}
    {testimonials.length === 0 && <section className="testimonial-showcase testimonial-empty"><div className="section-wrap"><span className="section-kicker">Client feedback</span><p>Testimonials appear here only after client identities and statements are approved for publication.</p></div></section>}
    <ContactCta image={pageHeroImageFor(settings, 'contact')} whatsapp={settings.whatsapp_number || import.meta.env.VITE_WHATSAPP_NUMBER || ''} />
  </>
}

function AnimatedStatistic({ value }) {
  const [displayValue, setDisplayValue] = useState(value)
  const element = useRef(null)

  useEffect(() => {
    const match = String(value).match(/^(\D*)([\d,]+)(\D*)$/)
    if (!match) {
      setDisplayValue(value)
      return undefined
    }
    const target = Number(match[2].replace(/,/g, ''))
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!Number.isFinite(target) || reducedMotion || !('IntersectionObserver' in window)) {
      setDisplayValue(value)
      return undefined
    }
    setDisplayValue(`${match[1]}0${match[3]}`)
    let frame
    let observer
    observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      observer.disconnect()
      const start = performance.now()
      const duration = 1100
      const animate = (now) => {
        const progress = Math.min((now - start) / duration, 1)
        const count = Math.round(target * (1 - (1 - progress) ** 3))
        setDisplayValue(`${match[1]}${count.toLocaleString()}${match[3]}`)
        if (progress < 1) frame = requestAnimationFrame(animate)
      }
      frame = requestAnimationFrame(animate)
    }, { threshold: 0.6 })
    if (element.current) observer.observe(element.current)
    return () => {
      observer?.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [value])

  return <strong ref={element}>{displayValue}</strong>
}

function ManagedListSection({ title, items = [], variant }) {
  if (!items.length) return null
  return <section className={`managed-list-section managed-${variant} scroll-reveal`}><div className="section-wrap"><span className="section-kicker">{title}</span><div className="managed-list-grid">{items.map((item, index) => <article key={`${item}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><h3>{item}</h3></article>)}</div></div></section>
}

function PreviewSection({ title, emphasis, label, path, content, kind, dark = false }) {
  return <section className={`${dark ? 'services-section preview-section' : 'products-section section-wrap preview-section'} scroll-reveal`}>
    <div className={dark ? 'section-wrap' : ''}><div className={`section-kicker ${dark ? 'light-kicker' : ''}`}>{label}<span>→</span></div><div className="section-heading-row"><h2>{title}<br /><em>{emphasis}</em></h2><Link className={dark ? 'button button-light' : 'underlined-link'} to={path}>Explore {kindLabels[kind].toLowerCase()} <ArrowRight size={16} /></Link></div><div className={kind === 'services' ? 'services-grid' : 'products-grid'}>{content.map((item, index) => <ContentCard key={item.id} item={item} kind={kind} index={index} />)}</div></div>
  </section>
}

function AboutPage({ content, settings }) {
  const about = published(content, 'about')[0] || initialContent.find((item) => item.kind === 'about')
  const services = published(content, 'services').slice(0, 4)
  const team = published(content, 'team').sort((left, right) => (Number(left.metadata?.display_order) || 0) - (Number(right.metadata?.display_order) || 0)).slice(0, 4)
  if (!about) return <EmptyPage title="About Again" message="Company information has not been published yet." />
  return <>
    <PageMeta title={about.seo_title || about.title} description={about.seo_description || about.summary} />
    <PageHero eyebrow="About Again" title={about.title} summary={about.summary} image={validWebsiteUrl(settings.hero_about_url) || about.image_url || pageHeroImages.about} alt={about.metadata?.image_alt} />
    <section className="section-wrap detail-body"><div><span className="section-kicker">Who we are</span><div className="rich-copy">{renderParagraphs(about.body)}</div></div>{(about.metadata?.mission || about.metadata?.vision) && <div className="values-grid">{about.metadata.mission && <article><h2>Our mission</h2><p>{about.metadata.mission}</p></article>}{about.metadata.vision && <article><h2>Our vision</h2><p>{about.metadata.vision}</p></article>}</div>}{about.metadata?.values && <article className="rich-copy"><h2>Our values</h2>{renderParagraphs(about.metadata.values)}</article>}</section>
    {about.metadata?.history && <section className="section-wrap history-section"><span className="section-kicker">Our history</span><div className="rich-copy">{renderParagraphs(about.metadata.history)}</div></section>}
    <ManagedListSection title="Areas of expertise" items={about.metadata?.expertise} variant="expertise" />
    <ManagedListSection title="Industries served" items={about.metadata?.industries} variant="sectors" />
    {team.length > 0 && <section className="team-section section-wrap"><div className="section-heading-row dark-heading"><h2>Our team</h2><Link className="underlined-link" to="/team">Meet the team <ArrowRight size={16} /></Link></div><div className="team-grid">{team.map((item) => <ContentCard key={item.id} item={item} kind="team" />)}</div></section>}
    {services.length > 0 && <RelatedSection title="What we do" kind="services" content={services} />}
    <ContactCta image={pageHeroImageFor(settings, 'contact')} whatsapp={settings.whatsapp_number || import.meta.env.VITE_WHATSAPP_NUMBER || ''} />
  </>
}

function ListingPage({ kind, content, settings }) {
  const records = published(content, kind)
    .filter((item) => kind !== 'partners' || item.image_url)
    .sort((left, right) => (Number(left.metadata?.display_order) || 0) - (Number(right.metadata?.display_order) || 0))
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [sort, setSort] = useState('order')
  const [page, setPage] = useState(1)
  const title = kindLabels[kind]
  const filtered = records.filter((item) => {
    const matchesQuery = `${item.title} ${item.summary} ${item.body} ${item.metadata?.category || ''} ${item.metadata?.location || ''}`.toLowerCase().includes(query.toLowerCase())
    const matchesCategory = category === 'All' || item.metadata?.category === category
    return matchesQuery && matchesCategory
  })
  const sorted = [...filtered].sort((left, right) => sort === 'title'
    ? left.title.localeCompare(right.title)
    : sort === 'newest'
      ? new Date(right.created_at || 0) - new Date(left.created_at || 0)
      : (Number(left.metadata?.display_order) || 0) - (Number(right.metadata?.display_order) || 0))
  const pageSize = 9
  const pageCount = Math.ceil(sorted.length / pageSize)
  const visible = sorted.slice((page - 1) * pageSize, page * pageSize)
  const categories = ['All', ...new Set(records.map((item) => item.metadata?.category).filter(Boolean))]
  const details = {
    services: ['Find the right expertise for the job.', 'Explore our services and learn how our team can support your requirements.'],
    products: ['Equipment for work that matters.', 'Browse published products and contact us for current pricing and availability.'],
    projects: ['Real work, shared with permission.', 'Explore the projects Again has chosen to publish.'],
    partners: ['Better outcomes, built together.', 'Meet our published partners and collaborators.'],
    testimonials: ['Feedback from our clients.', 'Read customer feedback that has been approved for publication.'],
    news: ['News, training & updates.', 'Company announcements, training programs and technical articles.'],
    team: ['Meet the people behind the work.', 'Published team profiles and professional areas of responsibility.'],
  }[kind]
  return <>
    <PageMeta title={title} description={details[1]} />
    <PageHero eyebrow={title} title={details[0]} summary={details[1]} image={pageHeroImageFor(settings, kind)} />
    <section className="listing-section section-wrap scroll-reveal">
      <div className="listing-toolbar"><label className="search-field">Search {title.toLowerCase()}<input type="search" placeholder={`Search ${title.toLowerCase()}…`} value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} /></label>{categories.length > 1 && <label className="filter-field">Category<select value={category} onChange={(event) => { setCategory(event.target.value); setPage(1) }}>{categories.map((value) => <option key={value}>{value}</option>)}</select></label>}<label className="sort-field">Sort by<select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1) }}><option value="order">Display order</option><option value="title">Name A–Z</option><option value="newest">Recently added</option></select></label></div>
      {visible.length ? <><div className={kind === 'services' ? 'listing-grid services-grid' : kind === 'team' ? 'listing-grid team-grid' : 'listing-grid products-grid'}>{visible.map((item, index) => <ContentCard key={item.id} item={item} kind={kind} index={(page - 1) * pageSize + index} />)}</div>{pageCount > 1 && <nav className="listing-pagination" aria-label={`${title} pages`}><button type="button" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {page} of {pageCount}</span><button type="button" disabled={page === pageCount} onClick={() => setPage((current) => current + 1)}>Next</button></nav>}</> : <p className="empty-state">{records.length ? 'No items match your search.' : `No ${title.toLowerCase()} have been published yet.`}</p>}
    </section>
    {kind === 'services' && <div className="section-wrap listing-cta"><Link className="button button-primary" to="/contact">Tell us what you need <ArrowRight size={16} /></Link></div>}
  </>
}

function ContentCard({ item, kind, index = 0, compact = false }) {
  if (kind === 'testimonials') return <TestimonialCard item={item} />
  if (kind === 'partners') return <article className="published-partner-card"><PartnerLogo item={item} /><div><h3>{item.title}</h3>{item.summary && <p>{item.summary}</p>}<ContentLink item={item} kind={kind} className="card-detail-link">Partner details <ArrowRight size={15} /></ContentLink></div></article>
  if (kind === 'team') return <article className="team-card"><Link to={`/team/${item.slug}`} className="team-image" aria-label={`View ${item.title}'s profile`}><img src={item.image_url || fallbackImage(kind)} alt={item.metadata?.image_alt || item.title} loading="lazy" /></Link><div><span>{item.metadata?.department || item.metadata?.organization || 'Team'}</span><h3><Link to={`/team/${item.slug}`}>{item.title}</Link></h3>{(item.metadata?.position || item.metadata?.role) && <p>{item.metadata.position || item.metadata.role}</p>}<Link className="card-detail-link" to={`/team/${item.slug}`}>View profile <ArrowRight size={15} /></Link></div></article>
  const Icon = serviceIcons[index % serviceIcons.length]
  const path = kindPath(kind)
  if (kind === 'services') return <article className="service-card"><div className="service-card-top"><span className="service-icon"><Icon size={21} strokeWidth={1.7} /></span><span className="card-count">{String(index + 1).padStart(2, '0')}</span></div><h3>{item.title}</h3><p>{item.summary}</p><div className="card-actions"><Link to={`${path}/${item.slug}`}>View details <ArrowUpRight size={16} /></Link><Link to={`/contact?service=${encodeURIComponent(item.title)}`}>Enquire <ArrowRight size={15} /></Link></div></article>
  return <article className={`${kind === 'projects' ? 'work-card' : 'product-card'} ${compact ? 'compact-card' : ''}`}>
    <Link className={kind === 'projects' ? 'work-image' : 'product-image'} to={`${path}/${item.slug}`} aria-label={`View ${item.title}`}><img src={item.image_url || fallbackImage(kind)} alt={item.metadata?.image_alt || item.title} loading="lazy" /><span><ArrowUpRight size={19} /></span></Link>
    <div className={kind === 'projects' ? 'work-copy' : 'product-copy'}><span>{item.metadata?.category || item.metadata?.label || (kind === 'projects' ? 'Project' : 'Product')}</span><h3><Link to={`${path}/${item.slug}`}>{item.title}</Link></h3><p>{item.summary}</p>{kind === 'projects' && item.metadata?.location && <p className="record-location">{item.metadata.location}</p>}{item.metadata?.price && <p className="record-price">{item.metadata.price}</p>}{!compact && <Link className="card-detail-link" to={`${path}/${item.slug}`}>{kind === 'projects' ? 'View project' : kind === 'news' ? 'Read article' : kind === 'products' ? 'View product' : 'Learn more'} <ArrowRight size={15} /></Link>}</div>
  </article>
}

function DetailPage({ kind, content, settings }) {
  const { slug } = useParams()
  const item = published(content, kind).find((record) => record.slug === slug)
  if (!item) return <NotFoundPage />
  const route = kindPath(kind)
  const relatedSlugs = item.metadata?.related_slugs || []
  const relatedRecords = content.filter((record) => isPublicContent(record) && relatedSlugs.includes(record.slug))
  const relatedServices = relatedRecords.filter((record) => record.kind === 'services')
  const relatedProducts = relatedRecords.filter((record) => record.kind === 'products')
  const relatedProjects = relatedRecords.filter((record) => record.kind === 'projects')
  const whatsApp = settings.whatsapp_number || import.meta.env.VITE_WHATSAPP_NUMBER || ''
  return <>
    <PageMeta title={item.seo_title || item.title} description={item.seo_description || item.summary} image={item.image_url} />
    <div className="detail-back section-wrap"><Link to={route}><ArrowLeft size={16} /> All {kindLabels[kind].toLowerCase()}</Link></div>
    <PageHero eyebrow={item.metadata?.category || kindLabels[kind]} title={item.title} summary={item.summary} image={item.image_url || pageHeroImageFor(settings, kind)} alt={item.metadata?.image_alt} />
    {kind === 'products' && <div className="section-wrap product-facts">{item.metadata?.category && <span>Category: {item.metadata.category}</span>}{item.metadata?.price ? <strong>{item.metadata.price}</strong> : <strong>Request a quote</strong>}{item.metadata?.availability && <span>{item.metadata.availability}</span>}</div>}
    {kind === 'projects' && <div className="section-wrap project-date">{item.metadata?.location && <span>Location: {item.metadata.location}</span>}{item.metadata?.completed_date && <span>Completed: {item.metadata.completed_date}</span>}{item.metadata?.client && <span>Client: {item.metadata.client}</span>}</div>}
    {kind === 'team' && <div className="section-wrap product-facts">{(item.metadata?.position || item.metadata?.role) && <span>{item.metadata.position || item.metadata.role}</span>}{(item.metadata?.department || item.metadata?.organization) && <span>{item.metadata.department || item.metadata.organization}</span>}{item.metadata?.email && <a href={`mailto:${item.metadata.email}`}>{item.metadata.email}</a>}{validWebsiteUrl(item.metadata?.website_url) && <a href={validWebsiteUrl(item.metadata.website_url)} target="_blank" rel="noreferrer">Professional profile</a>}</div>}
    <section className="section-wrap detail-body"><div className="rich-copy">{renderParagraphs(item.body)}</div>{item.metadata?.scope && <article className="rich-copy"><h2>{kind === 'services' ? 'What this service includes' : 'Scope of work'}</h2>{renderParagraphs(item.metadata.scope)}</article>}{item.metadata?.challenge && <article className="rich-copy"><h2>Challenge or requirement</h2>{renderParagraphs(item.metadata.challenge)}</article>}{item.metadata?.solution && <article className="rich-copy"><h2>Solution provided</h2>{renderParagraphs(item.metadata.solution)}</article>}{item.metadata?.technologies && <article className="rich-copy"><h2>Technologies and equipment</h2>{renderParagraphs(item.metadata.technologies)}</article>}{item.metadata?.specifications && <article className="rich-copy"><h2>Specifications</h2>{renderParagraphs(item.metadata.specifications)}</article>}{(item.metadata?.benefits?.length > 0 || item.metadata?.applications?.length > 0 || item.metadata?.skills || item.metadata?.responsibilities) && <div className="values-grid">{item.metadata?.benefits?.length > 0 && <article><h2>{kind === 'services' ? 'Benefits' : 'Features'}</h2><ul>{item.metadata.benefits.map((value) => <li key={value}>{value}</li>)}</ul></article>}{item.metadata?.applications?.length > 0 && <article><h2>Applications</h2><ul>{item.metadata.applications.map((value) => <li key={value}>{value}</li>)}</ul></article>}{item.metadata?.skills && <article><h2>Skills and expertise</h2>{renderParagraphs(item.metadata.skills)}</article>}{item.metadata?.responsibilities && <article><h2>Responsibilities</h2>{renderParagraphs(item.metadata.responsibilities)}</article>}</div>}{item.metadata?.document_url && validWebsiteUrl(item.metadata.document_url) && <a className="underlined-link" href={validWebsiteUrl(item.metadata.document_url)} target="_blank" rel="noreferrer">Download product document <ArrowUpRight size={16} /></a>}{Array.isArray(item.metadata?.gallery) && item.metadata.gallery.length > 0 && <div className="detail-gallery">{item.metadata.gallery.map((image, index) => <img src={image.url} alt={image.alt || `${item.title} photo ${index + 1}`} key={`${image.url}-${index}`} loading="lazy" />)}</div>}{item.metadata?.faq?.length > 0 && <section className="faq-section"><h2>Frequently asked questions</h2>{item.metadata.faq.map((faq) => <details key={faq.question}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</section>}</section>
    {kind === 'services' && <ManagedListSection title="How we deliver this service" items={item.metadata?.process} variant="process" />}
    {kind === 'services' && <ManagedListSection title="Industries served" items={item.metadata?.industries} variant="sectors" />}
    {relatedServices.length > 0 && <RelatedSection title="Related services" kind="services" content={relatedServices} />}
    {relatedProducts.length > 0 && <RelatedSection title="Related products" kind="products" content={relatedProducts} />}
    {relatedProjects.length > 0 && <RelatedSection title="Related projects" kind="projects" content={relatedProjects} />}
    <ContactCta title={kind === 'services' ? `Ask us about ${item.title}` : kind === 'products' ? `Request a quote for ${item.title}` : kind === 'projects' ? 'Discuss a project like this' : undefined} service={kind === 'services' || kind === 'products' ? item.title : undefined} image={pageHeroImageFor(settings, 'contact')} whatsapp={whatsApp} />
  </>
}

function LegalPage({ slug, content }) {
  const record = published(content, 'legal').find((item) => item.slug === slug)
  if (!record) return <EmptyPage title={slug === 'terms' ? 'Terms' : 'Privacy policy'} message="This page has not been published. Please contact Again if you need information." />
  return <><PageMeta title={record.seo_title || record.title} description={record.seo_description || record.summary} /><PageHero eyebrow="Legal" title={record.title} summary={record.summary} /><section className="section-wrap detail-body rich-copy">{renderParagraphs(record.body)}</section></>
}

function ContactPage({ content, settings, refreshContent }) {
  const [state, setState] = useState({ busy: false, success: false, error: '' })
  const services = published(content, 'services')
  const params = new URLSearchParams(window.location.search)
  const serviceParam = params.get('service') || ''
  const selectedService = services.find((service) => service.title === serviceParam)?.title || ''
  async function submitContact(event) {
    event.preventDefault()
    const form = event.currentTarget
    const data = Object.fromEntries(new FormData(form).entries())
    setState({ busy: true, success: false, error: '' })
    if (data.website) {
      setState({ busy: false, success: true, error: '' })
      form.reset()
      return
    }
    if (!isSupabaseConfigured) {
      setState({ busy: false, success: false, error: 'Contact enquiries are not connected yet. Please use the configured contact details or enable Supabase.' })
      return
    }
    try {
      const { error } = await supabase.from('contact_inquiries').insert({
        name: data.name, email: data.email, phone: data.phone || null,
        subject: data.subject || data.service || null, service: data.service || null,
        message: data.message,
      })
      if (error) throw error
      setState({ busy: false, success: true, error: '' })
      form.reset()
    } catch (error) {
      setState({ busy: false, success: false, error: `Your message couldn't be sent: ${error.message || 'A network error occurred.'}` })
    }
  }
  return <>
    <PageMeta title="Contact Us" description="Contact Again to discuss your service, product or project requirements." />
    <PageHero eyebrow="Get in touch" title="Have a challenge? We're listening." summary="Tell us what you have in mind. We'll help you work out a practical next step." image={pageHeroImageFor(settings, 'contact')} cta={false} />
    <section className="section-wrap contact-page-grid"><aside className="contact-page-details"><h2>Contact information</h2>{settings.business_email && <a href={`mailto:${settings.business_email}`}><span><Mail size={17} /></span>{settings.business_email}</a>}{settings.telephone && <a href={`tel:${settings.telephone.replace(/[^\d+]/g, '')}`}><span><Phone size={17} /></span>{settings.telephone}</a>}{settings.office_location && <p><span><MapPin size={17} /></span>{settings.office_location}</p>}{settings.business_hours && <p>{settings.business_hours}</p>}{settings.whatsapp_number && <a target="_blank" rel="noreferrer" href={makeWhatsAppUrl(settings.whatsapp_number, 'Hello Again, I have a question about your services.')}><span><MessageCircle size={17} /></span>Chat on WhatsApp</a>}<ContactSocials settings={settings} /></aside>
      <form className="contact-form contact-form-light" onSubmit={submitContact}><h2>Send an enquiry</h2><label className="honeypot-field" aria-hidden="true">Website<input name="website" tabIndex="-1" autoComplete="off" /></label><div className="form-row"><label>Your name<input name="name" autoComplete="name" required maxLength={120} /></label><label>Email address<input name="email" type="email" autoComplete="email" required maxLength={254} /></label></div><div className="form-row"><label>Phone number <span className="optional">(optional)</span><input name="phone" autoComplete="tel" maxLength={40} /></label><label>Service of interest<select name="service" defaultValue={selectedService}><option value="">Select a service</option>{services.map((service) => <option key={service.id} value={service.title}>{service.title}</option>)}<option value="Something else">Something else</option></select></label></div><label>Subject<input name="subject" maxLength={180} /></label><label>Your message<textarea name="message" rows="5" required minLength={10} maxLength={4000} /></label>{state.error && <p className="form-error" role="alert">{state.error}</p>}{state.success && <p className="form-success" role="status"><Check size={17} /> Thank you. Your enquiry has been received.</p>}<div className="form-submit"><span>Your details are used to respond to your enquiry.</span><button className="button button-primary" type="submit" disabled={state.busy}>{state.busy ? 'Sending…' : 'Send enquiry'} <Send size={16} /></button></div></form></section>
    {settings.office_location && <section className="section-wrap contact-map-wrap"><iframe className="contact-map" title={`Map for ${settings.office_location}`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={`https://www.google.com/maps?q=${encodeURIComponent(settings.office_location)}&output=embed`} /></section>}
  </>
}

function ContactSocials({ settings }) {
  const profiles = [
    ['facebook_url', 'Facebook', FaFacebookF], ['instagram_url', 'Instagram', FaInstagram],
    ['linkedin_url', 'LinkedIn', FaLinkedinIn], ['youtube_url', 'YouTube', FaYoutube], ['tiktok_url', 'TikTok', FaTiktok],
  ].map(([key, label, Icon]) => ({ label, Icon, href: validWebsiteUrl(settings[key]) })).filter((item) => item.href)
  return profiles.length > 0 && <nav className="contact-socials" aria-label="Social media">{profiles.map(({ label, Icon, href }) => <a href={href} key={label} aria-label={label} target="_blank" rel="noreferrer"><Icon size={16} />{label}</a>)}</nav>
}

function ContactCta({ title = "Have a challenge? We're listening.", service, image = pageHeroImages.contact, whatsapp = '' }) {
  return <section className="contact-cta scroll-reveal"><img className="contact-cta-image" src={image} alt="" aria-hidden="true" loading="lazy" /><div className="section-wrap contact-cta-inner"><div><span className="section-kicker light-kicker">Let's Talk</span><h2>{title}</h2><p>Tell us what you have in mind. We'll help you work out a practical next step.</p></div><div className="hero-actions"><Link className="button button-light" to={`/contact${service ? `?service=${encodeURIComponent(service)}` : ''}`}>Contact Us <ArrowRight size={16} /></Link>{whatsapp && <a className="cta-whatsapp" target="_blank" rel="noreferrer" href={makeWhatsAppUrl(whatsapp, `Hello Again, I would like to ask about ${service || 'your services'}.`)}><FaWhatsapp size={18} /> WhatsApp Us</a>}</div></div></section>
}

function PartnerStrip({ partners }) {
  return <section className="partner-strip scroll-reveal" aria-label="Trusted partners and collaborators">
    <div className="partner-strip-heading"><span className="section-kicker">Trusted Partners &amp; Collaborators</span><p>Building strong partnerships to deliver reliable solutions.</p></div>
    <div className="partner-marquee" aria-label="Partner logos">
      <div className="partner-marquee-track">
        {[0, 1].map((copy) => <div className="partner-marquee-group" key={copy} aria-hidden={copy === 1} inert={copy === 1}>
          {partners.map((partner) => <PartnerLogo key={`${partner.id}-${copy}`} item={partner} />)}
        </div>)}
      </div>
    </div>
  </section>
}

function PartnerLogo({ item }) {
  const logo = <img src={item.image_url} alt={item.metadata?.image_alt || item.title} loading="lazy" />
  const website = validWebsiteUrl(item.metadata?.website_url)
  return <div className="partner-tile" title={item.title}>
    {website ? <a href={website} target="_blank" rel="noreferrer" aria-label={`Visit ${item.title} website`}>{logo}</a> : logo}
  </div>
}

function pageHeroImageFor(settings, kind) {
  return validWebsiteUrl(settings[`hero_${kind}_url`]) || pageHeroImages[kind]
}

function validWebsiteUrl(value = '') {
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) ? url.href : ''
  } catch {
    return ''
  }
}

function TestimonialCarousel({ items }) {
  const count = items.length
  const [index, setIndex] = useState(count)
  const [paused, setPaused] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [transitioning, setTransitioning] = useState(true)
  const [manualMotion, setManualMotion] = useState(false)
  const [stepWidth, setStepWidth] = useState(0)
  const viewport = useRef(null)
  const swipeStart = useRef(null)
  const timeout = useRef(null)
  const carouselItems = [...items, ...items, ...items]

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateMotion = () => setReducedMotion(media.matches)
    updateMotion()
    media.addEventListener?.('change', updateMotion)
    return () => media.removeEventListener?.('change', updateMotion)
  }, [])

  useEffect(() => {
    if (!viewport.current) return undefined
    const measure = () => {
      const slide = viewport.current?.querySelector('.testimonial-slide')
      if (!slide) return
      const gap = Number.parseFloat(getComputedStyle(viewport.current).getPropertyValue('--testimonial-gap')) || 0
      setStepWidth(slide.getBoundingClientRect().width + gap)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(viewport.current)
    return () => observer.disconnect()
  }, [count])

  useEffect(() => {
    if (paused || reducedMotion || count < 2) return undefined
    const timer = window.setInterval(() => setIndex((current) => current - 1), 4800)
    return () => window.clearInterval(timer)
  }, [count, paused, reducedMotion])

  useEffect(() => {
    if (index < count || index >= count * 2) {
      const duration = reducedMotion ? 0 : manualMotion ? 500 : 4550
      timeout.current = window.setTimeout(() => {
        setTransitioning(false)
        setIndex((current) => (current < count ? current + count : current - count))
        requestAnimationFrame(() => requestAnimationFrame(() => setTransitioning(true)))
      }, duration)
    }
    return () => window.clearTimeout(timeout.current)
  }, [count, index, reducedMotion])

  const move = (amount) => { setManualMotion(true); setIndex((current) => current + amount) }
  const jumpTo = (target) => { setManualMotion(true); setIndex(count + target) }
  const activeDot = ((index % count) + count) % count

  return <section className="testimonial-showcase scroll-reveal" aria-label="Client testimonials" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false) }}>
    <div className="section-wrap testimonial-showcase-inner">
      <div className="testimonial-showcase-heading"><span className="section-kicker">Client Feedback</span><h2>What Our Clients Say</h2><p>Hear from the people who have experienced our work.</p></div>
      <div className="testimonial-carousel">
        <div className="testimonial-viewport" ref={viewport}
          onTouchStart={(event) => { swipeStart.current = event.changedTouches[0]?.clientX ?? null }}
          onTouchEnd={(event) => {
            const end = event.changedTouches[0]?.clientX
            if (swipeStart.current !== null && end !== undefined && Math.abs(end - swipeStart.current) > 40) move(end > swipeStart.current ? 1 : -1)
            swipeStart.current = null
          }}>
          <div className="testimonial-track" onTransitionEnd={() => setManualMotion(false)} style={{ transform: `translateX(-${index * stepWidth}px)`, transition: transitioning ? manualMotion ? 'transform .45s ease' : reducedMotion ? 'none' : 'transform 4.5s linear' : 'none' }}>
            {carouselItems.map((item, cardIndex) => <div className="testimonial-slide" key={`${item.id}-${cardIndex}`}><TestimonialCard item={item} /></div>)}
          </div>
        </div>
        {count > 1 && <div className="testimonial-controls"><div className="testimonial-pagination" aria-label="Choose testimonial">{items.map((item, dot) => <button key={item.id} type="button" className={dot === activeDot ? 'active' : ''} aria-label={`Show testimonial ${dot + 1}`} aria-current={dot === activeDot ? 'true' : undefined} onClick={() => jumpTo(dot)} />)}</div><div className="testimonial-arrows"><button type="button" aria-label="Previous testimonial" onClick={() => move(1)}><ChevronLeft size={18} /></button><button type="button" aria-label="Next testimonial" onClick={() => move(-1)}><ChevronRight size={18} /></button></div></div>}
      </div>
    </div>
  </section>
}

function TestimonialCard({ item }) {
  const rating = Number(item.metadata?.rating)
  const author = item.metadata?.author || item.title
  return <article className="testimonial-card">
    <div className="testimonial-card-top"><span className="quote-mark" aria-hidden="true">“</span>{Number.isFinite(rating) && rating > 0 && rating <= 5 && <span className="testimonial-rating" aria-label={`${rating} out of 5 stars`}>{'★'.repeat(Math.round(rating))}</span>}</div>
    <blockquote>{item.body || item.summary}</blockquote>
    {(item.metadata?.organization || item.metadata?.project || item.metadata?.location) && <p className="testimonial-association">{[item.metadata.organization, item.metadata.project, item.metadata.location].filter(Boolean).join(' · ')}</p>}
    <div className="testimonial-author">{item.image_url ? <img className="author-avatar" src={item.image_url} alt={`Portrait of ${author}`} loading="lazy" width="60" height="60" /> : <span className="author-avatar" aria-hidden="true">{author.slice(0, 1)}</span>}<div><strong>{author}</strong>{item.metadata?.role && <span>{item.metadata.role}</span>}</div></div>
  </article>
}

function RelatedSection({ title, kind, content }) {
  if (!content.length) return null
  return <section className="related-section section-wrap"><div className="section-heading-row dark-heading"><h2>{title}</h2><Link className="underlined-link" to={kindPath(kind)}>Explore all <ArrowRight size={16} /></Link></div><div className={kind === 'services' ? 'services-grid' : 'products-grid'}>{content.map((item, index) => <ContentCard key={item.id} item={item} kind={kind} index={index} />)}</div></section>
}

function PageHero({ eyebrow, title, summary, image, alt, cta = true }) {
  return <section className={`page-hero scroll-reveal ${image ? 'page-hero-image' : ''}`}><div className="page-hero-copy"><span className="eyebrow"><span />{eyebrow}</span><h1>{title}</h1>{summary && <p>{summary}</p>}{cta && <Link className="button button-primary" to="/contact">Let's talk <ArrowRight size={16} /></Link>}</div>{image && <img src={image} alt={alt || title} fetchpriority="high" />}</section>
}

function EmptyPage({ title, message }) {
  return <><PageMeta title={title} description={message} /><section className="section-wrap empty-page"><span className="section-kicker">Again</span><h1>{title}</h1><p>{message}</p><Link className="button button-primary" to="/">Return home <ArrowRight size={16} /></Link></section></>
}

function NotFoundPage() {
  return <EmptyPage title="Page not found" message="We couldn’t find the page you requested. It may have moved or not been published yet." />
}

function renderParagraphs(text = '') {
  return text.split(/\n{2,}/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)
}

function published(content, kind) {
  return content.filter((item) => item.kind === kind && isPublicContent(item))
}

function isPublicContent(item) {
  return item.status === 'published' && item.metadata?.demonstration !== true && !/^demo(?:\b|[ ·])/i.test(item.title || '')
}

function kindPath(kind) {
  return kind === 'services' ? '/services' : kind === 'products' ? '/products' : kind === 'news' ? '/news' : kind === 'team' ? '/team' : kind === 'partners' ? '/partners' : kind === 'testimonials' ? '/testimonials' : '/projects'
}

function fallbackImage(kind) {
  return kind === 'projects'
    ? 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1100&q=85'
    : 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=900&q=80'
}

function makeWhatsAppUrl(number, message) {
  const cleanNumber = number.replace(/[^\d]/g, '')
  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`
}

export default function App() {
  return <BrowserRouter><SiteProvider /></BrowserRouter>
}
