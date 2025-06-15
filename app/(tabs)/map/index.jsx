"use client"

import { useEffect, useState, useRef } from "react"
import { View, StyleSheet, Alert, ActivityIndicator, Text, TouchableOpacity, ScrollView } from "react-native"
import MapView, { Polyline, Marker, PROVIDER_GOOGLE } from "react-native-maps"
import { useLocalSearchParams, useRouter } from "expo-router"
import { gql, useQuery, useApolloClient } from "@apollo/client"
import { Ionicons } from "@expo/vector-icons"
import * as Location from "expo-location"

const GET_COURSE_COMPLETE = gql`
  query Course($id: String!) {
    course(id: $id) {
      _id
      orderIds
      distance
      duree
      pointDepart {
        lat
        lng
      }
      route {
        lat
        lng
      }
      detailedRoute {
        lat
        lng
      }
      status
      pointArrivee
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

export default function MapScreen() {
  const { courseId } = useLocalSearchParams()
  const router = useRouter()
  const client = useApolloClient()
  const mapRef = useRef(null)

  const [region, setRegion] = useState(null)
  const [routeCoordinates, setRouteCoordinates] = useState([])
  const [detailedRouteCoordinates, setDetailedRouteCoordinates] = useState([])
  const [orderDetails, setOrderDetails] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentLocation, setCurrentLocation] = useState(null)
  const [locationWatchId, setLocationWatchId] = useState(null)
  const [showDetailedRoute, setShowDetailedRoute] = useState(true)

  const {
    data,
    loading: queryLoading,
    error,
    refetch,
  } = useQuery(GET_COURSE_COMPLETE, {
    variables: { id: courseId },
    context: { serviceName: "order-service" },
    skip: !courseId,
    fetchPolicy: "cache-and-network",
    onCompleted: (data) => {
      //console.log("Course data loaded:", data)
    },
    onError: (err) => {
      console.error("Course query error:", err)
    },
  })

  // Démarrer le suivi de localisation
  useEffect(() => {
    startLocationTracking()
    return () => {
      if (locationWatchId !== null) {
        Location.stopLocationUpdatesAsync(locationWatchId)
      }
    }
  }, [])

  // Charger les données de la course
  useEffect(() => {
    loadCourseData()
  }, [data, client])

  const startLocationTracking = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== "granted") {
        console.log("Location permission denied")
        return
      }

      // Obtenir la position initiale
      const initialPosition = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      })

      const location = {
        latitude: initialPosition.coords.latitude,
        longitude: initialPosition.coords.longitude,
      }

      console.log("Initial location:", location)
      setCurrentLocation(location)

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
          setCurrentLocation(newLocation)
        },
      )

      setLocationWatchId(watchId)
    } catch (error) {
      console.error("Error starting location tracking:", error)
    }
  }

  const loadCourseData = async () => {
    if (!data?.course) return

    try {
      setLoading(true)
      const course = data.course

      console.log("Course data:", course)
      console.log("Course route data:", course.route)
      console.log("Course detailed route data:", course.detailedRoute)

      // Définir les coordonnées de la route de base
      if (course.route && course.route.length > 0) {
        console.log("Setting basic route coordinates:", course.route)

        const mappedCoordinates = course.route.map((coord) => ({
          latitude: coord.lat,
          longitude: coord.lng,
        }))

        setRouteCoordinates(mappedCoordinates)
      }

      // Définir les coordonnées de la route détaillée (vraies routes)
      if (course.detailedRoute && course.detailedRoute.length > 0) {
        console.log("Setting detailed route coordinates:", course.detailedRoute.length, "points")

        const detailedMappedCoordinates = course.detailedRoute.map((coord) => ({
          latitude: coord.lat,
          longitude: coord.lng,
        }))

        setDetailedRouteCoordinates(detailedMappedCoordinates)

        // Ajuster la carte pour montrer toute la route détaillée
        if (mapRef.current) {
          setTimeout(() => {
            fitMapToMarkers(detailedMappedCoordinates)
          }, 1000)
        }
      } else if (course.route && course.route.length > 0) {
        // Fallback sur la route de base
        console.log("No detailed route, using basic route")
        const mappedCoordinates = course.route.map((coord) => ({
          latitude: coord.lat,
          longitude: coord.lng,
        }))

        setDetailedRouteCoordinates(mappedCoordinates)

        if (mapRef.current) {
          setTimeout(() => {
            fitMapToMarkers(mappedCoordinates)
          }, 1000)
        }
      } else {
        console.error("No route coordinates found in course data")
        Alert.alert("Erreur", "Aucun trajet n'a été trouvé pour cette course. Veuillez l'optimiser d'abord.")
      }

      // Charger les détails des commandes
      if (course.orderIds && course.orderIds.length > 0) {
        const ordersWithClients = await Promise.all(
          course.orderIds.map(async (orderId) => {
            try {
              const orderRes = await client.query({
                query: GET_ORDER_WITH_CLIENT,
                variables: { id: orderId },
                context: { serviceName: "order-service" },
                errorPolicy: "all",
              })

              if (orderRes.data?.order?.clientId) {
                try {
                  const clientRes = await client.query({
                    query: GET_CLIENT_INFO,
                    variables: { id: orderRes.data.order.clientId },
                    context: { serviceName: "user-service" },
                    errorPolicy: "all",
                  })

                  return {
                    ...orderRes.data.order,
                    client: clientRes.data?.getUserById,
                  }
                } catch (clientErr) {
                  console.log(`Client data not available for order ${orderId}:`, clientErr.message)
                  return orderRes.data?.order
                }
              }
              return orderRes.data?.order
            } catch (err) {
              console.log(`Order ${orderId} not available:`, err.message)
              return null
            }
          }),
        )

        setOrderDetails(ordersWithClients.filter(Boolean))
      }
    } catch (err) {
      console.error("Error loading course data:", err)
      Alert.alert("Erreur", "Impossible de charger les données du trajet.")
    } finally {
      setLoading(false)
    }
  }

  // Fonction pour ajuster la carte pour montrer tous les points
  const fitMapToMarkers = (coordinates) => {
    if (!mapRef.current || !coordinates || coordinates.length === 0) return

    const padding = { top: 50, right: 50, bottom: 50, left: 50 }
    mapRef.current.fitToCoordinates(coordinates, { edgePadding: padding, animated: true })
  }

  const handleRetry = () => {
    setLoading(true)
    refetch()
  }

  const handleCenterOnUser = () => {
    if (!currentLocation || !mapRef.current) return

    mapRef.current.animateToRegion(
      {
        ...currentLocation,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      500,
    )
  }

  const handleShowFullRoute = () => {
    const coordinatesToShow = showDetailedRoute ? detailedRouteCoordinates : routeCoordinates
    if (coordinatesToShow.length > 0 && mapRef.current) {
      fitMapToMarkers(coordinatesToShow)
    }
  }

  const toggleRouteType = () => {
    setShowDetailedRoute(!showDetailedRoute)
  }

  if (queryLoading || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#272E64" />
        <Text style={styles.loadingText}>Chargement de la carte...</Text>
      </View>
    )
  }

  if (error && !data) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={50} color="#F44336" />
        <Text style={styles.errorText}>Erreur de chargement</Text>
        <Text style={styles.errorSubtext}>{error.message}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
          <Text style={styles.retryButtonText}>Réessayer</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (!data?.course) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="map" size={50} color="#ccc" />
        <Text style={styles.errorText}>Course introuvable</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const course = data.course
  const hasOptimizedRoute = routeCoordinates.length > 1
  const hasDetailedRoute = detailedRouteCoordinates.length > 1
  const displayCoordinates = showDetailedRoute && hasDetailedRoute ? detailedRouteCoordinates : routeCoordinates

  return (
    <View style={styles.container}>
      {/* Header avec informations de la course */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#272E64" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Course #{course._id.slice(-6)}</Text>
          <Text style={styles.headerSubtitle}>
            {orderDetails.length} commande{orderDetails.length > 1 ? "s" : ""}
            {course.distance && ` • ${course.distance.toFixed(1)} km`}
            {course.duree && ` • ${Math.round(course.duree)} min`}
          </Text>
        </View>
      </View>

      {/* Statut de l'optimisation */}
      <View style={[styles.statusBanner, hasOptimizedRoute ? styles.optimizedBanner : styles.warningBanner]}>
        <Ionicons
          name={hasOptimizedRoute ? "checkmark-circle" : "warning"}
          size={20}
          color={hasOptimizedRoute ? "#4CAF50" : "#FF9800"}
        />
        {/* <Text style={[styles.statusText, hasOptimizedRoute ? styles.optimizedText : styles.warningText]}>
          {hasDetailedRoute
            ? "Trajet routier optimisé avec IA (OSRM + KNN + 2-OPT)"
            : hasOptimizedRoute
              ? "Trajet optimisé avec IA (KNN + 2-OPT)"
              : "Trajet de base - Optimisation recommandée"}
        </Text> */}
      </View>

      {/* Contrôles du type de route */}
      {hasDetailedRoute && (
        <View style={styles.routeControls}>
          <TouchableOpacity
            style={[styles.routeControlButton, showDetailedRoute && styles.activeRouteControl]}
            onPress={() => setShowDetailedRoute(true)}
          >
            <Ionicons name="map" size={16} color={showDetailedRoute ? "#fff" : "#272E64"} />
            <Text style={[styles.routeControlText, showDetailedRoute && styles.activeRouteControlText]}>
              Vraies routes ({detailedRouteCoordinates.length} pts)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.routeControlButton, !showDetailedRoute && styles.activeRouteControl]}
            onPress={() => setShowDetailedRoute(false)}
          >
            <Ionicons name="navigate" size={16} color={!showDetailedRoute ? "#fff" : "#272E64"} />
            <Text style={[styles.routeControlText, !showDetailedRoute && styles.activeRouteControlText]}>
              Ligne directe ({routeCoordinates.length} pts)
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Carte */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: 35.8245,
          longitude: 10.6346,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation={true}
        followsUserLocation={false}
        showsMyLocationButton={false}
      >
        {/* Points de la route avec markers (seulement les points principaux) */}
        {routeCoordinates.map((coord, index) => (
          <Marker
            key={`route-point-${index}`}
            coordinate={coord}
            title={index === 0 ? "Point de départ" : `Livraison ${index}`}
            description={index === 0 ? "Début du trajet" : orderDetails[index - 1]?.client?.name || `Commande ${index}`}
            pinColor={index === 0 ? "#272E64" : "#4CAF50"}
          />
        ))}

        {/* Trajet optimisé */}
        {displayCoordinates.length > 1 && (
          <Polyline
            coordinates={displayCoordinates}
            strokeColor={showDetailedRoute && hasDetailedRoute ? "#2196F3" : "#272E64"}
            strokeWidth={showDetailedRoute && hasDetailedRoute ? 5 : 4}
            lineDashPattern={showDetailedRoute && hasDetailedRoute ? [0] : [10, 5]}
          />
        )}
      </MapView>

      {/* Boutons de contrôle de la carte */}
      <View style={styles.mapControls}>
        <TouchableOpacity style={styles.mapControlButton} onPress={handleCenterOnUser}>
          <Ionicons name="locate" size={24} color="#272E64" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.mapControlButton} onPress={handleShowFullRoute}>
          <Ionicons name="map" size={24} color="#272E64" />
        </TouchableOpacity>
        {hasDetailedRoute && (
          <TouchableOpacity style={styles.mapControlButton} onPress={toggleRouteType}>
            <Ionicons name={showDetailedRoute ? "navigate" : "map"} size={24} color="#272E64" />
          </TouchableOpacity>
        )}
      </View>

      {/* Informations sur les livraisons */}
      {orderDetails.length > 0 && (
        <View style={styles.deliveriesInfo}>
          <Text style={styles.deliveriesTitle}>
            {hasOptimizedRoute ? "Ordre de livraison optimisé :" : "Commandes à livrer :"}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {orderDetails.map((order, index) => (
              <View key={order._id} style={styles.deliveryCard}>
                <Text style={styles.deliveryNumber}>{index + 1}</Text>
                <Text style={styles.clientName}>{order.client?.name || "Client inconnu"}</Text>
                <Text style={styles.clientAddress}>{order.client?.address || "Adresse non disponible"}</Text>
                <Text style={styles.orderAmount}>{order.amount ? `${order.amount} DT` : ""}</Text>
              </View>
            ))}
          </ScrollView>
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
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
  },
  optimizedBanner: {
    backgroundColor: "#E8F5E8",
    borderBottomColor: "#C8E6C9",
  },
  warningBanner: {
    backgroundColor: "#FFF3E0",
    borderBottomColor: "#FFE0B2",
  },
  statusText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "500",
  },
  optimizedText: {
    color: "#4CAF50",
  },
  warningText: {
    color: "#FF9800",
  },
  routeControls: {
    flexDirection: "row",
    backgroundColor: "#f8f8f8",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  routeControlButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    padding: 8,
    marginHorizontal: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  activeRouteControl: {
    backgroundColor: "#272E64",
    borderColor: "#272E64",
  },
  routeControlText: {
    marginLeft: 4,
    fontSize: 12,
    color: "#272E64",
    fontWeight: "500",
  },
  activeRouteControlText: {
    color: "#fff",
  },
  map: {
    flex: 1,
  },
  mapControls: {
    position: "absolute",
    right: 16,
    top: 200,
    backgroundColor: "transparent",
  },
  mapControlButton: {
    backgroundColor: "white",
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  deliveriesInfo: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingVertical: 12,
  },
  deliveriesTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#272E64",
    marginLeft: 16,
    marginBottom: 8,
  },
  deliveryCard: {
    backgroundColor: "#f8f8f8",
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 8,
    minWidth: 150,
    alignItems: "center",
  },
  deliveryNumber: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#272E64",
    marginBottom: 4,
  },
  clientName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
    textAlign: "center",
    marginBottom: 2,
  },
  clientAddress: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
    marginBottom: 4,
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
  errorSubtext: {
    fontSize: 14,
    color: "#666",
    marginTop: 8,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: "#4CAF50",
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: "#fff",
    fontWeight: "500",
  },
  backButton: {
    backgroundColor: "#272E64",
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  backButtonText: {
    color: "#fff",
    fontWeight: "500",
  },
})
