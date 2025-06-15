import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { gql, useMutation, useApolloClient } from '@apollo/client';
import { router } from 'expo-router';
import { useAuth } from './context/AuthContext';
import LOAD_ME_QUERY from './api/queries/loadMe';

const INPUT_OFFSET = 130;

// Mutation login
const LOGIN_MUTATION = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      access_token
    }
  }
`;

const LoginScreen = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loginMutation, { loading }] = useMutation(LOGIN_MUTATION, {
    context: { serviceName: 'user-service' }
  });
  const { login } = useAuth();
  const apolloClient = useApolloClient();
const handleLogin = async () => {
  if (!form.email || !form.password) {
    Alert.alert('Erreur', 'Veuillez remplir tous les champs.');
    return;
  }

  try {
    // 1. Perform login mutation
    const loginRes = await loginMutation({
      variables: {
        email: form.email,
        password: form.password,
      },
    });

    const token = loginRes?.data?.login?.access_token;
    if (!token) {
      throw new Error('Token non reçu');
    }

    // 2. Clear Apollo cache
    await apolloClient.clearStore();

    // 3. Fetch user data with token as variable
    const { data, error } = await apolloClient.query({
      query: LOAD_ME_QUERY,
      variables: {
        token: token
      },
      context: {
        serviceName: 'user-service',
        headers: {
          Authorization: `Bearer ${token}`
        }
      },
      fetchPolicy: 'network-only'
    });

    console.log('User data response:', JSON.stringify(data, null, 2));

    if (error || !data?.loadMe) {
      throw new Error(error?.message || 'Données utilisateur non disponibles');
    }

    const user = data.loadMe;

    // 4. Verify driver role
    if (user.role !== 'DRIVER') {
      Alert.alert('Accès refusé', 'Réservé aux chauffeurs');
      return;
    }

    // 5. Complete login process
    await login(user, token);
    router.replace('/runsheet');

  } catch (error) {
    console.error('Login error details:', error);
    Alert.alert(
      'Erreur',
      error.message || 'Échec de la connexion. Veuillez réessayer.'
    );
  }
};
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View>
          {/* Titre */}
          <View style={styles.headerTitle}>
            <Text style={styles.title}>Fast Delivery</Text>
            <Text style={styles.subtitle}>Chauffeurs</Text>
          </View>

          {/* Champ Email */}
          <View style={styles.input}>
            <Text style={styles.inputLabel}>Email:</Text>
            <TextInput
              autoCorrect={false}
              keyboardType="email-address"
              clearButtonMode="while-editing"
              onChangeText={(text) => setForm({ ...form, email: text })}
              style={styles.inputControl}
              value={form.email}
              placeholder="Entrez votre email"
              placeholderTextColor="#aaa"
            />
          </View>

          {/* Champ Password */}
          <View style={styles.input}>
            <Text style={styles.inputLabel}>Mot de passe:</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                autoCorrect={false}
                onChangeText={(text) => setForm({ ...form, password: text })}
                style={[styles.inputControl, styles.passwordInput]}
                secureTextEntry={!showPassword}
                value={form.password}
                placeholder="Entrez votre mot de passe"
                placeholderTextColor="#aaa"
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={20}
                  color="#272E64"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Bouton Login */}
          <View style={styles.formAction}>
            <TouchableOpacity onPress={handleLogin} disabled={loading}>
              <View style={[styles.btn, loading && styles.btnDisabled]}>
                <Text style={styles.btnText}>
                  {loading ? 'Connexion...' : 'Se connecter'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FB8C00',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    alignSelf: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#272E64',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#FB8C00',
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '600',
  },
  input: {
    marginBottom: 16,
  },
  inputLabel: {
    position: 'absolute',
    width: INPUT_OFFSET,
    lineHeight: 44,
    top: 0,
    left: 0,
    marginHorizontal: 12,
    fontSize: 14,
    fontWeight: '400',
    color: '#272E64',
    zIndex: 9,
  },
  inputControl: {
    height: 44,
    backgroundColor: '#fff',
    paddingLeft: INPUT_OFFSET,
    paddingRight: 24,
    borderRadius: 12,
    fontSize: 15,
    fontWeight: '500',
    color: '#222',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 50,
  },
  eyeIcon: {
    position: 'absolute',
    right: 15,
    top: 12,
  },
  formAction: {
    marginTop: 20,
  },
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingVertical: 10,
    backgroundColor: '#272E64',
  },
  btnDisabled: {
    backgroundColor: '#666',
  },
  btnText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#fff',
  },
});