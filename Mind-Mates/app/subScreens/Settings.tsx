
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button, Dialog, Portal, TextInput, Provider } from 'react-native-paper';
import { account } from '@/lib/appwrite';
import { useGlobalContext } from '@/lib/GlobalProvider';
import Toast from 'react-native-toast-message';
import { success } from 'zod';
import AntDesign from '@expo/vector-icons/AntDesign';

export default function Matchscreen() {
  const { user, refetch } = useGlobalContext();
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  // Dialog states
  const [logoutDialogVisible, setLogoutDialogVisible] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  // ─── SHOW/HIDE DIALOGS ─────────────────────────────────────────────────
  
  const showLogoutDialog = useCallback(() => {
    setLogoutDialogVisible(true);
  }, []);

  const hideLogoutDialog = useCallback(() => {
    setLogoutDialogVisible(false);
  }, []);

  const showDeleteDialog = useCallback(() => {
    setDeleteDialogVisible(true);
    setConfirmText('');
  }, []);

  const hideDeleteDialog = useCallback(() => {
    setDeleteDialogVisible(false);
    setConfirmText('');
  }, []);

  // ─── STANDARD LOGOUT ────────────────────────────────────────────────────

  const handleLogout = useCallback(async () => {
    setLogoutLoading(true);
    hideLogoutDialog();

    try {
      console.log('🔵 Starting logout...');

      // Step 1: Delete Appwrite session
      try {
        await account.deleteSession('current');
        console.log('✅ Appwrite session deleted');
      } catch (error) {
        console.warn('⚠️ Session deletion failed:', error);
      }

      // Step 2: Clear AsyncStorage
      await AsyncStorage.multiRemove([
        'userToken',
        'userId',
        'userName',
        'userEmail',
        'sessionId',
        'isLoggedIn',
        'loginProvider',
      ]);
      console.log('✅ AsyncStorage cleared');

      // Step 3: Update global state
      refetch();
      console.log('✅ Global state updated');

      // Step 4: Navigate to welcome
      router.replace('/(auth)/Welcome');
      console.log('✅ Navigated to Welcome');

    } catch (error) {
      console.error('❌ Logout error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to logout. Please try again.',
      });
    } finally {
      setLogoutLoading(false);
    }
  }, [refetch, hideLogoutDialog]);

  // ─── DELETE ACCOUNT ─────────────────────────────────────────────────────

  const handleDeleteAccount = useCallback(async () => {
    // Validate confirmation text
    if (confirmText.toLowerCase() !== 'delete') 
    {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please type "DELETE" to confirm',
      });
      return;
    }

    setDeleteLoading(true);
    hideDeleteDialog();

    try {
      console.log('🔴 Starting account deletion...');

      // Step 1: Get current user ID
      const userId = await AsyncStorage.getItem('userId');
      const userToken = await AsyncStorage.getItem('userToken');

      if (!userId) {
        throw new Error('User ID not found');
      }

      console.log('📝 Deleting user:', userId);

      // Step 2: Notify backend
      try {
        await fetch('http://10.0.2.2:8080/api/auth/delete-account', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({ userId }),
        });
        console.log('✅ Backend notified');
      } catch (error) {
        console.warn('⚠️ Backend deletion failed:', error);
      }

      // Step 3: Delete all Appwrite sessions
      try {
        await account.deleteSessions();
        console.log('✅ All sessions deleted');
      } catch (error) {
        console.warn('⚠️ Session deletion failed:', error);
      }

      // Step 4: Clear ALL AsyncStorage data
      await AsyncStorage.clear();
      console.log('✅ All local data cleared');

      // Step 5: Update global state
      refetch();
      console.log('✅ Global state reset');

      // Step 6: Navigate to welcome
      router.replace('/(auth)/Welcome');
      console.log('✅ Navigated to Welcome');

      // Show success message
      setTimeout(() => {
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Your account has been deleted.',
        });
      }, 500);

    } catch (error) {
      console.error('❌ Delete account error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to delete account. Please contact support.',
      });
    } finally {
      setDeleteLoading(false);
    }
  }, [confirmText, refetch, hideDeleteDialog]);

  // ─── CHECK IF CONFIRM TEXT IS VALID ─────────────────────────────────────

  const isDeleteConfirmed = confirmText.toLowerCase() === 'delete';

  // ─── RENDER ─────────────────────────────────────────────────────────────

  return (
    <Provider>
      <SafeAreaView style={s.safe}>
        <ScrollView contentContainerStyle={s.scroll}>
          
          {/* Header */}
          <View style={s.header}>
           <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
            <AntDesign name="arrow-left" size={24} color="black" />
           </TouchableOpacity> 
            <Text style={s.welcomeText}>Welcome,</Text>
            <Text style={s.userName}>{user?.name || 'User'}!</Text>
          </View>

          {/* Account Section */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Account Management</Text>

            {/* Standard Logout */}
            <TouchableOpacity
              onPress={showLogoutDialog}
              disabled={logoutLoading}
              style={[s.btn, s.btnPrimary]}
              activeOpacity={0.8}
            >
              {logoutLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={s.btnIcon}>🚪</Text>
                  <View style={s.btnTextContainer}>
                    <Text style={s.btnText}>Logout</Text>
                    <Text style={s.btnSubtext}>Sign out of your account</Text>
                  </View>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Danger Zone */}
          <View style={[s.section, s.dangerSection]}>
            <Text style={s.dangerTitle}>⚠️ Danger Zone</Text>

            {/* Delete Account */}
            <TouchableOpacity
              onPress={showDeleteDialog}
              disabled={deleteLoading}
              style={[s.btn, s.btnDanger]}
              activeOpacity={0.8}
            >
              {deleteLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={s.btnIcon}>🗑️</Text>
                  <View style={s.btnTextContainer}>
                    <Text style={s.btnText}>Delete Account</Text>
                    <Text style={s.btnSubtext}>Permanently remove your account</Text>
                  </View>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* User Info (Debug) */}
          <View style={s.debugSection}>
            <Text style={s.debugTitle}>Debug Info</Text>
            <Text style={s.debugText}>User ID: {user?.$id || 'N/A'}</Text>
            <Text style={s.debugText}>Email: {user?.email || 'N/A'}</Text>
            <Text style={s.debugText}>Name: {user?.name || 'N/A'}</Text>
          </View>

        </ScrollView>

        {/* ──────────────────────────────────────────────────────────────── */}
        {/* LOGOUT CONFIRMATION DIALOG */}
        {/* ──────────────────────────────────────────────────────────────── */}

        <Portal>
          <Dialog
            visible={logoutDialogVisible}
            onDismiss={hideLogoutDialog}
            style={s.dialog}
          >
            <Dialog.Icon icon="logout" size={48} color="#7C3AED" />
            
            <Dialog.Title style={s.dialogTitle}>Logout</Dialog.Title>
            
            <Dialog.Content>
              <Text style={s.dialogText}>
                Are you sure you want to logout? You can login again anytime.
              </Text>
            </Dialog.Content>

            <Dialog.Actions style={s.dialogActions}>
              <Button
                onPress={hideLogoutDialog}
                textColor="#6B7280"
                style={s.dialogBtn}
              >
                Cancel
              </Button>
              <Button
                onPress={handleLogout}
                mode="contained"
                buttonColor="#7C3AED"
                style={s.dialogBtn}
                loading={logoutLoading}
                disabled={logoutLoading}
              >
                Logout
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>

        {/* ──────────────────────────────────────────────────────────────── */}
        {/* DELETE ACCOUNT CONFIRMATION DIALOG */}
        {/* ──────────────────────────────────────────────────────────────── */}

        <Portal>
          <Dialog
            visible={deleteDialogVisible}
            onDismiss={hideDeleteDialog}
            style={s.dialog}
          >
            <Dialog.Icon icon="alert" size={48} color="#EF4444" />
            
            <Dialog.Title style={[s.dialogTitle, s.dialogTitleDanger]}>
              Delete Account Forever?
            </Dialog.Title>
            
            <Dialog.Content>
              <Text style={s.dialogText}>
                This action is <Text style={s.boldText}>permanent and irreversible</Text>.
                All your data will be permanently deleted.
              </Text>

              <Text style={[s.dialogText, s.confirmInstruction]}>
                Type <Text style={s.boldText}>DELETE</Text> to confirm:
              </Text>

              <TextInput
                mode="outlined"
                placeholder="Type DELETE here"
                value={confirmText}
                onChangeText={setConfirmText}
                autoCapitalize="characters"
                style={s.confirmInput}
                outlineColor="#E5E7EB"
                activeOutlineColor={isDeleteConfirmed ? '#EF4444' : '#7C3AED'}
                textColor="#111827"
                dense
              />

              {confirmText && !isDeleteConfirmed && (
                <Text style={s.errorText}>
                  ⚠️ Please type "DELETE" exactly
                </Text>
              )}

              {isDeleteConfirmed && (
                <Text style={s.successText}>
                  ✓ Confirmed
                </Text>
              )}
            </Dialog.Content>

            <Dialog.Actions style={s.dialogActions}>
              <Button
                onPress={hideDeleteDialog}
                textColor="#6B7280"
                style={s.dialogBtn}
              >
                Cancel
              </Button>
              <Button
                onPress={handleDeleteAccount}
                mode="contained"
                buttonColor="#EF4444"
                style={s.dialogBtn}
                disabled={!isDeleteConfirmed || deleteLoading}
                loading={deleteLoading}
              >
                Delete Forever
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>

      </SafeAreaView>
    </Provider>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 18,
    color: '#6B7280',
    marginBottom: 4,
  },
  userName: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111827',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  btnPrimary: {
    backgroundColor: '#7C3AED',
  },
  btnDanger: {
    backgroundColor: '#EF4444',
  },
  btnIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  btnTextContainer: {
    flex: 1,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  btnSubtext: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  dangerSection: {
    borderWidth: 2,
    borderColor: '#FEE2E2',
  },
  dangerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#EF4444',
    marginBottom: 12,
  },
  debugSection: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
    fontFamily: 'monospace',
  },

  // ─── DIALOG STYLES ──────────────────────────────────────────────────────

  dialog: {
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },
  dialogTitleDanger: {
    color: '#EF4444',
  },
  dialogText: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 12,
  },
  boldText: {
    fontWeight: '700',
    color: '#111827',
  },
  confirmInstruction: {
    marginTop: 16,
    marginBottom: 12,
  },
  confirmInput: {
    backgroundColor: '#FFFFFF',
    marginTop: 8,
  },
  errorText: {
    fontSize: 13,
    color: '#EF4444',
    marginTop: 8,
    textAlign: 'center',
  },
  successText: {
    fontSize: 13,
    color: '#10B981',
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '600',
  },
  dialogActions: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  dialogBtn: {
    marginLeft: 8,
  },
});