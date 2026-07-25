import React, { useState } from 'react';
import { User, Building2, Scissors, Monitor } from 'lucide-react';

export type SimulationLevel = 1 | 2 | 3;

interface SimulationTopBarProps {
  activeLevel: SimulationLevel;
  onSelectLevel: (level: SimulationLevel) => void;
  onResetSimulation?: () => void;
  onTriggerVisualNotice?: () => void;
}

export const SimulationTopBar: React.FC<SimulationTopBarProps> = ({
  activeLevel,
  onSelectLevel,
  onTriggerVisualNotice,
}) => {
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

  const levels = [
    {
      id: 1 as SimulationLevel,
      title: 'Visão Cliente',
      subtitle: 'Portal de Serviços & Agendamento',
      badge: 'Visão Cliente',
      icon: User,
      color: 'bg-amber-400 text-black border-amber-300',
      activeBorder: 'ring-2 ring-amber-400 ring-offset-2 ring-offset-zinc-950 shadow-[0_0_15px_rgba(250,204,21,0.4)]',
      desc: 'Simula a experiência do cliente final marcando horários, escolhendo serviços e barbeiros.',
    },
    {
      id: 2 as SimulationLevel,
      title: 'Painel Gestor',
      subtitle: 'Painel Gestor & Agenda do Balcão',
      badge: 'Painel Gestor',
      icon: Building2,
      color: 'bg-blue-600 text-white border-blue-400',
      activeBorder: 'ring-2 ring-blue-500 ring-offset-2 ring-offset-zinc-950 shadow-[0_0_15px_rgba(59,130,246,0.4)]',
      desc: 'Simula a operação diária da barbearia: agenda de barbeiros, caixa, faturamento e gestão da equipe.',
    },
    {
      id: 3 as SimulationLevel,
      title: 'Painel Barbeiro',
      subtitle: 'Agenda, Comissões & Atendimentos',
      badge: 'Painel Barbeiro',
      icon: Scissors,
      color: 'bg-emerald-600 text-white border-emerald-400',
      activeBorder: 'ring-2 ring-emerald-500 ring-offset-2 ring-offset-zinc-950 shadow-[0_0_15px_rgba(16,185,129,0.4)]',
      desc: 'Simula a visão individual do barbeiro: sua fila do dia, comissões e horários agendados.',
    },
  ];

  return (
    <>
      {/* Simulation Control Bar - Fixed inside browser window bottom */}
      <div className="w-full bg-zinc-950 text-white px-3 py-2.5 sm:px-6 select-none">
        <div className="max-w-7xl mx-auto flex items-center justify-center">

          {/* View Selector Buttons Container with enough padding so rings/glows aren't clipped */}
          <div className="flex items-center justify-center gap-2.5 sm:gap-4 overflow-x-auto py-2 px-2 scrollbar-none">
            {levels.map((lvl) => {
              const Icon = lvl.icon;
              const isActive = activeLevel === lvl.id;

              return (
                <button
                  key={lvl.id}
                  onClick={() => {
                    onSelectLevel(lvl.id);
                    if (onTriggerVisualNotice) onTriggerVisualNotice();
                  }}
                  className={`flex items-center gap-2 px-4 sm:px-5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer border ${
                    isActive
                      ? `${lvl.color} ${lvl.activeBorder}`
                      : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-800 hover:border-zinc-700'
                  }`}
                  title={lvl.desc}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-current' : 'text-amber-400'}`} />
                  <div className="text-left leading-tight">
                    <div className="font-bebas text-sm sm:text-base tracking-wide flex items-center gap-1.5">
                      <span>{lvl.title}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

        </div>
      </div>

      {/* Info Modal Dialog */}
      {isInfoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-none">
          <div className="bg-zinc-900 border-2 border-zinc-700 text-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Monitor className="w-5 h-5 text-amber-400" />
                <h3 className="font-bebas text-2xl tracking-wide text-amber-400">
                  SISTEMA EM MODO DEMONSTRATIVO ESTÁTICO
                </h3>
              </div>
              <button
                onClick={() => setIsInfoModalOpen(false)}
                className="text-zinc-400 hover:text-white font-bold p-1 rounded-lg hover:bg-zinc-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-sm text-zinc-300 leading-relaxed font-sans">
              <p className="bg-amber-400/10 border border-amber-400/30 p-3 rounded-xl text-amber-300 text-xs">
                ⚡ <strong>Aviso Importante:</strong> O sistema foi configurado como um protótipo visual demonstrativo. Todas as animações contínuas foram congeladas para garantir foco estático de navegação.
              </p>

              <p className="font-semibold text-white">Alternar entre os 3 Níveis de Simulação:</p>

              <ul className="space-y-2 text-xs">
                <li className="p-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700">
                  <strong className="text-amber-400 block font-bebas text-sm tracking-wide">NÍVEL 1: CLIENTE & AGENDAMENTO</strong>
                  Apresenta o fluxo de catálogo de cortes, lista de barbeiros e sistema de reserva de horários sob a perspectiva do cliente.
                </li>
                <li className="p-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700">
                  <strong className="text-blue-400 block font-bebas text-sm tracking-wide">NÍVEL 2: BARBEARIA & EQUIPE (GESTOR)</strong>
                  Apresenta a rotina de gestão diária, controle de caixa, agenda de barbeiros e lista de clientes para o proprietário da barbearia.
                </li>
                <li className="p-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700">
                  <strong className="text-emerald-400 block font-bebas text-sm tracking-wide">NÍVEL 3: PAINEL DO BARBEIRO</strong>
                  Apresenta a visão individual da equipe: comissões líquidas, fila de atendimentos do dia e bloqueio de horários.
                </li>
              </ul>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setIsInfoModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-amber-400 text-black font-bebas text-base font-extrabold border border-black hover:bg-amber-300 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
              >
                Entendi, Continuar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
