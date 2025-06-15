"use client"

import { useState, useEffect, useRef } from "react"
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from "react-native"
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps"
import { useLocalSearchParams, useRouter } from "expo-router"
import { gql, useQuery, useMutation, useApolloClient } from "@apollo/client"
import { Ionicons } from "@expo/vector-icons"
import * as Location from "expo-location"

const GET_COURSE_BASIC = gql`
  query CourseBasic($id: String!) {
    course(id: $id) {
      _id
      orderIds
      distance
      duree
      pointDepart {
        lat
        lng
      }
      status
    }
  }
`

const GET_ORDER_WITH_CLIENT = gql`
  query Order($id: String!) {
    order(id: $id) {
      _id
      status
      amount
      description
      clientId
    }
  }
`

const GET_CLIENT_INFO = gql`
  query GetUserById($id: String!) {
    getUserById(id: $id) {
      _id
      address
      name
      phone
      city
      postalCode
    }
  }
`

const OPTIMIZE_COURSE_WITH_START_POINT = gql`
  mutation OptimizeCourseWithStartPoint($courseId: String!, $startPoint: CoordinatesInput!) {
    optimizeCourseWithStartPoint(courseId: $courseId, startPoint: $startPoint) {
      _id
      distance
      duree
      route {
        lat
        lng
      }
      pointDepart {
        lat
        lng
      }
      pointArrivee
    }
  }
`

export default function OptimizeCourseScreen() {
  const { courseId } = useLocalSearchParams()
  const router = useRouter()
  const client = useApolloClient()
  const mapRef = useRef(null)

  const [region, setRegion] = useState({
    latitude: 35.8245, // Centré sur Sousse
    longitude: 10.6346,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  })
  const [startPoint, setStartPoint] = useState(null)
  const [orderDetails, setOrderDetails] = useState([])
  const [clientLocations, setClientLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [locationWatchId, setLocationWatchId] = useState(null)
  const [isLocationReady, setIsLocationReady] = useState(false)

  const {
    data,
    loading: queryLoading,
    error,
  } = useQuery(GET_COURSE_BASIC, {
    variables: { id: courseId },
    context: { serviceName: "order-service" },
    skip: !courseId,
  })

  const [optimizeCourse, { loading: optimizing }] = useMutation(OPTIMIZE_COURSE_WITH_START_POINT, {
    context: { serviceName: "order-service" },
  })

  // Démarrer le suivi de localisation dès le chargement
  useEffect(() => {
    startLocationTracking()
    return () => {
      // Nettoyer le suivi de localisation lors du démontage
      if (locationWatchId !== null) {
        Location.stopLocationUpdatesAsync(locationWatchId)
      }
    }
  }, [])

  // Charger les données de la course
  useEffect(() => {
    loadCourseData()
  }, [data, client])

  // Fonction pour démarrer le suivi de localisation
  const startLocationTracking = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== "granted") {
        console.log("Location permission denied, using default location")
        setDefaultLocation()
        return
      }

      // Obtenir la position initiale
      const initialPosition = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      })

      const currentLocation = {
        latitude: initialPosition.coords.latitude,
        longitude: initialPosition.coords.longitude,
      }

      console.log("Initial location:", currentLocation)
      setStartPoint(currentLocation)
      setRegion({
        ...currentLocation,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      })
      setIsLocationReady(true)

      // Configurer le suivi continu
      const watchId = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        (location) => {
          const newLocation = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          }
          console.log("Location updated:", newLocation)

          // Mettre à jour uniquement si on n'a pas encore optimisé
          if (!isLocationReady) {
            setStartPoint(newLocation)
          }
        },
      )

      setLocationWatchId(watchId)
    } catch (error) {
      console.error("Error starting location tracking:", error)
      setDefaultLocation()
    }
  }

  const setDefaultLocation = () => {
    const defaultLocation = {
      latitude: 35.8245,
      longitude: 10.6346,
    }
    setStartPoint(defaultLocation)
    setRegion({
      ...defaultLocation,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    })
    setIsLocationReady(true)
  }

  const loadCourseData = async () => {
    if (!data?.course) return

    try {
      setLoading(true)
      const course = data.course

      console.log("Loading course data for:", course._id)
      console.log("Order IDs:", course.orderIds)

      // Charger les détails des commandes
      if (course.orderIds && course.orderIds.length > 0) {
        const ordersWithClients = await Promise.all(
          course.orderIds.map(async (orderId) => {
            try {
              console.log(`Loading order ${orderId}...`)
              const orderRes = await client.query({
                query: GET_ORDER_WITH_CLIENT,
                variables: { id: orderId },
                context: { serviceName: "order-service" },
              })

              console.log(`Order ${orderId} data:`, orderRes.data?.order)

              if (orderRes.data?.order?.clientId) {
                try {
                  console.log(`Loading client ${orderRes.data.order.clientId}...`)
                  const clientRes = await client.query({
                    query: GET_CLIENT_INFO,
                    variables: { id: orderRes.data.order.clientId },
                    context: { serviceName: "user-service" },
                  })

                  console.log(`Client ${orderRes.data.order.clientId} data:`, clientRes.data?.getUserById)

                  const clientData = clientRes.data?.getUserById
                  const orderWithClient = {
                    ...orderRes.data.order,
                    client: clientData,
                  }

                  // Utiliser des coordonnées précises basées sur l'adresse
                  const preciseLocation = getPreciseLocationFromAddress(clientData?.address, clientData?.city)
                  console.log(`Precise location for ${clientData?.name}:`, preciseLocation)

                  return {
                    order: orderWithClient,
                    location: preciseLocation,
                  }
                } catch (clientErr) {
                  console.log(`Client data not available for order ${orderId}:`, clientErr)
                  return {
                    order: orderRes.data?.order,
                    location: getDefaultSousseLocation(),
                  }
                }
              }
              return {
                order: orderRes.data?.order,
                location: getDefaultSousseLocation(),
              }
            } catch (err) {
              console.log(`Order ${orderId} not available:`, err)
              return null
            }
          }),
        )

        const validOrdersWithLocations = ordersWithClients.filter(Boolean)
        console.log("Valid orders with locations:", validOrdersWithLocations)

        setOrderDetails(validOrdersWithLocations.map((item) => item.order))
        setClientLocations(validOrdersWithLocations.map((item) => item.location))

        // Ajuster la région pour montrer tous les points
        if (validOrdersWithLocations.length > 0 && startPoint) {
          fitMapToMarkers([startPoint, ...validOrdersWithLocations.map((item) => item.location)])
        }
      }
    } catch (err) {
      console.error("Error loading course data:", err)
      Alert.alert("Erreur", "Impossible de charger les données de la course.")
    } finally {
      setLoading(false)
    }
  }

  // Fonction pour ajuster la carte pour montrer tous les points
  const fitMapToMarkers = (locations) => {
    if (!mapRef.current || !locations || locations.length === 0) return

    const padding = { top: 50, right: 50, bottom: 50, left: 50 }
    mapRef.current.fitToCoordinates(locations, { edgePadding: padding, animated: true })
  }

  // Fonction pour obtenir des coordonnées précises basées sur l'adresse
  const getPreciseLocationFromAddress = (address, city) => {
    if (!address) return getDefaultSousseLocation()

    const lowerAddress = address.toLowerCase()
    const lowerCity = city?.toLowerCase() || ""

    // Coordonnées précises pour les adresses spécifiques
    if (lowerAddress.includes("14 janvier") || lowerAddress.includes("corniche")) {
      return { latitude: 35.8335, longitude: 10.638 }
    }

    if (lowerAddress.includes("imam abou hanifa") || lowerAddress.includes("khzema") || lowerCity.includes("khzema")) {
      return { latitude: 35.828, longitude: 10.595 }
    }

    if (lowerAddress.includes("sahloul")) {
      return { latitude: 35.8484, longitude: 10.5986 }
    }

    if (lowerAddress.includes("hammam")) {
      return { latitude: 35.8611, longitude: 10.5944 }
    }

    if (lowerAddress.includes("kantaoui")) {
      return { latitude: 35.8903, longitude: 10.5986 }
    }

    // Fallback sur le centre de Sousse
    return getDefaultSousseLocation()
  }

  const getDefaultSousseLocation = () => ({
    latitude: 35.8245,
    longitude: 10.6346,
  })

  const handleOptimize = async () => {
    if (!startPoint) {
      Alert.alert("Position non disponible", "Impossible de détecter votre position. Veuillez réessayer.")
      return
    }

    console.log("Optimizing course with:", {
      courseId,
      startPoint: {
        lat: startPoint.latitude,
        lng: startPoint.longitude,
      },
    })

    try {
      const result = await optimizeCourse({
        variables: {
          courseId,
          startPoint: {
            lat: startPoint.latitude,
            lng: startPoint.longitude,
          },
        },
      })

      console.log("Frontend optimization result:", result)

      if (result.data?.optimizeCourseWithStartPoint) {
        const optimizedCourse = result.data.optimizeCourseWithStartPoint
        console.log("Optimized course data:", {
          id: optimizedCourse._id,
          routeLength: optimizedCourse.route?.length,
          distance: optimizedCourse.distance,
          duree: optimizedCourse.duree,
        })

        // Vérifier que la route contient des points
        const route = optimizedCourse.route
        if (!route || route.length < 2) {
          console.error("Invalid route received:", route)

          // Essayer de récupérer la course à nouveau pour voir si la route est présente
          try {
            const refreshedData = await client.query({
              query: gql`
                query RefreshCourse($id: String!) {
                  course(id: $id) {
                    _id
                    route {
                      lat
                      lng
                    }
                  }
                }
              `,
              variables: { id: courseId },
              context: { serviceName: "order-service" },
              fetchPolicy: "network-only",
            })

            console.log("Refreshed course data:", refreshedData.data?.course)

            if (refreshedData.data?.course?.route?.length >= 2) {
              console.log("Route found in refreshed data, redirecting to map...")
              router.replace(`/map?courseId=${courseId}`)
              return
            }
          } catch (refreshError) {
            console.error("Error refreshing course data:", refreshError)
          }

          Alert.alert("Erreur", "L'optimisation n'a pas généré de trajet valide. Veuillez réessayer.")
          return
        }

        console.log("Route is valid, redirecting to map...")

        // Rediriger vers la carte avec le trajet optimisé
        router.replace(`/map?courseId=${courseId}`)
      } else {
        console.error("No optimization result received")
        Alert.alert("Erreur", "L'optimisation n'a pas retourné de résultat valide.")
      }
    } catch (error) {
      console.error("Error optimizing course:", error)
      Alert.alert("Erreur", `Impossible d'optimiser le trajet: ${error.message}`)
    }
  }

  if (queryLoading || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#272E64" />
        <Text style={styles.loadingText}>Chargement de la course...</Text>
      </View>
    )
  }

  if (error || !data?.course) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={50} color="#F44336" />
        <Text style={styles.errorText}>Erreur de chargement</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const course = data.course

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#272E64" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Optimiser Course #{course._id.slice(-6)}</Text>
          <Text style={styles.headerSubtitle}>
            {orderDetails.length} commande{orderDetails.length > 1 ? "s" : ""} à livrer
          </Text>
        </View>
      </View>

      {/* Instructions */}
      <View style={styles.instructionsContainer}>
        <Ionicons name="information-circle" size={20} color="#2196F3" />
        <Text style={styles.instructionsText}>
          Votre position a été détectée automatiquement. Cliquez sur "Optimiser" pour calculer le trajet optimal.
        </Text>
      </View>

      {/* Status info */}
      <View style={styles.statusContainer}>
        <Ionicons
          name={startPoint ? "checkmark-circle" : "time"}
          size={20}
          color={startPoint ? "#4CAF50" : "#FF9800"}
        />
        <Text style={[styles.statusText, startPoint ? styles.statusSuccess : styles.statusPending]}>
          {startPoint ? "Position de départ détectée" : "Détection de votre position en cours..."}
        </Text>
      </View>

      {/* Carte */}
      <MapView
        ref={mapRef}
        style={styles.map}
        region={region}
        provider={PROVIDER_GOOGLE}
        showsUserLocation={true}
        showsMyLocationButton={true}
        followsUserLocation={false}
        scrollEnabled={true}
        zoomEnabled={true}
        pitchEnabled={false}
        rotateEnabled={true}
      >
        {/* Point de départ */}
        {startPoint && (
          <Marker
            coordinate={startPoint}
            title="Point de départ"
            description="Votre position de départ"
            pinColor="#272E64"
            draggable={false}
          />
        )}

        {/* Points de livraison avec coordonnées précises */}
        {clientLocations.map((location, index) => {
          const order = orderDetails[index]
          return (
            <Marker
              key={`delivery-${index}`}
              coordinate={location}
              title={`Livraison ${index + 1}`}
              description={order?.client?.name || "Client inconnu"}
              pinColor="#FFC107"
              draggable={false}
            />
          )
        })}
      </MapView>

      {/* Bouton d'optimisation */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.optimizeButton, (!startPoint || optimizing) && styles.disabledButton]}
          onPress={handleOptimize}
          disabled={!startPoint || optimizing}
        >
          {optimizing ? (
            <ActivityIndicator size={20} color="#fff" />
          ) : (
            <Ionicons name="navigate" size={20} color="#fff" />
          )}
          <Text style={styles.buttonText}>{optimizing ? "Optimisation..." : "Optimiser"}</Text>
        </TouchableOpacity>
      </View>

      {/* Informations sur les livraisons */}
      {orderDetails.length > 0 && (
        <View style={styles.deliveriesInfo}>
          <Text style={styles.deliveriesTitle}>Commandes à livrer :</Text>
          <View style={styles.deliveriesList}>
            {orderDetails.map((order, index) => (
              <View key={order._id} style={styles.deliveryItem}>
                <Text style={styles.deliveryNumber}>{index + 1}</Text>
                <View style={styles.deliveryDetails}>
                  <Text style={styles.clientName}>{order.client?.name || "Client inconnu"}</Text>
                  <Text style={styles.clientAddress}>{order.client?.address || "Adresse non disponible"}</Text>
                </View>
                <Text style={styles.orderAmount}>{order.amount ? `${order.amount} DT` : ""}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingTop: 50,
  },
  headerInfo: {
    marginLeft: 16,
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#272E64",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
  instructionsContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E3F2FD",
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 8,
  },
  instructionsText: {
    marginLeft: 8,
    color: "#1976D2",
    fontSize: 14,
    flex: 1,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    padding: 8,
    marginHorizontal: 16,
    borderRadius: 4,
  },
  statusText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "500",
  },
  statusSuccess: {
    color: "#4CAF50",
  },
  statusPending: {
    color: "#FF9800",
  },
  map: {
    flex: 1,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 8,
  },
  actionsContainer: {
    padding: 16,
  },
  optimizeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4CAF50",
    padding: 16,
    borderRadius: 8,
  },
  disabledButton: {
    backgroundColor: "#ccc",
  },
  buttonText: {
    color: "#fff",
    marginLeft: 8,
    fontWeight: "500",
    fontSize: 16,
  },
  deliveriesInfo: {
    backgroundColor: "#f8f8f8",
    padding: 16,
    maxHeight: 200,
  },
  deliveriesTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#272E64",
    marginBottom: 8,
  },
  deliveriesList: {
    gap: 8,
  },
  deliveryItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  deliveryNumber: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#272E64",
    marginRight: 12,
    minWidth: 20,
  },
  deliveryDetails: {
    flex: 1,
  },
  clientName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
  clientAddress: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  orderAmount: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#4CAF50",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fff",
  },
  errorText: {
    fontSize: 18,
    color: "#F44336",
    marginTop: 16,
    textAlign: "center",
  },
  backButton: {
    backgroundColor: "#272E64",
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  backButtonText: {
    color: "#fff",
    fontWeight: "500",
  },
})
