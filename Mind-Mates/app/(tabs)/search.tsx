import React, { useState } from 'react';
import { View, TextInput, StyleSheet,Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';


 interface SearchBarProps {
  placeholder?: string;
  onSearch?: (text: string) => void;
}

export default function SearchBar({ placeholder, onSearch }: SearchBarProps) {
  const [query, setQuery] = useState('');

  function setSearchQuery(text: string): void {
    throw new Error('Function not implemented.');
  }


  return (
    <SafeAreaProvider style={s.full}>
      <View style={s.searchWrap}>
                <Ionicons name="search" size={20} style={s.searchIcon} />
                <TextInput
                  style={s.searchInput}
                  placeholder="Search skills..."
                  placeholderTextColor="#bbb"
                  value={query}
                  onChangeText={(text: string) => setQuery(text)}
                  returnKeyType="search"
                  clearButtonMode="while-editing"
                  autoCorrect={false}
                
                />
             
      
    
      {query.length > 0 && (
        <Ionicons 
        name='close-circle-outline'
          size={20} 
          style ={s.iconn}
          color='#000'
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
    top:0

  },
  icon:{
    opacity:0.5,
    color:'#7300ff',
  },
  iconn:{
    marginRight:10
    
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 50,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 8,
    justifyContent: 'center',
    marginTop: 12,
    borderColor:'#E0E0E0',
    borderWidth:1,
    marginRight:16,
    marginLeft:16,
   
  
  },
  searchIcon: {
    fontSize: 18,
    marginLeft: 12,
    marginRight: 8,
    color:'#7a7373'
  },
  searchInput: {
    paddingVertical: 14,
    fontSize: 15,
    color: '#333',
    backgroundColor: '#fff',
    justifyContent: 'center',
    marginRight: 107,
  },

  
  
});