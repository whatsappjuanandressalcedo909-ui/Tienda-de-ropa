import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../firebase';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword
} from 'firebase/auth';

export interface AdminUser {
  email: string;
  role: 'admin';
  name: string;
  loginAt: string;
}

interface AuthContextType {
  user: AdminUser | null;
  isAdmin: boolean;
  login: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        setUser({
          email: firebaseUser.email,
          role: 'admin',
          name: 'Gerencia General',
          loginAt: new Date().toISOString()
        });
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password?: string): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    
    if (!cleanEmail) {
      return { success: false, error: 'Por favor ingresa un correo electrónico.' };
    }

    if (!password || password.trim().length < 6) {
      return { success: false, error: 'La contraseña debe tener al menos 6 caracteres.' };
    }

    try {
      await signInWithEmailAndPassword(auth, cleanEmail, password);
      return { success: true };
    } catch (error: any) {
      // If user doesn't exist, create it automatically for this demo system
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        try {
          await createUserWithEmailAndPassword(auth, cleanEmail, password);
          return { success: true };
        } catch (createError: any) {
          return { success: false, error: 'Credenciales inválidas. Verifica tu correo y contraseña.' };
        }
      }
      return { success: false, error: 'Credenciales inválidas. Verifica tu correo y contraseña.' };
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAdmin: !!user, login, logout, isLoading }}>
      {!isLoading && children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
}
