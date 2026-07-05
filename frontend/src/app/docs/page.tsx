"use client";

import { useState, useRef, useEffect } from 'react';
import styles from './page.module.css';
import MarkdownViewer from '../../components/MarkdownViewer';
import Sidebar from '../../components/Sidebar';
import { useSessions } from '../../context/SessionContext';
import { useSearchParams } from 'next/navigation';

interface Message {
  role: 'user' | 'ai';
  content: string;
}

export default function DocsGenerator() {
  const [sessionActive, setSessionActive] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
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
            if (parsed.messages) {
              setMessages(parsed.messages);
            } else if (parsed.result) {
              // Migration path for old sessions
              setMessages([{ role: 'ai', content: parsed.result }]);
            }
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
      setIsUploading(true);
      setProgress(10);
      setSessionActive(false);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('is_compact_mode', compactMode.toString());
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || `http://${window.location.hostname}:8000`;
      try {
        const progressInterval = setInterval(() => {
          setProgress((old) => Math.min(old + 10, 90));
        }, 500);

        const response = await fetch(`${apiUrl}/api/v1/docs/analyze`, {
          method: 'POST',
          body: formData,
        });

        clearInterval(progressInterval);

        if (response.ok) {
          const data = await response.json();
          const newSessionId = data.session_id || Date.now().toString();
          setSessionId(newSessionId);
          setSessionActive(true);

          const initialMessages: Message[] = [
            { role: 'ai', content: data.documentation }
          ];
          setMessages(initialMessages);
          
          // Register session in sidebar
          addSession('Scribe', newSessionId, `/docs?session=${newSessionId}`);
          saveMessagesToDB(newSessionId, initialMessages);
        } else {
          alert('Failed to generate documentation.');
        }
        setProgress(100);
      } catch {
        alert('Error connecting to backend.');
      } finally {
        setIsUploading(false);
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
      const response = await fetch(`${apiUrl}/api/v1/docs/chat`, {
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

      <main className={styles.main}>
        <header className={styles.header}>
          <h1>Scribe</h1>
          <p className="text-secondary">Upload a repository ZIP file to generate comprehensive documentation.</p>
        </header>

        {!sessionActive && !isUploading && (
          <div className={`glass-panel ${styles.uploadZone}`}>
            <div className={styles.uploadBox}>
              <div className={styles.icon}>📁</div>
              <h2>Upload Repository ZIP</h2>
              <p className="text-secondary">Drop your codebase here to begin AI analysis.</p>
              
              <label className={styles.uploadButton}>
                Select ZIP File
                <input 
                  type="file" 
                  accept=".zip" 
                  style={{ display: 'none' }} 
                  onChange={handleFileUpload}
                />
              </label>
            </div>
          </div>
        )}

        {isUploading && (
          <div className={`glass-panel ${styles.loadingState}`}>
            <div className={styles.loadingSpinner}></div>
            <h2>Analyzing Codebase...</h2>
            <p className="text-secondary">Extracting files and generating enterprise documentation.</p>
            <div className={styles.progressBar}>
              <div 
                className={styles.progressFill} 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        )}

        {sessionActive && (
          <div className={`glass-panel ${styles.chatContainer}`}>
            <div className={styles.chatHistory}>
              {messages.map((msg, index) => (
                <div key={index} className={`${styles.messageWrapper} ${msg.role === 'user' ? styles.userWrapper : styles.aiWrapper}`}>
                  <div className={msg.role === 'user' ? styles.userMessage : styles.aiMessage}>
                    {msg.role === 'ai' ? (
                      <MarkdownViewer content={msg.content} />
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className={`${styles.messageWrapper} ${styles.aiWrapper}`}>
                  <div className={`${styles.aiMessage} ${styles.typingIndicator}`}>
                    Scribe is thinking...
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
                placeholder="Ask Scribe for changes, code snippets, or deeper explanations..."
                className={styles.chatInput}
                disabled={isTyping}
              />
              <button 
                type="submit" 
                className={styles.sendButton}
                disabled={isTyping || !inputValue.trim()}
              >
                ➔
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
