import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';


const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = (...parts) => readFileSync(join(root, ...parts), 'utf8');

test('demo authentication cannot be enabled in production builds', () => {
  const authProvider = source('src', 'app', 'providers', 'AuthProvider.tsx');
  assert.match(authProvider, /import\.meta\.env\.DEV\s*&&\s*import\.meta\.env\.VITE_ENABLE_DEMO_AUTH\s*===\s*'true'/);
});

test('login and register pages do not expose fixed demo credentials', () => {
  const loginPage = source('src', 'pages', 'LoginPage.tsx');
  const registerPage = source('src', 'pages', 'RegisterPage.tsx');
  const visibleText = `${loginPage}\n${registerPage}`;

  assert.doesNotMatch(visibleText, /member123/);
  assert.doesNotMatch(visibleText, /admin\s*\/\s*admin/);
  assert.doesNotMatch(visibleText, /演示账号/);
  assert.doesNotMatch(visibleText, /LUMI-A1B2/);
});

test('login page has no dynamic light rays effect', () => {
  const loginPage = source('src', 'pages', 'LoginPage.tsx');

  assert.doesNotMatch(loginPage, /LightRays/);
  assert.doesNotMatch(loginPage, /ENABLE_LOGIN_LIGHT_RAYS/);
  assert.doesNotMatch(loginPage, /shared\/components\/LightRays/);
});

test('api client attaches csrf token only to mutating requests', () => {
  const apiClient = source('src', 'shared', 'api', 'lumitimeApi.ts');

  assert.match(apiClient, /const CSRF_COOKIE_NAME = 'lumitime_csrf'/);
  assert.match(apiClient, /shouldAttachCsrf\(method\) \? readCookie\(CSRF_COOKIE_NAME\) : null/);
  assert.match(apiClient, /'X-CSRF-Token': csrfToken/);
  assert.match(apiClient, /method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS'/);
});

test('log submit page does not persist passwords or DeepSeek API keys in local browser storage', () => {
  const logSubmitPage = source('src', 'pages', 'LogSubmitPage.tsx');
  const cacheFields = logSubmitPage.match(/const LOCAL_CACHE_FIELDS = new Set\(\[([\s\S]*?)\]\);/)?.[1] || '';

  assert.match(logSubmitPage, /LOCAL_CACHE_KEY = 'lumitime\.logSubmit\.localFields\.v1'/);
  assert.match(cacheFields, /'student_account'/);
  assert.doesNotMatch(cacheFields, /'student_password'/);
  assert.doesNotMatch(cacheFields, /'deepseek_api_key'/);
  assert.match(cacheFields, /'deepseek_base_url'/);
  assert.match(cacheFields, /'deepseek_model'/);
  assert.match(logSubmitPage, /deepseek_model: 'deepseek-v4-flash'/);
  assert.match(logSubmitPage, /window\.localStorage\.getItem\(LOCAL_CACHE_KEY\)/);
  assert.match(logSubmitPage, /window\.localStorage\.setItem\(LOCAL_CACHE_KEY/);
  assert.match(logSubmitPage, /saveCachedFields\(cached\)/);
  assert.match(logSubmitPage, /serviceLoadState === 'ready'\) saveCachedFields\(formValues\)/);
  assert.doesNotMatch(logSubmitPage, /setPageStatus\('submitting'\);\s*clearCredentials\(\);/);
});

test('log submit page supports multiple target dates', () => {
  const logSubmitPage = source('src', 'pages', 'LogSubmitPage.tsx');

  assert.match(logSubmitPage, /function MultiDateField/);
  assert.match(logSubmitPage, /normalizeDateList/);
  assert.match(logSubmitPage, /config\.log_dates = selectedDates/);
  assert.match(logSubmitPage, /field\.name === 'target_date'/);
});

test('log submit page drops invalid numeric config values', () => {
  const logSubmitPage = source('src', 'pages', 'LogSubmitPage.tsx');
  const buildTaskConfig = logSubmitPage.match(/function buildTaskConfig[\s\S]*?function fallbackSummary/)?.[0] || '';

  assert.match(buildTaskConfig, /Number\.isNaN/);
  assert.doesNotMatch(buildTaskConfig, /nextConfig\[field\.name\]\s*=\s*field\.type === 'number' \? Number\(raw\) : raw\.trim\(\)/);
});

test('log submit page shows readonly dosave fields without sending them in task config', () => {
  const logSubmitPage = source('src', 'pages', 'LogSubmitPage.tsx');
  const buildTaskConfig = logSubmitPage.match(/function buildTaskConfig[\s\S]*?function fallbackSummary/)?.[0] || '';

  assert.match(logSubmitPage, /function ReadonlyDoSavePanel/);
  assert.match(logSubmitPage, /READONLY_DOSAVE_FIXED_FIELDS/);
  assert.match(logSubmitPage, /SXJXRW_ID/);
  assert.match(logSubmitPage, /OPERATERCODE/);
  assert.match(logSubmitPage, /SY_CREATEUSERID/);
  assert.match(logSubmitPage, /SY_CREATEUSERNAME/);
  assert.match(logSubmitPage, /BGRQ/);
  assert.match(buildTaskConfig, /config\.target_date = selectedDates\[0\]/);
  assert.doesNotMatch(buildTaskConfig, /config\.(XNXQ|SXJXRW_ID|OPERATERCODE|SY_CREATEUSERID|SY_CREATEUSER|SY_CREATEUSERNAME)/);
});

test('homepage keeps personal-site positioning and workstation as an invited tool', () => {
  const homePage = source('src', 'pages', 'HomePage.tsx');

  assert.match(homePage, /个人站|个人创作|记录、沉淀/);
  assert.match(homePage, /受邀工具/);
  assert.match(homePage, /route:\s*'\/workstation'/);
  assert.doesNotMatch(homePage, /自动化工作站 SaaS|企业 SaaS|团队协作/);
});

test('quiet-light redesign does not change api client or route protection files', () => {
  const apiClient = source('src', 'shared', 'api', 'lumitimeApi.ts');
  const appRoutes = source('src', 'app', 'App.tsx');

  assert.match(apiClient, /const API_BASE = '\/api\/v1'/);
  assert.match(apiClient, /credentials:\s*'include'/);
  assert.match(apiClient, /function shouldAttachCsrf\(method: string\)/);
  assert.match(appRoutes, /function ProtectedRoute/);
  assert.match(appRoutes, /path="\/workstation\/services\/:serviceId"/);
  assert.match(appRoutes, /path="\/workstation\/records\/:requestId"/);
});

test('log submit and records pages retain sensitive-data safeguards', () => {
  const logSubmitPage = source('src', 'pages', 'LogSubmitPage.tsx');
  const recordsPage = source('src', 'pages', 'RecordsPage.tsx');

  assert.match(logSubmitPage, /const LOCAL_CACHE_FIELDS = new Set/);
  assert.doesNotMatch(
    logSubmitPage.match(/const LOCAL_CACHE_FIELDS = new Set\(\[([\s\S]*?)\]\);/)?.[1] || '',
    /student_password|deepseek_api_key/,
  );
  assert.match(logSubmitPage, /pollServiceRequest/);
  assert.match(recordsPage, /retryServiceRequestApi/);
  assert.match(recordsPage, /请重新输入学生学习 App 账号和密码/);
});

test('data query pages request paginated backend slices instead of oversized batches', () => {
  const apiClient = source('src', 'shared', 'api', 'lumitimeApi.ts');
  const contentPage = source('src', 'pages', 'ContentPage.tsx');
  const notesPage = source('src', 'pages', 'NotesPage.tsx');
  const recordsPage = source('src', 'pages', 'RecordsPage.tsx');
  const adminPage = source('src', 'pages', 'AdminPage.tsx');

  assert.match(apiClient, /export function listServicesApi\(query: \{ page\?: number; page_size\?: number \} = \{\}\)/);
  assert.match(apiClient, /apiFetch<Paginated<BackendService>>\(`\/workstation\/services\$\{queryString\(query\)\}`\)/);
  assert.doesNotMatch(`${contentPage}\n${notesPage}\n${recordsPage}\n${adminPage}`, /page_size:\s*(50|90|100)\b/);
  assert.match(contentPage, /const CONTENT_PAGE_SIZE = 12/);
  assert.match(notesPage, /const NOTES_PAGE_SIZE = 10/);
  assert.match(recordsPage, /page_size: PAGE_SIZE/);
  assert.match(adminPage, /<Pager/);
});

test('workstation only exposes the log auto submit service to users', () => {
  const workstationRoute = source('..', 'backend', 'app', 'routes', 'workstation.py');
  const workstationPage = source('src', 'pages', 'WorkstationPage.tsx');

  assert.match(workstationRoute, /WorkstationService\.id == "service_log_auto_submit"/);
  assert.match(workstationRoute, /paginated\(\[service_public\(item\) for item in items\], total, page, page_size\)/);
  assert.match(workstationPage, /listServicesApi\(\{ page: 1, page_size: 1 \}\)/);
  assert.doesNotMatch(workstationPage, /工作站只是 Lumitime 的辅助能力/);
});

test('navigation orders dashboard first and uses exact route matching', () => {
  const mainNav = source('src', 'layouts', 'MainNav.tsx');
  const navItems = mainNav.match(/const navItems = useMemo\(\(\) => \[([\s\S]*?)\],/)?.[1]
    || mainNav.match(/const navItems = \[([\s\S]*?)\];/)?.[1]
    || '';

  assert.match(navItems.trim(), /^\{ to: '\/dashboard'[\s\S]*label: '大屏看板'[\s\S]*label: '随记'[\s\S]*label: '脚本分享'/);
  assert.match(mainNav, /PillNav/);
  assert.match(mainNav, /activeHref=\{activeHref\}/);
  assert.match(mainNav, /function isRouteActive\(path: string, currentPath: string\)/);
  assert.doesNotMatch(mainNav, /location\.pathname\.startsWith\(item\.to\)/);
  assert.doesNotMatch(mainNav, /GooeyNav/);
});

test('homepage panel is only rendered for logged-out visitors', () => {
  const homePage = source('src', 'pages', 'HomePage.tsx');
  const mainNav = source('src', 'layouts', 'MainNav.tsx');

  assert.match(homePage, /\{!isLoggedIn && \(/);
  assert.match(homePage, /className="[^"]*lumitime-script-logo/);
  assert.match(mainNav, /NightModeToggle/);
});

test('authenticated users do not land on the public home screen', () => {
  const appRoutes = source('src', 'app', 'App.tsx');

  assert.match(appRoutes, /function HomeRoute/);
  assert.match(appRoutes, /<Navigate to="\/dashboard" replace \/>/);
});

test('dashboard is a light site statistics page inside the main navigation shell', () => {
  const dashboardPage = source('src', 'pages', 'DashboardPage.tsx');

  assert.match(dashboardPage, /<MainNav/);
  assert.match(dashboardPage, /dashboard-page/);
  assert.doesNotMatch(dashboardPage, /ArrowLeft|navigate\('\/'\)|返回/);
  assert.doesNotMatch(dashboardPage, /bg-\[#080808\]|bg-\[#111111\]|text-white\/20/);
});

test('content pages use the notes-style animated paginated list layout', () => {
  const contentPage = source('src', 'pages', 'ContentPage.tsx');
  const notesPage = source('src', 'pages', 'NotesPage.tsx');

  assert.match(contentPage, /AnimatedList/);
  assert.match(contentPage, /sticky top-16/);
  assert.match(contentPage, /<Pager/);
  assert.doesNotMatch(contentPage, /md:grid-cols-2|xl:grid-cols-3|返回主页/);
  assert.match(notesPage, /AnimatedList/);
});

test('night mode is shared across site and admin chrome', () => {
  const appRoutes = source('src', 'app', 'App.tsx');
  const mainNav = source('src', 'layouts', 'MainNav.tsx');
  const adminSidebar = source('src', 'layouts', 'AdminSidebar.tsx');

  assert.match(appRoutes, /NightModeProvider/);
  assert.match(mainNav, /useNightMode/);
  assert.match(adminSidebar, /NightModeToggle/);
  assert.match(adminSidebar, /Lumitime/);
  assert.doesNotMatch(adminSidebar, /管理后台<\/span>/);
});

test('site chrome prevents horizontal page dragging and nav active flash', () => {
  const theme = source('src', 'styles', 'theme.css');
  const mainNav = source('src', 'layouts', 'MainNav.tsx');

  assert.match(theme, /overflow-x:\s*hidden/);
  assert.match(mainNav, /activeHref=\{activeHref\}/);
  assert.match(mainNav, /onNavigate=\{href => navigate\(href\)\}/);
});

test('react-bits motion chrome uses lumitime themed effects', () => {
  const appRoutes = source('src', 'app', 'App.tsx');
  const homePage = source('src', 'pages', 'HomePage.tsx');
  const theme = source('src', 'styles', 'theme.css');
  const profilePage = source('src', 'pages', 'ProfilePage.tsx');

  assert.match(appRoutes, /Ribbons/);
  assert.match(appRoutes, /const cursorTrailEnabled = settings\.cursorTrail/);
  assert.match(appRoutes, /\{cursorTrailEnabled && \(/);
  assert.match(appRoutes, /sparkColor="var\(--lumitime-spark\)"/);
  assert.match(profilePage, /光标拖尾/);
  assert.match(profilePage, /setCursorTrail/);
  assert.match(homePage, /LightRays/);
  assert.match(theme, /--lumitime-spark:\s*#f4c95d/);
  assert.match(theme, /--lumitime-ribbon:\s*#9ec5e6/);
  assert.match(theme, /--lumitime-ray:\s*#fff7dc/);
  assert.match(theme, /\.pill-nav/);
});

test('profile page contains settings and constrains recent service rows', () => {
  const profilePage = source('src', 'pages', 'ProfilePage.tsx');

  assert.match(profilePage, /个人设置/);
  assert.match(profilePage, /Switch/);
  assert.match(profilePage, /min-w-0/);
  assert.match(profilePage, /max-w-full/);
  assert.match(profilePage, /break-all/);
  assert.match(profilePage, /serviceRequestId/);
});
