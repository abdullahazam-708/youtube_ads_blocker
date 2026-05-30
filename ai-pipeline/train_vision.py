import torch
import torch.nn as nn
import torch.optim as optim
import torchvision.transforms as transforms
from PIL import Image
import numpy as np
import onnx
import onnxruntime as ort

class VisionAdDetector(nn.Module):
    """
    A lightweight Convolutional Neural Network (CNN) optimized for NPU inference on
    mobile/desktop. It takes a visual render or screenshot of a UI layout zone
    (e.g., resized to 64x64) and predicts the probability that it represents an ad container.
    """
    def __init__(self):
        super(VisionAdDetector, self).__init__()
        self.conv_layers = nn.Sequential(
            nn.Conv2d(3, 16, kernel_size=3, padding=1),  # Input: 3x64x64
            nn.ReLU(),
            nn.MaxPool2d(2, 2),                          # Out: 16x32x32
            
            nn.Conv2d(16, 32, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2, 2),                          # Out: 32x16x16
            
            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2, 2)                           # Out: 64x8x8
        )
        self.fc_layers = nn.Sequential(
            nn.Linear(64 * 8 * 8, 128),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(128, 1),
            nn.Sigmoid()
        )

    def forward(self, x):
        x = self.conv_layers(x)
        x = x.view(x.size(0), -1)  # Flatten
        x = self.fc_layers(x)
        return x

def create_synthetic_data(num_samples=50):
    """Generates synthetic RGB layout chunks representing ads (high colorful noise/text blocks) vs clean layout."""
    X = np.random.rand(num_samples, 3, 64, 64).astype(np.float32)
    # Give synthetic ads (class 1) specific pixel patterns (e.g. bold boxes or noise patterns)
    y = np.random.randint(0, 2, size=(num_samples, 1)).astype(np.float32)
    for i in range(num_samples):
        if y[i] == 1.0:
            X[i, 0, 10:30, 10:50] += 0.5  # Simulate visual high contrast banner regions
            X[i] = np.clip(X[i], 0.0, 1.0)
    return X, y

def train_and_export_vision():
    print("[AI Shield Vision] Initializing synthetic image datasets...")
    X_train, y_train = create_synthetic_data(100)
    
    X_tensor = torch.tensor(X_train)
    y_tensor = torch.tensor(y_train)

    model = VisionAdDetector()
    criterion = nn.BCELoss()
    optimizer = optim.Adam(model.parameters(), lr=0.005)

    print("[AI Shield Vision] Training mobile visual layout ad detection model...")
    model.train()
    for epoch in range(50):
        optimizer.zero_grad()
        outputs = model(X_tensor)
        loss = criterion(outputs, y_tensor)
        loss.backward()
        optimizer.step()
        
        if (epoch + 1) % 10 == 0:
            print(f"Epoch [{epoch+1}/50], Loss: {loss.item():.4f}")

    print("[AI Shield Vision] Training completed.")
    model.eval()

    # Export Vision Model to ONNX
    onnx_file_path = "vision_ad_detector.onnx"
    dummy_input = torch.randn(1, 3, 64, 64, dtype=torch.float32)
    
    print(f"[AI Shield Vision] Exporting to ONNX format at {onnx_file_path}...")
    torch.onnx.export(
        model,
        dummy_input,
        onnx_file_path,
        export_params=True,
        opset_version=11,
        do_constant_folding=True,
        input_names=['image_input'],
        output_names=['ad_probability'],
        dynamic_axes={'image_input': {0: 'batch_size'}, 'ad_probability': {0: 'batch_size'}}
    )
    print("[AI Shield Vision] Vision ONNX model successfully saved.")

if __name__ == "__main__":
    train_and_export_vision()
