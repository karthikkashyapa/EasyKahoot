const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.static(path.join(__dirname, 'public')));

// Store active quizzes
// Key: pin, Value: { hostId, questions, state, currentQuestionIndex, players, timeLimit, questionStartTime, timeLimitTimer }
const quizzes = new Map();

// Helper to generate a random 6-digit pin
function generatePin() {
    let pin;
    do {
        pin = Math.floor(100000 + Math.random() * 900000).toString();
    } while (quizzes.has(pin));
    return pin;
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // ==========================================
    // HOST EVENTS
    // ==========================================

    socket.on('host-create-quiz', (quizData) => {
        const pin = generatePin();
        quizzes.set(pin, {
            pin,
            mode: quizData.mode || 'classic',
            hostId: socket.id,
            questions: quizData.questions,
            state: 'lobby', // lobby, question, leaderboard, end
            currentQuestionIndex: -1,
            players: new Map(), // socketId -> { name, score, lastAnswerCorrect, streak }
            questionStartTime: null,
            timer: null,
            bossHealth: 100, // For Boss Mode
            classHealth: 100 // For Boss Mode
        });

        socket.join(pin);
        socket.emit('quiz-created', { pin, mode: quizData.mode || 'classic' });
    });

    socket.on('host-start-quiz', (pin) => {
        const quiz = quizzes.get(pin);
        if (quiz && quiz.hostId === socket.id) {
            startNextQuestion(pin);
        }
    });

    socket.on('host-next-question', (pin) => {
        const quiz = quizzes.get(pin);
        if (quiz && quiz.hostId === socket.id) {
            startNextQuestion(pin);
        }
    });

    socket.on('host-end-question', (pin) => {
        const quiz = quizzes.get(pin);
        if (quiz && quiz.hostId === socket.id && quiz.state === 'question') {
            endQuestion(pin);
        }
    });

    // ==========================================
    // PLAYER EVENTS
    // ==========================================

    socket.on('check-room', ({ pin, name }) => {
        const quiz = quizzes.get(pin);
        if (!quiz) {
            socket.emit('join-error', 'Quiz not found');
            return;
        }
        if (quiz.state !== 'lobby') {
            socket.emit('join-error', 'Quiz already started');
            return;
        }

        let nameExists = false;
        quiz.players.forEach(p => {
            // Only consider it 'taken' if the player is actively connected
            if (p.name.toLowerCase() === name.toLowerCase() && !p.disconnected) {
                nameExists = true;
            }
        });

        if (nameExists) {
            socket.emit('join-error', 'Name already taken');
            return;
        }

        socket.emit('join-success', { name });
    });

    socket.on('player-join', ({ pin, name }) => {
        const quiz = quizzes.get(pin);
        if (!quiz) {
            socket.emit('join-error', 'Quiz not found');
            return;
        }
        
        // If they are re-joining (or taking over a dropped session)
        // just delete the old one to avoid race conditions
        let existingSocketId = null;
        quiz.players.forEach((p, id) => {
            if (p.name.toLowerCase() === name.toLowerCase()) {
                existingSocketId = id;
            }
        });
        
        if (existingSocketId) {
            // Transfer score and state
            const oldData = quiz.players.get(existingSocketId);
            
            // Clear their disconnect timeout so they don't get deleted
            if (oldData.disconnectTimeout) clearTimeout(oldData.disconnectTimeout);
            
            quiz.players.delete(existingSocketId);
            
            socket.join(pin);
            quiz.players.set(socket.id, {
                ...oldData,
                id: socket.id,
                disconnected: false
            });
        } else {
            // Brand new player
            if (quiz.state !== 'lobby') {
                socket.emit('join-error', 'Quiz already started');
                return;
            }
            
            socket.join(pin);
            quiz.players.set(socket.id, {
                id: socket.id,
                name,
                score: 0,
                lastAnswerCorrect: false,
                streak: 0,
                hasAnsweredCurrent: false,
                history: []
            });
        }


        socket.emit('join-success', { name });
        
        // Notify host
        const playersList = Array.from(quiz.players.values()).map(p => p.name);
        io.to(quiz.hostId).emit('lobby-update', playersList);
    });

    socket.on('player-answer', ({ pin, answerIndex }) => {
        const quiz = quizzes.get(pin);
        if (!quiz || quiz.state !== 'question') return;
        
        const player = quiz.players.get(socket.id);
        if (!player || player.hasAnsweredCurrent) return;

        player.hasAnsweredCurrent = true;

        const currentQuestion = quiz.questions[quiz.currentQuestionIndex];
        const isCorrect = (answerIndex === currentQuestion.correctAnswerIndex);
        
        let pointsEarned = 0;
        if (isCorrect) {
            if (quiz.mode === 'kbc') {
                const kbcRewards = [1000, 2000, 3000, 5000, 10000, 20000, 40000, 80000, 160000, 320000, 640000, 1250000, 2500000, 5000000, 10000000];
                pointsEarned = kbcRewards[quiz.currentQuestionIndex] || ((quiz.currentQuestionIndex + 1) * 10000);
            } else {
                const timeLimit = currentQuestion.timeLimit * 1000;
                const timeTaken = Date.now() - quiz.questionStartTime;
                const timeRatio = Math.min(timeTaken / timeLimit, 1);
                pointsEarned = Math.round((1 - (timeRatio / 2)) * 1000);
            }
            
            player.score += pointsEarned;
            player.lastAnswerCorrect = true;
            player.streak += 1;
        } else {
            player.lastAnswerCorrect = false;
            player.streak = 0;
        }

        // Record history for final report
        const timeElapsed = (Date.now() - quiz.questionStartTime) / 1000;
        player.history.push({
            questionNumber: quiz.currentQuestionIndex + 1,
            questionText: currentQuestion.text,
            correct: isCorrect,
            timeElapsed: timeElapsed.toFixed(2),
            points: pointsEarned
        });

        // Notify host that a player answered
        io.to(quiz.hostId).emit('player-answered', { 
            answeredCount: Array.from(quiz.players.values()).filter(p => p.hasAnsweredCurrent).length,
            totalCount: quiz.players.size
        });

        // Check if all players have answered
        const allAnswered = Array.from(quiz.players.values()).every(p => p.hasAnsweredCurrent);
        if (allAnswered) {
            endQuestion(pin);
        }
    });

    // ==========================================
    // DISCONNECT
    // ==========================================

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        // Handle host disconnect
        quizzes.forEach((quiz, pin) => {
            if (quiz.hostId === socket.id) {
                io.to(pin).emit('host-disconnected');
                clearTimeout(quiz.timer);
                quizzes.delete(pin);
            } else if (quiz.players.has(socket.id)) {
                // Give player 60 seconds buffer to rejoin
                const player = quiz.players.get(socket.id);
                player.disconnected = true;
                
                player.disconnectTimeout = setTimeout(() => {
                    quiz.players.delete(socket.id);
                    
                    if (quiz.state === 'lobby') {
                        // Only show actively connected players in the lobby
                        const playersList = Array.from(quiz.players.values()).filter(p => !p.disconnected).map(p => p.name);
                        io.to(quiz.hostId).emit('lobby-update', playersList);
                    } else if (quiz.state === 'question') {
                        // Update host about answered count
                         io.to(quiz.hostId).emit('player-answered', { 
                            answeredCount: Array.from(quiz.players.values()).filter(p => p.hasAnsweredCurrent && !p.disconnected).length,
                            totalCount: Array.from(quiz.players.values()).filter(p => !p.disconnected).length
                        });
                        
                        // Check if remaining players have all answered
                        const activePlayers = Array.from(quiz.players.values()).filter(p => !p.disconnected);
                        if (activePlayers.length > 0 && activePlayers.every(p => p.hasAnsweredCurrent)) {
                            endQuestion(pin);
                        }
                    }
                }, 180000); // 3 minutes (180 seconds)
            }
        });
    });

    // ==========================================
    // HELPER FUNCTIONS
    // ==========================================

    function startNextQuestion(pin) {
        const quiz = quizzes.get(pin);
        if (!quiz) return;

        quiz.currentQuestionIndex++;
        
        if (quiz.currentQuestionIndex >= quiz.questions.length) {
            endQuiz(pin);
            return;
        }

        quiz.state = 'question';
        const currentQuestion = quiz.questions[quiz.currentQuestionIndex];
        quiz.questionStartTime = Date.now();
        
        // Reset player answer status
        quiz.players.forEach(p => p.hasAnsweredCurrent = false);

        // Send to host (with answer)
        io.to(quiz.hostId).emit('question-started', {
            question: currentQuestion,
            questionNumber: quiz.currentQuestionIndex + 1,
            totalQuestions: quiz.questions.length,
            mode: quiz.mode
        });

        // Send to players (without answer)
        const playerQuestion = {
            text: currentQuestion.text,
            options: currentQuestion.options,
            timeLimit: currentQuestion.timeLimit,
            questionNumber: quiz.currentQuestionIndex + 1,
            totalQuestions: quiz.questions.length,
            mode: quiz.mode
        };
        socket.to(pin).emit('question-started-player', playerQuestion);

        // Set timer
        if (quiz.timer) clearTimeout(quiz.timer);
        quiz.timer = setTimeout(() => {
            endQuestion(pin);
        }, currentQuestion.timeLimit * 1000 + 1000); // 1s buffer for network latency
    }

    function endQuestion(pin) {
        const quiz = quizzes.get(pin);
        if (!quiz || quiz.state !== 'question') return;

        quiz.state = 'leaderboard';
        if (quiz.timer) clearTimeout(quiz.timer);

        const currentQuestion = quiz.questions[quiz.currentQuestionIndex];
        
        // Calculate leaderboard
        const playersList = Array.from(quiz.players.values())
            .map(p => ({ name: p.name, score: p.score, streak: p.streak }))
            .sort((a, b) => b.score - a.score);

        const topPlayers = playersList.slice(0, 10); // Top 10

        let bossDamage = 0;
        let classDamage = 0;

        if (quiz.mode === 'boss') {
            const correctCount = Array.from(quiz.players.values()).filter(p => p.hasAnsweredCurrent && p.lastAnswerCorrect).length;
            const totalAnswered = Array.from(quiz.players.values()).filter(p => p.hasAnsweredCurrent).length;
            const ratio = totalAnswered > 0 ? correctCount / totalAnswered : 0;
            
            if (ratio >= 0.5) {
                bossDamage = Math.round(ratio * 30); // Up to 30 damage to boss
                quiz.bossHealth = Math.max(0, quiz.bossHealth - bossDamage);
            } else {
                classDamage = Math.round((1 - ratio) * 25); // Up to 25 damage to class
                quiz.classHealth = Math.max(0, quiz.classHealth - classDamage);
            }
        }

        io.to(quiz.hostId).emit('question-ended', {
            correctAnswerIndex: currentQuestion.correctAnswerIndex,
            leaderboard: topPlayers,
            mode: quiz.mode,
            bossHealth: quiz.bossHealth,
            classHealth: quiz.classHealth,
            bossDamage: bossDamage,
            classDamage: classDamage
        });

        // Send individual results to each player
        quiz.players.forEach(player => {
            const position = playersList.findIndex(p => p.name === player.name) + 1;
            io.to(player.id).emit('question-result', {
                correct: player.lastAnswerCorrect,
                score: player.score,
                pointsEarned: player.hasAnsweredCurrent && player.lastAnswerCorrect ? (player.score - (player.previousScore || 0)) : 0,
                position: position,
                streak: player.streak,
                mode: quiz.mode
            });
            player.previousScore = player.score; // store for next time
        });
    }

    function endQuiz(pin) {
        const quiz = quizzes.get(pin);
        if (!quiz) return;

        quiz.state = 'end';
        
        // Compile full report data for CSV export
        const fullReport = Array.from(quiz.players.values()).map(p => ({
            name: p.name,
            score: p.score,
            streak: p.streak,
            history: p.history || []
        }));

        const playersList = Array.from(quiz.players.values())
            .map(p => ({ name: p.name, score: p.score }))
            .sort((a, b) => b.score - a.score);

        const top3 = playersList.slice(0, 3);

        io.to(pin).emit('quiz-ended', {
            winners: top3,
            fullReport: fullReport,
            mode: quiz.mode,
            bossHealth: quiz.bossHealth,
            classHealth: quiz.classHealth
        });
        
        // Don't delete the quiz immediately so the host can extract reports or replay
        // quizzes.delete(pin); // Commented out to allow reconduct
    }

    socket.on('host-replay-quiz', (pin) => {
        const quiz = quizzes.get(pin);
        if (quiz && quiz.hostId === socket.id) {
            // Reset state
            quiz.state = 'lobby';
            quiz.currentQuestionIndex = -1;
            quiz.questionStartTime = null;
            if (quiz.timer) clearTimeout(quiz.timer);
            
            // Clear all players (force them to rejoin)
            quiz.players.clear();

            // Go back to lobby for host
            socket.emit('quiz-created', { pin: pin });
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
