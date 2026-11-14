export type UserRole = 'admin' | 'user';
export type AccountType = 'Super Administrator' | 'Standard User';
export type LessonStatus = 'published' | 'hidden' | 'draft';

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  accountType: AccountType;
  mustChangePassword: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  createdAt: string;
}

export interface Lesson {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  cppStarter: string;
  categoryId: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  readMinutes: number;
  imageUrl: string;
  status: LessonStatus;
  authorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface HeaderTab {
  id: string;
  label: string;
  href: string;
  sortOrder: number;
  isVisible: boolean;
}

export interface SiteSection {
  id: string;
  sectionType: 'hero' | 'catalog' | 'cpp_lab_promo' | 'architecture';
  title: string;
  subtitle: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  sortOrder: number;
  isVisible: boolean;
}

export interface SiteSettings {
  siteName: string;
  footerNote: string;
  enableCppLab: boolean;
  enableSearch: boolean;
  enableRegistration: boolean;
}

export interface PublicSitePayload {
  settings: SiteSettings;
  headerTabs: HeaderTab[];
  sections: SiteSection[];
  categories: Category[];
  lessons: Lesson[];
}

export interface AdminOverviewPayload extends PublicSitePayload {
  allHeaderTabs: HeaderTab[];
  allSections: SiteSection[];
  allLessons: Lesson[];
  users: UserProfile[];
  authProviderMode: 'supabase' | 'local-secure-vault';
}
