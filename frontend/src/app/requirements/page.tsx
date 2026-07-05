"use client";

import { useState, useRef, useEffect, Suspense } from 'react';
import styles from './page.module.css';
import MarkdownViewer from '../../components/MarkdownViewer';
import Sidebar from '../../components/Sidebar';
import { useSessions } from '../../context/SessionContext';
import { useSearchParams } from 'next/navigation';

interface Message {
  role: 'user' | 'ai';
  content: string;
}

function RequirementsContent() {
  const [sessionActive, setSessionActive] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { addSession, compactMode } = useSessions();
  const searchParams = useSearchParams();
  const sessionIdParam = searchParams.get('session');

  useEffect(() => {
    if (sessionIdParam) {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || `http://${window.location.hostname}:8000`;
      fetch(`${apiUrl}/api/v1/sessions/${sessionIdParam}`)
        .then(res => res.json())
        .then(data => {
          if (data.data) {
            const parsed = JSON.parse(data.data);
            setMessages(parsed.messages || []);
            setSessionId(sessionIdParam);
            setSessionActive(true);
          }
        })
        .catch(err => console.error(err));
    }
  }, [sessionIdParam]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const saveMessagesToDB = (id: string, msgs: Message[]) => {
    fetch(`http://${window.location.hostname}:8000/api/v1/sessions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: JSON.stringify({ messages: msgs }) })
    }).catch(console.error);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const formData = new FormData();
      formData.append('file', file);
      formData.append('is_compact_mode', compactMode.toString());
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || `http://${window.location.hostname}:8000`;
      try {
        const response = await fetch(`${apiUrl}/api/v1/requirements/upload`, {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          setSessionId(data.session_id);
          setSessionActive(true);
          const initialMessages: Message[] = [
            { role: 'ai', content: "Document successfully parsed! I'm acting as your Senior Software Engineer. What would you like to know about these requirements?" }
          ];
          setMessages(initialMessages);
          
          // Register session in sidebar
          addSession('Insight', data.session_id, `/requirements?session=${data.session_id}`);
          saveMessagesToDB(data.session_id, initialMessages);
        } else {
          alert('Failed to upload document.');
        }
      } catch {
        alert('Cannot connect to the backend server.');
      }
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !sessionId) return;

    const userMsg = inputValue;
    const newMessages: Message[] = [...messages, { role: 'user', content: userMsg }];
    setMessages(newMessages);
    setInputValue('');
    setIsTyping(true);
    saveMessagesToDB(sessionId, newMessages);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || `http://${window.location.hostname}:8000`;
      const response = await fetch(`${apiUrl}/api/v1/requirements/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, message: userMsg, is_compact_mode: compactMode }),
      });

      if (response.ok) {
        const data = await response.json();
        const finalMessages: Message[] = [...newMessages, { role: 'ai', content: data.response }];
        setMessages(finalMessages);
        saveMessagesToDB(sessionId, finalMessages);
      } else {
        const finalMessages: Message[] = [...newMessages, { role: 'ai', content: "**Error:** Failed to get a response from the server." }];
        setMessages(finalMessages);
        saveMessagesToDB(sessionId, finalMessages);
      }
    } catch {
      const finalMessages: Message[] = [...newMessages, { role: 'ai', content: "**Error:** Cannot connect to the backend server." }];
      setMessages(finalMessages);
      saveMessagesToDB(sessionId, finalMessages);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className={styles.container}>
      <Sidebar />

      {/* Main Content Area */}
      <main className={styles.main}>
        <header className={styles.header}>
          <h1>Insight</h1>
          <p className="text-secondary">Upload your technical documents (SRS, PRD, Architecture) and interact with a Senior AI Engineer.</p>
        </header>

        {!sessionActive ? (
          <div className={`glass-panel ${styles.uploadZone}`}>
            <div className={styles.uploadBox}>
              <div className={styles.icon}>📄</div>
              <h3>Upload Document</h3>
              <p className="text-secondary">Supported formats: PDF, Markdown (.md)</p>
              
              <label className={styles.uploadButton}>
                Select File
                <input 
                  type="file" 
                  accept=".pdf,.md" 
                  onChange={handleFileUpload} 
                  style={{ display: 'none' }} 
                />
              </label>
            </div>
          </div>
        ) : (
          <div className={`glass-panel ${styles.chatContainer}`}>
            <div className={styles.chatHistory}>
              {messages.map((msg, idx) => (
                <div key={idx} className={`${styles.messageWrapper} ${msg.role === 'user' ? styles.userWrapper : styles.aiWrapper}`}>
                  <div className={`${styles.message} ${msg.role === 'user' ? styles.userMessage : styles.aiMessage}`}>
                    {msg.role === 'user' ? (
                      msg.content
                    ) : (
                      <MarkdownViewer content={msg.content} />
                    )}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className={`${styles.messageWrapper} ${styles.aiWrapper}`}>
                  <div className={`${styles.message} ${styles.aiMessage}`}>
                    <span className={styles.typingIndicator}>Thinking...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            
            <form onSubmit={handleSendMessage} className={styles.chatInputForm}>
              <input 
                type="text" 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask about the requirements, request test cases, or clarify edge cases..." 
                className={styles.chatInput}
              />
              <button type="submit" className={styles.sendButton} disabled={!inputValue.trim()}>
                Send
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

export default function RequirementsAnalyzer() {
  return (
    <Suspense fallback={<div style={{ color: 'white', padding: '2rem' }}>Loading requirements...</div>}>
      <RequirementsContent />
    </Suspense>
  );
}
