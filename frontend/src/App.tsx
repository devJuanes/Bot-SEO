import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { ProtectedLayout } from './layout/ProtectedLayout';
import { DashboardPage } from './pages/DashboardPage';
import { LeadsPage } from './pages/LeadsPage';
import { LeadDetailPage } from './pages/LeadDetailPage';
import { ContentPage } from './pages/ContentPage';
import { LoginPage, RegisterPage } from './pages/auth/AuthPages';
import { PaymentResultPage } from './pages/auth/PaymentResultPage';
import { LandingLayout } from './pages/landing/LandingLayout';
import { HomePage } from './pages/landing/HomePage';
import { FeaturesPage } from './pages/landing/FeaturesPage';
import { HowItWorksPage } from './pages/landing/HowItWorksPage';
import { PricingPage } from './pages/landing/PricingPage';
import { ContactPage } from './pages/landing/ContactPage';
import { SupportPage } from './pages/landing/SupportPage';
import { AgentPage } from './pages/AgentPage';
import { AgentsPage } from './pages/AgentsPage';
import { SetupPage } from './pages/SetupPage';
import { CompanyChatPage } from './pages/CompanyChatPage';
import { WhatsAppInboxPage } from './pages/whatsapp/WhatsAppInboxPage';
import { WhatsAppCampaignsPage } from './pages/whatsapp/WhatsAppCampaignsPage';
import { WhatsAppContactsPage } from './pages/whatsapp/WhatsAppContactsPage';
import { WhatsAppTemplatesPage } from './pages/whatsapp/WhatsAppTemplatesPage';
import { FacebookQueuePage } from './pages/facebook/FacebookQueuePage';
import { FacebookPublishedPage } from './pages/facebook/FacebookPublishedPage';
import { FacebookGeneratePage } from './pages/facebook/FacebookGeneratePage';
import { SettingsLayout } from './pages/settings/SettingsLayout';
import { SettingsProjectPage } from './pages/settings/SettingsProjectPage';
import { SettingsLlmPage } from './pages/settings/SettingsLlmPage';
import { SettingsWhatsappPage } from './pages/settings/SettingsWhatsappPage';
import { SettingsFacebookPage } from './pages/settings/SettingsFacebookPage';
import { SettingsBrandPage } from './pages/settings/SettingsBrandPage';
import { HelpCenterLayout } from './pages/help/HelpCenterLayout';
import { HelpHomePage } from './pages/help/HelpHomePage';
import { HelpFaqPage } from './pages/help/HelpFaqPage';
import { HelpTicketsPage } from './pages/help/HelpTicketsPage';
import { HelpContactPage } from './pages/help/HelpContactPage';
import { AutomationsPage } from './pages/AutomationsPage';
import { MonitorPage } from './pages/MonitorPage';

function WhatsAppInboxLegacyRedirect() {
  const { conversationId } = useParams();
  return <Navigate to={`/whatsapp/mensajes/${conversationId}`} replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingLayout />}>
        <Route index element={<HomePage />} />
        <Route path="funciones" element={<FeaturesPage />} />
        <Route path="como-funciona" element={<HowItWorksPage />} />
        <Route path="precios" element={<PricingPage />} />
        <Route path="contacto" element={<ContactPage />} />
        <Route path="soporte" element={<SupportPage />} />
      </Route>
      <Route path="/acceso/iniciar-sesion" element={<LoginPage />} />
      <Route path="/acceso/crear-cuenta" element={<RegisterPage />} />
      <Route path="/acceso/pago-resultado" element={<PaymentResultPage />} />
      <Route path="/login" element={<Navigate to="/acceso/iniciar-sesion" replace />} />
      <Route path="/register" element={<Navigate to="/acceso/crear-cuenta" replace />} />

      <Route element={<ProtectedLayout />}>
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/agentes" element={<AgentsPage />} />
        <Route path="/agents/custom/:id" element={<AgentPage variant="custom" />} />
        <Route path="/agents/:id" element={<AgentPage />} />
        <Route path="/leads" element={<LeadsPage />} />
        <Route path="/leads/:id" element={<LeadDetailPage />} />
        <Route path="/automations" element={<AutomationsPage />} />
        <Route path="/monitor" element={<MonitorPage />} />
        <Route path="/live" element={<Navigate to="/monitor" replace />} />
        <Route path="/content" element={<ContentPage />} />
        <Route path="/chat" element={<CompanyChatPage />} />

        <Route path="/whatsapp" element={<Navigate to="/whatsapp/mensajes" replace />} />
        <Route path="/whatsapp/inbox" element={<Navigate to="/whatsapp/mensajes" replace />} />
        <Route path="/whatsapp/mensajes" element={<WhatsAppInboxPage />} />
        <Route path="/whatsapp/mensajes/:conversationId" element={<WhatsAppInboxPage />} />
        <Route path="/whatsapp/inbox/:conversationId" element={<WhatsAppInboxLegacyRedirect />} />
        <Route path="/whatsapp/campaigns" element={<WhatsAppCampaignsPage />} />
        <Route path="/whatsapp/contacts" element={<WhatsAppContactsPage />} />
        <Route path="/whatsapp/templates" element={<WhatsAppTemplatesPage />} />

        <Route path="/facebook" element={<Navigate to="/facebook/queue" replace />} />
        <Route path="/facebook/queue" element={<FacebookQueuePage />} />
        <Route path="/facebook/published" element={<FacebookPublishedPage />} />
        <Route path="/facebook/generate" element={<FacebookGeneratePage />} />

        <Route path="/settings" element={<SettingsLayout />}>
          <Route index element={<Navigate to="/settings/project" replace />} />
          <Route path="project" element={<SettingsProjectPage />} />
          <Route path="llm" element={<SettingsLlmPage />} />
          <Route path="whatsapp" element={<SettingsWhatsappPage />} />
          <Route path="facebook" element={<SettingsFacebookPage />} />
          <Route path="brand" element={<SettingsBrandPage />} />
        </Route>

        <Route path="/help" element={<HelpCenterLayout />}>
          <Route index element={<HelpHomePage />} />
          <Route path="faq" element={<HelpFaqPage />} />
          <Route path="tickets" element={<HelpTicketsPage />} />
          <Route path="contact" element={<HelpContactPage />} />
        </Route>

        <Route path="/whatsapp.html" element={<Navigate to="/whatsapp/mensajes" replace />} />
        <Route path="/facebook.html" element={<Navigate to="/facebook/queue" replace />} />
        <Route path="/settings.html" element={<Navigate to="/settings/project" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
