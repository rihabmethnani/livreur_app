import { View, StyleSheet } from "react-native"
import TabBarButton from "./TabBarButton"

const TabBar = ({ state, descriptors, navigation }) => {
  const primaryColor = "#FEC327"
  const blueColor = "#272E64"

  // Ajouter 'incident' à la liste des onglets autorisés
  const allowedTabs = ["runsheet/index", "incident", "profile"]

  return (
    <View style={styles.tabbar}>
      {state.routes
        .filter((route) => allowedTabs.includes(route.name))
        .map((route, index) => {
          const { options } = descriptors[route.key]
          const label = options.tabBarLabel || options.title || route.name

          if (["_sitemap", "+not-found"].includes(route.name)) return null

          // Gérer le focus pour l'onglet incident
          const isFocused =
            state.index === index ||
            (route.name === "runsheet/index" &&
              (state.routes[state.index].name.startsWith("runsheet/") ||
                state.routes[state.index].name === "runsheet/index")) ||
            (route.name === "incident" && state.routes[state.index].name === "incident")

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            })

            if (!isFocused && !event.defaultPrevented) {
              if (route.name === "runsheet/index") {
                navigation.navigate("runsheet/index")
              } else if (route.name === "incident") {
                navigation.navigate("incident")
              } else {
                navigation.navigate(route.name)
              }
            }
          }

          return (
            <TabBarButton
              key={route.name}
              style={styles.tabbarItem}
              onPress={onPress}
              isFocused={isFocused}
              routeName={route.name.replace("/index", "")}
              color={isFocused ? primaryColor : blueColor}
              label={label}
            />
          )
        })}
    </View>
  )
}

const styles = StyleSheet.create({
  tabbar: {
    position: "absolute",
    bottom: 25,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "white",
    marginHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 25,
    borderCurve: "continuous",
    shadowColor: "black",
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 10,
    shadowOpacity: 0.1,
  },
})

export default TabBar
