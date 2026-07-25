import React from 'react';
import { Scissors, MapPin, Phone, Clock, Instagram, ShieldCheck, Flame, Disc } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export const Footer: React.FC = () => {
  const { logoUrl } = useTheme();

  return (
    <footer className="hidden sm:block bg-white border-t-2 border-black text-zinc-800 py-12 text-sm bg-street-grid">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
        
        {/* Brand */}
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <img
              src={logoUrl}
              alt="Logo Barbearia"
              referrerPolicy="no-referrer"
              className="h-20 sm:h-24 w-auto max-w-[320px] object-contain self-start"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed font-medium">
            A referência em cortes modernos, platinado, barba alinhada e ambiente exclusivo. Onde o estilo e a tradição em barbearia se encontram.
          </p>
        </div>

        {/* Hours */}
        <div className="space-y-3">
          <h4 className="font-bebas text-black dark:text-white text-lg flex items-center gap-2 uppercase tracking-wider font-extrabold">
            <Clock className="w-4 h-4 text-amber-500" /> HORÁRIO DE ATENDIMENTO
          </h4>
          <ul className="text-xs space-y-1.5 text-zinc-700 dark:text-zinc-300 font-medium">
            <li className="flex justify-between">
              <span>Terça a Sexta:</span>
              <strong className="text-black dark:text-white font-extrabold">09h00 - 20h20</strong>
            </li>
            <li className="flex justify-between">
              <span>Sábado (Dia do Movimento):</span>
              <strong className="text-emerald-600 dark:text-emerald-400 font-extrabold">08h00 - 21h00</strong>
            </li>
            <li className="flex justify-between">
              <span>Domingo e Segunda:</span>
              <strong className="text-amber-600 dark:text-amber-400 font-extrabold">Fechado</strong>
            </li>
          </ul>
        </div>

        {/* Location & Contact */}
        <div className="space-y-3">
          <h4 className="font-bebas text-black dark:text-white text-lg flex items-center gap-2 uppercase tracking-wider font-extrabold">
            <MapPin className="w-4 h-4 text-amber-500" /> LOCALIZAÇÃO & CONTATO
          </h4>
          <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed font-medium">
            Av. Das Nações, 1000 - Zona Sul<br />
            São Paulo - SP
          </p>
          <div className="text-xs text-black dark:text-white font-bold flex items-center gap-1.5 pt-1">
            <Phone className="w-3.5 h-3.5 text-amber-500" /> WhatsApp: (11) 98765-4321
          </div>
        </div>

        {/* Social */}
        <div className="space-y-3">
          <h4 className="font-bebas text-black text-lg uppercase tracking-wider font-extrabold">
            REDES SOCIAIS
          </h4>
          <div className="flex items-center gap-3">
            <a
              href="#"
              className="w-10 h-10 rounded-xl bg-amber-400 hover:bg-amber-300 text-black border-2 border-black flex items-center justify-center transition-colors font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              title="Instagram da Barbearia"
            >
              <Instagram className="w-5 h-5" />
            </a>
          </div>
          <p className="text-[11px] text-zinc-500 pt-2 font-medium">
            © {new Date().getFullYear()} Kauan Barber. Todos os direitos reservados.
          </p>
        </div>

      </div>
    </footer>
  );
};
