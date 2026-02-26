import { View, Text, StyleSheet } from 'react-native'
import React from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'


const Chatscreen = () => {
  return (
    <SafeAreaProvider>
        <View style={s.header}>
            <Text style={s.headerTitle}>Chatbox</Text>
           
          </View>
          </SafeAreaProvider>
  )
}


const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
  },
  headerIcon: {
    fontSize: 22,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    padding:8
  },
});

export default Chatscreen