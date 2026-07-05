"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSessions } from '../context/SessionContext';
import styles from './Sidebar.module.css';

export default function Sidebar() {
  const pathname = usePathname();
  const { sessions, removeSession, compactMode, toggleCompactMode } = useSessions();

  return (
    <aside className={`glass-panel ${styles.sidebar}`}>
      <div className={styles.logo}>
        <h2>DevPilot AI</h2>
      </div>
      
      <nav className={styles.nav}>
        <Link href="/" className={pathname === '/' ? styles.active : ''}>
          Dashboard
        </Link>
        
        <div className={styles.chatSection}>
          <h4>Active Chats</h4>
          
          {sessions.length === 0 ? (
            <div className={styles.noChats}>No active chats</div>
          ) : (
            sessions.map(session => (
              <Link 
                key={session.id} 
                href={session.url}
                className={pathname === session.url ? styles.active : ''}
              >
                {session.title}
                <button 
                  className={styles.closeButton}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    removeSession(session.id);
                  }}
                  title="Close Chat"
                >
                  ✕
                </button>
              </Link>
            ))
          )}
        </div>
      </nav>

      <div className={styles.settingsSection}>
        <div className={styles.toggleContainer}>
          <span className={styles.toggleLabel}>Compact Mode</span>
          <div className={styles.switchWrapper}>
            <span className={`${styles.switchLabel} ${!compactMode ? styles.activeOff : ''}`}>OFF</span>
            <label className={styles.switch}>
              <input 
                type="checkbox" 
                checked={compactMode}
                onChange={toggleCompactMode}
              />
              <span className={`${styles.slider} ${compactMode ? styles.sliderOn : styles.sliderOff}`}></span>
            </label>
            <span className={`${styles.switchLabel} ${compactMode ? styles.activeOn : ''}`}>ON</span>
          </div>
        </div>
        <p className={styles.toggleDescription}>
          {compactMode ? "AI will be extremely brief and concise." : "AI will explain everything in deep detail."}
        </p>
      </div>
    </aside>
  );
}
