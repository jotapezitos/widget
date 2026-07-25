import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, onSnapshot, getDocs } from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile, UserRole, Barber } from '../types';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  setRole: (role: UserRole) => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  currentRole: UserRole;
  isSuperAdmin: boolean;
  isTenantOwner: boolean;
  isStaff: boolean;
  isClient: boolean;
  isSubscriptionFrozen: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubscriptionFrozen, setIsSubscriptionFrozen] = useState(false);

  useEffect(() => {
    let unsubscribeUserDoc: (() => void) | null = null;

    // Listen to tenant settings for subscription status (active vs frozen)
    const unsubscribeTenant = onSnapshot(doc(db, 'settings', 'tenant'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const frozen = data.status === 'frozen' || Boolean(data.isFrozen);
        setIsSubscriptionFrozen(frozen);
      }
    });

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await checkAndSyncBarberAssociation(currentUser);

        // Listen to user doc for real-time profile updates (like phone changes)
        if (unsubscribeUserDoc) unsubscribeUserDoc();
        unsubscribeUserDoc = onSnapshot(doc(db, 'users', currentUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            setUserProfile((prev) => (prev ? { ...prev, ...data } : (data as UserProfile)));
          }
        });
      } else {
        if (unsubscribeUserDoc) {
          unsubscribeUserDoc();
          unsubscribeUserDoc = null;
        }
        setUserProfile(null);
      }
      setLoading(false);
    });

    // Listen to barbers collection changes so association/disassociation is fully reactive in real-time
    const unsubscribeBarbers = onSnapshot(collection(db, 'barbers'), async (snap) => {
      const currentUser = auth.currentUser;
      if (currentUser) {
        const barbersList = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Barber, 'id'>) }));
        await checkAndSyncBarberAssociation(currentUser, barbersList);
      }
    });

    return () => {
      unsubscribeTenant();
      unsubscribeAuth();
      unsubscribeBarbers();
      if (unsubscribeUserDoc) unsubscribeUserDoc();
    };
  }, []);

  const checkAndSyncBarberAssociation = async (firebaseUser: User, existingBarbersList?: Barber[]) => {
    const userRef = doc(db, 'users', firebaseUser.uid);
    try {
      let barbersList = existingBarbersList;
      if (!barbersList) {
        const barbersSnap = await getDocs(collection(db, 'barbers'));
        barbersList = barbersSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Barber, 'id'>) }));
      }

      const userEmail = (firebaseUser.email || '').trim().toLowerCase();
      let matchedBarber: Barber | null = null;
      barbersList.forEach((b) => {
        if (b.googleEmail && b.googleEmail.trim().toLowerCase() === userEmail) {
          matchedBarber = b;
        }
      });

      let managerEmails: string[] = [];
      try {
        const tenantSnap = await getDoc(doc(db, 'settings', 'tenant'));
        if (tenantSnap.exists()) {
          const tData = tenantSnap.data();
          if (Array.isArray(tData.managerEmails)) {
            managerEmails = tData.managerEmails.map((e: string) => e.trim().toLowerCase());
          }
        }
      } catch (e) {
        // ignore
      }

      const snap = await getDoc(userRef);
      let existingProfile: UserProfile | null = snap.exists() ? (snap.data() as UserProfile) : null;

      let role: UserRole = existingProfile ? existingProfile.role : 'client';
      let name = existingProfile ? existingProfile.name : (firebaseUser.displayName || 'Usuário');
      let photoUrl = (existingProfile as any)?.photoUrl || firebaseUser.photoURL || '';
      let barberId = (existingProfile as any)?.barberId;
      let phone = existingProfile?.phone || '';

      if (matchedBarber) {
        barberId = (matchedBarber as any).id;
        name = (matchedBarber as any).name;
        photoUrl = (matchedBarber as any).photoUrl || '';
      }

      const isSuperAdminEmail = userEmail === 'jeanmarceloop@gmail.com';
      const isManagerEmail = managerEmails.includes(userEmail);
      const isBarberOwner = matchedBarber ? (matchedBarber as any).isOwner : false;

      if (isSuperAdminEmail) {
        role = 'super_admin';
      } else if (isManagerEmail || isBarberOwner || existingProfile?.role === 'tenant_owner') {
        role = 'tenant_owner';
      } else if (matchedBarber) {
        role = 'staff';
      } else if (!existingProfile) {
        role = 'client';
        name = firebaseUser.displayName || 'Usuário';
        photoUrl = firebaseUser.photoURL || '';
      } else if (role === 'super_admin') {
        role = 'client';
      }

      const updatedProfile: UserProfile = {
        uid: firebaseUser.uid,
        name,
        email: firebaseUser.email || '',
        role,
        createdAt: existingProfile?.createdAt || new Date().toISOString(),
        ...(barberId ? { barberId } : {}),
        ...(phone ? { phone } : {}),
        photoUrl,
      } as any;

      await setDoc(userRef, updatedProfile, { merge: true });
      setUserProfile(updatedProfile);
    } catch (error) {
      console.error('Error in barber association / user profile sync:', error);
      setUserProfile({
        uid: firebaseUser.uid,
        name: firebaseUser.displayName || 'Usuário',
        email: firebaseUser.email || '',
        role: 'client',
      });
    }
  };

  const signInWithGoogle = async () => {
    alert('Novos logins estão desativados no momento. O sistema está operando em modo de demonstração visual.');
  };

  const logout = async () => {
    try {
      await firebaseSignOut(auth);
      setUserProfile(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const setRole = async (newRole: UserRole) => {
    if (userProfile) {
      setUserProfile((prev) => (prev ? { ...prev, role: newRole } : null));
    }
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      try {
        await updateDoc(userRef, { role: newRole });
      } catch (error) {
        // Silently fail if offline/rules
      }
    }
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (userProfile) {
      setUserProfile((prev) => (prev ? { ...prev, ...data } : null));
    }
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      try {
        await updateDoc(userRef, data);
      } catch (error) {
        try {
          await setDoc(userRef, { ...userProfile, ...data }, { merge: true });
        } catch (err) {
          console.error('Error saving profile data:', err);
        }
      }
    }
  };

  const emailMatch = (userProfile?.email || user?.email || '').trim().toLowerCase() === 'jeanmarceloop@gmail.com';
  const currentRole: UserRole = emailMatch ? 'super_admin' : (userProfile?.role || 'client');
  const isSuperAdmin = emailMatch || currentRole === 'super_admin';
  const isTenantOwner = currentRole === 'tenant_owner';
  const isStaff = currentRole === 'staff' || Boolean(userProfile?.barberId);
  const isClient = currentRole === 'client';

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        signInWithGoogle,
        logout,
        setRole,
        updateProfile,
        currentRole,
        isSuperAdmin,
        isTenantOwner,
        isStaff,
        isClient,
        isSubscriptionFrozen,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
