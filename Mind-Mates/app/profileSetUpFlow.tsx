// screens/ProfileSetupFlow.js
// Multi-step form container with progress indicator

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  
  StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import BasicInfo from './(profileSetUp)/BasicInfo';
import ProfileImage from './(profileSetUp)/ProfileImage';
import Matchscreen from './(profileSetUp)/SkillSelect';
import { useProfile } from '@/Contexts/profileContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const TOTAL_STEPS = 4;

const ProfileSetupFlow = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const { completeProfile } = useProfile();

  const goToNextStep = () => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const goToPreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    await completeProfile();
    router.replace('/DashboardScreen/profileScreen'); // Navigate to profile screen
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <BasicInfo onNext={goToNextStep} />;
      case 2:
        return <ProfileImage onNext={goToNextStep} onBack={goToPreviousStep} />;
      case 3:
        return <Matchscreen onNext={goToNextStep} onBack={goToPreviousStep} />;
      
      default:
        return <BasicInfo onNext={goToNextStep} />;
    }
  };

  return (
    <SafeAreaProvider style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header with progress */}
      <View style={s.header}>
        {/* Back button (hide on first step) */}
        {currentStep > 1 && (
          <TouchableOpacity onPress={goToPreviousStep} style={s.backBtn}>
            <Text style={s.backIcon}>←</Text>
          </TouchableOpacity>
        )}

        {/* Step indicator */}
        <View style={s.stepIndicator}>
          {[...Array(TOTAL_STEPS)].map((_, index) => (
            <View
              key={index}
              style={[
                s.stepDot,
                index + 1 <= currentStep ? s.stepDotActive : s.stepDotInactive,
              ]}
            />
          ))}
        </View>

        {/* Skip button (only on first 3 steps) */}
        {currentStep < TOTAL_STEPS && (
          <TouchableOpacity onPress={handleComplete} style={s.skipBtn}>
            <Text style={s.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Progress bar */}
      <View style={s.progressBarContainer}>
        <View style={s.progressBarBg}>
          <LinearGradient
            colors={['#7C3AED', '#A855F7', '#F59E0B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[s.progressBarFill, { width: `${(currentStep / TOTAL_STEPS) * 100}%` }]}
          />
        </View>
        <Text style={s.progressText}>Step {currentStep} of {TOTAL_STEPS}</Text>
      </View>

      {/* Current step content */}
      <View style={s.stepContent}>
        {renderStep()}
      </View>
    </SafeAreaProvider>
  );
};

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 24,
    color: '#111827',
  },
  stepIndicator: {
    flexDirection: 'row',
    gap: 8,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepDotActive: {
    backgroundColor: '#7C3AED',
  },
  stepDotInactive: {
    backgroundColor: '#E5E7EB',
  },
  skipBtn: {
    width: 60,
    alignItems: 'flex-end',
  },
  skipText: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '600',
  },
  progressBarContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '500',
  },
  stepContent: {
    flex: 1,
  },
});

export default ProfileSetupFlow;