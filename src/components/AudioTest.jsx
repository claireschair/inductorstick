import React, { useState, useRef } from 'react';

export default function AudioClassifier() {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('Offline (Hardware Mode)');
  const [output, setOutput] = useState('Idle');
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const handleConnectMic = async () => {
    if (isRecording) {
      // Stop local recording
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
      setIsRecording(false);
      setStatus('Offline (Hardware Mode)');
      setOutput('Idle');
      return;
    }

    try {
      // Request local browser microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setOutput('Processing captured stream...');
        
        // This is where your model processing or websocket forwarder will take the blob
        console.log('Local Mic Audio Blob ready:', audioBlob);
      };

      mediaRecorderRef.current.start(1000); // Collect data chunks every second
      setIsRecording(true);
      setStatus('Connected (Local PC Mic)');
      setOutput('Streaming live audio...');
    } catch (err) {
      console.error('Microphone access failed:', err);
      setStatus('Error: Mic Access Denied');
    }
  };

  return (
    <div style={{ padding: '1rem', border: '1px solid #ccc', borderRadius: '8px', maxWidth: '400px' }}>
      <h2>Hardware Stream Monitor</h2>
      
      <button 
        onClick={handleConnectMic} 
        style={{ 
          padding: '0.5rem 1rem', 
          backgroundColor: isRecording ? '#ff4d4d' : '#e0e0e0', 
          color: isRecording ? 'white' : 'black',
          cursor: 'pointer',
          fontWeight: 'bold'
        }}
      >
        {isRecording ? 'Disconnect Mic' : 'Connect PC Mic (Fallback)'}
      </button>

      <div style={{ marginTop: '1rem' }}>
        <p>Status: <strong>{status}</strong></p>
        <p>Output: <strong>{output}</strong></p>
      </div>
    </div>
  );
}