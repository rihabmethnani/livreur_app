"use client"

import { useEffect, useState } from "react"
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { gql, useQuery, useApolloClient } from "@apollo/client"
import { useRouter } from "expo-router"
import { useAuth } from "../../context/AuthContext"
import CustomHeader from "../../../components/CustomHeader"

const GET_COURSES_BY_DRIVER_ID = gql`
  query CoursesByDriverId($driverId: String!) {
    coursesByDriverId(driverId: $driverId) {
      _id
      orderIds
      createdAt
      status
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
    }
  }
`

const GET_ORDER = gql`
  query Order($id: String!) {
    order(id: $id) {
      _id
      status
      amount
      description
      clientId
      createdAt
    }
  }
`

const GET_CLIENT_ADDRESS = gql`
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

const RunsheetsScreen = () => {
  const { user, logout } = useAuth()
  const router = useRouter()
  const client = useApolloClient()
  const [refreshing, setRefreshing] = useState(false)
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const {
    data,
    loading: queryLoading,
    refetch,
  } = useQuery(GET_COURSES_BY_DRIVER_ID, {
    variables: { driverId: user?._id || "" },
    skip: !user?._id,
    fetchPolicy: "cache-and-network",
    context: { serviceName: "order-service" },
    onCompleted: (data) => {
      console.log("Courses data received:", data)
    },
    onError: (err) => {
      console.error("Courses query error:", err)
      setError(err)
    },
  })

  useEffect(() => {
    const loadCoursesDetails = async () => {
      if (!data?.coursesByDriverId) return

      try {
        setLoading(true)
        setError(null)

        const coursesWithDetails = await Promise.all(
          data.coursesByDriverId.map(async (course) => {
            const orders = await Promise.all(
              course.orderIds.map((orderId) =>
                client
                  .query({
                    query: GET_ORDER,
                    variables: { id: orderId },
                    context: { serviceName: "order-service" },
                  })
                  .catch((err) => {
                    console.error(`Error fetching order ${orderId}:`, err)
                    return null
                  }),
              ),
            )

            const ordersWithClients = await Promise.all(
              orders
                .filter((res) => res?.data?.order)
                .map(async (res) => {
                  try {
                    const clientRes = await client.query({
                      query: GET_CLIENT_ADDRESS,
                      variables: { id: res.data.order.clientId },
                      context: { serviceName: "user-service" },
                    })
                    return {
                      ...res.data.order,
                      client: clientRes.data?.getUserById,
                    }
                  } catch (err) {
                    console.error("Client fetch error:", err)
                    return res.data.order
                  }
                }),
            )

            return {
              ...course,
              orders: ordersWithClients.filter(Boolean),
              hasRoute: course.route && course.route.length > 0,
              isOptimized: course.pointDepart && course.route && course.route.length > 0,
            }
          }),
        )

        setCourses(coursesWithDetails.filter((c) => c.orders.length > 0))
      } catch (err) {
        console.error("Error loading courses:", err)
        setError(err)
      } finally {
        setLoading(false)
      }
    }

    loadCoursesDetails()
  }, [data])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await refetch()
    } catch (err) {
      console.error("Refresh error:", err)
      setError(err)
    } finally {
      setRefreshing(false)
    }
  }

  const handleCourseDetails = (courseId, orderIds) => {
    console.log("Navigating to course details:", courseId)
    router.push({
      pathname: `/runsheet/${courseId}`,
      params: {
        orderIds: JSON.stringify(orderIds),
      },
    })
  }

  const handleOptimizeCourse = (courseId) => {
    console.log("Navigating to optimization:", courseId)
    router.push(`/optimize?courseId=${courseId}`)
  }

  const handleShowRoute = (courseId, isOptimized) => {
    if (!isOptimized) {
      Alert.alert(
        "Course non optimisée",
        "Cette course n'a pas encore été optimisée. Voulez-vous l'optimiser maintenant ?",
        [
          { text: "Annuler", style: "cancel" },
          { text: "Optimiser", onPress: () => handleOptimizeCourse(courseId) },
        ],
      )
      return
    }

    console.log("Navigating to route map:", courseId)
    router.push(`/map?courseId=${courseId}`)
  }

  const renderCourseItem = ({ item }) => {
    return (
      <View style={styles.courseCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.courseId}>Course #{item._id.slice(-6)}</Text>
          <Text style={styles.dateText}>{new Date(item.createdAt).toLocaleDateString("fr-FR")}</Text>
        </View>

        <View style={styles.courseInfo}>
          <View style={styles.ordersSummary}>
            <Ionicons name="document-text" size={18} color="#666" />
            <Text style={styles.ordersCount}>
              {item.orders.length} commande{item.orders.length > 1 ? "s" : ""}
            </Text>
          </View>

          {item.distance && (
            <View style={styles.distanceInfo}>
              <Ionicons name="location" size={18} color="#666" />
              <Text style={styles.distanceText}>{item.distance.toFixed(1)} km</Text>
            </View>
          )}

          {item.duree && (
            <View style={styles.durationInfo}>
              <Ionicons name="time" size={18} color="#666" />
              <Text style={styles.durationText}>{Math.round(item.duree)} min</Text>
            </View>
          )}
        </View>

        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.detailsButton} onPress={() => handleCourseDetails(item._id, item.orderIds)}>
            <Ionicons name="list" size={18} color="#fff" />
            <Text style={styles.buttonText}>Détails</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.mapButton, !item.isOptimized && styles.optimizeButton]}
            onPress={() => handleShowRoute(item._id, item.isOptimized)}
          >
            <Ionicons name={item.isOptimized ? "map" : "navigate"} size={18} color="#fff" />
            <Text style={styles.buttonText}>{item.isOptimized ? "Itinéraire" : "Optimiser"}</Text>
          </TouchableOpacity>
        </View>

        {!item.isOptimized && (
          <View style={styles.warningContainer}>
            <Ionicons name="warning" size={16} color="#FF9800" />
            <Text style={styles.noRouteText}>Course non optimisée - Cliquez sur "Optimiser"</Text>
          </View>
        )}
      </View>
    )
  }

  if (!user?._id) {
    return (
      <View style={styles.authContainer}>
        <ActivityIndicator size="large" color="#272E64" />
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.container}>
        <CustomHeader />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={50} color="#F44336" />
          <Text style={styles.errorText}>Erreur de chargement</Text>
          <Text style={styles.errorSubtext}>{error.message}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <CustomHeader />

      <View style={styles.header}>
        <Text style={styles.title}>Mes Courses</Text>
        {/* <TouchableOpacity onPress={logout}>
          <Ionicons name="log-out-outline" size={24} color="#272E64" />
        </TouchableOpacity> */}
      </View>

      {loading || queryLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#272E64" />
        </View>
      ) : (
        <FlatList
          data={courses}
          renderItem={renderCourseItem}
          keyExtractor={(item) => item._id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text" size={50} color="#ccc" />
              <Text style={styles.emptyText}>Aucune course disponible</Text>
            </View>
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f8f8",
  },
  authContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#272E64",
  },
  courseCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  courseId: {
    fontSize: 16,
    fontWeight: "600",
    color: "#272E64",
  },
  dateText: {
    fontSize: 14,
    color: "#666",
  },
  courseInfo: {
    marginBottom: 15,
  },
  ordersSummary: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  ordersCount: {
    marginLeft: 8,
    fontSize: 14,
    color: "#666",
  },
  distanceInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  distanceText: {
    marginLeft: 8,
    fontSize: 14,
    color: "#666",
  },
  durationInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  durationText: {
    marginLeft: 8,
    fontSize: 14,
    color: "#666",
  },
  actionsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  detailsButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#272E64",
    padding: 10,
    borderRadius: 8,
    marginRight: 8,
  },
  mapButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4CAF50",
    padding: 10,
    borderRadius: 8,
    marginLeft: 8,
  },
  optimizeButton: {
    backgroundColor: "#FF9800",
  },
  buttonText: {
    color: "#fff",
    marginLeft: 8,
    fontWeight: "500",
  },
  warningContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    padding: 8,
    backgroundColor: "#FFF3E0",
    borderRadius: 6,
  },
  noRouteText: {
    fontSize: 12,
    color: "#FF9800",
    marginLeft: 6,
    fontStyle: "italic",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: "#F44336",
    marginTop: 16,
  },
  errorSubtext: {
    fontSize: 14,
    color: "#666",
    marginTop: 8,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: "#272E64",
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: "#fff",
    fontWeight: "500",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: "#999",
    marginTop: 16,
  },
  listContainer: {
    paddingVertical: 16,
  },
})

export default RunsheetsScreen
