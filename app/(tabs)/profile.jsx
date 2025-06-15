import React, { useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import axios from 'axios';
import Icon from 'react-native-vector-icons/Feather';
import { useAuth } from '../context/AuthContext';
import AuthStorage from '../utils/authStorage';
import CustomHeader from '../../components/CustomHeader';

export default function Profile() {
  const { userToken } = useAuth();
  const [userData, setUserData] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState('personal');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = userToken || await AuthStorage.getToken();
        if (!token) return;

        const decoded = jwtDecode(token);
        const relatedId = decoded?.relatedId;
        if (!relatedId) throw new Error('relatedId manquant dans le token');

        const res = await axios.get(`http://192.168.120.168:3000/api/livreurs/profile/${relatedId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        setUserData(res.data);
      } catch (err) {
        console.error('Erreur lors de la récupération du profil:', err);
        Alert.alert('Erreur', 'Impossible de charger le profil.');
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [userToken]);

  const handleChange = (field, value) => {
    setUserData((prevData) => ({ ...prevData, [field]: value }));
  };

  const handleSubmit = async () => {
    try {
      const token = userToken || await AuthStorage.getToken();
      if (!token) return;

      const decoded = jwtDecode(token);
      const relatedId = decoded?.relatedId;
      if (!relatedId) throw new Error('relatedId manquant');

      if (newPassword || confirmPassword) {
        if (newPassword !== confirmPassword) {
          return Alert.alert('Erreur', 'Les mots de passe ne correspondent pas.');
        }
      }

      const updatedData = { ...userData };

      if (newPassword) {
        updatedData.pwd = newPassword;
      }

      if (updatedData.prime) updatedData.prime = Number(updatedData.prime);
      if (updatedData.prestation) updatedData.prestation = Number(updatedData.prestation);
      if (updatedData.salaire) updatedData.salaire = Number(updatedData.salaire);

      if (updatedData.id) delete updatedData.id;
      console.log('Données envoyées au serveur:', updatedData);
      await axios.put(`http://192.168.120.168:3000/api/livreurs/update/${relatedId}`, updatedData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      Alert.alert('Succès', 'Informations mises à jour !');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Erreur mise à jour:', error);
      if (error.response) {
        Alert.alert('Erreur', `La mise à jour a échoué: ${JSON.stringify(error.response.data)}`);
      } else {
        Alert.alert('Erreur', 'La mise à jour a échoué.');
      }
    }
  };

  const toggleTab = (tab) => setActiveTab(tab);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#282C64" />
      </View>
    );
  }

  if (!userData) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Impossible de charger les données.</Text>
      </View>
    );
  }
  
  return (
    <View style={{ flex: 1 }}>
      <CustomHeader />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.pageTitle}>Mon Profil</Text>

          {/* Tabs */}
          <View style={styles.tabs}>
            <TouchableOpacity
              onPress={() => toggleTab('personal')}
              style={[styles.tab, activeTab === 'personal' && styles.activeTab]}
            >
              <View style={styles.tabContent}>
                <Icon name="user" size={18} color="#555" style={styles.icon} />
                <Text style={styles.tabText}>Informations personnelles</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => toggleTab('connection')}
              style={[styles.tab, activeTab === 'connection' && styles.activeTab]}
            >
              <View style={styles.tabContent}>
                <Icon name="settings" size={18} color="#555" style={styles.icon} />
                <Text style={styles.tabText}>Paramètres de connexion</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Info Perso */}
          {activeTab === 'personal' && (
            <View style={styles.section}>
              {[{ key: 'nom', label: 'Nom' }, { key: 'tel', label: 'Téléphone' }, { key: 'tel2', label: 'Téléphone secondaire' }, { key: 'cin', label: 'CIN' }, { key: 'email', label: 'Email' }].map(({ key, label }) => (
                <View style={styles.input} key={key}>
                  <Text style={styles.inputLabel}>{label} :</Text>
                  <TextInput
                    value={userData[key] || ''}
                    onChangeText={(text) => handleChange(key, text)}
                    style={styles.inputControl}
                  />
                </View>
              ))}
            </View>
          )}

          {/* Connexion */}
          {activeTab === 'connection' && (
            <View style={styles.section}>
              <View style={styles.input}>
                <Text style={styles.inputLabel}>Login :</Text>
                <TextInput
                  value={userData.login || ''}
                  onChangeText={(text) => handleChange('login', text)}
                  style={styles.inputControl}
                />
              </View>

              {/* Nouveau mot de passe */}
              <View style={styles.input}>
                <Text style={styles.inputLabel}>Nouveau mot de passe :</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showPassword}
                    style={styles.inputWithIcon}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.iconAbsolute}>
                    <Icon
                      name={showPassword ? 'eye-off' : 'eye'}
                      size={20}
                      color="#282C64"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Confirmer mot de passe */}
              <View style={styles.input}>
                <Text style={styles.inputLabel}>Confirmer le mot de passe :</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showPassword}
                    style={styles.inputWithIcon}
                  />
                </View>
              </View>
            </View>
          )}

          {/* Enregistrer */}
          <View style={styles.formAction}>
            <TouchableOpacity onPress={handleSubmit}>
              <View style={styles.btn}>
                <Text style={styles.btnText}>Enregistrer les modifications</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    padding: 24,
    flexGrow: 1,
    marginTop: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#282C64',
    marginBottom: 20,
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
  tabs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  tab: {
    paddingVertical: 12,
    flex: 1,
    alignItems: 'center',
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabText: {
    fontSize: 16,
    color: '#282C64',
    marginLeft: 8,
  },
  icon: {
    marginRight: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderColor: '#fec832',
  },
  section: {
    marginBottom: 20,
  },
  input: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '400',
    color: '#282C64',
    marginBottom: 4,
  },
  inputControl: {
    height: 44,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    borderRadius: 12,
    fontSize: 15,
    fontWeight: '500',
    color: '#282C64',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  inputWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  inputWithIcon: {
    height: 44,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingRight: 40,
    borderRadius: 12,
    fontSize: 15,
    fontWeight: '500',
    color: '#282C64',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  iconAbsolute: {
    position: 'absolute',
    right: 12,
    top: 12,
  },
  formAction: {
    marginTop: 10,
  },
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingVertical: 12,
    backgroundColor: '#272E64',
  },
  btnText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#fff',
  },
});
