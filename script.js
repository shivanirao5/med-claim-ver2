// Get references to DOM elements
const apiKeyInput = document.getElementById('apiKey');
const imageUpload = document.getElementById('imageUpload');
const imageContainer = document.getElementById('image-container');
const imagePreview = document.getElementById('imagePreview');
const canvas = document.getElementById('bboxCanvas');
const analyzeButton = document.getElementById('analyzeButton');
const loader = document.getElementById('loader');
const resultsContainer = document.getElementById('results-container');
const resultsDiv = document.getElementById('results');

const ctx = canvas.getContext('2d');
let imageBase64 = null;

// Handle image upload
imageUpload.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Reset previous state
    clearCanvas();
    resultsContainer.classList.add('hidden');
    
    // Read and display the image
    const reader = new FileReader();
    reader.onload = (e) => {
        imagePreview.src = e.target.result;
        imageContainer.classList.remove('hidden');
        
        // Remove the data URL prefix for the API
        imageBase64 = e.target.result.split(',')[1]; 
        
        // Wait for image to be fully loaded to set canvas dimensions
        imagePreview.onload = () => {
            canvas.width = imagePreview.clientWidth;
            canvas.height = imagePreview.clientHeight;
            analyzeButton.disabled = false;
        };
    };
    reader.readAsDataURL(file);
});

// Handle "Analyze" button click
analyzeButton.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value;
    if (!apiKey) {
        alert('Please enter your Gemini API key.');
        return;
    }
    if (!imageBase64) {
        alert('Please upload an image first.');
        return;
    }

    // Show loader and disable button
    loader.classList.remove('hidden');
    analyzeButton.disabled = true;
    resultsContainer.classList.add('hidden');
    clearCanvas();

    // Call the Gemini API
    await callGeminiAPI(apiKey);

    // Hide loader and re-enable button
    loader.classList.add('hidden');
    analyzeButton.disabled = false;
});

async function callGeminiAPI(apiKey) {
    const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`;

    // A precise prompt asking for JSON output with bounding boxes
    const prompt = `
        Analyze this image of a handwritten prescription.
        1. Identify all medicine names, including any dosage information written next to them.
        2. For each identified medicine, provide its bounding box coordinates.
        3. The response MUST be a valid JSON array. Each object in the array should contain:
           - "name": The extracted medicine name (e.g., "Azel 80 capsule").
           - "box_2d": An array [ymin, xmin, ymax, xmax] with coordinates normalized to 0-1000.
           
        Example Response:
        [
            {
                "name": "Actorise 25 Injection",
                "box_2d": [450, 150, 550, 750]
            }
        ]
        
        If no medicine names are found, return an empty array [].
    `;

    const requestBody = {
        "contents": [
            {
                "parts": [
                    { "text": prompt },
                    {
                        "inlineData": {
                            "mimeType": "image/jpeg",
                            "data": imageBase64
                        }
                    }
                ]
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json"
        }
    };

    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`API Error: ${error.error.message}`);
        }

        const responseData = await response.json();
        const content = responseData.candidates[0].content.parts[0].text;
        
        // Gemini might wrap JSON in markdown, so we clean it
        const cleanedJson = content.replace(/^```json\s*|```\s*$/g, '');
        const medicines = JSON.parse(cleanedJson);
        
        displayResults(medicines);

    } catch (error) {
        console.error('Error:', error);
        resultsDiv.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
        resultsContainer.classList.remove('hidden');
    }
}

function displayResults(medicines) {
    resultsDiv.innerHTML = ''; // Clear previous results

    if (!medicines || medicines.length === 0) {
        resultsDiv.innerHTML = '<p>No medicine names were detected.</p>';
    } else {
        const ul = document.createElement('ul');
        medicines.forEach(med => {
            // Display the name
            const li = document.createElement('li');
            li.textContent = med.name;
            ul.appendChild(li);

            // Draw the bounding box
            drawBoundingBox(med.box_2d, med.name);
        });
        resultsDiv.appendChild(ul);
    }
    resultsContainer.classList.remove('hidden');
}

function drawBoundingBox(box, label) {
    if (!box || box.length !== 4) return;

    // Descale coordinates from 0-1000 range to canvas dimensions
    const [ymin, xmin, ymax, xmax] = box;
    const absX = (xmin / 1000) * canvas.width;
    const absY = (ymin / 1000) * canvas.height;
    const boxWidth = ((xmax - xmin) / 1000) * canvas.width;
    const boxHeight = ((ymax - ymin) / 1000) * canvas.height;

    // Draw the rectangle
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)'; // Red, semi-transparent
    ctx.lineWidth = 3;
    ctx.strokeRect(absX, absY, boxWidth, boxHeight);
    
    // Draw the label
    ctx.fillStyle = 'red';
    ctx.font = '16px Arial';
    ctx.fillText(label, absX, absY > 20 ? absY - 5 : absY + boxHeight + 15);
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}