import React, { useEffect, useRef } from "react";

export default function RGB565VideoPlayer({ primaryUrl, fallbackUrl, className, onConnected, onDisconnected }) {
  const canvasRef = useRef(null);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    let active = true;
    let currentUrl = primaryUrl;

    async function connectStream() {
      while (active) {
        if (!currentUrl) {
          if (onDisconnected) onDisconnected();
          return;
        }

        abortControllerRef.current = new AbortController();
        
        try {
          const response = await fetch(currentUrl, {
            signal: abortControllerRef.current.signal
          });

          if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
          }

          if (onConnected) onConnected();

          const reader = response.body.getReader();
          let buffer = new Uint8Array(0);

          while (active) {
            const { done, value } = await reader.read();
            if (done) break;

            const newBuffer = new Uint8Array(buffer.length + value.length);
            newBuffer.set(buffer);
            newBuffer.set(value, buffer.length);
            buffer = newBuffer;

            // Prevent memory leaks on malformed streams (max 2MB buffer)
            if (buffer.length > 2000000) {
              buffer = new Uint8Array(0);
            }

            // Process buffer
            let parsed = true;
            while (parsed) {
              parsed = false;
              
              // Find header end \r\n\r\n
              let headerEndIdx = -1;
              for (let i = 0; i < buffer.length - 3; i++) {
                if (buffer[i] === 0x0D && buffer[i+1] === 0x0A && buffer[i+2] === 0x0D && buffer[i+3] === 0x0A) {
                  headerEndIdx = i;
                  break;
                }
              }

              if (headerEndIdx !== -1) {
                // We have headers. Try to find Content-Length
                const headerText = new TextDecoder().decode(buffer.subarray(0, headerEndIdx));
                const match = headerText.match(/Content-Length:\s*(\d+)/i);
                
                if (match) {
                  const contentLength = parseInt(match[1], 10);
                  const payloadStartIdx = headerEndIdx + 4;
                  
                  if (buffer.length >= payloadStartIdx + contentLength) {
                    // We have a full frame
                    const frameData = buffer.subarray(payloadStartIdx, payloadStartIdx + contentLength);
                    renderFrame(frameData);
                    
                    // Keep the remaining buffer
                    buffer = buffer.subarray(payloadStartIdx + contentLength);
                    parsed = true; // Loop again in case multiple frames are buffered
                  }
                } else {
                  // If we found headers but no Content-Length, drop them to find the next valid frame
                  buffer = buffer.subarray(headerEndIdx + 4);
                  parsed = true;
                }
              }
            }
          }
        } catch (error) {
          if (error.name === "AbortError") return;
          console.error("Stream error:", error);
          if (currentUrl === primaryUrl && fallbackUrl) {
            console.log("Falling back to video proxy...");
            currentUrl = fallbackUrl;
          } else {
            if (onDisconnected) onDisconnected();
            // Wait a bit before reconnecting to avoid spam
            await new Promise(resolve => setTimeout(resolve, 2000));
            currentUrl = primaryUrl; // Reset to primary URL for next retry
          }
        }
      }
    }

    connectStream();

    return () => {
      active = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [primaryUrl, fallbackUrl, onConnected, onDisconnected]);

  const renderFrame = (rgb565Data) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Determine dimensions based on data length (assuming 2 bytes per pixel)
    let width = 320;
    let height = 240;

    if (rgb565Data.length === 614400) {
      width = 640;
      height = 480; // VGA
    } else if (rgb565Data.length === 153600) {
      width = 320;
      height = 240; // QVGA
    }

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    let outIdx = 0;
    for (let i = 0; i < rgb565Data.length; i += 2) {
      // Assuming Big-endian RGB565: High byte, then Low byte
      const high = rgb565Data[i];
      const low = rgb565Data[i + 1];
      const pixel = (high << 8) | low;

      const r = (pixel >> 11) & 0x1F;
      const g = (pixel >> 5) & 0x3F;
      const b = pixel & 0x1F;

      // Expand 5/6/5 bits to 8 bits
      data[outIdx++] = (r << 3) | (r >> 2);
      data[outIdx++] = (g << 2) | (g >> 4);
      data[outIdx++] = (b << 3) | (b >> 2);
      data[outIdx++] = 255;
    }

    ctx.putImageData(imageData, 0, 0);
  };

  return <canvas ref={canvasRef} className={className} />;
}
