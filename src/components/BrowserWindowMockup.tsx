import React, { useState } from 'react';
import {
  Globe,
  Lock,
  RotateCw,
  ArrowLeft,
  ArrowRight,
  Home,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { SimulationLevel } from './SimulationTopBar';
import { useTheme } from '../context/ThemeContext';

interface BrowserWindowMockupProps {
  children: React.ReactNode;
  activeLevel: SimulationLevel;
  activeTab: string;
  onNavigateHome: () => void;
  onRefreshView: () => void;
  onTriggerVisualNotice?: () => void;
  simulationBar?: React.ReactNode;
}

export const BrowserWindowMockup: React.FC<BrowserWindowMockupProps> = ({
  children,
  activeLevel,
  activeTab,
  onNavigateHome,
  onRefreshView,
  onTriggerVisualNotice,
  simulationBar,
}) => {
  const { isDarkMode } = useTheme();
  const [isFullscreen, setIsFullscreen] = useState(false);

  const levelInfo = {
    1: {
      name: 'Visão Cliente',
      path: `/cliente/${activeTab}`,
    },
    2: {
      name: 'Painel Gestor',
      path: `/barbearia/gestao`,
    },
    3: {
      name: 'SaaS SuperAdmin',
      path: `/platform/superadmin`,
    },
  }[activeLevel];

  const fullUrl = `https://kauanbarber.com${levelInfo.path}`;

  return (
    <div className="w-full h-screen bg-zinc-950 font-sans text-zinc-100 flex flex-col select-none overflow-hidden">
      
      {/* Outer Browser Mockup Container Widget */}
      <div className="w-full h-full transition-all duration-300 bg-zinc-950 flex flex-col overflow-hidden">
        
        {/* ==================== 1. BROWSER CHROME HEADER & WINDOW CONTROLS ==================== */}
        <div className="bg-zinc-900 border-b-2 border-zinc-800 px-3 py-2.5 flex flex-col gap-2 shrink-0">
          
          {/* Top Window Bar: Traffic Lights + Tabs */}
          <div className="flex items-center justify-start gap-3">
            
            {/* macOS Style Traffic Light Dots */}
            <div className="flex items-center gap-2 shrink-0 pr-1">
              <button
                onClick={onTriggerVisualNotice}
                className="w-3.5 h-3.5 rounded-full bg-rose-500 hover:bg-rose-600 border border-rose-700 transition-colors cursor-pointer"
                title="Fechar janela"
              />
              <button
                onClick={onTriggerVisualNotice}
                className="w-3.5 h-3.5 rounded-full bg-amber-500 hover:bg-amber-600 border border-amber-700 transition-colors cursor-pointer"
                title="Minimizar janela"
              />
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="w-3.5 h-3.5 rounded-full bg-emerald-500 hover:bg-emerald-600 border border-emerald-700 transition-colors cursor-pointer"
                title={isFullscreen ? 'Sair do modo Tela Cheia' : 'Expandir para Tela Cheia'}
              />
            </div>

            {/* Browser Tabs - Aligned directly on the left */}
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none justify-start">
              
              {/* Active Tab */}
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-t-xl bg-zinc-800 border-t-2 border-x-2 border-zinc-700 text-white font-bebas text-sm sm:text-base tracking-wide shrink-0">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="truncate max-w-[200px] sm:max-w-[280px]">
                  BARBA & ESTILO | Barbearia Moderna
                </span>
                <span className="text-zinc-500 text-xs hover:text-white cursor-pointer ml-1" onClick={onTriggerVisualNotice}>
                  ✕
                </span>
              </div>

              <button
                onClick={onTriggerVisualNotice}
                className="p-1 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 text-xs font-bold ml-1"
                title="Nova guia"
              >
                +
              </button>
            </div>

          </div>

          {/* Bottom Address Bar Row */}
          <div className="flex items-center gap-2">
            
            {/* Navigation Buttons */}
            <div className="flex items-center gap-1 shrink-0 text-zinc-400">
              <button
                onClick={onNavigateHome}
                className="p-1.5 rounded-lg hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
                title="Voltar para a página inicial"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button
                onClick={onTriggerVisualNotice}
                className="p-1.5 rounded-lg hover:bg-zinc-800 hover:text-zinc-500 transition-colors opacity-50 cursor-not-allowed"
                title="Avançar"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={onRefreshView}
                className="p-1.5 rounded-lg hover:bg-zinc-800 hover:text-amber-400 transition-colors cursor-pointer"
                title="Recarregar"
              >
                <RotateCw className="w-4 h-4" />
              </button>
              <button
                onClick={onNavigateHome}
                className="p-1.5 rounded-lg hover:bg-zinc-800 hover:text-amber-400 transition-colors cursor-pointer"
                title="Início"
              >
                <Home className="w-4 h-4" />
              </button>
            </div>

            {/* URL Address Bar Input */}
            <div className="flex-1 bg-zinc-950 border border-zinc-700/80 rounded-xl px-3 py-1.5 flex items-center justify-between gap-2 text-xs font-mono text-zinc-300 shadow-inner overflow-hidden">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate text-zinc-200 select-all font-semibold">
                  {fullUrl}
                </span>
              </div>
            </div>

          </div>

        </div>

        {/* ==================== 3. MAIN BROWSER VIEWPORT BODY ==================== */}
        <div className={`simulated-window flex-1 w-full overflow-y-auto relative flex flex-col transition-colors duration-300 ${isDarkMode ? 'dark bg-zinc-950 text-zinc-100' : 'bg-zinc-50 text-zinc-900'}`}>
          <div className="flex-1 w-full">
            {children}
          </div>
        </div>

        {/* ==================== 4. SIMULATION BAR AT VERY BOTTOM ==================== */}
        {simulationBar && (
          <div className="w-full shrink-0 border-t border-zinc-800 bg-zinc-950">
            {simulationBar}
          </div>
        )}

      </div>
    </div>
  );
};
