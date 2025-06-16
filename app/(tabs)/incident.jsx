"use client"

import { useState, useEffect, useCallback } from "react"
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { gql, useQuery, useMutation, useApolloClient } from "@apollo/client"
import { useRouter } from "expo-router"
import CustomHeader from "../../components/CustomHeader"
import { useAuth } from "../context/AuthContext"

// Queries
const GET_ORDERS_WITH_INCIDENTS = gql`
  query GetOrdersWithIncidents($driverId: String!) {
    coursesByDriverId(driverId: $driverId) {
      _id
      orderIds
      status
      createdAt
    }
  }
`

const GET_ORDER_DETAILS = gql`
  query Order($id: String!) {
    order(id: $id) {
      _id
      status
      amount
      description
      fraisLivraison
      clientId
      driverId
      partnerId
      createdAt
    }
  }
`

const GET_INCIDENTS_BY_ORDER = gql`
  query GetIncidentsByOrderId($orderId: String!) {
    getIncidentsByOrderId(orderId: $orderId) {
      _id
      incidentType
      description
      customDescription
      priority
      status
      createdAt
      reportedBy
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
    }
  }
`

// Mutations
const UPDATE_INCIDENT_STATUS = gql`
  mutation UpdateIncident($input: UpdateIncidentInput!) {
    updateIncident(input: $input) {
      _id
      status
      priority
      updatedAt
    }
  }
`

const INCIDENT_STATUS_LABELS = {
  Ouvert: "Ouvert",
  "En Cours": "En Cours",
  Résolu: "Résolu",
  Annulé: "Annulé",
}

const INCIDENT_TYPE_LABELS = {
  "Colis Endommagé": "Colis Endommagé",
  "Adresse Incorrecte": "Adresse Incorrecte",
  "Client Introuvable": "Client Introuvable",
  "Colis Perdu": "Colis Perdu",
  "Retard Météorologique": "Retard Météorologique",
  "Retard de Circulation": "Retard de Circulation",
  "Colis Refusé": "Colis Refusé",
  Autre: "Autre",
}

const PRIORITY_LABELS = {
  Faible: "Faible",
  Moyenne: "Moyenne",
  Élevée: "Élevée",
  Critique: "Critique",
}

const IncidentScreen = () => {
  const { user } = useAuth()
  const router = useRouter()
  const client = useApolloClient()

  const [ordersWithIncidents, setOrdersWithIncidents] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Query pour récupérer les courses du chauffeur
  const { data: coursesData, refetch: refetchCourses } = useQuery(GET_ORDERS_WITH_INCIDENTS, {
    variables: { driverId: user?._id },
    context: { serviceName: "order-service" },
    skip: !user?._id,
  })

  const [updateIncidentStatus] = useMutation(UPDATE_INCIDENT_STATUS, {
    context: { serviceName: "order-service" },
  })

  // Fonction pour charger les détails des commandes avec incidents
  const loadOrdersWithIncidents = useCallback(async () => {
    if (!coursesData?.coursesByDriverId || !user?._id) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const allOrderIds = coursesData.coursesByDriverId.flatMap((course) => course.orderIds)

      if (allOrderIds.length === 0) {
        setOrdersWithIncidents([])
        setLoading(false)
        return
      }

      // Charger les détails de chaque commande et vérifier s'il y a des incidents
      const ordersWithIncidentsPromises = allOrderIds.map(async (orderId) => {
        try {
          // Récupérer les détails de la commande
          const { data: orderData } = await client.query({
            query: GET_ORDER_DETAILS,
            variables: { id: orderId },
            context: { serviceName: "order-service" },
            fetchPolicy: "network-only",
          })

          if (!orderData?.order) return null

          // Vérifier s'il y a des incidents pour cette commande
          const { data: incidentsData } = await client.query({
            query: GET_INCIDENTS_BY_ORDER,
            variables: { orderId },
            context: { serviceName: "order-service" },
            fetchPolicy: "network-only",
          })

          // Si pas d'incidents, ne pas inclure cette commande
          if (!incidentsData?.getIncidentsByOrderId || incidentsData.getIncidentsByOrderId.length === 0) {
            return null
          }

          // Récupérer les informations du client
          let clientData = null
          try {
            const { data: clientResponse } = await client.query({
              query: GET_CLIENT_INFO,
              variables: { id: orderData.order.clientId },
              context: { serviceName: "user-service" },
              fetchPolicy: "network-only",
            })
            clientData = clientResponse?.getUserById
          } catch (clientError) {
            console.error(`Error loading client for order ${orderId}:`, clientError)
          }

          const deliveryFee = orderData.order.fraisLivraison || 10
          const orderAmount = Number.parseFloat(orderData.order.amount) || 0
          const totalAmount = orderAmount + deliveryFee

          return {
            ...orderData.order,
            client: clientData,
            deliveryFee,
            totalAmount,
            incidents: incidentsData.getIncidentsByOrderId,
          }
        } catch (error) {
          console.error(`Error loading order ${orderId}:`, error)
          return null
        }
      })

      const results = await Promise.all(ordersWithIncidentsPromises)
      const validOrders = results.filter(Boolean)

      setOrdersWithIncidents(validOrders)
    } catch (error) {
      console.error("Error loading orders with incidents:", error)
      Alert.alert("Erreur", "Impossible de charger les commandes avec incidents")
    } finally {
      setLoading(false)
    }
  }, [coursesData, user, client])

  useEffect(() => {
    loadOrdersWithIncidents()
  }, [loadOrdersWithIncidents])

  const handleRefresh = async () => {
    setRefreshing(true)
    await refetchCourses()
    await loadOrdersWithIncidents()
    setRefreshing(false)
  }

  const handleUpdateIncidentStatus = async (incidentId, newStatus) => {
    try {
      await updateIncidentStatus({
        variables: {
          input: {
            incidentId,
            status: newStatus,
          },
        },
      })

      // Recharger les données après mise à jour
      await loadOrdersWithIncidents()

      Alert.alert("Succès", "Statut de l'incident mis à jour")
    } catch (error) {
      console.error("Error updating incident status:", error)
      Alert.alert("Erreur", "Impossible de mettre à jour le statut de l'incident")
    }
  }

  const getIncidentStatusColor = (status) => {
    switch (status) {
      case "Ouvert":
        return "#F44336"
      case "En Cours":
        return "#FF9800"
      case "Résolu":
        return "#4CAF50"
      case "Annulé":
        return "#9E9E9E"
      default:
        return "#666"
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "Critique":
        return "#D32F2F"
      case "Élevée":
        return "#F57C00"
      case "Moyenne":
        return "#1976D2"
      case "Faible":
        return "#388E3C"
      default:
        return "#666"
    }
  }

  const renderIncidentItem = (incident) => (
    <View key={incident._id} style={styles.incidentCard}>
      <View style={styles.incidentHeader}>
        <View style={[styles.statusBadge, { backgroundColor: getIncidentStatusColor(incident.status) }]}>
          <Text style={styles.statusText}>{incident.status}</Text>
        </View>
        <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(incident.priority) }]}>
          <Text style={styles.priorityText}>{incident.priority}</Text>
        </View>
      </View>

      <Text style={styles.incidentType}>{incident.incidentType}</Text>
      <Text style={styles.incidentDescription}>{incident.description}</Text>

      {incident.customDescription && (
        <Text style={styles.customDescription}>Détails: {incident.customDescription}</Text>
      )}

      <Text style={styles.incidentDate}>Créé le: {new Date(incident.createdAt).toLocaleString("fr-FR")}</Text>

      {incident.status === "Ouvert" && (
        <View style={styles.incidentActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.inProgressButton]}
            onPress={() => handleUpdateIncidentStatus(incident._id, "En Cours")}
          >
            <Text style={styles.actionButtonText}>Prendre en charge</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )

  const renderOrderItem = ({ item }) => (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <Text style={styles.orderId}>Commande #{item._id.slice(-6)}</Text>
        <View style={styles.incidentCount}>
          <Ionicons name="warning" size={16} color="#F44336" />
          <Text style={styles.incidentCountText}>{item.incidents.length} incident(s)</Text>
        </View>
      </View>

      <Text style={styles.orderDescription}>{item.description}</Text>

      <View style={styles.amountContainer}>
        <View style={styles.amountRow}>
          <Text style={styles.amountLabel}>Total:</Text>
          <Text style={styles.totalValue}>{item.totalAmount} DH</Text>
        </View>
      </View>

      {item.client && (
        <View style={styles.clientInfo}>
          <Text style={styles.clientName}>👤 {item.client.name}</Text>
          <Text style={styles.clientAddress}>📍 {item.client.address}</Text>
          <Text style={styles.clientPhone}>📞 {item.client.phone}</Text>
        </View>
      )}

      <View style={styles.incidentsContainer}>
        <Text style={styles.incidentsTitle}>Incidents signalés:</Text>
        {item.incidents.map(renderIncidentItem)}
      </View>

      <TouchableOpacity
        style={styles.viewDetailsButton}
        onPress={() =>
          router.push({
            pathname: "/runsheet/[id]",
            params: {
              id: item._id,
              orderIds: JSON.stringify([item._id]),
            },
          })
        }
      >
        <Text style={styles.viewDetailsButtonText}>Voir les détails</Text>
        <Ionicons name="chevron-forward" size={16} color="#272E64" />
      </TouchableOpacity>
    </View>
  )

  if (loading) {
    return (
      <View style={styles.container}>
        <CustomHeader />
        <View style={styles.header}>
          <Text style={styles.title}>Incidents</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#272E64" />
          <Text style={styles.loadingText}>Chargement des incidents...</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <CustomHeader />

      <View style={styles.header}>
        <Text style={styles.title}>Incidents</Text>
        <TouchableOpacity onPress={handleRefresh} disabled={refreshing}>
          <Ionicons name="refresh" size={24} color={refreshing ? "#ccc" : "#272E64"} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={ordersWithIncidents}
        renderItem={renderOrderItem}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={["#272E64"]} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-circle" size={50} color="#4CAF50" />
            <Text style={styles.emptyText}>Aucun incident en cours</Text>
            <Text style={styles.emptySubtext}>Toutes vos commandes sont en bon état</Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f8f8",
    paddingBottom: 100, // Espace pour la TabBar
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    color: "#666",
  },
  listContainer: {
    paddingVertical: 16,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    color: "#4CAF50",
    marginTop: 16,
    textAlign: "center",
    fontWeight: "600",
  },
  emptySubtext: {
    fontSize: 14,
    color: "#666",
    marginTop: 8,
    textAlign: "center",
  },
  orderCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    marginHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: "#F44336",
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  orderId: {
    fontSize: 16,
    fontWeight: "600",
    color: "#272E64",
  },
  incidentCount: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFEBEE",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  incidentCountText: {
    marginLeft: 4,
    fontSize: 12,
    color: "#F44336",
    fontWeight: "500",
  },
  orderDescription: {
    fontSize: 14,
    color: "#333",
    marginBottom: 12,
  },
  amountContainer: {
    backgroundColor: "#f5f5f5",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  amountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  amountLabel: {
    fontSize: 14,
    color: "#666",
  },
  totalValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#272E64",
  },
  clientInfo: {
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 12,
    marginBottom: 16,
  },
  clientName: {
    fontSize: 14,
    marginBottom: 4,
    color: "#333",
  },
  clientAddress: {
    fontSize: 14,
    marginBottom: 4,
    color: "#333",
  },
  clientPhone: {
    fontSize: 14,
    color: "#333",
  },
  incidentsContainer: {
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 12,
    marginBottom: 16,
  },
  incidentsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#F44336",
    marginBottom: 12,
  },
  incidentCard: {
    backgroundColor: "#FFEBEE",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#F44336",
  },
  incidentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "500",
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "500",
  },
  incidentType: {
    fontSize: 14,
    fontWeight: "600",
    color: "#D32F2F",
    marginBottom: 4,
  },
  incidentDescription: {
    fontSize: 13,
    color: "#333",
    marginBottom: 4,
  },
  customDescription: {
    fontSize: 12,
    color: "#666",
    fontStyle: "italic",
    marginBottom: 4,
  },
  incidentDate: {
    fontSize: 11,
    color: "#666",
    marginBottom: 8,
  },
  incidentActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  inProgressButton: {
    backgroundColor: "#FF9800",
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
  },
  viewDetailsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E3F2FD",
    padding: 12,
    borderRadius: 8,
  },
  viewDetailsButtonText: {
    color: "#272E64",
    fontWeight: "500",
    marginRight: 4,
  },
})

export default IncidentScreen
