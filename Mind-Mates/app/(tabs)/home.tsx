import { View, Text, StyleSheet } from 'react-native'
import React from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context';


const homeScreen = () => {
  return (
    <SafeAreaProvider>
         <View style={s.header}>
             <Text style={s.headerTitle}>MindMates</Text>
             
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
    fontSize: 25,
    fontWeight: '500',
    color: '#6903e6',
    
  },
});


export default homeScreen;