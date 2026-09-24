import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
} from 'react-native';
import { User, LogIn, UserPlus, LogOut, Settings, Shield, Disc, Check } from 'lucide-react-native';
import { useUser } from '../context/UserContext';
import { useToast } from '../context/ToastContext';
import { colors } from '../theme/colors';
import { FULL_VERSION } from '../version';
import CassetteTag from '../ui/CassetteTag';

export default function ProfileScreen({ onOpenSettings }) {
  const { currentUser, login, register, logout } = useUser();
  const { showToast } = useToast();

  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmitAuth = async () => {
    if (!email.trim() || !password.trim()) {
      showToast('Please fill in email and password', 'warning');
      return;
    }
    if (isRegisterMode && !name.trim()) {
      showToast('Please enter your name', 'warning');
      return;
    }

    setLoading(true);
    try {
      if (isRegisterMode) {
        await register(name.trim(), email.trim(), password.trim());
        showToast('Account registered successfully!', 'success');
      } else {
        await login(email.trim(), password.trim());
        showToast('Welcome back to Rivo!', 'success');
      }
      setEmail('');
      setPassword('');
      setName('');
    } catch (err) {
      showToast(err.message || 'Authentication error', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>CITIZEN DOSSIER</Text>
          <Text style={styles.headerSub}>RIVO USER IDENTITY & PROTOCOLS</Text>
        </View>
        <TouchableOpacity style={styles.settingsBtn} onPress={onOpenSettings}>
          <Settings size={18} color={colors.ink} />
        </TouchableOpacity>
      </View>

      {currentUser ? (
        /* Logged In Citizen Card */
        <View style={styles.citizenOuter}>
          <View style={styles.citizenShadow} />
          <View style={styles.citizenCard}>
            <View style={styles.cardHeader}>
              <CassetteTag label="REGISTERED CITIZEN" bg={colors.ink} textColor={colors.mint} />
              <View style={styles.activePill}>
                <View style={styles.greenDot} />
                <Text style={styles.activePillText}>AUTHENTICATED</Text>
              </View>
            </View>

            <View style={styles.profileHero}>
              <View style={styles.avatarBox}>
                <Disc size={36} color={colors.mint} />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.citizenName}>{currentUser.name || 'Anonymous Citizen'}</Text>
                <Text style={styles.citizenEmail}>{currentUser.email}</Text>
                <Text style={styles.citizenRole}>
                  ROLE: {currentUser.role?.toUpperCase() || 'STANDARD LISTENER'}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.settingsCardBtn} onPress={onOpenSettings}>
                <Settings size={16} color={colors.ink} />
                <Text style={styles.settingsCardBtnText}>OPEN ENGINE SETTINGS</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
                <LogOut size={16} color={colors.rust} />
                <Text style={styles.logoutBtnText}>DISENGAGE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        /* Guest / Login / Register Form */
        <View style={styles.authOuter}>
          <View style={styles.authShadow} />
          <View style={styles.authCard}>
            <View style={styles.authHeader}>
              <CassetteTag
                label={isRegisterMode ? 'NEW CITIZEN REGISTRATION' : 'CITIZEN ACCESS PROTOCOL'}
                bg={colors.ink}
                textColor={colors.tealLight}
              />
              <Text style={styles.authTitle}>
                {isRegisterMode ? 'CREATE CITIZEN ID' : 'ENTER SOUND LAB'}
              </Text>
              <Text style={styles.authDesc}>
                Synchronize your playlists, likes, and customized listening profile across devices.
              </Text>
            </View>

            {isRegisterMode && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>CITIZEN NAME</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Karim Tarek"
                  placeholderTextColor={colors.grayText}
                  value={name}
                  onChangeText={setName}
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>EMAIL MATRIX</Text>
              <TextInput
                style={styles.input}
                placeholder="name@domain.com"
                placeholderTextColor={colors.grayText}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>ACCESS KEY / PASSWORD</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={colors.grayText}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleSubmitAuth}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.ink} />
              ) : (
                <>
                  {isRegisterMode ? (
                    <UserPlus size={16} color={colors.ink} strokeWidth={2.5} />
                  ) : (
                    <LogIn size={16} color={colors.ink} strokeWidth={2.5} />
                  )}
                  <Text style={styles.submitBtnText}>
                    {isRegisterMode ? 'REGISTER CITIZEN' : 'ENGAGE SESSION'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toggleAuthModeBtn}
              onPress={() => setIsRegisterMode(!isRegisterMode)}
            >
              <Text style={styles.toggleAuthText}>
                {isRegisterMode
                  ? 'Already have an account? Sign in here'
                  : 'New listener? Create your citizen ID'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* App Version Card */}
      <View style={{ marginTop: 10, padding: 14, backgroundColor: '#141d1b', borderRadius: 10, borderWidth: 1, borderColor: '#1e332f', alignItems: 'center' }}>
        <Text style={{ fontFamily: 'monospace', fontWeight: '900', fontSize: 12, color: colors.mint, letterSpacing: 0.5 }}>
          RIVO {FULL_VERSION}
        </Text>
        <Text style={{ fontFamily: 'monospace', fontSize: 9.5, color: '#94a3b8', marginTop: 3 }}>
          Audio Analgesics & Sonic Relief • Official Build
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  content: {
    padding: 14,
    paddingBottom: 110,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: colors.deepForest,
    paddingBottom: 10,
  },
  headerTitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 18,
    color: colors.paper,
    letterSpacing: 0.5,
  },
  headerSub: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '800',
    color: colors.mint,
    marginTop: 2,
  },
  settingsBtn: {
    padding: 8,
    backgroundColor: colors.mint,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
  },
  citizenOuter: {
    position: 'relative',
    marginBottom: 20,
  },
  citizenShadow: {
    position: 'absolute',
    top: 5,
    left: 5,
    right: -5,
    bottom: -5,
    backgroundColor: colors.tealDark,
    borderRadius: 12,
  },
  citizenCard: {
    backgroundColor: colors.surfaceDark,
    borderWidth: 2.5,
    borderColor: colors.ink,
    borderRadius: 12,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a3622',
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    gap: 5,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.mint,
  },
  activePillText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 9,
    color: colors.mint,
  },
  profileHero: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBox: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: colors.deepForest,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  citizenName: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 18,
    color: colors.paper,
  },
  citizenEmail: {
    fontSize: 12,
    color: colors.paperMuted,
    marginTop: 2,
  },
  citizenRole: {
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 10,
    color: colors.tealLight,
    marginTop: 4,
  },
  divider: {
    height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 14,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  settingsCardBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paper,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingVertical: 10,
    gap: 6,
  },
  settingsCardBtnText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 10,
    color: colors.ink,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b1818',
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  logoutBtnText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 10,
    color: colors.rust,
  },
  authOuter: {
    position: 'relative',
  },
  authShadow: {
    position: 'absolute',
    top: 5,
    left: 5,
    right: -5,
    bottom: -5,
    backgroundColor: colors.tealDark,
    borderRadius: 12,
  },
  authCard: {
    backgroundColor: colors.paper,
    borderWidth: 2.5,
    borderColor: colors.ink,
    borderRadius: 12,
    padding: 16,
  },
  authHeader: {
    marginBottom: 14,
  },
  authTitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 20,
    color: colors.ink,
    marginTop: 6,
  },
  authDesc: {
    fontSize: 11,
    color: colors.inkMuted,
    lineHeight: 15,
    marginTop: 2,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 10,
    color: colors.ink,
    marginBottom: 4,
  },
  input: {
    height: 42,
    backgroundColor: colors.paperLight,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontFamily: 'monospace',
    fontSize: 13,
    color: colors.ink,
    fontWeight: '700',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.teal,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingVertical: 12,
    gap: 6,
    marginTop: 6,
  },
  submitBtnText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 12,
    color: colors.ink,
  },
  toggleAuthModeBtn: {
    marginTop: 14,
    alignItems: 'center',
  },
  toggleAuthText: {
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 11,
    color: colors.ink,
    textDecorationLine: 'underline',
  },
});
