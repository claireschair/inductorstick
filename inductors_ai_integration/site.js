document.getElementById('btn-predict').addEventListener('click', async () => {
    const outputDiv = document.getElementById('output');
    outputDiv.textContent = "Sending request to Flask...";

    // Mock payload: Adjust array length to match your model's input features
    const mockPayload = {
        data: Array.from({ length: 40 }, () => Math.random())
    };

    try {
        const response = await fetch('http://127.0.0.1:5000/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mockPayload)
        });

        const jsonResult = await response.json();
        outputDiv.textContent = JSON.stringify(jsonResult, null, 2);
    } catch (error) {
        outputDiv.textContent = `Error: ${error.message}\n\nCheck if Flask is running and CORS is enabled.`;
    }
});