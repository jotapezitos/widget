import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { Scissors, Clock, CheckCircle2, XCircle, AlertCircle, Phone, User, Coffee, Lock, Calendar, Sparkles, Play, ShieldAlert, RefreshCw, Trash2, ChevronLeft, ChevronRight, CalendarDays, Columns, Grid } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Appointment, AppointmentStatus, ScheduleBreak, Barber } from '../types';
import { useAuth } from '../context/AuthContext';
import { AVAILABLE_HOURS, DEFAULT_APPOINTMENTS } from '../data/initialData';
import {
  notifyCompletedService,
  notifyStaffReschedule,
  approveRescheduleRequest,
  rejectRescheduleRequest,
} from '../lib/notifications';

export const StaffDashboard: React.FC = () => {
  const { user, userProfile, isSubscriptionFrozen } = useAuth();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [breaks, setBreaks] = useState<ScheduleBreak[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [activeMainTab, setActiveMainTab] = useState<'agenda' | 'financeiro'>('agenda');
  const [loading, setLoading] = useState<boolean>(true);

  const checkFrozenAction = (): boolean => {
    if (isSubscriptionFrozen) {
      alert('A licença do sistema está temporariamente congelada pelo Administrador Master. O painel está em Modo Leitura. Fale com seu gestor para solicitar a reativação.');
      return true;
    }
    return false;
  };

  // Calendar View mode: 'daily' | 'weekly' | 'monthly'
  const [calendarView, setCalendarView] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  // Selected date filter (default to today YYYY-MM-DD)
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // Current month for monthly calendar navigation
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(new Date());

  // Reschedule state
  const [reschedulingApt, setReschedulingApt] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  const [rescheduleTime, setRescheduleTime] = useState<string>('');

  const getUnavailableTimesForReschedule = () => {
    if (!reschedulingApt) return new Set<string>();
    const barberId = reschedulingApt.barberId;
    const targetDate = rescheduleDate || reschedulingApt.date;
    const unavailable = new Set<string>();

    appointments.forEach((a) => {
      if (
        a.barberId === barberId &&
        a.date === targetDate &&
        a.id !== reschedulingApt.id &&
        a.status !== 'cancelled'
      ) {
        unavailable.add(a.time);
      }
    });

    breaks.forEach((b) => {
      if (
        b.date === targetDate &&
        (!b.barberId || b.barberId === 'all' || b.barberId === barberId)
      ) {
        const start = b.startTime;
        const end = b.endTime;
        AVAILABLE_HOURS.forEach((h) => {
          if ((h >= start && h < end) || h === start) {
            unavailable.add(h);
          }
        });
      }
    });

    return unavailable;
  };

  const unavailableRescheduleTimes = getUnavailableTimesForReschedule();

  // Quick Break / Task Block Modal State
  const [breakModalOpen, setBreakModalOpen] = useState<boolean>(false);
  const [breakReason, setBreakReason] = useState<string>('Pausa para Café');
  const [breakDate, setBreakDate] = useState<string>(selectedDate);
  const [breakStartTime, setBreakStartTime] = useState<string>('12:00');
  const [breakEndTime, setBreakEndTime] = useState<string>('13:00');

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'appointments'),
      (snapshot) => {
        const list: Appointment[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Appointment, 'id'>),
        }));

        list.sort((a, b) => a.time.localeCompare(b.time));
        setAppointments(list.length > 0 ? list : DEFAULT_APPOINTMENTS);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'appointments');
      }
    );

    const unsubBreaks = onSnapshot(collection(db, 'breaks'), (snap) => {
      setBreaks(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ScheduleBreak, 'id'>) })));
    });

    const unsubBarbers = onSnapshot(collection(db, 'barbers'), (snap) => {
      setBarbers(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Barber, 'id'>) })));
    });

    return () => {
      unsub();
      unsubBreaks();
      unsubBarbers();
    };
  }, []);

  // Current barber commission rate (default 70% for Kauan Lima / team)
  const currentBarberObj = barbers.find(
    (b) => b.name.includes('Kauan') || b.id === 'barber-1' || b.id === userProfile?.barberId || b.googleEmail === user?.email
  ) || barbers[0];
  const commissionRate = currentBarberObj?.commissionRate ?? 70;
  const barberMultiplier = commissionRate / 100;

  // Filter appointments specifically for Kauan Lima
  const myAppointments = appointments.filter((a) => {
    if (userProfile?.role === 'staff' && userProfile?.barberId) {
      return a.barberId === userProfile.barberId || a.barberName === userProfile.name;
    }
    return a.barberName?.includes('Kauan') || a.barberId === 'barber-1' || (currentBarberObj && (a.barberId === currentBarberObj.id || a.barberName === currentBarberObj.name));
  });

  const myPrepaidApts = myAppointments.filter((a) => (a.paymentType === 'online_pix' || a.paymentType === 'online_card') && a.status !== 'cancelled');
  const myCompletedLocalApts = myAppointments.filter((a) => a.paymentType === 'pay_at_location' && a.status === 'completed');

  const grossBarberRevenue = myAppointments.filter(a => a.status !== 'cancelled').reduce((sum, a) => sum + (a.servicePrice || 0), 0);
  const totalNetCommission = grossBarberRevenue * barberMultiplier;
  const houseRetentionCut = grossBarberRevenue * ((100 - commissionRate) / 100);

  const totalConsolidatedEarnings = totalNetCommission;
  const prepaidEarnings = myPrepaidApts.reduce((sum, a) => sum + (a.servicePrice || 0) * barberMultiplier, 0);
  const localCompletedEarnings = myCompletedLocalApts.reduce((sum, a) => sum + (a.servicePrice || 0) * barberMultiplier, 0);

  // Update Status in 1-Click with optimistic UI update
  const handleUpdateStatus = async (id: string, newStatus: AppointmentStatus) => {
    alert('Modo de Demonstração Visual: A alteração de status está desativada nesta apresentação.');
  };

  // Delete Appointment
  const handleDeleteAppointment = async (id: string) => {
    alert('Modo de Demonstração Visual: A exclusão de agendamentos está desativada nesta apresentação.');
  };

  // Delete Break / Blocked Time
  const handleDeleteBreak = async (id: string) => {
    alert('Modo de Demonstração Visual: A exclusão de bloqueios está desativada nesta apresentação.');
  };

  // Reschedule Appointment
  const handleConfirmReschedule = async () => {
    alert('Modo de Demonstração Visual: A remarcação de horários está desativada nesta apresentação.');
  };

  // Add Quick Break / Block Time
  const handleAddBreak = async () => {
    alert('Modo de Demonstração Visual: O bloqueio de horários está desativado nesta apresentação.');
  };

  // Filter appointments and breaks for this staff member
  const staffAppointments = myAppointments;

  const todayApts = staffAppointments.filter((a) => a.date === selectedDate && a.status !== 'cancelled');
  const todayBreaks = breaks.filter((b) => {
    if (userProfile?.role === 'staff' && userProfile?.barberId) {
      return b.barberId === userProfile.barberId && b.date === selectedDate;
    }
    return b.date === selectedDate;
  });
  const nextClient = todayApts.find((a) => a.status === 'scheduled' || a.status === 'in_progress');

  const completedTodayCount = staffAppointments.filter((a) => a.date === selectedDate && a.status === 'completed').length;
  const noShowTodayCount = staffAppointments.filter((a) => a.date === selectedDate && a.status === 'no_show').length;

  // Helpers for Monthly & Weekly views
  const getDaysInMonth = (year: number, month: number) => {
    const date = new Date(year, month, 1);
    const days: { dateStr: string; dayNumber: number; isCurrentMonth: boolean }[] = [];
    
    // Add padding days from previous month
    const firstDayIndex = date.getDay(); // 0 (Sun) to 6 (Sat)
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      days.push({
        dateStr: d.toISOString().split('T')[0],
        dayNumber: d.getDate(),
        isCurrentMonth: false,
      });
    }

    // Current month days
    const lastDay = new Date(year, month + 1, 0).getDate();
    for (let i = 1; i <= lastDay; i++) {
      const d = new Date(year, month, i);
      days.push({
        dateStr: d.toISOString().split('T')[0],
        dayNumber: i,
        isCurrentMonth: true,
      });
    }
    return days;
  };

  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();
  const monthDays = getDaysInMonth(year, month);
  const monthName = currentMonthDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  // Weekly view days (7 days starting from selectedDate or current week)
  const getWeeklyDays = () => {
    const base = new Date(selectedDate + 'T00:00:00');
    const dayOfWeek = base.getDay();
    const startOfWeek = new Date(base);
    startOfWeek.setDate(base.getDate() - dayOfWeek); // Sunday start

    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      weekDays.push({
        dateStr: d.toISOString().split('T')[0],
        dayName: d.toLocaleDateString('pt-BR', { weekday: 'short' }),
        dayNumber: d.getDate(),
      });
    }
    return weekDays;
  };

  const weeklyDays = getWeeklyDays();

  // Standardized time slots synchronized with client booking (AVAILABLE_HOURS) + any actual appointment/break times for the day
  const timeSlots = Array.from(
    new Set([
      ...AVAILABLE_HOURS,
      ...todayApts.map((a) => a.time),
      ...todayBreaks.map((b) => b.startTime),
    ])
  ).filter(Boolean).sort((a, b) => a.localeCompare(b));

  return (
    <div className="py-6 bg-zinc-50 text-zinc-900 min-h-screen bg-street-grid font-sans">
      <div className="max-w-4xl mx-auto px-4 space-y-6">
        
        {/* Frozen License Warning Banner */}
        {isSubscriptionFrozen && (
          <div className="bg-gradient-to-r from-rose-950 via-zinc-900 to-black text-white p-5 rounded-2xl border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-400 text-black flex items-center justify-center border-2 border-black shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <Lock className="w-5 h-5 animate-pulse text-black" />
              </div>
              <div className="space-y-0.5">
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/30 border border-rose-400 text-rose-200 text-[10px] font-bebas font-bold uppercase tracking-wider">
                  ❄️ Licença do Sistema Congelada
                </div>
                <h3 className="text-lg font-bebas font-bold text-amber-400 uppercase tracking-wide">
                  Painel em Modo Leitura
                </h3>
                <p className="text-xs text-zinc-300 font-medium leading-relaxed">
                  Você pode consultar sua agenda, relatórios e extratos. Alterações e novos agendamentos estão temporariamente pausados. Fale com seu gestor para reativação.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Header & Quick Actions */}
        <div className="bg-white border-2 border-black rounded-2xl p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-300 border-2 border-black text-black text-xs font-bebas font-bold uppercase tracking-wider mb-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <Scissors className="w-3.5 h-3.5" /> Agenda Profissional do Barbeiro
            </div>
            <h2 className="text-3xl font-bebas font-bold text-black uppercase tracking-wide">
              {userProfile?.name || user?.displayName || 'Kauan Lima'}
            </h2>
            <p className="text-xs text-zinc-600 font-semibold">Gerencie seus horários, bloqueios e compromissos</p>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <button
              onClick={() => {
                setBreakDate(selectedDate);
                setBreakModalOpen(true);
              }}
              className="flex-1 md:flex-initial px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 border-2 border-black text-black text-xs font-bebas font-bold flex items-center justify-center gap-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all uppercase tracking-wider"
            >
              <Lock className="w-4 h-4" /> Bloquear Horário / Tarefa
            </button>
          </div>
        </div>

        {/* Main Tab Selector: Agenda vs Financeiro */}
        <div className="flex items-center gap-2 bg-white border-2 border-black p-2 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <button
            onClick={() => setActiveMainTab('agenda')}
            className={`flex-1 py-3 px-5 rounded-xl font-bebas font-bold text-sm sm:text-base uppercase tracking-wider flex items-center justify-center gap-2 border-2 border-black transition-all ${
              activeMainTab === 'agenda'
                ? 'bg-amber-400 text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
            }`}
          >
            <Calendar className="w-4 h-4" /> Minha Agenda & Compromissos
          </button>
          <button
            onClick={() => setActiveMainTab('financeiro')}
            className={`flex-1 py-3 px-5 rounded-xl font-bebas font-bold text-sm sm:text-base uppercase tracking-wider flex items-center justify-center gap-2 border-2 border-black transition-all ${
              activeMainTab === 'financeiro'
                ? 'bg-amber-400 text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
            }`}
          >
            <span>💰</span> Meu Faturamento ({commissionRate}% Comissão)
          </button>
        </div>

        {activeMainTab === 'financeiro' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-white border-2 border-black rounded-2xl p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-6">
              <div>
                <h3 className="text-2xl font-bebas font-bold text-black uppercase flex items-center gap-2">
                  💰 Painel Financeiro & Faturamento do Barbeiro
                </h3>
                <p className="text-xs text-zinc-600 font-medium">
                  Acompanhe seus ganhos consolidados já descontando a taxa da barbearia ({commissionRate}% de comissão para você).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-amber-300 border-2 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <span className="text-xs font-bebas font-bold uppercase text-black">Faturamento Consolidado Líquido</span>
                  <h4 className="text-3xl font-bebas font-bold text-black mt-1">R$ {totalConsolidatedEarnings.toFixed(2)}</h4>
                  <p className="text-[11px] text-zinc-900 font-semibold mt-1">Sua comissão ({commissionRate}%) sobre serviços realizados</p>
                </div>

                <div className="bg-white border-2 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <span className="text-xs font-bebas font-bold uppercase text-zinc-600">Pagamento Antecipado (Pix/Cartão)</span>
                  <h4 className="text-2xl font-bebas font-bold text-black mt-1">R$ {prepaidEarnings.toFixed(2)}</h4>
                  <p className="text-[11px] text-zinc-500 font-semibold mt-1">Já creditado ({myPrepaidApts.length} agendamentos online)</p>
                </div>

                <div className="bg-white border-2 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <span className="text-xs font-bebas font-bold uppercase text-zinc-600">Pagar no Local (Concluídos)</span>
                  <h4 className="text-2xl font-bebas font-bold text-black mt-1">R$ {localCompletedEarnings.toFixed(2)}</h4>
                  <p className="text-[11px] text-zinc-500 font-semibold mt-1">Recebido no salão ({myCompletedLocalApts.length} atendimentos)</p>
                </div>
              </div>

              {/* Detailed List */}
              <div className="space-y-3 pt-4 border-t-2 border-black">
                <h4 className="font-bebas font-bold text-xl text-black uppercase">Detalhamento dos Atendimentos</h4>
                {myAppointments.filter(a => a.status === 'completed').length === 0 ? (
                  <p className="text-xs text-zinc-500 italic py-4">Nenhum atendimento concluído registrado ainda.</p>
                ) : (
                  <div className="space-y-2">
                    {myAppointments.filter(a => a.status === 'completed').map((apt) => {
                      const rawPrice = apt.servicePrice || 0;
                      const myEarnings = rawPrice * barberMultiplier;
                      return (
                        <div key={apt.id} className="bg-zinc-50 border-2 border-black rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bebas font-bold text-xs bg-black text-white px-2 py-0.5 rounded">{apt.date} • {apt.time}</span>
                              <span className="font-bold text-black text-sm">{apt.clientName}</span>
                              <span className="text-xs bg-white px-2 py-0.5 rounded border border-black font-semibold">{apt.serviceName}</span>
                            </div>
                            <p className="text-xs text-zinc-600 mt-1">
                              Valor do Serviço: R$ {rawPrice.toFixed(2)} — Pagamento: <strong className="text-black">{apt.paymentType}</strong>
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-bebas text-zinc-500 uppercase block">Sua Comissão ({commissionRate}%)</span>
                            <strong className="text-lg font-bebas font-bold text-emerald-700">R$ {myEarnings.toFixed(2)}</strong>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeMainTab === 'agenda' && (
          <>
            {/* PENDING RESCHEDULE REQUESTS BANNER */}
            {staffAppointments.filter((a) => a.status === 'reschedule_requested').length > 0 && (
              <div className="bg-amber-100 border-2 border-black rounded-2xl p-4 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] space-y-3">
                <div className="flex items-center gap-2 text-black font-bebas font-bold text-xl uppercase">
                  <RefreshCw className="w-5 h-5 text-amber-600 animate-spin" />
                  <span>Solicitações de Remarcação Pendentes ({staffAppointments.filter((a) => a.status === 'reschedule_requested').length})</span>
                </div>
                <div className="space-y-2">
                  {staffAppointments.filter((a) => a.status === 'reschedule_requested').map((apt) => (
                    <div key={apt.id} className="bg-white border-2 border-black rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      <div>
                        <div className="text-sm font-bold text-black">{apt.clientName} ({apt.clientPhone})</div>
                        <div className="text-xs text-zinc-600">
                          Serviço: <strong>{apt.serviceName}</strong>
                        </div>
                        <div className="text-xs text-amber-900 mt-1 font-semibold">
                          Horário Original: {apt.date.split('-').reverse().join('/')} às {apt.time}h ➔ <span className="bg-amber-300 px-1.5 py-0.5 rounded border border-black font-bold">Solicitado: {apt.requestedDate?.split('-').reverse().join('/')} às {apt.requestedTime}h</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                        <button
                          onClick={() => approveRescheduleRequest(apt)}
                          className="flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-black font-bebas font-bold text-xs border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-1 uppercase cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" /> Aprovar
                        </button>
                        <button
                          onClick={() => rejectRescheduleRequest(apt)}
                          className="flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg bg-rose-200 hover:bg-rose-300 text-rose-900 font-bebas font-bold text-xs border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-1 uppercase cursor-pointer"
                        >
                          <XCircle className="w-4 h-4 text-rose-700" /> Recusar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CALENDAR VIEW SELECTOR & DATE / NAVIGATION BAR */}
            <div className="bg-white border-2 border-black rounded-2xl p-4 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b-2 border-zinc-100 pb-3">
            {/* View Mode Tabs */}
            <div className="flex items-center gap-1.5 bg-zinc-100 p-1.5 rounded-2xl border-2 border-black w-full sm:w-auto">
              <button
                onClick={() => setCalendarView('daily')}
                className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bebas font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                  calendarView === 'daily'
                    ? 'bg-amber-400 text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                    : 'text-zinc-700 hover:text-black'
                }`}
              >
                <Columns className="w-4 h-4" /> Visão Diária
              </button>
              <button
                onClick={() => setCalendarView('weekly')}
                className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bebas font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                  calendarView === 'weekly'
                    ? 'bg-amber-400 text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                    : 'text-zinc-700 hover:text-black'
                }`}
              >
                <Grid className="w-4 h-4" /> Visão Semanal
              </button>
              <button
                onClick={() => setCalendarView('monthly')}
                className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bebas font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                  calendarView === 'monthly'
                    ? 'bg-amber-400 text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                    : 'text-zinc-700 hover:text-black'
                }`}
              >
                <CalendarDays className="w-4 h-4" /> Visão Mensal
              </button>
            </div>

            {/* Date Quick Picker / Today Button */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 border-2 border-black rounded-xl text-xs font-bebas font-bold uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                Hoje
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-zinc-50 border-2 border-black text-black font-bold rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:bg-amber-50"
              />
            </div>
          </div>

          {/* 1. MONTHLY CALENDAR VIEW */}
          {calendarView === 'monthly' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <h3 className="font-bebas font-bold text-xl text-black uppercase tracking-wider capitalize">
                  📅 {monthName}
                </h3>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentMonthDate(new Date(year, month - 1, 1))}
                    className="p-2 rounded-xl bg-zinc-100 hover:bg-amber-300 border-2 border-black transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                    title="Mês Anterior"
                  >
                    <ChevronLeft className="w-4 h-4 text-black" />
                  </button>
                  <button
                    onClick={() => setCurrentMonthDate(new Date(year, month + 1, 1))}
                    className="p-2 rounded-xl bg-zinc-100 hover:bg-amber-300 border-2 border-black transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                    title="Próximo Mês"
                  >
                    <ChevronRight className="w-4 h-4 text-black" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-2 text-center">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
                  <div key={d} className="text-xs font-bebas font-bold text-zinc-500 uppercase tracking-widest py-1">
                    {d}
                  </div>
                ))}

                {monthDays.map((item, idx) => {
                  const dayAptsCount = staffAppointments.filter((a) => a.date === item.dateStr && a.status !== 'cancelled').length;
                  const dayBreaksCount = breaks.filter((b) => b.date === item.dateStr).length;
                  const isSelected = selectedDate === item.dateStr;
                  const isToday = item.dateStr === new Date().toISOString().split('T')[0];

                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        setSelectedDate(item.dateStr);
                        setCalendarView('daily');
                      }}
                      className={`p-2 rounded-xl border-2 transition-all text-left flex flex-col justify-between h-20 sm:h-24 ${
                        isSelected
                          ? 'bg-amber-400 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] ring-2 ring-black'
                          : isToday
                          ? 'bg-amber-50 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                          : item.isCurrentMonth
                          ? 'bg-white border-black hover:bg-zinc-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                          : 'bg-zinc-100 border-zinc-300 opacity-50'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className={`text-xs font-bold ${isToday ? 'bg-black text-amber-300 px-1.5 py-0.5 rounded-md font-bebas' : 'text-black'}`}>
                          {item.dayNumber}
                        </span>
                        {isToday && <span className="text-[9px] font-bebas bg-black text-white px-1 rounded">Hoje</span>}
                      </div>

                      <div className="space-y-0.5 w-full">
                        {dayAptsCount > 0 && (
                          <div className="text-[10px] font-bebas bg-black text-amber-300 px-1 py-0.5 rounded truncate text-center font-bold">
                            ✂️ {dayAptsCount} agend.
                          </div>
                        )}
                        {dayBreaksCount > 0 && (
                          <div className="text-[10px] font-bebas bg-rose-200 text-rose-900 border border-black px-1 py-0.5 rounded truncate text-center font-bold">
                            🔒 {dayBreaksCount} bloqueios
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. WEEKLY CALENDAR VIEW */}
          {calendarView === 'weekly' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <h3 className="font-bebas font-bold text-xl text-black uppercase tracking-wider">
                  📆 Visão Semanal da Equipe
                </h3>
                <span className="text-xs text-zinc-600 font-bold">Mostrando 7 dias da semana</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-7 gap-3">
                {weeklyDays.map((wd, idx) => {
                  const dayApts = staffAppointments.filter((a) => a.date === wd.dateStr && a.status !== 'cancelled');
                  const dayBreaks = breaks.filter((b) => b.date === wd.dateStr);
                  const isSelected = selectedDate === wd.dateStr;

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        setSelectedDate(wd.dateStr);
                        setCalendarView('daily');
                      }}
                      className={`p-3 rounded-2xl border-2 cursor-pointer transition-all space-y-2 ${
                        isSelected
                          ? 'bg-amber-300 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                          : 'bg-white border-black hover:bg-zinc-50 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                      }`}
                    >
                      <div className="flex items-center justify-between border-b border-zinc-200 pb-1.5">
                        <span className="text-xs font-bebas font-bold uppercase text-zinc-600">{wd.dayName}</span>
                        <span className="text-base font-bebas font-bold text-black bg-white px-2 py-0.5 rounded-lg border border-black">
                          {wd.dayNumber}
                        </span>
                      </div>

                      <div className="space-y-1 text-xs">
                        <div className="font-bold text-black">✂️ {dayApts.length} cortes</div>
                        <div className="font-bold text-rose-700">🔒 {dayBreaks.length} bloqueios</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. DAILY GOOGLE CALENDAR-LIKE TIMELINE VIEW */}
          {calendarView === 'daily' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <h3 className="font-bebas font-bold text-xl text-black uppercase tracking-wider flex items-center gap-2">
                  ⏰ Grade Horária Diária (Google Agenda Style) — {new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                </h3>
              </div>

              {/* Time Slots Grid */}
              <div className="bg-white border-2 border-black rounded-2xl overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] divide-y-2 divide-black">
                {timeSlots.map((slotTime) => {
                  // Find appointments at this exact time slot
                  const slotApts = todayApts.filter((a) => a.time === slotTime);
                  // Find breaks overlapping this time slot
                  const slotBreaks = todayBreaks.filter((b) => slotTime >= b.startTime && slotTime < b.endTime);

                  return (
                    <div key={slotTime} className="flex flex-col sm:flex-row items-stretch min-h-[72px] hover:bg-zinc-50 transition-colors">
                      {/* Time Label Column */}
                      <div className="w-full sm:w-36 md:w-40 px-4 sm:px-5 py-3 bg-zinc-100 border-b sm:border-b-0 sm:border-r-2 border-black flex items-center justify-between gap-2 shrink-0">
                        <span className="font-bebas font-bold text-base text-black tracking-wider flex items-center gap-1.5 shrink-0 pl-1">
                          <Clock className="w-4 h-4 text-amber-500 shrink-0" /> {slotTime}
                        </span>
                        <button
                          onClick={() => {
                            setBreakDate(selectedDate);
                            setBreakStartTime(slotTime);
                            // default 1 hour later
                            const hourNum = parseInt(slotTime.substring(0, 2), 10);
                            const nextHourStr = `${String(hourNum + 1).padStart(2, '0')}:00`;
                            setBreakEndTime(nextHourStr);
                            setBreakModalOpen(true);
                          }}
                          className="text-[10px] font-bebas bg-amber-300 text-black px-2 py-1 rounded border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:bg-amber-400 shrink-0"
                          title="Bloquear este horário"
                        >
                          + Bloquear
                        </button>
                      </div>

                      {/* Content Column for Slot */}
                      <div className="flex-1 p-3 space-y-2">
                        {slotApts.length === 0 && slotBreaks.length === 0 ? (
                          <div className="text-xs text-zinc-400 font-medium italic flex items-center h-full py-2">
                            Horário livre / Disponível para agendamento
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {/* Render Appointments */}
                            {slotApts.map((apt) => (
                              <div
                                key={apt.id}
                                className="bg-amber-300 border-2 border-black rounded-xl p-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bebas font-bold text-sm bg-black text-white px-2 py-0.5 rounded">
                                      {apt.time}
                                    </span>
                                    <span className="font-bold text-black text-sm">{apt.clientName}</span>
                                    <span className="text-xs font-bold bg-white px-2 py-0.5 rounded border border-black">
                                      {apt.serviceName} ({apt.serviceDuration} min)
                                    </span>
                                  </div>
                                  <div className="text-xs text-zinc-800 font-semibold flex items-center gap-2">
                                    <span>R$ {apt.servicePrice}</span>
                                    {apt.clientPhone && <span>• Tel: {apt.clientPhone}</span>}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 self-end sm:self-center flex-wrap">
                                  {apt.status === 'scheduled' && (
                                    <button
                                      onClick={() => handleUpdateStatus(apt.id, 'in_progress')}
                                      className="px-2.5 py-1 rounded-lg bg-black hover:bg-zinc-800 text-amber-300 font-bebas font-bold text-xs border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1 transition-all"
                                      title="Iniciar atendimento"
                                    >
                                      <Play className="w-3 h-3 fill-amber-300" /> Iniciar
                                    </button>
                                  )}

                                  {apt.status === 'in_progress' && (
                                    <span className="px-2.5 py-1 rounded-lg bg-amber-400 text-black font-bebas font-bold text-xs border border-black flex items-center gap-1 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                                      <Play className="w-3 h-3 fill-black animate-pulse" /> Em Atendimento
                                    </span>
                                  )}

                                  {apt.status !== 'completed' ? (
                                    <button
                                      onClick={() => handleUpdateStatus(apt.id, 'completed')}
                                      className="px-2.5 py-1 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-black font-bebas font-bold text-xs border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1 transition-all"
                                      title="Marcar serviço como concluído (Libera faturamento local)"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5" /> Concluir
                                    </button>
                                  ) : (
                                    <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 font-bebas font-bold text-xs border border-emerald-600 flex items-center gap-1">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" /> Concluído
                                    </span>
                                  )}

                                  {apt.status !== 'completed' && apt.status !== 'cancelled' && (
                                    <button
                                      onClick={() => {
                                        setReschedulingApt(apt);
                                        setRescheduleDate(apt.date);
                                        setRescheduleTime(apt.time);
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-zinc-100 text-black font-bebas font-bold text-xs border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1 transition-all"
                                      title="Remarcar horário do cliente"
                                    >
                                      <RefreshCw className="w-3.5 h-3.5 text-black" /> Remarcar
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}

                            {/* Render Blocked Times / Tasks */}
                            {slotBreaks.map((brk) => (
                              <div
                                key={brk.id}
                                className="bg-rose-100 border-2 border-black rounded-xl p-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center justify-between gap-3"
                              >
                                <div className="flex items-center gap-2">
                                  <div className="p-2 bg-rose-300 border border-black rounded-lg text-black">
                                    <Lock className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <h4 className="font-bebas font-bold text-black text-sm uppercase">
                                      {brk.reason}
                                    </h4>
                                    <p className="text-xs text-zinc-700 font-semibold">
                                      Bloqueado das {brk.startTime} às {brk.endTime}
                                    </p>
                                  </div>
                                </div>

                                <button
                                  onClick={() => handleDeleteBreak(brk.id)}
                                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-rose-200 text-rose-700 font-bebas font-bold text-xs border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1"
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> Desbloquear
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* HIGHLIGHT CARD: PRÓXIMO CLIENTE */}
        {nextClient ? (
          <div className="bg-amber-300 border-2 border-black rounded-2xl p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-4 relative overflow-hidden">
            <div className="flex items-center justify-between border-b-2 border-black pb-3">
              <span className="px-3 py-1 rounded-full bg-black text-amber-300 font-bebas font-bold text-xs uppercase tracking-wider flex items-center gap-1 shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" /> PRÓXIMO ATENDIMENTO EM DESTAQUE
              </span>

              <span className="text-lg font-bebas font-bold text-black flex items-center gap-1">
                <Clock className="w-4 h-4" /> {nextClient.time}
              </span>
            </div>

            <div className="space-y-1">
              <h3 className="text-3xl font-bebas font-bold text-black uppercase tracking-wide">
                {nextClient.clientName}
              </h3>
              <p className="text-xs text-zinc-900 font-bold">
                {nextClient.serviceName} ({nextClient.serviceDuration} min) — R$ {nextClient.servicePrice}
              </p>
            </div>

            {nextClient.clientPhone && (
              <a
                href={`https://wa.me/55${nextClient.clientPhone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs font-bold text-black bg-white border-2 border-black px-3 py-1.5 rounded-xl hover:bg-zinc-100 transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                <Phone className="w-3.5 h-3.5 text-black" /> WhatsApp: {nextClient.clientPhone}
              </a>
            )}

            {/* 1-CLICK ACTION BUTTONS */}
            <div className="pt-2 grid grid-cols-2 gap-3">
              <button
                onClick={() => handleUpdateStatus(nextClient.id, 'in_progress')}
                className="py-2.5 rounded-xl bg-black hover:bg-zinc-800 text-amber-300 border-2 border-black font-bebas font-bold text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-1.5 uppercase tracking-wider"
              >
                <Play className="w-4 h-4" /> Em Atendimento
              </button>

              <button
                onClick={() => handleUpdateStatus(nextClient.id, 'completed')}
                className="py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-black border-2 border-black font-bebas font-bold text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-1.5 uppercase tracking-wider"
              >
                <CheckCircle2 className="w-4 h-4" /> Concluído
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white border-2 border-black rounded-2xl p-6 text-center space-y-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <h3 className="font-bebas font-bold text-xl text-black uppercase">Sem clientes pendentes agora nesta data</h3>
            <p className="text-xs text-zinc-600 font-medium">Aproveite para bloquear horários de pausa ou revisar seus compromissos!</p>
          </div>
        )}

        {/* Daily Stats Bar */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-white border-2 border-black p-3.5 rounded-2xl text-center shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
            <span className="text-zinc-600 font-bold uppercase text-[10px] block">Cortes Concluídos na Data</span>
            <strong className="text-black text-2xl font-bebas">{completedTodayCount}</strong>
          </div>
          <div className="bg-white border-2 border-black p-3.5 rounded-2xl text-center shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
            <span className="text-zinc-600 font-bold uppercase text-[10px] block">No-shows (Ausências)</span>
            <strong className="text-rose-600 text-2xl font-bebas">{noShowTodayCount}</strong>
          </div>
        </div>
          </>
        )}

        {/* BLOCK TIME / TASK MODAL */}
        {breakModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border-2 border-black rounded-2xl p-6 max-w-sm w-full space-y-4 text-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <h3 className="font-bebas font-bold text-2xl text-black uppercase flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-500" /> Bloquear Horário / Tarefa
              </h3>
              <p className="text-xs text-zinc-600 font-medium">
                Impeça novos agendamentos nesta faixa horária para focar em pausas ou tarefas específicas.
              </p>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1 uppercase">Motivo / Tipo de Tarefa</label>
                <select
                  value={breakReason}
                  onChange={(e) => setBreakReason(e.target.value)}
                  className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-none"
                >
                  <option value="Pausa para Café">☕ Pausa para Café (15 min)</option>
                  <option value="Almoço / Refeição">🍽️ Almoço / Refeição (1h)</option>
                  <option value="Manutenção de Tesouras / Máquinas">✂️ Manutenção de Tesouras / Máquinas</option>
                  <option value="Reunião de Equipe">👥 Reunião de Equipe</option>
                  <option value="Imprevisto Pessoal / Consulta">⚠️ Imprevisto Pessoal / Consulta</option>
                  <option value="Organização e Limpeza de Bancada">🧼 Organização e Limpeza de Bancada</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1 uppercase">Data do Bloqueio</label>
                <input
                  type="date"
                  value={breakDate}
                  onChange={(e) => setBreakDate(e.target.value)}
                  className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1 uppercase">Início</label>
                  <input
                    type="time"
                    value={breakStartTime}
                    onChange={(e) => setBreakStartTime(e.target.value)}
                    className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1 uppercase">Término</label>
                  <input
                    type="time"
                    value={breakEndTime}
                    onChange={(e) => setBreakEndTime(e.target.value)}
                    className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t-2 border-black">
                <button
                  onClick={() => setBreakModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-black border-2 border-black font-bebas font-bold text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddBreak}
                  className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black border-2 border-black font-bebas font-bold text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase tracking-wider"
                >
                  Bloquear Horário
                </button>
              </div>
            </div>
          </div>
        )}

        {/* RESCHEDULE MODAL */}
        {reschedulingApt && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border-2 border-black rounded-2xl p-6 max-w-sm w-full space-y-4 text-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <h3 className="font-bebas font-bold text-2xl text-black uppercase flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-amber-500" /> Remarcar Atendimento
              </h3>
              <p className="text-xs text-zinc-600 font-medium">
                Cliente: <strong>{reschedulingApt.clientName}</strong> ({reschedulingApt.serviceName})
              </p>

              <div>
                <label className="block text-xs font-bold text-black uppercase mb-1">Nova Data</label>
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-black uppercase mb-1">Novo Horário (Grade de Horários)</label>
                <select
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-none"
                >
                  {AVAILABLE_HOURS.map((hour) => {
                    const isUnavailable = unavailableRescheduleTimes.has(hour);
                    const isCurrentSlot = reschedulingApt.date === (rescheduleDate || reschedulingApt.date) && hour === reschedulingApt.time;
                    return (
                      <option
                        key={hour}
                        value={hour}
                        disabled={isUnavailable && !isCurrentSlot}
                        className={isUnavailable && !isCurrentSlot ? 'text-zinc-400 bg-zinc-100' : 'text-black font-bold'}
                      >
                        {hour} h {isUnavailable && !isCurrentSlot ? ' (Indisponível / Ocupado)' : ''}
                      </option>
                    );
                  })}
                </select>
                {unavailableRescheduleTimes.size > 0 && (
                  <p className="text-[10px] text-amber-800 font-medium mt-1">
                    ⚠️ Horários marcados como indisponíveis já possuem compromissos ou bloqueios para esta data.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t-2 border-black">
                <button
                  onClick={() => setReschedulingApt(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-100 text-black border-2 border-black font-bebas font-bold text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmReschedule}
                  className="px-4 py-2 rounded-xl bg-amber-400 text-black border-2 border-black font-bebas font-bold text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase tracking-wider"
                >
                  Salvar Novo Horário
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
