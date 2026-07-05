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

function PlannerContent() {
  const [sessionActive, setSessionActive] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [idea, setIdea] = useState('');
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
            } else if (parsed.plan) {
              // Migration path for old sessions
              setMessages([{ role: 'ai', content: parsed.plan }]);
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

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idea.trim()) return;

    setIsGenerating(true);
    setSessionActive(false);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || `http://${window.location.hostname}:8000`;
      const response = await fetch(`${apiUrl}/api/v1/planner/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea: idea, is_compact_mode: compactMode }),
      });

      if (response.ok) {
        const data = await response.json();
        const newSessionId = data.session_id || Date.now().toString();
        setSessionId(newSessionId);
        setSessionActive(true);

        const initialMessages: Message[] = [
          { role: 'ai', content: data.plan }
        ];
        setMessages(initialMessages);
        
        // Register session in sidebar
        addSession('Genesis', newSessionId, `/planner?session=${newSessionId}`);
        saveMessagesToDB(newSessionId, initialMessages);
      } else {
        const errorData = await response.json();
        alert(`**Error:** ${errorData.detail || 'Failed to generate project plan.'}`);
      }
    } catch {
      alert(`**Error:** Cannot connect to the backend server. Is it running?`);
    } finally {
      setIsGenerating(false);
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
      const response = await fetch(`${apiUrl}/api/v1/planner/chat`, {
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
          <h1>Genesis</h1>
          <p className="text-secondary">Convert a simple software idea into a complete execution plan and system architecture.</p>
        </header>

        {!sessionActive && !isGenerating && (
          <div className={`glass-panel ${styles.inputCard}`}>
            <h3>What do you want to build?</h3>
            <form onSubmit={handleGenerate} className={styles.form}>
              <textarea 
                className={styles.textarea}
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="e.g., I want to build an AI Resume Analyzer that ranks candidates based on job descriptions..."
                rows={5}
                disabled={isGenerating}
              />
              <button 
                type="submit" 
                className={styles.generateButton}
                disabled={!idea.trim() || isGenerating}
              >
                Generate Architecture
              </button>
            </form>
          </div>
        )}

        {isGenerating && (
          <div className={`glass-panel ${styles.loadingCard}`}>
            <div className={styles.spinner}></div>
            <h3>Architecting Solution</h3>
            <p className="text-secondary">Designing database schemas, system architecture, and sprint plans...</p>
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
                    Genesis is re-architecting...
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
                placeholder="Ask Genesis to change the tech stack, modify the DB schema, or add features..."
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

export default function ProjectPlanner() {
  return (
    <Suspense fallback={<div style={{ color: 'white', padding: '2rem' }}>Loading planner...</div>}>
      <PlannerContent />
    </Suspense>
  );
}
