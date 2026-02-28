import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import React from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { AntDesign, Entypo } from '@expo/vector-icons'


const Chatscreen = () => {
  return (
    <SafeAreaProvider style={s.area}>
       <View style={s.header}>
        <TouchableOpacity>
      <Text></Text>
         </TouchableOpacity>
        <Text style={s.headerTitle}>ChatBox</Text>
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
    color: '#313234',
    padding:8
  },
});

export default Chatscreen