import React, { useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Model } from './Model';
import { CameraControls } from './CameraControls';
import { anatomyData, systems } from './AnatomyData';
import { askGeminiTutor } from './GeminiService';
import { Send, Settings, RefreshCw, Layers, MessageSquare, Info, AlertCircle, HelpCircle, PanelRight, PanelRightClose, PanelRightOpen, X } from 'lucide-react';

function App() {
  const [input, setInput] = useState('');
  const [activeOrgan, setActiveOrgan] = useState(null);
  const [hoveredOrgan, setHoveredOrgan] = useState(null);
  const [highlightedOrgans, setHighlightedOrgans] = useState([]);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('soma_gemini_api_key') || '');
  const [showSettings, setShowSettings] = useState(false);
  const [settingsKeyInput, setSettingsKeyInput] = useState('');
  const [selectedSystem, setSelectedSystem] = useState('Head'); // Default to Head
  const [isPending, setIsPending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const [chatExpanded, setChatExpanded] = useState(false);

  const handleTriggerHighlight = (organIds, label) => {
    setActiveOrgan(null);
    setHighlightedOrgans(organIds);
    setInput(`/${label}`);
  };

  const handleSelectSystem = (sys) => {
    setSelectedSystem(sys);
    
    // Highlight all organs in this system
    const organIds = Object.keys(anatomyData).filter(
      key => anatomyData[key].system.toLowerCase() === sys.toLowerCase()
    );
    setActiveOrgan(null);
    setHighlightedOrgans(organIds);
    setInput(`/${sys}`);
  };

  useEffect(() => {
    if (showSettings) {
      setSettingsKeyInput(apiKey);
    }
  }, [showSettings, apiKey]);

  const wasMobile = useRef(isMobile);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile !== wasMobile.current) {
        if (mobile) {
          setSidebarOpen(false);
        } else {
          setSidebarOpen(true);
        }
        wasMobile.current = mobile;
      }
    };
    window.addEventListener('resize', handleResize);
    wasMobile.current = window.innerWidth < 768;
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [messages, setMessages] = useState([
    {
      role: 'ai',
      text: "### Welcome to SOMA\nI am your biological anatomy tutor. \n\n* **Select a region** directly on the 3D model in the center to examine it.\n* **Browse systems** using the explorer on the right (toggle with the sidebar arrow icon in the top header).\n* **Ask a question** about any anatomical area in the input below.\n\n*Note: To enable full conversational AI, click the gear icon in SOMA Explorer to set your Gemini API Key.*"
    }
  ]);

  const messagesEndRef = useRef(null);

  // Scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isPending]);

  // Save API Key to localStorage
  const handleSaveApiKey = (key) => {
    setApiKey(key);
    localStorage.setItem('soma_gemini_api_key', key);
    setShowSettings(false);
  };

  // Selects an organ and updates active states
  const handleSelectOrgan = (organId) => {
    setActiveOrgan(organId);
    setHighlightedOrgans([]); // Clear any bulk highlights when focusing a single organ
    if (isMobile) {
      setChatExpanded(true);
    }
    
    // If the organ exists in our database, add a clean informational note in the chat
    const data = anatomyData[organId];
    if (data) {
      setInput(`/${data.name}`);
      setMessages((prev) => [
        ...prev,
        {
          role: 'system',
          text: `Selected: **${data.name}** (${data.system} System)`
        }
      ]);
    }
  };

  // Perform search / AI query
  const handleSendQuery = async (e) => {
    e?.preventDefault();
    if (!input.trim() || isPending) return;

    const userText = input.trim();
    setInput('');

    // Append user message
    const newMessages = [...messages, { role: 'user', text: userText }];
    setMessages(newMessages);

    // Check if input is a slash command
    if (userText.startsWith('/')) {
      const commandBody = userText.substring(1).trim();
      
      // Let's check if it's a system name (case-insensitive)
      const matchedSystem = systems.find(
        sys => sys.toLowerCase() === commandBody.toLowerCase()
      );

      if (matchedSystem) {
        // Find all organs in this system
        const organIds = Object.keys(anatomyData).filter(
          key => anatomyData[key].system.toLowerCase() === matchedSystem.toLowerCase()
        );
        
        setActiveOrgan(null);
        setHighlightedOrgans(organIds);
        
        setMessages([
          ...newMessages,
          {
            role: 'command_result',
            label: `${matchedSystem} System`,
            organIds: organIds
          }
        ]);
        return;
      }

      // If it's not a system, it might be a comma-separated list of region names or IDs
      const parts = commandBody.split(',').map(p => p.trim()).filter(Boolean);
      const matchedOrganIds = [];
      const matchedNames = [];

      parts.forEach(part => {
        // Find all keys in anatomyData where name or ID contains the query case-insensitively
        // This naturally handles "if they don't specify left or right, match both!"
        const matchesForPart = Object.keys(anatomyData).filter(key => {
          const data = anatomyData[key];
          return data.name.toLowerCase().includes(part.toLowerCase()) || 
                 data.id.toLowerCase().includes(part.toLowerCase());
        });

        matchesForPart.forEach(matchKey => {
          if (!matchedOrganIds.includes(matchKey)) {
            matchedOrganIds.push(matchKey);
            matchedNames.push(anatomyData[matchKey].name);
          }
        });
      });

      if (matchedOrganIds.length > 0) {
        setActiveOrgan(null);
        setHighlightedOrgans(matchedOrganIds);
        
        setMessages([
          ...newMessages,
          {
            role: 'command_result',
            label: matchedNames.length > 3 ? `${matchedNames.slice(0, 3).join(', ')} ... and ${matchedNames.length - 3} more` : matchedNames.join(', '),
            organIds: matchedOrganIds
          }
        ]);
        return;
      }

      // No matches found for slash command
      setMessages([
        ...newMessages,
        {
          role: 'ai',
          text: `Unknown command or region matching **"${commandBody}"**. \n\nTry using a system category (like \`/head\`, \`/abdomen\`, \`/neck\`) or specific region keywords (like \`/Epigastric Region\` or \`/Left Epigastric Region, Left Umbilical Region\`).`
        }
      ]);
      return;
    }

    setIsPending(true);

    if (apiKey) {
      // ONLINE MODE: Call Gemini
      try {
        const response = await askGeminiTutor(newMessages, apiKey, activeOrgan);
        
        setMessages([
          ...newMessages,
          { role: 'ai', text: response.text }
        ]);

        if (response.highlight) {
          // Verify it's a valid node name
          const matchedNode = Object.keys(anatomyData).find(
            key => key.toLowerCase() === response.highlight.toLowerCase() || 
                   key.toLowerCase().includes(response.highlight.toLowerCase())
          );
          if (matchedNode) {
            setActiveOrgan(matchedNode);
            setHighlightedOrgans([]); // Clear bulk highlights
          }
        }
      } catch (error) {
        setMessages([
          ...newMessages,
          { role: 'ai', text: `**Error calling Gemini API:** ${error.message}\n\n*Falling back to offline dictionary search.*` }
        ]);
        triggerOfflineSearch(userText, newMessages);
      } finally {
        setIsPending(false);
      }
    } else {
      // OFFLINE MODE: Local dictionary lookup
      setTimeout(() => {
        triggerOfflineSearch(userText, newMessages);
        setIsPending(false);
      }, 500);
    }
  };

  // Search local knowledge base for matches
  const triggerOfflineSearch = (query, currentMessages) => {
    const lowerQuery = query.toLowerCase();
    let bestMatchKey = null;
    let matchScore = 0;

    // Look for exact/partial name matches in our 256 keys
    Object.keys(anatomyData).forEach(key => {
      const data = anatomyData[key];
      const name = data.name.toLowerCase();
      const system = data.system.toLowerCase();
      
      let score = 0;
      if (lowerQuery.includes(name)) score += 10;
      if (lowerQuery.includes(data.id.toLowerCase())) score += 8;
      if (lowerQuery.includes(data.description.split(' ')[0].toLowerCase())) score += 3;
      
      // Keywords matches
      const cleanRegionName = data.name.replace(/(Left|Right|Central)/, '').trim().toLowerCase();
      if (lowerQuery.includes(cleanRegionName)) score += 5;

      if (score > matchScore) {
        matchScore = score;
        bestMatchKey = key;
      }
    });

    if (bestMatchKey && matchScore > 0) {
      const data = anatomyData[bestMatchKey];
      setActiveOrgan(bestMatchKey);
      setMessages([
        ...currentMessages,
        {
          role: 'ai',
          text: `### ${data.name} (${data.system} System)
**Description:** ${data.description}

**Function:** ${data.function}

**Clinical Significance:** ${data.clinical}

*Note: Running in offline dictionary mode. Set API key for interactive questions.*`
        }
      ]);
    } else {
      // General fallback reply
      setMessages([
        ...currentMessages,
        {
          role: 'ai',
          text: `I couldn't find a specific anatomical region matching **"${query}"** in my offline dictionary. \n\nTry asking about regions like: *Frontal region*, *Carotid triangle*, *Umbilical region*, or *Deltoid region*, or select them directly on the 3D model.`
        }
      ]);
    }
  };

  // Helper to get meshes belonging to the selected system
  const systemMeshes = Object.values(anatomyData).filter(
    item => item.system === selectedSystem
  );

  // Reset anatomical model camera focus
  const handleResetCamera = () => {
    setActiveOrgan(null);
    setHighlightedOrgans([]); // Clear bulk highlights on reset
  };

  const activeOrganData = activeOrgan ? anatomyData[activeOrgan] : null;

  return (
    <div style={isMobile ? { 
      position: 'relative', 
      width: '100vw', 
      height: '100vh', 
      background: '#ffffff', 
      color: '#1e293b', 
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      overflow: 'hidden'
    } : { 
      display: 'flex', 
      position: 'relative',
      width: '100vw', 
      height: '100vh', 
      background: '#ffffff', 
      color: '#1e293b', 
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' 
    }}>
      
      {/* Mobile Sidebar Overlay Backdrop */}
      {isMobile && sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(15, 23, 42, 0.15)',
            zIndex: 140
          }}
        />
      )}

      {/* LEFT: CHAT AND ANATOMY PANEL */}
      <div style={isMobile ? {
        position: 'absolute',
        bottom: '16px',
        left: '16px',
        right: '16px',
        zIndex: 100,
        background: 'rgba(255, 255, 255, 0.96)',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        display: 'flex',
        flexDirection: 'column',
        height: chatExpanded ? '400px' : '57px',
        maxHeight: '65vh',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden'
      } : { 
        width: '420px', 
        minWidth: '420px',
        maxWidth: '420px',
        flexShrink: 0,
        flexGrow: 0,
        borderRight: '1px solid #e2e8f0', 
        display: 'flex', 
        flexDirection: 'column', 
        background: '#ffffff' 
      }}>
        
        {/* Chat Panel Header (shows expand button if sidebar is closed) */}
        <div 
          onClick={() => isMobile && setChatExpanded(!chatExpanded)}
          style={{ 
            padding: '16px 20px', 
            borderBottom: '1px solid #e2e8f0', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            background: '#ffffff', 
            height: '57px', 
            minHeight: '57px', 
            boxSizing: 'border-box',
            cursor: isMobile ? 'pointer' : 'default',
            userSelect: 'none'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.03em' }}>SOMA</h2>
            {isMobile && (
              <span style={{ fontSize: '10px', color: '#94a3b8', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }}>
                {chatExpanded ? 'Tap to hide' : 'Tap to chat'}
              </span>
            )}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Mobile-only sidebar toggle */}
            {isMobile && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSidebarOpen(true);
                }}
                title="Expand Sidebar"
                style={{ border: 'none', background: '#f1f5f9', cursor: 'pointer', padding: '6px', borderRadius: '6px', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <PanelRight size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Active Organ Detail Card */}
        {activeOrganData ? (
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: '700', color: '#3b82f6', background: '#dbeafe', padding: '2px 6px', borderRadius: '4px' }}>
                  {activeOrganData.system}
                </span>
                <h3 style={{ margin: '6px 0 2px 0', fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                  {activeOrganData.name}
                </h3>
              </div>
              <button 
                onClick={handleResetCamera}
                style={{ fontSize: '11px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#64748b', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                Clear Focus
              </button>
            </div>
            
            <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#475569', lineHeight: '1.4' }}>
              <strong>Description:</strong> {activeOrganData.description}
            </p>
            
            <button
              onClick={() => {
                setInput(`Explain the clinical significance and structure of the ${activeOrganData.name}`);
              }}
              style={{
                marginTop: '10px',
                width: '100%',
                padding: '6px',
                background: '#ffffff',
                border: '1px solid #3b82f6',
                color: '#2563eb',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = '#eff6ff';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = '#ffffff';
              }}
            >
              Ask tutor about this region
            </button>
          </div>
        ) : (
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '13px', background: '#f8fafc' }}>
            <Info size={16} />
            <span>Click any body part in the 3D model to inspect.</span>
          </div>
        )}

        {/* Chat History Panel */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {messages.map((m, i) => {
            if (m.role === 'command_result') {
              return (
                <div 
                  key={i} 
                  onClick={() => handleTriggerHighlight(m.organIds, m.label)}
                  style={{ 
                    alignSelf: 'center', 
                    background: '#eff6ff', 
                    color: '#1e40af', 
                    border: '1px solid #bfdbfe',
                    borderRadius: '12px',
                    padding: '10px 14px',
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                    transition: 'all 0.2s',
                    userSelect: 'none',
                    textAlign: 'center',
                    width: '90%',
                    maxWidth: '320px'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = '#dbeafe';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = '#eff6ff';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700' }}>
                    <Layers size={14} />
                    <span>Command Triggered: {m.label}</span>
                  </div>
                  <span style={{ fontSize: '11px', opacity: 0.8 }}>
                    Highlighted {m.organIds.length} regions. Click to rotate & re-highlight.
                  </span>
                </div>
              );
            }
            if (m.role === 'system') {
              return (
                <div key={i} style={{ alignSelf: 'center', background: '#f1f5f9', color: '#475569', fontSize: '11px', padding: '4px 10px', borderRadius: '12px', fontWeight: '500' }}>
                  {m.text.replace(/\*\*/g, '')}
                </div>
              );
            }
            const isAi = m.role === 'ai';
            return (
              <div 
                key={i} 
                style={{ 
                  alignSelf: isAi ? 'flex-start' : 'flex-end', 
                  maxWidth: '85%',
                  background: isAi ? '#f8fafc' : '#3b82f6',
                  color: isAi ? '#1e293b' : '#ffffff',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: isAi ? '1px solid #e2e8f0' : 'none',
                  fontSize: '13px',
                  lineHeight: '1.5'
                }}
              >
                <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px', opacity: 0.7, color: isAi ? '#64748b' : '#dbeafe' }}>
                  {isAi ? 'Anatomy Tutor' : 'You'}
                </div>
                {/* Basic rendering of simple markdown bullets and headers */}
                <div style={{ whiteSpace: 'pre-line' }}>
                  {m.text.split('\n').map((line, idx) => {
                    if (line.startsWith('### ')) {
                      return <h4 key={idx} style={{ margin: '8px 0 4px 0', fontSize: '14px', fontWeight: '700' }}>{line.replace('### ', '')}</h4>;
                    }
                    if (line.startsWith('* ')) {
                      return <li key={idx} style={{ marginLeft: '12px', marginBottom: '2px' }}>{line.replace('* ', '')}</li>;
                    }
                    return <span key={idx}>{line}<br/></span>;
                  })}
                </div>
              </div>
            );
          })}
          
          {isPending && (
            <div style={{ alignSelf: 'flex-start', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', padding: '12px 16px', borderRadius: '12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RefreshCw size={14} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
              <span>Tutor is thinking...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input box */}
        <form onSubmit={handleSendQuery} style={{ padding: '16px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '8px', background: '#ffffff' }}>
          <input 
            value={input} 
            onChange={(e) => setInput(e.target.value)}
            placeholder={activeOrganData ? `Ask about ${activeOrganData.name}...` : "Ask about an organ..."}
            style={{ 
              flex: 1, 
              padding: '10px 14px', 
              background: '#ffffff', 
              border: '1px solid #cbd5e1', 
              borderRadius: '8px', 
              fontSize: '13px', 
              color: '#1e293b', 
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
            onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
          />
          <button 
            type="submit" 
            disabled={isPending || !input.trim()}
            style={{ 
              padding: '10px 14px', 
              background: input.trim() && !isPending ? '#3b82f6' : '#e2e8f0', 
              color: input.trim() && !isPending ? '#ffffff' : '#94a3b8', 
              border: 'none', 
              borderRadius: '8px', 
              cursor: input.trim() && !isPending ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s'
            }}
          >
            <Send size={16} />
          </button>
        </form>
      </div>

      {/* CENTER: 3D HUMAN CANVAS VIEW */}
      <div style={isMobile ? {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: '#ffffff',
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column'
      } : { 
        flex: 1, 
        position: 'relative', 
        display: 'flex', 
        flexDirection: 'column', 
        background: '#ffffff',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        
        {/* Floating Tooltip/Hover Banner - Static position relative to left edge */}
        <div style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 10, background: 'rgba(255, 255, 255, 0.95)', border: '1px solid #e2e8f0', padding: '8px 14px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)', display: 'flex', flexDirection: 'column', gap: '2px', pointerEvents: 'none' }}>
          <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: '700', color: '#94a3b8' }}>Hovered Region</span>
          <span style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>
            {hoveredOrgan ? (anatomyData[hoveredOrgan]?.name || hoveredOrgan) : 'None'}
          </span>
        </div>

        {/* Legend Panel & Reset view - Static position aligned to the right side of the canvas */}
        <div style={{ 
          position: 'absolute', 
          top: '16px', 
          left: 'auto', 
          right: isMobile ? '16px' : '60px', 
          zIndex: 10, 
          display: 'flex', 
          gap: '8px', 
          alignItems: 'center' 
        }}>
          <button
            onClick={handleResetCamera}
            style={{
              padding: '8px 12px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#475569',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
              whiteSpace: 'nowrap'
            }}
          >
            Reset View
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', padding: '6px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '11px', fontWeight: '600', color: '#475569', whiteSpace: 'nowrap' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: apiKey ? '#22c55e' : '#f59e0b' }}></span>
            <span>{apiKey ? 'Online (Gemini)' : 'Offline (Local Dict)'}</span>
          </div>
        </div>

        {/* 3D Canvas */}
        <div style={{ flex: 1, width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
          <Canvas 
            shadows
            camera={{ position: [0, 0, 4.5], fov: 45 }}
            style={{ background: '#ffffff' }}
          >
            <color attach="background" args={['#ffffff']} />
            
            {/* Elegant Studio Lighting */}
            <ambientLight intensity={1.2} color="#ffffff" />
            <directionalLight 
              position={[5, 10, 5]} 
              intensity={1.0} 
              castShadow 
              shadow-mapSize-width={2048} 
              shadow-mapSize-height={2048} 
              shadow-camera-left={-2}
              shadow-camera-right={2}
              shadow-camera-top={2.5}
              shadow-camera-bottom={-2.5}
              shadow-camera-near={0.1}
              shadow-camera-far={25}
              shadow-bias={-0.001}
            />
            <directionalLight position={[-5, 5, -5]} intensity={0.4} color="#e2e8f0" />
            <pointLight position={[0, -3, 2]} intensity={0.6} color="#ffffff" />

            <Model 
              activeOrgan={activeOrgan} 
              hoveredOrgan={hoveredOrgan}
              onSelectOrgan={handleSelectOrgan}
              onHoverOrgan={setHoveredOrgan}
              highlightedOrgans={highlightedOrgans}
            />

            <CameraControls activeOrgan={activeOrgan} highlightedOrgans={highlightedOrgans} />
            <OrbitControls makeDefault enableDamping dampingFactor={0.05} />
          </Canvas>
        </div>
      </div>

      {/* RIGHT: SIDEBAR: SYSTEM & REGIONS SELECTOR */}
      <div style={isMobile ? {
        position: 'absolute',
        top: 0,
        right: 0,
        height: '100%',
        width: '280px',
        zIndex: 150,
        background: '#f8fafc',
        borderLeft: '1px solid #e2e8f0',
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column',
        pointerEvents: sidebarOpen ? 'auto' : 'none'
      } : { 
        width: sidebarOpen ? '280px' : '0px', 
        minWidth: sidebarOpen ? '280px' : '0px', 
        flexShrink: 0,
        flexGrow: 0,
        pointerEvents: sidebarOpen ? 'auto' : 'none',
        borderLeft: sidebarOpen ? '1px solid #e2e8f0' : 'none', 
        display: 'flex', 
        flexDirection: 'column', 
        background: '#f8fafc',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
        position: 'relative'
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '57px', minHeight: '57px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isMobile && (
              <button 
                onClick={() => setSidebarOpen(false)} 
                title="Close Sidebar"
                style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '6px', borderRadius: '6px', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                onMouseOver={(e) => e.currentTarget.style.background = '#e2e8f0'}
                onMouseOut={(e) => e.currentTarget.style.background = 'none'}
              >
                <X size={18} />
              </button>
            )}
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a', letterSpacing: '-0.025em', whiteSpace: 'nowrap' }}>SOMA Explorer</h2>
          </div>
          <button 
            onClick={() => setShowSettings(!showSettings)} 
            title="Settings"
            style={{ 
              border: 'none', 
              background: 'none', 
              cursor: 'pointer', 
              padding: '6px', 
              borderRadius: '6px', 
              color: '#64748b', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              transition: 'all 0.2s',
              marginRight: isMobile ? '0px' : '36px' // Shift left to make room for toggle button
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#e2e8f0'}
            onMouseOut={(e) => e.currentTarget.style.background = 'none'}
          >
            <Settings size={18} />
          </button>
        </div>

        {/* System Category Tabs */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #e2e8f0', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {systems.map((sys) => (
            <button
              key={sys}
              onClick={() => handleSelectSystem(sys)}
              style={{
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: '600',
                borderRadius: '4px',
                border: '1px solid',
                borderColor: selectedSystem === sys ? '#3b82f6' : '#cbd5e1',
                background: selectedSystem === sys ? '#eff6ff' : '#ffffff',
                color: selectedSystem === sys ? '#1d4ed8' : '#475569',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {sys}
            </button>
          ))}
        </div>

        {/* Scrollable list of regions in the selected system */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '8px', paddingLeft: '8px' }}>
            {selectedSystem} Regions ({systemMeshes.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {systemMeshes.map((mesh) => {
              const isSelected = activeOrgan === mesh.id;
              const isHovered = hoveredOrgan === mesh.id;
              return (
                <button
                  key={mesh.id}
                  onClick={() => {
                    handleSelectOrgan(mesh.id);
                    if (isMobile) setSidebarOpen(false); // Auto-close drawer on select
                  }}
                  onMouseEnter={() => setHoveredOrgan(mesh.id)}
                  onMouseLeave={() => setHoveredOrgan(null)}
                  style={{
                    textAlign: 'left',
                    padding: '8px 12px',
                    fontSize: '13px',
                    borderRadius: '6px',
                    border: 'none',
                    background: isSelected ? '#3b82f6' : (isHovered ? '#e2e8f0' : 'transparent'),
                    color: isSelected ? '#ffffff' : '#334155',
                    cursor: 'pointer',
                    transition: 'all 0.1s',
                    fontWeight: isSelected ? '600' : 'normal',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {mesh.name.replace(/(Left|Right|Central)\s*/, '')} 
                  <span style={{ fontSize: '10px', float: 'right', opacity: 0.6 }}>
                    {mesh.side !== 'Central' ? mesh.side[0] : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* SETTINGS DRAWER MODAL */}
      {showSettings && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.3)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#ffffff', width: '90%', maxWidth: '420px', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>Gemini Tutor Settings</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b', lineHeight: '1.4' }}>
              Enter your Gemini API Key to enable general reasoning and anatomical queries. The key is stored locally in your browser.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>Gemini API Key</label>
              <input
                type="password"
                value={settingsKeyInput}
                onChange={(e) => setSettingsKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                style={{ padding: '10px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '6px', width: '100%', boxSizing: 'border-color 0.2s', outline: 'none' }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setShowSettings(false)}
                style={{ padding: '8px 14px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleSaveApiKey(settingsKeyInput);
                }}
                style={{ padding: '8px 14px', border: 'none', background: '#3b82f6', color: '#ffffff', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Sidebar Toggle Button - Static position on the right side of the screen */}
      {!isMobile && (
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          title={sidebarOpen ? "Collapse Explorer" : "Expand Explorer"}
          style={{
            position: 'absolute',
            top: '19px',
            right: '16px',
            zIndex: 999, // Set zIndex to 999 to guarantee clickability above canvas/sidebar
            border: 'none',
            background: '#ffffff',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '6px',
            color: sidebarOpen ? '#3b82f6' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
            border: '1px solid #e2e8f0',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = '#f1f5f9'}
          onMouseOut={(e) => e.currentTarget.style.background = '#ffffff'}
        >
          <PanelRight size={18} />
        </button>
      )}
    </div>
  );
}

export default App;
