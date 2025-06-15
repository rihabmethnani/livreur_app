import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const ErrorMessage = ({ message }) => {
  if (!message) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 10,
    backgroundColor: '#ffe6e6',
    borderRadius: 5,
    marginVertical: 8,
  },
  text: {
    color: '#cc0000',
    fontSize: 14,
  },
});

export default ErrorMessage;
