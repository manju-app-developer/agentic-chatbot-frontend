import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Send, Bot, User, Activity, Brain, AlertCircle, Square } from 'lucide-react';
import './index.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const socket = io(BACKEND_URL);

function App() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isWorking, setIsWorking] = useState(false);
  const [currentStatus, setCurrentStatus] = useState('');
  const [thoughts, setThoughts] = useState([]);
  const [humanPrompt, setHumanPrompt] = useState(null);
  const [stepApproval, setStepApproval] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentStatus, thoughts, humanPrompt]);

  useEffect(() => {
    socket.on('status', (data) => {
      if (data.type === 'thought') {
        setThoughts(prev => [...prev, data.message]);
      } else {
        setCurrentStatus(data.message);
      }
    });

    socket.on('require_human', (data) => {
      setHumanPrompt(data.message);
    });

    socket.on('require_step_approval', (data) => {
      setStepApproval(data.action);
    });

    socket.on('task_complete', (data) => {
      setIsWorking(false);
      setCurrentStatus('');
      const finalMessage = data && data.reason === 'terminated' ? 'Task Terminated' : 'Task completed!';
      setMessages(prev => [...prev, { type: 'bot', text: finalMessage, thoughts: [...thoughts] }]);
      setThoughts([]);
    });

    return () => {
      socket.off('status');
      socket.off('require_human');
      socket.off('require_step_approval');
      socket.off('task_complete');
    };
  }, [thoughts]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    if (humanPrompt) {
      // Respond to human prompt
      socket.emit('human_input', { input: input });
      setMessages([...messages, { type: 'user', text: input }]);
      setHumanPrompt(null);
      setInput('');
      return;
    }

    if (isWorking) return;

    // Start new task
    setMessages([...messages, { type: 'user', text: input }]);
    setIsWorking(true);
    setThoughts([]);
    setStepApproval(null);
    setCurrentStatus('Starting task...');
    socket.emit('start_task', { task: input });
    setInput('');
  };

  const handleStop = () => {
    socket.emit('cancel_task');
    setStepApproval(null);
  };

  const handleStepDecision = (decision) => {
    socket.emit('step_decision', { decision });
    setStepApproval(null);
  };

  return (
    <div className="app-container">
      <header className="header">
        <Bot size={28} color="#3b82f6" />
        <h1>Agentic Browser AI</h1>
      </header>

      <div className="chat-area">
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: 'auto', marginBottom: 'auto' }}>
            <Activity size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
            <p>Tell me what to do in the browser.</p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.type}`}>
            {msg.type === 'bot' && <Bot size={20} color="#60a5fa" />}
            <div style={{ width: '100%' }}>
              <div className="msg-text">{msg.text}</div>
              {msg.thoughts && msg.thoughts.length > 0 && (
                <div className="thought-process">
                  <div className="thought-header"><Brain size={14} /> Reasoning Process</div>
                  {msg.thoughts.map((t, i) => <div key={i} className="thought-item">{t}</div>)}
                </div>
              )}
            </div>
          </div>
        ))}

        {isWorking && (
          <div className="message bot">
            <Bot size={20} color="#60a5fa" />
            <div style={{ width: '100%' }}>
              <div className="msg-text">Working on it...</div>

              {thoughts.length > 0 && (
                <div className="thought-process active">
                  <div className="thought-header"><Brain size={14} /> Reasoning Process</div>
                  {thoughts.map((t, i) => <div key={i} className="thought-item">{t}</div>)}
                </div>
              )}

              {stepApproval ? (
                <div className="step-approval-box">
                  <div className="step-title">AI Proposes Action:</div>
                  <div className="step-action">
                    <strong>{stepApproval.action.toUpperCase()}</strong>
                    {stepApproval.url && <span> → {stepApproval.url}</span>}
                    {stepApproval.command && <span> → {stepApproval.command}</span>}
                    {stepApproval.value && <span> → "{stepApproval.value}"</span>}
                  </div>
                  <div className="step-reason">Reason: {stepApproval.reason}</div>
                  <div className="step-actions">
                    <button onClick={() => handleStepDecision('approve')} className="btn-approve">Approve</button>
                    <button onClick={() => handleStepDecision('reject')} className="btn-reject">Reject</button>
                  </div>
                </div>
              ) : humanPrompt ? (
                <div className="human-prompt-alert">
                  <AlertCircle size={16} color="#d97706" />
                  <span><strong>Action Required:</strong> {humanPrompt}</span>
                </div>
              ) : (
                <div className="status-badge">
                  <div className="spinner"></div>
                  {currentStatus}
                </div>
              )}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="input-area" onSubmit={handleSubmit}>
        <div className={`input-wrapper ${humanPrompt ? 'human-required' : ''}`}>
          <User size={20} color={humanPrompt ? "#d97706" : "var(--text-secondary)"} style={{ alignSelf: 'center' }} />
          <input
            type="text"
            placeholder={humanPrompt ? "Please complete action in browser, then reply..." : "e.g., Go to Wikipedia and search for 'Playwright'..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={(isWorking && !humanPrompt) || stepApproval}
            autoFocus={!!humanPrompt}
          />
          {isWorking && !humanPrompt && !stepApproval ? (
            <button type="button" className="stop-btn" onClick={handleStop} title="Terminate Task">
              <Square size={16} fill="currentColor" />
            </button>
          ) : (
            <button type="submit" className="send-btn" disabled={!input.trim() || (isWorking && !humanPrompt) || stepApproval}>
              <Send size={18} />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

export default App;
