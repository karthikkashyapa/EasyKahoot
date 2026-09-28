# ClassQuiz - Setup & Deployment Guide

A real-time interactive quiz platform for classrooms, similar to Kahoot.

## Project Structure

```
class-quiz/
├── server.js              # Node.js/Express backend server
├── package.json           # Project dependencies
├── .gitignore            # Git ignore rules
├── public/
│   └── index.html        # Frontend application
└── README.md             # This file
```

## Installation & Local Setup

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn package manager

### Step 1: Create Project Directory
```bash
mkdir class-quiz
cd class-quiz
```

### Step 2: Initialize Project
```bash
# Copy server.js, index.html, package.json, and .gitignore to your project directory
# Then install dependencies:
npm install
```

### Step 3: Create Directory Structure
```bash
mkdir public
# Move index.html into the public folder
mv index.html public/index.html
```

### Step 4: Run Locally
```bash
# Start the server (development mode)
npm start

# Or use nodemon for auto-restart on file changes (after npm install):
npm run dev
```

Server will run on `http://localhost:3000` by default. Open this URL in your browser to access the quiz platform.

### Step 5: Test on Multiple Devices
1. Find your machine's local IP address:
   - **macOS/Linux**: `ifconfig | grep "inet "`
   - **Windows**: `ipconfig` (look for IPv4 Address)
   
2. On another device, open: `http://<YOUR_LOCAL_IP>:3000`
3. One device: Create a quiz (teacher role)
4. Other devices: Join the quiz using the generated code

## Environment Configuration

Create a `.env` file in the project root to customize settings:

```env
PORT=3000
NODE_ENV=development
```

Load environment variables by modifying server.js line 293:
```javascript
const PORT = process.env.PORT || 3000;
```

## Deployment Options

### Option 1: Heroku (Recommended for beginners)

1. **Install Heroku CLI** from https://devcenter.heroku.com/articles/heroku-cli

2. **Create Heroku app**:
```bash
heroku login
heroku create your-app-name
```

3. **Deploy**:
```bash
git push heroku main
```

4. **View logs**:
```bash
heroku logs --tail
```

### Option 2: Railway

1. Go to https://railway.app and sign up
2. Connect your GitHub repository
3. Railway auto-detects Node.js apps and deploys automatically
4. Set `PORT` environment variable in Railway dashboard (should default to 3000)

### Option 3: Render

1. Go to https://render.com and sign up
2. Create new Web Service
3. Connect GitHub repository
4. Set build command: `npm install`
5. Set start command: `npm start`
6. Set environment variable `PORT` to `3000`

### Option 4: Replit

1. Go to https://replit.com and sign up
2. Click "Create Repl" → "Import from GitHub"
3. Paste your repo URL
4. Replit auto-detects and runs `npm install` + `npm start`

### Option 5: DigitalOcean/AWS/Azure (VPS)

1. Create a Linux VM (Ubuntu 20.04+ recommended)
2. SSH into your server
3. Install Node.js:
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

4. Clone your repository:
```bash
git clone <your-repo-url>
cd class-quiz
npm install
npm start
```

5. Use **PM2** to keep the server running:
```bash
sudo npm install -g pm2
pm2 start server.js --name "classquiz"
pm2 startup
pm2 save
```

6. Set up **Nginx** as reverse proxy for SSL/TLS (https://)

## Important Configuration Notes

### Socket.io CORS Settings
If deploying to a different domain than where the frontend is hosted, update CORS in `server.js` line 9:

```javascript
const io = socketIO(server, {
    cors: {
        origin: "https://yourdomain.com",  // Update this
        methods: ["GET", "POST"]
    }
});
```

### Icons (Tabler Icons)
The frontend uses Tabler Icons via CDN. For production with Content Security Policy (CSP):
- Allow CDN: `https://cdn.jsdelivr.net`
- Or inline SVG icons as fallback

### Static Files
Ensure `public/index.html` is in the `public/` folder. Express serves it automatically via `app.use(express.static('public'))`.

## Database Considerations (Future)

Current implementation uses in-memory storage (quizzes Map). For production with multiple server instances or persistence:

1. **MongoDB**: Store quiz definitions and results
2. **PostgreSQL**: Structured quiz and scoring data
3. **Redis**: Cache leaderboards for real-time performance

Add to package.json and implement database adapters as needed.

## Troubleshooting

### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000

# Kill process (macOS/Linux)
kill -9 <PID>

# Or use different port
PORT=3001 npm start
```

### Socket.io Connection Fails
- Check firewall allows WebSocket connections
- Verify CORS origin matches your deployment domain
- Check browser console for WebSocket errors

### Students Can't Join on Phone
- Ensure phone and computer are on same network
- Use local IP address (not localhost)
- Check firewall isn't blocking connections

## Next Steps

1. **Add Database**: Implement quiz persistence with MongoDB/PostgreSQL
2. **XML/AIKEN Import**: Parse question files to auto-populate quizzes
3. **Authentication**: Add teacher login/dashboard
4. **Question Bank**: Store and reuse quiz questions
5. **Result Analytics**: Track student performance over time
6. **Mobile App**: React Native or Flutter app for mobile experience

## Support

For issues or questions:
- Check Socket.io documentation: https://socket.io/
- Express.js documentation: https://expressjs.com/
- Node.js documentation: https://nodejs.org/

---

**Version**: 1.0.0  
**Last Updated**: 2026-09-28
