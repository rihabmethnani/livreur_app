// app/utils/authStorage.js
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthStorage = {
  storeToken: async (token) => {
    try {
      await AsyncStorage.setItem('@token', token);
    } catch (error) {
      console.error('Error storing token:', error);
      throw error;
    }
  },

  storeUser: async (user) => {
    try {
      await AsyncStorage.setItem('@user', JSON.stringify(user));
    } catch (error) {
      console.error('Error storing user:', error);
      throw error;
    }
  },

  getToken: async () => {
    try {
      return await AsyncStorage.getItem('@token');
    } catch (error) {
      console.error('Error getting token:', error);
      return null;
    }
  },

  getUser: async () => {
    try {
      const userData = await AsyncStorage.getItem('@user');
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  },

  clear: async () => {
    try {
      await AsyncStorage.multiRemove(['@token', '@user']);
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  }
};

export default AuthStorage;