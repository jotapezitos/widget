import React, { createContext, useContext, useState } from 'react';
import { UserProfile, UserRole } from '../types';

interface AuthContextType {
  user: { uid: string; email: string; displayName: string } | null;
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

const INITIAL_DEMO_USER: UserProfile = {
  uid: 'demo-user-123',
  name: 'Cliente Demo',
  email: 'cliente@kauanbarber.com',
  role: 'client',
  createdAt: new Date().toISOString(),
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(INITIAL_DEMO_USER);
  const [loading] = useState(false);
  const [isSubscriptionFrozen] = useState(false);

  const mockUser = userProfile ? {
    uid: userProfile.uid,
    email: userProfile.email,
    displayName: userProfile.name,
  } : null;

  const signInWithGoogle = async () => {
    setUserProfile(INITIAL_DEMO_USER);
  };

  const logout = async () => {
    setUserProfile(null);
  };

  const setRole = async (newRole: UserRole) => {
    if (userProfile) {
      setUserProfile((prev) => (prev ? { ...prev, role: newRole } : null));
    }
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (userProfile) {
      setUserProfile((prev) => (prev ? { ...prev, ...data } : null));
    }
  };

  const currentRole: UserRole = userProfile?.role || 'client';
  const isSuperAdmin = currentRole === 'super_admin';
  const isTenantOwner = currentRole === 'tenant_owner';
  const isStaff = currentRole === 'staff' || Boolean(userProfile?.barberId);
  const isClient = currentRole === 'client';

  return (
    <AuthContext.Provider
      value={{
        user: mockUser,
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
