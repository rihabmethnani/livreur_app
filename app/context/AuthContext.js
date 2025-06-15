import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Vérifier si l'utilisateur est déjà connecté au démarrage
  const checkAuthState = async () => {
    try {
      const token = await AsyncStorage.getItem('@token');
      const userData = await AsyncStorage.getItem('@user');
      
      if (token && userData) {
        setUser(JSON.parse(userData));
      }
    } catch (error) {
      console.error('Error loading auth state:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuthState();
  }, []);

  const login = async (userData, token) => {
    try {
      await AsyncStorage.setItem('@token', token);
      await AsyncStorage.setItem('@user', JSON.stringify(userData));
      setUser(userData);
    } catch (error) {
      console.error('Error saving auth data:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('@token');
      await AsyncStorage.removeItem('@user');
      setUser(null);
    } catch (error) {
      console.error('Error removing auth data:', error);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      isLoading
    }}>
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
