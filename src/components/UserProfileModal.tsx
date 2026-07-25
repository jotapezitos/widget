import React, { useState, useEffect } from 'react';
import { X, User, Phone, Crown, Calendar, CheckCircle2, XCircle, Clock, Sparkles, LogOut, Edit2, Save, ShieldCheck } from 'lucide-react';
import { db, collection, query, where, onSnapshot } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Appointment } from '../types';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToAppointments: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  onNavigateToAppointments,
}) => {
  const { user, userProfile, updateProfile, logout, isSuperAdmin, isTenantOwner, isStaff } = useAuth();
  
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingApts, setLoadingApts] = useState<boolean>(true);
  
  // Phone edit state
  const [isEditingPhone, setIsEditingPhone] = useState<boolean>(false);
  const [phoneInput, setPhoneInput] = useState<string>('');
  const [isSavingPhone, setIsSavingPhone] = useState<boolean>(false);

  useEffect(() => {
    if (userProfile?.phone) {
      setPhoneInput(userProfile.phone);
    }
  }, [userProfile]);

  // Fetch client's service history in real-time
  useEffect(() => {
    if (!isOpen || !user) {
      setLoadingApts(false);
      return;
    }

    const q = query(
      collection(db, 'appointments'),
      where('clientId', '==', user.uid)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: Appointment[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Appointment, 'id'>),
        }));

        // Sort by date/time descending
        list.sort((a, b) => {
          const dtA = `${a.date}T${a.time}`;
          const dtB = `${b.date}T${b.time}`;
          return dtB.localeCompare(dtA);
        });

        setAppointments(list);
        setLoadingApts(false);
      },
      (error) => {
        console.error('Error loading profile service history:', error);
        setLoadingApts(false);
      }
    );

    return () => unsub();
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  const handleSavePhone = async () => {
    if (!phoneInput.trim()) return;
    setIsSavingPhone(true);
    try {
      if (updateProfile) {
        await updateProfile({ phone: phoneInput.trim() });
      }
      setIsEditingPhone(false);
    } catch (err) {
      console.error('Error saving phone number:', err);
    } finally {
      setIsSavingPhone(false);
    }
  };

  // Stats calculation
  const totalCount = appointments.length;
  const completedCount = appointments.filter((a) => a.status === 'completed').length;
  const cancelledCount = appointments.filter((a) => a.status === 'cancelled').length;
  const totalSpent = appointments
    .filter((a) => a.status === 'completed' || a.status === 'scheduled')
    .reduce((sum, a) => sum + (a.servicePrice || 0), 0);

  const isSubscriber = userProfile?.isSubscriber ?? true; // Default VIP loyalty client

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white text-zinc-900 border-2 border-black rounded-3xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] my-8 overflow-hidden">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between p-5 bg-amber-400 border-b-2 border-black">
          <div className="flex items-center gap-2 font-bebas text-2xl font-black uppercase text-black tracking-wide">
            <User className="w-6 h-6" /> PERFIL DO CLIENTE
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-black text-white hover:bg-zinc-800 transition-all border border-black cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          
          {/* User Profile Info Card */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-5 rounded-2xl bg-zinc-50 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
            {userProfile?.photoUrl || user.photoURL ? (
              <img
                src={userProfile?.photoUrl || user.photoURL || ''}
                alt={userProfile?.name || user.displayName || 'Avatar'}
                className="w-20 h-20 rounded-full border-2 border-black ring-4 ring-amber-400 object-cover shrink-0"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-amber-400 text-black border-2 border-black flex items-center justify-center font-bebas text-3xl font-black shrink-0">
                {(userProfile?.name || user.displayName || 'U').charAt(0).toUpperCase()}
              </div>
            )}

            <div className="flex-1 text-center sm:text-left space-y-2">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h3 className="font-bebas font-black text-2xl text-black uppercase tracking-wide">
                  {userProfile?.name || user.displayName || 'Cliente Demo'}
                </h3>

                {/* VIP / Subscriber Badge */}
                <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-black border border-black font-bebas font-bold text-xs uppercase tracking-wider flex items-center gap-1 shadow-sm">
                  <Crown className="w-3.5 h-3.5 fill-black" />
                  {isSubscriber ? 'ASSINANTE VIP' : 'CLIENTE FIDELIDADE'}
                </span>

                {isSuperAdmin && (
                  <span className="px-2 py-0.5 rounded-full bg-red-600 text-white font-bebas text-xs font-bold uppercase">
                    SUPER ADMIN
                  </span>
                )}
                {isTenantOwner && (
                  <span className="px-2 py-0.5 rounded-full bg-black text-amber-400 font-bebas text-xs font-bold uppercase">
                    GESTOR
                  </span>
                )}
                {isStaff && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white font-bebas text-xs font-bold uppercase">
                    BARBEIRO
                  </span>
                )}
              </div>

              <p className="text-xs text-zinc-600 font-medium">{user.email}</p>

              {/* Phone / WhatsApp Field with Inline Edit */}
              <div className="pt-1 flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs font-bold text-black">
                <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
                {isEditingPhone ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSavePhone();
                        }
                      }}
                      placeholder="(11) 98765-4321"
                      className="bg-white border-2 border-black rounded-lg px-2.5 py-1 text-xs font-bold text-black focus:outline-none"
                    />
                    <button
                      onClick={handleSavePhone}
                      disabled={isSavingPhone}
                      className="px-2.5 py-1 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-black border border-black font-bebas font-bold text-xs flex items-center gap-1 uppercase shadow-sm cursor-pointer"
                    >
                      <Save className="w-3 h-3" />
                      {isSavingPhone ? 'Salvando...' : 'Salvar'}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-zinc-800">
                      {userProfile?.phone || phoneInput || 'WhatsApp não cadastrado'}
                    </span>
                    <button
                      onClick={() => setIsEditingPhone(true)}
                      className="p-1 rounded bg-zinc-200 hover:bg-zinc-300 text-black border border-black text-[10px] flex items-center gap-1 uppercase font-bebas font-bold cursor-pointer"
                      title="Editar número do WhatsApp"
                    >
                      <Edit2 className="w-3 h-3" /> Editar
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stats Summary Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-zinc-50 border-2 border-black p-3.5 rounded-2xl text-center space-y-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <span className="text-[11px] font-bebas font-bold text-zinc-500 uppercase tracking-wider block">
                Total Agendado
              </span>
              <span className="text-2xl font-bebas font-black text-black block">
                {totalCount}
              </span>
            </div>

            <div className="bg-emerald-50 border-2 border-black p-3.5 rounded-2xl text-center space-y-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <span className="text-[11px] font-bebas font-bold text-emerald-800 uppercase tracking-wider block">
                Concluídos
              </span>
              <span className="text-2xl font-bebas font-black text-emerald-700 block">
                {completedCount}
              </span>
            </div>

            <div className="bg-rose-50 border-2 border-black p-3.5 rounded-2xl text-center space-y-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <span className="text-[11px] font-bebas font-bold text-rose-800 uppercase tracking-wider block">
                Cancelados
              </span>
              <span className="text-2xl font-bebas font-black text-rose-700 block">
                {cancelledCount}
              </span>
            </div>

            <div className="bg-amber-50 border-2 border-black p-3.5 rounded-2xl text-center space-y-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <span className="text-[11px] font-bebas font-bold text-amber-900 uppercase tracking-wider block">
                Investido em Estilo
              </span>
              <span className="text-2xl font-bebas font-black text-amber-800 block">
                R$ {totalSpent.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Service History Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b-2 border-black pb-2">
              <h4 className="font-bebas font-black text-xl text-black uppercase tracking-wide flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-500" /> HISTÓRICO DE SERVIÇOS & STATUS
              </h4>
              <span className="text-xs font-bold text-zinc-500 font-bebas uppercase">
                {appointments.length} REGISTROS
              </span>
            </div>

            {loadingApts ? (
              <div className="py-8 text-center text-xs font-bold text-zinc-500 animate-pulse">
                Carregando histórico de cortes...
              </div>
            ) : appointments.length === 0 ? (
              <div className="py-8 text-center bg-zinc-50 border-2 border-dashed border-zinc-300 rounded-2xl space-y-2">
                <Sparkles className="w-8 h-8 text-amber-400 mx-auto" />
                <p className="text-xs font-bold text-zinc-600 uppercase">
                  Nenhum agendamento realizado ainda.
                </p>
                <p className="text-[11px] text-zinc-500">
                  Agende seu primeiro corte na régua agora mesmo!
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {appointments.map((apt) => {
                  const isCompleted = apt.status === 'completed';
                  const isCancelled = apt.status === 'cancelled';
                  const isScheduled = apt.status === 'scheduled';

                  return (
                    <div
                      key={apt.id}
                      className="p-3.5 rounded-2xl bg-white border-2 border-black flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bebas font-bold text-lg text-black uppercase">
                            {apt.serviceName}
                          </span>
                          <span className="text-xs font-bebas font-bold text-zinc-900 bg-amber-300 px-2 py-0.5 rounded border border-black">
                            R$ {apt.servicePrice.toFixed(2)}
                          </span>
                        </div>

                        <div className="text-xs text-zinc-600 font-medium flex items-center gap-3 flex-wrap">
                          <span className="flex items-center gap-1 text-black font-bold">
                            <User className="w-3.5 h-3.5 text-amber-500" /> {apt.barberName}
                          </span>
                          <span className="flex items-center gap-1 font-mono">
                            <Clock className="w-3.5 h-3.5 text-zinc-400" /> {apt.date} às {apt.time}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        {isScheduled && (
                          <span className="px-3 py-1 rounded-full bg-amber-400 text-black border border-black font-bebas font-bold text-xs uppercase flex items-center gap-1 shadow-sm">
                            <Clock className="w-3.5 h-3.5" /> AGENDADO
                          </span>
                        )}
                        {isCompleted && (
                          <span className="px-3 py-1 rounded-full bg-emerald-400 text-black border border-black font-bebas font-bold text-xs uppercase flex items-center gap-1 shadow-sm">
                            <CheckCircle2 className="w-3.5 h-3.5" /> CONCLUÍDO
                          </span>
                        )}
                        {isCancelled && (
                          <span className="px-3 py-1 rounded-full bg-rose-400 text-black border border-black font-bebas font-bold text-xs uppercase flex items-center gap-1 shadow-sm">
                            <XCircle className="w-3.5 h-3.5" /> CANCELADO
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Actions Bottom Bar */}
          <div className="pt-4 border-t-2 border-black flex items-center justify-end">
            <button
              onClick={() => {
                onClose();
                onNavigateToAppointments();
              }}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black border-2 border-black font-bebas font-bold text-base shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Calendar className="w-4 h-4" />
              Ver Meus Agendamentos
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
