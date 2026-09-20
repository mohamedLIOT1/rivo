import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, FlatList } from 'react-native';
import { X, Send, MessageSquare } from 'lucide-react-native';
import { useSocket } from '../context/SocketContext';
import { useUser } from '../context/UserContext';
import { colors } from '../theme/colors';
import CassetteTag from '../ui/CassetteTag';

export default function ChatModal({ visible, onClose }) {
  const { chatMessages, sendChatMessage } = useSocket();
  const { currentUser } = useUser();
  const [inputText, setInputText] = useState('');

  const handleSend = () => {
    if (!inputText.trim()) return;
    sendChatMessage(inputText.trim());
    setInputText('');
  };

  const renderMessage = ({ item }) => {
    const isMe = item.senderId === (currentUser?._id || currentUser?.id);
    return (
      <View style={[styles.msgRow, isMe ? styles.myMsgRow : styles.otherMsgRow]}>
        <View style={[styles.bubble, isMe ? styles.myBubble : styles.otherBubble]}>
          {!isMe && <Text style={styles.senderName}>{item.senderName || 'Listener'}</Text>}
          <Text style={[styles.msgText, isMe ? styles.myMsgText : styles.otherMsgText]}>{item.text}</Text>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetOuter}>
          <View style={styles.hardShadow} />
          <View style={styles.sheet}>
            {/* Header */}
            <View style={styles.header}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={styles.iconBox}>
                  <MessageSquare size={18} color={colors.ink} />
                </View>
                <View>
                  <Text style={styles.title}>COMMUNITY CHAT</Text>
                  <CassetteTag label="REAL-TIME DISPENSARY CHAT" bg={colors.ink} textColor={colors.tealLight} />
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <X size={20} color={colors.ink} />
              </TouchableOpacity>
            </View>

            {/* Messages List */}
            <FlatList
              data={chatMessages}
              keyExtractor={(item, index) => item.id || String(index)}
              renderItem={renderMessage}
              style={{ flex: 1, marginVertical: 8 }}
              contentContainerStyle={{ paddingVertical: 8 }}
              ListEmptyComponent={
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>No messages logged yet. Say hello to fellow listeners!</Text>
                </View>
              }
            />

            {/* Input Bar */}
            <View style={styles.inputBar}>
              <TextInput
                style={styles.textInput}
                placeholder="Log a dispatch..."
                placeholderTextColor="#9ca3af"
                value={inputText}
                onChangeText={setInputText}
                onSubmitEditing={handleSend}
              />
              <TouchableOpacity
                style={[styles.sendBtn, !inputText.trim() && { opacity: 0.5 }]}
                onPress={handleSend}
                disabled={!inputText.trim()}
              >
                <Send size={16} color={colors.ink} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(8, 38, 33, 0.85)',
    justifyContent: 'flex-end',
    padding: 12,
  },
  sheetOuter: {
    position: 'relative',
    height: '75%',
  },
  hardShadow: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: -6,
    bottom: -6,
    backgroundColor: colors.ink,
  },
  sheet: {
    flex: 1,
    backgroundColor: colors.paper,
    borderWidth: 3.5,
    borderColor: colors.ink,
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: colors.ink,
  },
  iconBox: {
    width: 32,
    height: 32,
    backgroundColor: colors.teal,
    borderWidth: 2,
    borderColor: colors.ink,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.ink,
    letterSpacing: 1,
  },
  closeBtn: {
    padding: 6,
  },
  msgRow: {
    marginVertical: 4,
    flexDirection: 'row',
  },
  myMsgRow: {
    justifyContent: 'flex-end',
  },
  otherMsgRow: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    padding: 10,
    borderWidth: 2,
    borderColor: colors.ink,
  },
  myBubble: {
    backgroundColor: colors.teal,
  },
  otherBubble: {
    backgroundColor: colors.cardBg,
  },
  senderName: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.tealDark,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  msgText: {
    fontSize: 13,
    fontWeight: '700',
  },
  myMsgText: {
    color: colors.ink,
  },
  otherMsgText: {
    color: colors.ink,
  },
  emptyBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },
  inputBar: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 2,
    borderTopColor: colors.ink,
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.cardBg,
    borderWidth: 2,
    borderColor: colors.ink,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  sendBtn: {
    width: 40,
    height: 40,
    backgroundColor: colors.teal,
    borderWidth: 2,
    borderColor: colors.ink,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
