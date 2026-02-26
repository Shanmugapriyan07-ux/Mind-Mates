
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import images from '@/constants/images';
import  MaskedView  from '@react-native-masked-view/masked-view';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AntDesign from '@expo/vector-icons/AntDesign';


export default function WelcomeScreen() {
  return (
    <SafeAreaProvider style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <View style={s.container}>

        {/* ── YOUR LOGO HERE ──────────────────────────────────────────── */}
        {/* Replace source path with your actual logo file               */}
        <View style={s.logoBox}>
          <Image
            source={images.Welcome}
            style={s.logo}
            resizeMode="contain"
          />
        </View>

        {/* ── Title ───────────────────────────────────────────────────── */}
       <View>
                       <MaskedView 
                         maskElement={
                           <Text style={s.title}>MindMates</Text>
                         }
                       >
                         <LinearGradient
                           colors={['#7C3AED', '#A855F7', '#F59E0B']}
                           start={{ x: 0, y: 0 }}
                           end={{ x: 1, y: 0 }}
                         >
                           <Text style={[s.title, { opacity: 0 }]}>
                             MindMates
                           </Text>
                         </LinearGradient>
                       </MaskedView>
                     </View>
       

        {/* ── Subtitle ────────────────────────────────────────────────── */}
       

        {/* ── Get Started Button ──────────────────────────────────────── */}
        <TouchableOpacity
          style={s.btnOuter}
          onPress={() => router.push('/(auth)/Login')}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#7C3AED', '#A855F7']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.btn}
          >
            <Text style={s.btnText}>Get Started</Text>
          </LinearGradient>
         
        </TouchableOpacity>
         <Text style={s.subtitle}>
          Connect with your same skilled people and{'\n'}grow together.
        </Text>
         

        {/* ── Already have an account ─────────────────────────────────── */}
        

      </View>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({

  safe: {
    flex: 1,
    backgroundColor: '#fffff',
   
  },

  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  // ── Logo ──────────────────────────────────────────────────────────────
  logoBox: {
    marginBottom: 30,
    backgroundColor:'white',
    borderRadius:60,
   
     shadowColor: '#9d2de8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  logo: {
    width: 120,
    height: 120,
  },

  // ── Title ─────────────────────────────────────────────────────────────
  title: {
    textAlign: 'center',
    marginBottom: 350,
    letterSpacing: -0.4,
    top:-15,
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
  },

  // ── Subtitle ──────────────────────────────────────────────────────────
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 23,
    marginBottom: 40,
  },

  // ── Get Started button ────────────────────────────────────────────────
  btnOuter: {
    width: '100%',
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 20,
  },
  btn: {
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
 
  },

  // ── Login link ────────────────────────────────────────────────────────
  loginRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loginText: {
    fontSize: 14,
    color: '#6B7280',
  },
  loginLink: {
    fontSize: 14,
    fontWeight: '700',
    color: '#7C3AED',
  },

});

