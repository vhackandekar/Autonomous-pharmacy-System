
# Use official Python image
FROM python:3.10-slim

# Install system dependencies for OpenCV and EasyOCR
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --upgrade pip
RUN pip install torch==2.4.1
RUN pip install -r requirements.txt

# Copy the rest of the code
COPY . .

# Expose port
EXPOSE 8000

# Command to run the service
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port $PORT"]
