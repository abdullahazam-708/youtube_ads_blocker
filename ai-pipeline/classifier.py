import torch
import torch.nn as nn
import torch.optim as optim
import numpy as np
import onnx
import onnxruntime as ort

# 1. Define character vocabulary size (supporting standard ASCII characters)
CHAR_VOCAB_SIZE = 128
MAX_LEN = 100

class URLClassifier(nn.Module):
    """
    A lightweight Feedforward Neural Network that takes a character frequency
    vector of a URL and classifies it as either clean (0) or ad/tracking (1).
    Optimized for fast inference in Go and mobile browsers using ONNX.
    """
    def __init__(self, input_dim):
        super(URLClassifier, self).__init__()
        self.fc = nn.Sequential(
            nn.Linear(input_dim, 32),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(32, 16),
            nn.ReLU(),
            nn.Linear(16, 1),
            nn.Sigmoid()
        )

    def forward(self, x):
        return self.fc(x)

def url_to_feature_vector(url):
    """
    Converts a URL string into a Bag-of-Characters (frequency count) feature vector.
    Length of vector is CHAR_VOCAB_SIZE.
    """
    features = np.zeros(CHAR_VOCAB_SIZE, dtype=np.float32)
    for char in url:
        code = ord(char)
        if code < CHAR_VOCAB_SIZE:
            features[code] += 1.0
    # Normalize features to prevent scale issues
    total = np.sum(features)
    if total > 0:
        features /= total
    return features

# 2. Setup toy dataset for training
# Labels: 1 = Ad/Tracking/Analytics, 0 = Legitimate Content
training_urls = [
    # Ads / Tracking
    ("https://ads.doubleclick.net/gampad/ads?q=123", 1),
    ("https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js", 1),
    ("https://analytics.google.com/g/collect?v=2", 1),
    ("https://adservice.google.com/ddm/adj/N123", 1),
    ("https://track.amazon-adsystem.com/e/ir", 1),
    ("https://pixel.facebook.com/tr/?id=123", 1),
    ("https://analytics.tiktok.com/api/v2/pixel", 1),
    ("https://stats.g.doubleclick.net/r/collect", 1),
    ("https://telemetry.reddit.com/v1/events", 1),
    ("https://adnxs.com/seg?app_id=12", 1),
    
    # Clean / Legitimate
    ("https://wikipedia.org/wiki/Artificial_intelligence", 0),
    ("https://github.com/google/jax", 0),
    ("https://news.ycombinator.com/item?id=456", 0),
    ("https://stackoverflow.com/questions/tagged/python", 0),
    ("https://docs.microsoft.com/en-us/dotnet", 0),
    ("https://reddit.com/r/learnprogramming", 0),
    ("https://medium.com/engineering-at-scale", 0),
    ("https://amazon.com/dp/B08N5WRWNW", 0),
    ("https://youtube.com/watch?v=dQw4w9WgXcQ", 0),
    ("https://nytimes.com/section/technology", 0)
]

def train_and_export():
    print("[AI Shield] Preparing training dataset...")
    X_train = np.array([url_to_feature_vector(url) for url, _ in training_urls], dtype=np.float32)
    y_train = np.array([label for _, label in training_urls], dtype=np.float32).reshape(-1, 1)

    X_tensor = torch.tensor(X_train)
    y_tensor = torch.tensor(y_train)

    # Initialize model
    model = URLClassifier(CHAR_VOCAB_SIZE)
    criterion = nn.BCELoss()
    optimizer = optim.Adam(model.parameters(), lr=0.01)

    print("[AI Shield] Training dynamic URL anomaly detection model...")
    model.train()
    for epoch in range(100):
        optimizer.zero_grad()
        outputs = model(X_tensor)
        loss = criterion(outputs, y_tensor)
        loss.backward()
        optimizer.step()
        
        if (epoch + 1) % 20 == 0:
            print(f"Epoch [{epoch+1}/100], Loss: {loss.item():.4f}")

    print("[AI Shield] Training completed. Verifying accuracy...")
    model.eval()
    with torch.no_grad():
        predictions = model(X_tensor)
        predicted_classes = (predictions > 0.5).float()
        accuracy = (predicted_classes == y_tensor).float().mean()
        print(f"Validation Accuracy: {accuracy.item() * 100:.2f}%")

    # 3. Export to ONNX format
    print("[AI Shield] Exporting trained PyTorch model to ONNX format...")
    onnx_file_path = "url_classifier.onnx"
    dummy_input = torch.randn(1, CHAR_VOCAB_SIZE, dtype=torch.float32)
    
    torch.onnx.export(
        model,
        dummy_input,
        onnx_file_path,
        export_params=True,
        opset_version=11,
        do_constant_folding=True,
        input_names=['input'],
        output_names=['output'],
        dynamic_axes={'input': {0: 'batch_size'}, 'output': {0: 'batch_size'}}
    )
    print(f"[AI Shield] Model successfully exported to: {onnx_file_path}")

    # 4. Verify ONNX Model Load
    print("[AI Shield] Loading and verifying ONNX model inference using ONNX Runtime...")
    ort_session = ort.InferenceSession(onnx_file_path)
    
    test_urls = [
        "https://track.analytics.adserver.com/pixels",
        "https://stackoverflow.com/questions"
    ]
    
    for test_url in test_urls:
        vec = url_to_feature_vector(test_url).reshape(1, -1)
        ort_inputs = {ort_session.get_inputs()[0].name: vec}
        ort_outs = ort_session.run(None, ort_inputs)
        prob = ort_outs[0][0][0]
        prediction = "AD/TRACKER" if prob > 0.5 else "CLEAN"
        print(f"URL: {test_url}\n -> Ad Score: {prob:.4f} ({prediction})\n")

if __name__ == "__main__":
    train_and_export()
