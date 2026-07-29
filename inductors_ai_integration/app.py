import os
import numpy as np
import ai_edge_litert.interpreter as litert
from flask import Flask, request, jsonify
from flask_cors import CORS  #stop browser security blocks when testing

app = Flask(__name__)
CORS(app)  

MODEL_PATH = "soundclassifier_with_metadata.tflite" #both files need to be there for this to work
LABELS_PATH = "labels.txt"
if not os.path.exists(MODEL_PATH) or not os.path.exists(LABELS_PATH):
    raise FileNotFoundError("missing model or labels go check")

#load the model globally ONCE!
print("loading litert...")
interpreter = litert.Interpreter(model_path=MODEL_PATH)
interpreter.allocate_tensors()
input_details = interpreter.get_input_details()
output_details = interpreter.get_output_details()

with open(LABELS_PATH, 'r') as f:
    labels = [line.strip() for line in f.readlines()]
print(f"server ready. tracking: {labels}")

# Fixed endpoint to match frontend and added OPTIONS method to handle preflight handshake
@app.route('/predict', methods=['POST', 'OPTIONS'])
def classify_audio():
    if request.method == 'OPTIONS':
        return '', 200

    try:
        #extract float32 array from request data
        raw_data = request.data
        if not raw_data:
            return jsonify({'error': 'empty data'}), 400
        
        #convert buffer to a NumPy array
        audio = np.frombuffer(raw_data, dtype=np.float32).copy()
        audio = np.nan_to_num(audio)

        target_length = 44032

        #sliding RMS (root mean square) window processing logic
        if len(audio) > target_length:
            hop_size = 4410
            max_energy = -1
            start_idx = 0

            for i in range(0, len(audio) - target_length + 1, hop_size):
                window = audio[i:i + target_length]
                energy = np.sqrt(np.mean(window**2))
                if energy > max_energy:
                    max_energy = energy
                    start_idx = i

            audio = audio[start_idx:start_idx + target_length]
        else:
            audio = np.pad(audio, (0, target_length - len(audio)), 'constant')

        max_val = np.max(np.abs(audio))
        if max_val > 1e-4:
            audio = audio / max_val

        #prep model shape [1, 44032]
        model_input = np.expand_dims(audio, axis=0).astype(np.float32)
        
        interpreter.set_tensor(input_details[0]['index'], model_input)
        interpreter.invoke()
        
        predictions = interpreter.get_tensor(output_details[0]['index'])[0]
        predictions = np.nan_to_num(predictions)

        #convert to probabilities distrib
        if np.isclose(np.sum(predictions), 1.0, atol=1e-3):
            probabilities = predictions
        else:
            exp_preds = np.exp(predictions - np.max(predictions))
            probabilities = exp_preds / exp_preds.sum()

        best_idx = np.argmax(probabilities)

        return jsonify({
            'status': 'success',
            'class': labels[best_idx],
            'confidence': float(probabilities[best_idx]),
            'all_probabilities': {labels[i]: float(probabilities[i]) for i in range(len(labels))}
        })

    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

if __name__ == '__main__':
    #run locally
    app.run(host='0.0.0.0', port=5000, debug=True)