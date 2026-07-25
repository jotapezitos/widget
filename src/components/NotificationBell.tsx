import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  CheckCircle2,
  XCircle,
  Calendar,
  Clock,
  Star,
  RefreshCw,
  Scissors,
  Check,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { AppNotification, Appointment } from '../types';
import { approveRescheduleRequest, rejectRescheduleRequest } from '../lib/notifications';

interface NotificationBellProps {
  onOpenBookingModal?: () => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ onOpenBookingModal }) => {
  const { user, userProfile, isStaff, isTenantOwner, isSuperAdmin } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    const unsub = onSnapshot(
      collection(db, 'notifications'),
      (snapshot) => {
        const list: AppNotification[] = [];
        snapshot.docs.forEach((docSnap) => {
          const data = { id: docSnap.id, ...docSnap.data() } as AppNotification;

          // 1. Direct user notification (e.g. reminders, reschedule_approved, reschedule_rejected, retention)
          const isDirectUserNotif = Boolean(data.userId && data.userId === user.uid);

          // 2. New booking notification (for barbers only, NOT managers/clients)
          const isBookingForThisBarber =
            data.type === 'booking' &&
            Boolean(userProfile?.barberId && data.barberId === userProfile.barberId);

          // 3. Reschedule request notification (for assigned barber or manager/owner, BUT NOT the client who made it)
          const isRescheduleRequestForStaff =
            data.type === 'reschedule_request' &&
            data.clientId !== user.uid && // Exclude client who requested it
            (
              Boolean(userProfile?.barberId && data.barberId === userProfile.barberId) ||
              isTenantOwner ||
              isSuperAdmin ||
              isStaff
            );

          if (isDirectUserNotif || isBookingForThisBarber || isRescheduleRequestForStaff) {
            list.push(data);
          }
        });

        // Sort by createdAt desc
        list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setNotifications(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'notifications');
      }
    );

    return () => unsub();
  }, [user, userProfile, isStaff, isTenantOwner, isSuperAdmin]);

  // Click outside listener to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllAsRead = async () => {
    const unreadList = notifications.filter((n) => !n.read);
    for (const notif of unreadList) {
      try {
        await updateDoc(doc(db, 'notifications', notif.id), { read: true });
      } catch (err) {
        console.error('Error marking as read:', err);
      }
    }
  };

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  };

  const handleDeleteNotif = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const handleApproveRescheduleNotif = async (notif: AppNotification) => {
    if (!notif.appointmentId) return;
    setActionLoading(notif.id);
    try {
      const aptSnap = await getDoc(doc(db, 'appointments', notif.appointmentId));
      if (aptSnap.exists()) {
        const apt = { id: aptSnap.id, ...aptSnap.data() } as Appointment;
        await approveRescheduleRequest(apt, notif.id);
      } else {
        await handleMarkAsRead(notif.id);
      }
    } catch (err) {
      console.error('Error approving reschedule from notification:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectRescheduleNotif = async (notif: AppNotification) => {
    if (!notif.appointmentId) return;
    setActionLoading(notif.id);
    try {
      const aptSnap = await getDoc(doc(db, 'appointments', notif.appointmentId));
      if (aptSnap.exists()) {
        const apt = { id: aptSnap.id, ...aptSnap.data() } as Appointment;
        await rejectRescheduleRequest(apt, notif.id);
      } else {
        await handleMarkAsRead(notif.id);
      }
    } catch (err) {
      console.error('Error rejecting reschedule from notification:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const formatTimeAgo = (isoDate: string) => {
    if (!isoDate) return '';
    const date = new Date(isoDate);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    if (diffMin < 1) return 'agora';
    if (diffMin < 60) return `há ${diffMin} min`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `há ${diffHours} h`;
    return date.toLocaleDateString('pt-BR');
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full bg-white hover:bg-zinc-100 text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all active:translate-y-0.5 cursor-pointer flex items-center justify-center"
        title="Central de Notificações"
      >
        <Bell className="w-4 h-4 text-black" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white font-bebas font-extrabold text-[11px] px-1.5 py-0.2 rounded-full border border-black animate-pulse shadow-sm">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Mobile Overlay Backdrop */}
          <div
            className="fixed inset-0 bg-black/30 z-40 sm:hidden backdrop-blur-[1px]"
            onClick={() => setIsOpen(false)}
          />

          <div className="fixed inset-x-2 top-16 z-50 w-auto max-w-[calc(100vw-16px)] mx-auto sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 bg-white border-2 border-black rounded-2xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] overflow-hidden text-zinc-900 font-sans">
          {/* Header */}
          <div className="p-3.5 bg-zinc-900 text-amber-400 flex items-center justify-between border-b-2 border-black">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-400" />
              <span className="font-bebas font-bold text-lg uppercase tracking-wider text-white">
                Notificações
              </span>
              {unreadCount > 0 && (
                <span className="bg-amber-400 text-black text-[10px] font-black px-2 py-0.5 rounded-full font-bebas">
                  {unreadCount} novas
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-[11px] font-bold text-amber-300 hover:text-white underline cursor-pointer"
              >
                Lidas todas
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-zinc-200">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 text-xs font-medium space-y-2">
                <Bell className="w-8 h-8 text-zinc-300 mx-auto" />
                <p>Nenhuma notificação por enquanto.</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const isUnread = !notif.read;

                return (
                  <div
                    key={notif.id}
                    onClick={() => handleMarkAsRead(notif.id)}
                    className={`p-3.5 transition-colors cursor-pointer hover:bg-zinc-50 ${
                      isUnread ? 'bg-amber-50/60 font-semibold' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5">
                        {notif.type === 'reschedule_request' && (
                          <RefreshCw className="w-4 h-4 text-amber-600 shrink-0" />
                        )}
                        {notif.type === 'reschedule_approved' && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        )}
                        {notif.type === 'reschedule_rejected' && (
                          <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        )}
                        {notif.type === 'booking' && (
                          <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                        )}
                        {notif.type === 'review_prompt' && (
                          <Star className="w-4 h-4 text-amber-500 fill-amber-400 shrink-0" />
                        )}
                        {notif.type === 'retention' && (
                          <Scissors className="w-4 h-4 text-amber-600 shrink-0" />
                        )}
                        {notif.type === 'reminder' && (
                          <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                        )}

                        <span className="text-xs font-bold text-black font-bebas uppercase text-sm tracking-wide">
                          {notif.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 text-[10px] text-zinc-500">
                        <span>{formatTimeAgo(notif.createdAt)}</span>
                        <button
                          onClick={(e) => handleDeleteNotif(notif.id, e)}
                          title="Excluir notificação"
                          className="p-1 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-zinc-700 leading-snug font-normal mb-2">
                      {notif.message}
                    </p>

                    {/* ACTION BUTTONS / STATUS BADGE FOR RESCHEDULE REQUEST */}
                    {notif.type === 'reschedule_request' &&
                      (isStaff || isTenantOwner || isSuperAdmin) && (
                        <>
                          {(!notif.status || notif.status === 'pending') ? (
                            <div className="flex items-center gap-2 pt-2 border-t border-amber-200/60 mt-1">
                              <button
                                disabled={actionLoading === notif.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleApproveRescheduleNotif(notif);
                                }}
                                className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-black font-bebas font-bold text-xs border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-1 cursor-pointer transition-all disabled:opacity-50"
                              >
                                <Check className="w-3.5 h-3.5" /> Aprovar
                              </button>
                              <button
                                disabled={actionLoading === notif.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRejectRescheduleNotif(notif);
                                }}
                                className="flex-1 py-1.5 px-3 rounded-lg bg-rose-200 hover:bg-rose-300 text-rose-900 font-bebas font-bold text-xs border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-1 cursor-pointer transition-all disabled:opacity-50"
                              >
                                <XCircle className="w-3.5 h-3.5 text-rose-700" /> Recusar
                              </button>
                            </div>
                          ) : notif.status === 'approved' ? (
                            <div className="mt-2 pt-1 border-t border-emerald-200 flex items-center gap-1.5 text-xs text-emerald-800 font-bold font-bebas tracking-wide">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              <span>✓ Remarcação Aprovada</span>
                            </div>
                          ) : (
                            <div className="mt-2 pt-1 border-t border-rose-200 flex items-center gap-1.5 text-xs text-rose-800 font-bold font-bebas tracking-wide">
                              <XCircle className="w-4 h-4 text-rose-600" />
                              <span>✕ Remarcação Recusada</span>
                            </div>
                          )}
                        </>
                      )}

                    {/* REVIEW PROMPT CTA */}
                    {notif.type === 'review_prompt' && (
                      <div className="pt-1.5 flex items-center gap-2">
                        <a
                          href="https://g.page/r/review"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-black bg-amber-400 hover:bg-amber-300 px-2.5 py-1 rounded-md border border-black font-bebas uppercase"
                        >
                          Avaliar no Google <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}

                    {/* RETENTION CTA */}
                    {notif.type === 'retention' && onOpenBookingModal && (
                      <div className="pt-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsOpen(false);
                            onOpenBookingModal();
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-black bg-amber-400 hover:bg-amber-300 px-2.5 py-1 rounded-md border border-black font-bebas uppercase cursor-pointer"
                        >
                          Agendar Horário <Scissors className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </>
      )}
    </div>
  );
};
