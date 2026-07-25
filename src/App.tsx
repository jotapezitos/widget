import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { ServicesList } from './components/ServicesList';
import { BarbersList } from './components/BarbersList';
import { BookingModal } from './components/BookingModal';
import { MyAppointments } from './components/MyAppointments';
import { TenantOwnerDashboard } from './components/TenantOwnerDashboard';
import { StaffDashboard } from './components/StaffDashboard';
import { Footer } from './components/Footer';
import { SimulationTopBar, SimulationLevel } from './components/SimulationTopBar';
import { BrowserWindowMockup } from './components/BrowserWindowMockup';
import { DemoNotificationToast } from './components/DemoNotificationToast';
import { Service, Barber } from './types';

function MainContent({
  simulationLevel,
  activeTab,
  setActiveTab,
  onShowVisualNotice,
}: {
  simulationLevel: SimulationLevel;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onShowVisualNotice: () => void;
}) {
  const { currentRole, isSuperAdmin } = useAuth();
  const [dashboardSubTab, setDashboardSubTab] = useState<string>('overview');
  const [isBookingModalOpen, setIsBookingModalOpen] = useState<boolean>(false);
  const [preselectedService, setPreselectedService] = useState<Service | null>(null);
  const [preselectedBarber, setPreselectedBarber] = useState<Barber | null>(null);

  const handleOpenBookingModal = (service?: Service | any, barber?: Barber | any) => {
    const validService = service && typeof service === 'object' && 'name' in service && 'price' in service ? service : undefined;
    const validBarber = barber && typeof barber === 'object' && 'name' in barber ? barber : undefined;
    setPreselectedService(validService || null);
    setPreselectedBarber(validBarber || null);
    setIsBookingModalOpen(true);
  };

  const handleBookingSuccess = () => {
    setActiveTab('my-appointments');
    onShowVisualNotice();
  };

  return (
    <div className="min-h-full bg-zinc-50 text-zinc-900 flex flex-col font-sans selection:bg-amber-400 selection:text-black">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenBookingModal={() => handleOpenBookingModal()}
        onOpenInbox={() => {
          setActiveTab('dashboard');
          setDashboardSubTab('inbox');
        }}
        simulationLevel={simulationLevel}
      />

      <main className="flex-1 pb-32 sm:pb-0">
        {/* LEVEL 1 SIMULATION: Client Booking Experience */}
        {simulationLevel === 1 && (
          <>
            {activeTab === 'home' && (
              <>
                <Hero
                  onOpenBookingModal={(service, barber) => handleOpenBookingModal(service, barber)}
                  onViewServices={() => setActiveTab('services')}
                />
                <div className="hidden sm:block">
                  <ServicesList
                    onSelectService={(service) => handleOpenBookingModal(service)}
                  />
                  <BarbersList
                    onSelectBarber={(barber) => handleOpenBookingModal(undefined, barber)}
                  />
                </div>
              </>
            )}

            {activeTab === 'services' && (
              <ServicesList
                onSelectService={(service) => handleOpenBookingModal(service)}
              />
            )}

            {activeTab === 'barbers' && (
              <BarbersList
                onSelectBarber={(barber) => handleOpenBookingModal(undefined, barber)}
              />
            )}

            {activeTab === 'my-appointments' && (
              <MyAppointments
                onOpenBookingModal={() => handleOpenBookingModal()}
              />
            )}

            {(activeTab === 'dashboard' || activeTab === 'admin' || activeTab === 'staff-dashboard') && (
              <TenantOwnerDashboard initialTab={dashboardSubTab} />
            )}
          </>
        )}

        {/* LEVEL 2 SIMULATION: Barber Shop Operational Dashboard (Tenant Owner & Staff) */}
        {simulationLevel === 2 && (
          <div className="p-2 sm:p-4">
            <TenantOwnerDashboard initialTab={dashboardSubTab} />
          </div>
        )}

        {/* LEVEL 3 SIMULATION: Barber Individual Dashboard */}
        {simulationLevel === 3 && (
          <div className="p-2 sm:p-4">
            <StaffDashboard />
          </div>
        )}
      </main>

      <Footer />

      <BookingModal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        preselectedService={preselectedService}
        preselectedBarber={preselectedBarber}
        onBookingSuccess={handleBookingSuccess}
      />
    </div>
  );
}

export default function App() {
  const [simulationLevel, setSimulationLevel] = useState<SimulationLevel>(1);
  const [activeTab, setActiveTab] = useState<string>('home');

  // Check if running directly as embedded widget (e.g. ?widget=true or ?embed=true)
  const queryParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const isWidgetMode = queryParams.get('widget') === 'true' || queryParams.get('embed') === 'true';
  const levelFromQuery = queryParams.get('level');

  useEffect(() => {
    if (levelFromQuery) {
      const parsed = parseInt(levelFromQuery, 10) as SimulationLevel;
      if (parsed === 1 || parsed === 2 || parsed === 3) {
        setSimulationLevel(parsed);
      }
    }
  }, [levelFromQuery]);

  const handleSelectSimulationLevel = (level: SimulationLevel) => {
    setSimulationLevel(level);
    if (level === 1) {
      setActiveTab('home');
    } else if (level === 2) {
      setActiveTab('dashboard');
    } else if (level === 3) {
      setActiveTab('admin');
    }
  };

  const handleShowVisualNotice = () => {};

  return (
    <ThemeProvider>
      <AuthProvider>
        {isWidgetMode ? (
          /* Pure Embedded Widget Mode (No browser window mockup frame) */
          <div className="w-full min-h-screen bg-zinc-950 text-zinc-100 font-sans">
            <MainContent
              simulationLevel={simulationLevel}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              onShowVisualNotice={handleShowVisualNotice}
            />
          </div>
        ) : (
          /* Standard Interactive Simulator Mode */
          <div className="min-h-screen h-screen w-full bg-zinc-950 flex flex-col overflow-hidden">
            {/* Browser Window Mockup Widget */}
            <div className="flex-1 w-full h-full">
              <BrowserWindowMockup
                activeLevel={simulationLevel}
                activeTab={activeTab}
                onNavigateHome={() => setActiveTab('home')}
                onRefreshView={() => handleShowVisualNotice()}
                onTriggerVisualNotice={handleShowVisualNotice}
                simulationBar={
                  <SimulationTopBar
                    activeLevel={simulationLevel}
                    onSelectLevel={handleSelectSimulationLevel}
                    onResetSimulation={() => {
                      setSimulationLevel(1);
                      setActiveTab('home');
                    }}
                    onTriggerVisualNotice={handleShowVisualNotice}
                  />
                }
              >
                <MainContent
                  simulationLevel={simulationLevel}
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  onShowVisualNotice={handleShowVisualNotice}
                />
              </BrowserWindowMockup>
            </div>
          </div>
        )}
      </AuthProvider>
    </ThemeProvider>
  );
}

