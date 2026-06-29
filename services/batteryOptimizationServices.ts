import { Alert, Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';


const KEY_BATTERY_PROMPTED = 'mm_battery_opt_prompted';

// OEM-specific settings deep links
// These open the exact screen where user can whitelist the app
const OEM_SETTINGS: Record<string, { action: string; label: string }> = {
  xiaomi: {
    action: 'com.miui.securitycenter',
    label:  'MIUI Security Center → Autostart → Enable MindMates',
  },
  redmi: {
    action: 'com.miui.securitycenter',
    label:  'MIUI Security Center → Autostart → Enable MindMates',
  },
  poco: {
    action: 'com.miui.securitycenter',
    label:  'Security Center → Autostart → Enable MindMates',
  },
  oppo: {
    action: 'com.coloros.safecenter',
    label:  'Phone Manager → Privacy Permissions → Startup Manager → Enable MindMates',
  },
  realme: {
    action: 'com.coloros.safecenter',
    label:  'Phone Manager → Autostart → Enable MindMates',
  },
  vivo: {
    action: 'com.vivo.permissionmanager',
    label:  'iManager → Background App Refresh → Enable MindMates',
  },
  oneplus: {
    action: 'com.oneplus.security',
    label:  'Battery → Battery Optimisation → MindMates → Don\'t Optimise',
  },
  samsung: {
    action: 'com.samsung.android.lool',  // Device Care
    label:  'Settings → Battery → Background Usage Limits → Never Sleeping Apps → Add MindMates',
  },
  huawei: {
    action: 'com.huawei.systemmanager',
    label:  'Phone Manager → App Launch → MindMates → Manage Manually → All Enabled',
  },
  honor: {
    action: 'com.huawei.systemmanager',
    label:  'Phone Manager → App Launch → MindMates → Manage Manually → All Enabled',
  },
};

class BatteryOptimizationService {
  private _manufacturer = '';

  async init(): Promise<void> {
    if (Platform.OS !== 'android') return;
    try {
      this._manufacturer = (Device.manufacturer ?? '').toLowerCase();
    } catch {
      this._manufacturer = '';
    }
  }

  /** Returns true if this device has known OEM battery restrictions */
  get hasOEMRestrictions(): boolean {
    return this._manufacturer in OEM_SETTINGS;
  }

  /** Returns OEM-specific instructions, or null if stock Android */
  get oemInstructions(): string | null {
    return OEM_SETTINGS[this._manufacturer]?.label ?? null;
  }

  /**
   * Show battery optimization guide on first launch.
   * Call this after notification permission is granted.
   * Only shows once — never nags the user.
   */
  async showGuideIfNeeded(): Promise<void> {
    if (!this.hasOEMRestrictions) return;

    const alreadyPrompted = await AsyncStorage.getItem(KEY_BATTERY_PROMPTED);
    if (alreadyPrompted) return;

    await AsyncStorage.setItem(KEY_BATTERY_PROMPTED, '1');

    const instructions = this.oemInstructions!;
    const brand        = this._manufacturer.charAt(0).toUpperCase() + this._manufacturer.slice(1);

    Alert.alert(
      '📱 Enable Notifications',
      `To receive notifications on ${brand} devices, you need to enable background activity:\n\n${instructions}\n\nThis ensures you never miss a message.`,
      [
        { text: 'Do It Later', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => this._openOEMSettings(),
        },
      ],
      { cancelable: true },
    );
  }

  
  
  private async _openOEMSettings(): Promise<void> {
    const pkg = OEM_SETTINGS[this._manufacturer]?.action;
    if (!pkg) return;

    // Try the OEM-specific package first
    const oemUrl = `intent://#Intent;package=${pkg};end`;
    const canOpen = await Linking.canOpenURL(oemUrl).catch(() => false);

    if (canOpen) {
      await Linking.openURL(oemUrl).catch(() => this._openAndroidSettings());
    } else {
      // Fall back to general Android battery optimization settings
      await this._openAndroidSettings();
    }
  }

  private async _openAndroidSettings(): Promise<void> {
    // Android standard battery optimization settings
    await Linking.openSettings().catch(() => {});
  }
  async showGuide(): Promise<void> {
    if (!this.hasOEMRestrictions) {
      Alert.alert(
        '✅ Notifications Ready',
        'Your device supports notifications out of the box. No extra steps needed!',
        [{ text: 'OK' }],
      );
      return;
    }
    await AsyncStorage.removeItem(KEY_BATTERY_PROMPTED);
    await this.showGuideIfNeeded();
  }
}

export const batteryOptimizationService = new BatteryOptimizationService();