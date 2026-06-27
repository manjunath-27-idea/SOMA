import React, { useState, useEffect, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, useProgress } from '@react-three/drei';
import { Model } from './Model';
import { CameraControls } from './CameraControls';
import { anatomyData, systems } from './AnatomyData';
import { skeletonAnatomyData } from './SkeletonAnatomyData';
import { cardioAnatomyData } from './CardioAnatomyData';
import { heartAnatomyData } from './HeartAnatomyData';
import { nervousAnatomyData } from './NervousAnatomyData';

const allSystems = [...systems, "Cardiovascular", "Heart", "Nervous"];

// Dynamic directional light that follows the camera position to keep the focused side illuminated
function CameraLight() {
  const { camera } = useThree();
  const topLightRef = useRef();
  const midLightRef = useRef();
  const botLightRef = useRef();
  
  useFrame(() => {
    if (topLightRef.current && midLightRef.current && botLightRef.current) {
      const { x, y, z } = camera.position;
      // Top light: offset upwards
      topLightRef.current.position.set(x, y + 2.0, z);
      // Middle light: camera position
      midLightRef.current.position.set(x, y, z);
      // Bottom light: offset downwards
      botLightRef.current.position.set(x, y - 2.0, z);
    }
  });

  return (
    <>
      {/* Top light for head/neck/upper chest */}
      <directionalLight 
        ref={topLightRef}
        intensity={0.8} 
        castShadow 
        shadow-mapSize-width={1024} 
        shadow-mapSize-height={1024} 
        shadow-bias={-0.001}
      />
      {/* Middle light for chest/heart/abdomen */}
      <directionalLight 
        ref={midLightRef}
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
      {/* Bottom light for limbs/legs */}
      <directionalLight 
        ref={botLightRef}
        intensity={0.6} 
        castShadow 
        shadow-mapSize-width={1024} 
        shadow-mapSize-height={1024} 
        shadow-bias={-0.001}
      />
    </>
  );
}
import { askGeminiTutor } from './GeminiService';
import { Send, Settings, RefreshCw, Layers, MessageSquare, Info, AlertCircle, HelpCircle, PanelRight, PanelRightClose, PanelRightOpen, X, Play, Pause, ChevronLeft, ChevronRight } from 'lucide-react';

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
  const [showBody, setShowBody] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [showCardio, setShowCardio] = useState(false);
  const [showHeart, setShowHeart] = useState(false);
  const [showNervous, setShowNervous] = useState(false);
  const [heartbeatActive, setHeartbeatActive] = useState(false);
  const [heartbeatBpm, setHeartbeatBpm] = useState(72);
  const [blenderTexts, setBlenderTexts] = useState(null);

  const { active, progress } = useProgress();
  const [showLoader, setShowLoader] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (!active && progress === 100) {
      setFadeOut(true);
      const timer = setTimeout(() => {
        setShowLoader(false);
      }, 800);
      return () => clearTimeout(timer);
    } else {
      setShowLoader(true);
      setFadeOut(false);
    }
  }, [active, progress]);

  useEffect(() => {
    fetch('./blender_texts.json')
      .then(res => res.json())
      .then(data => setBlenderTexts(data))
      .catch(err => console.error('Failed to load Blender texts:', err));
  }, []);

  const [tourActive, setTourActive] = useState(false);
  const [tourRegions, setTourRegions] = useState([]);
  const [tourIndex, setTourIndex] = useState(0);
  const [tourPlaying, setTourPlaying] = useState(false);
  const [manualFocus, setManualFocus] = useState(false);

  // Auto-play timer for the tour
  useEffect(() => {
    let timer;
    if (tourActive && tourPlaying) {
      timer = setInterval(() => {
        setTourIndex((prev) => {
          if (prev >= tourRegions.length - 1) {
            setTourPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 4000); // 4 seconds per step
    }
    return () => clearInterval(timer);
  }, [tourActive, tourPlaying, tourRegions.length]);

  // Handle camera & selection updates when step index changes
  useEffect(() => {
    if (tourActive && tourRegions.length > 0 && tourRegions[tourIndex]) {
      const currentStep = tourRegions[tourIndex];
      // Select the first mesh in this step to load descriptions/metadata
      setActiveOrgan(currentStep.keys[0]);
      // Highlight all matching keys in this step (e.g. left and right sides)
      setHighlightedOrgans(currentStep.keys);
    }
  }, [tourIndex, tourActive, tourRegions]);

  const handleTriggerHighlight = (organIds, label) => {
    setActiveOrgan(null);
    setHighlightedOrgans(organIds);
    setInput(`/${label}`);
  };

  const handleSelectSystem = (sys) => {
    setSelectedSystem(sys);
    
    // Highlight all organs in this system (body, skeleton, cardio, or heart)
    const bodyOrganIds = Object.keys(anatomyData).filter(
      key => anatomyData[key].system.toLowerCase() === sys.toLowerCase()
    );
    const skeletonOrganIds = Object.keys(skeletonAnatomyData).filter(
      key => skeletonAnatomyData[key].system.toLowerCase() === sys.toLowerCase()
    );
    const cardioOrganIds = Object.keys(cardioAnatomyData).filter(
      key => cardioAnatomyData[key].system.toLowerCase() === sys.toLowerCase()
    );
    const heartOrganIds = Object.keys(heartAnatomyData).filter(
      key => heartAnatomyData[key].system.toLowerCase() === sys.toLowerCase()
    );
    const nervousOrganIds = Object.keys(nervousAnatomyData).filter(
      key => nervousOrganIds && nervousAnatomyData[key].system.toLowerCase() === sys.toLowerCase()
    );
    const organIds = sys === "Cardiovascular" ? cardioOrganIds : 
                     (sys === "Heart" ? heartOrganIds : 
                      (sys === "Nervous" ? nervousOrganIds : [...bodyOrganIds, ...skeletonOrganIds]));
    
    if (sys === "Cardiovascular") {
      setShowCardio(true);
    } else if (sys === "Heart") {
      setShowHeart(true);
      setShowCardio(false);
      setShowBody(false);
      setShowSkeleton(false);
    } else if (sys === "Nervous") {
      setShowNervous(true);
      setShowHeart(false);
      setShowCardio(false);
      setShowBody(false);
      setShowSkeleton(false);
    }
    
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
    if (tourActive) {
      setTourPlaying(false);
      setManualFocus(true);
    }
    
    // If the organ exists in our database, add a clean informational note in the chat
    const data = anatomyData[organId] || skeletonAnatomyData[organId] || cardioAnatomyData[organId] || heartAnatomyData[organId] || nervousAnatomyData[organId];
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
  const findMatchingRegions = (queryText) => {
    const cleanQuery = queryText.startsWith('/') ? queryText.substring(1).trim().toLowerCase() : queryText.trim().toLowerCase();
    if (!cleanQuery) return [];

    const matchedKeys = new Set();

    const checkMatch = (key, data) => {
      const systemName = data.system.toLowerCase();
      const regionName = data.name.toLowerCase();
      const cleanRegion = data.name.replace(/(Left|Right|Central)\s*/i, '').trim().toLowerCase();
      const idLower = key.toLowerCase();
      const idParts = key.split('.');
      const baseId = idParts.slice(0, 2).join('.').toLowerCase(); // ignore side and index

      // Check system name match, region name match, clean region name match, ID match, base ID match
      if (systemName === cleanQuery || 
          regionName === cleanQuery || 
          cleanRegion === cleanQuery || 
          idLower === cleanQuery ||
          baseId === cleanQuery ||
          systemName.includes(cleanQuery) || 
          regionName.includes(cleanQuery) || 
          cleanRegion.includes(cleanQuery) || 
          idLower.includes(cleanQuery) ||
          baseId.includes(cleanQuery)) {
        matchedKeys.add(key);
      }
    };

    Object.keys(anatomyData).forEach(key => checkMatch(key, anatomyData[key]));
    Object.keys(skeletonAnatomyData).forEach(key => checkMatch(key, skeletonAnatomyData[key]));
    Object.keys(cardioAnatomyData).forEach(key => checkMatch(key, cardioAnatomyData[key]));
    Object.keys(heartAnatomyData).forEach(key => checkMatch(key, heartAnatomyData[key]));
    Object.keys(nervousAnatomyData).forEach(key => checkMatch(key, nervousAnatomyData[key]));

    // Group the keys by their base region (System.RegionName)
    // e.g. group "Head.Frontal region.l.001" and "Head.Frontal region.r.001" together
    const grouped = {};
    matchedKeys.forEach(key => {
      const parts = key.split('.');
      const baseName = parts.slice(0, 2).join('.'); // "Head.Frontal region"
      if (!grouped[baseName]) {
        const data = anatomyData[key] || skeletonAnatomyData[key] || cardioAnatomyData[key] || heartAnatomyData[key] || nervousAnatomyData[key];
        const cleanLabel = data.name.replace(/(Left|Right|Central)\s*/i, '');
        grouped[baseName] = {
          name: cleanLabel,
          system: data.system,
          keys: []
        };
      }
      grouped[baseName].keys.push(key);
    });

    return Object.values(grouped); // returns list of { name, system, keys: [] }
  };

  // Performs command processing and AI/Offline tutoring queries
  const triggerSlashCommand = async (userText, currentMessages = messages) => {
    if (isPending) return;

    // Check if query matches any regions/systems in SOMA
    const matchedRegions = findMatchingRegions(userText);

    if (matchedRegions.length > 0) {
      const allKeys = matchedRegions.flatMap(r => r.keys);
      const newMessages = [...currentMessages, { role: 'user', text: userText }];
      setMessages(newMessages);
      
      // If exactly one region matched (e.g. Left/Right Frontal Region)
      if (matchedRegions.length === 1) {
        handleSelectOrgan(matchedRegions[0].keys[0]);
        // Also highlight all keys of this region (both sides)
        setHighlightedOrgans(matchedRegions[0].keys);
        return;
      }

      // Highlight all matched keys
      setActiveOrgan(null);
      setHighlightedOrgans(allKeys);

      // Build chat response with list of regions and descriptions
      let responseText = `### 🔍 Matches found for "${userText}":\n`;
      matchedRegions.forEach((r) => {
        const data = anatomyData[r.keys[0]] || skeletonAnatomyData[r.keys[0]] || cardioAnatomyData[r.keys[0]] || heartAnatomyData[r.keys[0]] || nervousAnatomyData[r.keys[0]];
        responseText += `* **${r.name}** (${r.system} System): ${data.description}\n`;
      });

      responseText += `\n*Note: Found ${matchedRegions.length} matching regions. Click the button below to take an interactive tour.*`;

      setMessages([
        ...newMessages,
        {
          role: 'ai',
          text: responseText,
          tourRegions: matchedRegions
        }
      ]);
      return;
    }

    setIsPending(true);
    const newMessages = [...currentMessages, { role: 'user', text: userText }];
    setMessages(newMessages);

    if (apiKey) {
      // ONLINE MODE: Call Gemini
      try {
        const response = await askGeminiTutor(newMessages, apiKey, activeOrgan);
        
        setMessages([
          ...newMessages,
          { role: 'ai', text: response.text }
        ]);

        if (response.highlight) {
          // Verify it's a valid node name (body, skeleton, or cardio)
          const matchedNode = Object.keys(anatomyData).find(
            key => key.toLowerCase() === response.highlight.toLowerCase() || 
                   key.toLowerCase().includes(response.highlight.toLowerCase())
          ) || Object.keys(skeletonAnatomyData).find(
            key => key.toLowerCase() === response.highlight.toLowerCase() || 
                   key.toLowerCase().includes(response.highlight.toLowerCase())
          ) || Object.keys(cardioAnatomyData).find(
            key => key.toLowerCase() === response.highlight.toLowerCase() || 
                   key.toLowerCase().includes(response.highlight.toLowerCase())
          ) || Object.keys(heartAnatomyData).find(
            key => key.toLowerCase() === response.highlight.toLowerCase() || 
                   key.toLowerCase().includes(response.highlight.toLowerCase())
          ) || Object.keys(nervousAnatomyData).find(
            key => key.toLowerCase() === response.highlight.toLowerCase() || 
                   key.toLowerCase().includes(response.highlight.toLowerCase())
          );
          if (matchedNode) {
            handleSelectOrgan(matchedNode);
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

  // Perform search / AI query from Form submission
  const handleSendQuery = async (e) => {
    e?.preventDefault();
    if (!input.trim() || isPending) return;

    const userText = input.trim();
    setInput('');
    triggerSlashCommand(userText);
  };

  // Search local knowledge base for matches
  const triggerOfflineSearch = (query, currentMessages) => {
    const lowerQuery = query.toLowerCase();
    
    // 1. Detect query intent
    const isClinical = ['pain', 'hurt', 'clinical', 'disease', 'symptom', 'sign', 'effect', 'problem', 'doctor', 'medical', 'condition', 'significance', 'pathology', 'fracture'].some(word => lowerQuery.includes(word));
    const isFunction = ['function', 'do', 'role', 'work', 'action', 'use', 'purpose', 'job', 'mechanism', 'physiology'].some(word => lowerQuery.includes(word));
    
    let bestMatchKey = null;
    let matchScore = 0;
    let matchType = 'body'; // 'body', 'skeleton', or 'cardio'

    // Look for exact/partial name matches in our body keys
    Object.keys(anatomyData).forEach(key => {
      const data = anatomyData[key];
      const name = data.name.toLowerCase();
      
      let score = 0;
      if (lowerQuery.includes(name)) score += 10;
      if (lowerQuery.includes(data.id.toLowerCase())) score += 8;
      
      const cleanRegionName = data.name.replace(/(Left|Right|Central)/, '').trim().toLowerCase();
      if (lowerQuery.includes(cleanRegionName)) score += 5;

      if (score > matchScore) {
        matchScore = score;
        bestMatchKey = key;
        matchType = 'body';
      }
    });

    // Look for exact/partial name matches in our skeleton keys
    Object.keys(skeletonAnatomyData).forEach(key => {
      const data = skeletonAnatomyData[key];
      const name = data.name.toLowerCase();
      
      let score = 0;
      if (lowerQuery.includes(name)) score += 10;
      if (lowerQuery.includes(data.id.toLowerCase())) score += 8;
      
      const cleanRegionName = data.name.replace(/(Left|Right|Central)/, '').trim().toLowerCase();
      if (lowerQuery.includes(cleanRegionName)) score += 5;

      if (score > matchScore) {
        matchScore = score;
        bestMatchKey = key;
        matchType = 'skeleton';
      }
    });

    // Look for exact/partial name matches in our cardio keys
    Object.keys(cardioAnatomyData).forEach(key => {
      const data = cardioAnatomyData[key];
      const name = data.name.toLowerCase();
      
      let score = 0;
      if (lowerQuery.includes(name)) score += 10;
      if (lowerQuery.includes(data.id.toLowerCase())) score += 8;
      
      const cleanRegionName = data.name.replace(/(Left|Right|Central)/, '').trim().toLowerCase();
      if (lowerQuery.includes(cleanRegionName)) score += 5;

      if (score > matchScore) {
        matchScore = score;
        bestMatchKey = key;
        matchType = 'cardio';
      }
    });

    // Look for exact/partial name matches in our heart keys
    Object.keys(heartAnatomyData).forEach(key => {
      const data = heartAnatomyData[key];
      const name = data.name.toLowerCase();
      
      let score = 0;
      if (lowerQuery.includes(name)) score += 10;
      if (lowerQuery.includes(data.id.toLowerCase())) score += 8;
      
      const cleanRegionName = data.name.replace(/(Left|Right|Central)/, '').trim().toLowerCase();
      if (lowerQuery.includes(cleanRegionName)) score += 5;

      if (score > matchScore) {
        matchScore = score;
        bestMatchKey = key;
        matchType = 'heart';
      }
    });

    if (bestMatchKey && matchScore > 0) {
      const data = matchType === 'skeleton' ? skeletonAnatomyData[bestMatchKey] : 
                   (matchType === 'cardio' ? cardioAnatomyData[bestMatchKey] : 
                    (matchType === 'heart' ? heartAnatomyData[bestMatchKey] : 
                     (matchType === 'nervous' ? nervousAnatomyData[bestMatchKey] : anatomyData[bestMatchKey])));
      setActiveOrgan(bestMatchKey);
      setHighlightedOrgans([bestMatchKey]); // Highlight the organ
      
      // Look up detailed Blender description
      let detailedNotes = '';
      const parts = bestMatchKey.split('.');
      if (parts.length >= 2) {
        const regionName = parts[1];
        if (blenderTexts) {
          let text = blenderTexts[regionName];
          if (!text) {
            const key = Object.keys(blenderTexts).find(k => k.toLowerCase() === regionName.toLowerCase());
            if (key) text = blenderTexts[key];
          }
          if (text) {
            detailedNotes = text.trim();
          }
        }
      }

      let responseText = '';
      if (isClinical) {
        responseText = `### 🏥 Clinical Notes: ${data.name}
**Primary Clinical Significance:**
> ${data.clinical}

---
**Overview:**
${data.description}

**Functional Role:**
${data.function}
`;
      } else if (isFunction) {
        responseText = `### ⚙️ Functional Role: ${data.name}
**Primary Function:**
> ${data.function}

---
**Overview:**
${data.description}

**Clinical Significance:**
${data.clinical}
`;
      } else {
        responseText = `### 📘 ${data.name} (${data.system} System)
**Description:**
${data.description}

**Function:**
${data.function}

**Clinical Significance:**
${data.clinical}
`;
      }

      if (detailedNotes) {
        // Strip duplicate header titles from Blender notes if they are parenthesized
        const cleanedNotes = detailedNotes.replace(/^\([^)]+\)\s*/gi, '');
        responseText += `\n\n**Detailed Structure & Anatomy (from Blender):**\n${cleanedNotes}`;
      }

      responseText += `\n\n*Note: Running in offline lookup mode. Configure a Gemini API key in settings for interactive tutoring.*`;

      setMessages([
        ...currentMessages,
        {
          role: 'ai',
          text: responseText
        }
      ]);
    } else {
      // Find suggestions (fuzzy search for related regions)
      const suggestions = [];
      const queryWords = lowerQuery.split(/\s+/).filter(w => w.length > 2);
      
      if (queryWords.length > 0) {
        const checkSuggest = (key, data) => {
          const name = data.name.toLowerCase();
          const matches = queryWords.filter(word => name.includes(word) || key.toLowerCase().includes(word));
          if (matches.length > 0 && !suggestions.some(s => s.key === key)) {
            suggestions.push({ key, name: data.name, score: matches.length });
          }
        };

        Object.keys(anatomyData).forEach(key => checkSuggest(key, anatomyData[key]));
        Object.keys(skeletonAnatomyData).forEach(key => checkSuggest(key, skeletonAnatomyData[key]));
        Object.keys(cardioAnatomyData).forEach(key => checkSuggest(key, cardioAnatomyData[key]));
        Object.keys(heartAnatomyData).forEach(key => checkSuggest(key, heartAnatomyData[key]));
        Object.keys(nervousAnatomyData).forEach(key => checkSuggest(key, nervousAnatomyData[key]));
        suggestions.sort((a, b) => b.score - a.score);
      }

      let responseText = `I couldn't find a specific anatomical region matching **"${query}"** in the offline dictionary.\n\n`;
      
      if (suggestions.length > 0) {
        responseText += `Here are some related regions you can explore:`;
        suggestions.slice(0, 5).forEach(s => {
          responseText += `\n* Click /${s.name} to view details and highlight the region.`;
        });
      } else {
        responseText += `Try checking out these popular anatomical systems and regions:
* Click /head to show all regions in the Head.
* Click /abdomen to show all regions in the Abdomen.
* Click /Femur to inspect the thigh bone.
* Click /Frontal bone to inspect the skull forehead.`;
      }

      responseText += `\n\n💡 **Tip:** Set your **Gemini API Key** in settings (gear icon) to enable full conversational tutoring and get answers to any medical question!`;

      setMessages([
        ...currentMessages,
        {
          role: 'ai',
          text: responseText
        }
      ]);
    }
  };

  // Helper to get meshes belonging to the selected system from active layers
  const bodyMeshes = showBody ? Object.values(anatomyData).filter(
    item => item.system === selectedSystem
  ) : [];

  const skeletonMeshes = showSkeleton ? Object.values(skeletonAnatomyData).filter(
    item => item.system === selectedSystem
  ) : [];

  const cardioMeshes = showCardio ? Object.values(cardioAnatomyData).filter(
    item => item.system === selectedSystem
  ) : [];

  const heartMeshes = showHeart ? Object.values(heartAnatomyData).filter(
    item => item.system === selectedSystem
  ) : [];

  const nervousMeshes = showNervous ? Object.values(nervousAnatomyData).filter(
    item => item.system === selectedSystem
  ) : [];

  const systemMeshes = 
    selectedSystem === "Cardiovascular" ? cardioMeshes : 
    (selectedSystem === "Heart" ? heartMeshes : 
     (selectedSystem === "Nervous" ? nervousMeshes : [...bodyMeshes, ...skeletonMeshes]));

  // Reset anatomical model camera focus
  const handleResetCamera = () => {
    setActiveOrgan(null);
    setHighlightedOrgans([]); // Clear bulk highlights on reset
  };

  const cleanDisplayName = (name) => {
    if (!name) return '';
    let clean = name;
    // 1. Strip l/r sides separated by dot or underscore
    clean = clean.replace(/[\._][lr](?=\b|[\._]|$)/i, '');
    // 2. Strip trailing numerical suffixes like .001, _2, 001_2, .001_2
    clean = clean.replace(/[\._\s]?\d+[\._\s\d]*$/, '');
    // 3. Strip digits attached directly to word ends, e.g. region001 -> region
    clean = clean.replace(/(\D)\d+$/, '$1');

    const parts = clean.split('.');
    if (parts.length >= 2) {
      let regionName = parts[1];
      // Replace underscores with spaces and trim
      regionName = regionName.replace(/_/g, ' ').trim();
      if (regionName) {
        regionName = regionName.charAt(0).toUpperCase() + regionName.slice(1);
      }
      return regionName;
    }
    
    clean = clean.replace(/_/g, ' ').trim();
    if (clean) {
      clean = clean.charAt(0).toUpperCase() + clean.slice(1);
    }
    return clean;
  };

  const activeOrganData = activeOrgan ? (
    anatomyData[activeOrgan] || 
    skeletonAnatomyData[activeOrgan] || 
    cardioAnatomyData[activeOrgan] || 
    heartAnatomyData[activeOrgan] || 
    nervousAnatomyData[activeOrgan] || 
    {
      id: activeOrgan,
      name: cleanDisplayName(activeOrgan),
      system: showHeart ? "Heart" : (showNervous ? "Nervous" : "Cardiovascular"),
      description: `Part of the ${showHeart ? "heart" : (showNervous ? "nervous" : "cardiovascular")} system.`,
      function: "Supports anatomical structure and physiological function.",
      clinical: "Evaluated for physical health, trauma, or clinical deficits."
    }
  ) : null;

  // Extract region/bone name and match it with Blender text descriptions
  const getDetailedDesc = () => {
    if (!activeOrgan) return null;
    if (!blenderTexts) return null;
    let regionName = activeOrgan;
    
    // 1. strip suffixes like .l or .r first
    regionName = regionName.replace(/[\._][lr](?=\b|[\._]|$)/i, '');
    // 2. strip trailing numbers
    regionName = regionName.replace(/[\._\s]?\d+[\._\s\d]*$/, '');
    
    // 3. Then split by dot (category prefix)
    const parts = regionName.split('.');
    if (parts.length >= 2) {
      regionName = parts[1];
    }
    
    let text = blenderTexts[regionName];
    if (!text) {
      const key = Object.keys(blenderTexts).find(k => k.toLowerCase() === regionName.toLowerCase());
      if (key) text = blenderTexts[key];
    }
    return text;
  };
  const detailedDesc = getDetailedDesc();

  const renderLineWithClickableSlashCommands = (line, idx, isListItem = false) => {
    const regex = /(\/[a-zA-Z0-9.()_-]+(?:\s[a-zA-Z0-9.()_-]+)*)/g;
    const parts = line.split(regex);
    
    const content = parts.map((part, pIdx) => {
      if (part.startsWith('/')) {
        return (
          <button
            key={pIdx}
            onClick={() => {
              triggerSlashCommand(part);
            }}
            style={{
              background: '#eff6ff',
              border: '1px solid #3b82f6',
              color: '#2563eb',
              borderRadius: '4px',
              padding: '2px 6px',
              fontSize: '11px',
              fontWeight: '600',
              cursor: 'pointer',
              margin: '0 2px',
              display: 'inline-block',
              lineHeight: '1.2'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#dbeafe'}
            onMouseOut={(e) => e.currentTarget.style.background = '#eff6ff'}
          >
            {part}
          </button>
        );
      }
      return part;
    });

    if (isListItem) {
      return <li key={idx} style={{ marginLeft: '12px', marginBottom: '2px' }}>{content}</li>;
    }
    return <span key={idx}>{content}<br/></span>;
  };

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
      
      {/* Smooth Model Loading Overlay */}
      {showLoader && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: '#ffffff',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: fadeOut ? 0 : 1,
          transition: 'opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
          pointerEvents: fadeOut ? 'none' : 'auto',
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '24px',
            transform: fadeOut ? 'scale(0.95)' : 'scale(1)',
            transition: 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
          }}>
            <h1 style={{
              fontSize: '48px',
              fontWeight: '800',
              letterSpacing: '-0.05em',
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              margin: 0,
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}>
              SOMA
            </h1>
            <div style={{
              width: '240px',
              height: '6px',
              background: '#f1f5f9',
              borderRadius: '999px',
              overflow: 'hidden',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)'
            }}>
              <div style={{
                height: '100%',
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #3b82f6, #2563eb)',
                borderRadius: '999px',
                transition: 'width 0.3s ease-out'
              }} />
            </div>
            <span style={{
              fontSize: '14px',
              fontWeight: '500',
              color: '#64748b',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              minWidth: '60px',
              textAlign: 'center'
            }}>
              Loading Anatomy Model ({Math.round(progress)}%)
            </span>
          </div>
        </div>
      )}
      
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
        minWidth: '0px', 
        position: 'relative', 
        display: 'flex', 
        flexDirection: 'column', 
        background: '#ffffff',
        order: 2
      }}>
        
        {/* Floating Tooltip/Hover Banner - Static position relative to left edge */}
        <div style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 10, background: 'rgba(255, 255, 255, 0.95)', border: '1px solid #e2e8f0', padding: '8px 14px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)', display: 'flex', flexDirection: 'column', gap: '2px', pointerEvents: 'none' }}>
          <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: '700', color: '#94a3b8' }}>
            {hoveredOrgan ? 'Hovered Region' : (activeOrgan ? 'Selected Region' : 'Region Info')}
          </span>
          <span style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>
            {hoveredOrgan ? 
              (anatomyData[hoveredOrgan]?.name || skeletonAnatomyData[hoveredOrgan]?.name || cardioAnatomyData[hoveredOrgan]?.name || heartAnatomyData[hoveredOrgan]?.name || nervousAnatomyData[hoveredOrgan]?.name || cleanDisplayName(hoveredOrgan)) : 
              (activeOrgan ? (anatomyData[activeOrgan]?.name || skeletonAnatomyData[activeOrgan]?.name || cardioAnatomyData[activeOrgan]?.name || heartAnatomyData[activeOrgan]?.name || nervousAnatomyData[activeOrgan]?.name || cleanDisplayName(activeOrgan)) : 'None')}
          </span>
        </div>

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
        </div>

        {/* 3D Canvas */}
        <div style={{ flex: 1, width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
          <Canvas 
            shadows
            camera={{ position: [0, 0, isMobile ? 5.5 : 4.5], fov: 45 }}
            style={{ background: '#ffffff' }}
          >
            <color attach="background" args={['#ffffff']} />
            
            {/* Elegant Studio Lighting */}
            <ambientLight intensity={1.2} color="#ffffff" />
            <CameraLight />
            <directionalLight position={[-5, 5, -5]} intensity={0.4} color="#e2e8f0" />
            <pointLight position={[0, -3, 2]} intensity={0.6} color="#ffffff" />

            <Model 
              activeOrgan={activeOrgan} 
              hoveredOrgan={hoveredOrgan}
              onSelectOrgan={handleSelectOrgan}
              onHoverOrgan={setHoveredOrgan}
              highlightedOrgans={highlightedOrgans}
              showBody={showBody}
              showSkeleton={showSkeleton}
              showCardio={showCardio}
              showHeart={showHeart}
              showNervous={showNervous}
              heartbeatActive={heartbeatActive}
              heartbeatBpm={heartbeatBpm}
            />

            <CameraControls 
              activeOrgan={activeOrgan} 
              highlightedOrgans={highlightedOrgans} 
              zoomToWholeTour={tourActive && !manualFocus}
              tourRegions={tourRegions}
              showHeart={showHeart}
              showCardio={showCardio}
              showNervous={showNervous}
            />
            <OrbitControls makeDefault enableDamping dampingFactor={0.05} />
          </Canvas>

          {/* Glassmorphic Tour Controls Overlay */}
          {tourActive && tourRegions.length > 0 && tourRegions[tourIndex] && (
            <div style={{
              position: 'absolute',
              bottom: isMobile ? 'auto' : '24px',
              top: isMobile ? '80px' : 'auto',
              left: isMobile ? '16px' : '50%',
              transform: isMobile ? 'none' : 'translateX(-50%)',
              zIndex: 50,
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              background: 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.4)',
              boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
              borderRadius: '12px',
              padding: isMobile ? '8px 10px' : '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: isMobile ? '6px' : '12px',
              width: isMobile ? '110px' : 'auto',
              minWidth: isMobile ? '110px' : '300px',
              maxWidth: '90%',
              boxSizing: 'border-box'
            }}>
              {/* Tour Progress Info */}
              <div style={{ textAlign: 'center', width: '100%' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {isMobile ? `${tourIndex + 1}/${tourRegions.length}` : `Step {tourIndex + 1} of {tourRegions.length}`}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '14px' }}>
                {/* Prev Button */}
                <button
                  onClick={() => {
                    setTourPlaying(false);
                    setManualFocus(false);
                    setTourIndex((prev) => (prev > 0 ? prev - 1 : tourRegions.length - 1));
                  }}
                  title="Previous Step"
                  style={{
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    cursor: 'pointer',
                    padding: isMobile ? '4px' : '8px',
                    borderRadius: '50%',
                    color: '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = '#f1f5f9'}
                  onMouseOut={(e) => e.currentTarget.style.background = '#ffffff'}
                >
                  <ChevronLeft size={isMobile ? 12 : 16} />
                </button>

                {/* Play/Pause Button */}
                <button
                  onClick={() => {
                    setTourPlaying(!tourPlaying);
                    setManualFocus(false);
                  }}
                  title={tourPlaying ? "Pause Autoplay" : "Play Autoplay"}
                  style={{
                    border: 'none',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                    cursor: 'pointer',
                    padding: isMobile ? '6px' : '12px',
                    borderRadius: '50%',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 6px rgba(37, 99, 235, 0.2)'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  {tourPlaying ? <Pause size={isMobile ? 12 : 18} fill="#ffffff" /> : <Play size={isMobile ? 12 : 18} fill="#ffffff" />}
                </button>

                {/* Next Button */}
                <button
                  onClick={() => {
                    setTourPlaying(false);
                    setManualFocus(false);
                    setTourIndex((prev) => (prev < tourRegions.length - 1 ? prev + 1 : 0));
                  }}
                  title="Next Step"
                  style={{
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    cursor: 'pointer',
                    padding: isMobile ? '4px' : '8px',
                    borderRadius: '50%',
                    color: '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = '#f1f5f9'}
                  onMouseOut={(e) => e.currentTarget.style.background = '#ffffff'}
                >
                  <ChevronRight size={isMobile ? 12 : 16} />
                </button>
              </div>

              {/* Exit Tour Button */}
              <button
                onClick={() => {
                  setTourActive(false);
                  setTourPlaying(false);
                  setManualFocus(false);
                  handleResetCamera();
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#ef4444',
                  fontSize: isMobile ? '10px' : '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#fee2e2'}
                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
              >
                {isMobile ? 'Exit' : 'Exit Tour'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* LEFT: CHAT AND ANATOMY PANEL */}
      <div style={isMobile ? {
        position: 'absolute',
        bottom: '16px',
        left: '16px',
        right: '16px',
        zIndex: 100,
        background: 'rgba(255, 255, 255, 0.5)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        borderRadius: '12px',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        display: 'flex',
        flexDirection: 'column',
        height: chatExpanded ? '330px' : '57px',
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
        background: '#ffffff',
        order: 1
      }}>
        
        <div 
          onClick={() => isMobile && setChatExpanded(!chatExpanded)}
          style={{ 
            padding: '16px 20px', 
            borderBottom: isMobile ? '1px solid rgba(226, 232, 240, 0.3)' : '1px solid #e2e8f0', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            background: isMobile ? 'transparent' : '#ffffff', 
            height: '57px', 
            minHeight: '57px', 
            flexShrink: 0,
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

        {/* Chat History Panel */}
        <div style={{ 
          display: (isMobile && !chatExpanded) ? 'none' : 'flex',
          flex: 1, 
          minHeight: '0px',
          overflowY: 'auto', 
          padding: '20px', 
          flexDirection: 'column', 
          gap: '16px' 
        }}>
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
                      return renderLineWithClickableSlashCommands(line.replace('* ', ''), idx, true);
                    }
                    return renderLineWithClickableSlashCommands(line, idx, false);
                  })}
                </div>
                {isAi && m.tourRegions && m.tourRegions.length > 1 && (
                  <button
                    onClick={() => {
                      setTourRegions(m.tourRegions);
                      setTourIndex(0);
                      setTourActive(true);
                      setTourPlaying(true);
                      setManualFocus(false);
                    }}
                    style={{
                      marginTop: '12px',
                      width: '100%',
                      padding: '8px 12px',
                      background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                      border: 'none',
                      color: '#ffffff',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 4px 6px rgba(37, 99, 235, 0.3)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(37, 99, 235, 0.2)';
                    }}
                  >
                    <Play size={14} fill="#ffffff" />
                    <span>Take Interactive Tour ({m.tourRegions.length} regions)</span>
                  </button>
                )}
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
        <form 
          onSubmit={handleSendQuery} 
          style={{ 
            display: (isMobile && !chatExpanded) ? 'none' : 'flex',
            padding: '16px', 
            borderTop: isMobile ? '1px solid rgba(226, 232, 240, 0.3)' : '1px solid #e2e8f0', 
            gap: '8px', 
            background: isMobile ? 'transparent' : '#ffffff',
            flexShrink: 0
          }}
        >
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

      {/* RIGHT: SIDEBAR: SYSTEM & REGIONS SELECTOR */}
      <div style={isMobile ? {
        position: 'absolute',
        top: 0,
        right: 0,
        height: '100%',
        width: '280px',
        zIndex: 150,
        background: 'rgba(248, 250, 252, 0.5)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderLeft: '1px solid rgba(226, 232, 240, 0.3)',
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column',
        pointerEvents: sidebarOpen ? 'auto' : 'none'
      } : { 
        width: sidebarOpen ? '280px' : '0px', 
        minWidth: '0px', 
        flexShrink: 0,
        flexGrow: 0,
        pointerEvents: sidebarOpen ? 'auto' : 'none',
        borderLeft: sidebarOpen ? '1px solid #e2e8f0' : 'none', 
        display: 'flex', 
        flexDirection: 'column', 
        background: '#f8fafc',
        transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1), border-left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
        position: 'relative',
        order: 3
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

        {/* Layer Visibility Controls */}
        <div style={{ padding: '12px 20px', borderBottom: isMobile ? '1px solid rgba(226, 232, 240, 0.3)' : '1px solid #e2e8f0', background: isMobile ? 'transparent' : '#f8fafc', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em' }}>
            Model Layers
          </div>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '600', color: '#475569', cursor: 'pointer', userSelect: 'none' }}>
              <input 
                type="checkbox" 
                checked={showBody} 
                onChange={(e) => setShowBody(e.target.checked)}
                style={{ width: '15px', height: '15px', accentColor: '#3b82f6', cursor: 'pointer' }}
              />
              <span>Body Mesh</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '600', color: '#475569', cursor: 'pointer', userSelect: 'none' }}>
              <input 
                type="checkbox" 
                checked={showSkeleton} 
                onChange={(e) => setShowSkeleton(e.target.checked)}
                style={{ width: '15px', height: '15px', accentColor: '#3b82f6', cursor: 'pointer' }}
              />
              <span>Skeleton</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '600', color: '#475569', cursor: 'pointer', userSelect: 'none' }}>
              <input 
                type="checkbox" 
                checked={showCardio} 
                onChange={(e) => setShowCardio(e.target.checked)}
                style={{ width: '15px', height: '15px', accentColor: '#3b82f6', cursor: 'pointer' }}
              />
              <span>Cardiovascular</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '600', color: '#475569', cursor: 'pointer', userSelect: 'none' }}>
              <input 
                type="checkbox" 
                checked={showHeart} 
                onChange={(e) => setShowHeart(e.target.checked)}
                style={{ width: '15px', height: '15px', accentColor: '#3b82f6', cursor: 'pointer' }}
              />
              <span>Heart Only</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '600', color: '#475569', cursor: 'pointer', userSelect: 'none' }}>
              <input 
                type="checkbox" 
                checked={showNervous} 
                onChange={(e) => setShowNervous(e.target.checked)}
                style={{ width: '15px', height: '15px', accentColor: '#3b82f6', cursor: 'pointer' }}
              />
              <span>Nervous System</span>
            </label>
          </div>
        </div>

        {/* Top Half: Systems and Regions Explorer */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderBottom: '1px solid #e2e8f0' }}>
          {/* System Category Tabs */}
          <div style={{ padding: '10px 14px', borderBottom: isMobile ? '1px solid rgba(226, 232, 240, 0.3)' : '1px solid #e2e8f0', display: 'flex', flexWrap: 'wrap', gap: '6px', background: '#ffffff' }}>
            {allSystems.map((sys) => (
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
            {selectedSystem === "Cardiovascular" ? (
              // Grouped cardiovascular list
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {['Heart', 'Head & Brain', 'Lungs', 'Kidneys', 'Upper Limbs (Arms/Hands)', 'Lower Limbs (Legs/Feet)', 'Body (Abdomen & Pelvis)', 'Other Vessels'].map((group) => {
                  const groupMeshes = systemMeshes.filter(mesh => mesh.group === group);
                  if (groupMeshes.length === 0) return null;
                  return (
                    <div key={group} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ 
                        fontSize: '11px', 
                        fontWeight: '700', 
                        textTransform: 'uppercase', 
                        color: '#475569', 
                        marginTop: '8px', 
                        marginBottom: '4px', 
                        paddingLeft: '8px',
                        borderLeft: '2px solid #3b82f6',
                        background: '#f1f5f9',
                        padding: '4px 8px',
                        borderRadius: '4px'
                      }}>
                        {group} ({groupMeshes.length})
                      </div>
                      {groupMeshes.map((mesh) => {
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
                              padding: '6px 12px',
                              fontSize: '12px',
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
                  );
                })}
              </div>
            ) : (
              // Standard flat list
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
            )}
          </div>
        </div>

        {/* Bottom Half: System Animations Controls */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f8fafc' }}>
          <div style={{ 
            padding: '12px 20px', 
            borderBottom: '1px solid #e2e8f0', 
            background: '#f1f5f9', 
            fontSize: '10px', 
            fontWeight: '700', 
            textTransform: 'uppercase', 
            color: '#94a3b8', 
            letterSpacing: '0.05em' 
          }}>
            System Animations
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
            {(showHeart || selectedSystem === "Heart") ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
                  Heart Beat Animation
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', lineHeight: '1.4' }}>
                  Simulates a biologically accurate, elastic cardiac cycle (atrial systole followed by ventricular contraction with elastic recoil jiggles) on the isolated heart model.
                </div>
                
                {/* Play/Pause Button */}
                <button
                  onClick={() => setHeartbeatActive(!heartbeatActive)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '10px 16px',
                    fontSize: '12px',
                    fontWeight: '600',
                    borderRadius: '6px',
                    border: 'none',
                    background: heartbeatActive ? '#ef4444' : '#3b82f6',
                    color: '#ffffff',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
                  }}
                >
                  {heartbeatActive ? <Pause size={14} /> : <Play size={14} />}
                  {heartbeatActive ? 'Pause Heartbeat' : 'Start Heartbeat'}
                </button>

                {/* BPM Slider */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '600', color: '#475569' }}>
                    <span>Heart Rate</span>
                    <span style={{ color: '#3b82f6' }}>{heartbeatBpm} BPM</span>
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="180"
                    value={heartbeatBpm}
                    onChange={(e) => setHeartbeatBpm(parseInt(e.target.value))}
                    style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#94a3b8' }}>
                    <span>40 (Bradycardia)</span>
                    <span>72 (Normal)</span>
                    <span>180 (Tachycardia)</span>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center', 
                height: '100%', 
                textAlign: 'center', 
                color: '#94a3b8', 
                padding: '20px', 
                gap: '8px' 
              }}>
                <span style={{ fontSize: '28px' }}>🎬</span>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b' }}>No Active Animations</span>
                <span style={{ fontSize: '11px', color: '#94a3b8', maxWidth: '200px', lineHeight: '1.4' }}>
                  Select the 'Heart' system or enable 'Heart Only' layer to show heartbeat controls.
                </span>
              </div>
            )}
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
