from flask import Flask, request, jsonify
from transformers import pipeline

app = Flask(__name__)
classifier = pipeline("zero-shot-classification", model="facebook/bart-large-mnli")

LABELS = ["bug", "frontend", "backend", "docs"]

@app.route("/predict", methods=["POST"])
def predict():
    text = request.json.get("text")
    result = classifier(text, LABELS)
    predictions = [label for label, score in zip(result["labels"], result["scores"]) if score > 0.4]
    return jsonify(predictions)
