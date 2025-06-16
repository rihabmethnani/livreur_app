import { View, Text, TouchableOpacity, StyleSheet } from "react-native"
import { AntDesign, Feather, Ionicons } from "@expo/vector-icons"

const TabBarButton = ({ onPress, isFocused, routeName, color, label }) => {
  const getIcon = () => {
    switch (routeName) {
      case "runsheet":
        return <AntDesign name="bars" size={24} color={color} />
      case "incident":
        return <Ionicons name="warning" size={24} color={color} />
      case "profile":
        return <Feather name="user" size={24} color={color} />
      default:
        return <AntDesign name="home" size={24} color={color} />
    }
  }

  const getLabel = () => {
    switch (routeName) {
      case "runsheet":
        return "Courses"
      case "incident":
        return "Incidents"
      case "profile":
        return "Profil"
      default:
        return label
    }
  }

  return (
    <TouchableOpacity onPress={onPress} style={[styles.tabbarItem, isFocused && styles.focusedTab]}>
      <View style={styles.iconContainer}>
        {getIcon()}
        {routeName === "incident" && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>!</Text>
          </View>
        )}
      </View>
      <Text style={[styles.label, { color }]}>{getLabel()}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  tabbarItem: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 8,
  },
  focusedTab: {
    backgroundColor: "rgba(254, 195, 39, 0.1)",
    borderRadius: 15,
  },
  iconContainer: {
    position: "relative",
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: "500",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#F44336",
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "bold",
  },
})

export default TabBarButton
