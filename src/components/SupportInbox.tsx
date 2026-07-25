import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Headphones,
  Send,
  Plus,
  CheckCircle2,
  Clock,
  User,
  Crown,
  Building2,
  Bot,
  AlertCircle,
  ChevronRight,
  ArrowLeft,
  Sparkles,
  HelpCircle,
  RefreshCw,
  Search,
  Filter,
  Check,
  X,
  Star,
  XCircle,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { sendEmailNotification, MASTER_ADMIN_EMAIL } from '../lib/emailService';
import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { SupportTicket, SupportMessage } from '../types';
import { CHATBOT_NODES, ChatbotNode } from '../data/chatbotKnowledge';

interface SupportInboxProps {
  mode: 'manager' | 'super_admin';
  autoStartTicket?: boolean;
  initialNodeId?: string;
}

// Clean text formatting component for BarberBot and messages
const FormattedBotText: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;
  const paragraphs = text.split('\n\n');
  return (
    <div className="space-y-2 text-xs leading-relaxed font-medium">
      {paragraphs.map((p, pIdx) => {
        const lines = p.split('\n');
        return (
          <div key={pIdx} className="space-y-1">
            {lines.map((line, lIdx) => {
              const trimmed = line.trim();
              const isBullet = trimmed.startsWith('•') || trimmed.startsWith('-') || /^\d+\./.test(trimmed);
              const cleanText = line.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');

              if (isBullet) {
                return (
                  <div key={lIdx} className="flex items-start gap-2 pl-1 my-0.5">
                    <span className="text-amber-500 font-bold shrink-0 mt-0.5">•</span>
                    <span className="text-zinc-800 font-semibold">{cleanText.replace(/^[•\-\d+\.]\s*/, '')}</span>
                  </div>
                );
              }

              return (
                <p key={lIdx} className="text-zinc-800">
                  {cleanText}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

export const SupportInbox: React.FC<SupportInboxProps> = ({ mode, autoStartTicket, initialNodeId }) => {
  const { user, userProfile } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [replyText, setReplyText] = useState<string>('');
  const [loadingTickets, setLoadingTickets] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  // Quick responses for Super Admin
  const QUICK_TEMPLATES = [
    '✅ Acesso liberado no sistema!',
    '🔄 Por favor, tente recarregar a página e fazer novo login.',
    '📋 Recebemos sua solicitação e já estamos analisando.',
    '👍 Seu plano foi atualizado com sucesso!',
    '🔒 A licença foi congelada por pendência administrativa.',
  ];

  // Evaluation & Feedback State (for Manager)
  const [serviceRating, setServiceRating] = useState<number>(5);
  const [systemRating, setSystemRating] = useState<number>(5);
  const [isResolvedVal, setIsResolvedVal] = useState<boolean>(true);
  const [feedbackComment, setFeedbackComment] = useState<string>('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState<boolean>(false);

  // Self-Service Chatbot Wizard State (for Manager creating new ticket)
  const [isCreatingNewTicket, setIsCreatingNewTicket] = useState<boolean>(false);
  const [currentNodeId, setCurrentNodeId] = useState<string>('root');
  const [chatbotTrace, setChatbotTrace] = useState<
    { title: string; message: string; selectedOption?: string }[]
  >([]);
  const [escalationReason, setEscalationReason] = useState<string>('');
  const [isSubmittingEscalation, setIsSubmittingEscalation] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-start new ticket wizard if requested (e.g. from frozen license button)
  useEffect(() => {
    if (autoStartTicket) {
      setIsCreatingNewTicket(true);
      setCurrentNodeId(initialNodeId || 'root');
      setSelectedTicketId(null);
      setMobileView('chat');
      if (initialNodeId === 'reactivation') {
        setEscalationReason('Solicito a reativação da licença do meu painel e liberação do acesso ao sistema.');
      }
    }
  }, [autoStartTicket, initialNodeId]);

  // Auto-scroll to bottom on new messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, chatbotTrace, currentNodeId, isCreatingNewTicket, mobileView]);

  // 1. Stream Tickets
  useEffect(() => {
    let q;
    if (mode === 'manager') {
      const email = (user?.email || '').toLowerCase();
      if (!email) return;
      q = query(
        collection(db, 'support_tickets'),
        where('managerEmail', '==', email)
      );
    } else {
      q = query(collection(db, 'support_tickets'));
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: SupportTicket[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<SupportTicket, 'id'>),
        }));

        // Sort by updatedAt descending locally
        list.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());

        setTickets(list);
        setLoadingTickets(false);
      },
      (error) => {
        console.error('Error listening to support_tickets:', error);
        setLoadingTickets(false);
      }
    );

    return () => unsubscribe();
  }, [mode, user]);

  // 2. Stream Messages for Selected Ticket
  useEffect(() => {
    if (!selectedTicketId || isCreatingNewTicket) {
      setMessages([]);
      return;
    }

    const messagesRef = collection(db, 'support_tickets', selectedTicketId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: SupportMessage[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<SupportMessage, 'id'>),
        }));
        setMessages(list);

        // Mark as read according to mode
        const ticketDoc = doc(db, 'support_tickets', selectedTicketId);
        if (mode === 'manager') {
          updateDoc(ticketDoc, { unreadByManager: false }).catch(() => {});
        } else {
          updateDoc(ticketDoc, { unreadByAdmin: false }).catch(() => {});
        }
      },
      (err) => {
        console.error('Error fetching support messages:', err);
      }
    );

    return () => unsubscribe();
  }, [selectedTicketId, isCreatingNewTicket, mode]);

  // Handle Chatbot Option Click
  const handleChatbotOption = async (option: {
    label: string;
    nextNodeId?: string;
    action?: 'node' | 'escalate' | 'resolve';
  }) => {
    alert('Modo de Demonstração Visual: As opções de autoatendimento interativo estão desativadas para apresentação estática do inbox.');
  };

  // Submit Escalated Ticket to Super Admin
  const handleCreateEscalatedTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!escalationReason.trim() || !user) return;

    setIsSubmittingEscalation(true);
    try {
      const now = new Date().toISOString();
      const managerName = userProfile?.name || user.displayName || 'Gestor da Barbearia';
      const managerEmail = (user.email || '').toLowerCase();
      const shopName = userProfile?.barberId ? 'Barbearia do Gestor' : 'Barba & Estilo - Unidade Principal';

      // 1. Create ticket doc in Firestore
      const subjectTitle =
        currentNodeId === 'reactivation'
          ? 'Solicitação de Reativação de Licença'
          : `Atendimento do Gestor: ${CHATBOT_NODES[currentNodeId]?.title || 'Suporte'}`;

      const newTicketRef = await addDoc(collection(db, 'support_tickets'), {
        managerEmail,
        managerName,
        shopName,
        subject: subjectTitle,
        category: currentNodeId,
        status: 'open',
        createdAt: now,
        updatedAt: now,
        lastMessage: escalationReason.trim(),
        lastSenderRole: 'manager',
        unreadByAdmin: true,
        unreadByManager: false,
      });

      // 2. Add Chatbot transcript message to subcollection
      let transcriptText = '🤖 Histórico de Interação com BarberBot:\n';
      chatbotTrace.forEach((step, idx) => {
        transcriptText += `\n• Tópico ${idx + 1}: ${step.title}\n  Ação selecionada: "${step.selectedOption}"`;
      });

      if (chatbotTrace.length > 0) {
        await addDoc(collection(db, 'support_tickets', newTicketRef.id, 'messages'), {
          ticketId: newTicketRef.id,
          senderRole: 'chatbot',
          senderName: 'BarberBot',
          content: transcriptText,
          createdAt: new Date(Date.now() - 1000).toISOString(),
        });
      }

      // 3. Add Manager initial question message
      await addDoc(collection(db, 'support_tickets', newTicketRef.id, 'messages'), {
        ticketId: newTicketRef.id,
        senderRole: 'manager',
        senderName: managerName,
        senderEmail: managerEmail,
        content: escalationReason.trim(),
        createdAt: now,
      });

      // 4. Send Email Notification to Super Admin
      const appOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://barber.app';
      sendEmailNotification({
        toEmail: MASTER_ADMIN_EMAIL,
        toName: 'Administrador Master',
        subject: `[Suporte - Novo Chamado] ${subjectTitle}`,
        title: `Novo Chamado de Suporte: ${subjectTitle}`,
        bodyText: `O gestor ${managerName} (${shopName} - ${managerEmail}) abriu um novo chamado de suporte no sistema:\n\n"${escalationReason.trim()}"`,
        actionUrl: `${appOrigin}/?tab=support`,
        actionText: 'Ver Chamado no Painel Master',
        category: 'support_ticket',
        relatedId: newTicketRef.id,
      }).catch((err) => console.error('Error sending support email:', err));

      // Reset state and view created ticket
      setIsCreatingNewTicket(false);
      setChatbotTrace([]);
      setCurrentNodeId('root');
      setEscalationReason('');
      setSelectedTicketId(newTicketRef.id);
    } catch (err) {
      console.error('Error creating support ticket:', err);
      alert('Ocorreu um erro ao enviar seu chamado. Tente novamente.');
    } finally {
      setIsSubmittingEscalation(false);
    }
  };

  // Send Reply in Active Ticket
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedTicketId || !user) return;

    const content = replyText.trim();
    setReplyText('');

    try {
      const now = new Date().toISOString();
      const senderRole = mode === 'super_admin' ? 'super_admin' : 'manager';
      const senderName =
        mode === 'super_admin'
          ? 'Administrador Master'
          : userProfile?.name || user.displayName || 'Gestor';

      // 1. Add message
      await addDoc(collection(db, 'support_tickets', selectedTicketId, 'messages'), {
        ticketId: selectedTicketId,
        senderRole,
        senderName,
        senderEmail: user.email,
        content,
        createdAt: now,
      });

      // 2. Update ticket header and send email notification
      const ticketRef = doc(db, 'support_tickets', selectedTicketId);
      const activeTicket = tickets.find((t) => t.id === selectedTicketId);
      const appOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://barber.app';

      if (mode === 'super_admin') {
        await updateDoc(ticketRef, {
          lastMessage: content,
          lastSenderRole: 'super_admin',
          updatedAt: now,
          unreadByManager: true,
          unreadByAdmin: false,
          status: 'in_progress',
        });

        // Email to Manager
        if (activeTicket) {
          sendEmailNotification({
            toEmail: activeTicket.managerEmail,
            toName: activeTicket.managerName,
            subject: `[Suporte Resposta] ${activeTicket.subject}`,
            title: `Nova resposta do Administrador Master`,
            bodyText: `O suporte do sistema respondeu ao chamado "${activeTicket.subject}":\n\n"${content}"`,
            actionUrl: `${appOrigin}/?tab=inbox`,
            actionText: 'Ver Resposta no Painel',
            category: 'support_reply',
            relatedId: selectedTicketId,
          }).catch((err) => console.error('Error sending support reply email:', err));
        }
      } else {
        await updateDoc(ticketRef, {
          lastMessage: content,
          lastSenderRole: 'manager',
          updatedAt: now,
          unreadByAdmin: true,
          unreadByManager: false,
        });

        // Email to Super Admin
        if (activeTicket) {
          sendEmailNotification({
            toEmail: MASTER_ADMIN_EMAIL,
            toName: 'Administrador Master',
            subject: `[Suporte Nova Mensagem] ${activeTicket.subject}`,
            title: `Nova mensagem no chamado: ${activeTicket.subject}`,
            bodyText: `O gestor ${activeTicket.managerName} (${activeTicket.shopName}) enviou uma mensagem:\n\n"${content}"`,
            actionUrl: `${appOrigin}/?tab=support`,
            actionText: 'Responder no Painel Master',
            category: 'support_ticket',
            relatedId: selectedTicketId,
          }).catch((err) => console.error('Error sending support message email:', err));
        }
      }
    } catch (err) {
      console.error('Error sending reply:', err);
    }
  };

  // Update Ticket Status (Super Admin)
  const handleUpdateStatus = async (ticketId: string, newStatus: 'open' | 'in_progress' | 'resolved') => {
    try {
      await updateDoc(doc(db, 'support_tickets', ticketId), {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  // Close / Resolve Ticket (for both Requester Manager & Administrator)
  const handleCloseTicket = async (ticketId: string) => {
    try {
      const ticketRef = doc(db, 'support_tickets', ticketId);
      await updateDoc(ticketRef, {
        status: 'resolved',
        updatedAt: new Date().toISOString(),
        unreadByAdmin: mode === 'manager',
        unreadByManager: mode === 'super_admin',
      });

      // Post automated system message
      const messagesRef = collection(db, 'support_tickets', ticketId, 'messages');
      const closerName = mode === 'super_admin' ? 'Administrador Master' : (userProfile?.name || 'Gestor');
      await addDoc(messagesRef, {
        ticketId,
        senderRole: mode === 'super_admin' ? 'super_admin' : 'manager',
        senderName: closerName,
        senderEmail: user?.email || '',
        content: `🔒 Chamado encerrado por ${closerName}. ${
          mode === 'manager'
            ? 'Aguardando avaliação da experiência e do atendimento.'
            : 'Atendimento concluído pelo suporte.'
        }`,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Error closing ticket:', err);
    }
  };

  // Submit Feedback & Evaluation (Manager)
  const handleSubmitFeedback = async (ticketId: string) => {
    setIsSubmittingFeedback(true);
    try {
      const ticketRef = doc(db, 'support_tickets', ticketId);
      const feedbackData = {
        serviceRating,
        systemRating,
        isResolved: isResolvedVal,
        comment: feedbackComment.trim(),
        createdAt: new Date().toISOString(),
      };

      await updateDoc(ticketRef, {
        feedback: feedbackData,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Error submitting feedback:', err);
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const selectedTicket = tickets.find((t) => t.id === selectedTicketId);

  // Filtered tickets list
  const filteredTickets = tickets.filter((t) => {
    if (statusFilter === 'open' && t.status === 'resolved') return false;
    if (statusFilter === 'resolved' && t.status !== 'resolved') return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        t.managerName.toLowerCase().includes(q) ||
        t.managerEmail.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.lastMessage.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="bg-white border-2 border-black rounded-3xl overflow-hidden shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] min-h-[600px] flex flex-col font-sans">
      
      {/* Header Bar */}
      <div className="bg-zinc-900 text-white p-5 border-b-2 border-black flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-400 border-2 border-black flex items-center justify-center text-black font-bebas font-bold shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]">
            <Headphones className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bebas font-bold text-amber-400 uppercase tracking-wide flex items-center gap-2">
              Inbox & Suporte Direto
              {mode === 'super_admin' ? (
                <span className="text-xs bg-amber-400 text-black px-2 py-0.5 rounded-full font-bold">
                  Painel Master Admin
                </span>
              ) : (
                <span className="text-xs bg-zinc-800 text-amber-300 border border-amber-400 px-2 py-0.5 rounded-full font-bold">
                  Suporte do Gestor
                </span>
              )}
            </h2>
            <p className="text-xs text-zinc-400 font-medium">
              {mode === 'super_admin'
                ? 'Atenda chamados e dúvidas de gestores de barbearias em tempo real.'
                : 'Autoatendimento inteligente e canal direto de comunicação com o Administrador Master.'}
            </p>
          </div>
        </div>

        {/* Manager Action: Start New Ticket */}
        {mode === 'manager' && (
          <button
            onClick={() => {
              setIsCreatingNewTicket(true);
              setSelectedTicketId(null);
              setCurrentNodeId('root');
              setChatbotTrace([]);
            }}
            className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-black font-bebas font-bold text-xs uppercase tracking-wide rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-1.5 cursor-pointer transition-all shrink-0"
          >
            <Bot className="w-4 h-4" /> Novo Atendimento / Dúvida
          </button>
        )}
      </div>

      {/* Main Inbox Body Grid */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 min-h-[500px]">
        
        {/* LEFT COLUMN: TICKETS LIST (4 cols on desktop) */}
        <div className={`md:col-span-4 border-r-2 border-black bg-zinc-50 flex flex-col ${mobileView === 'chat' ? 'hidden md:flex' : 'flex'}`}>
          
          {/* Search & Filter Bar */}
          <div className="p-3 border-b-2 border-black space-y-2 bg-white">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar chamados por gestor, e-mail ou assunto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-zinc-50 border border-black rounded-xl pl-8 pr-3 py-1.5 text-xs font-bold text-black focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1 text-[11px] font-bebas font-bold">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`flex-1 py-1 rounded-lg border border-black uppercase text-center cursor-pointer transition-all ${
                  statusFilter === 'all' ? 'bg-amber-400 text-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]' : 'bg-white text-zinc-600'
                }`}
              >
                Todos ({tickets.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('open')}
                className={`flex-1 py-1 rounded-lg border border-black uppercase text-center cursor-pointer transition-all ${
                  statusFilter === 'open' ? 'bg-amber-400 text-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]' : 'bg-white text-zinc-600'
                }`}
              >
                Abertos ({tickets.filter((t) => t.status !== 'resolved').length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('resolved')}
                className={`flex-1 py-1 rounded-lg border border-black uppercase text-center cursor-pointer transition-all ${
                  statusFilter === 'resolved' ? 'bg-amber-400 text-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]' : 'bg-white text-zinc-600'
                }`}
              >
                Resolvidos
              </button>
            </div>
          </div>

          {/* Tickets List */}
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-200">
            {loadingTickets ? (
              <div className="p-6 text-center text-xs text-zinc-500 font-bold animate-pulse">
                Carregando mensagens...
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500 space-y-2">
                <HelpCircle className="w-8 h-8 text-zinc-300 mx-auto" />
                <p className="font-bold">Nenhum chamado encontrado.</p>
                {mode === 'manager' && (
                  <p className="text-[11px] text-zinc-400">
                    Clique em "Novo Atendimento" para tirar dúvidas no assistente.
                  </p>
                )}
              </div>
            ) : (
              filteredTickets.map((ticket) => {
                const isSelected = selectedTicketId === ticket.id && !isCreatingNewTicket;
                const hasUnread =
                  mode === 'super_admin' ? ticket.unreadByAdmin : ticket.unreadByManager;

                return (
                  <div
                    key={ticket.id}
                    onClick={() => {
                      setSelectedTicketId(ticket.id);
                      setIsCreatingNewTicket(false);
                      setMobileView('chat');
                    }}
                    className={`p-4 cursor-pointer transition-all relative ${
                      isSelected
                        ? 'bg-amber-100 border-l-4 border-amber-500 font-bold'
                        : 'hover:bg-zinc-100 bg-white'
                    }`}
                  >
                    {hasUnread && (
                      <span className="absolute top-3 right-3 w-3 h-3 rounded-full bg-rose-500 ring-2 ring-white animate-ping" />
                    )}

                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-bebas font-bold text-sm text-black uppercase truncate">
                        {mode === 'super_admin' ? ticket.shopName || ticket.managerName : ticket.subject}
                      </span>
                      <span className="text-[10px] text-zinc-400 shrink-0">
                        {ticket.updatedAt
                          ? new Date(ticket.updatedAt).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </span>
                    </div>

                    <div className="text-xs text-zinc-600 line-clamp-1 font-medium mb-2">
                      {ticket.lastMessage || 'Sem mensagens'}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      {mode === 'super_admin' && (
                        <span className="text-[10px] text-zinc-500 font-bold flex items-center gap-1">
                          <User className="w-3 h-3 text-amber-500" /> {ticket.managerName}
                        </span>
                      )}

                      <div className="flex items-center gap-1.5 ml-auto">
                        {ticket.status === 'resolved' ? (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-[10px] font-bebas font-bold uppercase">
                            Resolvido
                          </span>
                        ) : ticket.status === 'in_progress' ? (
                          <span className="px-2 py-0.5 bg-sky-100 text-sky-800 border border-sky-300 rounded text-[10px] font-bebas font-bold uppercase">
                            Em Atendimento
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded text-[10px] font-bebas font-bold uppercase">
                            Aberto
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: CHAT WINDOW OR CHATBOT WIZARD (8 cols on desktop) */}
        <div className={`md:col-span-8 bg-zinc-100 flex flex-col justify-between relative min-h-[450px] ${mobileView === 'list' && !isCreatingNewTicket ? 'hidden md:flex' : 'flex'}`}>
          
          {/* VIEW A: CHATBOT SELF-SERVICE WIZARD (MANAGER CREATING NEW) */}
          {isCreatingNewTicket ? (
            <div className="flex-1 p-6 space-y-6 overflow-y-auto">
              
              {/* Top Banner */}
              <div className="bg-amber-400 border-2 border-black p-4 rounded-2xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-black text-amber-400 flex items-center justify-center border-2 border-black shrink-0 shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]">
                    <Bot className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bebas font-bold text-xl text-black uppercase tracking-wide">
                      BarberBot — Autoatendimento Inteligente
                    </h3>
                    <p className="text-xs text-black/80 font-medium">
                      Respostas imediatas e canal direto com o suporte do Administrador Master.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingNewTicket(false);
                    setMobileView('list');
                  }}
                  className="p-1.5 bg-black text-white hover:bg-zinc-800 rounded-xl border border-black cursor-pointer text-xs font-bold"
                  title="Fechar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Chatbot Steps Stream */}
              <div className="space-y-4">
                
                {/* Previous Steps History */}
                {chatbotTrace.map((step, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex gap-3 max-w-xl">
                      <div className="w-8 h-8 rounded-xl bg-amber-400 border border-black flex items-center justify-center text-black font-bold shrink-0 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                        <Bot className="w-4 h-4" />
                      </div>
                      <div className="bg-white border-2 border-black rounded-2xl p-4 text-xs space-y-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex-1">
                        <strong className="text-black uppercase font-bebas text-sm block">{step.title}</strong>
                        <FormattedBotText text={step.message} />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <div className="bg-black text-amber-400 border-2 border-black rounded-2xl px-4 py-2 text-xs font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        {step.selectedOption}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Current Active Node */}
                {currentNodeId !== 'escalate' && CHATBOT_NODES[currentNodeId] && (
                  <div className="space-y-3">
                    <div className="flex gap-3 max-w-xl">
                      <div className="w-8 h-8 rounded-xl bg-amber-400 border border-black flex items-center justify-center text-black font-bold shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        <Bot className="w-4 h-4 animate-bounce" />
                      </div>
                      <div className="bg-white border-2 border-black rounded-2xl p-4 text-xs space-y-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex-1">
                        <strong className="text-black uppercase font-bebas text-sm block text-amber-600">
                          {CHATBOT_NODES[currentNodeId].title}
                        </strong>
                        <FormattedBotText text={CHATBOT_NODES[currentNodeId].message} />
                      </div>
                    </div>

                    {/* Options Buttons */}
                    <div className="pl-11 space-y-2 max-w-xl">
                      {CHATBOT_NODES[currentNodeId].options.map((opt, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleChatbotOption(opt)}
                          className="w-full text-left p-3.5 rounded-xl bg-white hover:bg-amber-100 border-2 border-black text-xs font-bold text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer flex items-center justify-between group active:translate-y-0.5"
                        >
                          <span>{opt.label}</span>
                          <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-black transition-transform group-hover:translate-x-1" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Escalation Node (Form to talk to Super Admin) */}
                {currentNodeId === 'escalate' && (
                  <div className="bg-white border-2 border-black rounded-3xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-4">
                    <div className="flex items-center gap-2 text-rose-600 font-bebas font-bold text-lg uppercase">
                      <Crown className="w-5 h-5 text-amber-500" /> Falar com o Administrador Master
                    </div>
                    <p className="text-xs text-zinc-600 font-medium">
                      Descreva abaixo detalhadamente o que você precisa ou qual dúvida não foi respondida. O Administrador Master receberá seu chamado imediatamente e responderá aqui mesmo.
                    </p>

                    <form onSubmit={handleCreateEscalatedTicket} className="space-y-3">
                      <textarea
                        required
                        rows={4}
                        placeholder="Digite aqui a sua dúvida, solicitação de upgrade, suporte financeiro ou ajuda técnica..."
                        value={escalationReason}
                        onChange={(e) => setEscalationReason(e.target.value)}
                        className="w-full bg-zinc-50 border-2 border-black rounded-2xl p-3 text-xs font-bold text-black focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />

                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setCurrentNodeId('root')}
                          className="px-4 py-2 bg-zinc-200 text-black font-bebas font-bold text-xs uppercase rounded-xl border border-black cursor-pointer"
                        >
                          Voltar ao Menu
                        </button>

                        <button
                          type="submit"
                          disabled={isSubmittingEscalation}
                          className="px-6 py-2.5 bg-amber-400 hover:bg-amber-300 text-black font-bebas font-bold text-xs uppercase tracking-wide rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                        >
                          <Send className="w-4 h-4" />
                          {isSubmittingEscalation ? 'Enviando...' : 'Enviar Chamado ao Administrador'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>
          ) : selectedTicket ? (
            
            /* VIEW B: ACTIVE TICKET REAL-TIME CHAT */
            <div className="flex-1 flex flex-col h-full">
              
              {/* Active Ticket Top Bar */}
              <div className="bg-white p-4 border-b-2 border-black flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setMobileView('list')}
                    className="md:hidden p-2 bg-zinc-100 hover:bg-zinc-200 text-black rounded-xl border border-black font-bold cursor-pointer"
                    title="Voltar para a lista"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bebas font-bold text-lg text-black uppercase">
                        {selectedTicket.subject}
                      </h3>
                      <span className="text-xs bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded border border-black font-mono">
                        #{selectedTicket.id.slice(0, 6)}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-500 font-medium flex items-center gap-3 mt-0.5">
                      <span>Barbearia: <strong className="text-black">{selectedTicket.shopName}</strong></span>
                      <span>Gestor: <strong className="text-black">{selectedTicket.managerName}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  {/* Close Ticket Button (For both Requester & Super Admin) */}
                  {selectedTicket.status !== 'resolved' ? (
                    <button
                      type="button"
                      onClick={() => handleCloseTicket(selectedTicket.id)}
                      className="px-3.5 py-1.5 bg-rose-500 hover:bg-rose-600 text-white font-bebas font-bold text-xs uppercase rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1.5 cursor-pointer transition-all active:translate-y-0.5"
                      title="Encerrar o chamado e solicitar avaliação"
                    >
                      <XCircle className="w-4 h-4" />
                      Encerrar Atendimento
                    </button>
                  ) : (
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-900 border-2 border-emerald-500 rounded-xl font-bebas font-bold text-xs uppercase flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      Chamado Encerrado
                    </span>
                  )}

                  {/* Status Toggle for Super Admin */}
                  {mode === 'super_admin' && (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase">Status:</span>
                      <select
                        value={selectedTicket.status}
                        onChange={(e) =>
                          handleUpdateStatus(selectedTicket.id, e.target.value as any)
                        }
                        className="bg-zinc-50 border-2 border-black rounded-xl px-2.5 py-1 text-xs font-bold text-black focus:outline-none cursor-pointer"
                      >
                        <option value="open">Aberto</option>
                        <option value="in_progress">Em Atendimento</option>
                        <option value="resolved">Resolvido</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Chat Message Stream */}
              <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center text-xs text-zinc-400 py-12 font-bold animate-pulse">
                    Buscando conversa...
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isBot = msg.senderRole === 'chatbot';
                    const isAdmin = msg.senderRole === 'super_admin';
                    const isManager = msg.senderRole === 'manager';

                    const isMe =
                      (mode === 'super_admin' && isAdmin) ||
                      (mode === 'manager' && isManager);

                    return (
                      <div
                        key={msg.id}
                        className={`flex gap-3 ${
                          isMe ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        {!isMe && (
                          <div
                            className={`w-8 h-8 rounded-xl border border-black flex items-center justify-center text-xs font-bold shrink-0 ${
                              isBot
                                ? 'bg-zinc-200 text-black'
                                : isAdmin
                                ? 'bg-amber-400 text-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
                                : 'bg-zinc-800 text-amber-400'
                            }`}
                          >
                            {isBot ? (
                              <Bot className="w-4 h-4" />
                            ) : isAdmin ? (
                              <Crown className="w-4 h-4" />
                            ) : (
                              <User className="w-4 h-4" />
                            )}
                          </div>
                        )}

                        <div
                          className={`max-w-md p-4 rounded-2xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-xs space-y-1 ${
                            isMe
                              ? 'bg-black text-amber-400'
                              : isBot
                              ? 'bg-zinc-50 text-zinc-800'
                              : isAdmin
                              ? 'bg-amber-300 text-black'
                              : 'bg-white text-black'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-4 border-b border-black/10 pb-1">
                            <strong className="font-bebas text-sm uppercase tracking-wider">
                              {msg.senderName} {isMe ? '(Você)' : ''}
                            </strong>
                            <span className="text-[10px] opacity-70">
                              {msg.createdAt
                                ? new Date(msg.createdAt).toLocaleTimeString('pt-BR', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : ''}
                            </span>
                          </div>

                          {isBot ? (
                            <FormattedBotText text={msg.content} />
                          ) : (
                            <p className="whitespace-pre-line leading-relaxed font-medium">{msg.content}</p>
                          )}
                        </div>

                        {isMe && (
                          <div
                            className={`w-8 h-8 rounded-xl border border-black flex items-center justify-center text-xs font-bold shrink-0 ${
                              mode === 'super_admin'
                                ? 'bg-amber-400 text-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
                                : 'bg-zinc-800 text-amber-400'
                            }`}
                          >
                            {mode === 'super_admin' ? (
                              <Crown className="w-4 h-4" />
                            ) : (
                              <User className="w-4 h-4" />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Responses for Super Admin */}
              {mode === 'super_admin' && selectedTicket.status !== 'resolved' && (
                <div className="px-4 py-2 bg-zinc-50 border-t border-zinc-200 flex flex-wrap gap-1.5 text-[11px]">
                  <span className="font-bold text-zinc-600 self-center mr-1 text-[10px] uppercase">
                    Respostas Rápidas:
                  </span>
                  {QUICK_TEMPLATES.map((tmpl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setReplyText(tmpl)}
                      className="px-2.5 py-1 bg-white hover:bg-amber-100 text-zinc-800 rounded-lg border border-black/30 font-medium transition-all text-[11px] cursor-pointer"
                    >
                      {tmpl}
                    </button>
                  ))}
                </div>
              )}

              {/* Evaluation & Feedback Section when Resolved */}
              {selectedTicket.status === 'resolved' && (
                <div className="p-4 sm:p-5 bg-amber-50 border-t-2 border-black space-y-4">
                  {selectedTicket.feedback ? (
                    /* SUMMARY OF COMPLETED EVALUATION */
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-amber-400 text-black rounded-xl border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                            <Star className="w-4 h-4 fill-black text-black" />
                          </div>
                          <h4 className="font-bebas font-bold text-base text-black uppercase tracking-wide">
                            Avaliação do Atendimento & Sistema
                          </h4>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full border-2 border-black uppercase ${
                            selectedTicket.feedback.isResolved
                              ? 'bg-emerald-300 text-black'
                              : 'bg-rose-300 text-black'
                          }`}
                        >
                          {selectedTicket.feedback.isResolved ? '👍 Problema Resolvido' : '👎 Não Resolvido'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-white p-3 rounded-2xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                          <span className="text-[10px] text-zinc-500 font-bold uppercase block">
                            Atendimento do Suporte:
                          </span>
                          <div className="flex items-center gap-1 mt-1">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={`w-4 h-4 ${
                                  s <= selectedTicket.feedback!.serviceRating
                                    ? 'text-amber-500 fill-amber-400'
                                    : 'text-zinc-300'
                                }`}
                              />
                            ))}
                            <span className="font-bebas font-bold text-sm text-black ml-1">
                              {selectedTicket.feedback.serviceRating}/5
                            </span>
                          </div>
                        </div>

                        <div className="bg-white p-3 rounded-2xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                          <span className="text-[10px] text-zinc-500 font-bold uppercase block">
                            Nota para o Sistema BarbaEstilo:
                          </span>
                          <div className="flex items-center gap-1 mt-1">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={`w-4 h-4 ${
                                  s <= selectedTicket.feedback!.systemRating
                                    ? 'text-amber-500 fill-amber-400'
                                    : 'text-zinc-300'
                                }`}
                              />
                            ))}
                            <span className="font-bebas font-bold text-sm text-black ml-1">
                              {selectedTicket.feedback.systemRating}/5
                            </span>
                          </div>
                        </div>
                      </div>

                      {selectedTicket.feedback.comment && (
                        <div className="bg-white p-3 rounded-2xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-xs text-zinc-800 italic">
                          <span className="text-[10px] text-zinc-500 font-bold uppercase block not-italic mb-0.5">
                            Comentário / Sugestão:
                          </span>
                          "{selectedTicket.feedback.comment}"
                        </div>
                      )}
                    </div>
                  ) : mode === 'manager' ? (
                    /* MANAGER INTERACTIVE EVALUATION FORM */
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-amber-400 text-black rounded-2xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                          <Star className="w-5 h-5 fill-black text-black" />
                        </div>
                        <div>
                          <h4 className="font-bebas font-bold text-lg text-black uppercase tracking-wide">
                            Atendimento Concluído — Por favor, avalie sua experiência
                          </h4>
                          <p className="text-xs text-zinc-600 font-medium">
                            Deixe sua avaliação do suporte e do sistema para melhorarmos continuamente.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* 1. Atendimento */}
                        <div className="bg-white p-3.5 rounded-2xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] space-y-1">
                          <label className="text-xs font-bold text-black uppercase block">
                            1. Avaliação do Atendimento:
                          </label>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => setServiceRating(star)}
                                className="p-0.5 hover:scale-125 transition-transform cursor-pointer"
                              >
                                <Star
                                  className={`w-6 h-6 ${
                                    star <= serviceRating
                                      ? 'text-amber-500 fill-amber-400'
                                      : 'text-zinc-300'
                                  }`}
                                />
                              </button>
                            ))}
                            <span className="font-bebas font-bold text-base text-black ml-2">
                              {serviceRating} / 5
                            </span>
                          </div>
                        </div>

                        {/* 2. Sistema */}
                        <div className="bg-white p-3.5 rounded-2xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] space-y-1">
                          <label className="text-xs font-bold text-black uppercase block">
                            2. Nota para o Sistema:
                          </label>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => setSystemRating(star)}
                                className="p-0.5 hover:scale-125 transition-transform cursor-pointer"
                              >
                                <Star
                                  className={`w-6 h-6 ${
                                    star <= systemRating
                                      ? 'text-amber-500 fill-amber-400'
                                      : 'text-zinc-300'
                                  }`}
                                />
                              </button>
                            ))}
                            <span className="font-bebas font-bold text-base text-black ml-2">
                              {systemRating} / 5
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 3. Foi resolvido? */}
                      <div className="bg-white p-3.5 rounded-2xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] space-y-2">
                        <label className="text-xs font-bold text-black uppercase block">
                          3. O seu problema foi resolvido?
                        </label>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setIsResolvedVal(true)}
                            className={`flex-1 py-2 px-3 rounded-xl border-2 border-black font-bebas font-bold text-xs uppercase flex items-center justify-center gap-2 cursor-pointer transition-all ${
                              isResolvedVal
                                ? 'bg-emerald-400 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                                : 'bg-zinc-50 text-zinc-600 hover:bg-zinc-100'
                            }`}
                          >
                            <ThumbsUp className="w-4 h-4" /> Sim, resolvido
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsResolvedVal(false)}
                            className={`flex-1 py-2 px-3 rounded-xl border-2 border-black font-bebas font-bold text-xs uppercase flex items-center justify-center gap-2 cursor-pointer transition-all ${
                              !isResolvedVal
                                ? 'bg-rose-500 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                                : 'bg-zinc-50 text-zinc-600 hover:bg-zinc-100'
                            }`}
                          >
                            <ThumbsDown className="w-4 h-4" /> Não foi resolvido
                          </button>
                        </div>
                      </div>

                      {/* Comment & Submit */}
                      <div className="bg-white p-3.5 rounded-2xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] space-y-2">
                        <label className="text-xs font-bold text-black uppercase block">
                          4. Comentário adicional ou sugestão para o sistema (opcional):
                        </label>
                        <textarea
                          rows={2}
                          value={feedbackComment}
                          onChange={(e) => setFeedbackComment(e.target.value)}
                          placeholder="Deixe suas observações..."
                          className="w-full bg-zinc-50 border border-black rounded-xl p-2.5 text-xs font-bold text-black focus:outline-none"
                        />
                        <button
                          type="button"
                          disabled={isSubmittingFeedback}
                          onClick={() => handleSubmitFeedback(selectedTicket.id)}
                          className="w-full py-3 bg-amber-400 hover:bg-amber-300 text-black font-bebas font-bold text-sm uppercase tracking-wide rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2 cursor-pointer transition-all"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          {isSubmittingFeedback ? 'Enviando...' : 'Salvar e Enviar Avaliação'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* SUPER ADMIN PENDING EVALUATION NOTICE */
                    <div className="p-3 bg-white rounded-2xl border-2 border-black text-center text-xs text-zinc-600 font-bold flex items-center justify-center gap-2">
                      <Clock className="w-4 h-4 text-amber-500" />
                      Atendimento finalizado. Aguardando o gestor enviar a avaliação do suporte e do sistema.
                    </div>
                  )}
                </div>
              )}

              {/* Chat Input Bar */}
              {selectedTicket.status === 'resolved' ? (
                <div className="bg-emerald-100 border-t-2 border-black p-3 text-center text-xs text-emerald-950 font-bold flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  Este chamado está encerrado. Digite uma mensagem abaixo para reabrir o atendimento.
                </div>
              ) : null}

              <form onSubmit={handleSendReply} className="p-4 bg-white border-t-2 border-black flex gap-2">
                <input
                  type="text"
                  placeholder={
                    mode === 'super_admin'
                      ? 'Responder ao gestor da barbearia... (Enter para enviar)'
                      : 'Escreva sua mensagem para o Administrador... (Enter para enviar)'
                  }
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendReply(e);
                    }
                  }}
                  className="flex-1 bg-zinc-50 border-2 border-black rounded-xl px-4 py-2.5 text-xs font-bold text-black focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <button
                  type="submit"
                  disabled={!replyText.trim()}
                  className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-black font-bebas font-bold text-xs uppercase tracking-wide rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-40"
                >
                  <Send className="w-4 h-4" /> Enviar
                </button>
              </form>

            </div>
          ) : (
            
            /* VIEW C: EMPTY SELECTION */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 text-zinc-500">
              <div className="w-16 h-16 rounded-2xl bg-amber-400 text-black border-2 border-black flex items-center justify-center shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                <MessageSquare className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bebas font-bold text-2xl text-black uppercase tracking-wide">
                  Nenhum Chamado Selecionado
                </h3>
                <p className="text-xs text-zinc-600 max-w-sm font-medium leading-relaxed">
                  {mode === 'super_admin'
                    ? 'Escolha um chamado na lista ao lado para interagir e atender ao gestor em tempo real.'
                    : 'Selecione uma conversa da lista ao lado para visualizar as mensagens ou clique abaixo para tirar dúvidas com o BarberBot.'}
                </p>
              </div>
              {mode === 'manager' && (
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingNewTicket(true);
                    setSelectedTicketId(null);
                    setCurrentNodeId('root');
                    setChatbotTrace([]);
                    setMobileView('chat');
                  }}
                  className="px-6 py-3 bg-amber-400 hover:bg-amber-300 text-black font-bebas font-bold text-sm uppercase tracking-wide rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2 cursor-pointer transition-all active:translate-y-0.5"
                >
                  <Bot className="w-4 h-4" />
                  Abrir Novo Chamado com BarberBot
                </button>
              )}
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
