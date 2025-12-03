import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Company } from '@/types';

interface AuthContextType {
  user: User | null;
  company: Company | null;
  isAuthenticated: boolean;
  login: (email: string) => Promise<boolean>;
  signup: (name: string, email: string, companyName: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DB_USERS_KEY = 'af_db_users';
const DB_COMPANIES_KEY = 'af_db_companies';
const SESSION_KEY = 'af_session';

const getStoredUsers = (): User[] => {
  const data = localStorage.getItem(DB_USERS_KEY);
  return data ? JSON.parse(data) : [];
};

const getStoredCompanies = (): Company[] => {
  const data = localStorage.getItem(DB_COMPANIES_KEY);
  return data ? JSON.parse(data) : [];
};

const saveUsers = (users: User[]) => {
  localStorage.setItem(DB_USERS_KEY, JSON.stringify(users));
};

const saveCompanies = (companies: Company[]) => {
  localStorage.setItem(DB_COMPANIES_KEY, JSON.stringify(companies));
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const session = localStorage.getItem(SESSION_KEY);
    if (session) {
      const { userId, companyId } = JSON.parse(session);
      const users = getStoredUsers();
      const companies = getStoredCompanies();
      const foundUser = users.find(u => u.id === userId);
      const foundCompany = companies.find(c => c.id === companyId);
      if (foundUser && foundCompany) {
        setUser(foundUser);
        setCompany(foundCompany);
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string): Promise<boolean> => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const users = getStoredUsers();
    const foundUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (foundUser) {
      const companies = getStoredCompanies();
      const foundCompany = companies.find(c => c.id === foundUser.companyId);
      if (foundCompany) {
        setUser(foundUser);
        setCompany(foundCompany);
        localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: foundUser.id, companyId: foundCompany.id }));
        setIsLoading(false);
        return true;
      }
    }
    
    setIsLoading(false);
    return false;
  };

  const signup = async (name: string, email: string, companyName: string): Promise<void> => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 800));

    const users = getStoredUsers();
    const companies = getStoredCompanies();

    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      setIsLoading(false);
      throw new Error('Email already exists');
    }

    const newCompanyId = `co_${Date.now()}`;
    const newUserId = `user_${Date.now()}`;

    const newCompany: Company = {
      id: newCompanyId,
      name: companyName,
      subscriptionStatus: 'trial'
    };

    const newUser: User = {
      id: newUserId,
      email,
      name,
      companyId: newCompanyId,
      role: 'admin'
    };

    saveCompanies([...companies, newCompany]);
    saveUsers([...users, newUser]);

    setUser(newUser);
    setCompany(newCompany);
    localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: newUser.id, companyId: newCompany.id }));
    setIsLoading(false);
  };

  const logout = () => {
    setUser(null);
    setCompany(null);
    localStorage.removeItem(SESSION_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, company, isAuthenticated: !!user, login, signup, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
