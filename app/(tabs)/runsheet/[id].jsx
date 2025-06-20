"use client"

import { useState, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  TextInput,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { gql, useMutation, useApolloClient } from "@apollo/client"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useAuth } from "../../context/AuthContext"
import CustomHeader from "../../../components/CustomHeader"


// Queries (identiques à la version précédente)
const GET_COURSE_DETAILS = gql`
  query CoursesByDriverId($driverId: String!) {
    coursesByDriverId(driverId: $driverId) {
      _id
      orderIds
      createdAt
      status
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
      fraisLivraison
      clientId
      driverId
      partnerId
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
    }
  }
`

const GET_INCIDENTS_BY_ORDER = gql`
  query GetIncidentsByOrderId($orderId: String!) {
    getIncidentsByOrderId(orderId: $orderId) {
      _id
      status
      orderId
    }
  }
`

// Mutations
const UPDATE_ORDER_STATUS = gql`
  mutation UpdateOrderStatus($orderId: String!, $status: OrderStatus!) {
    updateOrderStatus(orderId: $orderId, status: $status) {
      _id
      status
    }
  }
`

const CREATE_INCIDENT = gql`
  mutation CreateIncident($input: CreateIncidentInput!) {
    createIncident(input: $input) {
      _id
      orderId
      partnerId
      reportedBy
      incidentType
      description
      customDescription
      priority
      status
      createdAt
    }
  }
`

// Énumérations (identiques à la version précédente)
const INCIDENT_TYPES = {
  DAMAGED_PACKAGE: "Colis Endommagé",
  INCORRECT_ADDRESS: "Adresse Incorrecte",
  CUSTOMER_NOT_FOUND: "Client Introuvable",
  LOST_PACKAGE: "Colis Perdu",
  WEATHER_DELAY: "Retard Météorologique",
  TRAFFIC_DELAY: "Retard de Circulation",
  REFUSED_PACKAGE: "Colis Refusé",
  OTHER: "Autre",
}

const INCIDENT_PRIORITIES = {
  LOW: "Faible",
  MEDIUM: "Moyenne",
  HIGH: "Élevée",
  CRITICAL: "Critique",
}

const ORDER_STATUS = {
  EN_LIVRAISON: "EN_LIVRAISON",
  LIVRE: "LIVRE",
  RELANCE: "RELANCE",
}

const RunsheetDetailsScreen = () => {
  const { id, orderIds: orderIdsParam } = useLocalSearchParams()
  const { user } = useAuth()
  const router = useRouter()
  const client = useApolloClient()

  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [selectedIncidentType, setSelectedIncidentType] = useState(null)
  const [selectedPriority, setSelectedPriority] = useState("MEDIUM")
  const [customDescription, setCustomDescription] = useState("")
  const [incidentDescription, setIncidentDescription] = useState("")
  const [creatingIncident, setCreatingIncident] = useState(false)

  // Mutations
  const [updateOrderStatus] = useMutation(UPDATE_ORDER_STATUS, {
    context: { serviceName: "order-service" },
  })

  const [createIncident] = useMutation(CREATE_INCIDENT, {
    context: { serviceName: "order-service" },
  })

  // Charger les détails de la course et ses commandes (code identique à la version précédente)
  useEffect(() => {
    const loadCourseDetails = async () => {
      if (!id) {
        console.log("No course ID provided")
        setError(new Error("ID de course manquant"))
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)
        console.log("Loading course details for ID:", id)

        let orderIds = []

        if (orderIdsParam) {
          try {
            if (typeof orderIdsParam === "string") {
              orderIds = JSON.parse(orderIdsParam)
            } else if (Array.isArray(orderIdsParam)) {
              orderIds = orderIdsParam
            }
          } catch (parseError) {
            console.error("Error parsing orderIds:", parseError)

            if (user?._id) {
              const courseRes = await client.query({
                query: GET_COURSE_DETAILS,
                variables: { driverId: user._id },
                context: { serviceName: "order-service" },
                fetchPolicy: "network-only",
              })

              const course = courseRes.data?.coursesByDriverId?.find((c) => c._id === id)
              if (course) {
                orderIds = course.orderIds
                console.log("Retrieved orderIds from course:", orderIds)
              }
            }
          }
        }

        if (!orderIds || orderIds.length === 0) {
          console.log("No orderIds found")
          setOrders([])
          setLoading(false)
          return
        }

        console.log("Loading orders for IDs:", orderIds)

        const ordersPromises = orderIds.map(async (orderId) => {
          try {
            console.log(`Loading order: ${orderId}`)

            const orderRes = await client.query({
              query: GET_ORDER,
              variables: { id: orderId },
              context: { serviceName: "order-service" },
              fetchPolicy: "network-only",
            })

            if (!orderRes.data?.order) {
              console.log(`No order data for ${orderId}`)
              return null
            }

            const order = orderRes.data.order
            if (order.driverId !== user?._id) {
              console.warn(`User ${user?._id} is not the driver for order ${orderId}`)
            }

            let clientData = null
            try {
              const clientRes = await client.query({
                query: GET_CLIENT_ADDRESS,
                variables: { id: order.clientId },
                context: { serviceName: "user-service" },
                fetchPolicy: "network-only",
              })
              clientData = clientRes.data?.getUserById
            } catch (clientError) {
              console.error(`Error loading client for order ${orderId}:`, clientError)
            }

            const deliveryFee = order.fraisLivraison || 10
            const orderAmount = Number.parseFloat(order.amount) || 0
            const totalAmount = orderAmount + deliveryFee

            // Après avoir récupéré les détails de la commande et avant de retourner l'objet
            // Vérifier s'il y a des incidents pour cette commande
            let hasActiveIncident = false
            try {
              const incidentsRes = await client.query({
                query: GET_INCIDENTS_BY_ORDER,
                variables: { orderId },
                context: { serviceName: "order-service" },
                fetchPolicy: "network-only",
              })

              // Vérifier s'il y a des incidents en attente de résolution
              const activeIncidents = incidentsRes.data?.getIncidentsByOrderId?.filter(
                (incident) => incident.status === "EN_ATTENTE_RESOLUTION",
              )

              hasActiveIncident = activeIncidents && activeIncidents.length > 0
            } catch (incidentError) {
              console.error(`Error checking incidents for order ${orderId}:`, incidentError)
            }

            // Si la commande a un incident actif, ne pas l'inclure dans cette liste
            if (hasActiveIncident) {
              return null
            }

            return {
              ...order,
              client: clientData,
              deliveryFee,
              totalAmount,
              hasActiveIncident, // Ajouter cette propriété
            }
          } catch (orderError) {
            console.error(`Error loading order ${orderId}:`, orderError)
            return null
          }
        })

        const ordersWithDetails = await Promise.all(ordersPromises)
        const validOrders = ordersWithDetails.filter(Boolean)

        console.log("Valid orders loaded:", validOrders.length)
        setOrders(validOrders)
      } catch (err) {
        console.error("Error loading course details:", err)
        setError(err)
      } finally {
        setLoading(false)
      }
    }

    loadCourseDetails()
  }, [id, orderIdsParam, user, client])

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      const order = orders.find((o) => o._id === orderId)
      if (!order) {
        Alert.alert("Erreur", "Commande introuvable")
        return
      }

      if (order.driverId !== user?._id) {
        Alert.alert("Non autorisé", "Vous ne pouvez modifier que vos propres commandes assignées.")
        return
      }

      if (!Object.values(ORDER_STATUS).includes(newStatus)) {
        Alert.alert("Erreur", `Statut invalide: ${newStatus}`)
        return
      }

      await updateOrderStatus({
        variables: {
          orderId: orderId,
          status: newStatus,
        },
      })

      setOrders((prevOrders) =>
        prevOrders.map((order) => (order._id === orderId ? { ...order, status: newStatus } : order)),
      )

      Alert.alert("Succès", "Statut mis à jour avec succès")
    } catch (error) {
      console.error("Status update error:", error)
      Alert.alert("Erreur", "Impossible de mettre à jour le statut")
    }
  }

  const handleIncident = (order) => {
    if (order.driverId !== user?._id) {
      Alert.alert("Non autorisé", "Vous ne pouvez signaler des incidents que pour vos propres commandes.")
      return
    }

    setSelectedOrder(order)
    setSelectedIncidentType(null)
    setSelectedPriority("MEDIUM")
    setCustomDescription("")
    setIncidentDescription("")
    setModalVisible(true)
  }

  const handleCreateIncident = async () => {
    if (!selectedOrder || !selectedIncidentType) {
      Alert.alert("Erreur", "Veuillez sélectionner un type d'incident")
      return
    }

    if (!incidentDescription.trim()) {
      Alert.alert("Erreur", "Veuillez fournir une description de l'incident")
      return
    }

    if (selectedIncidentType === "OTHER" && !customDescription.trim()) {
      Alert.alert("Erreur", "Veuillez fournir une description personnalisée pour le type 'Autre'")
      return
    }

    try {
      setCreatingIncident(true)

      const incidentInput = {
        orderId: selectedOrder._id,
        partnerId: selectedOrder.partnerId,
        incidentType: selectedIncidentType,
        description: incidentDescription.trim(),
        priority: selectedPriority,
      }

      if (selectedIncidentType === "OTHER" && customDescription.trim()) {
        incidentInput.customDescription = customDescription.trim()
      }

      console.log("Creating incident with input:", incidentInput)

      const result = await createIncident({
        variables: {
          input: incidentInput,
        },
      })

      console.log("Incident created successfully:", result.data)

      // Supprimer la commande de la liste actuelle après création de l'incident
      setOrders((prevOrders) => prevOrders.filter((order) => order._id !== selectedOrder._id))

      Alert.alert(
        "Incident créé",
        "L'incident a été enregistré avec succès. La commande a été déplacée vers l'onglet Incidents.",
        [
          {
            text: "Voir les incidents",
            onPress: () => {
              setModalVisible(false)
              resetIncidentForm()
              // Naviguer vers l'onglet incidents
              router.push("/(tabs)/incident")
            },
          },
          {
            text: "OK",
            onPress: () => {
              setModalVisible(false)
              resetIncidentForm()
            },
          },
        ],
      )
    } catch (error) {
      console.error("Create incident error:", error)

      let errorMessage = "Impossible de créer l'incident"

      if (error.message.includes("not found")) {
        errorMessage = "Commande introuvable. Veuillez réessayer."
      } else if (error.message.includes("validation")) {
        errorMessage = "Données invalides. Vérifiez les informations saisies."
      } else if (error.message.includes("Order ID is required")) {
        errorMessage = "ID de commande requis."
      } else if (error.message.includes("User not found")) {
        errorMessage = "Utilisateur non trouvé. Veuillez vous reconnecter."
      } else if (error.networkError) {
        errorMessage = "Erreur de connexion. Vérifiez votre internet."
      } else if (error.graphQLErrors && error.graphQLErrors.length > 0) {
        errorMessage = error.graphQLErrors[0].message
      }

      Alert.alert("Erreur", errorMessage)
    } finally {
      setCreatingIncident(false)
    }
  }

  const resetIncidentForm = () => {
    setSelectedIncidentType(null)
    setSelectedPriority("MEDIUM")
    setCustomDescription("")
    setIncidentDescription("")
    setCreatingIncident(false)
  }

  const handleRetry = () => {
    setError(null)
    setLoading(true)
  }

  // Le reste du code (renderOrderItem, styles, etc.) reste identique à la version précédente
  const renderOrderItem = ({ item }) => {
    // Remplacer la ligne existante
    // const canModify = item.driverId === user?._id

    // Par cette nouvelle logique
    const canModify = item.driverId === user?._id && !item.hasActiveIncident

    return (
      <View style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <Text style={styles.orderId}>Commande #{item._id.slice(-6)}</Text>
          <View style={[styles.statusBadge, getStatusBadgeStyle(item.status)]}>
            <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
          </View>
        </View>

        {!canModify && (
          <View style={styles.warningBanner}>
            <Ionicons name="warning" size={16} color="#FF9800" />
            <Text style={styles.warningText}>Cette commande n'est pas assignée à vous</Text>
          </View>
        )}

        <Text style={styles.orderDescription}>{item.description}</Text>

        <View style={styles.amountContainer}>
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Montant commande:</Text>
            <Text style={styles.amountValue}>{item.amount} DH</Text>
          </View>
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Frais de livraison:</Text>
            <Text style={styles.amountValue}>{item.deliveryFee} DH</Text>
          </View>
          <View style={[styles.amountRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total:</Text>
            <Text style={styles.totalValue}>{item.totalAmount} DH</Text>
          </View>
        </View>

        <Text style={styles.dateText}>Créée le: {new Date(item.createdAt).toLocaleString("fr-FR")}</Text>

        {item.client && (
          <View style={styles.clientInfo}>
            <Text style={styles.sectionTitle}>Informations client:</Text>
            <Text style={styles.clientName}>👤 {item.client.name}</Text>
            <Text style={styles.clientAddress}>📍 {item.client.address}</Text>
            <Text style={styles.clientPhone}>📞 {item.client.phone}</Text>
          </View>
        )}

        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.statusButton, styles.deliveredButton, !canModify && styles.disabledButton]}
            onPress={() => handleStatusUpdate(item._id, ORDER_STATUS.LIVRE)}
            disabled={!canModify}
          >
            <Ionicons name="checkmark-circle" size={16} color="#fff" />
            <Text style={styles.buttonText}>Livré</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statusButton, styles.outForDeliveryButton, !canModify && styles.disabledButton]}
            onPress={() => handleStatusUpdate(item._id, ORDER_STATUS.EN_LIVRAISON)}
            disabled={!canModify}
          >
            <Ionicons name="car" size={16} color="#fff" />
            <Text style={styles.buttonText}>En livraison</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statusButton, styles.relanceButton, !canModify && styles.disabledButton]}
            onPress={() => handleStatusUpdate(item._id, ORDER_STATUS.RELANCE)}
            disabled={!canModify}
          >
            <Ionicons name="refresh" size={16} color="#fff" />
            <Text style={styles.buttonText}>Relance</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statusButton, styles.incidentButton, !canModify && styles.disabledButton]}
            onPress={() => handleIncident(item)}
            disabled={!canModify}
          >
            <Ionicons name="warning" size={16} color="#fff" />
            <Text style={styles.buttonText}>Incident</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case "LIVRE":
        return { backgroundColor: "#4CAF50" }
      case "EN_LIVRAISON":
        return { backgroundColor: "#2196F3" }
      case "RELANCE":
        return { backgroundColor: "#FF9800" }
      case "ÉCHEC_LIVRAISON":
        return { backgroundColor: "#F44336" }
      case "ATTRIBUÉ":
        return { backgroundColor: "#9C27B0" }
      default:
        return { backgroundColor: "#666" }
    }
  }

  const getStatusText = (status) => {
    switch (status) {
      case "LIVRE":
        return "Livré"
      case "EN_LIVRAISON":
        return "En livraison"
      case "RELANCE":
        return "Relance"
      case "ÉCHEC_LIVRAISON":
        return "Échec"
      case "ATTRIBUÉ":
        return "Attribué"
      default:
        return status || "En attente"
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <CustomHeader />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#272E64" />
          <Text style={styles.loadingText}>Chargement des détails...</Text>
        </View>
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.container}>
        <CustomHeader />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#272E64" />
          </TouchableOpacity>
          <Text style={styles.title}>Course #{id?.slice(-6) || "N/A"}</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={50} color="#F44336" />
          <Text style={styles.errorText}>Erreur de chargement</Text>
          <Text style={styles.errorSubtext}>{error.message || "Une erreur est survenue lors du chargement"}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
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
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#272E64" />
        </TouchableOpacity>
        <Text style={styles.title}>Course #{id?.slice(-6) || "N/A"}</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={orders}
        renderItem={renderOrderItem}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-circle" size={50} color="#4CAF50" />
            <Text style={styles.emptyText}>Toutes les commandes sont traitées</Text>
            <Text style={styles.emptySubtext}>
              Les commandes avec incidents ont été déplacées vers l'onglet Incidents
            </Text>
          </View>
        }
      />

      {/* Modal pour créer un incident - identique à la version précédente */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => {
          if (!creatingIncident) {
            setModalVisible(false)
            resetIncidentForm()
          }
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Signaler un incident</Text>
            <Text style={styles.modalSubtitle}>Commande #{selectedOrder?._id.slice(-6)}</Text>

            <ScrollView style={styles.optionsContainer}>
              <Text style={styles.sectionLabel}>Type d'incident: *</Text>
              {Object.entries(INCIDENT_TYPES).map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.incidentOption, selectedIncidentType === key && styles.selectedOption]}
                  onPress={() => setSelectedIncidentType(key)}
                  disabled={creatingIncident}
                >
                  <Text style={[styles.optionText, selectedIncidentType === key && styles.selectedOptionText]}>
                    {label}
                  </Text>
                  {selectedIncidentType === key && <Ionicons name="checkmark-circle" size={20} color="#272E64" />}
                </TouchableOpacity>
              ))}

              {selectedIncidentType === "OTHER" && (
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Description personnalisée: *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={customDescription}
                    onChangeText={setCustomDescription}
                    placeholder="Décrivez le type d'incident..."
                    multiline
                    numberOfLines={2}
                    editable={!creatingIncident}
                  />
                </View>
              )}

              <Text style={styles.sectionLabel}>Priorité:</Text>
              {Object.entries(INCIDENT_PRIORITIES).map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.incidentOption, selectedPriority === key && styles.selectedOption]}
                  onPress={() => setSelectedPriority(key)}
                  disabled={creatingIncident}
                >
                  <Text style={[styles.optionText, selectedPriority === key && styles.selectedOptionText]}>
                    {label}
                  </Text>
                  {selectedPriority === key && <Ionicons name="checkmark-circle" size={20} color="#272E64" />}
                </TouchableOpacity>
              ))}

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Description détaillée: *</Text>
                <TextInput
                  style={[styles.textInput, styles.textAreaInput]}
                  value={incidentDescription}
                  onChangeText={setIncidentDescription}
                  placeholder="Décrivez en détail ce qui s'est passé..."
                  multiline
                  numberOfLines={4}
                  editable={!creatingIncident}
                />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  (!selectedIncidentType ||
                    !incidentDescription.trim() ||
                    (selectedIncidentType === "OTHER" && !customDescription.trim()) ||
                    creatingIncident) &&
                    styles.disabledConfirmButton,
                ]}
                onPress={handleCreateIncident}
                disabled={
                  !selectedIncidentType ||
                  !incidentDescription.trim() ||
                  (selectedIncidentType === "OTHER" && !customDescription.trim()) ||
                  creatingIncident
                }
              >
                {creatingIncident ? (
                  <View style={styles.loadingButtonContent}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.confirmButtonText}>Création...</Text>
                  </View>
                ) : (
                  <Text style={styles.confirmButtonText}>Créer l'incident</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.cancelButton, creatingIncident && styles.disabledButton]}
                onPress={() => {
                  if (!creatingIncident) {
                    setModalVisible(false)
                    resetIncidentForm()
                  }
                }}
                disabled={creatingIncident}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

// Styles identiques à la version précédente
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f8f8",
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
    textAlign: "center",
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
    fontSize: 18,
    fontWeight: "bold",
    color: "#272E64",
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
    fontSize: 16,
    color: "#4CAF50",
    marginTop: 16,
    textAlign: "center",
    fontWeight: "600",
  },
  emptySubtext: {
    fontSize: 12,
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
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF3E0",
    padding: 8,
    borderRadius: 6,
    marginBottom: 12,
  },
  warningText: {
    marginLeft: 8,
    fontSize: 12,
    color: "#FF9800",
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
    marginBottom: 4,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: "#ddd",
    paddingTop: 8,
    marginTop: 4,
  },
  amountLabel: {
    fontSize: 14,
    color: "#666",
  },
  amountValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#272E64",
  },
  totalValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#272E64",
  },
  dateText: {
    fontSize: 12,
    color: "#666",
    marginBottom: 12,
  },
  clientInfo: {
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#272E64",
    marginBottom: 8,
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
  actionsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    flexWrap: "wrap",
  },
  statusButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    borderRadius: 8,
    marginHorizontal: 1,
    marginVertical: 2,
    minWidth: "23%",
  },
  deliveredButton: {
    backgroundColor: "#4CAF50",
  },
  outForDeliveryButton: {
    backgroundColor: "#2196F3",
  },
  relanceButton: {
    backgroundColor: "#FF9800",
  },
  incidentButton: {
    backgroundColor: "#F44336",
  },
  disabledButton: {
    backgroundColor: "#ccc",
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "500",
    marginLeft: 4,
    fontSize: 11,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    width: "90%",
    maxHeight: "85%",
    backgroundColor: "white",
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
    color: "#272E64",
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
  },
  optionsContainer: {
    maxHeight: 400,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#272E64",
    marginBottom: 10,
    marginTop: 10,
  },
  incidentOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedOption: {
    borderColor: "#272E64",
    backgroundColor: "#f0f0ff",
  },
  optionText: {
    fontSize: 14,
    color: "#333",
    flex: 1,
  },
  selectedOptionText: {
    color: "#272E64",
    fontWeight: "500",
  },
  inputContainer: {
    marginVertical: 10,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#272E64",
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: "#fff",
  },
  textAreaInput: {
    height: 80,
    textAlignVertical: "top",
  },
  modalActions: {
    marginTop: 20,
  },
  confirmButton: {
    backgroundColor: "#272E64",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 10,
  },
  disabledConfirmButton: {
    backgroundColor: "#ccc",
    opacity: 0.6,
  },
  confirmButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  loadingButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cancelButton: {
    backgroundColor: "#ccc",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#333",
    fontWeight: "500",
  },
})

export default RunsheetDetailsScreen
