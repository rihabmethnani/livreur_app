import * as Location from "expo-location"
import { io, type Socket } from "socket.io-client"
import { Alert } from "react-native"
import { TRACKING_CONFIG } from "../constants/config"

export interface LocationData {
  driverId: string
  courseId?: string
  latitude: number
  longitude: number
  accuracy?: number
  speed?: number
  heading?: number
  status?: string
  timestamp?: number
}

export class LocationTrackingService {
  private socket: Socket | null = null
  private watchId: Location.LocationSubscription | null = null
  private isTracking = false
  private driverId: string | null = null
  private courseId: string | null = null
  private reconnectInterval: ReturnType<typeof setInterval> | null = null
  private lastSentLocation: LocationData | null = null
  private connectionAttempts = 0
  private readonly maxConnectionAttempts = TRACKING_CONFIG.WEBSOCKET_RECONNECT_ATTEMPTS

  constructor(private serverUrl = TRACKING_CONFIG.TRACKING_SERVICE_URL) {}

  private initializeSocket() {
    if (this.socket) {
      this.socket.disconnect()
    }

    console.log(`Initializing socket connection to ${this.serverUrl}/tracking`)

    this.socket = io(`${this.serverUrl}/tracking`, {
      transports: ["websocket", "polling"],
      timeout: TRACKING_CONFIG.WEBSOCKET_TIMEOUT,
      reconnection: true,
      reconnectionAttempts: this.maxConnectionAttempts,
      reconnectionDelay: TRACKING_CONFIG.WEBSOCKET_RECONNECT_DELAY,
      forceNew: true,
      query: {
        clientType: "driver",
        timestamp: Date.now(),
      },
    })

    this.setupSocketEventHandlers()
  }

  private setupSocketEventHandlers() {
    if (!this.socket) return

    this.socket.on("connect", () => {
      console.log("Connected to tracking service with ID:", this.socket?.id)
      this.connectionAttempts = 0

      // S'identifier immédiatement comme driver
      if (this.driverId) {
        console.log(`Identifying as driver: ${this.driverId}`)
        this.socket?.emit("driver:identify", { driverId: this.driverId })
      }

      // Envoyer la dernière position si disponible
      if (this.lastSentLocation) {
        console.log("Sending last known location after reconnection")
        this.socket?.emit("location:update", this.lastSentLocation)
      }
    })

    this.socket.on("disconnect", (reason) => {
      console.log("Disconnected from tracking service:", reason)
      if (reason === "io server disconnect") {
        // Le serveur a fermé la connexion, reconnecter
        this.socket?.connect()
      }
    })

    this.socket.on("connect_error", (error) => {
      console.error("Connection error:", error.message)
      this.connectionAttempts++

      if (this.connectionAttempts >= 3 && this.socket?.io) {
        console.log("Switching to polling transport")
        this.socket.io.opts.transports = ["polling", "websocket"]
      }
    })

    this.socket.on("driver:identified", (data) => {
      console.log("Driver identification confirmed:", data)
    })

    this.socket.on("location:confirmed", (data) => {
      console.log("Location update confirmed:", data)
    })

    this.socket.on("location:error", (error) => {
      console.error("Location error from server:", error)
    })

    this.socket.on("connection:confirmed", (data) => {
      console.log("Connection confirmed by server:", data)
    })

    // Dans setupSocketEventHandlers, ajouter cet événement
    this.socket.on("location:request_current", async () => {
      console.log("Admin requested current location, sending fresh position...")
      try {
        const currentPosition = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        })
        this.sendLocationUpdate(currentPosition)
      } catch (error) {
        console.error("Error getting current position on request:", error)
      }
    })
  }

  async startTracking(driverId: string, courseId?: string): Promise<boolean> {
    try {
      console.log(`Starting tracking for driver ${driverId}`)

      // Vérifier les permissions de localisation
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== "granted") {
        Alert.alert("Permission refusée", "La localisation est requise pour le suivi")
        return false
      }

      const backgroundStatus = await Location.requestBackgroundPermissionsAsync()
      if (backgroundStatus.status !== "granted") {
        console.warn("Background location permission not granted")
        Alert.alert(
          "Permission limitée",
          "La localisation en arrière-plan n'est pas activée. Le suivi peut être interrompu quand l'app est en arrière-plan.",
        )
      }

      this.driverId = driverId
      this.courseId = courseId || null
      this.isTracking = true

      // Initialiser la connexion WebSocket
      this.initializeSocket()

      // Obtenir la position initiale
      try {
        const initialLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        })
        console.log("Initial location obtained:", initialLocation.coords)
        this.sendLocationUpdate(initialLocation)
      } catch (error) {
        console.error("Error getting initial location:", error)
      }

      // Démarrer le suivi GPS continu
      this.watchId = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: TRACKING_CONFIG.LOCATION_UPDATE_INTERVAL,
          distanceInterval: TRACKING_CONFIG.LOCATION_DISTANCE_FILTER,
        },
        (location) => {
          console.log("New location received:", location.coords)
          this.sendLocationUpdate(location)
        },
      )

      // Configurer la reconnexion automatique
      this.setupReconnectInterval()

      console.log("Tracking started successfully")
      return true
    } catch (error) {
      console.error("Error starting tracking:", error)
      Alert.alert("Erreur", "Impossible de démarrer le suivi de localisation")
      return false
    }
  }

  private setupReconnectInterval() {
    this.reconnectInterval = setInterval(() => {
      if (this.socket && !this.socket.connected) {
        console.log("Attempting to reconnect...")
        this.socket.connect()
      }
    }, 30000) // Vérifier toutes les 30 secondes
  }

  private sendLocationUpdate(location: Location.LocationObject) {
    if (!this.socket || !this.driverId) {
      console.warn("Cannot send location: socket or driverId not available")
      return
    }

    const locationData: LocationData = {
      driverId: this.driverId,
      courseId: this.courseId || undefined,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy || undefined,
      speed: location.coords.speed || undefined,
      heading: location.coords.heading || undefined,
      status: this.courseId ? "delivering" : "active",
      timestamp: Date.now(),
    }

    this.lastSentLocation = locationData

    // Envoyer même si pas connecté (sera envoyé à la reconnexion)
    if (this.socket.connected) {
      console.log("Sending location update:", locationData)
      this.socket.emit("location:update", locationData)
    } else {
      console.warn("Socket not connected, location queued for next connection")
      // Essayer de reconnecter immédiatement
      this.socket.connect()
    }
  }

  async stopTracking(): Promise<void> {
    console.log("Stopping location tracking")

    this.isTracking = false

    // Arrêter le suivi GPS
    if (this.watchId) {
      await this.watchId.remove()
      this.watchId = null
    }

    // Arrêter la reconnexion automatique
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval)
      this.reconnectInterval = null
    }

    // Envoyer un statut inactif avant de se déconnecter
    if (this.socket?.connected && this.driverId) {
      try {
        const finalLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        })

        const finalLocationData: LocationData = {
          driverId: this.driverId,
          latitude: finalLocation.coords.latitude,
          longitude: finalLocation.coords.longitude,
          status: "inactive",
          timestamp: Date.now(),
        }

        this.socket.emit("location:update", finalLocationData)
      } catch (error) {
        console.error("Error sending final location:", error)
      }
    }

    // Fermer la connexion WebSocket
    if (this.socket?.connected) {
      this.socket.disconnect()
    }

    // Réinitialiser les variables
    this.driverId = null
    this.courseId = null
    this.lastSentLocation = null
    this.connectionAttempts = 0

    console.log("Tracking stopped successfully")
  }

  // Ajouter cette méthode après la méthode stopTracking
  async startTrackingForOptimization(driverId: string, courseId: string): Promise<boolean> {
    console.log(`Starting tracking for optimization - Driver: ${driverId}, Course: ${courseId}`)

    // Démarrer le tracking normal
    const trackingStarted = await this.startTracking(driverId, courseId)

    if (trackingStarted) {
      // Envoyer immédiatement la position actuelle
      try {
        const currentPosition = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        })

        console.log("Sending initial position for optimization:", currentPosition.coords)
        this.sendLocationUpdate(currentPosition)

        // Marquer le statut comme "optimizing" puis "delivering"
        setTimeout(() => {
          this.updateStatus("delivering")
        }, 2000)
      } catch (error) {
        console.error("Error getting initial position:", error)
      }
    }

    return trackingStarted
  }

  updateCourseId(courseId: string | null) {
    console.log(`Updating course ID to: ${courseId}`)
    this.courseId = courseId
    if (this.isTracking && this.driverId) {
      this.updateStatus(courseId ? "delivering" : "active")
    }
  }

  updateStatus(status: string) {
    console.log(`Updating status to: ${status}`)
    if (this.isTracking && this.driverId) {
      this.sendStatusUpdate(status)
    }
  }

  private async sendStatusUpdate(status: string) {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      })

      const locationData: LocationData = {
        driverId: this.driverId!,
        courseId: this.courseId || undefined,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || undefined,
        speed: location.coords.speed || undefined,
        heading: location.coords.heading || undefined,
        status,
        timestamp: Date.now(),
      }

      this.lastSentLocation = locationData

      if (this.socket?.connected) {
        console.log("Sending status update:", locationData)
        this.socket.emit("location:update", locationData)
      }
    } catch (error) {
      console.error("Error sending status update:", error)
    }
  }

  // Méthodes utilitaires
  isTrackingActive(): boolean {
    return this.isTracking
  }

  getCurrentDriverId(): string | null {
    return this.driverId
  }

  getCurrentCourseId(): string | null {
    return this.courseId
  }

  getConnectionStatus(): { connected: boolean; transport?: string; serverUrl: string } {
    if (!this.socket) {
      return { connected: false, serverUrl: this.serverUrl }
    }

    return {
      connected: this.socket.connected,
      transport: this.socket.connected ? this.socket.io.engine.transport.name : undefined,
      serverUrl: this.serverUrl,
    }
  }

  forceReconnect(): void {
    console.log("Forcing reconnection...")
    if (this.socket) {
      this.socket.disconnect()
      setTimeout(() => this.socket?.connect(), 1000)
    } else {
      this.initializeSocket()
    }
  }

  // Méthode pour tester la connexion
  async testConnection(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve(false)
        return
      }

      if (!this.socket.connected) {
        resolve(false)
        return
      }

      const timeout = setTimeout(() => {
        resolve(false)
      }, 5000)

      this.socket.emit("server:status")

      this.socket.once("server:status_response", () => {
        clearTimeout(timeout)
        resolve(true)
      })
    })
  }
}

// Instance singleton
export const locationTrackingService = new LocationTrackingService()
