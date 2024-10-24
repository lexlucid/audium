const API_KEY = 'sk_fc900edb83e66b1a26167566020650477cba4253dd88dd04';

// content.js
let currentAudio = null;
let readingQueue = [];
let isReading = false;

// Add console logging for debugging
function log(message, data = '') {
  console.error(`TTS Extension: ${message}`, data);
}

function findTextNodes() {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        if (node.parentElement.tagName === 'SCRIPT' || 
            node.parentElement.tagName === 'STYLE') {
          return NodeFilter.FILTER_REJECT;
        }
        return node.textContent.trim().length > 0 ? 
          NodeFilter.FILTER_ACCEPT : 
          NodeFilter.FILTER_REJECT;
      }
    }
  );

  const textNodes = [];
  let node;
  while (node = walker.nextNode()) {
    textNodes.push(node);
  }
  log(`Found ${textNodes.length} text nodes`);
  return textNodes;
}

function highlightNode(node) {
  if (node.parentElement.classList.contains('tts-highlight')) {
    return;
  }

  const wrapper = document.createElement('span');
  wrapper.className = 'tts-highlight';
  
  const button = document.createElement('button');
  button.className = 'tts-button';
  button.innerHTML = '▶';
  
  // Add event listener with error handling
  button.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    log('Play button clicked', node.textContent.slice(0, 50) + '...');
    try {
      await readText(node.textContent);
    } catch (error) {
      log('Error in button click handler:', error);
      alert('Error playing text. Please check the console for details.');
    }
  });
  
  node.parentNode.insertBefore(wrapper, node);
  wrapper.appendChild(node);
  wrapper.appendChild(button);
}

async function readText(text) {
  if (!text || text.trim().length === 0) {
    log('Empty text provided');
    return;
  }

  log('Starting readText with:', text.slice(0, 50) + '...');

  if (currentAudio) {
    log('Stopping current audio');
    currentAudio.pause();
    currentAudio = null;
  }

  try {
    const settings = await chrome.storage.sync.get(['selectedVoice', 'speed']);
    log('Retrieved settings:', settings);

    if (!settings.selectedVoice) {
      throw new Error('No voice selected. Please select a voice in the extension popup.');
    }

    log('Fetching audio from ElevenLabs API');
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${settings.selectedVoice}`, {
      method: 'POST',
      headers: {
        'xi-api-key': API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: text,
        model_id: "eleven_monolingual_v1",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
          speed: parseFloat(settings.speed || 1.0)
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API request failed: ${response.status} ${response.statusText}\n${JSON.stringify(errorData)}`);
    }

    log('Audio received, creating blob');
    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    
    log('Playing audio');
    currentAudio = new Audio(audioUrl);
    
    currentAudio.onerror = (error) => {
      log('Audio playback error:', error);
      URL.revokeObjectURL(audioUrl);
      currentAudio = null;
    };
    
    currentAudio.onended = () => {
      log('Audio finished playing');
      URL.revokeObjectURL(audioUrl);
      currentAudio = null;
      if (readingQueue.length > 0 && isReading) {
        readText(readingQueue.shift());
      }
    };
    
    await currentAudio.play();
    
  } catch (error) {
    log('Error in readText:', error);
    alert(`Error playing text: ${error.message}`);
    throw error;
  }
}

// Add this at the beginning of your content.js
function createSidebar() {
  log('Creating sidebar');
  const sidebar = document.createElement('div');
  sidebar.id = 'tts-sidebar';
  sidebar.innerHTML = `
    <div id="tts-sidebar-content">
      <h2>TTS Extension</h2>
      <select id="voice-select">
        <option value="loading">Loading voices...</option>
      </select>
      <div>
        <label for="speed">Speed:</label>
        <input type="range" id="speed" min="0.5" max="2.0" step="0.1" value="1.0">
        <span id="speed-value">1.0x</span>
      </div>
      <button id="detect-text">Detect Text on Page</button>
      <button id="read-all">Read All Text</button>
      <button id="stop-reading">Stop Reading</button>
      <div id="status"></div>
    </div>
  `;
  document.body.appendChild(sidebar);

  const toggleButton = document.createElement('button');
  toggleButton.id = 'tts-toggle-button';
  toggleButton.textContent = 'TTS';
  toggleButton.addEventListener('click', () => {
    log('Toggle button clicked');
    sidebar.classList.toggle('open');
  });
  document.body.appendChild(toggleButton);
  log('Sidebar created');
}

async function loadVoices() {
  log('Loading voices');
  const voiceSelect = document.getElementById('voice-select');
  const status = document.getElementById('status');

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': API_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to load voices: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    log('Voices loaded', data);
    voiceSelect.innerHTML = '';
    data.voices.forEach(voice => {
      const option = document.createElement('option');
      option.value = voice.voice_id;
      option.textContent = voice.name;
      voiceSelect.appendChild(option);
    });

    // Load saved voice selection
    const settings = await chrome.storage.sync.get(['selectedVoice']);
    if (settings.selectedVoice) {
      voiceSelect.value = settings.selectedVoice;
    }

    // Save selected voice to storage
    voiceSelect.addEventListener('change', async () => {
      log('Voice selection changed');
      try {
        await chrome.storage.sync.set({ selectedVoice: voiceSelect.value });
        status.textContent = 'Voice saved!';
      } catch (error) {
        console.error('Error saving voice:', error);
        status.textContent = `Error: ${error.message}`;
      }
    });

  } catch (error) {
    console.error('Error loading voices:', error);
    status.textContent = `Error: ${error.message}`;
  }
}

function initializeSidebar() {
  log('Initializing sidebar');
  const voiceSelect = document.getElementById('voice-select');
  const speedSlider = document.getElementById('speed');
  const speedValue = document.getElementById('speed-value');
  const detectButton = document.getElementById('detect-text');
  const readAllButton = document.getElementById('read-all');
  const stopButton = document.getElementById('stop-reading');

  // Update speed value display and save to storage
  speedSlider.addEventListener('input', () => {
    log('Speed changed');
    speedValue.textContent = speedSlider.value + 'x';
    chrome.storage.sync.set({ speed: speedSlider.value });
  });

  // Load saved settings
  chrome.storage.sync.get(['selectedVoice', 'speed'], (result) => {
    log('Loaded saved settings', result);
    if (result.selectedVoice) {
      voiceSelect.value = result.selectedVoice;
    }
    if (result.speed) {
      speedSlider.value = result.speed;
      speedValue.textContent = result.speed + 'x';
    }
  });

  detectButton.addEventListener('click', () => {
    log('Detect Text clicked');
    const textNodes = findTextNodes();
    textNodes.forEach(highlightNode);
  });

  readAllButton.addEventListener('click', () => {
    log('Read All clicked');
    isReading = true;
    const allNodes = findTextNodes();
    readingQueue = allNodes.map(node => node.textContent);
    if (!currentAudio && readingQueue.length > 0) {
      readText(readingQueue.shift());
    }
  });

  stopButton.addEventListener('click', () => {
    log('Stop Reading clicked');
    isReading = false;
    readingQueue = [];
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
  });

  loadVoices();
  log('Sidebar initialized');
}

// Add this function near the top of your file
function observeDOM() {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        const removedNodes = Array.from(mutation.removedNodes);
        if (removedNodes.some(node => node.id === 'tts-sidebar' || node.id === 'tts-toggle-button')) {
          log('Sidebar or toggle button was removed from the DOM');
          createSidebar();
          initializeSidebar();
        }
      }
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Initialize everything when the content script loads
log('Content script loaded');
createSidebar();
initializeSidebar();
observeDOM();

// Message listener for background script commands (if needed)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  log('Received message:', request);
  // Handle any messages from the background script if necessary
});
