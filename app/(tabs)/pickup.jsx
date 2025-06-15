import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import React, { useState, useEffect } from 'react';
import CustomHeader from '../../components/CustomHeader';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Linking } from 'react-native';

const pickUpPoints = [
  { id: 1, barcode: '1234567890', supplier: 'Fournisseur A', address: '123 Rue Principale, Casablanca', phone: '+212 600 123 456', status: 'pending' },
  { id: 2, barcode: '0987654321', supplier: 'Fournisseur B', address: '45 Avenue Hassan II, Casablanca', phone: '+212 600 987 654', status: 'pending' },
  { id: 3, barcode: '1122334455', supplier: 'Fournisseur C', address: '10 Boulevard Al Qods, Rabat', phone: '+212 600 555 444', status: 'pending' },
  { id: 4, barcode: '4455667788', supplier: 'Fournisseur D', address: 'Rue Atlas, Rabat', phone: '+212 600 888 777', status: 'pending' },
  { id: 5, barcode: '5566778899', supplier: 'Fournisseur E', address: 'Avenue Zerktouni, Casablanca', phone: '+212 600 999 888', status: 'pending' },
];

const PickUp = () => {
  const [pickups, setPickups] = useState(pickUpPoints);
  const [filteredPickups, setFilteredPickups] = useState(pickUpPoints);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [showNotFound, setShowNotFound] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (permission?.status !== 'granted') {
      requestPermission();
    }
  }, [permission]);

  const handlePickupComplete = (id) => {
    setPickups(prev => prev.map(pickup => 
      pickup.id === id ? { ...pickup, status: 'completed' } : pickup
    ));
    setFilteredPickups(prev => prev.map(pickup => 
      pickup.id === id ? { ...pickup, status: 'completed' } : pickup
    ));
  };

  const handleBarCodeScanned = ({ data }) => {
    setScannedBarcode(data);
    const filtered = pickUpPoints.filter(pickup => pickup.barcode === data);
    setFilteredPickups(filtered.length > 0 ? filtered : []);
    setShowNotFound(filtered.length === 0);
    setScanning(false);
  };

  const resetScan = () => {
    setScannedBarcode('');
    setFilteredPickups(pickups);
    setShowNotFound(false);
  };

  const openMaps = (address) => {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}&travelmode=driving`;
    Linking.openURL(url).catch(err => alert("Impossible d'ouvrir Google Maps"));
  };

  const getStatusStyle = (status) => {
    return status === 'completed' 
      ? { borderLeftColor: '#4CAF50' } 
      : { borderLeftColor: '#272E64' };
  };

  return (
    <View style={styles.container}>
      <CustomHeader />
      
      <View style={styles.headerContainer}>
        <Text style={styles.title}>Points de Ramassage</Text>
      </View>

      <View style={styles.searchCard}>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Scanner le code-barres"
            value={scannedBarcode}
            onFocus={() => setScanning(true)}
            editable={false}
          />
          <TouchableOpacity onPress={() => setScanning(true)} style={styles.scanButton}>
            <Ionicons name="camera" size={24} color="#272E64" />
          </TouchableOpacity>
          {scannedBarcode !== '' && (
            <TouchableOpacity onPress={resetScan} style={styles.iconButton}>
              <Ionicons name="close-circle" size={24} color="gray" />
            </TouchableOpacity>
          )}
        </View>

        {scanning && permission?.status === 'granted' && (
          <View style={styles.scannerContainer}>
            <CameraView
              style={styles.scanner}
              onBarcodeScanned={handleBarCodeScanned}
              barcodeScannerSettings={{
                barcodeTypes: ['code128', 'ean13', 'ean8', 'qr', 'upc_a', 'upc_e'],
              }}
            />
            <TouchableOpacity style={styles.closeButton} onPress={() => setScanning(false)}>
              <Ionicons name="close-circle" size={30} color="red" />
            </TouchableOpacity>
          </View>
        )}

        {showNotFound && (
          <Text style={styles.notFoundText}>Code à barres introuvable. Veuillez réessayer.</Text>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {filteredPickups.length > 0 ? filteredPickups.map(point => {
          const statusStyle = getStatusStyle(point.status);
          
          return (
            <View 
              key={point.id} 
              style={[
                styles.orderCard,
                { borderLeftWidth: 4 },
                statusStyle
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={styles.orderInfo}>
                  <Ionicons name="barcode" size={20} color="#272E64" />
                  <Text style={styles.orderId}>#{point.barcode}</Text>
                </View>
                
                {point.status === 'completed' && (
                  <View style={styles.statusBadge}>
                    <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
                    <Text style={[styles.statusText, { color: '#4CAF50' }]}>RAMASSÉ</Text>
                  </View>
                )}
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="person" size={18} color="#272E64" />
                <Text style={styles.infoText}>{point.supplier}</Text>
              </View>

              <TouchableOpacity 
                style={styles.infoRow}
                onPress={() => openMaps(point.address)}
              >
                <Ionicons name="location" size={18} color="#272E64" />
                <Text style={styles.infoText}>{point.address}</Text>
                <MaterialIcons name="directions" size={20} color="#272E64" style={styles.directionsIcon} />
              </TouchableOpacity>

              <View style={styles.infoRow}>
                <Ionicons name="call" size={18} color="#272E64" />
                <Text style={styles.infoText}>{point.phone}</Text>
              </View>

              <View style={styles.actionsContainer}>
                {point.status === 'pending' ? (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.deliverButton]}
                    onPress={() => handlePickupComplete(point.id)}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.actionButtonText}>Confirmer ramassage</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.completedBadge}>
                    <Ionicons name="checkmark-done" size={20} color="#4CAF50" />
                    <Text style={[styles.actionButtonText, { color: '#4CAF50' }]}>Ramassage confirmé</Text>
                  </View>
                )}
              </View>
            </View>
          );
        }) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text" size={50} color="#ccc" />
            <Text style={styles.noOrdersText}>Aucun point de ramassage trouvé</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  headerContainer: {
    padding: 16,
    paddingBottom: 8,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#272E64',
  },
  searchCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    margin: 16,
    marginTop: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderColor: '#eee',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  scanButton: {
    marginLeft: 8,
    padding: 8,
  },
  iconButton: {
    marginLeft: 8,
    padding: 8,
  },
  scannerContainer: {
    marginTop: 16,
    height: 250,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  scanner: {
    width: '100%',
    height: '100%',
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 2,
  },
  notFoundText: {
    marginTop: 10,
    color: 'red',
    fontWeight: '500',
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderId: {
    fontSize: 16,
    fontWeight: '600',
    color: '#272E64',
    marginLeft: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoText: {
    marginLeft: 10,
    fontSize: 15,
    color: '#272E64',
    flex: 1,
  },
  directionsIcon: {
    marginLeft: 'auto',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  deliverButton: {
    backgroundColor: '#272E64',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  actionButtonText: {
    fontWeight: '600',
    marginLeft: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noOrdersText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
  },
});

export default PickUp;