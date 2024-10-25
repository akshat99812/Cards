import { Server } from "socket.io";
import { createServer } from "http";
import express from "express";
import cors from "cors";
import userRouter from "./user";

const router = express.Router()

const app = express();
const server = createServer(app);
app.use(cors());
app.use(express.json());

// app.use("/user", userRouter);

const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

// Player queue and room configuration
const queues:{[key:string]:any} = {
    3: [],
    4: [],
    5: [],
    6: []
};
//const ROOM_SIZE = 4; // Adjust the number to your room capacity

const rooms: { [roomId: string]: any } = {}; // Keep track of rooms and lastPlayed data

const getAllRooms = () => {
    const rooms = Array.from(io.sockets.adapter.rooms.keys()); // Get all room IDs
    const filteredRooms = rooms.filter(room => !io.sockets.adapter.sids.has(room)); // Filter out individual sockets
    return filteredRooms;
};

// When a user connects
io.on('connection', (socket) => {
    console.log('A player connected: ' + socket.id);

    socket.on('join-queue', (roomSize: 3 | 4 | 5 | 6) => {
        if (queues[roomSize]) {
            queues[roomSize].push(socket.id);
            console.log(`Player ${socket.id} added to queue for room size ${roomSize}. Current queue: ${queues[roomSize]}`);

            if (queues[roomSize].length >= roomSize) {
                const roomId = `room-${Math.random().toString(36).substring(2, 10)}`;
                const leaderId = queues[roomSize][0];
                const playersInRoom = queues[roomSize].splice(0, roomSize);

                rooms[roomId] = { players: playersInRoom, currentTurn: 0 };

                playersInRoom.forEach((playerId: string, index: number) => {
                    const playerSocket = io.sockets.sockets.get(playerId);
                    if (playerSocket) {
                        playerSocket.join(roomId);
                        playerSocket.emit('room-joined', { roomId, players: playersInRoom, leaderId, playerId });
                        console.log(`Player ${playerId} added to room ${roomId}`);
                    }
                });

                io.to(roomId).emit('start-game', `Game started in room: ${roomId} with ${roomSize} players`);
                io.to(roomId).emit('turn', { roomId, playerId: leaderId });
                console.log(`Leader ${leaderId} has the first turn in room ${roomId}`);
            }
        } else {
            console.error(`Invalid room size: ${roomSize}`);
        }
    });

    // Handle player turn actions
    socket.on('playCard', (data) => {
        const { roomId, player, card } = data;
        const room = rooms[roomId];

        if (room && room.players[room.currentTurn] === player) {
            io.to(roomId).emit('lastPlayed', { player, card });
            console.log(`Player ${player} played ${card} in room ${roomId}`);
            
            // Advance turn to the next player
            room.currentTurn = (room.currentTurn + 1) % room.players.length;
            const nextPlayer = room.players[room.currentTurn];

            io.to(roomId).emit('turn', { roomId, playerId: nextPlayer });
            console.log(`Next turn is for player ${nextPlayer} in room ${roomId}`);
        } else {
            socket.emit('error', 'It is not your turn!');
            console.error(`Player ${player} attempted to play out of turn in room ${roomId}`);
        }
    });

    socket.on('skipTurn', (data) => {
        const { roomId, player } = data;
        const room = rooms[roomId];

        if (room && room.players[room.currentTurn] === player) {
            console.log(`Player ${player} skipped their turn in room ${roomId}`);
            
            // Advance to the next player
            room.currentTurn = (room.currentTurn + 1) % room.players.length;
            const nextPlayer = room.players[room.currentTurn];

            // Notify the room of the next player's turn
            console.log("contol reached");
            io.to(roomId).emit('turn', { roomId, playerId: nextPlayer });
            console.log(`Next turn is for player ${nextPlayer} in room ${roomId}`);
        } else {
            socket.emit('error', 'It is not your turn to skip!');
            console.error(`Player ${player} attempted to skip out of turn in room ${roomId}`);
        }
    });

    // Handle player disconnection
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        for (const roomId in rooms) {
            const room = rooms[roomId];
            const playerIndex = room.players.indexOf(socket.id);

            if (playerIndex > -1) {
                room.players.splice(playerIndex, 1);
                console.log(`Player ${socket.id} removed from room ${roomId}`);

                if (room.players.length === 0) {
                    delete rooms[roomId];
                    console.log(`Room ${roomId} deleted because it's empty`);
                } else {
                    room.currentTurn %= room.players.length; // Adjust turn if players leave
                }
            }
        }
    });
});
// Basic route to check server status
app.get('/', (req, res) => {
  res.send('<h1>Hello world</h1>');

});

const cards = [1,2,3,4,5,6,7,8,9,10,11,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52];

app.post('/getCards',(req:any,res:any)=>{
 
    const shuffleCards=(array:number[])=>{
        for (var i = array.length - 1; i >= 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = array[i];
            array[i] = array[j];
            array[j] = temp;
        }
        return array;
    }

    const sC=shuffleCards(cards);

    const {roomSize,roomId} = req.body;

    if (!roomSize || roomSize <= 0) {
        return res.status(400).send("Invalid room size");
    }

    const shuffledCards = shuffleCards(cards);

    // Calculate how many cards each player should get
    const cardsPerPlayer = Math.floor(shuffledCards.length / roomSize);
    const playerCards: any[] = [];

    // Distribute the cards equally among players
    for (let i = 0; i < roomSize; i++) {
        playerCards.push(shuffledCards.slice(i * cardsPerPlayer, (i + 1) * cardsPerPlayer));
    }

    // If there are remaining cards (due to unequal division), distribute the extra cards
    const remainingCards = shuffledCards.slice(roomSize * cardsPerPlayer);
    for (let i = 0; i < remainingCards.length; i++) {
        playerCards[i].push(remainingCards[i]);
    }
    
    //sendingplayer cards to the leader of the room
    res.send(playerCards);

    const room = io.sockets.adapter.rooms.get(roomId);

    if (room) {
        let i = 0;  // This will track the player index for card assignment

        room.forEach((socketId) => {
            // Make sure we have a card set for each player
            if (i < playerCards.length) {
                // Send the respective player's card set to that player
                io.to(socketId).emit('cardsDistributed', playerCards[i]);

                console.log(`Distributed cards to player ${i}:`, playerCards[i]);
                i++;  // Move to the next player's card set
            }
        });
    } else {
        console.error('Room not found');
    }
    
    //sending all their cards
   // io.in(roomId).emit("cardsDistributed", playerCards);
})


// Start the server
server.listen(3000, () => {
  console.log('server running at http://localhost:3000');
});

