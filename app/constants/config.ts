// Configuration de l'application mobile
export const TRACKING_CONFIG = {
  // URLs des microservices
  TRACKING_SERVICE_URL: "http://192.168.1.102:3001",
  USER_SERVICE_URL: "http://192.168.1.102:4000", 

  // Configuration du tracking GPS
  LOCATION_UPDATE_INTERVAL: 5000, // 5 secondes
  LOCATION_DISTANCE_FILTER: 10, // 10 mètres

  // Configuration WebSocket
  WEBSOCKET_TIMEOUT: 20000,
  WEBSOCKET_RECONNECT_ATTEMPTS: 5,
  WEBSOCKET_RECONNECT_DELAY: 2000,
}

// Fonction pour obtenir l'IP locale automatiquement (optionnel)
const __DEV__ = process.env.NODE_ENV === "development" // Declare the __DEV__ variable
export const getTrackingURL = () => {
  // En développement, vous pouvez utiliser votre IP locale
  // En production, utilisez l'URL de votre serveur
  return __DEV__ ?  TRACKING_CONFIG.TRACKING_SERVICE_URL : "http://192.168.1.102:3001"
}
