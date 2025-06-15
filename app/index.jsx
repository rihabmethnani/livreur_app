import { useEffect } from 'react';
import { router } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from './context/AuthContext';

export default function Index() {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      try {
        // Navigation synchrone simple
        if (user) {
          router.replace('/(tabs)/runsheet');
        } else {
          router.replace('/login');
        }
      } catch (error) {
        console.error('Navigation error:', error);
        // Fallback en cas d'erreur
        router.replace('/login');
      }
    }
  }, [user, isLoading]);

  return (
    <View style={{ 
      flex: 1, 
      justifyContent: 'center', 
      alignItems: 'center', 
      backgroundColor: '#fec832' 
    }}>
      <ActivityIndicator size="large" color="#272E64" />
    </View>
  );
}