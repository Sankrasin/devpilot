"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface ChatSession {
  id: string;
  type: 'Scribe' | 'Insight' | 'Genesis';
  title: string;
  url: string;
  timestamp: number;
}

interface SessionContextType {
  sessions: ChatSession[];
  addSession: (type: 'Scribe' | 'Insight' | 'Genesis', id: string, url: string) => void;
  removeSession: (id: string) => void;
  clearSessions: () => void;
  compactMode: boolean;
  toggleCompactMode: () => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [compactMode, setCompactMode] = useState<boolean>(false);
  const [isWakingUp, setIsWakingUp] = useState<boolean>(true);

  const toggleCompactMode = () => setCompactMode(prev => !prev);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || `http://${window.location.hostname}:8000`;
    fetch(`${apiUrl}/api/v1/sessions`)
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          setSessions(data);
        }
      })
      .catch(err => console.error("Failed to fetch sessions", err))
      .finally(() => setIsWakingUp(false));
  }, []);

  const addSession = async (type: 'Scribe' | 'Insight' | 'Genesis', id: string, url: string) => {
    // Count existing sessions of this type to determine the number (e.g. "Scribe 1")
    const typeCount = sessions.filter(s => s.type === type).length;
    const title = `${type} ${typeCount + 1}`;
    
    const newSession = { id, type, title, url };

    // Optimistically update UI
    setSessions(prev => {
      if (prev.some(s => s.id === id)) return prev;
      return [...prev, { ...newSession, timestamp: Date.now() }];
    });

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || `http://${window.location.hostname}:8000`;
    try {
      await fetch(`${apiUrl}/api/v1/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSession)
      });
    } catch (e) {
      console.error("Failed to save session", e);
    }
  };

  const removeSession = async (id: string) => {
    // Optimistically update UI
    setSessions(prev => prev.filter(s => s.id !== id));

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || `http://${window.location.hostname}:8000`;
    try {
      await fetch(`${apiUrl}/api/v1/sessions/${id}`, {
        method: 'DELETE'
      });
    } catch (e) {
      console.error("Failed to delete session", e);
    }
  };

  const clearSessions = () => {
    setSessions([]);
  };

  return (
    <SessionContext.Provider value={{ sessions, addSession, removeSession, clearSessions, compactMode, toggleCompactMode }}>
      {isWakingUp && (
        <div style={{ background: '#ca8a04', color: 'white', textAlign: 'center', padding: '8px', fontSize: '14px', zIndex: 9999, position: 'relative' }}>
          Waking up AI backend... (This might take 1-2 minutes)
        </div>
      )}
      {children}
    </SessionContext.Provider>
  );
};

export const useSessions = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSessions must be used within a SessionProvider');
  }
  return context;
};
