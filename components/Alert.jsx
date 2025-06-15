// components/ui/Alert.jsx
import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

export const Alert = ({ children, variant = 'default', style }) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'destructive':
        return {
          backgroundColor: '#FEF2F2',
          borderColor: '#FCA5A5',
        }
      case 'warning':
        return {
          backgroundColor: '#FEF3C7',
          borderColor: '#FCD34D',
        }
      case 'success':
        return {
          backgroundColor: '#F0FDF4',
          borderColor: '#86EFAC',
        }
      default:
        return {
          backgroundColor: '#F8FAFC',
          borderColor: '#CBD5E1',
        }
    }
  }

  const getIconName = () => {
    switch (variant) {
      case 'destructive':
        return 'alert-circle'
      case 'warning':
        return 'warning'
      case 'success':
        return 'checkmark-circle'
      default:
        return 'information-circle'
    }
  }

  const getIconColor = () => {
    switch (variant) {
      case 'destructive':
        return '#EF4444'
      case 'warning':
        return '#F59E0B'
      case 'success':
        return '#10B981'
      default:
        return '#3B82F6'
    }
  }

  return (
    <View style={[styles.alert, getVariantStyles(), style]}>
      <Ionicons 
        name={getIconName()} 
        size={20} 
        color={getIconColor()} 
        style={styles.icon}
      />
      <View style={styles.content}>
        {children}
      </View>
    </View>
  )
}

export const AlertTitle = ({ children, style }) => (
  <Text style={[styles.title, style]}>{children}</Text>
)

export const AlertDescription = ({ children, style }) => (
  <Text style={[styles.description, style]}>{children}</Text>
)

const styles = StyleSheet.create({
  alert: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginVertical: 4,
  },
  icon: {
    marginRight: 8,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
})