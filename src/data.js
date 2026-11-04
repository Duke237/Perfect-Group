export const initialContent = [
  {
    id: 'home',
    kind: 'homepage',
    title: 'A better way to build, connect and grow.',
    slug: 'home',
    summary: 'Technology, infrastructure and creative solutions for businesses.',
    body: 'We bring the right people, technology and expertise together to help ambitious businesses move forward.',
    image_url: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1800&q=85',
    metadata: { eyebrow: 'Technology. Infrastructure. Creativity.', cta: 'Explore our services' },
    status: 'published',
  },
  {
    id: 'about',
    kind: 'about',
    title: 'Built around what comes next.',
    slug: 'about',
    summary: 'Again is a multi-service company connecting business challenges to practical, dependable solutions.',
    body: 'From technology and infrastructure to creative services, Again brings together the expertise to support your business needs.',
    image_url: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1200&q=85',
    metadata: {},
    status: 'published',
  },
]

export const defaultSiteSettings = {
  company_name: 'Again',
  company_description: 'Technology, infrastructure and creative solutions for businesses.',
  office_location: 'Yaoundé, Cameroon',
  business_email: 'perfectgroup@gmail.com',
  telephone: '+237 621 455 436',
}

export const kindLabels = {
  services: 'Services',
  products: 'Products',
  projects: 'Our work',
  testimonials: 'Testimonials',
  partners: 'Partners',
  about: 'About us',
  homepage: 'Homepage',
  news: 'News & training',
  legal: 'Legal pages',
  team: 'Team members',
}

export const primaryNavigation = [
  { label: 'Home', path: '/' },
  { label: 'About Us', path: '/about' },
  { label: 'Services', path: '/services' },
  { label: 'Products', path: '/products' },
  { label: 'Our Work', path: '/projects' },
  { label: 'Contact Us', path: '/contact' },
]
