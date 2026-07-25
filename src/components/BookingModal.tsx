import React, { useEffect, useState } from 'react';
import { X, Calendar, Clock, Scissors, User, Phone, CheckCircle2, AlertCircle, ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import { db, collection, query, where, getDocs, addDoc, handleFirestoreError, OperationType } from '../lib/firebase';
import { Service, Barber, Appointment, TimeSlot } from '../types';
import { AVAILABLE_HOURS } from '../data/initialData';
import { useAuth } from '../context/AuthContext';
import { notifyNewBooking } from '../lib/notifications';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedService?: Service | null;
  preselectedBarber?: Barber | null;
  onBookingSuccess: () => void;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  onClose,
  preselectedService,
  preselectedBarber,
  onBookingSuccess,
}) => {
  const { user, userProfile, updateProfile, signInWithGoogle } = useAuth();

  const [step, setStep] = useState<number>(1);
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  
  // Selection state
  const [selectedService, setSelectedService] = useState<Service | null>(preselectedService || null);
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(preselectedBarber || null);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedTime, setSelectedTime] = useState<string>('');
  
  // Client Form
  const [clientName, setClientName] = useState<string>('');
  const [clientPhone, setClientPhone] = useState<string>('');
  const [paymentType, setPaymentType] = useState<'online_pix' | 'pay_at_location'>('pay_at_location');
  const [notes, setNotes] = useState<string>('');

  // Slots availability state
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [bookingCompleted, setBookingCompleted] = useState<boolean>(false);

  // Auto-fill user information & handle initial step
  useEffect(() => {
    if (!isOpen) return;

    if (userProfile) {
      if (userProfile.name) setClientName(userProfile.name);
      if (userProfile.phone) setClientPhone(userProfile.phone);
    } else if (user) {
      if (user.displayName) setClientName(user.displayName);
    }

    if (preselectedService) {
      setSelectedService(preselectedService);
      if (preselectedBarber) {
        setSelectedBarber(preselectedBarber);
        setStep(3);
      } else {
        setStep(2); // Take user directly to barber selection
      }
    } else if (preselectedBarber) {
      setSelectedBarber(preselectedBarber);
      setStep(1);
    } else {
      setStep(1);
    }
  }, [isOpen, preselectedService, preselectedBarber, user, userProfile]);

  // Fetch services and barbers catalog
  useEffect(() => {
    if (!isOpen) return;

    const fetchData = async () => {
      try {
        const servicesSnap = await getDocs(collection(db, 'services'));
        const servicesList = servicesSnap.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Service, 'id'>),
        }));
        setServices(servicesList);

        const barbersSnap = await getDocs(collection(db, 'barbers'));
        const barbersList = barbersSnap.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Barber, 'id'>),
        }));
        setBarbers(barbersList);
      } catch (err) {
        console.error('Error loading catalog for booking:', err);
      }
    };

    fetchData();
  }, [isOpen]);

  // Calculate available time slots when barber and date change
  useEffect(() => {
    if (!selectedBarber || !selectedDate) return;

    const checkAvailability = async () => {
      setLoadingSlots(true);
      try {
        const q = query(
          collection(db, 'appointments'),
          where('barberId', '==', selectedBarber.id),
          where('date', '==', selectedDate),
          where('status', 'in', ['scheduled', 'in_progress'])
        );
        const snap = await getDocs(q);
        const bookedTimes = new Set(snap.docs.map((doc) => doc.data().time));

        // Fetch breaks / blocked times by the barber
        const breaksQuery = query(
          collection(db, 'breaks'),
          where('date', '==', selectedDate)
        );
        const breaksSnap = await getDocs(breaksQuery);
        const blockedTimes = new Set<string>();

        breaksSnap.docs.forEach((d) => {
          const bData = d.data();
          if (
            !bData.barberId ||
            bData.barberId === 'all' ||
            bData.barberId === selectedBarber.id ||
            bData.barberName === selectedBarber.name ||
            (selectedBarber.googleEmail && bData.barberEmail === selectedBarber.googleEmail)
          ) {
            const start = bData.startTime; // e.g. "12:00"
            const end = bData.endTime;     // e.g. "13:00"

            AVAILABLE_HOURS.forEach((h) => {
              if ((h >= start && h < end) || h === start) {
                blockedTimes.add(h);
              }
            });
          }
        });

        const slots: TimeSlot[] = AVAILABLE_HOURS.map((hour) => ({
          time: hour,
          available: !bookedTimes.has(hour) && !blockedTimes.has(hour),
        }));

        setTimeSlots(slots);
      } catch (err) {
        console.error('Error fetching time slot availability:', err);
        // Fallback default slots
        setTimeSlots(AVAILABLE_HOURS.map((hour) => ({ time: hour, available: true })));
      } finally {
        setLoadingSlots(false);
      }
    };

    checkAvailability();
  }, [selectedBarber, selectedDate]);

  if (!isOpen) return null;

  const handleNextStep = () => {
    if (step === 1 && selectedService) setStep(2);
    else if (step === 2 && selectedBarber) setStep(3);
    else if (step === 3 && selectedDate && selectedTime) setStep(4);
  };

  const handlePrevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert('Por favor, faça login para confirmar o agendamento.');
      return;
    }
    if (!selectedService || !selectedBarber || !selectedDate || !selectedTime) return;

    if (userProfile?.barberId && userProfile.barberId === selectedBarber.id) {
      alert('O barbeiro não pode agendar um horário com ele mesmo, somente com outros barbeiros.');
      setSubmitting(false);
      return;
    }

    setSubmitting(true);
    try {
      const finalPrice = paymentType === 'online_pix' ? selectedService.price * 0.95 : selectedService.price;

      const newAppointment: Omit<Appointment, 'id'> = {
        clientId: user.uid,
        clientName: clientName || user.displayName || 'Cliente',
        clientEmail: user.email || '',
        clientPhone: clientPhone || '(11) 99999-9999',
        barberId: selectedBarber.id,
        barberName: selectedBarber.name,
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        servicePrice: finalPrice,
        serviceDuration: selectedService.durationMinutes,
        date: selectedDate,
        time: selectedTime,
        status: 'scheduled',
        paymentType: paymentType,
        paymentStatus: paymentType === 'online_pix' ? 'paid' : 'pending',
        notes: notes || '',
        createdAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, 'appointments'), newAppointment);

      // Trigger notification to barber and manager
      await notifyNewBooking({
        ...newAppointment,
        id: docRef.id,
      });

      // Save user phone and name permanently so user never has to re-type it
      if (updateProfile && (clientPhone || clientName)) {
        await updateProfile({
          phone: clientPhone,
          name: clientName,
        });
      }

      setBookingCompleted(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'appointments');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinish = () => {
    setBookingCompleted(false);
    setStep(1);
    setSelectedService(null);
    setSelectedBarber(null);
    setSelectedTime('');
    onBookingSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border-2 border-black rounded-2xl w-full max-w-2xl overflow-hidden shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-zinc-900 my-8">
        
        {/* Modal Header */}
        <div className="bg-amber-400 px-6 py-4 border-b-2 border-black flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white border-2 border-black flex items-center justify-center text-black font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bebas font-bold text-2xl text-black uppercase">Novo Agendamento</h3>
              <p className="text-xs font-bold text-black uppercase">Passo {step} de 4</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-black hover:bg-black/10 rounded-xl transition-colors border-2 border-black bg-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wizard Steps Indicator */}
        {!bookingCompleted && (
          <div className="px-4 sm:px-6 py-3 bg-zinc-100 border-b-2 border-black flex items-center justify-between overflow-x-auto no-scrollbar gap-1 text-xs font-black font-bebas uppercase tracking-wider">
            <span className={`shrink-0 ${step >= 1 ? 'text-black bg-amber-400 px-2 py-0.5 rounded border border-black' : 'text-zinc-400'}`}>1. Serviço</span>
            <span className="text-zinc-400 shrink-0">➔</span>
            <span className={`shrink-0 ${step >= 2 ? 'text-black bg-amber-400 px-2 py-0.5 rounded border border-black' : 'text-zinc-400'}`}>2. Barbeiro</span>
            <span className="text-zinc-400 shrink-0">➔</span>
            <span className={`shrink-0 ${step >= 3 ? 'text-black bg-amber-400 px-2 py-0.5 rounded border border-black' : 'text-zinc-400'}`}>3. Data & Hora</span>
            <span className="text-zinc-400 shrink-0">➔</span>
            <span className={`shrink-0 ${step >= 4 ? 'text-black bg-amber-400 px-2 py-0.5 rounded border border-black' : 'text-zinc-400'}`}>4. Confirmação</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 bg-white">
          {bookingCompleted ? (
            /* Success Screen */
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 bg-amber-400 text-black border-2 border-black rounded-full flex items-center justify-center mx-auto shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] animate-bounce">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <h4 className="text-3xl font-bebas font-bold text-black uppercase">
                Agendamento Confirmado!
              </h4>

              <p className="text-zinc-700 text-sm max-w-md mx-auto font-medium">
                Seu horário para <strong className="text-black underline">{selectedService?.name}</strong> com o barbeiro <strong className="text-black underline">{selectedBarber?.name}</strong> foi reservado com sucesso.
              </p>

              <div className="bg-zinc-50 border-2 border-black rounded-xl p-4 max-w-md mx-auto text-left text-xs space-y-2 text-zinc-900 font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <p>📅 <strong>Data:</strong> {selectedDate.split('-').reverse().join('/')}</p>
                <p>⏰ <strong>Horário:</strong> {selectedTime}</p>
                <p>💈 <strong>Profissional:</strong> {selectedBarber?.name}</p>
                <p>💰 <strong>Valor:</strong> R$ {selectedService?.price.toFixed(2)}</p>
              </div>

              <div className="pt-4">
                <button
                  onClick={handleFinish}
                  className="px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black border-2 border-black text-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all uppercase font-bebas tracking-wider text-lg"
                >
                  Ver Meus Agendamentos
                </button>
              </div>
            </div>
          ) : (
            <div>
              {/* STEP 1: SELECT SERVICE */}
              {step === 1 && (
                <div className="space-y-4">
                  <h4 className="text-lg font-bebas font-bold text-black flex items-center gap-2 uppercase">
                    <Scissors className="w-5 h-5 text-amber-500" /> Escolha o Serviço Desejado
                  </h4>

                  <div className="grid grid-cols-1 gap-3 max-h-80 overflow-y-auto pr-1">
                    {services.map((svc) => {
                      const isSelected = selectedService?.id === svc.id;
                      return (
                        <div
                          key={svc.id}
                          onClick={() => setSelectedService(svc)}
                          className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                            isSelected
                              ? 'bg-amber-400 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                              : 'bg-zinc-50 border-black hover:bg-zinc-100'
                          }`}
                        >
                          <div>
                            <h5 className="font-bebas font-bold text-xl text-black uppercase tracking-wide">{svc.name}</h5>
                            <p className="text-xs text-zinc-700 mt-1 font-medium">{svc.description}</p>
                            <span className="inline-flex items-center gap-1 text-[11px] text-black font-bold mt-2 bg-white px-2 py-0.5 rounded border border-black">
                              <Clock className="w-3 h-3 text-black" /> {svc.durationMinutes} min
                            </span>
                          </div>
                          <div className="text-right shrink-0 ml-4">
                            <span className="text-xl font-bold font-bebas text-black bg-white px-3 py-1 rounded border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                              R$ {svc.price.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 2: SELECT BARBER */}
              {step === 2 && (
                <div className="space-y-4">
                  <h4 className="text-lg font-bebas font-bold text-black flex items-center gap-2 uppercase">
                    <User className="w-5 h-5 text-amber-500" /> Selecione o Barbeiro
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
                    {barbers.map((barber) => {
                      const isSelf = userProfile?.barberId ? userProfile.barberId === barber.id : false;
                      const isSelected = selectedBarber?.id === barber.id;
                      return (
                        <div
                          key={barber.id}
                          onClick={() => {
                            if (!isSelf) setSelectedBarber(barber);
                          }}
                          className={`p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
                            isSelf
                              ? 'bg-zinc-200 border-zinc-400 opacity-60 cursor-not-allowed'
                              : isSelected
                              ? 'bg-amber-400 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] cursor-pointer'
                              : 'bg-zinc-50 border-black hover:bg-zinc-100 cursor-pointer'
                          }`}
                        >
                          <img
                            src={barber.photoUrl}
                            alt={barber.name}
                            className="w-12 h-12 rounded-full object-cover border-2 border-black shrink-0"
                          />
                          <div className="flex-1">
                            <h5 className="font-bebas font-bold text-lg text-black uppercase tracking-wide flex items-center justify-between">
                              {barber.name}
                              {isSelf && (
                                <span className="text-[10px] bg-black text-amber-400 px-2 py-0.5 rounded font-sans font-bold">
                                  Você mesmo (Indisponível)
                                </span>
                              )}
                            </h5>
                            <p className="text-xs text-zinc-800 font-bold uppercase">{barber.specialty}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 3: SELECT DATE & TIME */}
              {step === 3 && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-black uppercase mb-1 flex items-center gap-1">
                      <Calendar className="w-4 h-4 text-amber-500" /> Selecione a Data
                    </label>
                    <input
                      type="date"
                      value={selectedDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => {
                        setSelectedDate(e.target.value);
                        setSelectedTime('');
                      }}
                      className="w-full bg-zinc-50 border-2 border-black rounded-xl px-4 py-2.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-amber-400 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-black uppercase mb-2 flex items-center gap-1">
                      <Clock className="w-4 h-4 text-amber-500" /> Horários Disponíveis para {selectedBarber?.name.split(' ')[0]}
                    </label>

                    {loadingSlots ? (
                      <div className="text-center py-6 text-zinc-600 text-sm animate-pulse font-bold">
                        Verificando agenda em tempo real...
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 max-h-56 overflow-y-auto pr-1">
                        {timeSlots.map((slot) => (
                          <button
                            key={slot.time}
                            disabled={!slot.available}
                            onClick={() => setSelectedTime(slot.time)}
                            className={`py-2 rounded-xl text-xs font-black transition-all border-2 ${
                              !slot.available
                                ? 'bg-zinc-200 text-zinc-400 border-zinc-300 line-through cursor-not-allowed'
                                : selectedTime === slot.time
                                ? 'bg-amber-400 text-black border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                                : 'bg-white text-black border-black hover:bg-amber-100'
                            }`}
                          >
                            {slot.time}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 4: CONTACT & CONFIRMATION */}
              {step === 4 && (
                <form onSubmit={handleConfirmBooking} className="space-y-4">
                  {!user ? (
                    <div className="bg-amber-100 border-2 border-black rounded-xl p-4 text-center space-y-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      <p className="text-sm text-black font-bold">
                        Você precisa estar logado com sua conta Google para agendar.
                      </p>
                      <button
                        type="button"
                        onClick={signInWithGoogle}
                        className="px-5 py-2.5 rounded-xl bg-amber-400 text-black font-black text-sm hover:bg-amber-300 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bebas uppercase tracking-wider text-base"
                      >
                        Fazer Login com Google
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Summary Box */}
                      <div className="bg-zinc-50 border-2 border-black rounded-xl p-4 text-xs space-y-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        <div className="flex justify-between border-b border-zinc-200 pb-2">
                          <span className="text-zinc-600 font-medium">Serviço:</span>
                          <span className="font-bold text-black">{selectedService?.name}</span>
                        </div>
                        <div className="flex justify-between border-b border-zinc-200 pb-2">
                          <span className="text-zinc-600 font-medium">Barbeiro:</span>
                          <span className="font-bold text-black">{selectedBarber?.name}</span>
                        </div>
                        <div className="flex justify-between border-b border-zinc-200 pb-2">
                          <span className="text-zinc-600 font-medium">Data & Hora:</span>
                          <span className="font-bold text-black">
                            {selectedDate.split('-').reverse().join('/')} às {selectedTime}
                          </span>
                        </div>
                        <div className="flex justify-between pt-1 text-sm font-bold">
                          <span className="text-black font-bebas uppercase text-base">Total a Pagar na Barbearia:</span>
                          <span className="text-black font-bebas text-lg bg-amber-400 px-2 py-0.5 rounded border border-black">R$ {selectedService?.price.toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Payment Option Selector */}
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-black uppercase">Forma de Pagamento</label>
                        <div className="grid grid-cols-2 gap-3">
                          <div
                            onClick={() => setPaymentType('online_pix')}
                            className={`p-3 rounded-xl border-2 cursor-pointer text-xs space-y-1 transition-all ${
                              paymentType === 'online_pix'
                                ? 'bg-amber-400 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                                : 'bg-zinc-50 border-black hover:bg-zinc-100'
                            }`}
                          >
                            <span className="font-bold text-black block font-bebas uppercase text-sm">⚡ PIX Antecipado</span>
                            <p className="text-[10px] text-zinc-700 font-medium">Garante horário + 5% de desconto (R$ {(selectedService ? selectedService.price * 0.95 : 0).toFixed(2)})</p>
                          </div>

                          <div
                            onClick={() => setPaymentType('pay_at_location')}
                            className={`p-3 rounded-xl border-2 cursor-pointer text-xs space-y-1 transition-all ${
                              paymentType === 'pay_at_location'
                                ? 'bg-amber-400 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                                : 'bg-zinc-50 border-black hover:bg-zinc-100'
                            }`}
                          >
                            <span className="font-bold text-black block font-bebas uppercase text-sm">💈 Pagar No Local</span>
                            <p className="text-[10px] text-zinc-700 font-medium">Pague direto na recepção (Cartão, Dinheiro ou PIX)</p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-black uppercase mb-1">Seu Nome (Do seu Cadastro)</label>
                        <input
                          type="text"
                          required
                          disabled
                          value={clientName}
                          className="w-full bg-zinc-100 border-2 border-black rounded-xl px-3 py-2 text-sm text-zinc-700 cursor-not-allowed font-medium"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-black uppercase mb-1">
                          Telefone / WhatsApp para Lembrete
                        </label>
                        <input
                          type="tel"
                          required
                          placeholder="(11) 99999-8888"
                          value={clientPhone}
                          onChange={(e) => setClientPhone(e.target.value)}
                          className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-amber-400 font-medium"
                        />
                        <p className="text-[10px] text-zinc-500 font-medium mt-1">
                          {userProfile?.phone ? 'Número preenchido do seu cadastro. Você pode alterar se desejar.' : 'Informe seu WhatsApp para receber lembretes do agendamento.'}
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-black uppercase mb-1">Observações (Opcional)</label>
                        <input
                          type="text"
                          placeholder="Ex: Prefiro pezinho bem marcado..."
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-amber-400 font-medium"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black text-lg border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center justify-center gap-2 mt-4 font-bebas uppercase tracking-wider"
                      >
                        {submitting ? 'Confirmando Agendamento...' : 'Confirmar e Finalizar Agendamento'}
                      </button>
                    </div>
                  )}
                </form>
              )}

              {/* Wizard Navigation Footer */}
              <div className="flex items-center justify-between pt-6 border-t-2 border-zinc-200 mt-6">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-black text-xs font-bold flex items-center gap-1 border border-black font-bebas uppercase"
                  >
                    <ArrowLeft className="w-4 h-4" /> Voltar
                  </button>
                ) : <div />}

                {step < 4 && (
                  <button
                    type="button"
                    disabled={
                      (step === 1 && !selectedService) ||
                      (step === 2 && !selectedBarber) ||
                      (step === 3 && (!selectedDate || !selectedTime))
                    }
                    onClick={handleNextStep}
                    className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-black font-black text-xs flex items-center gap-1 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bebas uppercase tracking-wider text-base"
                  >
                    Próximo Passo <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
