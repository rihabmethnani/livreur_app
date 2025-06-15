import React from 'react';
import { Slot } from 'expo-router';
import { ApolloProvider } from '@apollo/client';
import client from './api/apolloClient';
import { AuthProvider } from './context/AuthContext';

export default function Layout() {
  return (
    <ApolloProvider client={client}>
      <AuthProvider>
        <Slot />
      </AuthProvider>
    </ApolloProvider>
  );
}