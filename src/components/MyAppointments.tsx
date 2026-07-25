import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Calendar, Clock, Scissors, User, AlertCircle, XCircle, CheckCircle2, Sparkles, RefreshCw, CreditCard, LogIn, Trash2, Hourglass } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Appointment } from '../types';
import { useAuth } from '../context/AuthContext';
import { AVAILABLE_HOURS, DEFAULT_APPOINTMENTS } from '../data/initialData';
import { requestClientReschedule, checkAutomaticNotifications } from '../lib/notifications';

interface MyAppointmentsProps {
  onOpenBookingModal: () => void;
}

export const MyAppointments: React.FC<MyAppointmentsProps> = ({ onOpenBookingModal }) => {
  const { user, signInWithGoogle } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Reschedule state
  const [reschedulingApt, setReschedulingApt] = useState<Appointment | null>(null);
  const [newDate, setNewDate] = useState<string>('');
  const [newTime, setNewTime] = useState<string>('');

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'cancel' | 'delete';
    appointmentId: string;
    title: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!user) {
      const demoList = DEFAULT_APPOINTMENTS.filter(
        (a) => a.clientId === 'demo_client_jean' || a.clientEmail === 'jeanmarceloop@gmail.com'
      );
      setAppointments(demoList);
      setLoading(false);
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

        // Sort descending by date and time
        list.sort((a, b) => {
          const dateA = `${a.date}T${a.time}`;
          const dateB = `${b.date}T${b.time}`;
          return dateB.localeCompare(dateA);
        });

        if (list.length === 0) {
          const demoList = DEFAULT_APPOINTMENTS.filter(
            (a) => a.clientId === 'demo_client_jean' || a.clientEmail === 'jeanmarceloop@gmail.com'
          );
          setAppointments(demoList);
        } else {
          setAppointments(list);
        }
        setLoading(false);

        // Trigger automatic reminders & retention checks
        checkAutomaticNotifications(user.uid, list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'appointments');
        const demoList = DEFAULT_APPOINTMENTS.filter(
          (a) => a.clientId === 'demo_client_jean' || a.clientEmail === 'jeanmarceloop@gmail.com'
        );
        setAppointments(demoList);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  const handleRequestCancel = (id: string) => {
    if (!user) {
      alert('Modo de Demonstração (Visitante): O cancelamento de agendamentos está desativado na apresentação demonstrativa.');
      return;
    }
    setConfirmModal({
      isOpen: true,
      type: 'cancel',
      appointmentId: id,
      title: 'Cancelar Agendamento',
      message: 'Deseja realmente cancelar este agendamento?',
    });
  };

  const handleRequestDelete = (id: string) => {
    if (!user) {
      alert('Modo de Demonstração (Visitante): A exclusão de agendamentos está desativada na apresentação demonstrativa.');
      return;
    }
    setConfirmModal({
      isOpen: true,
      type: 'delete',
      appointmentId: id,
      title: 'Excluir do Histórico',
      message: 'Deseja realmente excluir este agendamento do seu histórico?',
    });
  };

  const handleExecuteConfirmedAction = async () => {
    if (!confirmModal) return;
    const { type, appointmentId } = confirmModal;
    setConfirmModal(null);

    if (type === 'cancel') {
      setAppointments((prev) =>
        prev.map((a) => (a.id === appointmentId ? { ...a, status: 'cancelled' } : a))
      );
      if (user) {
        try {
          await updateDoc(doc(db, 'appointments', appointmentId), {
            status: 'cancelled',
          });
        } catch (error) {
          console.warn('Erro ao atualizar no Firestore (modo demonstração mantido):', error);
        }
      }
    } else if (type === 'delete') {
      setAppointments((prev) => prev.filter((a) => a.id !== appointmentId));
      if (user) {
        try {
          await deleteDoc(doc(db, 'appointments', appointmentId));
        } catch (error) {
          console.warn('Erro ao excluir no Firestore (modo demonstração mantido):', error);
        }
      }
    }
  };

  const handleConfirmReschedule = async () => {
    if (!reschedulingApt || !newDate || !newTime) return;
    setAppointments((prev) =>
      prev.map((a) =>
        a.id === reschedulingApt.id
          ? { ...a, date: newDate, time: newTime, status: 'reschedule_requested' }
          : a
      )
    );
    if (user) {
      try {
        await requestClientReschedule(reschedulingApt, newDate, newTime);
      } catch (error) {
        console.warn('Erro ao solicitar reagendamento via Firestore:', error);
      }
    }
    setReschedulingApt(null);
  };

  return (
    <div className="py-12 bg-zinc-50 text-zinc-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {!user && (
          <div className="bg-amber-100 border-2 border-black rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-400 border-2 border-black rounded-xl shrink-0">
                <Sparkles className="w-5 h-5 text-black" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-black font-bebas uppercase tracking-wide">
                  Modo de Demonstração (Visão do Cliente)
                </p>
                <p className="text-xs text-zinc-700 font-medium leading-relaxed">
                  Abaixo você visualiza a tela em tempo real de &quot;Meus Agendamentos&quot; com os cortes e horários agendados sem precisar realizar login.
                </p>
              </div>
            </div>
          </div>
        )}
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-zinc-200 pb-6">
          <div>
            <div className="hidden sm:inline-flex items-center gap-2 px-3.5 py-1 rounded-lg bg-amber-400 text-black border-2 border-black text-xs font-black uppercase tracking-widest mb-2 font-bebas text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <Calendar className="w-4 h-4 text-black" />
              Self-Service do Cliente
            </div>
            <h2 className="text-4xl font-bebas font-bold text-black uppercase">
              Meus Agendamentos
            </h2>
          </div>

          <button
            onClick={onOpenBookingModal}
            className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black text-sm border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all font-bebas uppercase tracking-wider text-base"
          >
            + Agendar Novo Horário
          </button>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((n) => (
              <div key={n} className="h-32 bg-zinc-200 rounded-2xl animate-pulse border-2 border-zinc-300" />
            ))}
          </div>
        ) : appointments.length === 0 ? (
          <div className="bg-white border-2 border-black rounded-2xl p-12 text-center space-y-4 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
            <Clock className="w-12 h-12 text-amber-500 mx-auto" />
            <h3 className="text-2xl font-bold font-bebas text-black uppercase">
              Nenhum agendamento encontrado
            </h3>
            <p className="text-xs text-zinc-600 max-w-sm mx-auto font-medium">
              Você ainda não agendou nenhum horário. Escolha seu serviço e garanta o visual perfeito.
            </p>
            <button
              onClick={onOpenBookingModal}
              className="px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black text-sm border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all inline-block font-bebas uppercase tracking-wider text-base"
            >
              Agendar Agora
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {appointments.map((apt) => {
              const isScheduled = apt.status === 'scheduled' || apt.status === 'in_progress';
              const isReschedulePending = apt.status === 'reschedule_requested';
              const isCompleted = apt.status === 'completed';
              const isCancelled = apt.status === 'cancelled';
              const isPrepaid = apt.paymentType === 'online_pix' || apt.paymentType === 'online_card';

              return (
                <div
                  key={apt.id}
                  className={`bg-white rounded-2xl p-6 border-2 transition-all flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] ${
                    isScheduled || isReschedulePending
                      ? 'border-black'
                      : isCompleted
                      ? 'border-zinc-400 opacity-90'
                      : 'border-zinc-300 opacity-70'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider border-2 border-black font-bebas ${
                          isScheduled
                            ? 'bg-amber-400 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                            : isReschedulePending
                            ? 'bg-amber-200 text-amber-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                            : isCompleted
                            ? 'bg-emerald-300 text-black'
                            : 'bg-rose-200 text-rose-900'
                        }`}
                      >
                        {isScheduled
                          ? 'Confirmado'
                          : isReschedulePending
                          ? '⏳ Remarcação em Análise'
                          : isCompleted
                          ? 'Atendido'
                          : 'Cancelado'}
                      </span>

                      <span className="text-sm font-black text-black bg-zinc-100 px-2 py-0.5 rounded border border-black font-bebas">
                        R$ {apt.servicePrice.toFixed(2)}
                      </span>

                      {isPrepaid ? (
                        <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-400 flex items-center gap-1">
                          <CreditCard className="w-3 h-3 text-emerald-700" /> Pago via PIX
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-zinc-100 text-zinc-900 border border-zinc-400">
                          Pagar no Local
                        </span>
                      )}
                    </div>

                    <h3 className="text-2xl font-bebas font-bold text-black uppercase tracking-wider">
                      {apt.serviceName}
                    </h3>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-800 pt-1 font-semibold">
                      <div className="flex items-center gap-1.5 bg-zinc-100 px-3 py-1.5 rounded-lg border border-black">
                        <Calendar className="w-4 h-4 text-black" />
                        <span>{apt.date.split('-').reverse().join('/')}</span>
                      </div>

                      <div className="flex items-center gap-1.5 bg-zinc-100 px-3 py-1.5 rounded-lg border border-black">
                        <Clock className="w-4 h-4 text-black" />
                        <span>{apt.time} ({apt.serviceDuration} min)</span>
                      </div>

                      <div className="flex items-center gap-1.5 bg-zinc-100 px-3 py-1.5 rounded-lg border border-black">
                        <User className="w-4 h-4 text-black" />
                        <span>Barbeiro: {apt.barberName}</span>
                      </div>
                    </div>

                    {isReschedulePending && apt.requestedDate && (
                      <div className="mt-2 bg-amber-100 border border-amber-400 p-2.5 rounded-xl text-xs text-amber-900 font-bold flex items-center gap-2">
                        <Hourglass className="w-4 h-4 text-amber-700 animate-spin" />
                        <span>
                          Solicitada remarcação para:{' '}
                          <strong>
                            {apt.requestedDate.split('-').reverse().join('/')} às {apt.requestedTime}h
                          </strong>{' '}
                          (Aguardando aprovação do barbeiro)
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {isScheduled && (
                      <>
                        <button
                          onClick={() => {
                            setReschedulingApt(apt);
                            setNewDate(apt.date);
                            setNewTime(apt.time);
                          }}
                          className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black border-2 border-black text-xs font-black transition-all flex items-center gap-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bebas uppercase tracking-wider text-sm"
                        >
                          <RefreshCw className="w-4 h-4" /> Reagendar
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRequestCancel(apt.id)}
                          className="px-3.5 py-2 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-900 border-2 border-black text-xs font-bold transition-all flex items-center gap-1.5 font-bebas uppercase tracking-wider text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5"
                        >
                          <XCircle className="w-4 h-4 text-rose-700" /> Cancelar
                        </button>
                      </>
                    )}

                    {isReschedulePending && (
                      <button
                        type="button"
                        onClick={() => handleRequestCancel(apt.id)}
                        className="px-3.5 py-2 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-900 border-2 border-black text-xs font-bold transition-all flex items-center gap-1.5 font-bebas uppercase tracking-wider text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5"
                      >
                        <XCircle className="w-4 h-4 text-rose-700" /> Cancelar Solicitação
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleRequestDelete(apt.id)}
                      className="px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-rose-100 text-black hover:text-rose-900 border-2 border-black text-xs font-bold transition-all flex items-center gap-1.5 font-bebas uppercase tracking-wider text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5"
                      title="Excluir do histórico"
                    >
                      <Trash2 className="w-4 h-4 text-rose-600" /> Excluir
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* RE-SCHEDULE MODAL */}
        {reschedulingApt && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border-2 border-black rounded-2xl p-6 max-w-md w-full space-y-4 text-zinc-900 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <h3 className="font-bebas font-bold text-2xl text-black flex items-center gap-2 border-b-2 border-black pb-2 uppercase">
                <RefreshCw className="w-5 h-5 text-amber-500" /> Reagendamento Autônomo
              </h3>
              <p className="text-xs text-zinc-600 leading-relaxed font-medium">
                Escolha a nova data e horário para seu atendimento com <strong>{reschedulingApt.barberName}</strong>.
              </p>

              <div>
                <label className="block text-xs font-bold text-black uppercase mb-1">Nova Data</label>
                <input
                  type="date"
                  value={newDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-amber-400 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-black uppercase mb-1">Novo Horário (Grade de Horários)</label>
                <select
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-amber-400 font-medium"
                >
                  {!AVAILABLE_HOURS.includes(newTime) && newTime && (
                    <option value={newTime}>{newTime} (Horário Atual)</option>
                  )}
                  {AVAILABLE_HOURS.map((hour) => (
                    <option key={hour} value={hour}>
                      {hour} h
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t-2 border-zinc-100">
                <button
                  onClick={() => setReschedulingApt(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-200 text-black text-xs font-bold border border-black hover:bg-zinc-300 uppercase font-bebas text-base"
                >
                  Manter Anterior
                </button>
                <button
                  onClick={handleConfirmReschedule}
                  className="px-4 py-2 rounded-xl bg-amber-400 text-black font-black border-2 border-black text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase font-bebas text-base"
                >
                  Confirmar Novo Horário
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CONFIRMATION MODAL (NO BROWSER ALERT / CONFIRM) */}
        {confirmModal && confirmModal.isOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border-2 border-black rounded-2xl p-6 max-w-md w-full space-y-4 text-zinc-900 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <h3 className="font-bebas font-bold text-2xl text-black flex items-center gap-2 border-b-2 border-black pb-2 uppercase">
                <AlertCircle className="w-6 h-6 text-rose-600" />
                {confirmModal.title}
              </h3>
              <p className="text-sm font-medium text-zinc-700 leading-relaxed">
                {confirmModal.message}
              </p>

              <div className="flex justify-end gap-3 pt-4 border-t-2 border-zinc-100">
                <button
                  type="button"
                  onClick={() => setConfirmModal(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-200 hover:bg-zinc-300 text-black font-bebas font-bold text-base border-2 border-black uppercase"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={handleExecuteConfirmedAction}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bebas font-bold text-base border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase tracking-wider"
                >
                  Sim, Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

