import React, { useState, useEffect, useRef } from 'react';
import { Scissors, Calendar, User, Shield, LogOut, Sparkles, Clock, Crown, Building2, Sun, Moon, Home, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { UserProfileModal } from './UserProfileModal';
import { NotificationBell } from './NotificationBell';
import { SupportShortcutIcon } from './SupportShortcutIcon';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenBookingModal: () => void;
  onOpenInbox?: () => void;
  simulationLevel?: number;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, onOpenBookingModal, onOpenInbox, simulationLevel = 1 }) => {
  const { user, userProfile, signInWithGoogle, logout, isSuperAdmin, isTenantOwner, isStaff } = useAuth();
  const { isDarkMode, toggleTheme, logoUrl } = useTheme();
  const [isScrolled, setIsScrolled] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const topHeaderRef = useRef<HTMLElement | null>(null);

  const isInternalPanel = simulationLevel === 2 || simulationLevel === 3;
  const isGestorView = simulationLevel === 2;
  const isBarberView = simulationLevel === 3;

  const handleDisabledNavClick = () => {
    alert('Modo Painel Interno: A navegação de cliente (Serviços, Barbeiros, Agendamentos) está desativada no painel do gestor e do barbeiro.');
  };

  const handleDisabledBookingClick = () => {
    alert('Modo Painel Interno: O agendamento de horários está desativado na visão de gestão do sistema.');
  };

  useEffect(() => {
    const handleScroll = () => {
      if (topHeaderRef.current) {
        const rect = topHeaderRef.current.getBoundingClientRect();
        // Sticky bar appears ONLY when the main hero header has completely scrolled off screen
        setIsScrolled(rect.bottom <= 0);
      }
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, []);

  return (
    <>
      {/* ==================== 1. TOP HERO BRAND HEADER (In Document Flow) ==================== */}
      <header ref={topHeaderRef} className="w-full bg-white text-zinc-900 py-4 sm:py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col items-center justify-center gap-4">
          
          {/* Top Utilities (Dark Mode Toggle & Auth) */}
          <div className="w-full flex items-center justify-between gap-4 pb-2">
            
            {/* Theme Toggle Button replacing the old badge */}
            <button
              onClick={toggleTheme}
              className="text-xs font-bebas font-bold text-black tracking-widest uppercase flex items-center gap-2 bg-amber-400 hover:bg-amber-300 px-3.5 py-1.5 rounded-full border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:scale-105 active:scale-95 cursor-pointer select-none"
              title={isDarkMode ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro'}
            >
              {isDarkMode ? (
                <>
                  <Sun className="w-4 h-4 text-black fill-black" />
                  <span className="text-sm font-extrabold">MODO CLARO</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-black fill-black" />
                  <span className="text-sm font-extrabold">MODO ESCURO</span>
                </>
              )}
            </button>

            {/* Auth Profile / Login & Mobile Panel Icons */}
            <div className="flex items-center gap-2">
              <NotificationBell onOpenBookingModal={isInternalPanel ? () => {} : onOpenBookingModal} />
              
              {onOpenInbox && (
                <SupportShortcutIcon
                  onOpenInbox={onOpenInbox}
                  activeTab={activeTab}
                />
              )}

              {/* Mobile Panel Buttons (Icon-only, visible only on mobile sm:hidden) */}
              <div className="flex items-center gap-1.5 sm:hidden">
                {isTenantOwner && (
                  <button
                    onClick={() => setActiveTab('dashboard')}
                    className={`p-2 rounded-full border-2 border-black transition-all flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                      activeTab === 'dashboard'
                        ? 'bg-amber-400 text-black'
                        : 'bg-zinc-100 text-amber-800 hover:bg-amber-100'
                    }`}
                    title="Painel Gestor"
                  >
                    <Building2 className="w-4 h-4 text-black" />
                  </button>
                )}

                {isStaff && (
                  <button
                    onClick={() => setActiveTab('staff-dashboard')}
                    className={`p-2 rounded-full border-2 border-black transition-all flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                      activeTab === 'staff-dashboard'
                        ? 'bg-amber-400 text-black'
                        : 'bg-zinc-100 text-amber-800 hover:bg-amber-100'
                    }`}
                    title="Painel Barbeiro"
                  >
                    <Scissors className="w-4 h-4 text-black" />
                  </button>
                )}
              </div>

              {isGestorView ? (
                <div className="flex items-center gap-2 bg-zinc-100 border-2 border-black p-1 pl-3 rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <button
                    type="button"
                    onClick={() => alert('Perfil demonstrativo de Gestor (não editável nesta apresentação).')}
                    className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-default"
                    title="Perfil de Gestor Simulado (Logado)"
                  >
                    <span className="text-xs font-bold text-zinc-900 max-w-[120px] truncate hidden sm:inline">
                      Carlos Gestor
                    </span>
                    <img
                      src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200"
                      alt="Carlos Gestor"
                      className="w-7 h-7 rounded-full border border-black ring-2 ring-amber-400 object-cover"
                    />
                  </button>
                </div>
              ) : isBarberView ? (
                <div className="flex items-center gap-2 bg-zinc-100 border-2 border-black p-1 pl-3 rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <button
                    type="button"
                    onClick={() => alert('Perfil demonstrativo do Barbeiro Kauan Lima (não editável nesta apresentação).')}
                    className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-default"
                    title="Perfil do Barbeiro Kauan Lima (Logado)"
                  >
                    <span className="text-xs font-bold text-zinc-900 max-w-[120px] truncate hidden sm:inline">
                      Kauan Lima
                    </span>
                    <img
                      src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=200"
                      alt="Kauan Lima"
                      className="w-7 h-7 rounded-full border border-black ring-2 ring-amber-400 object-cover"
                    />
                  </button>
                </div>
              ) : user ? (
                <div className="flex items-center gap-2 bg-zinc-100 border-2 border-black p-1 pl-3 rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <button
                    onClick={() => setIsProfileModalOpen(true)}
                    className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer"
                    title="Ver meu resumo de perfil e histórico"
                  >
                    <span className="text-xs font-bold text-zinc-900 max-w-[120px] truncate hidden sm:inline">
                      {userProfile?.name || user.displayName || 'Usuário'}
                    </span>
                    {userProfile?.photoUrl || user.photoURL ? (
                      <img
                        src={userProfile?.photoUrl || user.photoURL || ''}
                        alt={userProfile?.name || user.displayName || 'Avatar'}
                        className="w-7 h-7 rounded-full border border-black ring-2 ring-amber-400 object-cover"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-amber-400 text-black font-bold flex items-center justify-center border border-black">
                        <User className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </button>
                  <button
                    onClick={logout}
                    title="Sair da conta"
                    className="p-1.5 text-zinc-500 hover:text-rose-600 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={signInWithGoogle}
                  className="px-4 py-1.5 rounded-full bg-black text-amber-400 hover:bg-zinc-800 border-2 border-black text-xs font-extrabold transition-all flex items-center gap-1.5 font-bebas tracking-wide text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                >
                  <User className="w-3.5 h-3.5" />
                  Entrar
                </button>
              )}
            </div>
          </div>

          {/* Centered Large Hero Brand Logo (Clean transparent image with mode awareness) */}
          <div
            onClick={() => setActiveTab('home')}
            className="cursor-pointer group py-1 flex items-center justify-center transition-transform duration-300 hover:scale-[1.02]"
          >
            <img
              src={logoUrl}
              alt="Logo Barbearia Kauan"
              referrerPolicy="no-referrer"
              className="h-24 sm:h-32 md:h-40 w-auto max-w-[90vw] object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>

          {/* Main Navigation Bar & Primary CTA (Desktop/Tablet) */}
          <div className="hidden sm:flex flex-row items-center justify-center gap-3 pt-1">
            <nav className="flex items-center gap-1.5 bg-zinc-100/90 backdrop-blur-md p-1.5 rounded-full border-2 border-black text-xs font-medium shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] max-w-full justify-center">
              <button
                onClick={isInternalPanel ? handleDisabledNavClick : () => setActiveTab('home')}
                disabled={isInternalPanel}
                className={`px-4 py-2 rounded-full transition-all duration-200 shrink-0 ${
                  isInternalPanel
                    ? 'text-zinc-400 opacity-60 cursor-not-allowed hover:bg-transparent'
                    : activeTab === 'home'
                    ? 'bg-black text-amber-400 font-extrabold shadow-sm'
                    : 'text-zinc-700 hover:text-black hover:bg-zinc-200/70'
                }`}
                title={isInternalPanel ? 'Navegação do cliente desativada no modo painel interno' : 'Início'}
              >
                Início
              </button>

              <button
                onClick={isInternalPanel ? handleDisabledNavClick : () => setActiveTab('services')}
                disabled={isInternalPanel}
                className={`px-4 py-2 rounded-full transition-all duration-200 shrink-0 ${
                  isInternalPanel
                    ? 'text-zinc-400 opacity-60 cursor-not-allowed hover:bg-transparent'
                    : activeTab === 'services'
                    ? 'bg-black text-amber-400 font-extrabold shadow-sm'
                    : 'text-zinc-700 hover:text-black hover:bg-zinc-200/70'
                }`}
                title={isInternalPanel ? 'Navegação do cliente desativada no modo painel interno' : 'Serviços'}
              >
                Serviços
              </button>

              <button
                onClick={isInternalPanel ? handleDisabledNavClick : () => setActiveTab('barbers')}
                disabled={isInternalPanel}
                className={`px-4 py-2 rounded-full transition-all duration-200 shrink-0 ${
                  isInternalPanel
                    ? 'text-zinc-400 opacity-60 cursor-not-allowed hover:bg-transparent'
                    : activeTab === 'barbers'
                    ? 'bg-black text-amber-400 font-extrabold shadow-sm'
                    : 'text-zinc-700 hover:text-black hover:bg-zinc-200/70'
                }`}
                title={isInternalPanel ? 'Navegação do cliente desativada no modo painel interno' : 'Barbeiros'}
              >
                Barbeiros
              </button>

              <button
                onClick={isInternalPanel ? handleDisabledNavClick : () => setActiveTab('my-appointments')}
                disabled={isInternalPanel}
                className={`px-4 py-2 rounded-full transition-all duration-200 shrink-0 flex items-center gap-1.5 ${
                  isInternalPanel
                    ? 'text-zinc-400 opacity-60 cursor-not-allowed hover:bg-transparent'
                    : activeTab === 'my-appointments'
                    ? 'bg-black text-amber-400 font-extrabold shadow-sm'
                    : 'text-zinc-700 hover:text-black hover:bg-zinc-200/70'
                }`}
                title={isInternalPanel ? 'Navegação do cliente desativada no modo painel interno' : 'Meus Agendamentos'}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Meus Agendamentos</span>
              </button>

              {/* Internal Active Panel Tab Highlight */}
              {isGestorView && (
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className="px-4 py-2 rounded-full font-bebas font-bold uppercase tracking-wider text-sm bg-amber-400 text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] shrink-0 flex items-center gap-1.5 cursor-default"
                >
                  <Building2 className="w-4 h-4 text-black" />
                  <span>Painel do Gestor</span>
                </button>
              )}

              {isBarberView && (
                <button
                  onClick={() => setActiveTab('staff-dashboard')}
                  className="px-4 py-2 rounded-full font-bebas font-bold uppercase tracking-wider text-sm bg-amber-400 text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] shrink-0 flex items-center gap-1.5 cursor-default"
                >
                  <Scissors className="w-4 h-4 text-black" />
                  <span>Painel do Barbeiro</span>
                </button>
              )}
            </nav>

            <button
              onClick={isInternalPanel ? (e) => e.preventDefault() : onOpenBookingModal}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full border-2 border-black bg-amber-400 hover:bg-amber-300 text-black font-extrabold uppercase tracking-wider font-bebas text-lg shrink-0 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-0.5 hover:translate-y-0.5 cursor-pointer"
            >
              <Clock className="w-5 h-5" />
              Agendar Horário
            </button>
          </div>

          {/* ==================== MOBILE FLOATING PILL NAV & CLOCK CTA ==================== */}
          <div className="fixed bottom-3 inset-x-3 z-50 flex items-center justify-center gap-2 sm:hidden pointer-events-none">
            
            {/* White Pill Navigation Container */}
            <nav className="pointer-events-auto flex items-center gap-0.5 bg-zinc-100/95 backdrop-blur-md px-1.5 py-1.5 rounded-full border-2 border-black text-xs font-medium shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] max-w-full overflow-hidden">
              {isGestorView ? (
                <div className="px-3 py-1.5 rounded-full bg-amber-400 text-black font-bebas font-bold text-xs uppercase border border-black shrink-0 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Painel Gestor</span>
                </div>
              ) : isBarberView ? (
                <div className="px-3 py-1.5 rounded-full bg-amber-400 text-black font-bebas font-bold text-xs uppercase border border-black shrink-0 flex items-center gap-1">
                  <Scissors className="w-3.5 h-3.5" />
                  <span>Painel Barbeiro</span>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setActiveTab('home');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className={`px-2 py-1.5 rounded-full transition-all duration-200 shrink-0 ${
                      activeTab === 'home'
                        ? 'bg-black text-amber-400 font-extrabold shadow-sm'
                        : 'text-zinc-700 hover:text-black'
                    }`}
                  >
                    Início
                  </button>

                  <button
                    onClick={() => setActiveTab('services')}
                    className={`px-2 py-1.5 rounded-full transition-all duration-200 shrink-0 ${
                      activeTab === 'services'
                        ? 'bg-black text-amber-400 font-extrabold shadow-sm'
                        : 'text-zinc-700 hover:text-black'
                    }`}
                  >
                    Serviços
                  </button>

                  <button
                    onClick={() => setActiveTab('barbers')}
                    className={`px-2 py-1.5 rounded-full transition-all duration-200 shrink-0 ${
                      activeTab === 'barbers'
                        ? 'bg-black text-amber-400 font-extrabold shadow-sm'
                        : 'text-zinc-700 hover:text-black'
                    }`}
                  >
                    Barbeiros
                  </button>

                  <button
                    onClick={() => setActiveTab('my-appointments')}
                    className={`px-2 py-1.5 rounded-full transition-all duration-200 shrink-0 flex items-center ${
                      activeTab === 'my-appointments'
                        ? 'bg-black text-amber-400 font-extrabold shadow-sm'
                        : 'text-zinc-700 hover:text-black'
                    }`}
                  >
                    <span className="whitespace-nowrap">Agenda</span>
                  </button>
                </>
              )}
            </nav>

            {/* Clock Schedule Button */}
            <button
              onClick={isInternalPanel ? (e) => e.preventDefault() : onOpenBookingModal}
              title="Agendar Horário"
              className="pointer-events-auto p-2.5 rounded-full border-2 border-black bg-amber-400 active:bg-amber-300 text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center shrink-0 cursor-pointer transition-transform active:scale-95"
            >
              <Clock className="w-5 h-5 text-black" />
            </button>

          </div>

        </div>
      </header>

      {/* ==================== 2. STICKY COMPACT HEADER (Appears on Scroll) ==================== */}
      <div
        className={`sticky top-0 left-0 right-0 z-40 w-full bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-b-2 border-black dark:border-white shadow-md py-2 px-4 sm:px-6 lg:px-8 transition-all duration-300 ease-in-out ${
          isScrolled
            ? 'translate-y-0 opacity-100 pointer-events-auto block'
            : '-translate-y-full opacity-0 pointer-events-none hidden'
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* Left Compact Brand Logo */}
          <div
            onClick={() => {
              setActiveTab('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="cursor-pointer flex items-center shrink-0"
          >
            <img
              src={logoUrl}
              alt="Logo Barbearia Kauan"
              referrerPolicy="no-referrer"
              className="h-10 sm:h-12 w-auto max-w-[180px] sm:max-w-[260px] object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1.5 bg-zinc-100/90 backdrop-blur-sm p-1 rounded-full border border-zinc-200 text-xs font-medium">
            <button
              onClick={isInternalPanel ? handleDisabledNavClick : () => setActiveTab('home')}
              disabled={isInternalPanel}
              className={`px-3.5 py-1.5 rounded-full transition-all duration-200 ${
                isInternalPanel
                  ? 'text-zinc-400 opacity-60 cursor-not-allowed hover:bg-transparent'
                  : activeTab === 'home'
                  ? 'bg-black text-amber-400 font-extrabold shadow-sm'
                  : 'text-zinc-700 hover:text-black hover:bg-zinc-200/70'
              }`}
              title={isInternalPanel ? 'Navegação do cliente desativada no modo painel interno' : 'Início'}
            >
              Início
            </button>

            <button
              onClick={isInternalPanel ? handleDisabledNavClick : () => setActiveTab('services')}
              disabled={isInternalPanel}
              className={`px-3.5 py-1.5 rounded-full transition-all duration-200 ${
                isInternalPanel
                  ? 'text-zinc-400 opacity-60 cursor-not-allowed hover:bg-transparent'
                  : activeTab === 'services'
                  ? 'bg-black text-amber-400 font-extrabold shadow-sm'
                  : 'text-zinc-700 hover:text-black hover:bg-zinc-200/70'
              }`}
              title={isInternalPanel ? 'Navegação do cliente desativada no modo painel interno' : 'Serviços'}
            >
              Serviços
            </button>

            <button
              onClick={isInternalPanel ? handleDisabledNavClick : () => setActiveTab('barbers')}
              disabled={isInternalPanel}
              className={`px-3.5 py-1.5 rounded-full transition-all duration-200 ${
                isInternalPanel
                  ? 'text-zinc-400 opacity-60 cursor-not-allowed hover:bg-transparent'
                  : activeTab === 'barbers'
                  ? 'bg-black text-amber-400 font-extrabold shadow-sm'
                  : 'text-zinc-700 hover:text-black hover:bg-zinc-200/70'
              }`}
              title={isInternalPanel ? 'Navegação do cliente desativada no modo painel interno' : 'Barbeiros'}
            >
              Barbeiros
            </button>

            <button
              onClick={isInternalPanel ? handleDisabledNavClick : () => setActiveTab('my-appointments')}
              disabled={isInternalPanel}
              className={`px-3.5 py-1.5 rounded-full transition-all duration-200 flex items-center gap-1.5 ${
                isInternalPanel
                  ? 'text-zinc-400 opacity-60 cursor-not-allowed hover:bg-transparent'
                  : activeTab === 'my-appointments'
                  ? 'bg-black text-amber-400 font-extrabold shadow-sm'
                  : 'text-zinc-700 hover:text-black hover:bg-zinc-200/70'
              }`}
              title={isInternalPanel ? 'Navegação do cliente desativada no modo painel interno' : 'Agendamentos'}
            >
              <Calendar className="w-3.5 h-3.5" />
              Agendamentos
            </button>

            {isGestorView && (
              <button
                onClick={() => setActiveTab('dashboard')}
                className="px-3.5 py-1.5 rounded-full font-bebas font-bold uppercase text-xs bg-amber-400 text-black border border-black shadow-sm flex items-center gap-1.5 cursor-default shrink-0"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Painel Gestor</span>
              </button>
            )}

            {isBarberView && (
              <button
                onClick={() => setActiveTab('staff-dashboard')}
                className="px-3.5 py-1.5 rounded-full font-bebas font-bold uppercase text-xs bg-amber-400 text-black border border-black shadow-sm flex items-center gap-1.5 cursor-default shrink-0"
              >
                <Scissors className="w-3.5 h-3.5" />
                <span>Painel Barbeiro</span>
              </button>
            )}
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2.5">
            {/* Mobile Panel Buttons (Icon-only, visible only on mobile sm:hidden) */}
            <div className="flex items-center gap-1.5 sm:hidden">
              {isSuperAdmin && (
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`p-2 rounded-full border-2 border-black transition-all flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                    activeTab === 'dashboard'
                      ? 'bg-amber-400 text-black'
                      : 'bg-zinc-100 text-amber-800 hover:bg-amber-100'
                  }`}
                  title="Painel Super Admin"
                >
                  <Crown className="w-4 h-4 text-black" />
                </button>
              )}

              {isTenantOwner && (
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`p-2 rounded-full border-2 border-black transition-all flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                    activeTab === 'dashboard'
                      ? 'bg-amber-400 text-black'
                      : 'bg-zinc-100 text-amber-800 hover:bg-amber-100'
                  }`}
                  title="Painel Gestor"
                >
                  <Building2 className="w-4 h-4 text-black" />
                </button>
              )}

              {isStaff && (
                <button
                  onClick={() => setActiveTab('staff-dashboard')}
                  className={`p-2 rounded-full border-2 border-black transition-all flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                    activeTab === 'staff-dashboard'
                      ? 'bg-amber-400 text-black'
                      : 'bg-zinc-100 text-amber-800 hover:bg-amber-100'
                  }`}
                  title="Painel Barbeiro"
                >
                  <Scissors className="w-4 h-4 text-black" />
                </button>
              )}
            </div>

            <NotificationBell onOpenBookingModal={onOpenBookingModal} />

            <button
              onClick={toggleTheme}
              className="p-2 rounded-full bg-amber-400 hover:bg-amber-300 text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:scale-105 active:scale-95 cursor-pointer shrink-0"
              title={isDarkMode ? 'Modo Claro' : 'Modo Escuro'}
            >
              {isDarkMode ? <Sun className="w-4 h-4 fill-black text-black" /> : <Moon className="w-4 h-4 fill-black text-black" />}
            </button>

            <button
              onClick={isInternalPanel ? (e) => e.preventDefault() : onOpenBookingModal}
              className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-full bg-amber-400 hover:bg-amber-300 text-black font-extrabold border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-0.5 hover:translate-y-0.5 uppercase tracking-wider font-bebas text-base shrink-0 cursor-pointer"
            >
              <Clock className="w-4 h-4" />
              Agendar
            </button>

            {user ? (
              <div className="flex items-center gap-2 bg-zinc-100 border border-zinc-200 p-1 pl-2.5 rounded-full">
                <button
                  onClick={() => setIsProfileModalOpen(true)}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer"
                  title="Ver meu resumo de perfil e histórico"
                >
                  <span className="text-xs font-bold text-zinc-900 max-w-[100px] truncate hidden sm:inline">
                    {userProfile?.name || user.displayName || 'Usuário'}
                  </span>
                  {userProfile?.photoUrl || user.photoURL ? (
                    <img
                      src={userProfile?.photoUrl || user.photoURL || ''}
                      alt={userProfile?.name || user.displayName || 'Avatar'}
                      className="w-6 h-6 rounded-full border border-black ring-1 ring-amber-400 object-cover"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-amber-400 text-black font-bold flex items-center justify-center border border-black text-[10px]">
                      <User className="w-3 h-3" />
                    </div>
                  )}
                </button>
                <button
                  onClick={logout}
                  title="Sair da conta"
                  className="p-1 text-zinc-500 hover:text-rose-600 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={signInWithGoogle}
                className="px-3.5 py-1.5 rounded-full bg-black text-amber-400 hover:bg-zinc-800 border-2 border-black text-xs font-extrabold transition-all flex items-center gap-1 font-bebas tracking-wide shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                <User className="w-3.5 h-3.5" />
                Entrar
              </button>
            )}
          </div>

        </div>
      </div>

      {/* User Profile Summary Modal */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onNavigateToAppointments={() => setActiveTab('my-appointments')}
      />
    </>
  );
};



