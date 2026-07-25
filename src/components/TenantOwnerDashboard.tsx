import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, addDoc, setDoc } from 'firebase/firestore';
import { Building2, DollarSign, Calendar as CalendarIcon, Scissors, Users, Clock, CreditCard, Sparkles, Plus, Edit3, CheckCircle2, XCircle, ShieldCheck, ArrowUpRight, ArrowDownRight, RefreshCw, Layers, Image as ImageIcon, Trash2, ArrowUp, ArrowDown, Flame, Zap, Save, Instagram, Camera, AtSign, Check, AlertCircle, Menu, ChevronDown, Lock, MessageCircle } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Appointment, AppointmentStatus, Barber, Service, SaaSPlan, GallerySettings, StorySlide } from '../types';
import { DEFAULT_SAAS_PLANS } from '../data/saasDefaults';
import { DEFAULT_GALLERY_SETTINGS, AVAILABLE_HOURS, DEFAULT_APPOINTMENTS } from '../data/initialData';
import { MediaRenderer } from './MediaRenderer';
import { SupportInbox } from './SupportInbox';
import { useAuth } from '../context/AuthContext';
import {
  notifyStaffReschedule,
  notifyCompletedService,
  approveRescheduleRequest,
  rejectRescheduleRequest,
} from '../lib/notifications';

interface TenantOwnerDashboardProps {
  initialTab?: string;
}

export const TenantOwnerDashboard: React.FC<TenantOwnerDashboardProps> = ({ initialTab }) => {
  const { isSubscriptionFrozen } = useAuth();
  const [inboxInitialNode, setInboxInitialNode] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Active view tab
  const [activeTab, setActiveTab] = useState<'financial' | 'schedule' | 'services' | 'barbers' | 'clients' | 'plan' | 'gallery' | 'inbox'>(
    initialTab === 'inbox' ? 'inbox' : 'financial'
  );

  useEffect(() => {
    if (initialTab === 'inbox') {
      setActiveTab('inbox');
    }
  }, [initialTab]);
  const [managerMenuOpen, setManagerMenuOpen] = useState<boolean>(false);
  const [managerEmails, setManagerEmails] = useState<string[]>([]);
  const [newManagerEmail, setNewManagerEmail] = useState<string>('');

  // Gallery Settings State
  const [gallerySettings, setGallerySettings] = useState<GallerySettings>(DEFAULT_GALLERY_SETTINGS);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>('');
  const [isSavingGallery, setIsSavingGallery] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string>('');
  const [editingStoryModalOpen, setEditingStoryModalOpen] = useState<boolean>(false);
  const [editingStorySlide, setEditingStorySlide] = useState<StorySlide | null>(null);
  const [storyFormData, setStoryFormData] = useState<StorySlide>({
    id: '1',
    image: '',
    title: '',
    barber: '',
    tag: 'CORTE DO DIA',
    time: '2 h',
    ctaText: 'Agendar Este Corte',
    ctaIcon: 'calendar',
  });

  // Schedule View Filter Date
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Subscription Plan State
  const [currentPlan, setCurrentPlan] = useState<SaaSPlan>(DEFAULT_SAAS_PLANS[1]); // Pro Plan
  const [changePlanModalOpen, setChangePlanModalOpen] = useState<boolean>(false);

  // Service Modal State
  const [serviceModalOpen, setServiceModalOpen] = useState<boolean>(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [newServiceData, setNewServiceData] = useState<Omit<Service, 'id'>>({
    name: '',
    description: '',
    durationMinutes: 30,
    price: 50,
    requirePrepayment: false,
    icon: 'scissors',
    isFeatured: false,
    featuredTag: 'EXPRESS',
  });

  // Barber Modal State (Add & Edit)
  const [barberModalOpen, setBarberModalOpen] = useState<boolean>(false);
  const [editingBarber, setEditingBarber] = useState<Barber | null>(null);
  const [barberFormData, setBarberFormData] = useState<Omit<Barber, 'id'>>({
    name: '',
    specialty: 'Corte & Barba',
    photoUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500',
    rating: 5.0,
    experienceYears: 4,
    bio: 'Especialista em corte na régua, degradação navalhada e alinhamento de barba.',
    phone: '(11) 98765-4321',
    instagram: '@barbeiro_oficial',
    isOwner: false,
    commissionRate: 70,
  });

  // Reassign / Remarcar Modal State
  const [reassignApt, setReassignApt] = useState<Appointment | null>(null);
  const [newBarberId, setNewBarberId] = useState<string>('');
  const [newDate, setNewDate] = useState<string>('');
  const [newTime, setNewTime] = useState<string>('');
  const [newStatus, setNewStatus] = useState<AppointmentStatus>('scheduled');

  useEffect(() => {
    // Stream appointments
    const unsubApts = onSnapshot(collection(db, 'appointments'), (snapshot) => {
      const list: Appointment[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Appointment, 'id'>),
      }));
      setAppointments(list.length > 0 ? list : DEFAULT_APPOINTMENTS);
      setLoading(false);
    });

    // Stream barbers
    const unsubBarbers = onSnapshot(collection(db, 'barbers'), (snap) => {
      setBarbers(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Barber, 'id'>) })));
    });

    // Stream services
    const unsubServices = onSnapshot(collection(db, 'services'), (snap) => {
      setServices(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Service, 'id'>) })));
    });

    // Stream gallery settings
    const unsubGallery = onSnapshot(doc(db, 'settings', 'gallery'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as GallerySettings;
        if (data) {
          setGallerySettings({
            username: data.username || DEFAULT_GALLERY_SETTINGS.username,
            avatarUrl: data.avatarUrl || DEFAULT_GALLERY_SETTINGS.avatarUrl,
            stories: Array.isArray(data.stories) && data.stories.length > 0 ? data.stories : DEFAULT_GALLERY_SETTINGS.stories,
          });
        }
      }
    });

    // Stream tenant settings (manager emails)
    const unsubTenant = onSnapshot(doc(db, 'settings', 'tenant'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data.managerEmails)) {
          setManagerEmails(data.managerEmails);
        }
      }
    });

    return () => {
      unsubApts();
      unsubBarbers();
      unsubServices();
      unsubGallery();
      unsubTenant();
    };
  }, []);

  const checkFrozenAction = (): boolean => {
    if (isSubscriptionFrozen) {
      alert('Sua licença está temporariamente congelada pelo Administrador Master. O painel está em Modo Leitura. Utilize a aba "Inbox / Suporte" para solicitar a reativação.');
      setActiveTab('inbox');
      return true;
    }
    return false;
  };

  const handleAddManagerEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    alert('Modo de Demonstração Visual: O cadastro de novos gestores está desativado para apresentação do painel.');
  };

  const handleRemoveManagerEmail = async (emailToRemove: string) => {
    alert('Modo de Demonstração Visual: As funções de remoção estão desativadas para apresentação do painel.');
  };

  // GALLERY MANAGEMENT HANDLERS
  const handleSaveGallerySettings = async (settingsToSave = gallerySettings) => {
    alert('Modo de Demonstração Visual: As alterações de galeria e perfil estão desativadas para apresentação do painel.');
  };

  const handleOpenAddStory = () => {
    alert('Modo de Demonstração Visual: A criação de novos stories está desativada para apresentação estática do painel.');
  };

  const handleOpenEditStory = (story: StorySlide) => {
    alert('Modo de Demonstração Visual: A edição de stories está desativada para apresentação estática do painel.');
  };

  const handleSaveStorySlide = async () => {
    alert('Modo de Demonstração Visual: O salvamento de stories está desativado para apresentação do painel.');
  };

  const handleDeleteStorySlide = async (id: string) => {
    alert('Modo de Demonstração Visual: A exclusão de stories está desativada para apresentação do painel.');
  };

  const handleMoveStory = async (index: number, direction: 'up' | 'down') => {
    alert('Modo de Demonstração Visual: A reordenação de stories está desativada para apresentação do painel.');
  };

  // FINANCIAL CALCULATIONS (Consistent math across Manager & Barber views)
  const getHouseCut = (a: Appointment) => {
    const barber = barbers.find((b) => b.id === a.barberId);
    const commRate = barber?.commissionRate ?? 70;
    const houseRate = (100 - commRate) / 100;
    return (a.servicePrice || 0) * houseRate;
  };

  const getBarberCut = (a: Appointment) => {
    const barber = barbers.find((b) => b.id === a.barberId);
    const commRate = barber?.commissionRate ?? 70;
    return (a.servicePrice || 0) * (commRate / 100);
  };

  const grossRevenue = appointments
    .filter((a) => a.status !== 'cancelled')
    .reduce((sum, a) => sum + (a.servicePrice || 0), 0);

  const totalBarberCommissionsPaid = appointments
    .filter((a) => a.status !== 'cancelled')
    .reduce((sum, a) => sum + getBarberCut(a), 0);

  const netHouseRevenue = appointments
    .filter((a) => a.status !== 'cancelled')
    .reduce((sum, a) => sum + getHouseCut(a), 0);

  const prepaidGross = appointments
    .filter((a) => (a.paymentType === 'online_pix' || a.paymentType === 'online_card') && a.status !== 'cancelled')
    .reduce((sum, a) => sum + (a.servicePrice || 0), 0);

  const localGross = appointments
    .filter((a) => a.paymentType === 'pay_at_location' && a.status !== 'cancelled')
    .reduce((sum, a) => sum + (a.servicePrice || 0), 0);

  const completedCount = appointments.filter((a) => a.status === 'completed').length;
  const scheduledCount = appointments.filter((a) => a.status === 'scheduled').length;

  // REASSIGN & REMARCAR APPOINTMENT
  const handleConfirmReassign = async () => {
    alert('Modo de Demonstração Visual: Remarcações e alterações de horários estão desativadas nesta apresentação.');
  };

  const handleDeleteAppointment = async (id: string) => {
    alert('Modo de Demonstração Visual: A exclusão de agendamentos está desativada nesta apresentação.');
  };

  // SERVICE CRUD HANDLERS
  const handleOpenAddService = () => {
    alert('Modo de Demonstração Visual: A criação de novos serviços está desativada nesta apresentação.');
  };

  const handleOpenEditService = (service: Service) => {
    alert('Modo de Demonstração Visual: A edição de serviços está desativada nesta apresentação.');
  };

  const handleSaveService = async () => {
    alert('Modo de Demonstração Visual: O salvamento de serviços está desativado nesta apresentação.');
  };

  const handleDeleteService = async (serviceId: string) => {
    alert('Modo de Demonstração Visual: A exclusão de serviços está desativada nesta apresentação.');
  };

  // TOGGLE PREPAYMENT FOR SERVICE
  const handleTogglePrepayment = async (serviceId: string, currentVal: boolean) => {
    alert('Modo de Demonstração Visual: O ajuste de pagamento antecipado está desativado nesta apresentação.');
  };

  // TOGGLE FEATURED IN 1-CLICK BOX
  const handleToggleFeatured = async (serviceId: string, currentVal?: boolean) => {
    alert('Modo de Demonstração Visual: O ajuste de serviços em destaque está desativado nesta apresentação.');
  };

  // BARBER CRUD HANDLERS
  const handleOpenAddBarber = () => {
    alert('Modo de Demonstração Visual: O cadastro de novos barbeiros está desativado nesta apresentação.');
  };

  const handleOpenEditBarber = (barber: Barber) => {
    alert('Modo de Demonstração Visual: A edição de dados dos barbeiros está desativada nesta apresentação.');
  };

  const handleSaveBarber = async () => {
    alert('Modo de Demonstração Visual: O salvamento de barbeiros está desativado nesta apresentação.');
  };

  const handleDeleteBarber = async (barberId: string) => {
    alert('Modo de Demonstração Visual: A exclusão de barbeiros está desativada nesta apresentação.');
  };

  const handleDeleteClient = async (clientKey: string) => {
    alert('Modo de Demonstração Visual: A exclusão de registros de clientes está desativada nesta apresentação.');
  };

  // REGISTERED CLIENTS DIRECTORY (Derived from appointments & seeded dummy clients)
  const DUMMY_CLIENTS_BASE = [
    { key: 'lucas.mendes@email.com', name: 'Lucas Mendes', email: 'lucas.mendes@email.com', phone: '(11) 99881-1223', totalAppointments: 14, totalSpent: 780, lastAppointmentDate: '2026-07-24' },
    { key: 'mateus.silva@email.com', name: 'Mateus Silva', email: 'mateus.silva@email.com', phone: '(11) 98765-4321', totalAppointments: 9, totalSpent: 540, lastAppointmentDate: '2026-07-22' },
    { key: 'rodrigo.oliveira@email.com', name: 'Rodrigo Oliveira', email: 'rodrigo.oliveira@email.com', phone: '(11) 97654-3210', totalAppointments: 18, totalSpent: 1120, lastAppointmentDate: '2026-07-25' },
    { key: 'gui.santos@email.com', name: 'Guilherme Santos', email: 'gui.santos@email.com', phone: '(11) 96543-2109', totalAppointments: 6, totalSpent: 390, lastAppointmentDate: '2026-07-20' },
    { key: 'gabriel.costa@email.com', name: 'Gabriel Costa', email: 'gabriel.costa@email.com', phone: '(11) 95432-1098', totalAppointments: 12, totalSpent: 850, lastAppointmentDate: '2026-07-23' },
    { key: 'bruno.henrique@email.com', name: 'Bruno Henrique', email: 'bruno.henrique@email.com', phone: '(11) 94321-0987', totalAppointments: 8, totalSpent: 460, lastAppointmentDate: '2026-07-19' },
    { key: 'caio.martins@email.com', name: 'Caio Martins', email: 'caio.martins@email.com', phone: '(11) 93210-9876', totalAppointments: 15, totalSpent: 920, lastAppointmentDate: '2026-07-21' },
    { key: 'rafael.lima@email.com', name: 'Rafael Lima', email: 'rafael.lima@email.com', phone: '(11) 92109-8765', totalAppointments: 5, totalSpent: 320, lastAppointmentDate: '2026-07-18' },
    { key: 'thiago.souza@email.com', name: 'Thiago Souza', email: 'thiago.souza@email.com', phone: '(11) 91098-7654', totalAppointments: 11, totalSpent: 670, lastAppointmentDate: '2026-07-24' },
    { key: 'andre.barbosa@email.com', name: 'André Barbosa', email: 'andre.barbosa@email.com', phone: '(11) 90987-6543', totalAppointments: 7, totalSpent: 410, lastAppointmentDate: '2026-07-17' },
  ];

  const clientMap = new Map<string, {
    key: string;
    name: string;
    email: string;
    phone: string;
    totalAppointments: number;
    totalSpent: number;
    lastAppointmentDate: string;
  }>();

  DUMMY_CLIENTS_BASE.forEach((dc) => {
    clientMap.set(dc.key, { ...dc });
  });

  appointments.forEach((apt) => {
    const key = (apt.clientEmail || apt.clientPhone || apt.clientName || '').toLowerCase().trim();
    if (!key) return;
    const existing = clientMap.get(key);
    if (existing) {
      existing.totalAppointments += 1;
      if (apt.status === 'completed' || apt.status === 'scheduled') {
        existing.totalSpent += (apt.servicePrice || 0);
      }
      if (apt.date > existing.lastAppointmentDate) {
        existing.lastAppointmentDate = apt.date;
      }
    } else {
      clientMap.set(key, {
        key,
        name: apt.clientName || 'Cliente Cadastrado',
        email: apt.clientEmail || 'N/A',
        phone: apt.clientPhone || '',
        totalAppointments: 1,
        totalSpent: (apt.status === 'completed' || apt.status === 'scheduled') ? (apt.servicePrice || 0) : 0,
        lastAppointmentDate: apt.date || '2026-07-01',
      });
    }
  });

  const registeredClients = Array.from(clientMap.values()).sort((a, b) => b.totalSpent - a.totalSpent);

  // Filter schedule by selected date
  const dateAppointments = appointments.filter((a) => a.date === selectedDate && a.status !== 'cancelled');

  return (
    <div className="py-8 bg-zinc-50 text-zinc-900 min-h-screen bg-street-grid">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Frozen License Warning Banner */}
        {isSubscriptionFrozen && (
          <div className="bg-gradient-to-r from-rose-950 via-zinc-900 to-black text-white p-5 sm:p-6 rounded-3xl border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col md:flex-row items-center justify-between gap-5 animate-in fade-in duration-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-400 text-black flex items-center justify-center border-2 border-black shrink-0 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                <Lock className="w-6 h-6 animate-pulse text-black" />
              </div>
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/30 border border-rose-400 text-rose-200 text-[10px] font-bebas font-bold uppercase tracking-wider">
                  ❄️ Licença do Sistema Congelada pelo Administrador Master
                </div>
                <h3 className="text-xl sm:text-2xl font-bebas font-bold text-amber-400 uppercase tracking-wide">
                  Acesso Liberado em Modo Leitura
                </h3>
                <p className="text-xs text-zinc-300 font-medium max-w-2xl leading-relaxed">
                  Você pode navegar por todas as abas e visualizar relatórios, faturamentos, clientes e horários. Modificações e cadastros estão pausados. <strong>A aba de Inbox / Suporte está 100% liberada</strong> para solicitar a reativação da licença.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setInboxInitialNode('reactivation');
                setActiveTab('inbox');
                setManagerMenuOpen(false);
              }}
              className="w-full md:w-auto px-6 py-3.5 bg-amber-400 hover:bg-amber-300 text-black font-bebas font-bold text-sm uppercase tracking-wider rounded-2xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2 cursor-pointer transition-all shrink-0 active:translate-y-0.5"
            >
              <MessageCircle className="w-4 h-4 text-black" />
              Solicitar Reativação no Chat de Suporte
            </button>
          </div>
        )}

        {/* Top Title & Navigation */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border-2 border-black shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-300 border border-black text-black text-xs font-bebas font-bold uppercase tracking-wider mb-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <Building2 className="w-3.5 h-3.5" />
              Painel do Gestor da Barbearia
            </div>
            <h1 className="text-3xl sm:text-4xl font-bebas font-bold text-black uppercase tracking-wide">
              Barba & Estilo - Gestão Operacional & Financeira
            </h1>
          </div>

          <div className="relative">
            <button
              onClick={() => setManagerMenuOpen(!managerMenuOpen)}
              className="flex items-center justify-between gap-3 px-5 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-black border-2 border-black font-bebas font-bold text-base uppercase tracking-wider shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all w-full md:w-auto"
            >
              <div className="flex items-center gap-2">
                <Menu className="w-5 h-5 text-black" />
                <span>Menu de Gestão: {
                  activeTab === 'financial' ? '💵 Financeiro' :
                  activeTab === 'schedule' ? '📅 Grade de Horários' :
                  activeTab === 'barbers' ? '💈 Equipe & Barbeiros' :
                  activeTab === 'clients' ? '👥 Clientes' :
                  activeTab === 'services' ? '✂️ Serviços' :
                  activeTab === 'gallery' ? '📸 Galeria de Imagem' : '👑 Meu Plano SaaS'
                }</span>
              </div>
              <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${managerMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {managerMenuOpen && (
              <div className="absolute right-0 left-0 md:left-auto md:right-0 mt-3 w-full md:w-80 bg-white border-2 border-black rounded-2xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] z-50 p-2.5 space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-3 py-2 text-xs font-bebas font-bold text-zinc-500 uppercase tracking-widest border-b-2 border-zinc-200">
                  Selecione a Seção do Painel
                </div>
                <button
                  onClick={() => { setActiveTab('financial'); setManagerMenuOpen(false); }}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bebas font-bold uppercase tracking-wider flex items-center justify-between transition-all ${activeTab === 'financial' ? 'bg-amber-400 text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'hover:bg-zinc-100 text-zinc-800'}`}
                >
                  <span>💵 Financeiro & Extrato</span>
                  {activeTab === 'financial' && <span className="text-xs">📍 Ativo</span>}
                </button>
                <button
                  onClick={() => { setActiveTab('schedule'); setManagerMenuOpen(false); }}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bebas font-bold uppercase tracking-wider flex items-center justify-between transition-all ${activeTab === 'schedule' ? 'bg-amber-400 text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'hover:bg-zinc-100 text-zinc-800'}`}
                >
                  <span>📅 Grade de Horários</span>
                  {activeTab === 'schedule' && <span className="text-xs">📍 Ativo</span>}
                </button>
                <button
                  onClick={() => { setActiveTab('barbers'); setManagerMenuOpen(false); }}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bebas font-bold uppercase tracking-wider flex items-center justify-between transition-all ${activeTab === 'barbers' ? 'bg-amber-400 text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'hover:bg-zinc-100 text-zinc-800'}`}
                >
                  <span>💈 Equipe & Barbeiros</span>
                  <span className="text-[10px] bg-black text-white px-1.5 py-0.5 rounded-md">{barbers.length}</span>
                </button>
                <button
                  onClick={() => { setActiveTab('clients'); setManagerMenuOpen(false); }}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bebas font-bold uppercase tracking-wider flex items-center justify-between transition-all ${activeTab === 'clients' ? 'bg-amber-400 text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'hover:bg-zinc-100 text-zinc-800'}`}
                >
                  <span>👥 Clientes Cadastrados</span>
                  <span className="text-[10px] bg-black text-white px-1.5 py-0.5 rounded-md">{registeredClients.length}</span>
                </button>
                <button
                  onClick={() => { setActiveTab('services'); setManagerMenuOpen(false); }}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bebas font-bold uppercase tracking-wider flex items-center justify-between transition-all ${activeTab === 'services' ? 'bg-amber-400 text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'hover:bg-zinc-100 text-zinc-800'}`}
                >
                  <span>✂️ Serviços & Preços</span>
                  <span className="text-[10px] bg-black text-white px-1.5 py-0.5 rounded-md">{services.length}</span>
                </button>
                <button
                  onClick={() => { setActiveTab('gallery'); setManagerMenuOpen(false); }}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bebas font-bold uppercase tracking-wider flex items-center justify-between transition-all ${activeTab === 'gallery' ? 'bg-amber-400 text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'hover:bg-zinc-100 text-zinc-800'}`}
                >
                  <span>📸 Galeria de Imagem & Stories</span>
                  {activeTab === 'gallery' && <span className="text-xs">📍 Ativo</span>}
                </button>
                <button
                  onClick={() => { setInboxInitialNode(null); setActiveTab('inbox'); setManagerMenuOpen(false); }}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bebas font-bold uppercase tracking-wider flex items-center justify-between transition-all ${activeTab === 'inbox' ? 'bg-amber-400 text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'hover:bg-zinc-100 text-zinc-800'}`}
                >
                  <span>💬 Suporte & Inbox (Admin)</span>
                  {activeTab === 'inbox' && <span className="text-xs">📍 Ativo</span>}
                </button>
              </div>
            )}
          </div>
        </div>


        {/* Horizontal Navigation Menu Bar (All Tabs Visible) */}
        <div className="bg-white p-2.5 rounded-2xl border-2 border-black shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('financial')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bebas font-bold uppercase tracking-wider whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${activeTab === 'financial' ? 'bg-amber-400 text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800'}`}
          >
            💵 Financeiro & Extrato
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bebas font-bold uppercase tracking-wider whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${activeTab === 'schedule' ? 'bg-amber-400 text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800'}`}
          >
            📅 Grade de Horários
          </button>
          <button
            onClick={() => setActiveTab('barbers')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bebas font-bold uppercase tracking-wider whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${activeTab === 'barbers' ? 'bg-amber-400 text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800'}`}
          >
            💈 Equipe & Barbeiros <span className="bg-black text-white text-[10px] px-1.5 py-0.5 rounded">{barbers.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('clients')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bebas font-bold uppercase tracking-wider whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${activeTab === 'clients' ? 'bg-amber-400 text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800'}`}
          >
            👥 Clientes Cadastrados <span className="bg-black text-white text-[10px] px-1.5 py-0.5 rounded">{registeredClients.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('services')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bebas font-bold uppercase tracking-wider whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${activeTab === 'services' ? 'bg-amber-400 text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800'}`}
          >
            ✂️ Serviços & Preços <span className="bg-black text-white text-[10px] px-1.5 py-0.5 rounded">{services.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('gallery')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bebas font-bold uppercase tracking-wider whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${activeTab === 'gallery' ? 'bg-amber-400 text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800'}`}
          >
            📸 Galeria & Stories
          </button>
          <button
            onClick={() => { setInboxInitialNode(null); setActiveTab('inbox'); }}
            className={`px-4 py-2.5 rounded-xl text-xs font-bebas font-bold uppercase tracking-wider whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${activeTab === 'inbox' ? 'bg-amber-400 text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800'}`}
          >
            💬 Suporte & Inbox
          </button>
        </div>

        {/* TAB 1: FINANCIAL DASHBOARD */}
        {activeTab === 'financial' && (
          <div className="space-y-6">
            
            {/* Financial KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="bg-white border-2 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <p className="text-xs text-zinc-600 font-extrabold uppercase tracking-wider">Faturamento Bruto (Serviços)</p>
                <h3 className="text-3xl font-bebas font-bold text-black mt-2">
                  R$ {grossRevenue.toFixed(2)}
                </h3>
                <p className="text-[11px] text-zinc-600 font-medium mt-1">Soma de todos os cortes e tratamentos</p>
              </div>

              <div className="bg-white border-2 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <p className="text-xs text-zinc-600 font-extrabold uppercase tracking-wider">Comissão da Equipe (70%)</p>
                <h3 className="text-3xl font-bebas font-bold text-blue-600 mt-2">
                  R$ {totalBarberCommissionsPaid.toFixed(2)}
                </h3>
                <p className="text-[11px] text-zinc-600 font-medium mt-1">Repasse direto aos barbeiros</p>
              </div>

              <div className="bg-white border-2 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <p className="text-xs text-zinc-600 font-extrabold uppercase tracking-wider">Lucro Líquido Barbearia (30%)</p>
                <h3 className="text-3xl font-bebas font-bold text-emerald-600 mt-2">
                  R$ {netHouseRevenue.toFixed(2)}
                </h3>
                <p className="text-[11px] text-zinc-600 font-medium mt-1">Retenção líquida do gestor</p>
              </div>

              <div className="bg-white border-2 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <p className="text-xs text-zinc-600 font-extrabold uppercase tracking-wider">Sinal PIX / Online Garantido</p>
                <h3 className="text-3xl font-bebas font-bold text-amber-600 mt-2">
                  R$ {prepaidGross.toFixed(2)}
                </h3>
                <p className="text-[11px] text-zinc-600 font-medium mt-1">Recebido via checkout antecipado</p>
              </div>
            </div>

            {/* Financial Breakdown Table */}
            <div className="bg-white border-2 border-black rounded-2xl overflow-hidden shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <div className="p-5 border-b-2 border-black bg-zinc-50 flex items-center justify-between">
                <h3 className="font-bebas font-bold text-2xl text-black uppercase">
                  Extrato Financeiro Consolidado (Entradas & Comissões)
                </h3>
                <span className="text-xs text-zinc-600 font-bold uppercase">{appointments.length} lançamentos</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-zinc-800">
                  <thead className="bg-zinc-100 text-black uppercase text-[11px] font-bebas font-bold tracking-wider border-b-2 border-black">
                    <tr>
                      <th className="py-3.5 px-4">Cliente & Data</th>
                      <th className="py-3.5 px-4">Serviço</th>
                      <th className="py-3.5 px-4">Barbeiro</th>
                      <th className="py-3.5 px-4">Valor Bruto</th>
                      <th className="py-3.5 px-4">Comissão Barbeiro (70%)</th>
                      <th className="py-3.5 px-4">Retenção Barbearia (30%)</th>
                      <th className="py-3.5 px-4">Pagamento</th>
                      <th className="py-3.5 px-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {appointments.map((apt) => {
                      const isPrepaid = apt.paymentType === 'online_pix' || apt.paymentType === 'online_card';
                      const bCut = getBarberCut(apt);
                      const hCut = getHouseCut(apt);
                      return (
                        <tr key={apt.id} className="hover:bg-amber-50/50 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-black">{apt.clientName}</div>
                            <div className="text-[10px] text-zinc-600 font-semibold">{apt.date.split('-').reverse().join('/')} às {apt.time}</div>
                          </td>

                          <td className="py-3.5 px-4 font-bold text-black">
                            {apt.serviceName}
                          </td>

                          <td className="py-3.5 px-4 font-bold text-black">
                            {apt.barberName}
                          </td>

                          <td className="py-3.5 px-4 font-bebas font-bold text-base text-black">
                            R$ {(apt.servicePrice || 0).toFixed(2)}
                          </td>

                          <td className="py-3.5 px-4 font-bebas font-bold text-base text-blue-700">
                            R$ {bCut.toFixed(2)}
                          </td>

                          <td className="py-3.5 px-4 font-bebas font-bold text-base text-emerald-700">
                            R$ {hCut.toFixed(2)}
                          </td>

                          <td className="py-3.5 px-4">
                            {isPrepaid ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bebas font-bold uppercase bg-emerald-300 text-black border border-black">
                                <CreditCard className="w-3 h-3" /> PIX / Cartão
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bebas font-bold uppercase bg-amber-300 text-black border border-black">
                                <DollarSign className="w-3 h-3" /> No Local
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bebas font-bold uppercase border border-black ${
                                apt.status === 'completed'
                                  ? 'bg-emerald-300 text-black'
                                  : apt.status === 'cancelled'
                                  ? 'bg-rose-300 text-black'
                                  : 'bg-amber-300 text-black'
                              }`}
                            >
                              {apt.status === 'completed' ? '✓ Concluído' : apt.status === 'cancelled' ? 'Cancelado' : 'Agendado'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: INTERACTIVE TEAM SCHEDULE GRID */}
        {activeTab === 'schedule' && (
          <div className="bg-white border-2 border-black rounded-2xl p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-6">
            {/* PENDING RESCHEDULE REQUESTS BANNER FOR MANAGER */}
            {appointments.filter((a) => a.status === 'reschedule_requested').length > 0 && (
              <div className="bg-amber-100 border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-3">
                <div className="flex items-center gap-2 text-black font-bebas font-bold text-xl uppercase">
                  <RefreshCw className="w-5 h-5 text-amber-600 animate-spin" />
                  <span>Solicitações de Remarcação de Clientes ({appointments.filter((a) => a.status === 'reschedule_requested').length})</span>
                </div>
                <div className="space-y-2">
                  {appointments.filter((a) => a.status === 'reschedule_requested').map((apt) => (
                    <div key={apt.id} className="bg-white border-2 border-black rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      <div>
                        <div className="text-sm font-bold text-black">{apt.clientName} ({apt.clientPhone})</div>
                        <div className="text-xs text-zinc-600">
                          Serviço: <strong>{apt.serviceName}</strong> com Barbeiro: <strong>{apt.barberName}</strong>
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
                          <CheckCircle2 className="w-4 h-4" /> Aprovar Remarcação
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

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-black pb-4">
              <div>
                <h3 className="font-bebas font-bold text-2xl text-black uppercase flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-amber-500" />
                  Grade de Atendimentos da Equipe
                </h3>
                <p className="text-xs text-zinc-600 font-medium">Clique em qualquer agendamento para remanejar de barbeiro ou horário</p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-black uppercase">Data Selecionada:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-zinc-50 border-2 border-black text-xs text-black font-bold rounded-xl px-3 py-2 focus:outline-none"
                />
              </div>
            </div>

            {/* Barber Columns Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {barbers.map((barber) => {
                const barberApts = dateAppointments.filter((a) => a.barberId === barber.id);

                return (
                  <div key={barber.id} className="bg-zinc-50 border-2 border-black rounded-2xl p-4 space-y-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <div className="flex items-center gap-3 border-b-2 border-black pb-3">
                      <img
                        src={barber.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                        alt={barber.name}
                        className="w-10 h-10 rounded-full object-cover border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                      />
                      <div>
                        <h4 className="font-bebas font-bold text-lg text-black uppercase">{barber.name}</h4>
                        <span className="text-[10px] text-amber-800 font-bold uppercase">
                          {barberApts.length} cliente(s) agendados hoje
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3 min-h-[220px]">
                      {barberApts.length === 0 ? (
                        <div className="h-40 flex items-center justify-center text-xs text-zinc-500 font-medium border-2 border-dashed border-zinc-300 rounded-xl">
                          Nenhum horário ocupado nesta data
                        </div>
                      ) : (
                        barberApts.map((apt) => (
                          <div
                            key={apt.id}
                            className="bg-white hover:bg-amber-50 border-2 border-black rounded-xl p-3 transition-all space-y-2 group shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] relative"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bebas font-bold text-black flex items-center gap-1 bg-amber-300 px-2 py-0.5 rounded border border-black">
                                <Clock className="w-3.5 h-3.5" /> {apt.time} ({apt.serviceDuration} min)
                              </span>
                              
                              <div className="flex items-center gap-1">
                                {apt.status !== 'completed' && apt.status !== 'cancelled' ? (
                                  <button
                                    onClick={() => {
                                      setReassignApt(apt);
                                      setNewBarberId(apt.barberId);
                                      setNewDate(apt.date);
                                      setNewTime(apt.time);
                                      setNewStatus(apt.status);
                                    }}
                                    className="text-[10px] bg-amber-300 hover:bg-amber-400 text-black px-2 py-0.5 rounded border border-black font-bebas font-bold uppercase transition-all"
                                    title="Remarcar ou alterar barbeiro"
                                  >
                                    🔄 Remarcar
                                  </button>
                                ) : (
                                  <span className="text-[10px] bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded border border-emerald-700 font-bebas font-bold uppercase">
                                    {apt.status === 'completed' ? '✓ Concluído' : 'Cancelado'}
                                  </span>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteAppointment(apt.id);
                                  }}
                                  className="p-1 rounded bg-rose-200 hover:bg-rose-300 text-rose-900 border border-black transition-all"
                                  title="Excluir agendamento"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            <div
                              onClick={() => {
                                if (apt.status !== 'completed' && apt.status !== 'cancelled') {
                                  setReassignApt(apt);
                                  setNewBarberId(apt.barberId);
                                  setNewDate(apt.date);
                                  setNewTime(apt.time);
                                  setNewStatus(apt.status);
                                }
                              }}
                              className={apt.status !== 'completed' && apt.status !== 'cancelled' ? 'cursor-pointer' : ''}
                            >
                              <div className="text-sm font-bold text-black">{apt.clientName}</div>
                              <div className="text-[11px] text-zinc-600 font-semibold">{apt.serviceName} - R$ {apt.servicePrice}</div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                  </div>
                );
              })}
            </div>

          </div>
        )}

        {/* TAB 3: BARBERS & TEAM MANAGEMENT */}
        {activeTab === 'barbers' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border-2 border-black shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
              <div>
                <h3 className="font-bebas font-bold text-3xl text-black uppercase flex items-center gap-2">
                  <Scissors className="w-6 h-6 text-amber-500" />
                  Equipe de Barbeiros ({barbers.length})
                </h3>
                <p className="text-xs text-zinc-600 font-medium">Cadastre, edite informações ou remova profissionais da equipe.</p>
              </div>

              <button
                onClick={handleOpenAddBarber}
                className="px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-black border-2 border-black font-bebas font-bold text-base shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center gap-2 uppercase tracking-wider shrink-0"
              >
                <Plus className="w-5 h-5" /> Cadastrar Novo Barbeiro
              </button>
            </div>

            {/* Manager Emails Association Section */}
            <div className="bg-white p-6 rounded-2xl border-2 border-black shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] space-y-4">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-amber-500" />
                <div>
                  <h4 className="font-bebas font-bold text-2xl text-black uppercase">Gerentes / Co-Gestores Associados</h4>
                  <p className="text-xs text-zinc-600 font-medium">Associe e-mails externos de contas Google para conceder acesso ao Painel de Gestão (inclusive gerentes que não são barbeiros).</p>
                </div>
              </div>

              <form onSubmit={handleAddManagerEmail} className="flex gap-2">
                <input
                  type="email"
                  value={newManagerEmail}
                  onChange={(e) => setNewManagerEmail(e.target.value)}
                  placeholder="Digite o e-mail do gestor (ex: gestor@gmail.com)..."
                  className="flex-1 px-4 py-2.5 rounded-xl border-2 border-black text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-black text-amber-400 font-bebas font-bold uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-zinc-800 transition-all shrink-0 flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Adicionar Gestor
                </button>
              </form>

              {managerEmails.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-2">
                  {managerEmails.map((email) => (
                    <div key={email} className="flex items-center gap-2 bg-zinc-100 border-2 border-black px-3 py-1.5 rounded-xl text-xs font-medium">
                      <span className="font-bold text-black">{email}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveManagerEmail(email)}
                        className="text-rose-600 hover:text-rose-800 font-bold ml-1"
                        title="Remover acesso de gestor"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-500 italic">Nenhum e-mail de gestor externo adicional cadastrado além do dono principal.</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {barbers.map((barber) => (
                <div
                  key={barber.id}
                  className="bg-white border-2 border-black rounded-2xl p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-4 relative flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center gap-4 mb-4">
                      <img
                        src={barber.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500'}
                        alt={barber.name}
                        className="w-16 h-16 rounded-2xl object-cover border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                      />
                      <div>
                        <h4 className="font-bebas font-bold text-2xl text-black uppercase leading-none">{barber.name}</h4>
                        <span className="inline-block mt-1 px-2.5 py-0.5 rounded-lg bg-amber-300 text-black text-[11px] font-bebas font-bold border border-black uppercase tracking-wider">
                          {barber.specialty}
                        </span>
                        {barber.isOwner && (
                          <span className="ml-1.5 inline-block px-2 py-0.5 rounded-lg bg-black text-amber-400 text-[10px] font-bebas font-bold border border-black uppercase">
                            Dono / Master
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-zinc-600 font-medium leading-relaxed mb-4">
                      {barber.bio || 'Profissional especialista da equipe Barbearia Barba & Estilo.'}
                    </p>

                    <div className="space-y-1.5 text-xs text-zinc-800 border-t-2 border-zinc-100 pt-3 font-medium">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Experiência:</span>
                        <strong className="text-black font-bold">{barber.experienceYears || 3} anos</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Instagram:</span>
                        <strong className="text-amber-800 font-bold">{barber.instagram || '@barbeiro_street'}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Telefone:</span>
                        <strong className="text-black font-bold">{barber.phone || '(11) 98765-4321'}</strong>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-zinc-100">
                        <span className="text-zinc-500">Comissão do Barbeiro:</span>
                        <strong className="text-amber-700 font-bold bg-amber-100 px-2 py-0.5 rounded border border-black">
                          {barber.commissionRate ?? 70}%
                        </strong>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-zinc-100">
                        <span className="text-zinc-500">Conta Google:</span>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded border border-black truncate max-w-[160px] ${barber.googleEmail ? 'bg-emerald-100 text-emerald-900' : 'bg-zinc-100 text-zinc-500'}`}>
                          {barber.googleEmail || 'Não associada'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-4 border-t-2 border-black">
                    <button
                      onClick={() => handleOpenEditBarber(barber)}
                      className="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-black border-2 border-black text-xs font-bebas font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center gap-1.5 uppercase"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Editar
                    </button>

                    <button
                      onClick={() => handleDeleteBarber(barber.id)}
                      className="px-3 py-1.5 rounded-xl bg-rose-300 hover:bg-rose-200 text-black border-2 border-black text-xs font-bebas font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all uppercase"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: REGISTERED CLIENTS DIRECTORY */}
        {activeTab === 'clients' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border-2 border-black shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
              <div>
                <h3 className="font-bebas font-bold text-3xl text-black uppercase flex items-center gap-2">
                  <Users className="w-6 h-6 text-amber-500" />
                  Base de Clientes Cadastrados ({registeredClients.length})
                </h3>
                <p className="text-xs text-zinc-600 font-medium">Lista consolidada dos clientes que se cadastraram e realizaram agendamentos no site.</p>
              </div>
            </div>

            <div className="bg-white border-2 border-black rounded-2xl overflow-hidden shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-zinc-800">
                  <thead className="bg-zinc-100 text-black uppercase text-[11px] font-bebas font-bold tracking-wider border-b-2 border-black">
                    <tr>
                      <th className="py-3.5 px-4">Nome do Cliente</th>
                      <th className="py-3.5 px-4">Contato / Email</th>
                      <th className="py-3.5 px-4">Qtd. Agendamentos</th>
                      <th className="py-3.5 px-4">Total Consumido</th>
                      <th className="py-3.5 px-4">Última Visita</th>
                      <th className="py-3.5 px-4 text-right">Ações & Contato</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {registeredClients.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-zinc-500 font-medium">
                          Nenhum cliente registrado ainda.
                        </td>
                      </tr>
                    ) : (
                      registeredClients.map((client, idx) => {
                        const cleanPhone = client.phone.replace(/\D/g, '');
                        return (
                          <tr key={idx} className="hover:bg-amber-50/50 transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-black text-sm">{client.name}</div>
                              <span className="text-[10px] text-amber-800 font-bebas font-bold uppercase bg-amber-200 px-1.5 py-0.5 rounded border border-black">
                                Cliente Ativo
                              </span>
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="font-semibold text-black">{client.phone || 'Telefone não informado'}</div>
                              <div className="text-[11px] text-zinc-500 font-medium">{client.email}</div>
                            </td>

                            <td className="py-3.5 px-4 font-bebas font-bold text-lg text-black">
                              {client.totalAppointments} visitas
                            </td>

                            <td className="py-3.5 px-4 font-bebas font-bold text-lg text-emerald-700">
                              R$ {client.totalSpent.toFixed(2)}
                            </td>

                            <td className="py-3.5 px-4 font-bold text-black">
                              {client.lastAppointmentDate ? client.lastAppointmentDate.split('-').reverse().join('/') : 'Recente'}
                            </td>

                            <td className="py-3.5 px-4 text-right space-x-2">
                              {cleanPhone && (
                                <a
                                  href={`https://wa.me/55${cleanPhone}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-black border-2 border-black text-xs font-bebas font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all uppercase"
                                >
                                  WhatsApp
                                </a>
                              )}
                              <button
                                onClick={() => handleDeleteClient(client.key)}
                                className="px-3 py-1.5 rounded-xl bg-rose-300 hover:bg-rose-200 text-black border-2 border-black text-xs font-bebas font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all uppercase"
                              >
                                Excluir
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: SERVICES CATALOG & PREPAYMENT RULES */}
        {activeTab === 'services' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bebas font-bold text-3xl text-black uppercase">
                  Catálogo de Serviços & Regras de Pagamento
                </h3>
                <p className="text-xs text-zinc-600 font-medium">Ative pagamentos antecipados para evitar no-shows em serviços específicos</p>
              </div>

              <button
                onClick={handleOpenAddService}
                className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black border-2 border-black font-bebas font-bold text-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center gap-2 uppercase tracking-wider"
              >
                <Plus className="w-4 h-4" /> Novo Serviço
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map((service) => (
                <div
                  key={service.id}
                  className="bg-white border-2 border-black rounded-2xl p-5 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] space-y-4 relative"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-bebas font-bold text-2xl text-black uppercase flex-1">{service.name}</h4>
                    <span className="text-2xl font-bebas font-bold text-black shrink-0">
                      R$ {service.price.toFixed(2)}
                    </span>
                  </div>

                  <p className="text-xs text-zinc-600 font-medium leading-relaxed">{service.description}</p>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t-2 border-black text-xs">
                    <span className="text-black font-bold flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-500" /> {service.durationMinutes} min
                    </span>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        onClick={() => handleToggleFeatured(service.id, service.isFeatured)}
                        className={`px-2.5 py-1 rounded-full font-bebas font-bold text-[11px] tracking-wider uppercase border-2 border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center gap-1 ${
                          service.isFeatured
                            ? 'bg-amber-400 text-black font-extrabold'
                            : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                        }`}
                        title="Alternar se o serviço aparece em destaque no 'Agende em 1-Clique' da Home"
                      >
                        <Sparkles className="w-3 h-3" />
                        {service.isFeatured ? '⭐ Destaque 1-Clique' : '+ Destacar'}
                      </button>

                      <button
                        onClick={() => handleTogglePrepayment(service.id, service.requirePrepayment)}
                        className={`px-2.5 py-1 rounded-full font-bebas font-bold text-[11px] tracking-wider uppercase border-2 border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all ${
                          service.requirePrepayment
                            ? 'bg-emerald-300 text-black'
                            : 'bg-zinc-100 text-black'
                        }`}
                      >
                        {service.requirePrepayment ? '⚡ Sinal PIX' : 'Pagar Local'}
                      </button>

                      <button
                        onClick={() => handleOpenEditService(service)}
                        className="px-2.5 py-1 rounded-xl bg-amber-400 hover:bg-amber-300 text-black border-2 border-black text-xs font-bebas font-bold shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center gap-1 uppercase"
                      >
                        <Edit3 className="w-3 h-3" /> Editar
                      </button>

                      <button
                        onClick={() => handleDeleteService(service.id)}
                        className="px-2 py-1 rounded-xl bg-rose-300 hover:bg-rose-200 text-black border-2 border-black text-xs font-bebas font-bold shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all uppercase"
                        title="Excluir serviço"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: SAAS SUBSCRIPTION MANAGEMENT */}
        {activeTab === 'plan' && (
          <div className="bg-white border-2 border-black rounded-2xl p-8 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] max-w-4xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-black pb-6">
              <div>
                <span className="text-xs font-bebas font-bold text-amber-600 uppercase tracking-wider block mb-1">
                  Assinatura Ativa da Barbearia
                </span>
                <h3 className="text-3xl font-bebas font-bold text-black uppercase">
                  {currentPlan.name}
                </h3>
              </div>

              <div className="text-right">
                <span className="text-4xl font-bebas font-bold text-black">
                  R$ {currentPlan.price.toFixed(2)}
                </span>
                <span className="text-xs text-zinc-600 font-bold"> /mês</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-zinc-800">
              <div className="bg-zinc-50 p-4 rounded-2xl border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] space-y-2">
                <span className="text-zinc-600 font-bold uppercase tracking-wider">Limite de Profissionais:</span>
                <p className="text-2xl font-bebas font-bold text-black">
                  {barbers.length} de {currentPlan.maxBarbers} utilizados
                </p>
              </div>

              <div className="bg-zinc-50 p-4 rounded-2xl border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] space-y-2">
                <span className="text-zinc-600 font-bold uppercase tracking-wider">Recursos Ativos:</span>
                <p className="text-2xl font-bebas font-bold text-emerald-600">
                  Módulo Financeiro + PIX Online
                </p>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                onClick={() => setChangePlanModalOpen(true)}
                className="px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-black border-2 border-black font-bebas font-bold text-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center gap-2 uppercase tracking-wider"
              >
                <Sparkles className="w-4 h-4" /> Fazer Upgrade ou Downgrade de Plano
              </button>
            </div>
          </div>
        )}

        {/* TAB 7: GALLERY & INSTAGRAM PROFILE MANAGEMENT */}
        {activeTab === 'gallery' && (
          <div className="space-y-8">
            
            {/* Header Notification Banner */}
            {saveSuccessMsg && (
              <div className="p-4 rounded-2xl bg-emerald-400 text-black border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-bebas font-bold text-lg flex items-center gap-3 animate-bounce">
                <Check className="w-6 h-6 stroke-[3]" />
                {saveSuccessMsg}
              </div>
            )}

            {/* SECTION 1: BARBERSHOP INSTAGRAM PROFILE */}
            <div className="bg-white border-2 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-black pb-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-200 border border-black text-black text-xs font-bebas font-bold uppercase tracking-wider mb-1">
                    <Instagram className="w-3.5 h-3.5 text-rose-600" /> Perfil & Identidade da Galeria
                  </div>
                  <h2 className="text-2xl font-bebas font-bold text-black uppercase tracking-wide">
                    Personalizar Perfil da Barbearia
                  </h2>
                  <p className="text-xs text-zinc-600 font-medium">
                    Ajuste o nome de usuário do Instagram e a foto de perfil exibidos no carrossel de stories.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleSaveGallerySettings()}
                  disabled={isSavingGallery}
                  className="px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-black border-2 border-black font-bebas font-bold text-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center gap-2 uppercase tracking-wider shrink-0"
                >
                  <Save className={`w-4 h-4 ${isSavingGallery ? 'animate-spin' : ''}`} />
                  {isSavingGallery ? 'Salvando...' : 'Salvar Perfil'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                {/* Profile Avatar Live Preview */}
                <div className="md:col-span-3 flex flex-col items-center justify-center p-4 bg-zinc-50 border-2 border-black rounded-2xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] text-center space-y-3">
                  <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider">Preview do Avatar</span>
                  <div className="p-[3px] rounded-full bg-gradient-to-tr from-amber-400 via-amber-500 to-rose-500 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                    <img
                      src={gallerySettings.avatarUrl || DEFAULT_GALLERY_SETTINGS.avatarUrl}
                      alt="Avatar Barbearia"
                      referrerPolicy="no-referrer"
                      className="w-20 h-20 rounded-full bg-black object-cover border-2 border-black"
                    />
                  </div>
                  <span className="text-xs font-bold text-black font-mono bg-zinc-200 px-2.5 py-0.5 rounded-md border border-black">
                    @{gallerySettings.username || DEFAULT_GALLERY_SETTINGS.username}
                  </span>
                </div>

                {/* Profile Form Fields */}
                <div className="md:col-span-9 space-y-4">
                  <div>
                    <label className="block text-xs font-extrabold text-zinc-800 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <AtSign className="w-3.5 h-3.5 text-black" />
                      Nome de Usuário da Barbearia (Handle @)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: barbearia_barbaestilo"
                      value={gallerySettings.username}
                      onChange={(e) => setGallerySettings({ ...gallerySettings, username: e.target.value.replace('@', '') })}
                      className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3.5 py-2.5 text-xs font-bold text-black focus:outline-none focus:bg-amber-50/50"
                    />
                    <p className="text-[11px] text-zinc-500 mt-1">
                      Este nome aparecerá no topo do leitor de stories do site principal.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-zinc-800 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-black" />
                      URL da Foto de Perfil (Avatar)
                    </label>
                    <input
                      type="text"
                      placeholder="https://..."
                      value={gallerySettings.avatarUrl}
                      onChange={(e) => setGallerySettings({ ...gallerySettings, avatarUrl: e.target.value })}
                      className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3.5 py-2.5 text-xs font-bold text-black focus:outline-none focus:bg-amber-50/50"
                    />
                    <p className="text-[11px] text-zinc-500 mt-1">
                      Cole o link direto da logo ou foto oficial da barbearia.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 2: STORY GALLERY SLIDES MANAGEMENT */}
            <div className="bg-white border-2 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-black pb-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-300 border border-black text-black text-xs font-bebas font-bold uppercase tracking-wider mb-1">
                    <ImageIcon className="w-3.5 h-3.5" /> Telas do Story Carrossel
                  </div>
                  <h2 className="text-2xl font-bebas font-bold text-black uppercase tracking-wide">
                    Gerenciamento da Galeria de Imagens ({gallerySettings.stories.length} Telas)
                  </h2>
                  <p className="text-xs text-zinc-600 font-medium">
                    Adicione, edite a legenda, altere a tag em amarelo e troque a imagem de cada tela da galeria.
                  </p>
                </div>

                <button
                  onClick={handleOpenAddStory}
                  className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black border-2 border-black font-bebas font-bold text-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center gap-2 uppercase tracking-wider shrink-0"
                >
                  <Plus className="w-4 h-4" /> Adicionar Nova Tela
                </button>
              </div>

              {/* Grid of Story Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {gallerySettings.stories.map((story, index) => (
                  <div
                    key={story.id}
                    className="bg-zinc-950 border-2 border-black rounded-2xl overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between group relative"
                  >
                    {/* Story Preview Frame */}
                    <div className="relative aspect-[9/16] w-full overflow-hidden bg-zinc-900">
                      <MediaRenderer
                        src={story.image}
                        alt={story.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        isVideo={story.isVideo}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/60 pointer-events-none" />

                      {/* Header Badge */}
                      <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
                        <span className="px-2 py-0.5 rounded bg-black/60 text-amber-400 border border-amber-400/40 font-bebas text-xs font-extrabold tracking-wider">
                          Nº {index + 1}
                        </span>
                        <span className="text-[10px] text-white font-bold bg-black/60 px-2 py-0.5 rounded">
                          {story.time}
                        </span>
                      </div>

                      {/* Story Text Overlay */}
                      <div className="absolute bottom-3 left-3 right-3 space-y-1.5 z-10 text-white">
                        <span className="inline-block px-2 py-0.5 rounded bg-amber-400 text-black font-bebas text-[11px] font-black uppercase border border-black">
                          {story.tag}
                        </span>
                        <p className="text-xs font-bold leading-snug drop-shadow-md line-clamp-2">
                          {story.title}
                        </p>
                        <p className="text-[10px] text-zinc-300 font-medium">
                          Barbeiro: {story.barber}
                        </p>
                        {story.ctaText && (
                          <div className="pt-1">
                            <span className="w-full block text-center py-1 bg-amber-400 text-black font-bebas text-[11px] font-extrabold rounded-md border border-black uppercase truncate px-1">
                              {story.ctaText}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Toolbar */}
                    <div className="bg-zinc-900 p-3 border-t-2 border-black flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleMoveStory(index, 'up')}
                          disabled={index === 0}
                          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-white border border-zinc-700 transition-all"
                          title="Mover para esquerda/cima"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleMoveStory(index, 'down')}
                          disabled={index === gallerySettings.stories.length - 1}
                          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-white border border-zinc-700 transition-all"
                          title="Mover para direita/baixo"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditStory(story)}
                          className="p-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-bold border border-black transition-all"
                          title="Editar esta tela"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteStorySlide(story.id)}
                          className="p-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-bold border border-black transition-all"
                          title="Excluir esta tela"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom Action Bar for Gallery */}
              <div className="pt-4 border-t-2 border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-xs font-bold text-zinc-500">
                  💡 Todas as alterações salvas são refletidas instantaneamente no site para todos os clientes.
                </p>
                <button
                  type="button"
                  onClick={() => handleSaveGallerySettings()}
                  disabled={isSavingGallery}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-black border-2 border-black font-bebas font-bold text-base shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center justify-center gap-2 uppercase tracking-wider shrink-0"
                >
                  <Save className={`w-5 h-5 ${isSavingGallery ? 'animate-spin' : ''}`} />
                  {isSavingGallery ? 'Salvando...' : 'Salvar Alterações da Galeria'}
                </button>
              </div>
            </div>

          </div>
        )}

        {/* TAB 8: INBOX & SUPORTE */}
        {activeTab === 'inbox' && (
          <SupportInbox
            mode="manager"
            autoStartTicket={!!inboxInitialNode}
            initialNodeId={inboxInitialNode || 'root'}
          />
        )}

        {/* MODAL: REASSIGN / REMARCAR APPOINTMENT */}

        {reassignApt && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border-2 border-black rounded-2xl p-6 max-w-md w-full space-y-4 text-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <h3 className="font-bebas font-bold text-2xl text-black uppercase border-b-2 border-black pb-2 flex items-center justify-between">
                <span>Remarcar / Remanejar</span>
                <span className="text-xs bg-amber-300 px-2 py-0.5 rounded border border-black font-sans font-bold">R$ {reassignApt.servicePrice}</span>
              </h3>
              
              <div className="bg-zinc-50 border-2 border-black rounded-xl p-3 text-xs space-y-1 font-medium">
                <div>Cliente: <strong className="text-black">{reassignApt.clientName}</strong></div>
                <div>Serviço: <strong className="text-black">{reassignApt.serviceName}</strong></div>
              </div>

              <div>
                <label className="block text-xs font-bold text-black uppercase mb-1">Selecionar Barbeiro</label>
                <select
                  value={newBarberId}
                  onChange={(e) => setNewBarberId(e.target.value)}
                  className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-none"
                >
                  {barbers.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-black uppercase mb-1">Nova Data</label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-black uppercase mb-1">Novo Horário (Grade de Horários)</label>
                  <select
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-none"
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
              </div>

              <div>
                <label className="block text-xs font-bold text-black uppercase mb-1">Status do Atendimento</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as AppointmentStatus)}
                  className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-none"
                >
                  <option value="scheduled">Agendado / Confirmado</option>
                  <option value="in_progress">Em Atendimento</option>
                  <option value="completed">Concluído</option>
                  <option value="delayed">Atrasado</option>
                  <option value="no_show">No-Show (Ausente)</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>

              <div className="flex items-center justify-between pt-4 border-t-2 border-black">
                <button
                  type="button"
                  onClick={() => handleDeleteAppointment(reassignApt.id)}
                  className="px-3 py-2 rounded-xl bg-rose-200 hover:bg-rose-300 text-rose-900 border-2 border-black font-bebas font-bold text-xs uppercase flex items-center gap-1 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Excluir Agendamento
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setReassignApt(null)}
                    className="px-3 py-2 rounded-xl bg-zinc-100 text-black border-2 border-black font-bebas font-bold text-xs uppercase"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmReassign}
                    className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black border-2 border-black font-bebas font-bold text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase tracking-wider"
                  >
                    Salvar Alterações
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: ADD / EDIT SERVICE */}
        {serviceModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border-2 border-black rounded-2xl p-6 max-w-md w-full space-y-4 text-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <h3 className="font-bebas font-bold text-2xl text-black uppercase border-b-2 border-black pb-2">
                {editingService ? 'Editar Serviço' : 'Cadastrar Novo Serviço'}
              </h3>

              <div>
                <label className="block text-xs font-bold text-black uppercase mb-1">Nome do Serviço</label>
                <input
                  type="text"
                  required
                  value={newServiceData.name}
                  onChange={(e) => setNewServiceData({ ...newServiceData, name: e.target.value })}
                  placeholder="Ex: Corte Degrade & Barba"
                  className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3 py-2 text-sm text-black focus:outline-none font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-black uppercase mb-1">Descrição</label>
                <textarea
                  rows={3}
                  value={newServiceData.description}
                  onChange={(e) => setNewServiceData({ ...newServiceData, description: e.target.value })}
                  placeholder="Detalhes do serviço..."
                  className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3 py-2 text-xs text-black focus:outline-none font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-black uppercase mb-1">Preço (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newServiceData.price}
                    onChange={(e) => setNewServiceData({ ...newServiceData, price: Number(e.target.value) })}
                    className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3 py-2 text-sm text-black focus:outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-black uppercase mb-1">Duração (Minutos)</label>
                  <input
                    type="number"
                    required
                    value={newServiceData.durationMinutes}
                    onChange={(e) => setNewServiceData({ ...newServiceData, durationMinutes: Number(e.target.value) })}
                    className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3 py-2 text-sm text-black focus:outline-none font-bold"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2 border-t-2 border-zinc-100">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isFeaturedService"
                    checked={newServiceData.isFeatured || false}
                    onChange={(e) => setNewServiceData({ ...newServiceData, isFeatured: e.target.checked })}
                    className="w-4 h-4 rounded border-2 border-black text-amber-500 focus:ring-amber-400"
                  />
                  <label htmlFor="isFeaturedService" className="text-xs font-bold text-black cursor-pointer uppercase">
                    ⭐ Destacar na Home ("Agende em 1-Clique")
                  </label>
                </div>

                {newServiceData.isFeatured && (
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 uppercase mb-1">Tag do Destaque (ex: MAIS PEDIDO, ESPECIAL, COMBO)</label>
                    <input
                      type="text"
                      value={newServiceData.featuredTag || ''}
                      onChange={(e) => setNewServiceData({ ...newServiceData, featuredTag: e.target.value })}
                      placeholder="Ex: MAIS PEDIDO"
                      className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3 py-1.5 text-xs text-black font-bold uppercase"
                    />
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="requirePrepaymentService"
                    checked={newServiceData.requirePrepayment}
                    onChange={(e) => setNewServiceData({ ...newServiceData, requirePrepayment: e.target.checked })}
                    className="w-4 h-4 rounded border-2 border-black text-amber-500 focus:ring-amber-400"
                  />
                  <label htmlFor="requirePrepaymentService" className="text-xs font-bold text-black cursor-pointer uppercase">
                    Exigir Sinal PIX para este serviço
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t-2 border-black">
                <button
                  type="button"
                  onClick={() => setServiceModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-100 text-black border-2 border-black font-bebas font-bold text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveService}
                  className="px-4 py-2 rounded-xl bg-amber-400 text-black border-2 border-black font-bebas font-bold text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase tracking-wider"
                >
                  {editingService ? 'Salvar Alterações' : 'Cadastrar Serviço'}
                </button>
              </div>
            </div>
          </div>
        )}
        {barberModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border-2 border-black rounded-2xl p-6 max-w-lg w-full space-y-4 text-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-h-[90vh] overflow-y-auto">
              <h3 className="font-bebas font-bold text-2xl text-black uppercase">
                {editingBarber ? 'Editar Barbeiro' : 'Cadastrar Novo Barbeiro'}
              </h3>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1 uppercase">Nome Completo do Barbeiro</label>
                <input
                  type="text"
                  placeholder="Ex: Kauan Barber"
                  value={barberFormData.name}
                  onChange={(e) => setBarberFormData({ ...barberFormData, name: e.target.value })}
                  className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1 uppercase">Especialidade Principal</label>
                <input
                  type="text"
                  placeholder="Ex: Degradê Navalhado & Platinado"
                  value={barberFormData.specialty}
                  onChange={(e) => setBarberFormData({ ...barberFormData, specialty: e.target.value })}
                  className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3 py-2 text-xs font-semibold text-black focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1 uppercase">URL da Foto de Perfil</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={barberFormData.photoUrl}
                  onChange={(e) => setBarberFormData({ ...barberFormData, photoUrl: e.target.value })}
                  className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3 py-2 text-xs font-mono text-black focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1 uppercase">Telefone / WhatsApp</label>
                  <input
                    type="text"
                    placeholder="(11) 98765-4321"
                    value={barberFormData.phone}
                    onChange={(e) => setBarberFormData({ ...barberFormData, phone: e.target.value })}
                    className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1 uppercase">Instagram</label>
                  <input
                    type="text"
                    placeholder="@barbeiro_oficial"
                    value={barberFormData.instagram}
                    onChange={(e) => setBarberFormData({ ...barberFormData, instagram: e.target.value })}
                    className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1 uppercase">Anos de Experiência</label>
                  <input
                    type="number"
                    value={barberFormData.experienceYears}
                    onChange={(e) => setBarberFormData({ ...barberFormData, experienceYears: parseInt(e.target.value) || 0 })}
                    className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1 uppercase">Avaliação (1 a 5)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={barberFormData.rating}
                    onChange={(e) => setBarberFormData({ ...barberFormData, rating: parseFloat(e.target.value) || 5.0 })}
                    className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1 uppercase">Biografia / Descrição</label>
                <textarea
                  placeholder="Resumo dos serviços e estilo do barbeiro..."
                  value={barberFormData.bio}
                  onChange={(e) => setBarberFormData({ ...barberFormData, bio: e.target.value })}
                  className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3 py-2 text-xs font-medium text-black focus:outline-none"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1 uppercase">🔗 E-mail da Conta Google (Associação Reversível)</label>
                <input
                  type="email"
                  placeholder="barbeiro@gmail.com (Deixe em branco para desassociar)"
                  value={barberFormData.googleEmail || ''}
                  onChange={(e) => setBarberFormData({ ...barberFormData, googleEmail: e.target.value })}
                  className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-none"
                />
                <p className="text-[10px] text-zinc-500 mt-1">Vincula o perfil à conta Google do profissional (reversível: você pode alterar ou limpar a qualquer momento).</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1 uppercase">Percentual de Comissão do Barbeiro (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={barberFormData.commissionRate ?? 70}
                  onChange={(e) => setBarberFormData({ ...barberFormData, commissionRate: parseInt(e.target.value) || 70 })}
                  className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-none"
                />
                <p className="text-[10px] text-zinc-500 mt-1">Ex: 70 significa que o barbeiro recebe 70% do valor do serviço e a barbearia retém 30%.</p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isOwner"
                  checked={barberFormData.isOwner}
                  onChange={(e) => setBarberFormData({ ...barberFormData, isOwner: e.target.checked })}
                  className="w-4 h-4 rounded border-2 border-black text-amber-500 focus:ring-amber-400"
                />
                <label htmlFor="isOwner" className="text-xs font-bold text-black cursor-pointer uppercase">
                  É Proprietário / Master da Barbearia
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t-2 border-black">
                <button
                  onClick={() => setBarberModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-100 text-black border-2 border-black font-bebas font-bold text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveBarber}
                  className="px-4 py-2 rounded-xl bg-amber-400 text-black border-2 border-black font-bebas font-bold text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase tracking-wider"
                >
                  {editingBarber ? 'Salvar Alterações' : 'Cadastrar Barbeiro'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: CHANGE SAAS PLAN */}
        {changePlanModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border-2 border-black rounded-2xl p-6 max-w-2xl w-full space-y-6 text-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <h3 className="font-bebas font-bold text-2xl text-black uppercase">Escolha seu Novo Plano SaaS</h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {DEFAULT_SAAS_PLANS.map((plan) => (
                  <div
                    key={plan.id}
                    className={`bg-zinc-50 border-2 border-black rounded-2xl p-4 flex flex-col justify-between space-y-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] ${
                      plan.id === currentPlan.id ? 'bg-amber-100 ring-2 ring-black' : ''
                    }`}
                  >
                    <div>
                      <h4 className="font-bebas font-bold text-xl text-black uppercase">{plan.name}</h4>
                      <p className="text-2xl font-bebas font-bold text-black">R$ {plan.price}/mês</p>
                      <span className="text-[10px] text-zinc-600 font-bold uppercase">Até {plan.maxBarbers} barbeiros</span>
                    </div>

                    <button
                      onClick={() => {
                        setCurrentPlan(plan);
                        setChangePlanModalOpen(false);
                      }}
                      className={`w-full py-2 rounded-xl text-xs font-bebas font-bold uppercase tracking-wider border-2 border-black ${
                        plan.id === currentPlan.id
                          ? 'bg-zinc-200 text-black'
                          : 'bg-amber-400 text-black hover:bg-amber-300 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                      }`}
                    >
                      {plan.id === currentPlan.id ? 'Plano Atual' : 'Selecionar Plano'}
                    </button>
                  </div>
                ))}
              </div>

              <div className="text-right">
                <button
                  onClick={() => setChangePlanModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-100 text-black border-2 border-black font-bebas font-bold text-sm"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: ADD / EDIT STORY SLIDE */}
        {editingStoryModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border-2 border-black rounded-2xl p-6 max-w-lg w-full space-y-4 text-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-h-[90vh] overflow-y-auto">
              <h3 className="font-bebas font-bold text-2xl text-black uppercase">
                {editingStorySlide ? 'Editar Tela da Galeria' : 'Adicionar Nova Tela no Story'}
              </h3>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1 uppercase">
                  URL da Imagem ou Vídeo (MP4, YouTube, Google Drive, Google Fotos)
                </label>
                <input
                  type="text"
                  placeholder="https://... (Cole link de foto, mp4, YouTube ou Google Drive/Fotos)"
                  value={storyFormData.image}
                  onChange={(e) => setStoryFormData({ ...storyFormData, image: e.target.value })}
                  className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-none"
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  💡 Aceita links de imagem (Unsplash, Imgur) ou vídeos (MP4, YouTube, Google Drive, Google Fotos).
                </p>
              </div>

              {storyFormData.image && (
                <div className="relative aspect-video w-full rounded-xl overflow-hidden border-2 border-black bg-zinc-900">
                  <MediaRenderer
                    src={storyFormData.image}
                    alt="Preview Mídia"
                    className="w-full h-full object-cover"
                    isVideo={storyFormData.isVideo}
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1 uppercase">Legenda / Título da Tela</label>
                <input
                  type="text"
                  placeholder="Ex: Degradê Navalhado na Régua ⚡"
                  value={storyFormData.title}
                  onChange={(e) => setStoryFormData({ ...storyFormData, title: e.target.value })}
                  className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1 uppercase">Tag Amarela (Badge)</label>
                  <input
                    type="text"
                    placeholder="Ex: CORTE DO DIA"
                    value={storyFormData.tag}
                    onChange={(e) => setStoryFormData({ ...storyFormData, tag: e.target.value })}
                    className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1 uppercase">Tempo Exibido</label>
                  <input
                    type="text"
                    placeholder="Ex: 2 h"
                    value={storyFormData.time}
                    onChange={(e) => setStoryFormData({ ...storyFormData, time: e.target.value })}
                    className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1 uppercase">Nome do Barbeiro / Autor</label>
                  <input
                    type="text"
                    placeholder="Ex: Kauan Barber"
                    value={storyFormData.barber}
                    onChange={(e) => setStoryFormData({ ...storyFormData, barber: e.target.value })}
                    className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1 uppercase">Ícone do Botão CTA</label>
                  <select
                    value={storyFormData.ctaIcon || 'calendar'}
                    onChange={(e) => setStoryFormData({ ...storyFormData, ctaIcon: e.target.value as any })}
                    className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-none"
                  >
                    <option value="calendar">📅 Calendário (Agendar)</option>
                    <option value="scissors">✂️ Tesoura (Corte)</option>
                    <option value="sparkles">✨ Brilho (Especial)</option>
                    <option value="flame">🔥 Fogo (Combos)</option>
                    <option value="zap">⚡ Raio (Rápido)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1 uppercase">Texto do Botão de Ação (CTA)</label>
                <input
                  type="text"
                  placeholder="Ex: Agendar Este Corte"
                  value={storyFormData.ctaText || ''}
                  onChange={(e) => setStoryFormData({ ...storyFormData, ctaText: e.target.value })}
                  className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-none"
                />
              </div>

              {modalError && (
                <div className="p-3 bg-rose-100 border-2 border-black rounded-xl text-rose-900 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  {modalError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t-2 border-black">
                <button
                  type="button"
                  onClick={() => setEditingStoryModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-100 text-black border-2 border-black font-bebas font-bold text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveStorySlide}
                  disabled={isSavingGallery}
                  className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-black border-2 border-black font-bebas font-bold text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase tracking-wider flex items-center gap-2"
                >
                  <Save className={`w-4 h-4 ${isSavingGallery ? 'animate-spin' : ''}`} />
                  {isSavingGallery ? 'Salvando...' : 'Salvar Tela'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
