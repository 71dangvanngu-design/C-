import { HubProvider, useHub } from './context/HubContext';
import { Navbar } from './components/Navbar';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { AdminPage } from './pages/AdminPage';
import { CppLabPage } from './pages/CppLabPage';
import { LessonPage } from './pages/LessonPage';
import { AccountPage } from './pages/AccountPage';

function AppRoutes() {
  const { currentPath } = useHub();
  const pathname = currentPath.split('#')[0] || '/';

  let content: React.ReactNode;
  if (pathname === '/login') {
    content = <LoginPage />;
  } else if (pathname === '/admin') {
    content = <AdminPage />;
  } else if (pathname === '/cpp-lab') {
    content = <CppLabPage />;
  } else if (pathname === '/account') {
    content = <AccountPage />;
  } else if (pathname.startsWith('/lessons/')) {
    const slug = decodeURIComponent(pathname.slice('/lessons/'.length));
    content = <LessonPage slug={slug} />;
  } else {
    content = <HomePage />;
  }

  return (
    <div className="min-h-screen bg-[#080B12] text-slate-100">
      <Navbar />
      {content}
    </div>
  );
}

export default function App() {
  return (
    <HubProvider>
      <AppRoutes />
    </HubProvider>
  );
}
