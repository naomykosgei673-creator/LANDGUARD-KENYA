FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5001
# gunicorn for a production WSGI server; the model trains on import in app.py
RUN pip install --no-cache-dir gunicorn
CMD ["gunicorn", "-b", "0.0.0.0:5001", "-w", "2", "app:app"]
