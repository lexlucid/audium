"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';

interface Voice {
  voice_id: string;
  name: string;
}

export default function Home() {
  const [content, setContent] = useState('');
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState('');
  const [speed, setSpeed] = useState(1);
  const apiKey = ELEVENLABS_API_KEY

  useEffect(() => {
    // Fetch available voices from ElevenLabs API
    const fetchVoices = async () => {
      try {
        const response = await fetch('https://api.elevenlabs.io/v1/voices', {
          headers: {
            'xi-api-key': apiKey,
          },
        });
        const data = await response.json();
        setVoices(data.voices);
      } catch (error) {
        console.error('Error fetching voices:', error);
      }
    };

    if (apiKey) {
      fetchVoices();
    }
  }, [apiKey]);

  const handleRead = async () => {
    try {
      const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + selectedVoice, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: content,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
            speed: speed,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate speech');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.play();
    } catch (error) {
      console.error('Error generating speech:', error);
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">ElevenLabs TTS Reader</h1>
   
      <Select onValueChange={setSelectedVoice} value={selectedVoice}>
        <SelectTrigger className="mb-4">
          <SelectValue placeholder="Select a voice" />
        </SelectTrigger>
        <SelectContent>
          {voices.map((voice) => (
            <SelectItem key={voice.voice_id} value={voice.voice_id}>
              {voice.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="mb-4">
        <label className="block mb-2">Speed: {speed.toFixed(1)}x</label>
        <Slider
          min={0.5}
          max={2}
          step={0.1}
          value={[speed]}
          onValueChange={(value) => setSpeed(value[0])}
        />
      </div>
      <Button onClick={handleRead} className="w-full mb-4">Read Content</Button>
      <textarea
        className="w-full h-32 p-2 border rounded"
        placeholder="Content to read..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
    </div>
  );
}