import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Image,
} from 'react-native';
import {
  Disc,
  Radio,
  Download,
  Users,
  Eye,
  EyeOff,
  Sparkles,
  LogIn,
  UserPlus,
  ArrowRight,
  X,
  ShieldCheck,
  Check,
} from 'lucide-react-native';
import { useUser } from '../context/UserContext';
import { useToast } from '../context/ToastContext';
import { APP_VERSION } from '../version';

const { width } = Dimensions.get('window');

const FEATURES = [
  {
    icon: Sparkles,
    title: '24-bit Hi-Fi Audio',
    desc: 'Pure Cairo underground sound relief & zero-compression reels',
    color: '#17a398',
  },
  {
    icon: Download,
    title: 'Offline Vault',
    desc: 'Cache your favorite crates and listen anywhere without internet',
    color: '#38bdf8',
  },
  {
    icon: Radio,
    title: 'Discord Presence',
    desc: 'Live song title sync & listening status on your Discord profile',
    color: '#5865F2',
  },
  {
    icon: Users,
    title: 'Live Jam & Chat',
    desc: 'Synchronized group listening rooms & direct music sharing',
    color: '#f59e0b',
  },
];

export default function IntroAuthModal({ visible, onClose, initialMode = 'intro' }) {
  const { login, register, currentUser } = useUser();
  const { showToast } = useToast();

  // Mode: 'intro' | 'login' | 'register'
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async () => {
    setErrorMessage('');
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please enter email and password');
      return;
    }
    if (mode === 'register' && !name.trim()) {
      setErrorMessage('Please enter your listener name');
      return;
    }

    setIsLoading(true);
    try {
      if (mode === 'register') {
        await register(name.trim(), email.trim(), password.trim());
        showToast('Account registered successfully!', 'success');
      } else {
        await login(email.trim(), password.trim());
        showToast('Welcome back to Rivo!', 'success');
      }
      onClose();
    } catch (err) {
      setErrorMessage(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
          style={styles.keyboardWrap}
        >
          <View style={styles.modalCard}>
            {/* Top Close Button */}
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <X size={18} color="#94a3b8" />
            </TouchableOpacity>

            <ScrollView
              contentContainerStyle={styles.scrollBody}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="none"
              bounces={false}
            >
              {/* Header: Official App Logo + Rivo Title */}
              <View style={styles.brandingHeader}>
                <View style={styles.discBadge}>
                  <Image
                    source={require('../../../assets/logo.png')}
                    style={styles.logoImage}
                    resizeMode="contain"
                  />
                </View>
                <Text style={styles.appTitle}>RIVO</Text>
                <View style={styles.versionPill}>
                  <Text style={styles.versionText}>v{APP_VERSION} • SONIC DISPENSARY</Text>
                </View>
                <Text style={styles.tagline}>
                  Pure sound relief, offline vault & synchronized live listening for Cairo.
                </Text>
              </View>

              {/* ── MODE 1: INTRO ONBOARDING ── */}
              {mode === 'intro' && (
                <View style={styles.introSection}>
                  {/* Feature Highlights Grid */}
                  <View style={styles.featuresList}>
                    {FEATURES.map((feat, i) => {
                      const IconComp = feat.icon;
                      return (
                        <View key={i} style={styles.featureItem}>
                          <View style={[styles.featIconBox, { backgroundColor: `${feat.color}20`, borderColor: feat.color }]}>
                            <IconComp size={18} color={feat.color} strokeWidth={2.5} />
                          </View>
                          <View style={styles.featTextBox}>
                            <Text style={styles.featTitle}>{feat.title}</Text>
                            <Text style={styles.featDesc}>{feat.desc}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>

                  {/* Actions */}
                  <View style={styles.actionsContainer}>
                    <TouchableOpacity
                      style={styles.primaryAuthBtn}
                      onPress={() => setMode('login')}
                      activeOpacity={0.85}
                    >
                      <LogIn size={16} color="#0b1110" strokeWidth={2.8} />
                      <Text style={styles.primaryAuthBtnText}>SIGN IN TO ACCOUNT</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.secondaryAuthBtn}
                      onPress={() => setMode('register')}
                      activeOpacity={0.85}
                    >
                      <UserPlus size={16} color="#17a398" strokeWidth={2.5} />
                      <Text style={styles.secondaryAuthBtnText}>CREATE NEW ACCOUNT</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.guestBtn}
                      onPress={onClose}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.guestBtnText}>CONTINUE AS GUEST</Text>
                      <ArrowRight size={13} color="#94a3b8" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* ── MODE 2 & 3: SIGN IN / REGISTER FORM ── */}
              {(mode === 'login' || mode === 'register') && (
                <View style={styles.formSection}>
                  {/* Mode Toggle Tabs */}
                  <View style={styles.tabSwitch}>
                    <TouchableOpacity
                      style={[styles.tabBtn, mode === 'login' && styles.tabBtnActive]}
                      onPress={() => {
                        setMode('login');
                        setErrorMessage('');
                      }}
                    >
                      <Text style={[styles.tabBtnText, mode === 'login' && styles.tabBtnTextActive]}>
                        SIGN IN
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.tabBtn, mode === 'register' && styles.tabBtnActive]}
                      onPress={() => {
                        setMode('register');
                        setErrorMessage('');
                      }}
                    >
                      <Text style={[styles.tabBtnText, mode === 'register' && styles.tabBtnTextActive]}>
                        REGISTER
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {errorMessage ? (
                    <View style={styles.errorBox}>
                      <Text style={styles.errorText}>{errorMessage}</Text>
                    </View>
                  ) : null}

                  {mode === 'register' && (
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>LISTENER NAME</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. Karim Tarek"
                        placeholderTextColor="#64748b"
                        value={name}
                        onChangeText={setName}
                        autoCapitalize="words"
                      />
                    </View>
                  )}

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>EMAIL / USERNAME</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="listener@rivo.fm"
                      placeholderTextColor="#64748b"
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>PASSWORD CIPHER</Text>
                    <View style={styles.passwordRow}>
                      <TextInput
                        style={[styles.input, { flex: 1, paddingRight: 40 }]}
                        placeholder="••••••••"
                        placeholderTextColor="#64748b"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                      />
                      <TouchableOpacity
                        style={styles.eyeBtn}
                        onPress={() => setShowPassword(p => !p)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        {showPassword ? (
                          <EyeOff size={16} color="#94a3b8" />
                        ) : (
                          <Eye size={16} color="#94a3b8" />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.primaryAuthBtn}
                    onPress={handleSubmit}
                    disabled={isLoading}
                    activeOpacity={0.85}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color="#0b1110" />
                    ) : (
                      <>
                        <ShieldCheck size={16} color="#0b1110" strokeWidth={2.8} />
                        <Text style={styles.primaryAuthBtnText}>
                          {mode === 'login' ? 'AUTHENTICATE & ENTER' : 'CREATE CITIZEN PROFILE'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <View style={styles.formFooterRow}>
                    <TouchableOpacity
                      onPress={() => setMode('intro')}
                      style={{ paddingVertical: 6 }}
                    >
                      <Text style={styles.backToIntroText}>← Back to Intro</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={onClose}
                      style={{ paddingVertical: 6 }}
                    >
                      <Text style={styles.guestSkipText}>Skip as Guest</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  keyboardWrap: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCard: {
    backgroundColor: '#0e1715',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#263330',
    overflow: 'hidden',
    position: 'relative',
    maxHeight: Math.min(620, Dimensions.get('window').height * 0.86),
    width: '100%',
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 10,
    backgroundColor: '#162220',
    borderRadius: 14,
    padding: 6,
    borderWidth: 1,
    borderColor: '#263330',
  },
  scrollBody: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 24,
  },
  brandingHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  discBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#0b1110',
    borderWidth: 2,
    borderColor: '#17a398',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#17a398',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    overflow: 'hidden',
  },
  logoImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  appTitle: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 3,
  },
  versionPill: {
    backgroundColor: 'rgba(23,163,152,0.18)',
    borderWidth: 1,
    borderColor: '#17a398',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  versionText: {
    color: '#17a398',
    fontSize: 10,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 1,
  },
  tagline: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: 10,
  },
  introSection: {
    width: '100%',
  },
  featuresList: {
    gap: 10,
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141d1b',
    borderWidth: 1,
    borderColor: '#263330',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  featIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  featTextBox: {
    flex: 1,
  },
  featTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  featDesc: {
    color: '#94a3b8',
    fontSize: 11,
    lineHeight: 15,
  },
  actionsContainer: {
    gap: 10,
  },
  primaryAuthBtn: {
    backgroundColor: '#17a398',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 14,
    gap: 8,
    shadowColor: '#17a398',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  primaryAuthBtnText: {
    color: '#0b1110',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
  secondaryAuthBtn: {
    backgroundColor: 'rgba(23,163,152,0.12)',
    borderWidth: 1.5,
    borderColor: '#17a398',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    gap: 8,
  },
  secondaryAuthBtnText: {
    color: '#17a398',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  guestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  guestBtnText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  formSection: {
    width: '100%',
  },
  tabSwitch: {
    flexDirection: 'row',
    backgroundColor: '#141d1b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#263330',
    padding: 3,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 9,
  },
  tabBtnActive: {
    backgroundColor: '#17a398',
  },
  tabBtnText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  tabBtnTextActive: {
    color: '#0b1110',
    fontWeight: '900',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
    padding: 10,
    borderRadius: 10,
    marginBottom: 14,
  },
  errorText: {
    color: '#f87171',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 6,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  input: {
    backgroundColor: '#141d1b',
    borderWidth: 1,
    borderColor: '#263330',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  passwordRow: {
    position: 'relative',
    justifyContent: 'center',
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
  },
  formFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingHorizontal: 4,
  },
  backToIntroText: {
    color: '#17a398',
    fontSize: 12,
    fontWeight: '700',
  },
  guestSkipText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
});
