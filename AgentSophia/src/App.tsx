import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import Platform from "./pages/Platform";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import Profile from "./pages/Profile";
import SetupAdmin from "./pages/SetupAdmin";
import Analytics from "./pages/Analytics";
import Approvals from "./pages/Approvals";
import Dashboard from "./pages/Dashboard";
import Inbox from "./pages/Inbox";
import Contacts from "./pages/Contacts";
import ContactDetail from "./pages/ContactDetail";
import Templates from "./pages/Templates";
import ChatWithSophia from "./pages/ChatWithSophia";
import Campaigns from "./pages/Campaigns";
import CampaignDetail from "./pages/CampaignDetail";
import EmailSequences from "./pages/EmailSequences";
import EmailTracking from "./pages/EmailTracking";
import BulkEmail from "./pages/BulkEmail";
import EmailWarmup from "./pages/EmailWarmup";
import SMSCampaigns from "./pages/SMSCampaigns";
import LinkedInCampaigns from "./pages/LinkedInCampaigns";
import LeadScoring from "./pages/LeadScoring";
import PhoneVoicemail from "./pages/PhoneVoicemail";
import RevenueAnalytics from "./pages/RevenueAnalytics";
import ABTesting from "./pages/ABTesting";
import TeamCollaboration from "./pages/TeamCollaboration";
import MeetingScheduling from "./pages/MeetingScheduling";
import DealPipeline from "./pages/DealPipeline";
import ContactImport from "./pages/ContactImport";
import BulkOperations from "./pages/BulkOperations";
import RevenueForecast from "./pages/RevenueForecast";
import SophiaLearning from "./pages/SophiaLearning";
import SophiaReports from "./pages/SophiaReports";
import SophiaActivity from "./pages/SophiaActivity";
import EmailManager from "./pages/EmailManager";
import EmailSetup from "./pages/EmailSetup";
import AdminPanel from "./pages/AdminPanel";
import BrandVoice from "./pages/BrandVoice";
import ActivityFeed from "./pages/ActivityFeed";
import IntegrationSetup from "./pages/IntegrationSetup";
import IntegrationsHub from "./pages/IntegrationsHub";
import WorkspaceSettings from "./pages/WorkspaceSettings";
import FeaturesHub from "./pages/FeaturesHub";
import Invites from "./pages/Invites";
import WorkflowMonitoring from "./pages/WorkflowMonitoring";
import WorkflowBuilder from "./pages/WorkflowBuilder";
import WorkflowBuilderPage from "./pages/WorkflowBuilderPage";
import SocialMedia from "./pages/SocialMedia";
import NotFound from "./pages/NotFound";
import { GmailCallback } from "./pages/oauth/GmailCallback";
import { OutlookCallback } from "./pages/oauth/OutlookCallback";
import { LinkedInCallback } from "./pages/oauth/LinkedInCallback";
import { Office365Callback } from "./pages/oauth/Office365Callback";
import { AuthProvider, useAuth } from "./components/auth/auth-provider";
import { ProtectedRoute } from "./components/auth/protected-route";
import { MainLayout } from "./components/layout/main-layout";
import { queryClient } from "./lib/queryClient";
import SophiaAdmin from "./pages/SophiaAdmin";
import LinkedInSettings from "./pages/LinkedInSettings";
import LinkedInInbox from "./pages/LinkedInInbox";
import LinkedInLeadImport from "./pages/LinkedInLeadImport";
import LinkedInEngagement from "./pages/LinkedInEngagement";
import LinkedInOptimization from "./pages/LinkedInOptimization";
import MyConnections from "./pages/MyConnections";
import SuperAdmin from "./pages/SuperAdmin";
import StayInTouch from "./pages/StayInTouch";
import GettingStarted from "./pages/GettingStarted";
import HowToUse from "./pages/HowToUse";
import DataExport from "./pages/DataExport";
import AuditLog from "./pages/AuditLog";
import NotificationSettings from "./pages/NotificationSettings";
import RateLimiting from "./pages/RateLimiting";
import DecodoSetup from "./pages/DecodoSetup";
import { SophiaWorkspaceProvider } from "./contexts/SophiaWorkspaceContext";
import { LinkedInAccountProvider } from "./contexts/LinkedInAccountContext";
import { CampaignDraftProvider } from "./contexts/CampaignDraftContext";
import { WorkspaceProvider } from "./contexts/WorkspaceContext";
import { SophiaNotificationProvider } from "./components/agent-sophia/sophia-notification-provider";

const DEMO_MODE = false;

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading && !DEMO_MODE) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const isAuthenticated = DEMO_MODE || user;

  return (
    <Routes>
      <Route 
        path="/" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <Platform />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/dashboard" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <Dashboard />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/inbox" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <Inbox />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/approvals" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <Platform />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/chat-sophia" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <ChatWithSophia />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/workflow-editor" 
        element={<Navigate to="/workflow-builder" replace />}
      />
      <Route 
        path="/workflows" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <WorkflowMonitoring />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/workflow-builder" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <WorkflowBuilder />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/social-media" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <SocialMedia />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/social-posts" 
        element={<Navigate to="/social-media?tab=schedule" replace />} 
      />
      <Route 
        path="/social-analytics" 
        element={<Navigate to="/social-media?tab=recurring" replace />} 
      />
      <Route 
        path="/sophia-admin" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <SophiaAdmin />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/integrations" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <IntegrationsHub />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/linkedin-settings" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <LinkedInSettings />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/my-connections" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <MyConnections />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/decodo-setup" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <DecodoSetup />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/contacts" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <Contacts />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/contacts/:id" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <ContactDetail />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/campaigns" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <Campaigns />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/campaigns/:id" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <CampaignDetail />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/email-sequences" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <EmailSequences />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/email-tracking" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <EmailTracking />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/bulk-email" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <BulkEmail />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/email-warmup" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <EmailWarmup />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/sms-campaigns" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <SMSCampaigns />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/linkedin-campaigns" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <LinkedInCampaigns />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/lead-scoring" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <LeadScoring />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/phone-voicemail" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <PhoneVoicemail />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/revenue-analytics" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <RevenueAnalytics />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/ab-testing" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <ABTesting />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/team-collaboration" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <TeamCollaboration />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/meeting-scheduling" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <MeetingScheduling />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/deal-pipeline" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <DealPipeline />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/contact-import" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <ContactImport />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/bulk-operations" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <BulkOperations />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/revenue-forecast" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <RevenueForecast />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/sophia-learning" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <SophiaLearning />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/sophia-reports" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <SophiaReports />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/sophia-activity" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <SophiaActivity />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/email-manager" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <EmailManager />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/email-setup" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <EmailSetup />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/templates" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <Templates />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/settings" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <AdminPanel />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/brand-voice" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <BrandVoice />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/features" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <FeaturesHub />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/admin" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <Admin />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/activity" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <ActivityFeed />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/activity-feed" 
        element={<Navigate to="/activity" replace />}
      />
      <Route 
        path="/integrations-setup" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <IntegrationSetup />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/workspace/:workspaceId/settings" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <WorkspaceSettings />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/invites" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <Invites />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/stay-in-touch" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <StayInTouch />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/linkedin-inbox" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <LinkedInInbox />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/linkedin-lead-import" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <LinkedInLeadImport />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/linkedin-engagement" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <LinkedInEngagement />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/linkedin-optimization" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <LinkedInOptimization />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/getting-started" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <GettingStarted />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/how-to-use" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <HowToUse />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/data-export" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <DataExport />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/audit-log" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <AuditLog />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/notification-settings" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <NotificationSettings />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/rate-limiting" 
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <MainLayout>
                <RateLimiting />
              </MainLayout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/auth" 
        element={isAuthenticated ? <Navigate to="/" replace /> : <Auth />} 
      />
      <Route 
        path="/setup-admin" 
        element={<SetupAdmin />} 
      />
      <Route 
        path="/super-admin" 
        element={<SuperAdmin />} 
      />
      <Route 
        path="/profile" 
        element={
          <ProtectedRoute>
            <MainLayout>
              <Profile />
            </MainLayout>
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/analytics" 
        element={
          <ProtectedRoute>
            <MainLayout>
              <Analytics />
            </MainLayout>
          </ProtectedRoute>
        } 
      />
      <Route path="/oauth/gmail/callback" element={<GmailCallback />} />
      <Route path="/oauth/outlook/callback" element={<OutlookCallback />} />
      <Route path="/oauth/linkedin/callback" element={<LinkedInCallback />} />
      <Route path="/oauth/callback/linkedin" element={<LinkedInCallback />} />
      <Route path="/oauth/office365/callback" element={<Office365Callback />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <ThemeProvider defaultTheme="light" storageKey="intellead-theme">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <WorkspaceProvider>
              <LinkedInAccountProvider>
                <SophiaWorkspaceProvider>
                  <SophiaNotificationProvider>
                    <CampaignDraftProvider>
                      <AppRoutes />
                    </CampaignDraftProvider>
                  </SophiaNotificationProvider>
                </SophiaWorkspaceProvider>
              </LinkedInAccountProvider>
            </WorkspaceProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
