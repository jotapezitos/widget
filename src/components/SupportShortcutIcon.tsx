import React, { useState, useEffect } from 'react';
import { Headphones, MessageSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

interface SupportShortcutIconProps {
  onOpenInbox: () => void;
  activeTab: string;
}

export const SupportShortcutIcon: React.FC<SupportShortcutIconProps> = ({
  onOpenInbox,
  activeTab,
}) => {
  const { user, isSuperAdmin, isTenantOwner } = useAuth();
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    let q;
    if (isSuperAdmin) {
      // Super admin listens to any unread ticket for admin
      q = query(
        collection(db, 'support_tickets'),
        where('unreadByAdmin', '==', true)
      );
    } else if (isTenantOwner) {
      const email = (user.email || '').toLowerCase();
      if (!email) return;
      q = query(
        collection(db, 'support_tickets'),
        where('managerEmail', '==', email),
        where('unreadByManager', '==', true)
      );
    } else {
      setUnreadCount(0);
      return;
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setUnreadCount(snapshot.size);
      },
      (err) => {
        console.error('Error fetching unread support tickets:', err);
      }
    );

    return () => unsubscribe();
  }, [user, isSuperAdmin, isTenantOwner]);

  // Only show for Super Admin or Tenant Owner (Manager)
  if (!user || (!isSuperAdmin && !isTenantOwner)) {
    return null;
  }

  return (
    <button
      onClick={onOpenInbox}
      className={`relative p-2 rounded-full border-2 border-black transition-all flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:scale-105 active:scale-95 cursor-pointer ${
        activeTab === 'dashboard'
          ? 'bg-amber-400 text-black ring-2 ring-amber-500'
          : 'bg-zinc-100 text-black hover:bg-amber-100'
      }`}
      title="Suporte & Inbox de Atendimento Lojista"
    >
      <Headphones className="w-4 h-4 text-black" />

      {/* Unread badge indicator */}
      {unreadCount > 0 && (
        <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white font-bebas font-bold text-[10px] min-w-[18px] h-[18px] px-1 rounded-full border border-black flex items-center justify-center animate-bounce shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
          {unreadCount}
        </span>
      )}
    </button>
  );
};
