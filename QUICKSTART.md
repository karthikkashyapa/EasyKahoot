# ClassQuiz - Quick Start (5 minutes)

## Run Locally Right Now

### 1. Folder Setup
```bash
mkdir class-quiz && cd class-quiz
```

### 2. Create These Files
- `server.js` (copy from provided file)
- `package.json` (copy from provided file)
- Create `public/` folder
- `public/index.html` (copy from provided file)

### 3. Install & Run
```bash
npm install
npm start
```

Open browser: **http://localhost:3000**

## Test on Phone (Same WiFi Network)

### 1. Find your computer's IP: 
- Mac/Linux: `ifconfig | grep inet`
- Windows: `ipconfig`

### 2. On phone, open: 
**http://192.168.X.X:3000** (replace with your IP)

---

## Play Over the Internet (Any Network/Data)

If your students are not on the same WiFi network (e.g., they are at home or using mobile data), you can easily create a public link for your quiz:

### 1. Run this command in a new terminal:
```bash
npx localtunnel --port 3000
```
*(Press `y` if it asks to install localtunnel)*

### 2. Share the Link:
The command will output a URL like `https://some-random-words.loca.lt`. 
- Share this exact link with your students.
- **Note:** The first time they open it, they may see a warning page. They just need to click "Click to Continue".

---

## How to Play

### Teacher Creates Quiz:
- Open the app (localhost or the public link)
- Click "Host a Quiz"
- Upload an Aiken or Text quiz file
- Click "Create Quiz Room"
- Share the 6-digit PIN with students

### Students Join:
- Click "Join Quiz"
- Enter code
- Enter name
- Answer questions in real-time
- See leaderboard update instantly

## Deploy Online (Pick One)

### Easiest: Heroku
```bash
heroku login
heroku create
git push heroku main
```

### Free Alternative: Railway
1. Go to railway.app
2. Connect GitHub
3. Deploy (auto-detected)

### Other Options: Render, Replit, DigitalOcean

See SETUP_GUIDE.md for detailed instructions on each platform.

---

**That's it! You now have a working real-time quiz platform.** 🎉
