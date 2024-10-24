chrome.contextMenus.create({
    id: "readText",
    title: "Read selected text",
    contexts: ["selection"]
  });
  
  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "readText") {
      const selectedText = info.selectionText;
      
      // Get saved settings
      const settings = await chrome.storage.sync.get(['selectedVoice', 'speed']);
      
      try {
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${settings.selectedVoice}`, {
          method: 'POST',
          headers: {
            'xi-api-key': API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text: selectedText,
            model_id: "eleven_monolingual_v1",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.5,
              speed: parseFloat(settings.speed || 1.0)
            }
          })
        });
  
        if (!response.ok) throw new Error('TTS request failed');
  
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Play the audio
        const audio = new Audio(audioUrl);
        audio.play();
        
        // Clean up the blob URL after playing
        audio.onended = () => URL.revokeObjectURL(audioUrl);
        
      } catch (error) {
        console.error('Error:', error);
      }
    }
  });