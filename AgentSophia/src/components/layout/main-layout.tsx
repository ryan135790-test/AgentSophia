import { useState, ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { SidebarNav } from "./sidebar-nav";
import { TopHeader } from "./top-header";
import { SophiaHeader } from "@/components/agent-sophia/sophia-header";
import { SophiaLivePopup } from "@/components/sophia/SophiaLivePopup";
import { AdminViewingBanner } from "@/components/super-admin/admin-viewing-banner";
import { Sheet, SheetContent } from "@/components/ui/sheet";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const getTabFromPath = (pathname: string): string => {
    if (pathname === '/') return 'dashboard';
    const path = pathname.substring(1);
    return path.split('/')[0] || 'dashboard';
  };
  
  const [activeTab, setActiveTab] = useState(getTabFromPath(location.pathname));

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
    if (tab === 'dashboard') {
      navigate('/');
    } else {
      navigate(`/${tab}`);
    }
  };

  const handleMobileNavClick = () => {
    setMobileMenuOpen(false);
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      <AdminViewingBanner />
      <TopHeader onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} />
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar - hidden on mobile */}
        <div className="hidden md:block">
          <SidebarNav activeTab={activeTab} onTabChange={handleTabChange} />
        </div>
        
        {/* Mobile Sidebar - Sheet/Drawer */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" className="p-0 w-72 bg-slate-900 border-slate-700">
            <SidebarNav 
              activeTab={activeTab} 
              onTabChange={handleTabChange}
              isMobile={true}
              onMobileNavClick={handleMobileNavClick}
            />
          </SheetContent>
        </Sheet>

        <main className="flex-1 overflow-auto">
          <SophiaHeader />
          <div className="p-4 md:p-6">
            {children}
          </div>
        </main>
      </div>
      <SophiaLivePopup />
    </div>
  );
}
