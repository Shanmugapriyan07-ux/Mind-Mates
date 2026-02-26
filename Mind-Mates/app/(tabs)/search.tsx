import React, { useState } from 'react';
import { View, TextInput, StyleSheet,Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Searchbar } from 'react-native-paper';
import images from '@/constants/images';

 interface SearchBarProps {
  placeholder?: string;
  onSearch?: (text: string) => void;
}

export default function SearchBar({ placeholder, onSearch }: SearchBarProps) {
  const [query, setQuery] = useState('');

  return (
    <SafeAreaProvider style={s.full}>
      <View style={s.container}>
        {/* <Image source={images.Welcome} style={{width:40, height:40}} /> */}
        <Ionicons name="search" size={20} style={s.icon} />
        <TextInput
          style={s.input}
          placeholder = 'search'
        value={query}
        onChangeText={(text) => {
          setQuery(text);
          onSearch?.(text);
        }}
      />
    
      {query.length > 0 && (
        <Ionicons 
          name="close-circle" 
          size={20} 
          color="#1e1c1c"
          onPress={() => {
            setQuery('');
            onSearch?.('');
          }}
        />
      )}
    </View>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  full:{
    flex:1,
    backgroundColor:'#ffffff',

  },
  icon:{
    opacity:0.5,
    color:'#7300ff',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
 
    borderWidth: 1,
    borderColor: '#E5E7EB',
    opacity:0.3,
    elevation: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    gap: 8,
    marginTop:20,
    marginRight:11,
    marginLeft:10,
    shadowColor: '#000',
    shadowOffset: { width: 8, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
   
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  
  },
});