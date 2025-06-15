import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'; // ajout de StyleSheet
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../app/context/AuthContext'; // contexte Auth

const CustomHeader = () => {
  const { logout, user } = useAuth(); // récupérer logout et user

  const handleLogout = async () => {
    await logout(); // Appeler la fonction logout
    router.replace('/login'); // Naviguer vers la page login
  };

  return (
    <View style={styles.header}>
      <Text style={styles.greeting}>Bonjour {user?.login ? user.login : ''}</Text>

      <View style={styles.iconsContainer}>
        <TouchableOpacity style={styles.iconButton}>
          <Ionicons name="notifications-outline" size={24} color="white" />
        </TouchableOpacity>

        {/* ici on utilise handleLogout, pas logout directement */}
        <TouchableOpacity style={styles.iconButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#272E64',
    padding: 15,
    paddingTop: 20,
    marginTop: 60
  },
  greeting: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  iconsContainer: {
    flexDirection: 'row',
    gap: 20,
  },
  iconButton: {
    padding: 3,
  },
});

export default CustomHeader;
