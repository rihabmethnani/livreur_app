import { ApolloClient, InMemoryCache, createHttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configuration des services
const SERVICES = {
  'user-service': 'http://192.168.1.102:4000/graphql',
  'order-service':'http://192.168.1.102:3001/graphql'
};

// Link pour router les requêtes vers le bon service
const httpLink = createHttpLink({
  uri: ({ getContext }) => {
    const { serviceName } = getContext();
    return SERVICES[serviceName] || SERVICES['user-service'];
  }
});

// Link d'authentification
const authLink = setContext(async (_, { headers, ...context }) => {
  const token = await AsyncStorage.getItem('@token');
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
    ...context
  };
});

// Client Apollo unifié
const client = new ApolloClient({
  link: from([authLink, httpLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      errorPolicy: 'all',
    },
    query: {
      errorPolicy: 'all',
    },
  },
});

export default client;