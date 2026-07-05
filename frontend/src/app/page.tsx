import styles from './page.module.css';

import Sidebar from '../components/Sidebar';

export default function Home() {
  return (
    <div className={styles.container}>
      <Sidebar />

      {/* Main Content Area */}
      <main className={styles.main}>
        <header className={styles.header}>
          <h1>Welcome to DevPilot AI</h1>
          <p className="text-secondary">Your intelligent software engineering assistant.</p>
        </header>
        
        <div className={styles.grid}>
          {/* Module 1 Card */}
          <div className={`glass-panel ${styles.card}`}>
            <h3>Scribe</h3>
            <p className="text-secondary">Automatically generate enterprise-grade documentation for entire codebases.</p>
            <a href="/docs">
              <button className={styles.button}>Upload Repository</button>
            </a>
          </div>

          {/* Module 2 Card */}
          <div className={`glass-panel ${styles.card}`}>
            <h3>Insight</h3>
            <p className="text-secondary">Analyze SRS, PRD, and technical documents to extract insights and plans.</p>
            <a href="/requirements">
              <button className={styles.button}>Upload Document</button>
            </a>
          </div>

          {/* Module 3 Card */}
          <div className={`glass-panel ${styles.card}`}>
            <h3>Genesis</h3>
            <p className="text-secondary">Convert a software idea into a complete execution plan and architecture.</p>
            <a href="/planner">
              <button className={styles.button}>Start Planning</button>
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
