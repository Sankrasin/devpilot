"use client";

import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import mermaid from 'mermaid';
import styles from './MarkdownViewer.module.css';

interface MarkdownViewerProps {
  content: string;
}

const MermaidChart = ({ chart }: { chart: string }) => {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      securityLevel: 'loose',
    });
    
    const renderChart = async () => {
      const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
      try {
        const { svg } = await mermaid.render(id, chart);
        setSvg(svg);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError(String(err) || 'Invalid Mermaid syntax');
        }
      } finally {
        // Mermaid has a bug where it leaves dangling error SVGs in the body
        const stray = document.getElementById(`d${id}`);
        if (stray) stray.remove();
      }
    };
    renderChart();
  }, [chart]);

  if (error) {
    return <div className={styles.mermaidError}><em>Mermaid Error:</em> {error}</div>;
  }

  return svg ? <div dangerouslySetInnerHTML={{ __html: svg }} /> : <div>Rendering diagram...</div>;
};

export default function MarkdownViewer({ content }: MarkdownViewerProps) {
  return (
    <div className={styles.markdownContainer}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const isMermaid = match && match[1] === 'mermaid';
            const codeString = String(children).replace(/\n$/, '');

            if (isMermaid) {
              return <MermaidChart chart={codeString} />;
            }

            return match ? (
              <code className={className} {...props}>
                {children}
              </code>
            ) : (
              <code className={styles.inlineCode} {...props}>
                {children}
              </code>
            );
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
