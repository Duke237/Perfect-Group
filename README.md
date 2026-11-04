# Again company website

Responsive company website and Supabase-backed content management dashboard, built with React and Vite.

## Run locally

1. Install Node.js (LTS) if it is not already installed.
2. In this folder run `npm install`, then `npm run dev`.
3. Open the local URL printed by Vite. The local preview includes the company homepage and About page; add approved services, products, projects, partners and testimonials through the CMS before publishing them.

The supplied brand image is served from `public/logo.png`; the separate browser and touch icon is `public/tap-logo.png`. The site uses the Again brand palette. Unsplash images are used for page presentation; replace them with company-owned or appropriately licensed photography before production.

## Enable the live CMS

1. Copy `.env.example` to `.env` in the project root and set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and (optionally) `VITE_WHATSAPP_NUMBER` in international format without a plus sign. For this project, use `https://bthlpbcsaumyunryhhkn.supabase.co`. Get the public `sb_publishable_...` key from Supabase Dashboard > Project Settings > API Keys > Publishable key, or the legacy anon key from the Legacy API Keys section. Never use a secret or service-role key. Restart Vite after changing `.env`.
2. Authenticate the project-local Supabase CLI and link this folder to the existing project: `npx supabase login`, then `npx supabase link --project-ref bthlpbcsaumyunryhhkn`.
3. Apply the versioned schema migrations with `npx supabase db push --remote`. The latest migration adds profile phone/avatar fields and preferences, advertisement storage and row-level security, and the avatar-aware chat overview, alongside the existing content, enquiry, analytics, chat, notification and activity-log schema. It also configures the public image bucket if needed and realtime publication entries when available. Existing content and bucket settings are left unchanged on conflict.
4. Deploy the secure user-management function without requiring Docker: `npx supabase functions deploy admin-users --use-api`. Supabase supplies its server-side project URL and service-role key to deployed functions; never expose the service-role key in the browser or a `VITE_` variable.
5. To provision the initial administrator, use the authorized Supabase Dashboard: open **Authentication > Users**, search for the email first, and create an Auth user only if it does not already exist. Use a strong, unique password. In the SQL Editor, associate that Auth user with the existing highest-privilege `admin` role:

   ```sql
   insert into public.user_profiles (user_id, role, full_name, is_active)
   select id, 'admin', coalesce(raw_user_meta_data ->> 'full_name', ''), true
   from auth.users
   where lower(email) = lower('YOUR_EMAIL')
   on conflict (user_id) do update
   set role = 'admin', is_active = true;

   select u.email, p.role, p.is_active
   from auth.users u
   join public.user_profiles p on p.user_id = u.id
   where lower(u.email) = lower('YOUR_EMAIL');
   ```

   This project supports `admin` and `editor` roles; `admin` is the full administrator role. There is no public first-administrator or registration screen. Replace any temporary or exposed password with a strong, unique password before production; signed-in users can change it at `/admin/change-password`.
6. Set the Supabase URL and anon key in the app environment, allow the app origin and `/admin/login` password-reset redirect in Supabase Auth URL settings, then visit `/admin/login`.

Administrators can manage users, advertisements and site settings; active administrators and editors can manage content, enquiries, profile preferences and uploaded images. Advertisements are stored in Supabase and are publicly displayed only when published/scheduled and within their configured date range. Public visitors can read published content and submit contact enquiries. Page-view analytics use an anonymous browser-session identifier and exclude `/admin`; chat messages are private to the two conversation participants and include per-user unread state. Public visitors cannot access drafts, private chat or inquiry records. Never put a Supabase service-role key in the browser, source control or a `VITE_` variable.

## Content management

The dashboard supports creating, editing, previewing, publishing, unpublishing and deleting homepage, company, team, services, products, projects, testimonials, partners, news and legal content. Entries support image uploads, categories, display order, SEO metadata, publication state and related records. Service records can be selected and ordered for the footer; at most seven selected, published services are shown. Team profiles support role, department, skills, responsibilities and optional authorized contact links. Product and project records support detailed metadata, galleries, related records and enquiry calls to action. Homepage sections, verified statistics, company footer details, page-specific hero images, social links and logo are administrator-managed. Product and project listings support search, category filtering, sorting and pagination. Published changes refresh the public site through Supabase Realtime.

Website statistics are based on page views recorded with an anonymous per-tab browser-session ID; admin pages are excluded. Admin chat messages are private to the two active CMS users in each conversation. Apply the current SQL schema and deploy `admin-users` before using analytics, chat or user administration.

The checked-in migrations are the versioned database setup; apply future schema changes by adding new migration files rather than rerunning earlier migrations. The local development fallback contains no sample catalogue entries, employee profiles, partner logos, testimonials, product specifications, prices or project claims. Public contact details default to the supplied Yaoundé location, email address and telephone number; WhatsApp and social links remain hidden until configured.

The contact form stores enquiries in Supabase and generates dashboard notifications for enabled user preferences; it does not send email notifications. Add a trusted email/notification integration separately if automatic email notifications are required.
