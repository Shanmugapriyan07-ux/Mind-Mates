import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import React from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Entypo } from '@expo/vector-icons';
import { router } from 'expo-router';


const homeScreen = () => {
  return (
    <SafeAreaProvider style={s.area}>
      <View style={s.header}>
        <Text style={s.headerTitle}>MindMates</Text>
        <TouchableOpacity onPress={() => router.push('/subScreens/Settings')}>
          <Entypo name="dots-three-vertical" size={18} style={{color:'#232529'}} />
        </TouchableOpacity>
        </View>
     
    </SafeAreaProvider>
  )
}


const s = StyleSheet.create({
  area:{
    top:0,
    backgroundColor:'white'
  },
  safe: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
   header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#f3f5f6',
    borderBottomWidth: 1,
  
  },
  headerIcon: {
    fontSize: 22,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#7C3AED',
    padding:8,
  
    letterSpacing:0.15

  },
});


export default homeScreen;