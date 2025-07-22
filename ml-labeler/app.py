from flask import Flask, request, jsonify
from transformers import pipeline
from flask_cors import CORS
import torch

app = Flask(__name__)
CORS(app)

classifier = pipeline("zero-shot-classification", model="facebook/bart-large-mnli")

LABELS = [
    "bug", "frontend", "backend", "docs",
    "test", "devops", "performance", "security", "refactor"
]

@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json()
    text = data.get("text", "")
    print("Received request with data:", data)
    print(f"Received text: '{text}'")

    if not text.strip():
        print("Empty or missing 'text' field in request.")
        return jsonify([]), 400

    try:
        print("Running classification on:", text)
        result = classifier(text, LABELS)
        print("Raw model output:", result)

        top_labels = [
            label for label, score in zip(result["labels"], result["scores"])
            if score > 0.3
        ]
        print("Top predicted labels:", top_labels)

        return jsonify(top_labels)
    except Exception as e:
        print("Prediction error:", e)
        return jsonify([]), 500

if __name__ == "__main__":
    print("ML Labeler Flask server on http://localhost:5000")
    app.run(debug=True, port=5050)
