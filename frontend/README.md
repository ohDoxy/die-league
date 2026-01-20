# Beer Die League Frontend

A modern, responsive frontend for the Beer Die League API.

## Features

- 🎨 Beautiful, modern UI with gradient backgrounds and smooth animations
- 📱 Fully responsive design that works on mobile and desktop
- 🎯 Tab-based navigation for Players, Teams, and Games
- ➕ Easy-to-use forms to add new entries
- 🎮 Visual game score display with winner highlighting
- ⚡ Real-time data fetching from the FastAPI backend

## How to Use

1. Start your FastAPI backend:
   ```bash
   uvicorn main:app --reload
   ```

2. Open `index.html` in your web browser, or use a simple HTTP server:
   ```bash
   # Python 3
   cd frontend
   python -m http.server 8080
   
   # Then open http://localhost:8080 in your browser
   ```

3. The frontend will automatically connect to `http://localhost:8000` (your FastAPI backend).

## Design Features

- **Color Scheme**: Modern purple/blue gradient with orange accents
- **Cards**: Clean card-based layout for displaying data
- **Forms**: Modal popups for adding new entries
- **Animations**: Smooth transitions and hover effects
- **Game Display**: Special score visualization with winner highlighting

## Customization

You can customize the API URL by editing `API_BASE_URL` in `script.js` if your backend runs on a different port or domain.

